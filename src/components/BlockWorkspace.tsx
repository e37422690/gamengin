import React, { useState, useRef, useEffect } from 'react';
import {
  BlockCategory,
  BlockDefinition,
  BlockInstance,
  BlockParamDef,
  BlockType,
  GameProject,
  GameScene,
  GlobalVariable,
} from '../types/engine';
import {
  BLOCK_CATALOG,
  BLOCK_CATEGORY_META,
  getBlockDefinition,
  generateReadableCode,
  validateSceneBlocks,
} from '../engine/blockSystem';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Code2,
  AlertTriangle,
  CheckCircle2,
  Search,
  Database,
  Play,
  Copy,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  GripVertical,
  GripHorizontal,
  Layers,
  Lock,
  Unlock,
  X,
  LayoutGrid,
  Rows3,
  RefreshCw,
  Sparkles,
  Check,
  Undo2,
  Redo2,
} from 'lucide-react';

interface BlockWorkspaceProps {
  project: GameProject;
  scene: GameScene;
  onUpdateBlocks: (blocks: BlockInstance[], commitLabel?: string) => void;
  onUpdateSceneCustomCode?: (customCode: string, syncLocked: boolean) => void;
  onUpdateVariables: (vars: GlobalVariable[]) => void;
  onRunPreview: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  paletteWidth: number;
  codePanelWidth: number;
  codeSplitRatio: number;
  blockScale: number;
  onUpdateLayoutDimensions: (
    partial: Partial<{
      blocksPaletteWidth: number;
      blocksCodeWidth: number;
      blocksCodeSplitRatio: number;
      blocksScale: number;
    }>
  ) => void;
}

const QUICK_EVENT_TYPES: { type: BlockType; label: string; color: string }[] = [
  { type: 'event_game_start', label: '+ Oyun Başladığında', color: '#F59E0B' },
  { type: 'event_key_held', label: '+ Tuş Basılı Tutulduğunda', color: '#F59E0B' },
  { type: 'event_key_pressed', label: '+ Tuşa Basıldığında', color: '#F59E0B' },
  { type: 'event_on_collision', label: '+ Çarpışma Olduğunda', color: '#10B981' },
  { type: 'event_boundary_hit', label: '+ Harita Sınırına Değdiğinde', color: '#38BDF8' },
  { type: 'event_anim_trigger', label: '+ Animasyon Tetiklendiğinde', color: '#EC4899' },
  { type: 'event_state_changed', label: '+ Karakter Durumu (İniş/Dönüş/2x Zıplama)', color: '#A855F7' },
  { type: 'event_object_clicked', label: '+ Nesneye Tıklandığında', color: '#38BDF8' },
  { type: 'event_timer_interval', label: '+ Süreli Zamanlayıcı', color: '#A855F7' },
];

const QUICK_ACTION_TYPES: { type: BlockType; label: string }[] = [
  { type: 'move_horizontal', label: 'Yatay Hareket (Otomatik Yön Dönüşlü)' },
  { type: 'move_set_facing', label: 'Karakter Yönünü & Dönüş Modunu Ayarla' },
  { type: 'move_jump', label: 'Zıplat (Moda Göre Tek/Çoklu/Sınırsız)' },
  { type: 'physics_set_jump_mode', label: 'Zıplama Modunu Değiştir (Tek / 2x / Sınırsız)' },
  { type: 'world_set_boundary_action', label: 'Görünmez Harita Sınırı Davranışı Ayarla' },
  { type: 'world_set_wall_filter', label: 'Görünmez Duvarın Etkilediği Karakterleri Seç' },
  { type: 'anim_play', label: 'Karakter Animasyonu Oynat (Idle/Move/Jump/Attack)' },
  { type: 'anim_set_character_skin', label: 'Karakter Görsel Sınıfını Değiştir (Şövalye/Ninja/Büyücü)' },
  { type: 'act_shoot_projectile', label: 'Lazer Ateşle (Mermi)' },
  { type: 'move_dash', label: 'Dash Yap (Atılma)' },
  { type: 'ui_add_score', label: 'Puan Ekle (+Skor)' },
  { type: 'audio_play_sfx', label: 'Ses Efekti Çal (SFX)' },
  { type: 'ui_show_message', label: 'Ekranda Mesaj Göster' },
  { type: 'sense_destroy_other', label: 'Çarpışan Nesneyi Yok Et' },
  { type: 'sense_damage_target', label: 'Can (HP) Değiştir' },
  { type: 'camera_shake', label: 'Kamera Sarsıntısı' },
  { type: 'ui_start_dialogue', label: 'NPC Diyaloğu Başlat' },
  { type: 'scene_victory', label: 'Bölümü Kazan (Zafer)' },
  { type: 'scene_gameover', label: 'Oyunu Bitir (Game Over)' },
];

