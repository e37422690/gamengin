import React, { useEffect, useRef, useState } from 'react';
import { GameProject } from '../types/engine';
import { GameRuntimeEngine, RuntimeSnapshot } from '../engine/gameRuntime';
import {
  drawGameObjectOnCanvas,
  drawTileMapCellsOnCanvas,
} from '../engine/sharedRenderer';
import { exportSingleHtml } from '../engine/exportSystem';
import { audioSystem } from '../engine/audioSystem';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Trophy,
  Heart,
  Sparkles,
  CheckCircle2,
  Circle,
  Gamepad2,
  MonitorCheck,
  SlidersHorizontal,
} from 'lucide-react';

interface GamePreviewRuntimeProps {
  project: GameProject;
  initialSceneId: string;
  onExitPreview: () => void;
  previewScale: number;
  onUpdatePreviewScale: (scale: number) => void;
}

export const GamePreviewRuntime: React.FC<GamePreviewRuntimeProps> = ({
  project,
  initialSceneId,
  onExitPreview,
  previewScale,
  onUpdatePreviewScale,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameRuntimeEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [muted, setMuted] = useState(audioSystem.isMuted());
  const [parityMode, setParityMode] = useState<'engine' | 'exportedHtml'>('engine');
  const [exportedHtmlBlobUrl, setExportedHtmlBlobUrl] = useState<string | null>(null);

  // Build live exported HTML blob URL when user switches to parity verification mode
  useEffect(() => {
    if (parityMode !== 'exportedHtml') {
      if (exportedHtmlBlobUrl) {
        URL.revokeObjectURL(exportedHtmlBlobUrl);
        setExportedHtmlBlobUrl(null);
      }
      return;
    }
    const { htmlContent } = exportSingleHtml(project);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setExportedHtmlBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [parityMode, project]);

  // Initialize runtime engine and 60 FPS loop
  useEffect(() => {
    if (parityMode === 'exportedHtml') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const engine = new GameRuntimeEngine(project, initialSceneId);
    engineRef.current = engine;
    setSnapshot(engine.getSnapshot());

    let lastTime = performance.now();
    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const snap = engine.step(dt);
      setSnapshot({ ...snap });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      engine.clearInputs();
    };
  }, [project, initialSceneId, parityMode]);

  // Keyboard bindings for active gameplay
  useEffect(() => {
    if (parityMode === 'exportedHtml') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        const eng = engineRef.current;
        if (!eng) return;
        const curr = eng.getSnapshot();
        eng.setPaused(curr.status === 'playing');
        setSnapshot({ ...eng.getSnapshot() });
        return;
      }
      if (e.code === 'KeyR') {
        engineRef.current?.restartCurrentScene();
        return;
      }
      engineRef.current?.pressKey(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      engineRef.current?.releaseKey(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [parityMode]);

  // Render current snapshot onto canvas using sharedRenderer (100% identical to SceneCanvas and Exported HTML)
  useEffect(() => {
    if (!snapshot || parityMode === 'exportedHtml') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentScene =
      project.scenes.find((s) => s.id === snapshot.sceneId) || project.scenes[0];
    if (!currentScene) return;

    canvas.width = project.settings.resolutionWidth || 960;
    canvas.height = project.settings.resolutionHeight || 540;

    ctx.fillStyle = currentScene.backgroundColor || '#0F172A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-snapshot.cameraX, -snapshot.cameraY);

    // Subtle atmospheric grid reference (identical to buildFullParityStandaloneRuntimeScript)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = 0; gx <= 1200; gx += 48) {
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, 720);
    }
    for (let gy = 0; gy <= 720; gy += 48) {
      ctx.moveTo(0, gy);
      ctx.lineTo(1200, gy);
    }
    ctx.stroke();

    drawTileMapCellsOnCanvas(ctx, currentScene.tilemapCells, currentScene.gridSize);

    for (const obj of snapshot.objects) {
      if (!obj.visible) continue;
      const bobY =
        obj.activeAnimation === 'move' && Math.abs(obj.physics.velocityX) > 5
          ? obj.animFrameIndex === 1
            ? -3
            : 0
          : 0;
      drawGameObjectOnCanvas(ctx, obj, false, false, bobY);
    }

    for (const ft of snapshot.floatingTexts || []) {
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.fillStyle = ft.color || '#FBBF24';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }

    ctx.restore();
  }, [snapshot, project, parityMode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const eng = engineRef.current;
    if (!canvas || !eng || !snapshot) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const worldX = (e.clientX - rect.left) * scaleX + snapshot.cameraX;
    const worldY = (e.clientY - rect.top) * scaleY + snapshot.cameraY;
    eng.clickAtWorld(worldX, worldY);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioSystem.setMuted(next);
  };

  const heartSlots = 5;
  const filledHearts = snapshot
    ? Math.max(0, Math.min(heartSlots, Math.ceil((snapshot.hp / Math.max(1, snapshot.maxHp)) * heartSlots)))
    : 5;

  const maxW = Math.round(960 * previewScale);

  return (
    <div className="flex flex-col h-full w-full bg-[#070A12] text-slate-100 select-none overflow-hidden">
      {/* Runtime Control Header + Viewport Size + Export Parity Switcher */}
      <div className="h-12 px-4 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          {/* Mode Switcher: Engine vs Actual Standalone Exported HTML */}
          <div className="flex items-center bg-[#0B0F19] p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setParityMode('engine')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                parityMode === 'engine'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Motor İçi Çalışma Zamanı</span>
            </button>
            <button
              onClick={() => setParityMode('exportedHtml')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                parityMode === 'exportedHtml'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Dışa aktarılan tek dosya HTML çıktısını birebir aynı pencerede canlı test edin"
            >
              <MonitorCheck className="w-3.5 h-3.5" />
              <span>Dışa Aktarılan HTML Çıktısı (1:1 Eşitlik Testi)</span>
            </button>
          </div>

          {parityMode === 'engine' && (
            <>
              <div className="h-4 w-px bg-slate-800" />
              {snapshot?.status === 'playing' ? (
                <button
                  onClick={() => engineRef.current?.setPaused(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Duraklat (P)</span>
                </button>
              ) : (
                <button
                  onClick={() => engineRef.current?.setPaused(false)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Devam Et</span>
                </button>
              )}

              <button
                onClick={() => engineRef.current?.restartCurrentScene()}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Yeniden Başlat (R)</span>
              </button>

              <button
                onClick={toggleMute}
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                title={muted ? 'Sesi Aç' : 'Sesi Kapat'}
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </>
          )}
        </div>

        {/* Viewport Dimension Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0B0F19] px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 mr-1" />
            <span className="text-slate-400">Oyun Penceresi:</span>
            {[
              { label: 'Küçük', scale: 0.8 },
              { label: 'Standart', scale: 1.0 },
              { label: 'Geniş', scale: 1.25 },
              { label: 'Tam Alan', scale: 1.5 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => onUpdatePreviewScale(p.scale)}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  Math.abs(previewScale - p.scale) < 0.05
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {parityMode === 'engine' && (
            <span className="text-xs font-mono tabular-nums text-slate-400 bg-[#0B0F19] px-2.5 py-1 rounded border border-slate-800">
              {snapshot?.fps ?? 60} FPS · {snapshot?.elapsedSec ?? 0}s
            </span>
          )}

          <button
            onClick={onExitPreview}
            className="px-3 py-1 rounded-md text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"
          >
            Editöre Dön
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      {parityMode === 'exportedHtml' && exportedHtmlBlobUrl ? (
        <div className="flex-1 w-full h-full bg-[#050811] flex flex-col">
          <div className="px-4 py-1.5 bg-emerald-950/50 border-b border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between">
            <span>
              <strong>Canlı Bağımsız HTML Çıktısı:</strong> Aşağıdaki oyun doğrudan{' '}
              <code>exportSingleHtml()</code> tarafından üretilen tek dosyalık HTML kodunun içinde çalışmaktadır.
            </span>
            <span className="font-mono text-[11px] text-emerald-300">
              100% Görsel & Fizik Eşitliği
            </span>
          </div>
          <iframe
            src={exportedHtmlBlobUrl}
            title="Exported HTML Parity Preview"
            className="flex-1 w-full h-full border-0"
          />
        </div>
      ) : (
        <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
          <div
            style={{ maxWidth: `${maxW}px` }}
            className="relative w-full aspect-video flex items-center justify-center rounded-xl overflow-hidden border border-slate-800/90 shadow-2xl bg-[#0F172A]"
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-full block cursor-pointer"
            />

            {/* Translucent Floating HUD Overlay */}
            {snapshot && (
              <div className="pointer-events-none absolute inset-0 p-4 flex flex-col justify-between">
                {/* Top HUD Row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-2.5 flex items-center gap-4 shadow-lg">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        CAN ({snapshot.hp}/{snapshot.maxHp})
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: heartSlots }).map((_, idx) => (
                          <Heart
                            key={idx}
                            className={`w-4 h-4 ${
                              idx < filledHearts
                                ? 'text-rose-500 fill-rose-500'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="h-6 w-px bg-slate-800" />

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        PUAN
                      </div>
                      <div className="text-xl font-extrabold font-mono tabular-nums text-amber-400">
                        {snapshot.score}
                      </div>
                    </div>

                    {snapshot.inventory.length > 0 && (
                      <>
                        <div className="h-6 w-px bg-slate-800" />
                        <div className="flex items-center gap-1.5 text-xs">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-cyan-300 font-medium">
                            Çanta: {snapshot.inventory.join(', ')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Active Quest Tracker */}
                  {snapshot.quests.length > 0 && (
                    <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-2.5 max-w-xs shadow-lg">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                        Aktif Görevler
                      </div>
                      <div className="space-y-1">
                        {snapshot.quests.map((q) => (
                          <div key={q.id} className="flex items-center gap-1.5 text-xs">
                            {q.status === 'completed' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <span
                              className={
                                q.status === 'completed'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-200 font-medium'
                              }
                            >
                              {q.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Dialogue Modal & Touch D-Pad + Banner */}
                <div className="flex flex-col gap-2">
                  {snapshot.activeDialogue && (
                    <div className="pointer-events-auto w-full max-w-xl mx-auto bg-slate-950/95 backdrop-blur-md border border-indigo-500/40 rounded-xl p-4 shadow-2xl">
                      <div className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-1">
                        {snapshot.activeDialogue.speaker}
                      </div>
                      <p className="text-sm text-slate-100 leading-relaxed mb-3">
                        {snapshot.activeDialogue.text}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {snapshot.activeDialogue.choices.map((ch) => (
                          <button
                            key={ch.id}
                            onClick={() => engineRef.current?.chooseDialogueOption(ch.id)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                          >
                            {ch.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-end justify-between gap-4 w-full">
                    <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-800">
                      {[
                        { label: '◀', code: 'ArrowLeft' },
                        { label: '▲', code: 'ArrowUp' },
                        { label: '▼', code: 'ArrowDown' },
                        { label: '▶', code: 'ArrowRight' },
                      ].map((btn) => (
                        <button
                          key={btn.code}
                          onMouseDown={() => engineRef.current?.pressKey(btn.code)}
                          onMouseUp={() => engineRef.current?.releaseKey(btn.code)}
                          onMouseLeave={() => engineRef.current?.releaseKey(btn.code)}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-indigo-600 text-xs font-bold text-white flex items-center justify-center"
                        >
                          {btn.label}
                        </button>
                      ))}
                      <button
                        onMouseDown={() => engineRef.current?.pressKey('Space')}
                        onMouseUp={() => engineRef.current?.releaseKey('Space')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                      >
                        ZIPLA
                      </button>
                      <button
                        onMouseDown={() => engineRef.current?.pressKey('KeyE')}
                        onMouseUp={() => engineRef.current?.releaseKey('KeyE')}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white"
                        title="Lazer Mermisi Ateşle (E veya F)"
                      >
                        ⚡ LAZER [E/F]
                      </button>
                      <button
                        onMouseDown={() => engineRef.current?.pressKey('ShiftLeft')}
                        onMouseUp={() => engineRef.current?.releaseKey('ShiftLeft')}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white"
                        title="Hızlı İleri Atılma (Shift)"
                      >
                        💨 DASH [Shift]
                      </button>
                    </div>

                    <div className="bg-slate-950/85 border border-slate-800 px-3.5 py-2 rounded-xl text-xs text-slate-200 max-w-md">
                      {snapshot.bannerMessage ||
                        'Ok tuşları / WASD ile hareket, Space zıpla, E/F Lazer, Shift Dash!'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pause / Victory / Game Over Modal Overlay */}
            {snapshot && snapshot.status !== 'playing' && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6">
                <div className="max-w-sm w-full bg-[#0F172A] border border-slate-700 rounded-2xl p-6 text-center shadow-2xl">
                  <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-indigo-500/15 border border-indigo-500/30">
                    <Trophy className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {snapshot.status === 'victory'
                      ? 'Bölüm Tamamlandı!'
                      : snapshot.status === 'gameover'
                      ? 'Oyun Bitti!'
                      : 'Oyun Duraklatıldı'}
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    {snapshot.statusReason ||
                      'Oyuna devam edebilir veya sahneyi sıfırlayabilirsiniz.'}
                  </p>

                  <div className="grid grid-cols-3 gap-2 mb-5 font-mono">
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">PUAN</div>
                      <div className="text-sm font-bold text-amber-400">{snapshot.score}</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">CAN</div>
                      <div className="text-sm font-bold text-emerald-400">{snapshot.hp}</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">SÜRE</div>
                      <div className="text-sm font-bold text-slate-100">
                        {snapshot.elapsedSec}s
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    {snapshot.status === 'paused' && (
                      <button
                        onClick={() => engineRef.current?.setPaused(false)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                      >
                        Oyuna Devam Et
                      </button>
                    )}
                    <button
                      onClick={() => engineRef.current?.restartCurrentScene()}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      Tekrar Oyna
                    </button>
                    <button
                      onClick={onExitPreview}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      Editör
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
