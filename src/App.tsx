import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameProject,
  GameObject,
  GameScene,
  ObjectRole,
  TemplateType,
  BlockInstance,
  GameAsset,
  GlobalVariable,
  WorkspaceLayoutDimensions,
  DEFAULT_WORKSPACE_DIMENSIONS,
  TileMapCell,
  DialogueEntry,
  QuestEntry,
} from './types/engine';
import { createProjectFromTemplate } from './engine/templates';
import {
  createDefaultObject,
  duplicateObjectInScene,
  getGodotNodeClassForRole,
} from './engine/sceneSystem';
import { runProjectDiagnostics } from './engine/diagnostics';
import { UndoRedoManager } from './engine/undoRedo';
import {
  saveProjectToStorage,
  listProjectsFromStorage,
  saveAssetBinaryToStorage,
  estimateStorageQuota,
} from './engine/storageSystem';
import { audioSystem } from './engine/audioSystem';
import { SceneCanvas, EditorToolMode } from './components/SceneCanvas';
import { BlockWorkspace } from './components/BlockWorkspace';
import { GamePreviewRuntime } from './components/GamePreviewRuntime';
import { AssetAndAtlasPanel } from './components/AssetAndAtlasPanel';
import { CodeAndDocsPanel } from './components/CodeAndDocsPanel';
import { ProjectAndExportModal } from './components/ProjectAndExportModal';
import {
  Play,
  Download,
  FolderPlus,
  Undo2,
  Redo2,
  Layers,
  Box,
  Cpu,
  Image as ImageIcon,
  Code2,
  BookOpen,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sliders,
  Sparkles,
  GripVertical,
  GripHorizontal,
  SlidersHorizontal,
  Maximize2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  FolderTree,
  Radio,
  Film,
  MessageSquare,
  Volume2,
  Search,
  Sun,
  Trash2,
} from 'lucide-react';

export type EditorWorkspaceTab = 'scene' | 'blocks' | 'assets' | 'code' | 'docs' | 'preview';
export type BottomDockTab = 'diagnostics' | 'animation' | 'dialogue_quest' | 'sfx_lab';