export const BlockWorkspace: React.FC<BlockWorkspaceProps> = ({
  project,
  scene,
  onUpdateBlocks,
  onUpdateSceneCustomCode,
  onUpdateVariables,
  onRunPreview,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  paletteWidth,
  codePanelWidth,
  codeSplitRatio,
  blockScale,
  onUpdateLayoutDimensions,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<BlockCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    scene.blocks[0]?.id || null
  );
  const [selectedNestedParentId, setSelectedNestedParentId] = useState<string | null>(null);
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState<'number' | 'string' | 'boolean'>('number');
  const [newVarValue, setNewVarValue] = useState('0');

  // Spacious layout controls: Default to 'top_wide' (100% Full-Width 3-4 Column Catalog!) so addable blocks are never narrow!
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullCatalogMode, setIsFullCatalogMode] = useState(false);
  const [catalogDockMode, setCatalogDockMode] = useState<'top_wide' | 'left_wide'>('top_wide');
  const [topCatalogHeight, setTopCatalogHeight] = useState<number>(360);
  const [showPalettePanel, setShowPalettePanel] = useState(true);
  const [showRightCodePanel, setShowRightCodePanel] = useState(false);
  const [boardColumns, setBoardColumns] = useState<1 | 2>(2);
  const [lastAddedToast, setLastAddedToast] = useState<string | null>(null);

  // Code Sync Lock vs Manual Editable Mode ("Üretilen oyun kodu salt okunur senkron kapatılamıyor" çözümü)
  const [isCodeSyncLocked, setIsCodeSyncLocked] = useState<boolean>(
    scene.codeSyncLocked !== undefined ? scene.codeSyncLocked : true
  );
  const generatedLiveCode = generateReadableCode(scene);
  const [editableCodeText, setEditableCodeText] = useState<string>(
    scene.customScriptCode || generatedLiveCode
  );
  const [codeAppliedBanner, setCodeAppliedBanner] = useState<string | null>(null);

  // Keep editableCodeText synced when auto-sync is locked
  useEffect(() => {
    if (isCodeSyncLocked) {
      setEditableCodeText(generatedLiveCode);
    }
  }, [generatedLiveCode, isCodeSyncLocked]);

  const rightColumnRef = useRef<HTMLDivElement>(null);
  const [dragSplitter, setDragSplitter] = useState<
    | null
    | { kind: 'palette'; startX: number; startW: number }
    | { kind: 'topCatalogHeight'; startY: number; startH: number }
    | { kind: 'codeWidth'; startX: number; startW: number }
    | { kind: 'codeVertical'; startY: number; startRatio: number; totalH: number }
  >(null);

  useEffect(() => {
    if (!dragSplitter) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (dragSplitter.kind === 'palette') {
        const nextW = Math.min(
          1040,
          Math.max(540, dragSplitter.startW + (e.clientX - dragSplitter.startX))
        );
        onUpdateLayoutDimensions({ blocksPaletteWidth: nextW });
      } else if (dragSplitter.kind === 'topCatalogHeight') {
        const nextH = Math.min(
          640,
          Math.max(220, dragSplitter.startH + (e.clientY - dragSplitter.startY))
        );
        setTopCatalogHeight(nextH);
      } else if (dragSplitter.kind === 'codeWidth') {
        const nextW = Math.min(
          720,
          Math.max(280, dragSplitter.startW - (e.clientX - dragSplitter.startX))
        );
        onUpdateLayoutDimensions({ blocksCodeWidth: nextW });
      } else if (dragSplitter.kind === 'codeVertical') {
        const dy = e.clientY - dragSplitter.startY;
        const deltaRatio = dy / Math.max(200, dragSplitter.totalH);
        const nextRatio = Math.min(
          0.85,
          Math.max(0.2, Number((dragSplitter.startRatio + deltaRatio).toFixed(2)))
        );
        onUpdateLayoutDimensions({ blocksCodeSplitRatio: nextRatio });
      }
    };
    const handleMouseUp = () => setDragSplitter(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragSplitter, onUpdateLayoutDimensions]);

  const diagnostics = validateSceneBlocks(scene);

  const filteredCatalog = BLOCK_CATALOG.filter((def) => {
    const matchesCategory = selectedCategory === 'all' || def.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      def.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      def.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const buildBlockInstance = (def: BlockDefinition): BlockInstance => {
    const defaultParams: Record<string, string | number | boolean> = {};
    for (const p of def.params) {
      defaultParams[p.name] = p.defaultValue;
    }
    const defaultTarget =
      def.type.startsWith('move_') ||
      def.type.startsWith('physics_') ||
      def.type.startsWith('anim_') ||
      def.type === 'event_key_held' ||
      def.type === 'event_key_pressed' ||
      def.type === 'event_on_collision' ||
      def.type === 'event_boundary_hit' ||
      def.type === 'event_anim_trigger' ||
      def.type === 'event_state_changed' ||
      def.type === 'sense_damage_target'
        ? scene.objects.find((o) => o.role === 'player')?.id || 'scene'
        : 'scene';

    return {
      id: `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      type: def.type,
      targetObjectId: defaultTarget,
      params: defaultParams,
      children: def.isHat || def.isContainer ? [] : undefined,
    };
  };

  const handleAddBlockFromCatalog = (def: BlockDefinition, explicitEventId?: string) => {
    const instance = buildBlockInstance(def);

    if (def.isHat) {
      const next = [...scene.blocks, instance];
      onUpdateBlocks(next, `Olay Eklendi: ${def.label}`);
      setSelectedEventId(instance.id);
      setSelectedNestedParentId(null);
      setLastAddedToast(`Yeni Olay Eklendi: "${def.label}"`);
      setTimeout(() => setLastAddedToast(null), 2200);
      return;
    }

    const targetEventId = explicitEventId || selectedEventId || scene.blocks[0]?.id;
    if (!targetEventId) {
      const startDef = getBlockDefinition('event_game_start')!;
      const startBlock = buildBlockInstance(startDef);
      startBlock.children = [instance];
      onUpdateBlocks([startBlock], `Olay + Aksiyon Eklendi: ${def.label}`);
      setSelectedEventId(startBlock.id);
      setLastAddedToast(`"${def.label}" eklendi`);
      setTimeout(() => setLastAddedToast(null), 2200);
      return;
    }

    const next = scene.blocks.map((ev) => {
      if (ev.id !== targetEventId) return ev;
      const children = ev.children || [];
      if (selectedNestedParentId && !explicitEventId) {
        return {
          ...ev,
          children: children.map((ch) =>
            ch.id === selectedNestedParentId
              ? { ...ch, children: [...(ch.children || []), instance] }
              : ch
          ),
        };
      }
      return {
        ...ev,
        children: [...children, instance],
      };
    });
    onUpdateBlocks(next, `Blok Eklendi: ${def.label}`);
    const evIdx = scene.blocks.findIndex((e) => e.id === targetEventId);
    setLastAddedToast(`"${def.label}" → Olay #${evIdx >= 0 ? evIdx + 1 : 1} içine eklendi!`);
    setTimeout(() => setLastAddedToast(null), 2200);
  };

  const handleToggleCodeSyncLock = () => {
    const nextLocked = !isCodeSyncLocked;
    setIsCodeSyncLocked(nextLocked);
    if (nextLocked) {
      setEditableCodeText(generatedLiveCode);
    }
    if (onUpdateSceneCustomCode) {
      onUpdateSceneCustomCode(nextLocked ? generatedLiveCode : editableCodeText, nextLocked);
    }
  };

  const handleApplyEditedCodeToScene = () => {
    if (onUpdateSceneCustomCode) {
      onUpdateSceneCustomCode(editableCodeText, false);
    }
    // Also parse common numeric tweaks (e.g. addScore(50) or jump(520)) back into blocks if found
    const jumpMatch = editableCodeText.match(/\.jump\((\d+)\)/);
    const scoreMatch = editableCodeText.match(/\.addScore\((-?\d+)\)/);
    if (jumpMatch || scoreMatch) {
      const nextBlocks = scene.blocks.map((ev) => ({
        ...ev,
        children: (ev.children || []).map((ch) => {
          if (ch.type === 'move_jump' && jumpMatch) {
            return { ...ch, params: { ...ch.params, force: Number(jumpMatch[1]) } };
          }
          if (ch.type === 'ui_add_score' && scoreMatch) {
            return { ...ch, params: { ...ch.params, points: Number(scoreMatch[1]) } };
          }
          return ch;
        }),
      }));
      onUpdateBlocks(nextBlocks, 'Özel Koddan Blok Parametreleri Güncellendi');
    }
    setCodeAppliedBanner('Özel oyun kodu sahneye kaydedildi ve çalışma zamanına bağlandı!');
    setTimeout(() => setCodeAppliedBanner(null), 2600);
  };

  const handleUpdateBlockTarget = (
    eventId: string,
    blockId: string | null,
    targetObjectId: string
  ) => {
    const next = scene.blocks.map((ev) => {
      if (ev.id !== eventId) return ev;
      if (blockId === null) {
        return { ...ev, targetObjectId };
      }
      return {
        ...ev,
        children: (ev.children || []).map((ch) =>
          ch.id === blockId ? { ...ch, targetObjectId } : ch
        ),
      };
    });
    onUpdateBlocks(next);
  };

  const handleUpdateBlockParam = (
    eventId: string,
    blockId: string | null,
    key: string,
    value: string | number | boolean,
    nestedParentId?: string | null
  ) => {
    const next = scene.blocks.map((ev) => {
      if (ev.id !== eventId) return ev;
      if (blockId === null) {
        return { ...ev, params: { ...ev.params, [key]: value } };
      }
      return {
        ...ev,
        children: (ev.children || []).map((ch) => {
          if (nestedParentId && ch.id === nestedParentId) {
            return {
              ...ch,
              children: (ch.children || []).map((sub) =>
                sub.id === blockId ? { ...sub, params: { ...sub.params, [key]: value } } : sub
              ),
            };
          }
          return ch.id === blockId ? { ...ch, params: { ...ch.params, [key]: value } } : ch;
        }),
      };
    });
    onUpdateBlocks(next);
  };

  const handleMoveActionBlock = (eventId: string, index: number, dir: -1 | 1) => {
    const next = scene.blocks.map((ev) => {
      if (ev.id !== eventId) return ev;
      const arr = [...(ev.children || [])];
      const targetIndex = index + dir;
      if (targetIndex < 0 || targetIndex >= arr.length) return ev;
      const [item] = arr.splice(index, 1);
      arr.splice(targetIndex, 0, item);
      return { ...ev, children: arr };
    });
    onUpdateBlocks(next, 'Blok Sırası Değiştirildi');
  };

  const handleDuplicateBlock = (eventId: string, blockId: string | null) => {
    if (blockId === null) {
      const target = scene.blocks.find((e) => e.id === eventId);
      if (!target) return;
      const clone: BlockInstance = {
        ...JSON.parse(JSON.stringify(target)),
        id: `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      };
      onUpdateBlocks([...scene.blocks, clone], 'Olay Bloğu Çoğaltıldı');
      return;
    }

    const next = scene.blocks.map((ev) => {
      if (ev.id !== eventId) return ev;
      const children = ev.children || [];
      const idx = children.findIndex((c) => c.id === blockId);
      if (idx === -1) return ev;
      const clone: BlockInstance = {
        ...JSON.parse(JSON.stringify(children[idx])),
        id: `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      };
      const nextChildren = [...children];
      nextChildren.splice(idx + 1, 0, clone);
      return { ...ev, children: nextChildren };
    });
    onUpdateBlocks(next, 'Aksiyon Bloğu Çoğaltıldı');
  };

  const handleDeleteBlock = (eventId: string, blockId: string | null, nestedParentId?: string) => {
    if (blockId === null) {
      const next = scene.blocks.filter((ev) => ev.id !== eventId);
      onUpdateBlocks(next, 'Olay Bloğu Silindi');
      if (selectedEventId === eventId) {
        setSelectedEventId(next[0]?.id || null);
      }
      return;
    }
    const next = scene.blocks.map((ev) => {
      if (ev.id !== eventId) return ev;
      const children = ev.children || [];
      if (nestedParentId) {
        return {
          ...ev,
          children: children.map((ch) =>
            ch.id === nestedParentId
              ? { ...ch, children: (ch.children || []).filter((sub) => sub.id !== blockId) }
              : ch
          ),
        };
      }
      return { ...ev, children: children.filter((ch) => ch.id !== blockId) };
    });
    onUpdateBlocks(next, 'Aksiyon Bloğu Silindi');
  };

  const renderParamInput = (
    eventId: string,
    blockId: string | null,
    paramDef: BlockParamDef,
    currentValue: string | number | boolean,
    nestedParentId?: string | null
  ) => {
    if (paramDef.options && paramDef.options.length > 0) {
      return (
        <select
          value={String(currentValue ?? paramDef.defaultValue)}
          onChange={(e) =>
            handleUpdateBlockParam(eventId, blockId, paramDef.name, e.target.value, nestedParentId)
          }
          className="bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1 text-xs text-slate-100 font-medium focus:outline-none focus:border-[#478CBF]"
        >
          {paramDef.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (paramDef.type === 'sceneId') {
      return (
        <select
          value={String(currentValue ?? 'next')}
          onChange={(e) =>
            handleUpdateBlockParam(eventId, blockId, paramDef.name, e.target.value, nestedParentId)
          }
          className="bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1 text-xs text-amber-300 font-medium focus:outline-none focus:border-[#478CBF]"
        >
          <option value="next">Sonraki Sahne (Otomatik)</option>
          {project.scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      );
    }

    if (paramDef.type === 'number') {
      return (
        <input
          type="number"
          value={Number(currentValue ?? paramDef.defaultValue)}
          onChange={(e) =>
            handleUpdateBlockParam(
              eventId,
              blockId,
              paramDef.name,
              Number(e.target.value),
              nestedParentId
            )
          }
          className="w-24 bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-emerald-300 focus:outline-none focus:border-[#478CBF]"
        />
      );
    }

    const valStr = String(currentValue ?? paramDef.defaultValue ?? '');
    const isLongText = valStr.length > 20 || paramDef.name === 'text' || paramDef.name === 'reason';

    return (
      <input
        type="text"
        value={valStr}
        onChange={(e) =>
          handleUpdateBlockParam(eventId, blockId, paramDef.name, e.target.value, nestedParentId)
        }
        className={`${
          isLongText ? 'min-w-[200px] flex-1' : 'min-w-[130px]'
        } bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-[#478CBF]`}
      />
    );
  };

  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newVarName.trim();
    if (!cleanName) return;
    const parsedVal =
      newVarType === 'number'
        ? Number(newVarValue) || 0
        : newVarType === 'boolean'
        ? newVarValue === 'true'
        : newVarValue;

    const nextVar: GlobalVariable = {
      id: `var_${Date.now()}`,
      name: cleanName,
      type: newVarType,
      initialValue: parsedVal,
      scope: 'global',
    };
    onUpdateVariables([...project.variables, nextVar]);
    setNewVarName('');
    setNewVarValue('0');
  };

  const categoryEntries = Object.entries(BLOCK_CATEGORY_META) as [
    BlockCategory,
    (typeof BLOCK_CATEGORY_META)[BlockCategory]
  ][];

  return (
    <div className="flex flex-col h-full w-full bg-[#11141A] text-slate-100 overflow-hidden select-none">
      {/* Top Ergonomic Workspace Control Bar */}
      <div className="h-11 px-4 bg-[#181C24] border-b border-[#2B3242] flex items-center justify-between gap-3 shrink-0 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#68B6FF] flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            Görsel Blok &amp; Kod Stüdyosu
          </span>
          <div className="h-4 w-px bg-[#2B3242] mx-1" />

          {/* Direct Undo / Redo Buttons inside Block Studio */}
          {onUndo && (
            <div className="flex items-center gap-1 bg-[#11141A] p-0.5 rounded-md border border-[#2B3242]">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title="Blok İşlemini Geri Al (Ctrl+Z)"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Geri Al</span>
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title="Blok İşlemini İleri Al (Ctrl+Y)"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span>İleri Al</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setIsFocusMode(false);
              setShowPalettePanel((v) => !v);
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
              showPalettePanel && !isFocusMode
                ? 'bg-[#478CBF]/25 border-[#68B6FF]/50 text-[#68B6FF]'
                : 'bg-[#11141A] border-[#2B3242] text-slate-400 hover:text-slate-200'
            }`}
          >
            {showPalettePanel && !isFocusMode
              ? '✓ Eklenebilir Blok Kütüphanesi (Açık)'
              : '+ Eklenebilir Blok Kütüphanesini Göster'}
          </button>

          <button
            onClick={() => {
              setIsFocusMode(false);
              setShowPalettePanel(true);
              setIsFullCatalogMode((v) => !v);
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors ${
              isFullCatalogMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-[#11141A] border-[#478CBF]/60 text-[#68B6FF] hover:bg-[#478CBF]/20'
            }`}
          >
            {isFullCatalogMode ? '✓ Tam Ekran Katalog (Kapat)' : '⤢ Tam Ekran Geniş Blok Kütüphanesi'}
          </button>

          <button
            onClick={() => {
              setIsFocusMode(false);
              setShowRightCodePanel((v) => !v);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
              showRightCodePanel && !isFocusMode
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[#11141A] border-[#2B3242] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>
              {showRightCodePanel && !isFocusMode
                ? 'Canlı Kod Panelini Gizle'
                : 'Canlı Kod & Değişkenler Aç'}
            </span>
          </button>

          <button
            onClick={() => setIsFocusMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border transition-colors ${
              isFocusMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-[#11141A] border-[#2B3242] text-slate-200 hover:border-[#68B6FF]'
            }`}
          >
            {isFocusMode ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span>{isFocusMode ? 'Tam Ekrandan Çık' : '%100 Tam Ekran Blok Alanı'}</span>
          </button>
        </div>

        {/* Right Controls: 1-Col / 2-Col Board Toggle + Zoom + Test */}
        <div className="flex items-center gap-2.5">
          {/* 1-Column vs 2-Column Board Switcher */}
          <div className="flex items-center bg-[#11141A] p-0.5 rounded-md border border-[#2B3242]">
            <button
              onClick={() => setBoardColumns(1)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                boardColumns === 1
                  ? 'bg-[#478CBF] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Geniş Tek Sütun Görünümü"
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span>Tek Sütun</span>
            </button>
            <button
              onClick={() => setBoardColumns(2)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                boardColumns === 2
                  ? 'bg-[#478CBF] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Yan Yana 2 Sütunlu Geniş Pano Görünümü"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>2 Sütun Pano</span>
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#11141A] px-2 py-1 rounded-md border border-[#2B3242]">
            <span className="text-[11px] text-slate-400 mr-1">Ölçek:</span>
            <button
              onClick={() =>
                onUpdateLayoutDimensions({
                  blocksScale: Math.max(0.85, Number((blockScale - 0.1).toFixed(2))),
                })
              }
              className="p-0.5 text-slate-400 hover:text-white"
              title="Blokları Küçült"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            {[0.95, 1.0, 1.15].map((preset) => (
              <button
                key={preset}
                onClick={() => onUpdateLayoutDimensions({ blocksScale: preset })}
                className={`px-1.5 py-0.5 rounded text-xs font-mono tabular-nums transition-colors ${
                  Math.abs(blockScale - preset) < 0.04
                    ? 'bg-[#478CBF] text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                %{Math.round(preset * 100)}
              </button>
            ))}
            <button
              onClick={() =>
                onUpdateLayoutDimensions({
                  blocksScale: Math.min(1.35, Number((blockScale + 0.1).toFixed(2))),
                })
              }
              className="p-0.5 text-slate-400 hover:text-white"
              title="Blokları Büyüt"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onRunPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Mantığı Test Et</span>
          </button>
        </div>
      </div>

      {/* Main Resizable Body */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Left/Center Combined Area (supports 100% Full-Width Top Catalog OR Wide Left Split Catalog) */}
        <div
          className={`flex-1 flex ${
            catalogDockMode === 'top_wide' && !isFullCatalogMode ? 'flex-col' : 'flex-row'
          } min-h-0 min-w-0 overflow-hidden`}
        >
          {/* 1. Ultra-Wide Addable Block Catalog (100% Full-Width Top 3-4 Columns by default, or Wide Left, or 100% Full Screen) */}
          {showPalettePanel && !isFocusMode && (
            <>
              <div
                style={
                  isFullCatalogMode
                    ? { width: '100%', height: '100%' }
                    : catalogDockMode === 'top_wide'
                    ? { width: '100%', height: `${topCatalogHeight}px` }
                    : { width: `${Math.max(580, paletteWidth)}px`, height: '100%' }
                }
                className={`${
                  catalogDockMode === 'top_wide' && !isFullCatalogMode
                    ? 'border-b border-[#2B3242]'
                    : 'border-r border-[#2B3242]'
                } bg-[#181C24] flex flex-col shrink-0 transition-all overflow-hidden`}
              >
                <div className="px-4 py-2.5 border-b border-[#2B3242] bg-[#151922] space-y-2 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#68B6FF]">
                        Eklenebilir Bloklar Kütüphanesi ({filteredCatalog.length}/{BLOCK_CATALOG.length} Blok)
                      </h2>
                      <span className="px-2 py-0.5 rounded bg-[#478CBF]/20 border border-[#68B6FF]/40 text-[11px] font-semibold text-[#68B6FF]">
                        Tıklayarak Seçili Olaya Anında Ekleyin
                      </span>
                      {lastAddedToast && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {lastAddedToast}
                        </span>
                      )}
                    </div>

                    {/* Catalog Dock Mode & Size Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          setIsFullCatalogMode(false);
                          setCatalogDockMode('top_wide');
                          setTopCatalogHeight(360);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                          !isFullCatalogMode && catalogDockMode === 'top_wide'
                            ? 'bg-[#478CBF] text-white border-[#68B6FF]'
                            : 'bg-[#11141A] text-slate-300 border-[#2B3242] hover:text-white'
                        }`}
                        title="Eklenebilir blokları ekranın tam genişliğinde (3-4 sütun) üstte göster"
                      >
                        Üst Tam Genişlik (3-4 Sütun)
                      </button>
                      <button
                        onClick={() => {
                          setIsFullCatalogMode(false);
                          setCatalogDockMode('left_wide');
                          onUpdateLayoutDimensions({ blocksPaletteWidth: 740 });
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                          !isFullCatalogMode && catalogDockMode === 'left_wide'
                            ? 'bg-[#478CBF] text-white border-[#68B6FF]'
                            : 'bg-[#11141A] text-slate-300 border-[#2B3242] hover:text-white'
                        }`}
                        title="Eklenebilir blokları sol tarafta geniş (740px) olarak göster"
                      >
                        Sol Geniş Katalog (740px)
                      </button>
                      <button
                        onClick={() => setIsFullCatalogMode((v) => !v)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                          isFullCatalogMode
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                            : 'bg-[#11141A] text-[#68B6FF] border-[#478CBF]/50 hover:bg-[#478CBF]/20'
                        }`}
                        title="Blok Kütüphanesini %100 Tam Ekranda Aç / Kapat"
                      >
                        {isFullCatalogMode ? '✓ Tam Ekran Katalog (Kapat)' : '⤢ %100 Tam Ekran Katalog'}
                      </button>
                      <button
                        onClick={() => {
                          setIsFullCatalogMode(false);
                          setShowPalettePanel(false);
                        }}
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 ml-0.5"
                        title="Kütüphaneyi Gizle"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Target Event Selector + Search + Category Filter in a clean unified header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 bg-[#11141A] px-3 py-1.5 rounded-xl border border-[#2B3242]">
                      <span className="text-xs text-slate-400 font-semibold">Eklenecek Hedef Olay:</span>
                      <select
                        value={selectedEventId || scene.blocks[0]?.id || ''}
                        onChange={(e) => {
                          setSelectedEventId(e.target.value);
                          setSelectedNestedParentId(null);
                        }}
                        className="bg-[#181C24] border border-[#2B3242] rounded-lg px-2.5 py-1 text-xs font-bold text-[#68B6FF] focus:outline-none focus:border-[#68B6FF]"
                      >
                        {scene.blocks.map((ev, idx) => {
                          const def = getBlockDefinition(ev.type);
                          return (
                            <option key={ev.id} value={ev.id}>
                              OLAY #{idx + 1}: {def?.label || ev.type} ({(ev.children || []).length} aksiyon)
                            </option>
                          );
                        })}
                      </select>
                      {isFullCatalogMode && (
                        <button
                          onClick={() => setIsFullCatalogMode(false)}
                          className="ml-2 px-2.5 py-1 rounded-lg bg-[#478CBF] hover:bg-[#3A78A6] text-white text-xs font-bold"
                        >
                          ← Blok Panosuna Dön
                        </button>
                      )}
                    </div>

                    <div className="relative flex-1 min-w-[260px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                      <input
                        type="text"
                        placeholder="Eklenebilir blok ara (görünmez duvar, yön, zıpla, sınır, animasyon, lazer, dash, puan, ses)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#11141A] border border-[#2B3242] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#68B6FF]"
                      />
                    </div>
                  </div>
                </div>

                {/* Full-Visibility Multi-Row Category Filter */}
                <div className="px-4 py-2 border-b border-[#2B3242] bg-[#141820] flex flex-wrap gap-1.5 shrink-0">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedCategory === 'all'
                        ? 'bg-[#478CBF] text-white shadow-sm'
                        : 'bg-[#11141A] text-slate-300 border border-[#2B3242] hover:bg-[#202531]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#68B6FF]" />
                    <span>Tümü ({BLOCK_CATALOG.length})</span>
                  </button>
                  {categoryEntries.map(([catId, meta]) => {
                    const count = BLOCK_CATALOG.filter((b) => b.category === catId).length;
                    return (
                      <button
                        key={catId}
                        onClick={() => setSelectedCategory(catId)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          selectedCategory === catId
                            ? 'bg-[#202634] text-white border border-[#68B6FF] shadow-sm'
                            : 'bg-[#11141A] text-slate-300 border border-[#2B3242] hover:text-white hover:bg-[#202531]'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span>{meta.label}</span>
                        <span className="text-[10px] font-mono text-slate-400">({count})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Ultra-Wide 3-4 Column Block Cards Grid (Full Width!) */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div
                    className="grid gap-3"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                    }}
                  >
                    {filteredCatalog.map((def) => {
                      const catColor = BLOCK_CATEGORY_META[def.category]?.color || '#478CBF';
                      return (
                        <div
                          key={def.type}
                          onClick={() => handleAddBlockFromCatalog(def)}
                          className="group p-3.5 rounded-xl bg-[#11141A] hover:bg-[#1D2434] border border-[#2B3242] hover:border-[#68B6FF] transition-all cursor-pointer shadow-sm flex flex-col justify-between"
                          style={{ borderLeftWidth: '5px', borderLeftColor: catColor }}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span
                                className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded"
                                style={{
                                  backgroundColor: `${catColor}25`,
                                  color: catColor,
                                }}
                              >
                                {def.isHat
                                  ? '⚡ OLAY BAŞLATICI (YENİ KURAL)'
                                  : BLOCK_CATEGORY_META[def.category]?.label}
                              </span>
                              <span className="flex items-center gap-1 text-xs font-bold text-[#68B6FF] bg-[#478CBF]/20 group-hover:bg-[#478CBF] group-hover:text-white px-2.5 py-1 rounded-lg transition-colors shrink-0">
                                <Plus className="w-3.5 h-3.5" />
                                {def.isHat ? 'Olay Ekle' : '+ Ekle'}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white mb-1 leading-snug">
                              {def.label}
                            </div>
                            <div className="text-xs text-slate-300 leading-relaxed mb-2">
                              {def.description}
                            </div>
                          </div>

                          {def.params.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1E2432]">
                              {def.params.map((p) => (
                                <span
                                  key={p.name}
                                  className="text-[11px] font-mono text-slate-200 bg-[#181C24] px-2 py-0.5 rounded border border-[#2B3242]"
                                >
                                  {p.label}: <strong className="text-[#68B6FF]">{String(p.defaultValue)}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Splitter Handle for Top Catalog Height or Left Palette Width */}
              {!isFullCatalogMode &&
                (catalogDockMode === 'top_wide' ? (
                  <div
                    onMouseDown={(e) =>
                      setDragSplitter({
                        kind: 'topCatalogHeight',
                        startY: e.clientY,
                        startH: topCatalogHeight,
                      })
                    }
                    title="Üst Blok Kütüphanesi Yüksekliğini Sürükleyerek Ayarla (220px - 640px)"
                    className="h-2.5 w-full bg-[#11141A] hover:bg-[#478CBF] active:bg-[#68B6FF] cursor-row-resize flex items-center justify-center transition-colors shrink-0 group border-b border-[#2B3242]"
                  >
                    <GripHorizontal className="w-5 h-3.5 text-slate-500 group-hover:text-white" />
                  </div>
                ) : (
                  <div
                    onMouseDown={(e) =>
                      setDragSplitter({ kind: 'palette', startX: e.clientX, startW: paletteWidth })
                    }
                    title="Sol Blok Kütüphanesi Genişliğini Sürükleyerek Ayarla (540px - 1040px)"
                    className="w-2.5 bg-[#11141A] hover:bg-[#478CBF] active:bg-[#68B6FF] cursor-col-resize flex items-center justify-center transition-colors shrink-0 group"
                  >
                    <GripVertical className="w-3.5 h-4 text-slate-500 group-hover:text-white" />
                  </div>
                ))}
            </>
          )}

          {/* 2. Center Ultra-Wide Event-Action Visual Graph */}
          <div
            className={`${
              isFullCatalogMode && showPalettePanel && !isFocusMode ? 'hidden' : 'flex-1 flex'
            } flex-col h-full min-w-[380px] min-h-0 overflow-hidden bg-[#0E1117]`}
          >
          {/* Quick Event Adder Bar right inside the canvas */}
          <div className="px-5 py-2.5 bg-[#151922] border-b border-[#2B3242] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-[#68B6FF] mr-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Hızlı Olay Ekle:
              </span>
              {QUICK_EVENT_TYPES.map((qEv) => (
                <button
                  key={qEv.type}
                  onClick={() => {
                    const def = getBlockDefinition(qEv.type);
                    if (def) handleAddBlockFromCatalog(def);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#1E2432] hover:bg-[#478CBF] text-xs font-semibold text-slate-100 border border-[#2B3242] transition-colors"
                >
                  {qEv.label}
                </button>
              ))}
            </div>

            {selectedNestedParentId && (
              <button
                onClick={() => setSelectedNestedParentId(null)}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
              >
                Alt Koşul Seçimini Kaldır
              </button>
            )}
          </div>

          {/* 1-Click Ready Block Recipes Bar for Instant Game Mechanics */}
          <div className="px-5 py-2 bg-[#11151E] border-b border-[#2B3242] flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 mr-1">
              ⚡ 1-Tık Hazır Kod Tarifleri:
            </span>
            {[
              {
                label: '🦘 Space ile Çift Zıplama + Ses',
                build: (): BlockInstance => {
                  const pId = scene.objects.find((o) => o.role === 'player')?.id || 'scene';
                  return {
                    id: `ev_recipe_${Date.now()}`,
                    type: 'event_key_pressed',
                    targetObjectId: pId,
                    params: { key: 'Space' },
                    children: [
                      {
                        id: `act_r1_${Date.now()}`,
                        type: 'move_jump',
                        targetObjectId: pId,
                        params: { force: 440 },
                      },
                      {
                        id: `act_r2_${Date.now()}`,
                        type: 'audio_play_sfx',
                        targetObjectId: 'scene',
                        params: { sound: 'jump' },
                      },
                    ],
                  };
                },
              },
              {
                label: '🔫 E Tuşuyla Lazer Ateşle',
                build: (): BlockInstance => {
                  const pId = scene.objects.find((o) => o.role === 'player')?.id || 'scene';
                  return {
                    id: `ev_recipe_${Date.now()}`,
                    type: 'event_key_pressed',
                    targetObjectId: pId,
                    params: { key: 'KeyE' },
                    children: [
                      {
                        id: `act_r1_${Date.now()}`,
                        type: 'act_shoot_projectile',
                        targetObjectId: pId,
                        params: { speed: 620, color: '#38BDF8', damage: 25 },
                      },
                      {
                        id: `act_r2_${Date.now()}`,
                        type: 'audio_play_sfx',
                        targetObjectId: 'scene',
                        params: { sound: 'laser' },
                      },
                    ],
                  };
                },
              },
              {
                label: '💨 Shift ile Hızlı Dash',
                build: (): BlockInstance => {
                  const pId = scene.objects.find((o) => o.role === 'player')?.id || 'scene';
                  return {
                    id: `ev_recipe_${Date.now()}`,
                    type: 'event_key_pressed',
                    targetObjectId: pId,
                    params: { key: 'ShiftLeft' },
                    children: [
                      {
                        id: `act_r1_${Date.now()}`,
                        type: 'move_dash',
                        targetObjectId: pId,
                        params: { power: 540 },
                      },
                      {
                        id: `act_r2_${Date.now()}`,
                        type: 'anim_play',
                        targetObjectId: pId,
                        params: { animState: 'dash', restartIfPlaying: true },
                      },
                    ],
                  };
                },
              },
              {
                label: '🪙 Altın Toplayınca +25 Puan & Yok Et',
                build: (): BlockInstance => {
                  const pId = scene.objects.find((o) => o.role === 'player')?.id || 'scene';
                  return {
                    id: `ev_recipe_${Date.now()}`,
                    type: 'event_on_collision',
                    targetObjectId: pId,
                    params: { withRole: 'collectible' },
                    children: [
                      {
                        id: `act_r1_${Date.now()}`,
                        type: 'ui_add_score',
                        targetObjectId: 'scene',
                        params: { points: 25 },
                      },
                      {
                        id: `act_r2_${Date.now()}`,
                        type: 'sense_destroy_other',
                        targetObjectId: 'scene',
                        params: {},
                      },
                      {
                        id: `act_r3_${Date.now()}`,
                        type: 'audio_play_sfx',
                        targetObjectId: 'scene',
                        params: { sound: 'coin' },
                      },
                    ],
                  };
                },
              },
              {
                label: '💥 Düşmana Çarpınca Hasar + Kamera Sarsıntısı',
                build: (): BlockInstance => {
                  const pId = scene.objects.find((o) => o.role === 'player')?.id || 'scene';
                  return {
                    id: `ev_recipe_${Date.now()}`,
                    type: 'event_on_collision',
                    targetObjectId: pId,
                    params: { withRole: 'enemy' },
                    children: [
                      {
                        id: `act_r1_${Date.now()}`,
                        type: 'sense_damage_target',
                        targetObjectId: pId,
                        params: { amount: -20 },
                      },
                      {
                        id: `act_r2_${Date.now()}`,
                        type: 'camera_shake',
                        targetObjectId: 'scene',
                        params: { intensity: 8 },
                      },
                      {
                        id: `act_r3_${Date.now()}`,
                        type: 'audio_play_sfx',
                        targetObjectId: 'scene',
                        params: { sound: 'hit' },
                      },
                    ],
                  };
                },
              },
              {
                label: '🛡️ Harita Sınırından Yaylı Sekme',
                build: (): BlockInstance => {
                  const pId = scene.objects.find((o) => o.role === 'player')?.id || 'scene';
                  return {
                    id: `ev_recipe_${Date.now()}`,
                    type: 'event_boundary_hit',
                    targetObjectId: pId,
                    params: { edge: 'any' },
                    children: [
                      {
                        id: `act_r1_${Date.now()}`,
                        type: 'world_set_boundary_action',
                        targetObjectId: 'scene',
                        params: { action: 'bounce', bouncePower: 500 },
                      },
                      {
                        id: `act_r2_${Date.now()}`,
                        type: 'audio_play_sfx',
                        targetObjectId: 'scene',
                        params: { sound: 'jump' },
                      },
                    ],
                  };
                },
              },
            ].map((recipe) => (
              <button
                key={recipe.label}
                onClick={() => {
                  const newEv = recipe.build();
                  onUpdateBlocks([...scene.blocks, newEv], `Hazır Tarif: ${recipe.label}`);
                  setSelectedEventId(newEv.id);
                  setLastAddedToast(`Hazır Tarif Eklendi: ${recipe.label}`);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-[11px] font-bold text-emerald-300 border border-emerald-500/30 transition-colors"
              >
                {recipe.label}
              </button>
            ))}
          </div>

          {diagnostics.length > 0 && (
            <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-2 text-xs text-amber-300 shrink-0">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>{diagnostics.length} mantık bildirimi:</strong> {diagnostics[0].message}
              </span>
            </div>
          )}

          {/* Scrollable Wide Block Board (Full Width, 1-Col or 2-Col Grid!) */}
          <div className="flex-1 overflow-y-auto p-5">
            <div
              style={{ zoom: blockScale }}
              className={
                boardColumns === 2 && scene.blocks.length > 1
                  ? 'grid grid-cols-1 2xl:grid-cols-2 lg:grid-cols-2 gap-5 w-full'
                  : 'space-y-5 w-full'
              }
            >
              {scene.blocks.length === 0 ? (
                <div className="col-span-2 h-80 rounded-2xl border-2 border-dashed border-[#2B3242] flex flex-col items-center justify-center text-center p-8">
                  <p className="text-base font-bold text-slate-200 mb-2">
                    Bu sahnede henüz olay bloğu bulunmuyor
                  </p>
                  <p className="text-sm text-slate-400 max-w-lg mb-5">
                    Üstteki <strong>Hızlı Olay Ekle</strong> çubuğundan veya sol kütüphaneden bir başlatıcı olay seçerek oyununuzun mantığını kurgulayın.
                  </p>
                  <button
                    onClick={() => {
                      const def = getBlockDefinition('event_game_start');
                      if (def) handleAddBlockFromCatalog(def);
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#478CBF] hover:bg-[#3A78A6] text-white shadow-md"
                  >
                    + "Oyun Başladığında" Bloğu Ekle
                  </button>
                </div>
              ) : (
                scene.blocks.map((eventBlock, evIdx) => {
                  const eventDef = getBlockDefinition(eventBlock.type);
                  const eventColor = eventDef
                    ? BLOCK_CATEGORY_META[eventDef.category]?.color || '#D97706'
                    : '#D97706';
                  const isSelected = selectedEventId === eventBlock.id;
                  const children = eventBlock.children || [];

                  return (
                    <div
                      key={eventBlock.id}
                      onClick={() => setSelectedEventId(eventBlock.id)}
                      className={`rounded-2xl border-2 transition-all shadow-lg flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#68B6FF] bg-[#161C28] shadow-sky-950/30'
                          : 'border-[#2B3242] bg-[#141822] hover:border-slate-600'
                      }`}
                    >
                      <div>
                        {/* Event Root Header */}
                        <div
                          className="px-4 py-3 rounded-t-2xl flex flex-wrap items-center justify-between gap-2.5 border-b border-[#2B3242]"
                          style={{
                            background: `linear-gradient(90deg, ${eventColor}28 0%, rgba(24,28,36,0.96) 100%)`,
                          }}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider text-slate-950 shadow-sm"
                              style={{ backgroundColor: eventColor }}
                            >
                              OLAY #{evIdx + 1}
                            </span>
                            <span className="text-sm font-bold text-white">
                              {eventDef?.label || eventBlock.type}
                            </span>

                            {/* Target Object Selector */}
                            <div
                              className="flex items-center gap-1 bg-[#11141A] px-2 py-1 rounded-lg border border-[#2B3242]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[11px] text-slate-400">Düğüm:</span>
                              <select
                                value={eventBlock.targetObjectId}
                                onChange={(e) =>
                                  handleUpdateBlockTarget(eventBlock.id, null, e.target.value)
                                }
                                className="bg-transparent text-xs font-semibold text-[#68B6FF] focus:outline-none"
                              >
                                <option value="scene" className="bg-[#11141A]">
                                  Sahne Kökü
                                </option>
                                {scene.objects.map((o) => (
                                  <option key={o.id} value={o.id} className="bg-[#11141A]">
                                    {o.name} ({o.role})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Event Root Parameters */}
                            {eventDef?.params.map((param) => (
                              <div
                                key={param.name}
                                className="flex items-center gap-1.5 bg-[#11141A] px-2 py-1 rounded-lg border border-[#2B3242]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-xs font-medium text-slate-300">
                                  {param.label}:
                                </span>
                                {renderParamInput(
                                  eventBlock.id,
                                  null,
                                  param,
                                  eventBlock.params[param.name]
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-1">
                            {isSelected && (
                              <span className="text-[11px] font-bold text-[#68B6FF] bg-[#478CBF]/20 px-2 py-0.5 rounded border border-[#68B6FF]/40">
                                Seçili
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateBlock(eventBlock.id, null);
                              }}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Olay Grubunu Çoğalt"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBlock(eventBlock.id, null);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Olay Grubunu Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Natural-Language Rule Explanation Strip */}
                        <div className="px-4 py-1.5 bg-[#0F131B] border-b border-[#232938] text-[11px] text-slate-300 flex items-center gap-2">
                          <span className="text-indigo-400 font-bold shrink-0">💬 Kural Özeti:</span>
                          <span className="truncate">
                            <strong>
                              {scene.objects.find((o) => o.id === eventBlock.targetObjectId)?.name || 'Sahne'}
                            </strong>{' '}
                            üzerinde{' '}
                            <span className="text-amber-300 font-semibold">
                              "{eventDef?.label || eventBlock.type}"
                            </span>{' '}
                            gerçekleştiğinde →{' '}
                            {children.length === 0 ? (
                              <span className="text-slate-500 italic">Henüz aksiyon eklenmedi</span>
                            ) : (
                              <span className="text-emerald-300 font-medium">
                                {children
                                  .map((c) => getBlockDefinition(c.type)?.label || c.type)
                                  .join('  ➔  ')}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Children Action Blocks */}
                        <div className="p-4 pl-6 space-y-2.5 relative">
                          <div className="absolute left-3 top-3 bottom-3 w-1 bg-[#2B3242] rounded-full" />

                          {children.length === 0 ? (
                            <div className="py-3 px-4 rounded-xl border border-dashed border-[#2B3242] text-xs text-slate-400">
                              Aşağıdaki hızlı menüden veya sol kütüphaneden aksiyon bloğu ekleyin.
                            </div>
                          ) : (
                            children.map((child, idx) => {
                              const childDef = getBlockDefinition(child.type);
                              const childColor = childDef
                                ? BLOCK_CATEGORY_META[childDef.category]?.color || '#478CBF'
                                : '#478CBF';
                              const isContainer = Boolean(childDef?.isContainer);
                              const isNestedTarget = selectedNestedParentId === child.id;
                              const subChildren = child.children || [];

                              return (
                                <div key={child.id} className="space-y-2">
                                  <div
                                    className={`relative flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[#11141A] border transition-colors ${
                                      isNestedTarget
                                        ? 'border-amber-400 ring-1 ring-amber-400/30'
                                        : 'border-[#2B3242] hover:border-slate-600'
                                    }`}
                                    style={{
                                      borderLeftWidth: '5px',
                                      borderLeftColor: childColor,
                                    }}
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[11px] font-mono text-slate-400 bg-[#181C24] px-1.5 py-0.5 rounded border border-[#2B3242]">
                                        {evIdx + 1}.{idx + 1}
                                      </span>
                                      <span className="text-xs font-bold text-slate-100">
                                        {childDef?.label || child.type}
                                      </span>

                                      {/* Target selector for action block */}
                                      <div
                                        className="flex items-center gap-1 bg-[#181C24] px-2 py-0.5 rounded border border-[#2B3242]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <select
                                          value={child.targetObjectId}
                                          onChange={(e) =>
                                            handleUpdateBlockTarget(
                                              eventBlock.id,
                                              child.id,
                                              e.target.value
                                            )
                                          }
                                          className="bg-transparent text-xs text-[#68B6FF] focus:outline-none"
                                        >
                                          <option value="scene" className="bg-[#11141A]">
                                            Sahne
                                          </option>
                                          {scene.objects.map((o) => (
                                            <option key={o.id} value={o.id} className="bg-[#11141A]">
                                              {o.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      {childDef?.params.map((param) => (
                                        <div
                                          key={param.name}
                                          className="flex items-center gap-1.5 bg-[#181C24] px-2 py-0.5 rounded-lg border border-[#2B3242]"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <span className="text-xs font-medium text-slate-300">
                                            {param.label}:
                                          </span>
                                          {renderParamInput(
                                            eventBlock.id,
                                            child.id,
                                            param,
                                            child.params[param.name]
                                          )}
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex items-center gap-0.5">
                                      {isContainer && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedEventId(eventBlock.id);
                                            setSelectedNestedParentId(
                                              isNestedTarget ? null : child.id
                                            );
                                          }}
                                          className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors mr-1 ${
                                            isNestedTarget
                                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                                              : 'bg-slate-800 text-amber-300 border-slate-700 hover:border-amber-400'
                                          }`}
                                        >
                                          {isNestedTarget ? 'İçine Ekleniyor' : '+ İçine Blok'}
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveActionBlock(eventBlock.id, idx, -1);
                                        }}
                                        disabled={idx === 0}
                                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                                        title="Yukarı Taşı"
                                      >
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveActionBlock(eventBlock.id, idx, 1);
                                        }}
                                        disabled={idx === children.length - 1}
                                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                                        title="Aşağı Taşı"
                                      >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDuplicateBlock(eventBlock.id, child.id);
                                        }}
                                        className="p-1 text-slate-400 hover:text-[#68B6FF] rounded hover:bg-slate-800"
                                        title="Bloğu Çoğalt"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteBlock(eventBlock.id, child.id);
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10"
                                        title="Bloğu Sil"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {(isContainer || subChildren.length > 0) && (
                                    <div className="ml-6 pl-3 border-l-2 border-amber-500/40 space-y-2">
                                      {subChildren.map((sub, sIdx) => {
                                        const subDef = getBlockDefinition(sub.type);
                                        const subColor = subDef
                                          ? BLOCK_CATEGORY_META[subDef.category]?.color || '#10B981'
                                          : '#10B981';
                                        return (
                                          <div
                                            key={sub.id}
                                            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#11141A] border border-[#2B3242]"
                                            style={{
                                              borderLeftWidth: '4px',
                                              borderLeftColor: subColor,
                                            }}
                                          >
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="text-[11px] font-mono text-amber-300">
                                                ↳ {sIdx + 1}
                                              </span>
                                              <span className="text-xs font-semibold text-slate-100">
                                                {subDef?.label || sub.type}
                                              </span>
                                              {subDef?.params.map((param) => (
                                                <div
                                                  key={param.name}
                                                  className="flex items-center gap-1.5"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <span className="text-xs text-slate-400">
                                                    {param.label}:
                                                  </span>
                                                  {renderParamInput(
                                                    eventBlock.id,
                                                    sub.id,
                                                    param,
                                                    sub.params[param.name],
                                                    child.id
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteBlock(eventBlock.id, sub.id, child.id);
                                              }}
                                              className="p-1 text-slate-400 hover:text-rose-400"
                                              title="Alt Bloğu Sil"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Inline Quick-Add Action Bar inside every Event Card */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2.5 bg-[#11141A]/90 rounded-b-2xl border-t border-[#2B3242] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-slate-400">
                            + Hızlı Aksiyon:
                          </span>
                          {QUICK_ACTION_TYPES.slice(0, 5).map((qa) => (
                            <button
                              key={qa.type}
                              onClick={() => {
                                const def = getBlockDefinition(qa.type);
                                if (def) handleAddBlockFromCatalog(def, eventBlock.id);
                              }}
                              className="px-2 py-0.5 rounded bg-[#1D2331] hover:bg-[#478CBF] text-[11px] font-medium text-slate-200 border border-[#2B3242] transition-colors"
                            >
                              + {qa.label.split(' (')[0]}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const val = e.target.value as BlockType;
                              if (!val) return;
                              const def = getBlockDefinition(val);
                              if (def) handleAddBlockFromCatalog(def, eventBlock.id);
                              e.target.value = '';
                            }}
                            className="bg-[#181C24] border border-[#2B3242] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#68B6FF] focus:outline-none"
                          >
                            <option value="">+ Tüm Aksiyonlardan Ekle...</option>
                            {BLOCK_CATALOG.filter((b) => !b.isHat).map((b) => (
                              <option key={b.type} value={b.type}>
                                {b.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              setSelectedEventId(eventBlock.id);
                              setSelectedNestedParentId(null);
                              setShowPalettePanel(true);
                              setIsFocusMode(false);
                              setIsFullCatalogMode(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#478CBF]/25 hover:bg-[#478CBF] text-xs font-bold text-[#68B6FF] hover:text-white border border-[#68B6FF]/50 transition-colors"
                          >
                            ⤢ Geniş Katalogdan Seç &amp; Ekle
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        </div>

        {/* 3. Right Resizable & Unlockable Live Code Editor + Variable Manager */}
        {showRightCodePanel && !isFocusMode && (
          <>
            <div
              onMouseDown={(e) =>
                setDragSplitter({
                  kind: 'codeWidth',
                  startX: e.clientX,
                  startW: codePanelWidth,
                })
              }
              title="Sağ Kod ve Değişken Paneli Genişliğini Sürükleyerek Ayarla"
              className="w-2 bg-[#11141A] hover:bg-[#478CBF] active:bg-[#68B6FF] cursor-col-resize flex items-center justify-center transition-colors shrink-0 group"
            >
              <GripVertical className="w-3 h-4 text-slate-600 group-hover:text-white" />
            </div>

            <div
              ref={rightColumnRef}
              style={{ width: `${codePanelWidth}px` }}
              className="border-l border-[#2B3242] bg-[#181C24] flex flex-col shrink-0 h-full overflow-hidden"
            >
              <div
                style={{ height: `${Math.round(codeSplitRatio * 100)}%` }}
                className="flex flex-col min-h-[180px] overflow-hidden"
              >
                {/* Header with Toggleable Sync Lock AND Close Button */}
                <div className="p-2.5 bg-[#151922] border-b border-[#2B3242] flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-[#68B6FF]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Oyun Kodu
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleToggleCodeSyncLock}
                      title={
                        isCodeSyncLocked
                          ? 'Salt okunur otomatik senkronu kapatıp kodu doğrudan düzenlemek için tıklayın'
                          : 'Otomatik blok senkronunu tekrar açmak için tıklayın'
                      }
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                        isCodeSyncLocked
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                          : 'bg-emerald-600 text-white border-emerald-400'
                      }`}
                    >
                      {isCodeSyncLocked ? (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Salt Okunur Kapat (Düzenle)</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3" />
                          <span>Düzenleme Açık</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setShowRightCodePanel(false)}
                      title="Kod Penceresini Kapat"
                      className="p-1 rounded bg-[#202531] hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Action Sub-bar when Manual Code Editing is Unlocked */}
                {!isCodeSyncLocked && (
                  <div className="px-3 py-1.5 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-emerald-300">
                      Manuel Kod Modu: Kodu doğrudan düzenleyebilirsiniz.
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditableCodeText(generatedLiveCode)}
                        title="Bloklardan Yeniden Üret"
                        className="p-1 rounded bg-[#181C24] hover:bg-slate-700 text-slate-300"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={handleApplyEditedCodeToScene}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                      >
                        <Check className="w-3 h-3" />
                        <span>Uygula</span>
                      </button>
                    </div>
                  </div>
                )}

                {codeAppliedBanner && (
                  <div className="px-3 py-1.5 bg-indigo-600/30 border-b border-indigo-400/40 text-[11px] text-indigo-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{codeAppliedBanner}</span>
                  </div>
                )}

                <div className="flex-1 overflow-hidden bg-[#0B0E14] flex flex-col">
                  {isCodeSyncLocked ? (
                    <div className="flex-1 overflow-y-auto p-3.5 font-mono text-xs text-slate-300 leading-relaxed">
                      <pre className="whitespace-pre-wrap break-words">{generatedLiveCode}</pre>
                    </div>
                  ) : (
                    <textarea
                      value={editableCodeText}
                      onChange={(e) => setEditableCodeText(e.target.value)}
                      spellCheck={false}
                      aria-label="Düzenlenebilir Oyun Kodu"
                      className="flex-1 w-full h-full p-3.5 bg-[#0B0E14] font-mono text-xs text-emerald-300 leading-relaxed focus:outline-none resize-none"
                    />
                  )}
                </div>
              </div>

              <div
                onMouseDown={(e) => {
                  const totalH = rightColumnRef.current?.clientHeight || 600;
                  setDragSplitter({
                    kind: 'codeVertical',
                    startY: e.clientY,
                    startRatio: codeSplitRatio,
                    totalH,
                  });
                }}
                title="Canlı Kod ve Değişken Yükseklik Oranını Sürükleyerek Ayarla"
                className="h-2 bg-[#11141A] hover:bg-[#478CBF] active:bg-[#68B6FF] cursor-row-resize flex items-center justify-center border-y border-[#2B3242] transition-colors shrink-0 group"
              >
                <GripHorizontal className="w-4 h-3 text-slate-600 group-hover:text-white" />
              </div>

              <div className="flex-1 flex flex-col min-h-[150px] overflow-hidden">
                <div className="p-2.5 bg-[#151922] border-b border-[#2B3242] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Global Değişkenler ({project.variables.length})
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                  {project.variables.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#11141A] border border-[#2B3242] text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-200">{v.name}</span>
                        <span className="ml-1.5 text-[10px] text-slate-400">({v.type})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-amber-300">
                          = {String(v.initialValue)}
                        </span>
                        <button
                          onClick={() =>
                            onUpdateVariables(project.variables.filter((item) => item.id !== v.id))
                          }
                          className="text-slate-500 hover:text-rose-400"
                          title="Değişkeni Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <form onSubmit={handleAddVariable} className="pt-2 space-y-2">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Değişken adı..."
                        value={newVarName}
                        onChange={(e) => setNewVarName(e.target.value)}
                        className="flex-1 bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                      <select
                        value={newVarType}
                        onChange={(e) => setNewVarType(e.target.value as any)}
                        className="bg-[#11141A] border border-[#2B3242] rounded-lg px-2 py-1.5 text-xs text-slate-300"
                      >
                        <option value="number">Sayı</option>
                        <option value="string">Metin</option>
                        <option value="boolean">Mantıksal</option>
                      </select>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Başlangıç değeri"
                        value={newVarValue}
                        onChange={(e) => setNewVarValue(e.target.value)}
                        className="flex-1 bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-[#478CBF] hover:bg-[#3A78A6] text-white text-xs font-semibold"
                      >
                        + Ekle
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
