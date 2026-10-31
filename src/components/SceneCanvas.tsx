import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  GameObject,
  GameScene,
  ObjectRole,
  TileBrushKind,
  TileMapCell,
} from '../types/engine';
import {
  screenToWorld,
  snapValueToGrid,
  sortSceneObjectsForRender,
} from '../engine/sceneSystem';
import {
  drawGameObjectOnCanvas,
  drawTileMapCellsOnCanvas,
  TILE_BRUSH_PALETTE,
} from '../engine/sharedRenderer';
import {
  MousePointer,
  Move,
  Maximize2,
  RotateCw,
  Hand,
  Grid,
  Magnet,
  Eye,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Plus,
  Trash2,
  Copy,
  SlidersHorizontal,
  Paintbrush,
  Eraser,
  Undo2,
  Redo2,
} from 'lucide-react';

export type EditorToolMode =
  | 'select'
  | 'move'
  | 'scale'
  | 'rotate'
  | 'hand'
  | 'tile_paint'
  | 'tile_erase';

interface SceneCanvasProps {
  scene: GameScene;
  selectedObjectId: string | null;
  toolMode: EditorToolMode;
  showGrid: boolean;
  showCollisionBoxes: boolean;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (
    objectId: string,
    updater: (obj: GameObject) => GameObject,
    commitLabel?: string
  ) => void;
  onUpdateTileMapCells?: (cells: TileMapCell[], commitLabel?: string) => void;
  onAddObjectRole: (role: ObjectRole, x: number, y: number) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onChangeToolMode: (mode: EditorToolMode) => void;
  onToggleSnap: () => void;
  onToggleGrid: () => void;
  onToggleCollisionBoxes: () => void;
  onOpenWindowSizingModal?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onCommitUndoSnapshot?: (label: string) => void;
}

type DragInteraction =
  | {
      kind: 'pan';
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      kind: 'move';
      objectId: string;
      startWorldX: number;
      startWorldY: number;
      origX: number;
      origY: number;
    }
  | {
      kind: 'scale';
      objectId: string;
      startWorldX: number;
      startWorldY: number;
      origW: number;
      origH: number;
    }
  | {
      kind: 'rotate';
      objectId: string;
      centerX: number;
      centerY: number;
    }
  | {
      kind: 'tile_paint';
      mode: 'paint' | 'erase';
    };

