import React, { useState, useEffect } from 'react';
import { GameProject, GameScene } from '../types/engine';
import { generateReadableCode } from '../engine/blockSystem';
import {
  Code2,
  BookOpen,
  Play,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  GripVertical,
  Lock,
  Unlock,
  RefreshCw,
  X,
  Maximize2,
} from 'lucide-react';

interface CodeAndDocsPanelProps {
  mode: 'code' | 'docs';
  project: GameProject;
  scene: GameScene;
  onSelectTemplate?: (templateId: string) => void;
  onUpdateSceneCustomCode?: (customCode: string, syncLocked: boolean) => void;
}

export const CodeAndDocsPanel: React.FC<CodeAndDocsPanelProps> = ({
  mode,
  scene,
  onSelectTemplate,
  onUpdateSceneCustomCode,
}) => {
  const generatedCode = generateReadableCode(scene);
  const [isSyncLocked, setIsSyncLocked] = useState<boolean>(
    scene.codeSyncLocked !== undefined ? scene.codeSyncLocked : true
  );
  const [editableCode, setEditableCode] = useState<string>(
    scene.customScriptCode || generatedCode
  );
  const [showSandboxPanel, setShowSandboxPanel] = useState<boolean>(true);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isSyncLocked) {
      setEditableCode(generatedCode);
    }
  }, [generatedCode, isSyncLocked]);

  const [customScript, setCustomScript] = useState<string>(
    `// KareForge 2D Güvenli Kum Havuzu (Sandbox) Betiği\n// Sahne nesnelerini matematiksel olarak sorgulayabilirsiniz:\nconst player = scene.objects.find(o => o.role === 'player');\nconst coinCount = scene.objects.filter(o => o.role === 'collectible').length;\nreturn {\n  sahneAdi: scene.name,\n  oyuncuKonumu: player ? { x: player.x, y: player.y } : null,\n  toplamOdulSayisi: coinCount,\n  karoSayisi: (scene.tilemapCells || []).length,\n  mesaj: "Betik başarıyla çalıştırıldı!"\n};`
  );
  const [sandboxOutput, setSandboxOutput] = useState<string>(
    'Kum havuzu çıktısı burada görüntülenecek...'
  );
  const [copied, setCopied] = useState(false);
  const [sandboxWidth, setSandboxWidth] = useState(460);

  const handleRunSandbox = () => {
    try {
      const safeSceneClone = JSON.parse(JSON.stringify(scene));
      const runner = new Function('scene', 'Math', `"use strict";\n${customScript}`);
      const result = runner(safeSceneClone, Math);
      setSandboxOutput(JSON.stringify(result, null, 2));
    } catch (err) {
      setSandboxOutput(
        `[Betik Hatası]: ${err instanceof Error ? err.message : 'Bilinmeyen sözdizimi hatası'}`
      );
    }
  };

  const handleToggleLock = () => {
    const next = !isSyncLocked;
    setIsSyncLocked(next);
    if (next) {
      setEditableCode(generatedCode);
    }
    if (onUpdateSceneCustomCode) {
      onUpdateSceneCustomCode(next ? generatedCode : editableCode, next);
    }
  };

  const handleSaveCustomCode = () => {
    if (onUpdateSceneCustomCode) {
      onUpdateSceneCustomCode(editableCode, false);
    }
    setSavedNotice('Özel sahne kodu kaydedildi!');
    setTimeout(() => setSavedNotice(null), 2200);
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(isSyncLocked ? generatedCode : editableCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (mode === 'docs') {
    return (
      <div className="h-full w-full bg-[#11141A] text-slate-100 overflow-y-auto p-6 select-none">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#1D283A] via-[#181C24] to-[#181C24] border border-[#478CBF]/40">
            <div className="flex items-center gap-2 text-[#68B6FF] text-xs font-bold uppercase tracking-wider mb-2">
              <BookOpen className="w-4 h-4" />
              <span>KareForge 2D — Web Tabanlı Bağımsız 2D Oyun Motoru Rehberi</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Tarayıcıda Sıfırdan 2D Oyun Tasarlayın, Kodlayın ve Tek Tıkla Dağıtın
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              KareForge 2D tek bir oyun değil; platformer, RPG, bulmaca, clicker ve interaktif hikâye oyunları üretebileceğiniz tam kapsamlı bir 2D oyun geliştirme motorudur. Sahne Ağacı (`Node2D`), `TileMapLayer` harita fırçası, 16×16 Piksel Çizim Stüdyosu, geniş 2 sütunlu Blok Programlama panosu, kilidi açılabilir TypeScript kod editörü ve %100 eşitlikli HTML/ZIP dışa aktarma sistemini içerir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '1. Sahne & TileMap Editörü',
                title: 'Node2D & Harita Boyama',
                desc: '2D Sahne sekmesinde üstteki araç çubuğundan Karo Fırçası (B) ile zemin/duvar/lav boyayın veya CharacterBody2D, Area2D, PointLight2D ve Trambolin düğümlerini sahneye ekleyin.',
              },
              {
                step: '2. Geniş Blok & Kod Stüdyosu',
                title: 'Görsel Blok veya Doğrudan Kod',
                desc: 'Script (Blok) sekmesinde 2 sütunlu geniş panoda olay-aksiyon zincirleri kurun. Dilerseniz "Salt Okunur Kapat (Düzenle)" düğmesiyle üretilen TypeScript kodunun kilidini açıp doğrudan düzenleyin.',
              },
              {
                step: '3. 1:1 HTML & ZIP Dağıtımı',
                title: 'Her Yerde Çalışan Çıktı',
                desc: 'Oyunu Çalıştır (F5) ile hem motor içinde hem de canlı üretilen bağımsız HTML içinde test edin. Dışa Aktar menüsünden tek dosya HTML veya ZIP paketi olarak indirin.',
              },
            ].map((card) => (
              <div
                key={card.step}
                className="p-5 rounded-xl bg-[#181C24] border border-[#2B3242] flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-mono font-bold text-[#68B6FF]">{card.step}</span>
                  <h3 className="text-base font-bold text-white mt-1 mb-2">{card.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {onSelectTemplate && (
            <div className="p-5 rounded-xl bg-[#181C24] border border-[#2B3242]">
              <h2 className="text-sm font-bold text-white mb-1">
                Yeni Oyun Projesi Başlat (6 Farklı Oyun Türü Şablonu)
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Aşağıdaki oyun motoru şablonlarından birini seçerek yeni bir oyun projesi başlatabilir ve tüm düğümlerini özelleştirebilirsiniz:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { id: 'platformer', name: '1. Platformer Oyunu', tag: 'Yerçekimi + Yay + TileMap' },
                  { id: 'topdown', name: '2. Üstten Görünüm RPG', tag: '4 Yön + NPC Diyalog + Görev' },
                  { id: 'puzzle', name: '3. Kristal Bulmaca', tag: 'Izgara + Sandık Mantığı' },
                  { id: 'clicker', name: '4. Kozmik Clicker', tag: 'Tıklama + Otomatik Üretim' },
                  { id: 'story', name: '5. İnteraktif Hikâye', tag: 'Dallanmalı Diyalog Ağacı' },
                  { id: 'empty', name: '6. Boş 2D Motor Projesi', tag: 'Sıfırdan Özel Oyun Kurulumu' },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => onSelectTemplate(tpl.id)}
                    className="p-3.5 rounded-xl bg-[#11141A] hover:bg-[#478CBF]/20 border border-[#2B3242] hover:border-[#68B6FF] text-left transition-all"
                  >
                    <div className="text-xs font-bold text-slate-100">{tpl.name}</div>
                    <div className="text-[11px] text-[#68B6FF] mt-0.5">{tpl.tag}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[#11141A] text-slate-100 overflow-hidden select-none">
      {/* Left: Unlockable & Editable Engine Code */}
      <div className="flex-1 flex flex-col border-r border-[#2B3242] overflow-hidden">
        <div className="p-3 bg-[#181C24] border-b border-[#2B3242] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#68B6FF]" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Sahne Oyun Kodu ({scene.name}.ts)
            </span>
            {savedNotice && (
              <span className="text-xs text-emerald-400 font-semibold ml-2">
                ✓ {savedNotice}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleLock}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                isSyncLocked
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                  : 'bg-emerald-600 text-white border-emerald-400'
              }`}
            >
              {isSyncLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Salt Okunur Senkronu Kapat (Kodu Düzenle)</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Manuel Kod Düzenleme: AÇIK</span>
                </>
              )}
            </button>

            {!isSyncLocked && (
              <>
                <button
                  onClick={() => setEditableCode(generatedCode)}
                  title="Bloklardan Kodu Yenile"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#202531] hover:bg-slate-700 text-xs text-slate-200 border border-[#2B3242]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Bloklardan Yenile</span>
                </button>
                <button
                  onClick={handleSaveCustomCode}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#478CBF] hover:bg-[#3A78A6] text-xs font-bold text-white"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Kodu Sahneye Kaydet</span>
                </button>
              </>
            )}

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#202531] hover:bg-slate-700 text-xs text-slate-200 border border-[#2B3242]"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
            </button>

            {!showSandboxPanel && (
              <button
                onClick={() => setShowSandboxPanel(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#202531] hover:bg-slate-700 text-xs text-[#68B6FF] border border-[#2B3242]"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Kum Havuzunu Aç</span>
              </button>
            )}
          </div>
        </div>

        {isSyncLocked ? (
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-300 bg-[#0B0E14] leading-relaxed">
            <pre className="whitespace-pre-wrap">{generatedCode}</pre>
          </div>
        ) : (
          <textarea
            value={editableCode}
            onChange={(e) => setEditableCode(e.target.value)}
            spellCheck={false}
            aria-label="Sahne TypeScript Kodu Editörü"
            className="flex-1 w-full h-full p-4 bg-[#0B0E14] font-mono text-xs text-emerald-300 leading-relaxed focus:outline-none resize-none"
          />
        )}
      </div>

      {/* Right: Collapsible Safe Sandboxed Script Runner */}
      {showSandboxPanel && (
        <>
          <div
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startW = sandboxWidth;
              const move = (ev: MouseEvent) => {
                setSandboxWidth(Math.min(720, Math.max(320, startW - (ev.clientX - startX))));
              };
              const up = () => {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
              };
              window.addEventListener('mousemove', move);
              window.addEventListener('mouseup', up);
            }}
            title="Kum Havuzu Genişliğini Sürükleyerek Ayarla"
            className="w-2 bg-[#11141A] hover:bg-[#478CBF] cursor-col-resize flex items-center justify-center shrink-0"
          >
            <GripVertical className="w-3 h-4 text-slate-600" />
          </div>

          <div
            style={{ width: `${sandboxWidth}px` }}
            className="flex flex-col bg-[#181C24] shrink-0 overflow-hidden"
          >
            <div className="p-3 border-b border-[#2B3242] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Canlı Betik Kum Havuzu (Sandbox)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRunSandbox}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Çalıştır</span>
                </button>
                <button
                  onClick={() => setShowSandboxPanel(false)}
                  title="Kum Havuzu Panelini Kapat"
                  className="p-1 rounded bg-[#202531] hover:bg-rose-600 text-slate-300 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
              <textarea
                value={customScript}
                onChange={(e) => setCustomScript(e.target.value)}
                className="flex-1 w-full bg-[#0B0E14] border border-[#2B3242] rounded-lg p-3 font-mono text-xs text-emerald-300 focus:outline-none focus:border-[#478CBF] resize-none"
              />

              <div className="h-44 rounded-lg bg-[#0B0E14] border border-[#2B3242] p-3 flex flex-col">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#68B6FF]" />
                  <span>Konsol Çıktısı (JSON):</span>
                </div>
                <pre className="flex-1 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap">
                  {sandboxOutput}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
