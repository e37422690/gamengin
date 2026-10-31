import React, { useState } from 'react';
import { GameProject, TemplateType } from '../types/engine';
import { PROJECT_TEMPLATES } from '../engine/templates';
import {
  exportSingleHtml,
  exportProjectZip,
  exportDistributionZip,
  importProjectFromZipBuffer,
} from '../engine/exportSystem';
import { migrateProjectData } from '../engine/storageSystem';
import {
  X,
  Download,
  Upload,
  FileCode,
  FolderArchive,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HardDrive,
} from 'lucide-react';

interface ProjectAndExportModalProps {
  isOpen: boolean;
  initialTab: 'templates' | 'export';
  project: GameProject;
  storageQuotaText: string;
  onClose: () => void;
  onCreateFromTemplate: (templateId: TemplateType, projectName: string) => void;
  onImportProject: (project: GameProject) => void;
}

function downloadBlobOrText(content: Blob | string, filename: string, mimeType = 'application/octet-stream') {
  const blob =
    typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const ProjectAndExportModal: React.FC<ProjectAndExportModalProps> = ({
  isOpen,
  initialTab,
  project,
  storageQuotaText,
  onClose,
  onCreateFromTemplate,
  onImportProject,
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'export'>(initialTab);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('platformer');
  const [newProjectName, setNewProjectName] = useState('Yeni 2D Oyunum');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (!isOpen) return null;

  const handleExportHtml = () => {
    const res = exportSingleHtml(project);
    downloadBlobOrText(res.htmlContent, res.filename, 'text/html;charset=utf-8');
    setExportStatus(
      `Tek Dosya HTML (${(res.sizeBytes / 1024).toFixed(1)} KB) başarıyla indirildi. Çevrimdışı her tarayıcıda 1:1 aynı grafik ve fizikle çalışır.`
    );
  };

  const handleExportFullZip = async () => {
    setIsBusy(true);
    try {
      const res = await exportProjectZip(project);
      downloadBlobOrText(res.blob, res.filename);
      setExportStatus(
        `Tam Proje Arşivi (${(res.blob.size / 1024).toFixed(1)} KB) başarıyla indirildi. Daha sonra tekrar KareForge 2D'ye içe aktarabilirsiniz.`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportDistZip = async () => {
    setIsBusy(true);
    try {
      const res = await exportDistributionZip(project);
      downloadBlobOrText(res.blob, res.filename);
      setExportStatus(
        `Web Dağıtım Paketi (${(res.blob.size / 1024).toFixed(1)} KB) indirildi. itch.io, Render, GitHub Pages veya Netlify'a doğrudan yüklenebilir.`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportZipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setIsBusy(true);
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const migrated = migrateProjectData(parsed);
        onImportProject(migrated);
        onClose();
      } else {
        const buffer = await file.arrayBuffer();
        const res = await importProjectFromZipBuffer(buffer, []);
        onImportProject(res.project);
        onClose();
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Proje içe aktarılamadı.');
    } finally {
      setIsBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-3xl bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-[#0B0F19] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'templates'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Yeni Proje &amp; Şablonlar
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'export'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dışa Aktar (HTML / ZIP) &amp; İçe Aktar
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              {storageQuotaText}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'templates' ? (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Proje Adı
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Başlangıç Şablonu Seçin (6 Oynanabilir Tür)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROJECT_TEMPLATES.map((tpl) => {
                    const active = selectedTemplate === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplate(tpl.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          active
                            ? 'bg-indigo-950/40 border-indigo-500 shadow-lg'
                            : 'bg-[#0B0F19] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-white">{tpl.title}</span>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${tpl.accentColor}20`,
                              color: tpl.accentColor,
                            }}
                          >
                            {tpl.subtitle}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{tpl.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  İptal
                </button>
                <button
                  onClick={() => {
                    onCreateFromTemplate(selectedTemplate, newProjectName);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Projeyi Oluştur ve Aç</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Oyunu Dışa Aktar (3 Bağımsız Paketleme Modu — 1:1 Motor Eşitliği)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Tüm dışa aktarma modları motor içindeki vektör çizim motorunu, WebAudio ses sentezleyicisini ve fizik/görev sistemini birebir gömer; sunucu gerektirmez.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-3">
                        <FileCode className="w-5 h-5 text-indigo-400" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">1. Tek Dosya HTML (.html)</h4>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        Tüm motor, vektör grafikler, sesler, sahneler ve bloklar tek bir bağımsız <code>.html</code> dosyasına gömülür.
                      </p>
                    </div>
                    <button
                      onClick={handleExportHtml}
                      disabled={isBusy}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tek HTML İndir</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3">
                        <FolderArchive className="w-5 h-5 text-amber-400" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">2. Tam Proje Arşivi (.zip)</h4>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        <code>project.json</code>, sahne dosyaları, derlenmiş TypeScript kodları ve varlıkları içeren tam yedekleme paketi.
                      </p>
                    </div>
                    <button
                      onClick={handleExportFullZip}
                      disabled={isBusy}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Proje ZIP İndir</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-3">
                        <Globe className="w-5 h-5 text-emerald-400" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">3. Web Dağıtım Paketi (.zip)</h4>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        <code>index.html</code>, <code>style.css</code> ve <code>runtime.js</code> içeren itch.io / Netlify / GitHub Pages paketi.
                      </p>
                    </div>
                    <button
                      onClick={handleExportDistZip}
                      disabled={isBusy}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Web Paketi İndir</span>
                    </button>
                  </div>
                </div>
              </div>

              {exportStatus && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{exportStatus}</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-sm font-bold text-white mb-1">
                  Mevcut Projeyi İçe Aktar (.zip veya .json)
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Daha önce dışa aktardığınız KareForge 2D proje arşivini seçerek kaldığınız yerden devam edin.
                </p>

                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 cursor-pointer border border-slate-700">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>ZIP veya JSON Proje Dosyası Seç</span>
                  <input
                    type="file"
                    accept=".zip,.json"
                    onChange={handleImportZipFile}
                    className="hidden"
                  />
                </label>

                {importError && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
