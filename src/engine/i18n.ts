export type EngineLanguage = 'tr' | 'en';

const STORAGE_LANG_KEY = 'kareforge_engine_lang_v1';

export function getInitialLanguage(): EngineLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    if (saved === 'en' || saved === 'tr') return saved;
  } catch {
    // ignore storage errors
  }
  return 'tr';
}

export function saveLanguagePreference(lang: EngineLanguage): void {
  try {
    localStorage.setItem(STORAGE_LANG_KEY, lang);
  } catch {
    // ignore storage errors
  }
}

export interface UILabels {
  engineSubtitle: string;
  autoSaveActive: string;
  saving: string;
  undo: string;
  redo: string;
  tabScene: string;
  tabBlocks: string;
  tabAssets: string;
  tabCode: string;
  tabDocs: string;
  wizardBtn: string;
  commandPaletteBtn: string;
  pipPreviewBtn: string;
  windowSizesBtn: string;
  templatesBtn: string;
  playGameBtn: string;
  stopGameBtn: string;
  exportBtn: string;
  newSceneBtn: string;
  activeNodeLabel: string;
  sceneRootLabel: string;
  sceneTreeTitle: string;
  addNodeBtn: string;
  filterNodesPlaceholder: string;
  fileSystemTab: string;
  layersTab: string;
  inspectorTab: string;
  signalsTab: string;
  prefabsTab: string;
  quickMechanicPlaceholder: string;
  bottomOutputTab: string;
  bottomAnimTab: string;
  bottomDialogueTab: string;
  bottomSfxTab: string;
  hideBtn: string;
  engineReadyStatus: string;
  warningsLabel: string;
  errorsFoundLabel: string;
}

export const UI_TRANSLATIONS: Record<EngineLanguage, UILabels> = {
  tr: {
    engineSubtitle: 'Bağımsız 2D Oyun Motoru · Gemini 4 Argon Edition',
    autoSaveActive: 'Otomatik Kayıt Aktif',
    saving: 'Kaydediliyor...',
    undo: 'Geri Al',
    redo: 'İleri Al',
    tabScene: '2D Sahne',
    tabBlocks: 'Blok Kodlama',
    tabAssets: 'Piksel & Varlık',
    tabCode: 'Motor Kodu',
    tabDocs: 'Akademi & Rehber',
    wizardBtn: 'Oyun Sihirbazı',
    commandPaletteBtn: 'Komutlar (Ctrl+K)',
    pipPreviewBtn: 'Canlı Mini Test',
    windowSizesBtn: 'Boyutlar',
    templatesBtn: 'Şablonlar',
    playGameBtn: 'Oyunu Başlat (F5)',
    stopGameBtn: 'Testi Kapat (F8)',
    exportBtn: 'Dışa Aktar / Paylaş',
    newSceneBtn: '+ Yeni Sahne',
    activeNodeLabel: 'Seçili Düğüm:',
    sceneRootLabel: 'Sahne Kökü (Dünya Ayarları)',
    sceneTreeTitle: 'Sahne Ağacı',
    addNodeBtn: '+ Nesne',
    filterNodesPlaceholder: 'Nesne veya sınıf ara (Kahraman, Platform...)',
    fileSystemTab: 'Dosya Sistemi (res://)',
    layersTab: 'Katmanlar',
    inspectorTab: 'Denetçi (Özellikler)',
    signalsTab: 'Sinyaller',
    prefabsTab: 'Hazır Prefablar',
    quickMechanicPlaceholder: '⚡ + Hazır Oyun Mekaniği Paketi Ekle...',
    bottomOutputTab: 'Doğrulama & Çıktı',
    bottomAnimTab: 'Animasyon & Tetikleyiciler',
    bottomDialogueTab: 'Diyalog & Görevler',
    bottomSfxTab: 'SFX Ses Stüdyosu',
    hideBtn: 'Gizle',
    engineReadyStatus: 'KareForge 2D Çekirdek: Hazır',
    warningsLabel: 'Uyarı',
    errorsFoundLabel: 'Hata Bulundu',
  },
  en: {
    engineSubtitle: 'Standalone 2D Game Engine · Gemini 4 Argon Edition',
    autoSaveActive: 'Auto-Save Active',
    saving: 'Saving...',
    undo: 'Undo',
    redo: 'Redo',
    tabScene: '2D Scene',
    tabBlocks: 'Visual Script',
    tabAssets: 'Pixel & Assets',
    tabCode: 'Engine Code',
    tabDocs: 'Academy & Docs',
    wizardBtn: 'Game Wizard',
    commandPaletteBtn: 'Commands (Ctrl+K)',
    pipPreviewBtn: 'Live PiP Test',
    windowSizesBtn: 'Layout',
    templatesBtn: 'Templates',
    playGameBtn: 'Play Game (F5)',
    stopGameBtn: 'Stop Test (F8)',
    exportBtn: 'Export / Publish',
    newSceneBtn: '+ New Scene',
    activeNodeLabel: 'Active Node:',
    sceneRootLabel: 'Scene Root (World Settings)',
    sceneTreeTitle: 'Scene Tree',
    addNodeBtn: '+ Node',
    filterNodesPlaceholder: 'Filter nodes (Player, Platform, Enemy...)',
    fileSystemTab: 'FileSystem (res://)',
    layersTab: 'Canvas Layers',
    inspectorTab: 'Inspector',
    signalsTab: 'Signals',
    prefabsTab: 'Smart Prefabs',
    quickMechanicPlaceholder: '⚡ + Inject Ready Mechanic Bundle...',
    bottomOutputTab: 'Diagnostics & Output',
    bottomAnimTab: 'Animations & Triggers',
    bottomDialogueTab: 'Dialogues & Quests',
    bottomSfxTab: 'SFX Synth Studio',
    hideBtn: 'Hide',
    engineReadyStatus: 'KareForge 2D Core: Ready',
    warningsLabel: 'Warnings',
    errorsFoundLabel: 'Errors Found',
  },
};
