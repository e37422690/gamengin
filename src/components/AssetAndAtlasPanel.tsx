import React, { useState } from 'react';
import { GameAsset, GameProject } from '../types/engine';
import { getUnusedAssets } from '../engine/diagnostics';
import { sanitizeSvgContent } from '../engine/storageSystem';
import { audioSystem } from '../engine/audioSystem';
import {
  Upload,
  Trash2,
  Grid,
  Volume2,
  Sparkles,
  CheckCircle2,
  FileImage,
  GripVertical,
  Paintbrush,
  Eraser,
  FlipHorizontal,
  RotateCcw,
  Save,
  Undo2,
  Redo2,
} from 'lucide-react';

interface AssetAndAtlasPanelProps {
  project: GameProject;
  onAddAsset: (asset: GameAsset, binary?: ArrayBuffer) => void;
  onDeleteAsset: (assetId: string) => void;
  onCleanupUnusedAssets: () => void;
  onAssignAssetToSelectedObject?: (assetId: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const PIXEL_PALETTE = [
  '#38BDF8',
  '#478CBF',
  '#6366F1',
  '#A855F7',
  '#EC4899',
  '#EF4444',
  '#F97316',
  '#FACC15',
  '#4ADE80',
  '#10B981',
  '#F8FAFC',
  '#94A3B8',
  '#475569',
  '#1E293B',
  '#78350F',
  '#0F172A',
];

function createInitialPixelGrid(): string[][] {
  const grid: string[][] = Array.from({ length: 16 }, () => Array(16).fill(''));
  // Draw a default emerald sword/gem icon on the 16x16 grid
  const coords: [number, number, string][] = [
    [7, 2, '#38BDF8'],
    [8, 2, '#38BDF8'],
    [6, 3, '#38BDF8'],
    [7, 3, '#F8FAFC'],
    [8, 3, '#F8FAFC'],
    [9, 3, '#38BDF8'],
    [6, 4, '#38BDF8'],
    [7, 4, '#68B6FF'],
    [8, 4, '#68B6FF'],
    [9, 4, '#38BDF8'],
    [7, 5, '#68B6FF'],
    [8, 5, '#68B6FF'],
    [7, 6, '#68B6FF'],
    [8, 6, '#68B6FF'],
    [7, 7, '#68B6FF'],
    [8, 7, '#68B6FF'],
    [7, 8, '#68B6FF'],
    [8, 8, '#68B6FF'],
    [4, 9, '#FACC15'],
    [5, 9, '#FACC15'],
    [6, 9, '#FACC15'],
    [7, 9, '#F97316'],
    [8, 9, '#F97316'],
    [9, 9, '#FACC15'],
    [10, 9, '#FACC15'],
    [11, 9, '#FACC15'],
    [7, 10, '#78350F'],
    [8, 10, '#78350F'],
    [7, 11, '#78350F'],
    [8, 11, '#78350F'],
    [6, 12, '#FACC15'],
    [7, 12, '#FACC15'],
    [8, 12, '#FACC15'],
    [9, 12, '#FACC15'],
  ];
  for (const [x, y, c] of coords) {
    if (grid[y] && grid[y][x] !== undefined) grid[y][x] = c;
  }
  return grid;
}

export const AssetAndAtlasPanel: React.FC<AssetAndAtlasPanelProps> = ({
  project,
  onAddAsset,
  onDeleteAsset,
  onCleanupUnusedAssets,
  onAssignAssetToSelectedObject,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    project.assets[0]?.id || null
  );
  const [rightMode, setRightMode] = useState<'pixel_studio' | 'atlas_slicer'>('pixel_studio');
  const [atlasCols, setAtlasCols] = useState(4);
  const [atlasRows, setAtlasRows] = useState(2);
  const [animFps, setAnimFps] = useState(8);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [rightInspectorWidth, setRightInspectorWidth] = useState(430);

  // 16x16 Pixel Art Studio State + Dedicated Pixel Undo/Redo Stack
  const [pixelGrid, setPixelGrid] = useState<string[][]>(() => createInitialPixelGrid());
  const [pixelUndoStack, setPixelUndoStack] = useState<string[][][]>([]);
  const [pixelRedoStack, setPixelRedoStack] = useState<string[][][]>([]);
  const [pixelColor, setPixelColor] = useState<string>('#38BDF8');
  const [pixelTool, setPixelTool] = useState<'pen' | 'eraser'>('pen');
  const [mirrorX, setMirrorX] = useState<boolean>(true);
  const [spriteName, setSpriteName] = useState<string>('Kristal_Kılıç_16x16.svg');
  const [isDrawingPixel, setIsDrawingPixel] = useState<boolean>(false);

  const unusedAssetIds = getUnusedAssets(project);
  const selectedAsset = project.assets.find((a) => a.id === selectedAssetId) || null;

  const pushPixelSnapshot = () => {
    setPixelUndoStack((prev) => [...prev.slice(-39), pixelGrid.map((r) => [...r])]);
    setPixelRedoStack([]);
  };

  const handlePixelUndo = () => {
    if (pixelUndoStack.length === 0) return;
    const previous = pixelUndoStack[pixelUndoStack.length - 1];
    setPixelRedoStack((prev) => [...prev, pixelGrid.map((r) => [...r])]);
    setPixelUndoStack((prev) => prev.slice(0, -1));
    setPixelGrid(previous.map((r) => [...r]));
  };

  const handlePixelRedo = () => {
    if (pixelRedoStack.length === 0) return;
    const next = pixelRedoStack[pixelRedoStack.length - 1];
    setPixelUndoStack((prev) => [...prev, pixelGrid.map((r) => [...r])]);
    setPixelRedoStack((prev) => prev.slice(0, -1));
    setPixelGrid(next.map((r) => [...r]));
  };

  const paintPixelCell = (row: number, col: number) => {
    setPixelGrid((prev) => {
      const next = prev.map((r) => [...r]);
      const val = pixelTool === 'eraser' ? '' : pixelColor;
      next[row][col] = val;
      if (mirrorX) {
        const mirrorCol = 15 - col;
        next[row][mirrorCol] = val;
      }
      return next;
    });
  };

  const handleSavePixelArtAsAsset = () => {
    const rects: string[] = [];
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        const color = pixelGrid[r][c];
        if (color) {
          rects.push(
            `<rect x="${c * 4}" y="${r * 4}" width="4" height="4" fill="${color}" />`
          );
        }
      }
    }
    const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges">${rects.join('')}</svg>`;
    const cleanSvg = sanitizeSvgContent(rawSvg);
    const previewDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
    const encoded = new TextEncoder().encode(cleanSvg).buffer;

    const cleanName = spriteName.trim() || `Piksel_Sprite_${Date.now()}.svg`;
    const newAsset: GameAsset = {
      id: `asset_px_${Date.now()}`,
      name: cleanName.endsWith('.svg') ? cleanName : `${cleanName}.svg`,
      kind: 'image',
      mimeType: 'image/svg+xml',
      sizeBytes: encoded.byteLength,
      folder: 'Piksel_Stüdyo',
      tags: ['piksel', '16x16', 'özel'],
      createdAt: new Date().toISOString(),
      width: 64,
      height: 64,
      previewDataUrl,
      builtinSvg: cleanSvg,
    };

    onAddAsset(newAsset, encoded);
    setSelectedAssetId(newAsset.id);
    if (onAssignAssetToSelectedObject) {
      onAssignAssetToSelectedObject(newAsset.id);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const buffer = await file.arrayBuffer();
      let previewDataUrl = '';

      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const rawText = new TextDecoder().decode(buffer);
        const cleanSvg = sanitizeSvgContent(rawText);
        previewDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
      } else {
        const blob = new Blob([buffer], { type: file.type || 'application/octet-stream' });
        previewDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(blob);
        });
      }

      const isAudio = file.type.startsWith('audio/');
      const newAsset: GameAsset = {
        id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        kind: isAudio ? 'audio' : 'image',
        mimeType: file.type || 'image/png',
        sizeBytes: file.size,
        folder: isAudio ? 'Sesler' : 'Görseller',
        tags: ['yüklenen'],
        createdAt: new Date().toISOString(),
        width: 64,
        height: 64,
        previewDataUrl,
      };
      onAddAsset(newAsset, buffer);
      setSelectedAssetId(newAsset.id);
    }
    e.target.value = '';
  };

  const handleGenerateProceduralSprite = (preset: 'hero' | 'coin' | 'slime' | 'tileset') => {
    const svgMap: Record<typeof preset, { name: string; svg: string }> = {
      hero: {
        name: 'Kahraman_Şövalye.svg',
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="12" fill="#478CBF"/><rect x="16" y="20" width="10" height="10" rx="2" fill="#F8FAFC"/><rect x="38" y="20" width="10" height="10" rx="2" fill="#F8FAFC"/><rect x="22" y="42" width="20" height="4" rx="2" fill="#E0E7FF"/></svg>`,
      },
      coin: {
        name: 'Altın_Kristal.svg',
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#F59E0B" stroke="#FDE68A" stroke-width="4"/><polygon points="32,14 42,32 32,50 22,32" fill="#FEF3C7"/></svg>`,
      },
      slime: {
        name: 'Siber_Düşman.svg',
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M10 48 C10 20 54 20 54 48 Z" fill="#EF4444"/><circle cx="24" cy="36" r="4" fill="#FEF2F2"/><circle cx="40" cy="36" r="4" fill="#FEF2F2"/></svg>`,
      },
      tileset: {
        name: 'Platform_Atlas_4x2.svg',
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64"><rect width="128" height="64" fill="#1E293B"/><rect x="0" y="0" width="128" height="8" fill="#478CBF"/><line x1="32" y1="0" x2="32" y2="64" stroke="#334155"/><line x1="64" y1="0" x2="64" y2="64" stroke="#334155"/><line x1="96" y1="0" x2="96" y2="64" stroke="#334155"/></svg>`,
      },
    };

    const chosen = svgMap[preset];
    const cleanSvg = sanitizeSvgContent(chosen.svg);
    const previewDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
    const encoded = new TextEncoder().encode(cleanSvg).buffer;

    const asset: GameAsset = {
      id: `asset_${Date.now()}`,
      name: chosen.name,
      kind: preset === 'tileset' ? 'atlas' : 'image',
      mimeType: 'image/svg+xml',
      sizeBytes: encoded.byteLength,
      folder: 'Vektör',
      tags: ['vektör', preset],
      createdAt: new Date().toISOString(),
      width: preset === 'tileset' ? 128 : 64,
      height: 64,
      previewDataUrl,
      builtinSvg: cleanSvg,
    };
    onAddAsset(asset, encoded);
    setSelectedAssetId(asset.id);
  };

  return (
    <div
      onMouseUp={() => setIsDrawingPixel(false)}
      className="flex h-full w-full bg-[#11141A] text-slate-100 overflow-hidden select-none"
    >
      {/* Left res:// Asset Library */}
      <div className="flex-1 flex flex-col border-r border-[#2B3242] overflow-hidden">
        <div className="p-4 bg-[#181C24] border-b border-[#2B3242] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              KareForge <code className="text-[#68B6FF] font-mono">res://</code> Varlık Havuzu &amp; Piksel Stüdyosu
            </h2>
            <p className="text-xs text-slate-400">
              IndexedDB ikili (ArrayBuffer) depolama, SVG XSS sanitizasyonu ve dahili 16×16 Sprite çizim aracı.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onUndo && (
              <div className="flex items-center gap-1 bg-[#11141A] p-0.5 rounded-lg border border-[#2B3242]">
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="Proje / Varlık İşlemini Geri Al (Ctrl+Z)"
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Geri Al</span>
                </button>
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="Proje / Varlık İşlemini İleri Al (Ctrl+Y)"
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  <span>İleri Al</span>
                </button>
              </div>
            )}

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#478CBF] hover:bg-[#3A78A6] text-white text-xs font-semibold cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Dosya Yükle (PNG/SVG/Ses)</span>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/svg+xml,audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {unusedAssetIds.length > 0 && (
              <button
                onClick={onCleanupUnusedAssets}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 text-xs font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kullanılmayanları Temizle ({unusedAssetIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Built-in Procedural Vector & Sound Generators */}
        <div className="px-4 py-2.5 bg-[#151922] border-b border-[#2B3242] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#68B6FF]" />
              Hazır Vektör Üret:
            </span>
            {[
              { id: 'hero', label: '+ Kahraman Sprite' },
              { id: 'coin', label: '+ Kristal Ödül' },
              { id: 'slime', label: '+ Siber Düşman' },
              { id: 'tileset', label: '+ 4x2 Platform Atlası' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => handleGenerateProceduralSprite(btn.id as any)}
                className="px-2.5 py-1 rounded bg-[#202531] hover:bg-[#2A3142] text-xs text-slate-200 border border-[#2B3242]"
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1">SFX Sentezleyici:</span>
            {(['jump', 'coin', 'hit', 'victory', 'laser'] as const).map((snd) => (
              <button
                key={snd}
                onClick={() => audioSystem.playPreset(snd)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#202531] hover:bg-[#478CBF] text-[11px] text-slate-200 transition-colors border border-[#2B3242]"
              >
                <Volume2 className="w-3 h-3" />
                <span>{snd}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Asset Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {project.assets.map((asset) => {
              const isSelected = asset.id === selectedAssetId;
              return (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={`group rounded-xl p-3 border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#478CBF]/20 border-[#68B6FF]'
                      : 'bg-[#181C24] border-[#2B3242] hover:border-slate-600'
                  }`}
                >
                  <div className="h-24 rounded-lg bg-[#11141A] border border-[#2B3242] flex items-center justify-center overflow-hidden mb-2">
                    {asset.previewDataUrl ? (
                      <img
                        src={asset.previewDataUrl}
                        alt={asset.name}
                        className="max-h-20 max-w-20 object-contain"
                      />
                    ) : asset.kind === 'audio' ? (
                      <Volume2 className="w-8 h-8 text-[#68B6FF]" />
                    ) : (
                      <FileImage className="w-8 h-8 text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      res://{asset.folder}/{asset.name}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                      <span>{(asset.sizeBytes / 1024).toFixed(1)} KB</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAsset(asset.id);
                        }}
                        className="text-slate-500 hover:text-rose-400"
                        title="Varlığı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drag Handle for Right Studio Dock */}
      <div
        onMouseDown={(e) => {
          const startX = e.clientX;
          const startW = rightInspectorWidth;
          const move = (ev: MouseEvent) => {
            setRightInspectorWidth(Math.min(640, Math.max(340, startW - (ev.clientX - startX))));
          };
          const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        }}
        title="Sağ Stüdyo Genişliğini Sürükleyerek Ayarla"
        className="w-2 bg-[#11141A] hover:bg-[#478CBF] cursor-col-resize flex items-center justify-center shrink-0"
      >
        <GripVertical className="w-3 h-4 text-slate-600" />
      </div>

      {/* Right Studio Dock: 16x16 Pixel Art Studio & Sprite Atlas Slicer */}
      <div
        style={{ width: `${rightInspectorWidth}px` }}
        className="bg-[#181C24] flex flex-col shrink-0 overflow-y-auto"
      >
        {/* Tab Switcher */}
        <div className="p-2.5 border-b border-[#2B3242] flex items-center gap-1.5 bg-[#151922]">
          <button
            onClick={() => setRightMode('pixel_studio')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
              rightMode === 'pixel_studio'
                ? 'bg-[#478CBF] text-white'
                : 'text-slate-400 hover:text-slate-200 bg-[#181C24]'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>16×16 Piksel Çizim Stüdyosu</span>
          </button>
          <button
            onClick={() => setRightMode('atlas_slicer')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
              rightMode === 'atlas_slicer'
                ? 'bg-[#478CBF] text-white'
                : 'text-slate-400 hover:text-slate-200 bg-[#181C24]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Sprite Atlas Dilimleyici</span>
          </button>
        </div>

        {rightMode === 'pixel_studio' ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={spriteName}
                onChange={(e) => setSpriteName(e.target.value)}
                aria-label="Piksel Sprite Dosya Adı"
                className="flex-1 bg-[#11141A] border border-[#2B3242] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
              />
              <button
                onClick={handleSavePixelArtAsAsset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shrink-0 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>res:// Kaydet</span>
              </button>
            </div>

            {/* Tool Bar: Pen, Eraser, Pixel Undo/Redo, Mirror X, Clear */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#11141A] p-1.5 rounded-lg border border-[#2B3242]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPixelTool('pen')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                    pixelTool === 'pen'
                      ? 'bg-[#478CBF] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span>Kalem</span>
                </button>
                <button
                  onClick={() => setPixelTool('eraser')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                    pixelTool === 'eraser'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Silgi</span>
                </button>
                <button
                  onClick={handlePixelUndo}
                  disabled={pixelUndoStack.length === 0}
                  title="Piksel Çizim Adımını Geri Al"
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-[#181C24] text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35 border border-[#2B3242]"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Çizimi Geri Al ({pixelUndoStack.length})</span>
                </button>
                <button
                  onClick={handlePixelRedo}
                  disabled={pixelRedoStack.length === 0}
                  title="Piksel Çizim Adımını İleri Al"
                  className="flex items-center gap-1 px-1.5 py-1 rounded text-xs font-bold bg-[#181C24] text-slate-200 hover:bg-[#478CBF] hover:text-white disabled:opacity-35 border border-[#2B3242]"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMirrorX((v) => !v)}
                  title="Yatay Simetri Aynalama (Mirror X)"
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${
                    mirrorX
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Simetri X</span>
                </button>
                <button
                  onClick={() => {
                    pushPixelSnapshot();
                    setPixelGrid(Array.from({ length: 16 }, () => Array(16).fill('')));
                  }}
                  title="Tuvali Temizle (Geri Alınabilir)"
                  className="p-1 text-slate-400 hover:text-rose-400"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Interactive 16x16 Pixel Grid */}
            <div className="flex flex-col items-center bg-[#11141A] p-3 rounded-xl border border-[#2B3242]">
              <div
                className="grid border border-slate-700/80 bg-[#0B0E14]"
                style={{
                  gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
                  width: '256px',
                  height: '256px',
                }}
              >
                {pixelGrid.map((rowArr, rIdx) =>
                  rowArr.map((cellColor, cIdx) => (
                    <div
                      key={`${rIdx}_${cIdx}`}
                      onMouseDown={() => {
                        pushPixelSnapshot();
                        setIsDrawingPixel(true);
                        paintPixelCell(rIdx, cIdx);
                      }}
                      onMouseEnter={() => {
                        if (isDrawingPixel) paintPixelCell(rIdx, cIdx);
                      }}
                      style={{
                        backgroundColor:
                          cellColor ||
                          ((rIdx + cIdx) % 2 === 0 ? '#141822' : '#1A202C'),
                      }}
                      className="w-4 h-4 border-[0.5px] border-white/5 cursor-crosshair"
                    />
                  ))
                )}
              </div>
              <span className="text-[11px] text-slate-400 mt-2">
                Fareyle tıklayıp sürükleyerek 16×16 piksel sprite çizin
              </span>
            </div>

            {/* Color Palette Swatches */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Piksel Renk Paleti (16 Renk)
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {PIXEL_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => {
                      setPixelColor(hex);
                      setPixelTool('pen');
                    }}
                    style={{ backgroundColor: hex }}
                    className={`h-6 rounded border transition-transform ${
                      pixelColor === hex && pixelTool === 'pen'
                        ? 'scale-110 border-white ring-2 ring-[#68B6FF]'
                        : 'border-black/40 hover:scale-105'
                    }`}
                    title={hex}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {selectedAsset ? (
              <>
                <div className="p-3 rounded-lg bg-[#11141A] border border-[#2B3242]">
                  <div className="text-xs font-semibold text-white mb-1">
                    res://{selectedAsset.folder}/{selectedAsset.name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Tür: {selectedAsset.mimeType}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Yatay Kare (Hframes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={atlasCols}
                      onChange={(e) => setAtlasCols(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Dikey Kare (Vframes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={atlasRows}
                      onChange={(e) => setAtlasRows(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-[#11141A] border border-[#2B3242] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    AnimationPlayer Hızı ({animFps} FPS)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={24}
                    value={animFps}
                    onChange={(e) => setAnimFps(Number(e.target.value))}
                    className="w-full accent-[#478CBF]"
                  />
                </div>

                <div className="p-3 rounded-xl bg-[#11141A] border border-[#2B3242]">
                  <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
                    <span>Dilimlenen Kareler ({atlasCols * atlasRows} Kare)</span>
                    <span className="font-mono text-[#68B6FF]">
                      Aktif Kare: #{previewFrame + 1}
                    </span>
                  </div>
                  <div
                    className="grid gap-1.5"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(atlasCols, 6)}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: atlasCols * atlasRows }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPreviewFrame(idx)}
                        className={`h-12 rounded border flex flex-col items-center justify-center text-[10px] font-mono transition-colors ${
                          previewFrame === idx
                            ? 'bg-[#478CBF]/30 border-[#68B6FF] text-white'
                            : 'bg-[#181C24] border-[#2B3242] text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <span>Kare {idx + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Sprite kareleri sahnedeki düğümlerin <strong>AnimatedSprite2D</strong> bileşenine otomatik bağlanır.
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 py-8 text-center">
                Dilimleme ve animasyon ayarlarını düzenlemek için soldan bir varlık seçin.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