export function App() {
  const [project, setProject] = useState<GameProject>(() =>
    createProjectFromTemplate('platformer', 'Zümrüt Vadisi Platformu')
  );
  const [activeSceneId, setActiveSceneId] = useState<string>(
    () => project.startSceneId || project.scenes[0]?.id || ''
  );
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    () =>
      project.scenes[0]?.objects.find((o) => o.role === 'player')?.id ||
      project.scenes[0]?.objects[0]?.id ||
      null
  );
  const [activeTab, setActiveTab] = useState<EditorWorkspaceTab>('scene');
  const [toolMode, setToolMode] = useState<EditorToolMode>('select');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCollisionBoxes, setShowCollisionBoxes] = useState<boolean>(true);

  const [nodeSearchQuery, setNodeSearchQuery] = useState<string>('');
  const [leftLowerTab, setLeftLowerTab] = useState<'filesystem' | 'layers'>('filesystem');
  const [rightInspectorTab, setRightInspectorTab] = useState<'inspector' | 'signals'>('inspector');
  const [bottomDockTab, setBottomDockTab] = useState<BottomDockTab>('diagnostics');

  const [layout, setLayout] = useState<WorkspaceLayoutDimensions>(DEFAULT_WORKSPACE_DIMENSIONS);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'templates' | 'export'>('templates');
  const [windowSizeModalOpen, setWindowSizeModalOpen] = useState(false);
  const [storageQuotaText, setStorageQuotaText] = useState('Yerel DB: ~0.2 MB');
  const [saveIndicator, setSaveIndicator] = useState<'saved' | 'saving'>('saved');

  const historyRef = useRef<UndoRedoManager>(new UndoRedoManager(50));
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const updateLayoutDimensions = useCallback(
    (partial: Partial<WorkspaceLayoutDimensions>) => {
      setLayout((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const [activeSplitter, setActiveSplitter] = useState<
    | null
    | { kind: 'leftWidth'; startX: number; startW: number }
    | { kind: 'rightWidth'; startX: number; startW: number }
    | { kind: 'leftVertical'; startY: number; startRatio: number; totalH: number }
    | { kind: 'bottomHeight'; startY: number; startH: number }
  >(null);

  useEffect(() => {
    if (!activeSplitter) return;
    const onMove = (e: MouseEvent) => {
      if (activeSplitter.kind === 'leftWidth') {
        const nextW = Math.min(
          520,
          Math.max(210, activeSplitter.startW + (e.clientX - activeSplitter.startX))
        );
        updateLayoutDimensions({ sceneLeftWidth: nextW });
      } else if (activeSplitter.kind === 'rightWidth') {
        const nextW = Math.min(
          580,
          Math.max(250, activeSplitter.startW - (e.clientX - activeSplitter.startX))
        );
        updateLayoutDimensions({ sceneRightWidth: nextW });
      } else if (activeSplitter.kind === 'leftVertical') {
        const dy = e.clientY - activeSplitter.startY;
        const nextRatio = Math.min(
          0.78,
          Math.max(
            0.22,
            Number(
              (activeSplitter.startRatio + dy / Math.max(240, activeSplitter.totalH)).toFixed(2)
            )
          )
        );
        updateLayoutDimensions({ sceneLeftSplitRatio: nextRatio });
      } else if (activeSplitter.kind === 'bottomHeight') {
        const dy = activeSplitter.startY - e.clientY;
        const nextH = Math.min(420, Math.max(125, activeSplitter.startH + dy));
        updateLayoutDimensions({ sceneBottomHeight: nextH });
      }
    };
    const onUp = () => setActiveSplitter(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [activeSplitter, updateLayoutDimensions]);

  // Load latest project from IndexedDB on initial mount
  useEffect(() => {
    let mounted = true;
    listProjectsFromStorage().then((list) => {
      if (mounted && list.length > 0 && list[0].scenes.length > 0) {
        const latest = list[0];
        setProject(latest);
        setActiveSceneId(latest.startSceneId || latest.scenes[0].id);
        setSelectedObjectId(latest.scenes[0].objects[0]?.id || null);
        historyRef.current.clear();
      }
    });
    estimateStorageQuota().then((q) => {
      if (mounted) {
        setStorageQuotaText(`Yerel DB: ${(q.usedBytes / (1024 * 1024)).toFixed(2)} MB`);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Debounced auto-save to IndexedDB
  useEffect(() => {
    setSaveIndicator('saving');
    const timer = setTimeout(() => {
      saveProjectToStorage(project).then(() => {
        setSaveIndicator('saved');
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [project]);

  const activeScene =
    project.scenes.find((s) => s.id === activeSceneId) || project.scenes[0];
  const selectedObject =
    activeScene?.objects.find((o) => o.id === selectedObjectId) || null;

  const [backGuardToast, setBackGuardToast] = useState<string | null>(null);
  const tabHistoryRef = useRef<EditorWorkspaceTab[]>([]);

  const commitProjectUpdate = useCallback(
    (updater: (prev: GameProject) => GameProject, commitLabel?: string) => {
      setProject((prev) => {
        if (commitLabel) {
          historyRef.current.recordState(prev, commitLabel);
        }
        return updater(prev);
      });
    },
    []
  );

  const handleRecordUndoSnapshot = useCallback(
    (label: string) => {
      historyRef.current.recordState(project, label);
    },
    [project]
  );

  const handleUndo = useCallback(() => {
    const res = historyRef.current.undo(project);
    if (res) {
      setProject(res.project);
      setBackGuardToast(`↩ Geri Alındı: ${res.label}`);
      setTimeout(() => setBackGuardToast(null), 2400);
    }
  }, [project]);

  const handleRedo = useCallback(() => {
    const res = historyRef.current.redo(project);
    if (res) {
      setProject(res.project);
      setBackGuardToast(`↪ İleri Alındı: ${res.label}`);
      setTimeout(() => setBackGuardToast(null), 2400);
    }
  }, [project]);

  const switchWorkspaceTab = useCallback(
    (nextTab: EditorWorkspaceTab) => {
      setActiveTab((prevTab) => {
        if (prevTab !== nextTab) {
          tabHistoryRef.current = [...tabHistoryRef.current.slice(-15), prevTab];
        }
        return nextTab;
      });
    },
    []
  );

  // Browser Back Button (popstate) Guard: Prevent leaving the site on browser "Back", trigger Undo or previous tab instead!
  useEffect(() => {
    try {
      window.history.pushState({ kareforgeEngineGuard: true }, '', window.location.href);
    } catch {
      // Ignore in restricted environments
    }

    const onPopState = () => {
      try {
        window.history.pushState({ kareforgeEngineGuard: true }, '', window.location.href);
      } catch {
        // Ignore
      }

      if (historyRef.current.canUndo()) {
        const res = historyRef.current.undo(project);
        if (res) {
          setProject(res.project);
          setBackGuardToast(
            `↩ Tarayıcı Geri Tuşu: "${res.label}" işlemi geri alındı (Siteden çıkış korundu)`
          );
          setTimeout(() => setBackGuardToast(null), 3200);
          return;
        }
      }

      if (tabHistoryRef.current.length > 0) {
        const prevTab = tabHistoryRef.current[tabHistoryRef.current.length - 1];
        tabHistoryRef.current = tabHistoryRef.current.slice(0, -1);
        setActiveTab(prevTab);
        setBackGuardToast(
          '↩ Tarayıcı Geri Tuşu: Önceki çalışma alanına dönüldü (Siteden çıkış korundu)'
        );
        setTimeout(() => setBackGuardToast(null), 3000);
      } else {
        setBackGuardToast(
          '🛡️ Tarayıcı Geri Koruması Aktif: Geri alınacak başka adım yok, siteden çıkış engellendi.'
        );
        setTimeout(() => setBackGuardToast(null), 2800);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [project]);

  const handleUpdateObject = useCallback(
    (objectId: string, updater: (obj: GameObject) => GameObject, commitLabel?: string) => {
      commitProjectUpdate(
        (prev) => ({
          ...prev,
          scenes: prev.scenes.map((sc) =>
            sc.id !== activeScene.id
              ? sc
              : {
                  ...sc,
                  objects: sc.objects.map((o) => (o.id === objectId ? updater(o) : o)),
                }
          ),
        }),
        commitLabel
      );
    },
    [activeScene?.id, commitProjectUpdate]
  );

  const handleUpdateTileMapCells = useCallback(
    (cells: TileMapCell[], commitLabel?: string) => {
      commitProjectUpdate(
        (prev) => ({
          ...prev,
          scenes: prev.scenes.map((sc) =>
            sc.id !== activeScene.id ? sc : { ...sc, tilemapCells: cells }
          ),
        }),
        commitLabel || 'TileMap Güncellendi'
      );
    },
    [activeScene?.id, commitProjectUpdate]
  );

  const handleAddObjectRole = useCallback(
    (role: ObjectRole, x: number, y: number) => {
      const layerId = activeScene.layers[1]?.id || activeScene.layers[0]?.id || 'layer_main';
      const newObj = createDefaultObject(
        role,
        x,
        y,
        layerId,
        activeScene.objects.length + 1
      );
      commitProjectUpdate(
        (prev) => ({
          ...prev,
          scenes: prev.scenes.map((sc) =>
            sc.id !== activeScene.id ? sc : { ...sc, objects: [...sc.objects, newObj] }
          ),
        }),
        `Düğüm Eklendi (${role})`
      );
      setSelectedObjectId(newObj.id);
    },
    [activeScene, commitProjectUpdate]
  );

  const handleDuplicateSelected = useCallback(() => {
    if (!selectedObjectId) return;
    const { scene: nextScene, newObject } = duplicateObjectInScene(
      activeScene,
      selectedObjectId,
      32
    );
    if (!newObject) return;
    commitProjectUpdate(
      (prev) => ({
        ...prev,
        scenes: prev.scenes.map((sc) => (sc.id === activeScene.id ? nextScene : sc)),
      }),
      'Düğüm Çoğaltıldı'
    );
    setSelectedObjectId(newObject.id);
  }, [selectedObjectId, activeScene, commitProjectUpdate]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedObjectId) return;
    commitProjectUpdate(
      (prev) => ({
        ...prev,
        scenes: prev.scenes.map((sc) =>
          sc.id !== activeScene.id
            ? sc
            : {
                ...sc,
                objects: sc.objects.filter((o) => o.id !== selectedObjectId),
              }
        ),
      }),
      'Düğüm Silindi'
    );
    setSelectedObjectId(null);
  }, [selectedObjectId, activeScene?.id, commitProjectUpdate]);

  // Connect Godot Signal directly into visual script blocks
  const handleConnectGodotSignal = (
    signalType:
      | 'event_on_collision'
      | 'event_object_clicked'
      | 'event_game_start'
      | 'event_health_zero'
      | 'event_anim_trigger'
      | 'event_state_changed'
      | 'event_boundary_hit'
  ) => {
    if (!selectedObject) return;
    let defaultParams: Record<string, string | number | boolean> = {};
    if (signalType === 'event_on_collision') {
      defaultParams = { otherRole: 'collectible' };
    } else if (signalType === 'event_anim_trigger') {
      defaultParams = { clipName: selectedObject.activeAnimation || 'attack', triggerPoint: 'on_finish' };
    } else if (signalType === 'event_state_changed') {
      defaultParams = { stateChange: 'landed' };
    } else if (signalType === 'event_boundary_hit') {
      defaultParams = { edge: 'any' };
    }

    const newEventBlock: BlockInstance = {
      id: `blk_sig_${Date.now().toString(36)}`,
      type: signalType,
      targetObjectId:
        signalType === 'event_game_start' ? 'scene' : selectedObject.id,
      params: defaultParams,
      children: [
        {
          id: `blk_sig_act_${Date.now().toString(36)}`,
          type: 'audio_play_sfx',
          targetObjectId: 'scene',
          params: { sound: 'coin' },
        },
      ],
    };

    commitProjectUpdate(
      (prev) => ({
        ...prev,
        scenes: prev.scenes.map((sc) =>
          sc.id !== activeScene.id
            ? sc
            : { ...sc, blocks: [...sc.blocks, newEventBlock] }
        ),
      }),
      `Sinyal Bağlandı (${signalType})`
    );
    setActiveTab('blocks');
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeTab === 'scene' && selectedObjectId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    selectedObjectId,
    handleUndo,
    handleRedo,
    handleDuplicateSelected,
    handleDeleteSelected,
  ]);

  const handleUpdateBlocks = (blocks: BlockInstance[], commitLabel?: string) => {
    commitProjectUpdate(
      (prev) => ({
        ...prev,
        scenes: prev.scenes.map((sc) => (sc.id === activeScene.id ? { ...sc, blocks } : sc)),
      }),
      commitLabel || 'Bloklar Güncellendi'
    );
  };

  const handleUpdateVariables = (variables: GlobalVariable[]) => {
    commitProjectUpdate((prev) => ({ ...prev, variables }), 'Değişkenler Güncellendi');
  };

  const handleUpdateSceneCustomCode = useCallback(
    (customCode: string, syncLocked: boolean) => {
      commitProjectUpdate(
        (prev) => ({
          ...prev,
          scenes: prev.scenes.map((sc) =>
            sc.id === activeScene.id
              ? { ...sc, customScriptCode: customCode, codeSyncLocked: syncLocked }
              : sc
          ),
        }),
        syncLocked ? 'Otomatik Kod Senkronu Açıldı' : 'Özel Sahne Kodu Güncellendi'
      );
    },
    [activeScene?.id, commitProjectUpdate]
  );

  const handleInjectMechanicBundle = (
    bundle: 'platformer_move' | 'topdown_4way' | 'coin_score' | 'enemy_hazard'
  ) => {
    const heroId =
      activeScene.objects.find((o) => o.role === 'player')?.id ||
      activeScene.objects[0]?.id ||
      'scene';
    const stamp = Date.now().toString(36);
    let newBlocks: BlockInstance[] = [];

    if (bundle === 'platformer_move') {
      newBlocks = [
        {
          id: `blk_pm_r_${stamp}`,
          type: 'event_key_held',
          targetObjectId: heroId,
          params: { key: 'ArrowRight' },
          children: [
            {
              id: `blk_pm_ra_${stamp}`,
              type: 'move_horizontal',
              targetObjectId: heroId,
              params: { speed: 240 },
            },
          ],
        },
        {
          id: `blk_pm_l_${stamp}`,
          type: 'event_key_held',
          targetObjectId: heroId,
          params: { key: 'ArrowLeft' },
          children: [
            {
              id: `blk_pm_la_${stamp}`,
              type: 'move_horizontal',
              targetObjectId: heroId,
              params: { speed: -240 },
            },
          ],
        },
        {
          id: `blk_pm_j_${stamp}`,
          type: 'event_key_pressed',
          targetObjectId: heroId,
          params: { key: 'Space' },
          children: [
            {
              id: `blk_pm_ja_${stamp}`,
              type: 'move_jump',
              targetObjectId: heroId,
              params: { force: 480 },
            },
            {
              id: `blk_pm_js_${stamp}`,
              type: 'audio_play_sfx',
              targetObjectId: 'scene',
              params: { sound: 'jump' },
            },
          ],
        },
      ];
    } else if (bundle === 'topdown_4way') {
      newBlocks = [
        {
          id: `blk_td_u_${stamp}`,
          type: 'event_key_held',
          targetObjectId: heroId,
          params: { key: 'ArrowUp' },
          children: [
            {
              id: `blk_td_ua_${stamp}`,
              type: 'move_vertical',
              targetObjectId: heroId,
              params: { speed: -210 },
            },
          ],
        },
        {
          id: `blk_td_d_${stamp}`,
          type: 'event_key_held',
          targetObjectId: heroId,
          params: { key: 'ArrowDown' },
          children: [
            {
              id: `blk_td_da_${stamp}`,
              type: 'move_vertical',
              targetObjectId: heroId,
              params: { speed: 210 },
            },
          ],
        },
      ];
    } else if (bundle === 'coin_score') {
      newBlocks = [
        {
          id: `blk_cs_${stamp}`,
          type: 'event_on_collision',
          targetObjectId: heroId,
          params: { otherRole: 'collectible' },
          children: [
            {
              id: `blk_cs_d_${stamp}`,
              type: 'sense_destroy_other',
              targetObjectId: heroId,
              params: {},
            },
            {
              id: `blk_cs_p_${stamp}`,
              type: 'ui_add_score',
              targetObjectId: 'scene',
              params: { points: 25 },
            },
            {
              id: `blk_cs_s_${stamp}`,
              type: 'audio_play_sfx',
              targetObjectId: 'scene',
              params: { sound: 'coin' },
            },
          ],
        },
      ];
    } else if (bundle === 'enemy_hazard') {
      newBlocks = [
        {
          id: `blk_eh_${stamp}`,
          type: 'event_on_collision',
          targetObjectId: heroId,
          params: { otherRole: 'enemy' },
          children: [
            {
              id: `blk_eh_dmg_${stamp}`,
              type: 'sense_damage_target',
              targetObjectId: heroId,
              params: { amount: -25 },
            },
            {
              id: `blk_eh_sfx_${stamp}`,
              type: 'audio_play_sfx',
              targetObjectId: 'scene',
              params: { sound: 'hit' },
            },
          ],
        },
      ];
    }

    commitProjectUpdate(
      (prev) => ({
        ...prev,
        scenes: prev.scenes.map((sc) =>
          sc.id === activeScene.id
            ? { ...sc, blocks: [...sc.blocks, ...newBlocks] }
            : sc
        ),
      }),
      'Hazır Oyun Mekaniği Paketi Eklendi'
    );
    setActiveTab('blocks');
  };

  const handleAddScene = () => {
    const idx = project.scenes.length + 1;
    const hero = createDefaultObject('player', 128, 300, 'layer_main', 1);
    const ground = createDefaultObject('platform', 64, 420, 'layer_main', 1);
    ground.width = 640;
    ground.collision.width = 640;

    const nextScene: GameScene = {
      id: `scene_${Date.now().toString(36)}`,
      name: `${idx}. Bölüm: Yeni Sahne`,
      backgroundColor: '#0F172A',
      gridSize: 32,
      snapToGrid: true,
      gravityY: 980,
      camera: {
        width: 960,
        height: 540,
        zoom: 1,
        followTargetId: hero.id,
        smoothing: 0.12,
        boundsX: 0,
        boundsY: 0,
        boundsWidth: 1200,
        boundsHeight: 600,
      },
      layers: [
        { id: 'layer_bg', name: 'Arka Plan', visible: true, locked: false, order: 0, parallaxFactor: 0.5 },
        { id: 'layer_main', name: 'Oyun Alanı', visible: true, locked: false, order: 1, parallaxFactor: 1.0 },
        { id: 'layer_fg', name: 'Ön Plan & Arayüz', visible: true, locked: false, order: 2, parallaxFactor: 1.0 },
      ],
      tilemapCells: [],
      objects: [ground, hero],
      blocks: [],
      dialogues: [],
      quests: [],
    };
    commitProjectUpdate(
      (prev) => ({
        ...prev,
        scenes: [...prev.scenes, nextScene],
      }),
      'Yeni Sahne Eklendi'
    );
    setActiveSceneId(nextScene.id);
    setSelectedObjectId(hero.id);
  };

  const handleAddAsset = async (asset: GameAsset, binary?: ArrayBuffer) => {
    if (binary) {
      await saveAssetBinaryToStorage(asset.id, binary);
    }
    commitProjectUpdate(
      (prev) => ({
        ...prev,
        assets: [...prev.assets, asset],
      }),
      `Varlık Eklendi: ${asset.name}`
    );
  };

  const handleDeleteAsset = (assetId: string) => {
    commitProjectUpdate(
      (prev) => ({
        ...prev,
        assets: prev.assets.filter((a) => a.id !== assetId),
      }),
      'Varlık Silindi'
    );
  };

  const handleCleanupUnusedAssets = () => {
    const usedIds = new Set<string>();
    for (const sc of project.scenes) {
      for (const obj of sc.objects) {
        if (obj.spriteAssetId) usedIds.add(obj.spriteAssetId);
      }
    }
    commitProjectUpdate(
      (prev) => ({
        ...prev,
        assets: prev.assets.filter((a) => a.kind === 'audio' || usedIds.has(a.id)),
      }),
      'Kullanılmayan Varlıklar Temizlendi'
    );
  };

  const handleAddDialogue = () => {
    const newDlg: DialogueEntry = {
      id: `dlg_${Date.now().toString(36)}`,
      speaker: 'Rehber Muhafız',
      portraitColor: '#478CBF',
      text: 'Yeni diyalog satırını buradan düzenleyebilirsiniz!',
      choices: [{ id: 'c1', text: 'Devam Et', scoreDelta: 10 }],
    };
    commitProjectUpdate(
      (prev) => ({
        ...prev,
        scenes: prev.scenes.map((sc) =>
          sc.id !== activeScene.id ? sc : { ...sc, dialogues: [...sc.dialogues, newDlg] }
        ),
      }),
      'Diyalog Eklendi'
    );
  };

  const handleAddQuest = () => {
    const newQuest: QuestEntry = {
      id: `q_${Date.now().toString(36)}`,
      title: 'Yeni Bölüm Görevi',
      description: 'Bölümdeki tüm hedefleri tamamla.',
      status: 'active',
      rewardScore: 50,
    };
    commitProjectUpdate(
      (prev) => ({
        ...prev,
        scenes: prev.scenes.map((sc) =>
          sc.id !== activeScene.id ? sc : { ...sc, quests: [...sc.quests, newQuest] }
        ),
      }),
      'Görev Eklendi'
    );
  };

  const diagnosticIssues = runProjectDiagnostics(project);
  const errorCount = diagnosticIssues.filter((i) => i.severity === 'error').length;
  const warningCount = diagnosticIssues.filter((i) => i.severity === 'warning').length;

  const filteredSceneObjects = activeScene.objects.filter((o) =>
    nodeSearchQuery.trim() === ''
      ? true
      : o.name.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
        o.role.toLowerCase().includes(nodeSearchQuery.toLowerCase())
  );

  const getNodeBadgeStyle = (role: ObjectRole) => {
    const cls = getGodotNodeClassForRole(role);
    if (cls === 'CharacterBody2D') return { text: 'CharacterBody2D', color: '#68B6FF' };
    if (cls === 'StaticBody2D') return { text: 'StaticBody2D', color: '#94A3B8' };
    if (cls === 'Area2D') return { text: 'Area2D', color: '#C084FC' };
    if (cls === 'PointLight2D') return { text: 'PointLight2D', color: '#FBBF24' };
    if (cls === 'Control') return { text: 'Control', color: '#8EEF97' };
    return { text: 'RigidBody2D', color: '#F59E0B' };
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#11141A] text-slate-100 overflow-hidden select-none">
      {/* Top Bar Contract: Zone 1 (KareForge Brand & Project) | Zone 2 (2D / Script / AssetLib / Code) | Zone 3 (Play & Export) */}
      <header className="h-12 px-3 bg-[#181C24] border-b border-[#2B3242] flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
        {/* Zone 1: Brand + Project Title + Undo/Redo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#478CBF] flex items-center justify-center font-extrabold text-white shadow-sm border border-[#68B6FF]/40">
              KF
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-extrabold tracking-tight text-white leading-none flex items-center gap-1.5 whitespace-nowrap">
                <span>KareForge 2D</span>
                <span className="px-1.5 py-0.5 rounded bg-[#202531] text-[#68B6FF] text-[10px] font-mono border border-[#2B3242]">
                  Studio v{project.engineVersion}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
                {saveIndicator === 'saving' ? 'Kaydediliyor...' : 'Otomatik Kayıt Aktif'}
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-[#2B3242] shrink-0" />

          <input
            type="text"
            value={project.name}
            onChange={(e) =>
              commitProjectUpdate((prev) => ({ ...prev, name: e.target.value }))
            }
            aria-label="Proje Adı"
            className="bg-[#11141A] border border-[#2B3242] hover:border-slate-600 focus:border-[#478CBF] rounded-lg px-2 py-1 text-xs font-semibold text-slate-100 w-28 xl:w-36 focus:outline-none truncate shrink-0"
          />

          <div className="flex items-center bg-[#11141A] rounded-lg border border-[#2B3242] p-0.5 gap-0.5 shrink-0">
            <button
              onClick={handleUndo}
              disabled={!historyRef.current.canUndo()}
              title={
                historyRef.current.getCounts().lastUndoLabel
                  ? `Geri Al: ${historyRef.current.getCounts().lastUndoLabel} (Ctrl+Z veya Tarayıcı Geri Tuşu)`
                  : 'Geri Al (Ctrl+Z)'
              }
              className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35 disabled:hover:bg-transparent rounded transition-colors whitespace-nowrap shrink-0"
            >
              <Undo2 className="w-3.5 h-3.5 shrink-0" />
              <span>Geri Al</span>
              {historyRef.current.getCounts().undoCount > 0 && (
                <span className="px-1 py-0.2 rounded bg-black/40 text-[10px] font-mono text-[#68B6FF]">
                  {historyRef.current.getCounts().undoCount}
                </span>
              )}
            </button>
            <button
              onClick={handleRedo}
              disabled={!historyRef.current.canRedo()}
              title={
                historyRef.current.getCounts().lastRedoLabel
                  ? `İleri Al: ${historyRef.current.getCounts().lastRedoLabel} (Ctrl+Y)`
                  : 'İleri Al (Ctrl+Y)'
              }
              className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35 disabled:hover:bg-transparent rounded transition-colors whitespace-nowrap shrink-0"
            >
              <Redo2 className="w-3.5 h-3.5 shrink-0" />
              <span>İleri Al</span>
            </button>
          </div>
        </div>

        {/* Zone 2: Central Workspace Mode Switcher */}
        <nav className="flex items-center bg-[#11141A] p-0.5 rounded-xl border border-[#2B3242] shrink-0">
          {[
            { id: 'scene', label: '2D Sahne', icon: Box },
            {
              id: 'blocks',
              label: 'Script (Blok)',
              icon: Cpu,
              badge: activeScene?.blocks.length,
            },
            { id: 'assets', label: 'Piksel & Varlık', icon: ImageIcon },
            { id: 'code', label: 'Motor Kodu', icon: Code2 },
            { id: 'docs', label: 'Rehber', icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchWorkspaceTab(tab.id as EditorWorkspaceTab)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-[#478CBF] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#202531]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && (
                  <span className="ml-0.5 px-1 py-0.2 rounded bg-black/30 text-[10px] font-mono tabular-nums">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Window Dimensions Controller + Templates + Play Test + Export */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setWindowSizeModalOpen((v) => !v)}
            title="Tüm Pencere Uzunluk ve Genişliklerini Özelleştir"
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              windowSizeModalOpen
                ? 'bg-[#478CBF] text-white border-[#68B6FF]'
                : 'bg-[#11141A] hover:bg-[#202531] text-slate-300 border-[#2B3242]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#68B6FF]" />
            <span className="hidden 2xl:inline">Pencere Boyutları</span>
            <span className="hidden xl:inline 2xl:hidden">Boyutlar</span>
          </button>

          <button
            onClick={() => {
              setModalInitialTab('templates');
              setModalOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#11141A] hover:bg-[#202531] text-xs font-medium text-slate-300 border border-[#2B3242] whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#68B6FF]" />
            <span className="hidden lg:inline">Şablonlar</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'preview' ? 'scene' : 'preview')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap ${
              activeTab === 'preview'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{activeTab === 'preview' ? 'Test Kapat (F8)' : 'Oyunu Çalıştır (F5)'}</span>
          </button>

          <button
            onClick={() => {
              setModalInitialTab('export');
              setModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#478CBF] hover:bg-[#3A78A6] text-xs font-bold text-white shadow-sm whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dışa Aktar</span>
          </button>
        </div>
      </header>

      {/* Godot 4 Multi-Scene Tab Bar */}
      <div className="h-8 px-3 bg-[#141820] border-b border-[#2B3242] flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1">
          {project.scenes.map((sc) => {
            const isCurrent = sc.id === activeScene.id;
            return (
              <button
                key={sc.id}
                onClick={() => {
                  setActiveSceneId(sc.id);
                  setSelectedObjectId(sc.objects[0]?.id || null);
                }}
                className={`flex items-center gap-2 px-3 py-1 rounded-t-md text-xs font-semibold border-t border-x transition-colors ${
                  isCurrent
                    ? 'bg-[#181C24] text-[#68B6FF] border-[#478CBF]'
                    : 'bg-[#11141A] text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#68B6FF]" />
                <span>{sc.name}.kf2d</span>
                <span className="text-[10px] font-mono text-slate-500">
                  ({sc.objects.length})
                </span>
              </button>
            );
          })}
          <button
            onClick={handleAddScene}
            title="Yeni Sahne Sekmesi Oluştur (+)"
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#202531]"
          >
            <Plus className="w-3.5 h-3.5 text-[#68B6FF]" />
            <span>+ Yeni Sahne</span>
          </button>
          {backGuardToast && (
            <span className="ml-2 px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold animate-pulse">
              {backGuardToast}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <select
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value as any;
              if (!val) return;
              handleInjectMechanicBundle(val);
              e.target.value = '';
            }}
            className="bg-[#181C24] border border-[#2B3242] hover:border-[#68B6FF] rounded px-2 py-0.5 text-[11px] font-sans font-semibold text-[#8EEF97] focus:outline-none cursor-pointer"
          >
            <option value="">⚡ + Hazır Oyun Mekaniği Paketi Ekle...</option>
            <option value="platformer_move">Platformer: Sağ/Sol Hareket + Zıplama Paketi</option>
            <option value="topdown_4way">RPG Top-Down: 4 Yön Serbest Hareket Paketi</option>
            <option value="coin_score">Ödül Sistemi: Altın Toplama + Skor + Ses</option>
            <option value="enemy_hazard">Savaş Sistemi: Düşman Çarpışma + Can Azaltma</option>
          </select>
          <span>
            Aktif Düğüm:{' '}
            <strong className="text-[#68B6FF]">
              {selectedObject ? selectedObject.name : 'Sahne Kökü (Node2D)'}
            </strong>
          </span>
        </div>
      </div>

      {/* Interactive Window Dimensions Popover Bar */}
      {windowSizeModalOpen && (
        <div className="px-5 py-3 bg-[#1A202C] border-b border-[#478CBF]/50 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xl z-30">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-bold text-[#68B6FF] uppercase tracking-wider flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5" />
              Pencere Uzunluk & Genişlik Kontrolü:
            </span>

            <label className="flex items-center gap-2 bg-[#11141A] px-2.5 py-1 rounded-lg border border-[#2B3242]">
              <span className="text-slate-400">Sol Sahne Ağacı:</span>
              <input
                type="range"
                min={210}
                max={500}
                value={layout.sceneLeftWidth}
                onChange={(e) =>
                  updateLayoutDimensions({ sceneLeftWidth: Number(e.target.value) })
                }
                className="w-20 accent-[#478CBF]"
              />
              <span className="font-mono text-slate-200 w-11">{layout.sceneLeftWidth}px</span>
            </label>

            <label className="flex items-center gap-2 bg-[#11141A] px-2.5 py-1 rounded-lg border border-[#2B3242]">
              <span className="text-slate-400">Sağ Denetçi:</span>
              <input
                type="range"
                min={250}
                max={560}
                value={layout.sceneRightWidth}
                onChange={(e) =>
                  updateLayoutDimensions({ sceneRightWidth: Number(e.target.value) })
                }
                className="w-20 accent-[#478CBF]"
              />
              <span className="font-mono text-slate-200 w-11">{layout.sceneRightWidth}px</span>
            </label>

            <label className="flex items-center gap-2 bg-[#11141A] px-2.5 py-1 rounded-lg border border-[#2B3242]">
              <span className="text-slate-400">Blok Kütüphane:</span>
              <input
                type="range"
                min={220}
                max={520}
                value={layout.blocksPaletteWidth}
                onChange={(e) =>
                  updateLayoutDimensions({ blocksPaletteWidth: Number(e.target.value) })
                }
                className="w-20 accent-[#478CBF]"
              />
              <span className="font-mono text-slate-200 w-11">{layout.blocksPaletteWidth}px</span>
            </label>

            <label className="flex items-center gap-2 bg-[#11141A] px-2.5 py-1 rounded-lg border border-[#2B3242]">
              <span className="text-slate-400">Blok Ölçeği:</span>
              <input
                type="range"
                min={85}
                max={135}
                value={Math.round(layout.blocksScale * 100)}
                onChange={(e) =>
                  updateLayoutDimensions({ blocksScale: Number(e.target.value) / 100 })
                }
                className="w-20 accent-[#478CBF]"
              />
              <span className="font-mono text-slate-200 w-10">
                %{Math.round(layout.blocksScale * 100)}
              </span>
            </label>

            <label className="flex items-center gap-2 bg-[#11141A] px-2.5 py-1 rounded-lg border border-[#2B3242]">
              <span className="text-slate-400">Alt Dock Yüksekliği:</span>
              <input
                type="range"
                min={125}
                max={400}
                value={layout.sceneBottomHeight}
                onChange={(e) => {
                  updateLayoutDimensions({
                    sceneBottomOpen: true,
                    sceneBottomHeight: Number(e.target.value),
                  });
                }}
                className="w-20 accent-[#478CBF]"
              />
              <span className="font-mono text-slate-200 w-11">{layout.sceneBottomHeight}px</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => updateLayoutDimensions(DEFAULT_WORKSPACE_DIMENSIONS)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#202531] hover:bg-slate-700 text-xs text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sıfırla</span>
            </button>
            <button
              onClick={() => setWindowSizeModalOpen(false)}
              className="px-2.5 py-1 rounded bg-[#478CBF] hover:bg-[#3A78A6] text-xs font-semibold text-white"
            >
              Tamam
            </button>
          </div>
        </div>
      )}

      {/* Main Dockable Workspace Body */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {activeTab === 'preview' ? (
            <GamePreviewRuntime
              project={project}
              initialSceneId={activeScene.id}
              onExitPreview={() => setActiveTab('scene')}
              previewScale={layout.previewCanvasScale}
              onUpdatePreviewScale={(scale) =>
                updateLayoutDimensions({ previewCanvasScale: scale })
              }
            />
          ) : activeTab === 'blocks' ? (
            <BlockWorkspace
              project={project}
              scene={activeScene}
              onUpdateBlocks={handleUpdateBlocks}
              onUpdateSceneCustomCode={handleUpdateSceneCustomCode}
              onUpdateVariables={handleUpdateVariables}
              onRunPreview={() => switchWorkspaceTab('preview')}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyRef.current.canUndo()}
              canRedo={historyRef.current.canRedo()}
              paletteWidth={layout.blocksPaletteWidth}
              codePanelWidth={layout.blocksCodeWidth}
              codeSplitRatio={layout.blocksCodeSplitRatio}
              blockScale={layout.blocksScale}
              onUpdateLayoutDimensions={updateLayoutDimensions}
            />
          ) : activeTab === 'assets' ? (
            <AssetAndAtlasPanel
              project={project}
              onAddAsset={handleAddAsset}
              onDeleteAsset={handleDeleteAsset}
              onCleanupUnusedAssets={handleCleanupUnusedAssets}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyRef.current.canUndo()}
              canRedo={historyRef.current.canRedo()}
              onAssignAssetToSelectedObject={(assetId) => {
                if (selectedObjectId) {
                  handleUpdateObject(selectedObjectId, (o) => ({
                    ...o,
                    spriteAssetId: assetId,
                  }), 'Sprite Atandı');
                }
              }}
            />
          ) : activeTab === 'code' || activeTab === 'docs' ? (
            <CodeAndDocsPanel
              mode={activeTab}
              project={project}
              scene={activeScene}
              onUpdateSceneCustomCode={handleUpdateSceneCustomCode}
              onSelectTemplate={(tplId) => {
                const fresh = createProjectFromTemplate(tplId as TemplateType);
                setProject(fresh);
                setActiveSceneId(fresh.scenes[0].id);
                setSelectedObjectId(fresh.scenes[0].objects[0]?.id || null);
                setActiveTab('scene');
              }}
            />
          ) : (
            /* Godot 4 Scene Editor 3-Column Resizable Layout */
            <>
              <aside
                ref={leftPanelRef}
                style={{ width: `${layout.sceneLeftWidth}px` }}
                className="bg-[#181C24] border-r border-[#2B3242] flex flex-col shrink-0 h-full overflow-hidden"
              >
                {/* Upper Left Dock: Godot Scene Node2D Tree */}
                <div
                  style={{ height: `${Math.round(layout.sceneLeftSplitRatio * 100)}%` }}
                  className="flex flex-col min-h-[160px] overflow-hidden"
                >
                  <div className="px-3 py-2 bg-[#151922] border-b border-[#2B3242] flex items-center justify-between shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#68B6FF]">
                      Sahne Ağacı ({activeScene.objects.length} Düğüm)
                    </span>
                    <button
                      onClick={() => handleAddObjectRole('platform', 256, 256)}
                      title="Sahneye Yeni Node2D Ekle"
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#478CBF] hover:bg-[#3A78A6] text-[11px] font-bold text-white"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Düğüm</span>
                    </button>
                  </div>

                  {/* Filter Nodes Input */}
                  <div className="px-2.5 py-1.5 border-b border-[#2B3242] bg-[#181C24] shrink-0">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5" />
                      <input
                        type="text"
                        value={nodeSearchQuery}
                        onChange={(e) => setNodeSearchQuery(e.target.value)}
                        placeholder="Düğüm filtrele (CharacterBody2D...)"
                        className="w-full bg-[#11141A] border border-[#2B3242] rounded pl-7 pr-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#478CBF]"
                      />
                    </div>
                  </div>

                  {/* Root Node2D + Child Nodes */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    <div
                      onClick={() => setSelectedObjectId(null)}
                      className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer ${
                        selectedObjectId === null
                          ? 'bg-[#478CBF]/30 text-white font-bold border border-[#68B6FF]/50'
                          : 'text-slate-300 hover:bg-[#202531]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-[#68B6FF]" />
                        <span className="truncate">{activeScene.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#68B6FF]">Node2D</span>
                    </div>

                    <div className="pl-3 space-y-0.5 border-l border-[#2B3242] ml-2">
                      {filteredSceneObjects.map((obj) => {
                        const isSelected = selectedObjectId === obj.id;
                        const badge = getNodeBadgeStyle(obj.role);
                        return (
                          <div
                            key={obj.id}
                            onClick={() => setSelectedObjectId(obj.id)}
                            className={`group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#478CBF] text-white font-semibold'
                                : 'text-slate-300 hover:bg-[#202531]'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-xs shrink-0 border border-white/25"
                                style={{ backgroundColor: obj.color }}
                              />
                              <span className="truncate">{obj.name}</span>
                              <span
                                style={{
                                  color: isSelected ? '#E0F2FE' : badge.color,
                                }}
                                className="text-[9px] font-mono opacity-85 hidden xl:inline shrink-0"
                              >
                                {badge.text}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-85 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateObject(obj.id, (o) => ({
                                    ...o,
                                    visible: !o.visible,
                                  }));
                                }}
                                className="p-0.5 hover:text-amber-300"
                                title={obj.visible ? 'Gizle' : 'Göster'}
                              >
                                {obj.visible ? (
                                  <Eye className="w-3 h-3" />
                                ) : (
                                  <EyeOff className="w-3 h-3 text-slate-500" />
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateObject(obj.id, (o) => ({
                                    ...o,
                                    locked: !o.locked,
                                  }));
                                }}
                                className="p-0.5 hover:text-amber-300"
                                title={obj.locked ? 'Kilidi Aç' : 'Kilitle'}
                              >
                                {obj.locked ? (
                                  <Lock className="w-3 h-3 text-amber-400" />
                                ) : (
                                  <Unlock className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Vertical Drag Splitter */}
                <div
                  onMouseDown={(e) => {
                    const totalH = leftPanelRef.current?.clientHeight || 600;
                    setActiveSplitter({
                      kind: 'leftVertical',
                      startY: e.clientY,
                      startRatio: layout.sceneLeftSplitRatio,
                      totalH,
                    });
                  }}
                  title="Sahne Ağacı ve Dosya Sistemi Yükseklik Oranını Sürükleyerek Ayarla"
                  className="h-2 bg-[#11141A] hover:bg-[#478CBF] cursor-row-resize flex items-center justify-center border-y border-[#2B3242] shrink-0"
                >
                  <GripHorizontal className="w-4 h-3 text-slate-600" />
                </div>

                {/* Lower Left Dock: Godot FileSystem (res://) & CanvasLayers */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="px-2.5 py-1.5 bg-[#151922] border-b border-[#2B3242] flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setLeftLowerTab('filesystem')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-bold transition-colors ${
                        leftLowerTab === 'filesystem'
                          ? 'bg-[#478CBF] text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FolderTree className="w-3 h-3" />
                      <span>Dosya Sistemi (res://)</span>
                    </button>
                    <button
                      onClick={() => setLeftLowerTab('layers')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-bold transition-colors ${
                        leftLowerTab === 'layers'
                          ? 'bg-[#478CBF] text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>Katmanlar</span>
                    </button>
                  </div>

                  {leftLowerTab === 'filesystem' ? (
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 text-xs font-mono">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        res://scenes/
                      </div>
                      {project.scenes.map((sc) => (
                        <button
                          key={sc.id}
                          onClick={() => {
                            setActiveSceneId(sc.id);
                            setSelectedObjectId(sc.objects[0]?.id || null);
                          }}
                          className={`w-full text-left px-2 py-1 rounded flex items-center justify-between ${
                            sc.id === activeScene.id
                              ? 'bg-[#478CBF]/20 text-[#68B6FF]'
                              : 'text-slate-300 hover:bg-[#202531]'
                          }`}
                        >
                          <span className="truncate">🎬 {sc.name}.kf2d</span>
                        </button>
                      ))}

                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1">
                        res://sprites & audio/ ({project.assets.length})
                      </div>
                      {project.assets.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => switchWorkspaceTab('assets')}
                          className="w-full text-left px-2 py-1 rounded text-slate-300 hover:bg-[#202531] flex items-center justify-between"
                        >
                          <span className="truncate">
                            {asset.kind === 'audio' ? '🔊' : '🖼️'} {asset.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {Math.round(asset.sizeBytes / 1024)}KB
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 p-2.5 overflow-y-auto space-y-1">
                      {activeScene.layers.map((layer) => (
                        <div
                          key={layer.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#11141A] border border-[#2B3242] text-xs"
                        >
                          <span className="text-slate-200 truncate">{layer.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-[#68B6FF]">
                              {layer.parallaxFactor}x
                            </span>
                            <button
                              onClick={() => {
                                commitProjectUpdate((prev) => ({
                                  ...prev,
                                  scenes: prev.scenes.map((sc) =>
                                    sc.id !== activeScene.id
                                      ? sc
                                      : {
                                          ...sc,
                                          layers: sc.layers.map((l) =>
                                            l.id === layer.id ? { ...l, visible: !l.visible } : l
                                          ),
                                        }
                                  ),
                                }));
                              }}
                              className="text-slate-400 hover:text-white"
                            >
                              {layer.visible ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>

              {/* Left Panel Horizontal Resize Splitter */}
              <div
                onMouseDown={(e) =>
                  setActiveSplitter({
                    kind: 'leftWidth',
                    startX: e.clientX,
                    startW: layout.sceneLeftWidth,
                  })
                }
                title="Sol Panel Genişliğini Sürükleyerek Ayarla"
                className="w-2 bg-[#11141A] hover:bg-[#478CBF] active:bg-[#68B6FF] cursor-col-resize flex items-center justify-center transition-colors shrink-0 group"
              >
                <GripVertical className="w-3 h-4 text-slate-600 group-hover:text-white" />
              </div>

              {/* Center Interactive 2D Scene Viewport */}
              <main className="flex-1 h-full min-w-[320px] overflow-hidden">
                <SceneCanvas
                  scene={activeScene}
                  selectedObjectId={selectedObjectId}
                  toolMode={toolMode}
                  showGrid={showGrid}
                  showCollisionBoxes={showCollisionBoxes}
                  onSelectObject={setSelectedObjectId}
                  onUpdateObject={handleUpdateObject}
                  onUpdateTileMapCells={handleUpdateTileMapCells}
                  onAddObjectRole={handleAddObjectRole}
                  onDuplicateSelected={handleDuplicateSelected}
                  onDeleteSelected={handleDeleteSelected}
                  onChangeToolMode={setToolMode}
                  onToggleSnap={() =>
                    commitProjectUpdate((prev) => ({
                      ...prev,
                      scenes: prev.scenes.map((sc) =>
                        sc.id === activeScene.id ? { ...sc, snapToGrid: !sc.snapToGrid } : sc
                      ),
                    }))
                  }
                  onToggleGrid={() => setShowGrid((v) => !v)}
                  onToggleCollisionBoxes={() => setShowCollisionBoxes((v) => !v)}
                  onOpenWindowSizingModal={() => setWindowSizeModalOpen((v) => !v)}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={historyRef.current.canUndo()}
                  canRedo={historyRef.current.canRedo()}
                  onCommitUndoSnapshot={handleRecordUndoSnapshot}
                />
              </main>

              {/* Right Inspector Horizontal Resize Splitter */}
              <div
                onMouseDown={(e) =>
                  setActiveSplitter({
                    kind: 'rightWidth',
                    startX: e.clientX,
                    startW: layout.sceneRightWidth,
                  })
                }
                title="Sağ Denetçi Paneli Genişliğini Sürükleyerek Ayarla"
                className="w-2 bg-[#11141A] hover:bg-[#478CBF] active:bg-[#68B6FF] cursor-col-resize flex items-center justify-center transition-colors shrink-0 group"
              >
                <GripVertical className="w-3 h-4 text-slate-600 group-hover:text-white" />
              </div>

              {/* Right Dock: KareForge Inspector + Node Signals */}
              <aside
                style={{ width: `${layout.sceneRightWidth}px` }}
                className="bg-[#181C24] border-l border-[#2B3242] flex flex-col shrink-0 h-full overflow-y-auto"
              >
                <div className="p-2 bg-[#151922] border-b border-[#2B3242] flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setRightInspectorTab('inspector')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      rightInspectorTab === 'inspector'
                        ? 'bg-[#478CBF] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Denetçi (Inspector)</span>
                  </button>
                  <button
                    onClick={() => setRightInspectorTab('signals')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      rightInspectorTab === 'signals'
                        ? 'bg-[#478CBF] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Sinyaller (Signals)</span>
                  </button>
                </div>

                {rightInspectorTab === 'signals' ? (
                  <div className="p-4 space-y-3">
                    <div className="p-3 rounded-lg bg-[#11141A] border border-[#2B3242] text-xs text-slate-300">
                      KareForge Sinyal Sistemi: Seçili düğümün olaylarını tek tıkla görsel blok koduna bağlayın.
                    </div>
                    {selectedObject ? (
                      <div className="space-y-2">
                        {[
                          {
                            sig: 'body_entered(other: Node2D)',
                            desc: 'Başka bir fizik gövdesi bu düğüme çarptığında tetiklenir.',
                            type: 'event_on_collision' as const,
                          },
                          {
                            sig: 'animation_triggered(clip, phase)',
                            desc: 'Karakter animasyonu (attack, dash, jump, move vb.) başladığında veya bittiğinde tetiklenir.',
                            type: 'event_anim_trigger' as const,
                          },
                          {
                            sig: 'state_changed(landed / turned / double_jumped)',
                            desc: 'Karakter yere indiğinde, sağa/sola döndüğünde veya havada 2. kez zıpladığında tetiklenir.',
                            type: 'event_state_changed' as const,
                          },
                          {
                            sig: 'world_boundary_hit(edge)',
                            desc: 'Karakter görünmez harita sınırına veya görünmez sınır duvarına değdiğinde tetiklenir.',
                            type: 'event_boundary_hit' as const,
                          },
                          {
                            sig: 'gui_input / pressed()',
                            desc: 'Oyuncu bu düğüme fare veya dokunmatikle tıkladığında tetiklenir.',
                            type: 'event_object_clicked' as const,
                          },
                          {
                            sig: '_ready()',
                            desc: 'Sahne ve düğüm ilk yüklendiğinde bir kez çalışır.',
                            type: 'event_game_start' as const,
                          },
                          {
                            sig: 'health_depleted()',
                            desc: 'Düğümün can (HP) değeri sıfıra düştüğünde tetiklenir.',
                            type: 'event_health_zero' as const,
                          },
                        ].map((item) => (
                          <div
                            key={item.sig}
                            className="p-3 rounded-xl bg-[#11141A] border border-[#2B3242] space-y-2"
                          >
                            <div className="font-mono text-xs font-bold text-[#8EEF97]">
                              ⚡ {item.sig}
                            </div>
                            <p className="text-[11px] text-slate-400">{item.desc}</p>
                            <button
                              onClick={() => handleConnectGodotSignal(item.type as any)}
                              className="w-full py-1.5 px-3 rounded-lg bg-[#478CBF] hover:bg-[#3A78A6] text-xs font-bold text-white flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Sinyali Blok Koda Bağla</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 text-center py-6">
                        Sinyallerini görmek için soldan bir düğüm seçin.
                      </div>
                    )}
                  </div>
                ) : selectedObject ? (
                  <div className="p-4 space-y-4">
                    {/* Godot Node Class Header */}
                    <div className="px-3 py-2 rounded-lg bg-[#11141A] border border-[#2B3242] flex items-center justify-between">
                      <span className="text-xs font-bold text-[#68B6FF] font-mono">
                        {getGodotNodeClassForRole(selectedObject.role)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ID: {selectedObject.id.slice(0, 10)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Düğüm Adı (Node Name)
                        </label>
                        <input
                          type="text"
                          value={selectedObject.name}
                          onChange={(e) =>
                            handleUpdateObject(selectedObject.id, (o) => ({
                              ...o,
                              name: e.target.value,
                            }))
                          }
                          className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Düğüm Rolü
                          </label>
                          <select
                            value={selectedObject.role}
                            onChange={(e) =>
                              handleUpdateObject(selectedObject.id, (o) => ({
                                ...o,
                                role: e.target.value as ObjectRole,
                              }))
                            }
                            className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          >
                            <option value="player">Kahraman (CharacterBody2D)</option>
                            <option value="platform">Platform (StaticBody2D)</option>
                            <option value="moving_platform">Hareketli Platform (StaticBody2D)</option>
                            <option value="invisible_wall">Görünmez Sınır Duvarı (StaticBody2D)</option>
                            <option value="checkpoint">Kayıt Noktası (Area2D)</option>
                            <option value="collectible">Ödül (Area2D)</option>
                            <option value="powerup">Can İksiri (Area2D)</option>
                            <option value="enemy">Düşman AI (CharacterBody2D)</option>
                            <option value="bounce_pad">Trambolin Yay (Area2D)</option>
                            <option value="hazard">Diken Tuzak (Area2D)</option>
                            <option value="light_source">Meşale Işık (PointLight2D)</option>
                            <option value="npc">NPC Rehber (Area2D)</option>
                            <option value="goal">Bitiş Bayrağı (Area2D)</option>
                            <option value="crate">Fizik Sandık (RigidBody2D)</option>
                            <option value="ui_button">UI Buton (Control)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Modulate Renk
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={selectedObject.color}
                              onChange={(e) =>
                                handleUpdateObject(selectedObject.id, (o) => ({
                                  ...o,
                                  color: e.target.value,
                                }))
                              }
                              className="w-8 h-8 rounded bg-transparent border border-[#2B3242] cursor-pointer"
                            />
                            <span className="text-xs font-mono text-slate-300">
                              {selectedObject.color}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Character Visual Class & Directional Facing Flip (FlipH) */}
                    {(selectedObject.role === 'player' ||
                      selectedObject.role === 'enemy' ||
                      selectedObject.role === 'npc') && (
                      <div className="pt-3 border-t border-[#2B3242] space-y-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#68B6FF]">
                          Karakter Sınıfı &amp; Yön Dönüşü (FlipH)
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Görsel Karakter Sınıfı
                            </label>
                            <select
                              value={selectedObject.shapePreset || 'hero'}
                              onChange={(e) =>
                                handleUpdateObject(selectedObject.id, (o) => ({
                                  ...o,
                                  shapePreset: e.target.value as GameObject['shapePreset'],
                                }))
                              }
                              className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2 py-1 text-xs text-slate-100"
                            >
                              <option value="hero">Uzay Kaşifi (Hero)</option>
                              <option value="knight">Zırhlı Şövalye (Knight)</option>
                              <option value="mage">Kristal Büyücü (Mage)</option>
                              <option value="ninja">Gölge Ninja (Ninja)</option>
                              <option value="robot">Meka Robot (Robot)</option>
                              <option value="slime">Slime Canavarı</option>
                              <option value="npc">Bilge Rehber NPC</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Sağa/Sola Yön Dönüşü
                            </label>
                            <select
                              value={selectedObject.physics.flipMode || 'horizontal'}
                              onChange={(e) =>
                                handleUpdateObject(selectedObject.id, (o) => ({
                                  ...o,
                                  physics: {
                                    ...o.physics,
                                    flipMode: e.target.value as 'horizontal' | 'rotate' | 'none',
                                  },
                                }))
                              }
                              className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2 py-1 text-xs text-emerald-300 font-semibold"
                            >
                              <option value="horizontal">Yatay Aynala (FlipH)</option>
                              <option value="rotate">180° Döndür</option>
                              <option value="none">Sabit Yön (Dönmesin)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Başlangıç Bakış Yönü
                            </label>
                            <select
                              value={String(selectedObject.physics.initialFacing ?? 1)}
                              onChange={(e) =>
                                handleUpdateObject(selectedObject.id, (o) => ({
                                  ...o,
                                  physics: {
                                    ...o.physics,
                                    initialFacing: Number(e.target.value) === -1 ? -1 : 1,
                                  },
                                }))
                              }
                              className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2 py-1 text-xs text-slate-200"
                            >
                              <option value="1">Sağa Baksın (SAĞ ▶)</option>
                              <option value="-1">Sola Baksın (◀ SOL)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Aktif Animasyon Klibi
                            </label>
                            <select
                              value={selectedObject.activeAnimation || 'idle'}
                              onChange={(e) =>
                                handleUpdateObject(selectedObject.id, (o) => ({
                                  ...o,
                                  activeAnimation: e.target.value,
                                }))
                              }
                              className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2 py-1 text-xs text-[#68B6FF] font-mono"
                            >
                              {selectedObject.animations.map((a) => (
                                <option key={a.id} value={a.name}>
                                  🎞️ {a.name} ({a.fps} FPS)
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Jump Modes (Single Grounded / Multi-Jump / Infinite Jump / Wall Jump) */}
                    {(selectedObject.role === 'player' || selectedObject.role === 'enemy') && (
                      <div className="pt-3 border-t border-[#2B3242] space-y-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                          Zıplama Kuralları &amp; Hava Mekaniği
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Zıplama Modu (Jump Mode)
                          </label>
                          <select
                            value={selectedObject.physics.jumpMode || 'multi_jump'}
                            onChange={(e) => {
                              const nextMode = e.target.value as
                                | 'grounded_only'
                                | 'multi_jump'
                                | 'infinite';
                              handleUpdateObject(selectedObject.id, (o) => ({
                                ...o,
                                physics: {
                                  ...o.physics,
                                  jumpMode: nextMode,
                                  maxJumps:
                                    nextMode === 'grounded_only'
                                      ? 1
                                      : nextMode === 'infinite'
                                      ? 999
                                      : Math.max(2, o.physics.maxJumps ?? 2),
                                },
                              }));
                            }}
                            className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-300"
                          >
                            <option value="grounded_only">
                              ⚓ Tek Zıplama (Yere İnmeden Zıplayamaz)
                            </option>
                            <option value="multi_jump">
                              🦘 Çoklu Zıplama (Havada 2x / 3x Zıplama)
                            </option>
                            <option value="infinite">
                              🚀 Sınırsız Zıplama (Havada Sonsuz Zıplama)
                            </option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Maks. Zıplama Sayısı
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              disabled={selectedObject.physics.jumpMode !== 'multi_jump'}
                              value={
                                selectedObject.physics.jumpMode === 'grounded_only'
                                  ? 1
                                  : selectedObject.physics.maxJumps ?? 2
                              }
                              onChange={(e) =>
                                handleUpdateObject(selectedObject.id, (o) => ({
                                  ...o,
                                  physics: {
                                    ...o.physics,
                                    maxJumps: Math.max(1, Number(e.target.value)),
                                  },
                                }))
                              }
                              className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2 py-1 text-xs font-mono text-slate-200 disabled:opacity-50"
                            />
                          </div>

                          <div className="flex items-end">
                            <label className="flex items-center gap-1.5 bg-[#11141A] px-2.5 py-1.5 rounded border border-[#2B3242] cursor-pointer w-full text-xs">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedObject.physics.wallJumpEnabled)}
                                onChange={(e) =>
                                  handleUpdateObject(selectedObject.id, (o) => ({
                                    ...o,
                                    physics: {
                                      ...o.physics,
                                      wallJumpEnabled: e.target.checked,
                                    },
                                  }))
                                }
                                className="accent-[#478CBF]"
                              />
                              <span className="text-[11px] text-slate-200">Duvar Zıplaması</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Invisible Boundary Wall or One-Way Platform Settings */}
                    {(selectedObject.role === 'invisible_wall' ||
                      selectedObject.role === 'platform' ||
                      selectedObject.role === 'moving_platform') && (
                      <div className="pt-3 border-t border-[#2B3242] space-y-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                          {selectedObject.role === 'invisible_wall'
                            ? 'Görünmez Sınır Duvarı & Etkilenecek Karakterler'
                            : 'Platform Geçiş Kuralları'}
                        </div>
                        {selectedObject.role === 'invisible_wall' && (
                          <>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">
                                Sınıra Değdiğinde Ne Olsun?
                              </label>
                              <select
                                value={selectedObject.collision.boundaryAction || 'solid'}
                                onChange={(e) =>
                                  handleUpdateObject(
                                    selectedObject.id,
                                    (o) => ({
                                      ...o,
                                      collision: {
                                        ...o.collision,
                                        boundaryAction: e.target.value as any,
                                      },
                                    }),
                                    'Görünmez Duvar Davranışı Değiştirildi'
                                  )
                                }
                                className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-cyan-300"
                              >
                                <option value="solid">Katı Duvar (Geçişi Engelle)</option>
                                <option value="bounce">Trambolin Gibi Geri Sektir (Bounce)</option>
                                <option value="wrap">Haritanın Karşı Kenarından Çıkar (Wrap)</option>
                                <option value="respawn_damage">Başlangıca Döndür + Hasar Ver</option>
                                <option value="gameover">Anında Oyunu Bitir (Game Over)</option>
                                <option value="victory">Bölümü Kazandır (Victory)</option>
                              </select>
                            </div>

                            {/* Which Characters Does This Invisible Wall Affect? */}
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">
                                Hangi Karakter / Karakterleri Etkilesin?
                              </label>
                              <select
                                value={selectedObject.collision.wallTargetFilter || 'all'}
                                onChange={(e) => {
                                  const nextFilter = e.target.value as any;
                                  handleUpdateObject(
                                    selectedObject.id,
                                    (o) => ({
                                      ...o,
                                      collision: {
                                        ...o.collision,
                                        wallTargetFilter: nextFilter,
                                        wallTargetIds:
                                          nextFilter === 'custom' &&
                                          (!o.collision.wallTargetIds ||
                                            o.collision.wallTargetIds.length === 0)
                                            ? activeScene.objects
                                                .filter((cand) =>
                                                  ['player', 'enemy', 'npc', 'crate'].includes(
                                                    cand.role
                                                  )
                                                )
                                                .map((cand) => cand.id)
                                            : o.collision.wallTargetIds || [],
                                      },
                                    }),
                                    'Görünmez Duvar Karakter Filtresi Değiştirildi'
                                  );
                                }}
                                className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-300"
                              >
                                <option value="all">Tüm Hareketli Karakterler (Kahraman + Düşman + NPC)</option>
                                <option value="player_only">Sadece Kahraman (Oyuncu / Player)</option>
                                <option value="enemies_only">Sadece Düşmanlar (Enemy — Düşman Sınırı)</option>
                                <option value="npcs_only">Sadece NPC Karakterler</option>
                                <option value="custom">Özel Seçili Karakterler (Aşağıdan Seçin)</option>
                              </select>
                            </div>

                            {/* Per-Character Checkboxes so user can pick exact character instances */}
                            <div className="p-2.5 rounded-lg bg-[#11141A] border border-[#2B3242] space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span className="font-semibold text-slate-300">
                                  Sahnedeki Karakterler (Özel Seçim):
                                </span>
                                <span>
                                  {selectedObject.collision.wallTargetFilter === 'custom'
                                    ? `${(selectedObject.collision.wallTargetIds || []).length} seçili`
                                    : 'Tıklayarak özel seçime geçin'}
                                </span>
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {activeScene.objects
                                  .filter((cand) =>
                                    ['player', 'enemy', 'npc', 'crate'].includes(cand.role)
                                  )
                                  .map((cand) => {
                                    const currentFilter =
                                      selectedObject.collision.wallTargetFilter || 'all';
                                    const currentIds =
                                      selectedObject.collision.wallTargetIds || [];
                                    const isChecked =
                                      currentFilter === 'all'
                                        ? true
                                        : currentFilter === 'player_only'
                                        ? cand.role === 'player'
                                        : currentFilter === 'enemies_only'
                                        ? cand.role === 'enemy'
                                        : currentFilter === 'npcs_only'
                                        ? cand.role === 'npc'
                                        : currentIds.includes(cand.id);
                                    return (
                                      <label
                                        key={cand.id}
                                        className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#181C24] hover:bg-[#202634] cursor-pointer text-xs"
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              handleUpdateObject(
                                                selectedObject.id,
                                                (o) => {
                                                  const allChars = activeScene.objects
                                                    .filter((c) =>
                                                      ['player', 'enemy', 'npc', 'crate'].includes(
                                                        c.role
                                                      )
                                                    )
                                                    .map((c) => c.id);
                                                  const baseList =
                                                    (o.collision.wallTargetFilter || 'all') ===
                                                    'custom'
                                                      ? o.collision.wallTargetIds || []
                                                      : allChars.filter((id) => {
                                                          const objRef = activeScene.objects.find(
                                                            (x) => x.id === id
                                                          );
                                                          if (!objRef) return false;
                                                          const f =
                                                            o.collision.wallTargetFilter || 'all';
                                                          if (f === 'player_only')
                                                            return objRef.role === 'player';
                                                          if (f === 'enemies_only')
                                                            return objRef.role === 'enemy';
                                                          if (f === 'npcs_only')
                                                            return objRef.role === 'npc';
                                                          return true;
                                                        });
                                                  const nextIds = checked
                                                    ? Array.from(new Set([...baseList, cand.id]))
                                                    : baseList.filter((id) => id !== cand.id);
                                                  return {
                                                    ...o,
                                                    collision: {
                                                      ...o.collision,
                                                      wallTargetFilter: 'custom',
                                                      wallTargetIds: nextIds,
                                                    },
                                                  };
                                                },
                                                `Görünmez Duvar Karakter Seçimi (${cand.name})`
                                              );
                                            }}
                                            className="accent-cyan-400"
                                          />
                                          <span className="text-slate-200 font-medium truncate">
                                            {cand.name}
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-cyan-400 uppercase shrink-0">
                                          {cand.role}
                                        </span>
                                      </label>
                                    );
                                  })}
                              </div>
                            </div>
                          </>
                        )}

                        <label className="flex items-center gap-2 bg-[#11141A] p-2 rounded border border-[#2B3242] cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedObject.collision.oneWayPlatform)}
                            onChange={(e) =>
                              handleUpdateObject(
                                selectedObject.id,
                                (o) => ({
                                  ...o,
                                  collision: {
                                    ...o.collision,
                                    oneWayPlatform: e.target.checked,
                                  },
                                }),
                                'Tek Yönlü Platform Değiştirildi'
                              )
                            }
                            className="accent-[#478CBF]"
                          />
                          <span>Tek Yönlü Platform (Alttan Zıplayarak Geçilebilir)</span>
                        </label>
                      </div>
                    )}

                    {/* Transform Coordinates */}
                    <div className="pt-3 border-t border-[#2B3242]">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#68B6FF] mb-2">
                        Node2D &gt; Transform
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'x', label: 'Position X (px)' },
                          { key: 'y', label: 'Position Y (px)' },
                          { key: 'width', label: 'Size W (px)' },
                          { key: 'height', label: 'Size H (px)' },
                          { key: 'rotation', label: 'Rotation (°)' },
                          { key: 'zIndex', label: 'Z-Index' },
                        ].map((field) => (
                          <div key={field.key}>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              {field.label}
                            </label>
                            <input
                              type="number"
                              value={Number((selectedObject as any)[field.key])}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                handleUpdateObject(selectedObject.id, (o) => ({
                                  ...o,
                                  [field.key]: val,
                                  collision:
                                    field.key === 'width' || field.key === 'height'
                                      ? {
                                          ...o.collision,
                                          [field.key]: Math.max(8, val),
                                        }
                                      : o.collision,
                                }));
                              }}
                              className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-slate-100"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PointLight2D & Dynamic Glow Settings */}
                    <div className="pt-3 border-t border-[#2B3242] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                          <Sun className="w-3.5 h-3.5" />
                          PointLight2D (Dinamik Işık)
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              selectedObject.role === 'light_source' ||
                              Boolean(selectedObject.vfx?.lightEnabled)
                            }
                            onChange={(e) =>
                              handleUpdateObject(selectedObject.id, (o) => ({
                                ...o,
                                vfx: {
                                  lightEnabled: e.target.checked,
                                  lightColor: o.vfx?.lightColor || '#FBBF24',
                                  lightRadius: o.vfx?.lightRadius || 150,
                                  lightIntensity: o.vfx?.lightIntensity || 0.65,
                                  particlePreset: o.vfx?.particlePreset || 'none',
                                },
                              }))
                            }
                            className="accent-amber-400"
                          />
                          <span>Işık Aktif</span>
                        </label>
                      </div>

                      {(selectedObject.role === 'light_source' ||
                        selectedObject.vfx?.lightEnabled) && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Işık Yarıçapı (px)
                            </label>
                            <input
                              type="number"
                              min={32}
                              max={420}
                              value={selectedObject.vfx?.lightRadius || 150}
                              onChange={(e) =>
                                handleUpdateObject(selectedObject.id, (o) => ({
                                  ...o,
                                  vfx: {
                                    lightEnabled: true,
                                    lightColor: o.vfx?.lightColor || '#FBBF24',
                                    lightRadius: Number(e.target.value),
                                    lightIntensity: o.vfx?.lightIntensity || 0.65,
                                    particlePreset: o.vfx?.particlePreset || 'none',
                                  },
                                }))
                              }
                              className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2 py-1 text-xs font-mono text-slate-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Işık Rengi
                            </label>
                            <input
                              type="color"
                              value={selectedObject.vfx?.lightColor || '#FBBF24'}
                              onChange={(e) =>
                                handleUpdateObject(selectedObject.id, (o) => ({
                                  ...o,
                                  vfx: {
                                    lightEnabled: true,
                                    lightColor: e.target.value,
                                    lightRadius: o.vfx?.lightRadius || 150,
                                    lightIntensity: o.vfx?.lightIntensity || 0.65,
                                    particlePreset: o.vfx?.particlePreset || 'none',
                                  },
                                }))
                              }
                              className="w-full h-7 rounded bg-transparent border border-[#2B3242] cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2D Physics & Collider Settings */}
                    <div className="pt-3 border-t border-[#2B3242] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          PhysicsBody2D &amp; CollisionShape2D
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedObject.physics.enabled}
                            onChange={(e) =>
                              handleUpdateObject(selectedObject.id, (o) => ({
                                ...o,
                                physics: { ...o.physics, enabled: e.target.checked },
                              }))
                            }
                            className="accent-[#478CBF]"
                          />
                          <span>Fizik Aktif</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="flex items-center gap-1.5 bg-[#11141A] p-2 rounded border border-[#2B3242] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedObject.collision.isStatic}
                            onChange={(e) =>
                              handleUpdateObject(selectedObject.id, (o) => ({
                                ...o,
                                collision: { ...o.collision, isStatic: e.target.checked },
                              }))
                            }
                            className="accent-[#478CBF]"
                          />
                          <span>StaticBody2D</span>
                        </label>

                        <label className="flex items-center gap-1.5 bg-[#11141A] p-2 rounded border border-[#2B3242] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedObject.collision.isTrigger}
                            onChange={(e) =>
                              handleUpdateObject(selectedObject.id, (o) => ({
                                ...o,
                                collision: { ...o.collision, isTrigger: e.target.checked },
                              }))
                            }
                            className="accent-[#478CBF]"
                          />
                          <span>Area2D Sensör</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Gravity Scale
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedObject.physics.gravityScale}
                            onChange={(e) =>
                              handleUpdateObject(selectedObject.id, (o) => ({
                                ...o,
                                physics: {
                                  ...o.physics,
                                  gravityScale: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2 py-1 text-xs font-mono text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Can (HP)
                          </label>
                          <input
                            type="number"
                            value={selectedObject.hp}
                            onChange={(e) =>
                              handleUpdateObject(selectedObject.id, (o) => ({
                                ...o,
                                hp: Number(e.target.value),
                              }))
                            }
                            className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2 py-1 text-xs font-mono text-slate-200"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#2B3242]">
                      <button
                        onClick={() => setActiveTab('blocks')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#478CBF]/20 hover:bg-[#478CBF]/30 border border-[#478CBF]/40 text-xs font-semibold text-[#68B6FF] transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Düğümün Blok Kodlarını Düzenle</span>
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    <div className="p-3 rounded-xl bg-[#11141A] border border-[#2B3242] text-xs text-slate-400">
                      Şu anda <strong className="text-slate-200">{activeScene.name}.tscn</strong> kök Node2D ve <strong>Görünmez Harita Sınırları (World Bounds)</strong> ayarlarını görüntülüyorsunuz.
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Sahne Adı (.tscn)
                      </label>
                      <input
                        type="text"
                        value={activeScene.name}
                        onChange={(e) =>
                          commitProjectUpdate((prev) => ({
                            ...prev,
                            scenes: prev.scenes.map((sc) =>
                              sc.id === activeScene.id ? { ...sc, name: e.target.value } : sc
                            ),
                          }))
                        }
                        className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          Dünya Genişliği (px)
                        </label>
                        <input
                          type="number"
                          value={activeScene.camera.boundsWidth}
                          onChange={(e) =>
                            commitProjectUpdate((prev) => ({
                              ...prev,
                              scenes: prev.scenes.map((sc) =>
                                sc.id === activeScene.id
                                  ? {
                                      ...sc,
                                      camera: {
                                        ...sc.camera,
                                        boundsWidth: Math.max(480, Number(e.target.value)),
                                      },
                                    }
                                  : sc
                              ),
                            }))
                          }
                          className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          Yerçekimi Y (px/s²)
                        </label>
                        <input
                          type="number"
                          value={activeScene.gravityY}
                          onChange={(e) =>
                            commitProjectUpdate((prev) => ({
                              ...prev,
                              scenes: prev.scenes.map((sc) =>
                                sc.id === activeScene.id
                                  ? { ...sc, gravityY: Number(e.target.value) }
                                  : sc
                              ),
                            }))
                          }
                          className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                        />
                      </div>
                    </div>

                    {/* Unity / Godot Style Invisible World Boundaries Configuration */}
                    <div className="pt-3 border-t border-[#2B3242] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                          Görünmez Harita Sınırları (World Bounds)
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeScene.worldBounds?.enabled ?? true}
                            onChange={(e) =>
                              commitProjectUpdate((prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        worldBounds: {
                                          ...(sc.worldBounds || {
                                            enabled: true,
                                            showGizmoInEditor: true,
                                            leftAction: 'solid',
                                            rightAction: 'solid',
                                            topAction: 'solid',
                                            bottomAction: 'respawn_damage',
                                            bottomDamage: 25,
                                            bouncePower: 520,
                                          }),
                                          enabled: e.target.checked,
                                        },
                                      }
                                ),
                              }))
                            }
                            className="accent-cyan-400"
                          />
                          <span>Sınırlar Aktif</span>
                        </label>
                      </div>

                      {(
                        [
                          { key: 'bottomAction', label: '⬇ Alt Sınır (Uçurum / Çukur)' },
                          { key: 'leftAction', label: '⬅ Sol Harita Sınırı' },
                          { key: 'rightAction', label: '➡ Sağ Harita Sınırı' },
                          { key: 'topAction', label: '⬆ Üst Tavan Sınırı' },
                        ] as const
                      ).map((edgeItem) => (
                        <div key={edgeItem.key}>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            {edgeItem.label}
                          </label>
                          <select
                            value={
                              (activeScene.worldBounds as any)?.[edgeItem.key] ||
                              (edgeItem.key === 'bottomAction' ? 'respawn_damage' : 'solid')
                            }
                            onChange={(e) =>
                              commitProjectUpdate((prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        worldBounds: {
                                          ...(sc.worldBounds || {
                                            enabled: true,
                                            showGizmoInEditor: true,
                                            leftAction: 'solid',
                                            rightAction: 'solid',
                                            topAction: 'solid',
                                            bottomAction: 'respawn_damage',
                                            bottomDamage: 25,
                                            bouncePower: 520,
                                          }),
                                          [edgeItem.key]: e.target.value,
                                        },
                                      }
                                ),
                              }))
                            }
                            className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2 py-1.5 text-xs text-slate-100"
                          >
                            <option value="solid">Katı Duvar (Geçişi Engelle)</option>
                            <option value="respawn_damage">Başlangıca / Kayıt Noktasına Döndür + Hasar Ver</option>
                            <option value="bounce">Trambolin Gibi Geri Sektir (Bounce)</option>
                            <option value="wrap">Karşı Kenardan Çıkar (Pac-Man / Wrap)</option>
                            <option value="gameover">Anında Oyunu Bitir (Game Over)</option>
                            <option value="victory">Bölümü Kazandır (Victory)</option>
                          </select>
                        </div>
                      ))}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Alt Sınır Hasarı (HP)
                          </label>
                          <input
                            type="number"
                            value={activeScene.worldBounds?.bottomDamage ?? 25}
                            onChange={(e) =>
                              commitProjectUpdate((prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        worldBounds: {
                                          ...(sc.worldBounds || {
                                            enabled: true,
                                            showGizmoInEditor: true,
                                            leftAction: 'solid',
                                            rightAction: 'solid',
                                            topAction: 'solid',
                                            bottomAction: 'respawn_damage',
                                            bottomDamage: 25,
                                            bouncePower: 520,
                                          }),
                                          bottomDamage: Math.max(0, Number(e.target.value)),
                                        },
                                      }
                                ),
                              }))
                            }
                            className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2 py-1 text-xs font-mono text-rose-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Sekme Gücü (Bounce)
                          </label>
                          <input
                            type="number"
                            value={activeScene.worldBounds?.bouncePower ?? 520}
                            onChange={(e) =>
                              commitProjectUpdate((prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        worldBounds: {
                                          ...(sc.worldBounds || {
                                            enabled: true,
                                            showGizmoInEditor: true,
                                            leftAction: 'solid',
                                            rightAction: 'solid',
                                            topAction: 'solid',
                                            bottomAction: 'respawn_damage',
                                            bottomDamage: 25,
                                            bouncePower: 520,
                                          }),
                                          bouncePower: Math.max(100, Number(e.target.value)),
                                        },
                                      }
                                ),
                              }))
                            }
                            className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2 py-1 text-xs font-mono text-sky-300"
                          />
                        </div>
                      </div>

                      {/* Which Characters Do World Bounds Affect? */}
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          Harita Sınırları Hangi Karakterleri Etkilesin?
                        </label>
                        <select
                          value={activeScene.worldBounds?.targetFilter || 'all'}
                          onChange={(e) =>
                            commitProjectUpdate(
                              (prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        worldBounds: {
                                          ...(sc.worldBounds || {
                                            enabled: true,
                                            showGizmoInEditor: true,
                                            leftAction: 'solid',
                                            rightAction: 'solid',
                                            topAction: 'solid',
                                            bottomAction: 'respawn_damage',
                                            bottomDamage: 25,
                                            bouncePower: 520,
                                          }),
                                          targetFilter: e.target.value as any,
                                        },
                                      }
                                ),
                              }),
                              'Harita Sınırı Karakter Filtresi Değiştirildi'
                            )
                          }
                          className="w-full bg-[#11141A] border border-[#2B3242] rounded-lg px-2 py-1.5 text-xs font-semibold text-amber-300"
                        >
                          <option value="all">Tüm Hareketli Karakterler (Kahraman + Düşman + NPC)</option>
                          <option value="player_only">Sadece Kahraman (Oyuncu / Player)</option>
                          <option value="enemies_only">Sadece Düşmanlar (Enemy)</option>
                          <option value="npcs_only">Sadece NPC Karakterler</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            </>
          )}
        </div>

        {/* Godot 4 Multi-Tab Resizable Bottom Dock (Shown in 2D Scene mode so Script/Assets/Code get 100% height) */}
        {layout.sceneBottomOpen && activeTab === 'scene' && (
          <>
            <div
              onMouseDown={(e) =>
                setActiveSplitter({
                  kind: 'bottomHeight',
                  startY: e.clientY,
                  startH: layout.sceneBottomHeight,
                })
              }
              title="Alt Godot Dock Yüksekliğini Sürükleyerek Ayarla"
              className="h-2 bg-[#11141A] hover:bg-[#478CBF] active:bg-[#68B6FF] cursor-row-resize flex items-center justify-center border-t border-[#2B3242] shrink-0 group"
            >
              <GripHorizontal className="w-4 h-3 text-slate-600 group-hover:text-white" />
            </div>

            <div
              style={{ height: `${layout.sceneBottomHeight}px` }}
              className="bg-[#151922] border-t border-[#2B3242] flex flex-col shrink-0 overflow-hidden"
            >
              {/* Bottom Dock Tab Switcher */}
              <div className="px-3 py-1.5 bg-[#181C24] border-b border-[#2B3242] flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-1">
                  {[
                    { id: 'diagnostics', label: 'Çıktı & Doğrulama', icon: CheckCircle2 },
                    { id: 'animation', label: 'AnimationPlayer & Tetikleyiciler', icon: Film },
                    {
                      id: 'dialogue_quest',
                      label: `Diyalog & Görev (${activeScene.dialogues.length + activeScene.quests.length})`,
                      icon: MessageSquare,
                    },
                    { id: 'sfx_lab', label: 'SFX Synth Laboratuvarı', icon: Volume2 },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = bottomDockTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setBottomDockTab(tab.id as BottomDockTab)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#478CBF] text-white'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#202531]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => updateLayoutDimensions({ sceneBottomOpen: false })}
                  className="text-slate-400 hover:text-white text-xs px-2"
                >
                  Gizle
                </button>
              </div>

              {/* Bottom Dock Content */}
              <div className="flex-1 overflow-y-auto p-3">
                {bottomDockTab === 'diagnostics' && (
                  <div className="space-y-1.5">
                    {diagnosticIssues.length === 0 ? (
                      <div className="text-xs text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          [KareForge Doğrulayıcı] Tüm sahneler (.kf2d), düğüm sinyalleri, görünmez sınırlar ve fizik kuralları hatasız doğrulandı.
                        </span>
                      </div>
                    ) : (
                      diagnosticIssues.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-3 py-1.5 rounded bg-[#11141A] border border-[#2B3242] text-xs"
                        >
                          <span
                            className={
                              item.severity === 'error'
                                ? 'text-rose-400 font-semibold'
                                : 'text-amber-300'
                            }
                          >
                            [{item.severity.toUpperCase()}] {item.title}: {item.message}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {activeScene.name}.kf2d
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {bottomDockTab === 'animation' && (
                  <div className="space-y-2.5">
                    {selectedObject ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-[#68B6FF]">
                              Karakter: {selectedObject.name}
                            </span>
                            {selectedObject.animations.map((clip) => {
                              const isCurrentClip =
                                (selectedObject.activeAnimation || 'idle') === clip.name;
                              return (
                                <div
                                  key={clip.id}
                                  className={`px-2.5 py-1 rounded-lg border flex items-center gap-2 text-xs transition-colors ${
                                    isCurrentClip
                                      ? 'bg-[#478CBF]/25 border-[#68B6FF] text-white'
                                      : 'bg-[#11141A] border-[#2B3242] text-slate-300'
                                  }`}
                                >
                                  <button
                                    onClick={() =>
                                      handleUpdateObject(selectedObject.id, (o) => ({
                                        ...o,
                                        activeAnimation: clip.name,
                                      }))
                                    }
                                    className="font-mono font-bold hover:text-[#68B6FF]"
                                    title="Bu animasyonu karakter üzerinde önizle"
                                  >
                                    🎞️ {clip.name}
                                  </button>
                                  <span className="text-slate-400 font-mono text-[11px]">
                                    {clip.fps} FPS
                                  </span>
                                  <button
                                    onClick={() => {
                                      const newEventBlock: BlockInstance = {
                                        id: `blk_anim_trig_${Date.now().toString(36)}`,
                                        type: 'event_anim_trigger',
                                        targetObjectId: selectedObject.id,
                                        params: {
                                          clip: clip.name,
                                          triggerPhase: 'on_start',
                                        },
                                        children: [
                                          {
                                            id: `blk_anim_sfx_${Date.now().toString(36)}`,
                                            type: 'audio_play_sfx',
                                            targetObjectId: 'scene',
                                            params: { sound: 'jump' },
                                          },
                                        ],
                                      };
                                      handleUpdateBlocks(
                                        [...activeScene.blocks, newEventBlock],
                                        `Animasyon Tetikleyici Eklendi: ${clip.name}`
                                      );
                                      switchWorkspaceTab('blocks');
                                    }}
                                    className="px-2 py-0.5 rounded bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white text-[10px] font-bold border border-pink-500/40 transition-colors"
                                    title="Bu animasyon başladığında/bittiğinde çalışacak görsel blok kuralı oluştur"
                                  >
                                    ⚡ Tetikleyici Kodla
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            onClick={() => {
                              const customIdx = selectedObject.animations.length + 1;
                              const clipName = `ozel_anim_${customIdx}`;
                              handleUpdateObject(
                                selectedObject.id,
                                (o) => ({
                                  ...o,
                                  activeAnimation: clipName,
                                  animations: [
                                    ...o.animations,
                                    {
                                      id: `anim_${Date.now().toString(36)}`,
                                      name: clipName,
                                      fps: 10,
                                      loop: true,
                                      frames: [
                                        {
                                          id: `f1_${Date.now()}`,
                                          label: `${clipName}_1`,
                                          color: o.color,
                                          durationMs: 100,
                                          poseOffsetY: -4,
                                          poseScaleX: 1.12,
                                          poseScaleY: 0.9,
                                          poseRotation: -6,
                                        },
                                        {
                                          id: `f2_${Date.now()}`,
                                          label: `${clipName}_2`,
                                          color: o.secondaryColor || '#38BDF8',
                                          durationMs: 100,
                                          poseOffsetY: 0,
                                          poseScaleX: 0.95,
                                          poseScaleY: 1.08,
                                          poseRotation: 6,
                                        },
                                      ],
                                    },
                                  ],
                                }),
                                'Yeni Karakter Animasyonu Eklendi'
                              );
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#478CBF] hover:bg-[#3A78A6] text-white text-xs font-bold flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Yeni Animasyon Ekle</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400">
                        Karakter animasyonlarını düzenlemek ve tetikleyicilerini bloklarla kodlamak için sahneden bir düğüm seçin.
                      </div>
                    )}
                  </div>
                )}

                {bottomDockTab === 'dialogue_quest' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Dialogues Editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#68B6FF]">
                          NPC Diyalog Ağacı ({activeScene.dialogues.length})
                        </span>
                        <button
                          onClick={handleAddDialogue}
                          className="px-2 py-0.5 rounded bg-[#478CBF] text-white text-[11px] font-semibold"
                        >
                          + Diyalog Ekle
                        </button>
                      </div>
                      {activeScene.dialogues.map((dlg) => (
                        <div
                          key={dlg.id}
                          className="p-2 rounded bg-[#11141A] border border-[#2B3242] flex items-center justify-between gap-2 text-xs"
                        >
                          <input
                            type="text"
                            value={dlg.speaker}
                            onChange={(e) =>
                              commitProjectUpdate((prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        dialogues: sc.dialogues.map((d) =>
                                          d.id === dlg.id ? { ...d, speaker: e.target.value } : d
                                        ),
                                      }
                                ),
                              }))
                            }
                            className="w-28 bg-[#181C24] border border-[#2B3242] rounded px-2 py-1 text-xs font-bold text-[#68B6FF]"
                          />
                          <input
                            type="text"
                            value={dlg.text}
                            onChange={(e) =>
                              commitProjectUpdate((prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        dialogues: sc.dialogues.map((d) =>
                                          d.id === dlg.id ? { ...d, text: e.target.value } : d
                                        ),
                                      }
                                ),
                              }))
                            }
                            className="flex-1 bg-[#181C24] border border-[#2B3242] rounded px-2 py-1 text-xs text-slate-200"
                          />
                          <button
                            onClick={() =>
                              commitProjectUpdate((prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        dialogues: sc.dialogues.filter((d) => d.id !== dlg.id),
                                      }
                                ),
                              }))
                            }
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Quests Editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#8EEF97]">
                          Bölüm Görevleri ({activeScene.quests.length})
                        </span>
                        <button
                          onClick={handleAddQuest}
                          className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-semibold"
                        >
                          + Görev Ekle
                        </button>
                      </div>
                      {activeScene.quests.map((q) => (
                        <div
                          key={q.id}
                          className="p-2 rounded bg-[#11141A] border border-[#2B3242] flex items-center justify-between gap-2 text-xs"
                        >
                          <input
                            type="text"
                            value={q.title}
                            onChange={(e) =>
                              commitProjectUpdate((prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        quests: sc.quests.map((item) =>
                                          item.id === q.id
                                            ? { ...item, title: e.target.value }
                                            : item
                                        ),
                                      }
                                ),
                              }))
                            }
                            className="flex-1 bg-[#181C24] border border-[#2B3242] rounded px-2 py-1 text-xs text-slate-200"
                          />
                          <span className="font-mono text-amber-400">+{q.rewardScore}P</span>
                          <button
                            onClick={() =>
                              commitProjectUpdate((prev) => ({
                                ...prev,
                                scenes: prev.scenes.map((sc) =>
                                  sc.id !== activeScene.id
                                    ? sc
                                    : {
                                        ...sc,
                                        quests: sc.quests.filter((item) => item.id !== q.id),
                                      }
                                ),
                              }))
                            }
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bottomDockTab === 'sfx_lab' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400 mr-2">
                      WebAudio Sentezleyici Ön Ayarları (Canlı Dinle):
                    </span>
                    {(
                      ['jump', 'coin', 'hit', 'victory', 'gameover', 'click', 'laser', 'quest'] as const
                    ).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => audioSystem.playPreset(preset)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#11141A] hover:bg-[#478CBF] text-xs font-mono text-slate-200 border border-[#2B3242] transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-[#68B6FF]" />
                        <span>{preset}.wav</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Diagnostics & Engine Status Bar */}
      <footer className="h-7 px-4 bg-[#0D1016] border-t border-[#2B3242] flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          {errorCount > 0 ? (
            <button
              onClick={() =>
                updateLayoutDimensions({ sceneBottomOpen: !layout.sceneBottomOpen })
              }
              className="flex items-center gap-1 text-rose-400 font-medium hover:underline"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{errorCount} Hata Bulundu</span>
            </button>
          ) : (
            <button
              onClick={() =>
                updateLayoutDimensions({ sceneBottomOpen: !layout.sceneBottomOpen })
              }
              className="flex items-center gap-1 text-emerald-400 hover:underline"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>KareForge 2D Çekirdek: Hazır ({warningCount} Uyarı)</span>
            </button>
          )}

          <span>·</span>
          <button
            onClick={() =>
              updateLayoutDimensions({ sceneBottomOpen: !layout.sceneBottomOpen })
            }
            className="flex items-center gap-1 text-slate-300 hover:text-[#68B6FF]"
          >
            {layout.sceneBottomOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
            <span>Alt Panel ({layout.sceneBottomHeight}px)</span>
          </button>

          <span>·</span>
          <span>
            Sahne: <strong className="text-slate-200">{activeScene.name}.kf2d</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span>{storageQuotaText}</span>
          <span>·</span>
          <span>KareForge 2D v{project.engineVersion}</span>
        </div>
      </footer>

      {/* Project Templates & 3-Format Export Modal */}
      <ProjectAndExportModal
        isOpen={modalOpen}
        initialTab={modalInitialTab}
        project={project}
        storageQuotaText={storageQuotaText}
        onClose={() => setModalOpen(false)}
        onCreateFromTemplate={(tplId, name) => {
          const nextProj = createProjectFromTemplate(tplId, name);
          setProject(nextProj);
          setActiveSceneId(nextProj.scenes[0].id);
          setSelectedObjectId(nextProj.scenes[0].objects[0]?.id || null);
          historyRef.current.clear();
          setActiveTab('scene');
        }}
        onImportProject={(imported) => {
          setProject(imported);
          setActiveSceneId(imported.scenes[0].id);
          setSelectedObjectId(imported.scenes[0].objects[0]?.id || null);
          historyRef.current.clear();
          setActiveTab('scene');
        }}
      />
    </div>
  );
}

export default App;
