import {
  DiagnosticIssue,
  GameProject,
} from '../types/engine';
import { validateSceneBlocks } from './blockSystem';

export function runProjectDiagnostics(project: GameProject): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const assetIds = new Set(project.assets.map((a) => a.id));
  const sceneIds = new Set(project.scenes.map((s) => s.id));

  if (!sceneIds.has(project.startSceneId)) {
    issues.push({
      id: 'diag_missing_start_scene',
      severity: 'error',
      code: 'PRJ_NO_START_SCENE',
      title: 'Başlangıç Sahnesi Bulunamadı',
      message: `Projenin başlangıç sahnesi (${project.startSceneId}) mevcut sahneler arasında yer almıyor.`,
      suggestion: 'Sahne listesinden geçerli bir sahneyi "Başlangıç Sahnesi" olarak işaretleyin.',
    });
  }

  const usedAssetIds = new Set<string>();

  for (const scene of project.scenes) {
    const hasPlayer = scene.objects.some((o) => o.role === 'player');
    const hasInteractiveButton = scene.objects.some((o) => o.role === 'ui_button');

    if (!hasPlayer && !hasInteractiveButton && scene.id === project.startSceneId) {
      issues.push({
        id: `diag_no_player_${scene.id}`,
        severity: 'warning',
        code: 'SCN_NO_PLAYER',
        title: 'Sahneye Oyuncu veya Etkileşim Nesnesi Eklenmemiş',
        message: `"${scene.name}" sahnesinde kontrol edilebilir bir oyuncu veya buton bulunmuyor.`,
        sceneId: scene.id,
        suggestion: 'Araç çubuğundan bir "Kahraman (Player)" ekleyin.',
      });
    }

    for (const obj of scene.objects) {
      if (obj.spriteAssetId) {
        usedAssetIds.add(obj.spriteAssetId);
        if (!assetIds.has(obj.spriteAssetId)) {
          issues.push({
            id: `diag_missing_asset_${obj.id}`,
            severity: 'error',
            code: 'OBJ_MISSING_ASSET',
            title: 'Eksik Görsel Varlık Referansı',
            message: `"${obj.name}" nesnesi silinmiş veya bulunamayan bir varlığa (${obj.spriteAssetId}) referans veriyor.`,
            sceneId: scene.id,
            objectId: obj.id,
            assetId: obj.spriteAssetId,
            suggestion: 'Nesne özelliklerinden geçerli bir görsel seçin veya varsayılan vektör görünümüne dönün.',
          });
        }
      }

      if (
        obj.x < -2000 ||
        obj.x > scene.camera.boundsWidth + 2000 ||
        obj.y < -2000 ||
        obj.y > scene.camera.boundsHeight + 2000
      ) {
        issues.push({
          id: `diag_oob_${obj.id}`,
          severity: 'warning',
          code: 'OBJ_OUT_OF_BOUNDS',
          title: 'Kamera Sınırlarının Çok Dışında Nesne',
          message: `"${obj.name}" nesnesi (${obj.x}, ${obj.y}) koordinatlarında; sahne sınırlarının çok uzağında kalmış.`,
          sceneId: scene.id,
          objectId: obj.id,
          suggestion: 'Nesneyi seçip koordinatlarını kamera alanı (0 - 960, 0 - 540) içine çekin.',
        });
      }
    }

    const blockIssues = validateSceneBlocks(scene);
    issues.push(...blockIssues);
  }

  const totalAssetBytes = project.assets.reduce((acc, a) => acc + (a.sizeBytes || 0), 0);
  if (totalAssetBytes > 15 * 1024 * 1024) {
    issues.push({
      id: 'diag_single_html_size',
      severity: 'warning',
      code: 'EXP_SINGLE_HTML_LARGE',
      title: 'Tek HTML Çıktısı İçin Yüksek Varlık Boyutu',
      message: `Toplam varlık boyutu ${(totalAssetBytes / (1024 * 1024)).toFixed(1)} MB. 15 MB üzerindeki projelerde Tek HTML yerine "Web Dağıtım Paketi (ZIP)" önerilir.`,
      suggestion: 'Dışa aktarma menüsünden "Dağıtım Paketi (ZIP)" seçeneğini tercih edin.',
    });
  }

  return issues;
}

export function getUnusedAssets(project: GameProject): string[] {
  const referenced = new Set<string>();
  for (const scene of project.scenes) {
    for (const obj of scene.objects) {
      if (obj.spriteAssetId) referenced.add(obj.spriteAssetId);
    }
  }
  return project.assets
    .filter((a) => a.kind === 'image' || a.kind === 'atlas')
    .filter((a) => !referenced.has(a.id))
    .map((a) => a.id);
}