export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  scene,
  selectedObjectId,
  toolMode,
  showGrid,
  showCollisionBoxes,
  onSelectObject,
  onUpdateObject,
  onUpdateTileMapCells,
  onAddObjectRole,
  onDuplicateSelected,
  onDeleteSelected,
  onChangeToolMode,
  onToggleSnap,
  onToggleGrid,
  onToggleCollisionBoxes,
  onOpenWindowSizingModal,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onCommitUndoSnapshot,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 560 });
  const [viewport, setViewport] = useState({ panX: 38, panY: 34, zoom: 0.88 });
  const [hoverWorldPos, setHoverWorldPos] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragInteraction | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [activeTileBrush, setActiveTileBrush] = useState<TileBrushKind>('grass_ground');

  // ResizeObserver for crisp HiDPI canvas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Spacebar hand pan shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }
      if (e.code === 'Space') setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const sortedObjects = sortSceneObjectsForRender(scene.objects, scene.layers);

  const applyTileAtWorld = useCallback(
    (worldX: number, worldY: number, mode: 'paint' | 'erase') => {
      if (!onUpdateTileMapCells) return;
      const g = Math.max(16, scene.gridSize || 32);
      const col = Math.floor(worldX / g);
      const row = Math.floor(worldY / g);
      const maxCols = Math.ceil((scene.camera.boundsWidth || 1200) / g);
      const maxRows = Math.ceil((scene.camera.boundsHeight || 600) / g);
      if (col < 0 || row < 0 || col >= maxCols || row >= maxRows) return;

      const currentCells = scene.tilemapCells || [];
      if (mode === 'erase') {
        const filtered = currentCells.filter((c) => !(c.col === col && c.row === row));
        if (filtered.length !== currentCells.length) {
          onUpdateTileMapCells(filtered, 'TileMap Karosu Silindi');
        }
      } else {
        const existingIdx = currentCells.findIndex((c) => c.col === col && c.row === row);
        if (existingIdx >= 0 && currentCells[existingIdx].kind === activeTileBrush) {
          return;
        }
        const nextCells =
          existingIdx >= 0
            ? currentCells.map((c, idx) =>
                idx === existingIdx ? { col, row, kind: activeTileBrush } : c
              )
            : [...currentCells, { col, row, kind: activeTileBrush }];
        onUpdateTileMapCells(nextCells, 'TileMap Karosu Boyandı');
      }
    },
    [onUpdateTileMapCells, scene.gridSize, scene.camera, scene.tilemapCells, activeTileBrush]
  );

  // Main render loop using shared drawTileMapCellsOnCanvas & drawGameObjectOnCanvas (100% visual parity)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Godot 4 Dark Slate Viewport Backdrop
    ctx.fillStyle = '#11141A';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);

    const worldW = scene.camera.boundsWidth || 960;
    const worldH = scene.camera.boundsHeight || 540;

    // Scene world background
    ctx.fillStyle = scene.backgroundColor || '#0F172A';
    ctx.fillRect(0, 0, worldW, worldH);

    // Grid
    if (showGrid && scene.gridSize >= 8) {
      const step = scene.gridSize;
      ctx.lineWidth = 1 / viewport.zoom;
      for (let x = 0; x <= worldW; x += step) {
        ctx.strokeStyle =
          x % (step * 4) === 0 ? 'rgba(148, 163, 184, 0.17)' : 'rgba(148, 163, 184, 0.06)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, worldH);
        ctx.stroke();
      }
      for (let y = 0; y <= worldH; y += step) {
        ctx.strokeStyle =
          y % (step * 4) === 0 ? 'rgba(148, 163, 184, 0.17)' : 'rgba(148, 163, 184, 0.06)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(worldW, y);
        ctx.stroke();
      }
    }

    // Godot Origin Axis lines (Red X-axis, Green Y-axis)
    ctx.lineWidth = 1.5 / viewport.zoom;
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(worldW, 0);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(0, worldH);
    ctx.stroke();

    // Draw TileMapLayer cells (shared renderer)
    drawTileMapCellsOnCanvas(ctx, scene.tilemapCells, scene.gridSize);

    // Draw hover ghost tile if in TileMap brush or erase mode
    if (toolMode === 'tile_paint' || toolMode === 'tile_erase') {
      const g = Math.max(16, scene.gridSize || 32);
      const hoverCol = Math.floor(hoverWorldPos.x / g);
      const hoverRow = Math.floor(hoverWorldPos.y / g);
      if (hoverCol >= 0 && hoverRow >= 0) {
        const gx = hoverCol * g;
        const gy = hoverRow * g;
        ctx.save();
        if (toolMode === 'tile_paint') {
          const pal = TILE_BRUSH_PALETTE[activeTileBrush];
          ctx.fillStyle = pal ? pal.fill : '#478CBF';
          ctx.globalAlpha = 0.55;
          ctx.fillRect(gx, gy, g, g);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#68B6FF';
        } else {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.fillRect(gx, gy, g, g);
          ctx.strokeStyle = '#F87171';
        }
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.strokeRect(gx, gy, g, g);
        ctx.restore();
      }
    }

    // Active camera viewport guide frame (960x540)
    ctx.strokeStyle = 'rgba(104, 182, 255, 0.42)';
    ctx.lineWidth = 1.5 / viewport.zoom;
    ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
    ctx.strokeRect(0, 0, scene.camera.width || 960, scene.camera.height || 540);
    ctx.setLineDash([]);

    // World bounds border & Unity/Godot Invisible Boundary Gizmos
    const wb = scene.worldBounds || {
      enabled: true,
      showGizmoInEditor: true,
      leftAction: 'solid',
      rightAction: 'solid',
      topAction: 'solid',
      bottomAction: 'respawn_damage',
    };
    ctx.strokeStyle = 'rgba(71, 140, 191, 0.65)';
    ctx.lineWidth = 2 / viewport.zoom;
    ctx.strokeRect(0, 0, worldW, worldH);

    if (wb.enabled && wb.showGizmoInEditor !== false) {
      const actionColor = (act: string) => {
        if (act === 'respawn_damage' || act === 'gameover') return '#F43F5E';
        if (act === 'bounce') return '#EC4899';
        if (act === 'wrap') return '#A855F7';
        if (act === 'victory') return '#10B981';
        return '#38BDF8';
      };
      const actionLabel = (act: string) => {
        if (act === 'respawn_damage') return 'BAŞA DÖNDÜR + HASAR';
        if (act === 'gameover') return 'OYUN BİTER (GAME OVER)';
        if (act === 'bounce') return 'GERİ SEKTİR (BOUNCE)';
        if (act === 'wrap') return 'KARŞI KENARDAN ÇIK (WRAP)';
        if (act === 'victory') return 'BÖLÜM ZAFERİ';
        return 'KATI DUVAR (ENGELLE)';
      };

      ctx.save();
      ctx.lineWidth = 3 / viewport.zoom;
      ctx.setLineDash([8 / viewport.zoom, 5 / viewport.zoom]);

      // Bottom boundary gizmo
      ctx.strokeStyle = actionColor(wb.bottomAction);
      ctx.beginPath();
      ctx.moveTo(0, worldH);
      ctx.lineTo(worldW, worldH);
      ctx.stroke();

      // Left boundary gizmo
      ctx.strokeStyle = actionColor(wb.leftAction);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, worldH);
      ctx.stroke();

      // Right boundary gizmo
      ctx.strokeStyle = actionColor(wb.rightAction);
      ctx.beginPath();
      ctx.moveTo(worldW, 0);
      ctx.lineTo(worldW, worldH);
      ctx.stroke();

      // Top boundary gizmo
      ctx.strokeStyle = actionColor(wb.topAction);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(worldW, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Edge labels
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = actionColor(wb.bottomAction);
      ctx.fillText(`⬇ ALT GÖRÜNMEZ SINIR: ${actionLabel(wb.bottomAction)}`, 14, worldH - 8);
      ctx.fillStyle = actionColor(wb.leftAction);
      ctx.fillText(`⬅ SOL SINIR: ${actionLabel(wb.leftAction)}`, 10, 20);
      ctx.fillStyle = actionColor(wb.rightAction);
      ctx.fillText(`SAĞ SINIR: ${actionLabel(wb.rightAction)} ➡`, Math.max(220, worldW - 230), 20);
      ctx.restore();
    }

    // Draw all scene objects with shared vector sprite renderer
    for (const obj of sortedObjects) {
      drawGameObjectOnCanvas(
        ctx,
        obj,
        obj.id === selectedObjectId,
        showCollisionBoxes,
        0
      );
    }

    ctx.restore();

    // Draw Godot 4 Top & Left Pixel Rulers (Screen-Space Overlay)
    const rulerThickness = 20;
    ctx.fillStyle = '#181C24';
    ctx.fillRect(0, 0, canvasSize.width, rulerThickness);
    ctx.fillRect(0, 0, rulerThickness, canvasSize.height);

    ctx.strokeStyle = '#2B3242';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerThickness + 0.5);
    ctx.lineTo(canvasSize.width, rulerThickness + 0.5);
    ctx.moveTo(rulerThickness + 0.5, 0);
    ctx.lineTo(rulerThickness + 0.5, canvasSize.height);
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px monospace';
    const stepWorld = viewport.zoom < 0.6 ? 200 : 100;
    for (let wx = 0; wx <= worldW + 200; wx += stepWorld) {
      const sx = viewport.panX + wx * viewport.zoom;
      if (sx >= rulerThickness && sx <= canvasSize.width) {
        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(sx, rulerThickness - 6);
        ctx.lineTo(sx, rulerThickness);
        ctx.stroke();
        ctx.fillText(`${wx}`, sx + 3, 13);
      }
    }
    for (let wy = 0; wy <= worldH + 200; wy += stepWorld) {
      const sy = viewport.panY + wy * viewport.zoom;
      if (sy >= rulerThickness && sy <= canvasSize.height) {
        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(rulerThickness - 6, sy);
        ctx.lineTo(rulerThickness, sy);
        ctx.stroke();
        ctx.save();
        ctx.translate(12, sy + 3);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${wy}`, 0, 0);
        ctx.restore();
      }
    }

    // Corner square (px unit badge)
    ctx.fillStyle = '#202531';
    ctx.fillRect(0, 0, rulerThickness, rulerThickness);
    ctx.fillStyle = '#68B6FF';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('px', 4, 13);
  }, [
    canvasSize,
    scene,
    sortedObjects,
    selectedObjectId,
    viewport,
    showGrid,
    showCollisionBoxes,
    toolMode,
    hoverWorldPos,
    activeTileBrush,
  ]);

  const getPointerWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return screenToWorld(clientX, clientY, rect, viewport);
    },
    [viewport]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getPointerWorld(e.clientX, e.clientY);

    if (e.button === 1 || toolMode === 'hand' || isSpacePressed) {
      setDragState({
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: viewport.panX,
        startPanY: viewport.panY,
      });
      return;
    }

    // TileMap Brush / Eraser interaction
    if (toolMode === 'tile_paint' || toolMode === 'tile_erase') {
      const mode = e.button === 2 || toolMode === 'tile_erase' ? 'erase' : 'paint';
      onCommitUndoSnapshot?.(mode === 'erase' ? 'TileMap Silme' : 'TileMap Çizimi');
      applyTileAtWorld(pt.x, pt.y, mode);
      setDragState({ kind: 'tile_paint', mode });
      return;
    }

    if (e.button !== 0) return;

    const selectedObj = scene.objects.find((o) => o.id === selectedObjectId);
    if (selectedObj && !selectedObj.locked) {
      const seX = selectedObj.x + selectedObj.width;
      const seY = selectedObj.y + selectedObj.height;
      if (
        toolMode === 'scale' ||
        Math.hypot(pt.x - seX, pt.y - seY) <= 12 / viewport.zoom
      ) {
        onCommitUndoSnapshot?.(`Boyutlandır: ${selectedObj.name}`);
        setDragState({
          kind: 'scale',
          objectId: selectedObj.id,
          startWorldX: pt.x,
          startWorldY: pt.y,
          origW: selectedObj.width,
          origH: selectedObj.height,
        });
        return;
      }

      if (toolMode === 'rotate') {
        onCommitUndoSnapshot?.(`Döndür: ${selectedObj.name}`);
        setDragState({
          kind: 'rotate',
          objectId: selectedObj.id,
          centerX: selectedObj.x + selectedObj.width / 2,
          centerY: selectedObj.y + selectedObj.height / 2,
        });
        return;
      }
    }

    const layerMap = new Map<string, { visible: boolean; locked: boolean }>(
      scene.layers.map((l) => [l.id, l])
    );

    for (let i = sortedObjects.length - 1; i >= 0; i--) {
      const obj = sortedObjects[i];
      const layer = layerMap.get(obj.layerId);
      if ((layer && (!layer.visible || layer.locked)) || !obj.visible || obj.locked) {
        continue;
      }
      if (
        pt.x >= obj.x &&
        pt.x <= obj.x + obj.width &&
        pt.y >= obj.y &&
        pt.y <= obj.y + obj.height
      ) {
        onSelectObject(obj.id);
        onCommitUndoSnapshot?.(`Taşı: ${obj.name}`);
        setDragState({
          kind: 'move',
          objectId: obj.id,
          startWorldX: pt.x,
          startWorldY: pt.y,
          origX: obj.x,
          origY: obj.y,
        });
        return;
      }
    }

    onSelectObject(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getPointerWorld(e.clientX, e.clientY);
    setHoverWorldPos({ x: Math.round(pt.x), y: Math.round(pt.y) });

    if (!dragState) return;

    if (dragState.kind === 'tile_paint') {
      applyTileAtWorld(pt.x, pt.y, dragState.mode);
      return;
    }

    if (dragState.kind === 'pan') {
      setViewport((prev) => ({
        ...prev,
        panX: Math.round(dragState.startPanX + (e.clientX - dragState.startClientX)),
        panY: Math.round(dragState.startPanY + (e.clientY - dragState.startClientY)),
      }));
      return;
    }

    if (dragState.kind === 'move') {
      const dx = pt.x - dragState.startWorldX;
      const dy = pt.y - dragState.startWorldY;
      const nextX = snapValueToGrid(dragState.origX + dx, scene.gridSize, scene.snapToGrid);
      const nextY = snapValueToGrid(dragState.origY + dy, scene.gridSize, scene.snapToGrid);
      onUpdateObject(dragState.objectId, (obj) => ({
        ...obj,
        x: Math.round(nextX),
        y: Math.round(nextY),
      }));
      return;
    }

    if (dragState.kind === 'scale') {
      const dx = pt.x - dragState.startWorldX;
      const dy = pt.y - dragState.startWorldY;
      const nextW = Math.max(
        16,
        snapValueToGrid(dragState.origW + dx, Math.max(8, scene.gridSize / 2), scene.snapToGrid)
      );
      const nextH = Math.max(
        16,
        snapValueToGrid(dragState.origH + dy, Math.max(8, scene.gridSize / 2), scene.snapToGrid)
      );
      onUpdateObject(dragState.objectId, (obj) => ({
        ...obj,
        width: Math.round(nextW),
        height: Math.round(nextH),
        collision: {
          ...obj.collision,
          width: Math.round(nextW),
          height: Math.round(nextH),
        },
      }));
      return;
    }

    if (dragState.kind === 'rotate') {
      const angleRad = Math.atan2(pt.y - dragState.centerY, pt.x - dragState.centerX);
      let angleDeg = Math.round((angleRad * 180) / Math.PI + 90);
      if (scene.snapToGrid) {
        angleDeg = Math.round(angleDeg / 15) * 15;
      }
      onUpdateObject(dragState.objectId, (obj) => ({
        ...obj,
        rotation: ((angleDeg % 360) + 360) % 360,
      }));
    }
  };

  const handleMouseUp = () => setDragState(null);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(2.8, Math.max(0.35, Number((viewport.zoom * factor).toFixed(2))));
    setViewport((prev) => ({ ...prev, zoom: nextZoom }));
  };

  const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const role = e.dataTransfer.getData('application/kareforge-object-role') as ObjectRole;
    if (!role) return;
    const pt = getPointerWorld(e.clientX, e.clientY);
    const snappedX = snapValueToGrid(pt.x - 24, scene.gridSize, scene.snapToGrid);
    const snappedY = snapValueToGrid(pt.y - 24, scene.gridSize, scene.snapToGrid);
    onAddObjectRole(role, snappedX, snappedY);
  };

  const quickRoles: { role: ObjectRole; label: string; nodeTag: string; color: string }[] = [
    { role: 'player', label: 'Kahraman', nodeTag: 'CharacterBody2D', color: '#2563EB' },
    { role: 'platform', label: 'Platform', nodeTag: 'StaticBody2D', color: '#10B981' },
    { role: 'moving_platform', label: 'Hareketli Platform', nodeTag: 'StaticBody2D', color: '#38BDF8' },
    { role: 'invisible_wall', label: 'Görünmez Sınır', nodeTag: 'StaticBody2D', color: '#06B6D4' },
    { role: 'checkpoint', label: 'Kayıt Noktası', nodeTag: 'Area2D', color: '#10B981' },
    { role: 'collectible', label: 'Altın/Ödül', nodeTag: 'Area2D', color: '#D97706' },
    { role: 'powerup', label: 'Can İksiri', nodeTag: 'Area2D', color: '#34D399' },
    { role: 'enemy', label: 'Slime AI', nodeTag: 'CharacterBody2D', color: '#DC2626' },
    { role: 'bounce_pad', label: 'Trambolin Yay', nodeTag: 'Area2D', color: '#EC4899' },
    { role: 'hazard', label: 'Diken Tuzak', nodeTag: 'Area2D', color: '#F43F5E' },
    { role: 'light_source', label: 'Meşale Işık', nodeTag: 'PointLight2D', color: '#FBBF24' },
    { role: 'npc', label: 'Rehber NPC', nodeTag: 'Area2D', color: '#7C3AED' },
    { role: 'goal', label: 'Bitiş Bayrağı', nodeTag: 'Area2D', color: '#16A34A' },
    { role: 'crate', label: 'Fizik Sandık', nodeTag: 'RigidBody2D', color: '#B45309' },
    { role: 'ui_button', label: 'UI Buton', nodeTag: 'Control', color: '#38BDF8' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#11141A] select-none overflow-hidden">
      {/* Top Godot 4 2D Viewport Toolbar */}
      <div className="h-10 px-2.5 bg-[#181C24] border-b border-[#2B3242] flex items-center justify-between gap-2 shrink-0 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-[#11141A] p-0.5 rounded-md border border-[#2B3242]">
            {[
              { id: 'select', icon: MousePointer, label: 'Seç (Q)' },
              { id: 'move', icon: Move, label: 'Taşı (W)' },
              { id: 'scale', icon: Maximize2, label: 'Boyut (S)' },
              { id: 'rotate', icon: RotateCw, label: 'Döndür (E)' },
              { id: 'hand', icon: Hand, label: 'Kaydır (Boşluk)' },
              { id: 'tile_paint', icon: Paintbrush, label: 'Karo Fırçası (B)' },
              { id: 'tile_erase', icon: Eraser, label: 'Silgi (X)' },
            ].map((item) => {
              const Icon = item.icon;
              const active = toolMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeToolMode(item.id as EditorToolMode)}
                  title={item.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#478CBF] text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">{item.label.split(' (')[0]}</span>
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-[#2B3242] mx-0.5" />

          {/* Direct Undo / Redo Buttons inside 2D Scene Editor Toolbar */}
          {onUndo && (
            <div className="flex items-center gap-1 bg-[#11141A] p-0.5 rounded-md border border-[#2B3242]">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title="Sahne / Çizim İşlemini Geri Al (Ctrl+Z)"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Geri Al</span>
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title="Sahne / Çizim İşlemini İleri Al (Ctrl+Y)"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span>İleri Al</span>
              </button>
            </div>
          )}

          <button
            onClick={onToggleGrid}
            title="Izgarayı Göster / Gizle"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
              showGrid
                ? 'bg-[#478CBF]/20 border-[#478CBF]/50 text-[#68B6FF]'
                : 'bg-[#11141A] border-[#2B3242] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Izgara ({scene.gridSize}px)</span>
          </button>

          <button
            onClick={onToggleSnap}
            title="Izgaraya Mıknatıslı Yapışma (Snap)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
              scene.snapToGrid
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-[#11141A] border-[#2B3242] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Snap</span>
          </button>

          <button
            onClick={onToggleCollisionBoxes}
            title="CollisionShape2D Sınırlarını Göster"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
              showCollisionBoxes
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-[#11141A] border-[#2B3242] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>CollisionShape2D</span>
          </button>
        </div>

        {/* Right Zoom & Coordinate Readout */}
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedObjectId && (
            <div className="flex items-center gap-1 mr-1">
              <button
                onClick={onDuplicateSelected}
                title="Seçili Düğümü Çoğalt (Ctrl+D)"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#202531] hover:bg-slate-700 text-slate-200 border border-[#2B3242]"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden 2xl:inline">Çoğalt</span>
              </button>
              <button
                onClick={onDeleteSelected}
                title="Seçili Düğümü Sil (Del)"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden 2xl:inline">Sil</span>
              </button>
            </div>
          )}

          <div className="text-[11px] font-mono tabular-nums text-slate-300 bg-[#11141A] px-2 py-1 rounded border border-[#2B3242]">
            X:{hoverWorldPos.x} · Y:{hoverWorldPos.y}
          </div>

          <div className="flex items-center bg-[#11141A] rounded border border-[#2B3242]">
            <button
              onClick={() =>
                setViewport((p) => ({
                  ...p,
                  zoom: Math.max(0.35, Number((p.zoom - 0.15).toFixed(2))),
                }))
              }
              className="p-1 text-slate-400 hover:text-white"
              title="Uzaklaştır"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-xs font-mono tabular-nums text-slate-200">
              {Math.round(viewport.zoom * 100)}%
            </span>
            <button
              onClick={() =>
                setViewport((p) => ({
                  ...p,
                  zoom: Math.min(2.8, Number((p.zoom + 0.15).toFixed(2))),
                }))
              }
              className="p-1 text-slate-400 hover:text-white"
              title="Yakınlaştır"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewport({ panX: 38, panY: 34, zoom: 0.88 })}
              className="p-1 text-slate-400 hover:text-white border-l border-[#2B3242]"
              title="Merkeze Hizala"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          </div>

          {onOpenWindowSizingModal && (
            <button
              onClick={onOpenWindowSizingModal}
              title="Pencere Boyutlarını Özelleştir"
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#478CBF]/20 hover:bg-[#478CBF]/30 text-[#68B6FF] border border-[#478CBF]/40"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Boyutlar</span>
            </button>
          )}
        </div>
      </div>

      {/* Godot TileMapLayer Interactive Brush Palette OR Quick Node2D Spawn Bar */}
      {toolMode === 'tile_paint' || toolMode === 'tile_erase' ? (
        <div className="h-9 px-3 bg-[#151922] border-b border-[#2B3242] flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#68B6FF] flex items-center gap-1">
              <Paintbrush className="w-3.5 h-3.5" />
              TileMapLayer Fırçası ({scene.tilemapCells?.length || 0} Karo):
            </span>
            {TILE_BRUSH_PALETTE.map((meta) => {
              const isSelected = toolMode === 'tile_paint' && activeTileBrush === meta.kind;
              return (
                <button
                  key={meta.kind}
                  onClick={() => {
                    setActiveTileBrush(meta.kind);
                    onChangeToolMode('tile_paint');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-all shrink-0 ${
                    isSelected
                      ? 'bg-[#478CBF] text-white border-[#68B6FF] shadow-sm'
                      : 'bg-[#1D222D] text-slate-300 border-[#2B3242] hover:bg-[#262D3B]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-xs border border-white/30"
                    style={{ backgroundColor: meta.topColor }}
                  />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onChangeToolMode('tile_erase')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border ${
                toolMode === 'tile_erase'
                  ? 'bg-rose-600 text-white border-rose-400'
                  : 'bg-[#1D222D] text-slate-300 border-[#2B3242]'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Silgi</span>
            </button>
            {(scene.tilemapCells?.length || 0) > 0 && onUpdateTileMapCells && (
              <button
                onClick={() => onUpdateTileMapCells([], 'Tüm Karolar Temizlendi')}
                className="px-2 py-1 rounded text-[11px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
              >
                Tümünü Temizle
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="h-9 px-3 bg-[#151922] border-b border-[#2B3242] flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
            Node2D Ekle:
          </span>
          {quickRoles.map((item) => (
            <button
              key={item.role}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/kareforge-object-role', item.role);
              }}
              onClick={() => {
                const spawnX = snapValueToGrid(256, scene.gridSize, scene.snapToGrid);
                const spawnY = snapValueToGrid(224, scene.gridSize, scene.snapToGrid);
                onAddObjectRole(item.role, spawnX, spawnY);
              }}
              title={`${item.label} (${item.nodeTag})`}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-[#1D222D] hover:bg-[#262D3B] text-slate-200 border border-[#2B3242] transition-all shrink-0 cursor-grab active:cursor-grabbing"
            >
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
              <Plus className="w-3 h-3 text-slate-400" />
            </button>
          ))}
        </div>
      )}

      {/* Interactive Canvas Viewport */}
      <div
        ref={containerRef}
        onContextMenu={(e) => e.preventDefault()}
        className="relative flex-1 w-full h-full overflow-hidden"
        style={{
          cursor:
            dragState?.kind === 'pan' || toolMode === 'hand' || isSpacePressed
              ? 'grabbing'
              : toolMode === 'tile_paint' || toolMode === 'tile_erase'
              ? 'crosshair'
              : toolMode === 'move'
              ? 'move'
              : 'default',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="block w-full h-full"
        />

        <div className="pointer-events-none absolute bottom-3 left-7 flex items-center gap-2 bg-[#181C24]/95 backdrop-blur-md px-3 py-1.5 rounded-md border border-[#2B3242] text-[11px] text-slate-400">
          <span>
            Sahne: <strong className="text-slate-200">{scene.name}</strong> (
            {scene.camera.boundsWidth}×{scene.camera.boundsHeight}px)
          </span>
          <span>·</span>
          <span>
            Düğüm: <strong className="text-[#68B6FF] tabular-nums">{scene.objects.length}</strong>
          </span>
          <span>·</span>
          <span>
            TileMap: <strong className="text-emerald-400 tabular-nums">{scene.tilemapCells?.length || 0}</strong> karo
          </span>
        </div>
      </div>
    </div>
  );
};
