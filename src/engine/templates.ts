import {
  ENGINE_VERSION,
  GameAsset,
  GameProject,
  GameScene,
  SCHEMA_VERSION,
  TemplateType,
} from '../types/engine';
import { createDefaultObject } from './sceneSystem';

export interface TemplateMetadata {
  id: TemplateType;
  title: string;
  subtitle: string;
  description: string;
  mechanicsSummary: string[];
  accentColor: string;
}

export const PROJECT_TEMPLATES: TemplateMetadata[] = [
  {
    id: 'platformer',
    title: 'Platform Oyunu',
    subtitle: 'Zümrüt Vadisi Platformu',
    description:
      'Yerçekimi, zıplama, altın toplama, devriye gezen düşman ve bölüm sonu bayrağı içeren tam çalışan 2D platform şablonu.',
    mechanicsSummary: ['Yerçekimi & Zıplama', 'Devriye Düşman AI', 'Altın & Puan', '2 Sahneli Geçiş'],
    accentColor: '#2563EB',
  },
  {
    id: 'topdown',
    title: 'Üstten Görünümlü Macera',
    subtitle: 'Kayıp Tapınak Macerası',
    description:
      '4 yönlü serbest hareket, anahtar envanter sistemi, rehber NPC diyaloğu ve görev takibi içeren keşif oyunu.',
    mechanicsSummary: ['4 Yönlü Hareket', 'Envanter & Anahtar', 'NPC Diyalog', 'Görev Sistemi'],
    accentColor: '#0D9488',
  },
  {
    id: 'puzzle',
    title: 'Basit Bulmaca Oyunu',
    subtitle: 'Kristal Sokoban Bulmacası',
    description:
      'Izgara hizalı sandık itme, enerji kristali noktaları ve hamle sayacı mantığıyla kurgulanmış bulmaca şablonu.',
    mechanicsSummary: ['Izgara Hizalama', 'Sandık & Hedef', 'Hamle Değişkeni', 'Bölüm Doğrulama'],
    accentColor: '#7C3AED',
  },
  {
    id: 'clicker',
    title: 'Tıklama Oyunu',
    subtitle: 'Kozmik Maden Tıklama',
    description:
      'Fare/dokunmatik tıklama olayları, saniyelik otomatik üretim zamanlayıcısı ve puan eşiği ödülleri.',
    mechanicsSummary: ['Tıklama Olayı', 'Otomatik Zamanlayıcı', 'Puan Çarpanı', 'Ses & Efekt'],
    accentColor: '#D97706',
  },
  {
    id: 'story',
    title: 'Diyalog Odaklı Hikâye',
    subtitle: 'Gece Treni Gizemi',
    description:
      'Seçimli diyalog ağaçları, ipucu envanteri, karakter animasyon durumları ve sahne geçişli interaktif hikâye.',
    mechanicsSummary: ['Dallanmalı Diyalog', 'İpucu Toplama', 'Sahne Geçişleri', 'Görev Günlüğü'],
    accentColor: '#DB2777',
  },
  {
    id: 'empty',
    title: 'Boş 2D Proje',
    subtitle: 'Sıfırdan Özel Tasarım',
    description:
      'Temiz katman yapısı, hazır kamera sınırları ve temel ses/görsel varlıklarıyla kendi oyununuzu sıfırdan kurun.',
    mechanicsSummary: ['Temiz Sahne', '3 Katman Yapısı', 'Kamera & Izgara', 'Hazır Ses/Sprite'],
    accentColor: '#475569',
  },
];

function createDefaultAssets(): GameAsset[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'asset_hero_atlas',
      name: 'Kahraman Sprite Atlası',
      kind: 'atlas',
      mimeType: 'image/svg+xml',
      sizeBytes: 2480,
      folder: 'Karakterler',
      tags: ['oyuncu', 'atlas', 'animasyon'],
      createdAt: now,
      width: 192,
      height: 64,
      atlasSlices: [
        { id: 'slice_idle_1', name: 'idle_01', x: 0, y: 0, width: 48, height: 64 },
        { id: 'slice_idle_2', name: 'idle_02', x: 48, y: 0, width: 48, height: 64 },
        { id: 'slice_run_1', name: 'run_01', x: 96, y: 0, width: 48, height: 64 },
        { id: 'slice_run_2', name: 'run_02', x: 144, y: 0, width: 48, height: 64 },
      ],
    },
    {
      id: 'asset_tileset_world',
      name: 'Zümrüt Platform Karoları',
      kind: 'image',
      mimeType: 'image/svg+xml',
      sizeBytes: 1840,
      folder: 'Çevre',
      tags: ['platform', 'zemin'],
      createdAt: now,
      width: 192,
      height: 32,
    },
    {
      id: 'asset_sfx_coin',
      name: 'Altın Toplama Sesi',
      kind: 'audio',
      mimeType: 'audio/wav',
      sizeBytes: 14200,
      folder: 'Sesler',
      tags: ['sfx', 'ödül'],
      createdAt: now,
      durationSec: 0.35,
      synthPreset: 'coin',
    },
    {
      id: 'asset_sfx_jump',
      name: 'Zıplama Sesi',
      kind: 'audio',
      mimeType: 'audio/wav',
      sizeBytes: 12400,
      folder: 'Sesler',
      tags: ['sfx', 'hareket'],
      createdAt: now,
      durationSec: 0.28,
      synthPreset: 'jump',
    },
    {
      id: 'asset_bgm_adventure',
      name: 'Keşif Arka Plan Teması',
      kind: 'audio',
      mimeType: 'audio/ogg',
      sizeBytes: 68400,
      folder: 'Müzik',
      tags: ['bgm', 'loop'],
      createdAt: now,
      durationSec: 12.0,
      synthPreset: 'bgm_adventure',
    },
  ];
}

function createBaseLayers() {
  return [
    { id: 'layer_bg', name: 'Arka Plan', visible: true, locked: false, order: 0, parallaxFactor: 0.5 },
    { id: 'layer_main', name: 'Oyun Alanı', visible: true, locked: false, order: 1, parallaxFactor: 1.0 },
    { id: 'layer_fg', name: 'Ön Plan & Arayüz', visible: true, locked: false, order: 2, parallaxFactor: 1.0 },
  ];
}

export function createProjectFromTemplate(
  template: TemplateType,
  customName?: string
): GameProject {
  const now = new Date().toISOString();
  const meta = PROJECT_TEMPLATES.find((t) => t.id === template) || PROJECT_TEMPLATES[0];
  const projectName = customName?.trim() || meta.subtitle;
  const projectId = `proj_${template}_${Date.now().toString(36)}`;
  const assets = createDefaultAssets();

  if (template === 'platformer') {
    const hero = createDefaultObject('player', 96, 320, 'layer_main', 1);
    hero.id = 'obj_player_main';
    hero.name = 'Kaşif_Aria';
    hero.spriteAssetId = 'asset_hero_atlas';

    const ground1 = createDefaultObject('platform', 32, 448, 'layer_main', 1);
    ground1.id = 'obj_ground_1';
    ground1.name = 'Ana_Zemin';
    ground1.width = 480;
    ground1.collision.width = 480;
    ground1.spriteAssetId = 'asset_tileset_world';

    const ground2 = createDefaultObject('platform', 544, 352, 'layer_main', 2);
    ground2.id = 'obj_ground_2';
    ground2.name = 'Yüksek_Platform';
    ground2.width = 320;
    ground2.collision.width = 320;

    const stepPlatform = createDefaultObject('platform', 320, 320, 'layer_main', 3);
    stepPlatform.id = 'obj_step_1';
    stepPlatform.name = 'Orta_Basamak';
    stepPlatform.width = 160;
    stepPlatform.collision.width = 160;

    const coin1 = createDefaultObject('collectible', 224, 384, 'layer_main', 1);
    coin1.id = 'obj_coin_1';
    coin1.name = 'Altın_1';

    const coin2 = createDefaultObject('collectible', 384, 256, 'layer_main', 2);
    coin2.id = 'obj_coin_2';
    coin2.name = 'Altın_2';

    const coin3 = createDefaultObject('collectible', 640, 288, 'layer_main', 3);
    coin3.id = 'obj_coin_3';
    coin3.name = 'Altın_3';

    const enemy = createDefaultObject('enemy', 576, 312, 'layer_main', 1);
    enemy.id = 'obj_slime_1';
    enemy.name = 'Koruyucu_Boss_Slime';
    enemy.hp = 90;
    enemy.maxHp = 90;
    enemy.patrolDistance = 120;
    enemy.patrolSpeed = 90;

    const movingPlat = createDefaultObject('moving_platform', 340, 224, 'layer_main', 1);
    movingPlat.id = 'obj_moving_plat_1';
    movingPlat.name = 'Hareketli_Platform2D';
    movingPlat.patrolDistance = 96;
    movingPlat.patrolSpeed = 75;

    const healthPotion = createDefaultObject('powerup', 480, 412, 'layer_main', 1);
    healthPotion.id = 'obj_potion_1';
    healthPotion.name = 'Can_Iksiri_Area2D';

    const flag = createDefaultObject('goal', 780, 288, 'layer_main', 1);
    flag.id = 'obj_goal_flag';
    flag.name = 'Bölüm_Bayrağı';

    const bouncePad = createDefaultObject('bounce_pad', 256, 424, 'layer_main', 1);
    bouncePad.id = 'obj_spring_1';
    bouncePad.name = 'Trambolin_Yay2D';

    const spikesHazard = createDefaultObject('hazard', 416, 424, 'layer_main', 1);
    spikesHazard.id = 'obj_spikes_1';
    spikesHazard.name = 'Diken_Tuzak2D';

    const torchLight = createDefaultObject('light_source', 736, 288, 'layer_bg', 1);
    torchLight.id = 'obj_torch_1';
    torchLight.name = 'Meşale_PointLight2D';

    const checkpointFlag = createDefaultObject('checkpoint', 352, 264, 'layer_main', 1);
    checkpointFlag.id = 'obj_checkpoint_1';
    checkpointFlag.name = 'Kayit_Noktasi2D_1';

    const leftInvisibleBound = createDefaultObject('invisible_wall', 0, 128, 'layer_main', 1);
    leftInvisibleBound.id = 'obj_inv_wall_left';
    leftInvisibleBound.name = 'Gorunmez_Sinir_Sol';
    leftInvisibleBound.width = 24;
    leftInvisibleBound.height = 360;
    leftInvisibleBound.collision.width = 24;
    leftInvisibleBound.collision.height = 360;
    leftInvisibleBound.collision.boundaryAction = 'solid';

    const scene1: GameScene = {
      id: 'scene_level_1',
      name: '1. Bölüm: Zümrüt Kıyı & Lazer Savunması',
      backgroundColor: '#0F172A',
      gridSize: 32,
      snapToGrid: true,
      gravityY: 980,
      worldBounds: {
        enabled: true,
        showGizmoInEditor: true,
        leftAction: 'solid',
        rightAction: 'solid',
        topAction: 'solid',
        bottomAction: 'respawn_damage',
        bottomDamage: 25,
        bouncePower: 520,
      },
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
      layers: createBaseLayers(),
      tilemapCells: [
        { col: 4, row: 7, kind: 'wood_bridge' },
        { col: 5, row: 7, kind: 'wood_bridge' },
        { col: 6, row: 7, kind: 'wood_bridge' },
        { col: 14, row: 5, kind: 'crystal_block' },
        { col: 15, row: 5, kind: 'crystal_block' },
        { col: 16, row: 5, kind: 'gold_ore' },
        { col: 22, row: 7, kind: 'stone_wall' },
        { col: 23, row: 7, kind: 'stone_wall' },
      ],
      objects: [
        torchLight,
        leftInvisibleBound,
        ground1,
        ground2,
        stepPlatform,
        movingPlat,
        bouncePad,
        spikesHazard,
        checkpointFlag,
        healthPotion,
        coin1,
        coin2,
        coin3,
        enemy,
        flag,
        hero,
      ],
      blocks: [
        {
          id: 'blk_start_1',
          type: 'event_game_start',
          targetObjectId: 'scene',
          params: {},
          children: [
            {
              id: 'blk_start_msg',
              type: 'ui_show_message',
              targetObjectId: 'scene',
              params: {
                text: 'Ok/WASD: Hareket (Yön Dönüşlü) · Space: Çoklu Zıpla · E/F: Lazer · Shift: Dash!',
              },
            },
            {
              id: 'blk_start_quest',
              type: 'adv_quest_start',
              targetObjectId: 'scene',
              params: { questId: 'q_emerald' },
            },
            {
              id: 'blk_patrol_init',
              type: 'adv_enemy_patrol',
              targetObjectId: enemy.id,
              params: { range: 110, speed: 90 },
            },
          ],
        },
        {
          id: 'blk_move_right',
          type: 'event_key_held',
          targetObjectId: hero.id,
          params: { key: 'ArrowRight' },
          children: [
            {
              id: 'blk_act_right',
              type: 'move_horizontal',
              targetObjectId: hero.id,
              params: { speed: 230 },
            },
            {
              id: 'blk_anim_right',
              type: 'anim_play',
              targetObjectId: hero.id,
              params: { clip: 'move' },
            },
          ],
        },
        {
          id: 'blk_move_left',
          type: 'event_key_held',
          targetObjectId: hero.id,
          params: { key: 'ArrowLeft' },
          children: [
            {
              id: 'blk_act_left',
              type: 'move_horizontal',
              targetObjectId: hero.id,
              params: { speed: -230 },
            },
            {
              id: 'blk_anim_left',
              type: 'anim_play',
              targetObjectId: hero.id,
              params: { clip: 'move' },
            },
          ],
        },
        {
          id: 'blk_jump_space',
          type: 'event_key_pressed',
          targetObjectId: hero.id,
          params: { key: 'Space' },
          children: [
            {
              id: 'blk_act_jump',
              type: 'move_jump',
              targetObjectId: hero.id,
              params: { force: 470 },
            },
            {
              id: 'blk_sfx_jump',
              type: 'audio_play_sfx',
              targetObjectId: 'scene',
              params: { sound: 'jump' },
            },
          ],
        },
        {
          id: 'blk_shoot_laser',
          type: 'event_key_pressed',
          targetObjectId: hero.id,
          params: { key: 'KeyE' },
          children: [
            {
              id: 'blk_act_laser',
              type: 'act_shoot_projectile',
              targetObjectId: hero.id,
              params: { speed: 540, damage: 30 },
            },
          ],
        },
        {
          id: 'blk_dash_move',
          type: 'event_key_pressed',
          targetObjectId: hero.id,
          params: { key: 'ShiftLeft' },
          children: [
            {
              id: 'blk_act_dash',
              type: 'move_dash',
              targetObjectId: hero.id,
              params: { power: 540 },
            },
          ],
        },
        {
          id: 'blk_bound_bottom',
          type: 'event_boundary_hit',
          targetObjectId: hero.id,
          params: { edge: 'bottom' },
          children: [
            {
              id: 'blk_bound_shake',
              type: 'camera_shake',
              targetObjectId: 'scene',
              params: { intensity: 7 },
            },
          ],
        },
        {
          id: 'blk_collect_coin',
          type: 'event_on_collision',
          targetObjectId: hero.id,
          params: { otherRole: 'collectible' },
          children: [
            {
              id: 'blk_destroy_coin',
              type: 'sense_destroy_other',
              targetObjectId: hero.id,
              params: {},
            },
            {
              id: 'blk_score_coin',
              type: 'ui_add_score',
              targetObjectId: 'scene',
              params: { points: 25 },
            },
            {
              id: 'blk_sfx_coin',
              type: 'audio_play_sfx',
              targetObjectId: 'scene',
              params: { sound: 'coin' },
            },
          ],
        },
        {
          id: 'blk_hit_enemy',
          type: 'event_on_collision',
          targetObjectId: hero.id,
          params: { otherRole: 'enemy' },
          children: [
            {
              id: 'blk_dmg_hero',
              type: 'sense_damage_target',
              targetObjectId: hero.id,
              params: { amount: -25 },
            },
            {
              id: 'blk_shake_hit',
              type: 'camera_shake',
              targetObjectId: 'scene',
              params: { intensity: 8 },
            },
            {
              id: 'blk_sfx_hit',
              type: 'audio_play_sfx',
              targetObjectId: 'scene',
              params: { sound: 'hit' },
            },
            {
              id: 'blk_msg_hit',
              type: 'ui_show_message',
              targetObjectId: 'scene',
              params: { text: 'Düşmana çarptın! E/F tuşuyla Lazer ateşleyerek onu yok et!' },
            },
          ],
        },
        {
          id: 'blk_reach_goal',
          type: 'event_on_collision',
          targetObjectId: hero.id,
          params: { otherRole: 'goal' },
          children: [
            {
              id: 'blk_complete_quest',
              type: 'adv_quest_complete',
              targetObjectId: 'scene',
              params: { questId: 'q_emerald' },
            },
            {
              id: 'blk_sfx_victory',
              type: 'audio_play_sfx',
              targetObjectId: 'scene',
              params: { sound: 'victory' },
            },
            {
              id: 'blk_win_game',
              type: 'scene_victory',
              targetObjectId: 'scene',
              params: { reason: 'Zümrüt Kıyı başarıyla geçildi!' },
            },
          ],
        },
        {
          id: 'blk_hp_zero',
          type: 'event_health_zero',
          targetObjectId: hero.id,
          params: {},
          children: [
            {
              id: 'blk_game_over',
              type: 'scene_gameover',
              targetObjectId: 'scene',
              params: { reason: 'Canınız tükendi! Tekrar deneyin.' },
            },
          ],
        },
      ],
      dialogues: [
        {
          id: 'dlg_intro',
          speaker: 'Bilge Muhafız',
          portraitColor: '#7C3AED',
          text: 'Vadideki altınları topla ve yüksek platformdaki yeşil bayrağa ulaş!',
          choices: [{ id: 'c1', text: 'Hazırım, başlayalım!', scoreDelta: 5 }],
        },
      ],
      quests: [
        {
          id: 'q_emerald',
          title: 'Zümrüt Bayrağa Ulaş',
          description: 'Engelleri aşarak platformun sonundaki yeşil bayrağa dokun.',
          status: 'inactive',
          rewardScore: 50,
        },
      ],
    };

    const scene2Hero = createDefaultObject('player', 96, 350, 'layer_main', 1);
    scene2Hero.id = 'obj_player_s2';
    scene2Hero.name = 'Kaşif_Aria';
    const scene2Ground = createDefaultObject('platform', 64, 448, 'layer_main', 1);
    scene2Ground.width = 768;
    scene2Ground.collision.width = 768;
    const scene2Goal = createDefaultObject('goal', 736, 384, 'layer_main', 1);

    const scene2: GameScene = {
      id: 'scene_level_2',
      name: '2. Bölüm: Kristal Mağara',
      backgroundColor: '#1E1B4B',
      gridSize: 32,
      snapToGrid: true,
      gravityY: 980,
      camera: {
        width: 960,
        height: 540,
        zoom: 1,
        followTargetId: scene2Hero.id,
        smoothing: 0.12,
        boundsX: 0,
        boundsY: 0,
        boundsWidth: 1200,
        boundsHeight: 600,
      },
      layers: createBaseLayers(),
      objects: [scene2Ground, scene2Goal, scene2Hero],
      blocks: [
        {
          id: 'blk_s2_start',
          type: 'event_scene_enter',
          targetObjectId: 'scene',
          params: {},
          children: [
            {
              id: 'blk_s2_msg',
              type: 'ui_show_message',
              targetObjectId: 'scene',
              params: { text: '2. Bölüme hoş geldin!' },
            },
          ],
        },
      ],
      dialogues: [],
      quests: [],
    };

    return {
      id: projectId,
      name: projectName,
      description: meta.description,
      version: '1.0.0',
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      template,
      createdAt: now,
      updatedAt: now,
      startSceneId: scene1.id,
      activeSceneId: scene1.id,
      settings: {
        resolutionWidth: 960,
        resolutionHeight: 540,
        targetFps: 60,
        pixelArtMode: false,
        defaultVolume: 80,
        touchControlsEnabled: true,
        author: 'Yerel Geliştirici',
        license: 'MIT',
      },
      variables: [
        { id: 'v_altin', name: 'toplananAltin', type: 'number', scope: 'global', initialValue: 0 },
        { id: 'v_bolum', name: 'aktifBolum', type: 'number', scope: 'global', initialValue: 1 },
      ],
      scenes: [scene1, scene2],
      assets,
    };
  }

  if (template === 'topdown') {
    const hero = createDefaultObject('player', 160, 256, 'layer_main', 1);
    hero.id = 'obj_td_hero';
    hero.name = 'Maceracı_Kaan';
    hero.physics.gravityScale = 0;

    const npc = createDefaultObject('npc', 384, 192, 'layer_main', 1);
    npc.id = 'obj_td_npc';
    npc.name = 'Tapınak_Bilgesi';

    const keyItem = createDefaultObject('collectible', 576, 352, 'layer_main', 1);
    keyItem.id = 'obj_td_key';
    keyItem.name = 'Tapınak_Anahtarı';
    keyItem.shapePreset = 'key';

    const portal = createDefaultObject('goal', 768, 224, 'layer_main', 1);
    portal.id = 'obj_td_portal';
    portal.name = 'Antik_Kapı';
    portal.shapePreset = 'portal';

    const wallTop = createDefaultObject('platform', 96, 64, 'layer_main', 1);
    wallTop.name = 'Kuzey_Duvarı';
    wallTop.width = 768;
    wallTop.collision.width = 768;

    const wallBottom = createDefaultObject('platform', 96, 448, 'layer_main', 2);
    wallBottom.name = 'Güney_Duvarı';
    wallBottom.width = 768;
    wallBottom.collision.width = 768;

    const scene: GameScene = {
      id: 'scene_temple',
      name: 'Tapınak Avlusu',
      backgroundColor: '#042F2E',
      gridSize: 32,
      snapToGrid: true,
      gravityY: 0,
      camera: {
        width: 960,
        height: 540,
        zoom: 1,
        followTargetId: hero.id,
        smoothing: 0.15,
        boundsX: 0,
        boundsY: 0,
        boundsWidth: 960,
        boundsHeight: 540,
      },
      layers: createBaseLayers(),
      objects: [wallTop, wallBottom, npc, keyItem, portal, hero],
      blocks: [
        {
          id: 'td_start',
          type: 'event_game_start',
          targetObjectId: 'scene',
          params: {},
          children: [
            {
              id: 'td_q_start',
              type: 'adv_quest_start',
              targetObjectId: 'scene',
              params: { questId: 'q_temple_key' },
            },
            {
              id: 'td_msg',
              type: 'ui_show_message',
              targetObjectId: 'scene',
              params: { text: 'Ok tuşlarıyla 4 yönde hareket et, Bilge ile konuş ve Anahtarı al!' },
            },
          ],
        },
        {
          id: 'td_right',
          type: 'event_key_held',
          targetObjectId: hero.id,
          params: { key: 'ArrowRight' },
          children: [{ id: 'td_r_act', type: 'move_horizontal', targetObjectId: hero.id, params: { speed: 210 } }],
        },
        {
          id: 'td_left',
          type: 'event_key_held',
          targetObjectId: hero.id,
          params: { key: 'ArrowLeft' },
          children: [{ id: 'td_l_act', type: 'move_horizontal', targetObjectId: hero.id, params: { speed: -210 } }],
        },
        {
          id: 'td_up',
          type: 'event_key_held',
          targetObjectId: hero.id,
          params: { key: 'ArrowUp' },
          children: [{ id: 'td_u_act', type: 'move_vertical', targetObjectId: hero.id, params: { speed: -210 } }],
        },
        {
          id: 'td_down',
          type: 'event_key_held',
          targetObjectId: hero.id,
          params: { key: 'ArrowDown' },
          children: [{ id: 'td_d_act', type: 'move_vertical', targetObjectId: hero.id, params: { speed: 210 } }],
        },
        {
          id: 'td_npc_col',
          type: 'event_on_collision',
          targetObjectId: hero.id,
          params: { otherRole: 'npc' },
          children: [
            {
              id: 'td_dlg',
              type: 'ui_start_dialogue',
              targetObjectId: 'scene',
              params: { dialogueId: 'dlg_temple' },
            },
          ],
        },
        {
          id: 'td_key_col',
          type: 'event_on_collision',
          targetObjectId: hero.id,
          params: { otherRole: 'collectible' },
          children: [
            { id: 'td_k_destroy', type: 'sense_destroy_other', targetObjectId: hero.id, params: {} },
            {
              id: 'td_k_inv',
              type: 'adv_inventory_add',
              targetObjectId: 'scene',
              params: { itemName: 'Tapınak Anahtarı' },
            },
            { id: 'td_k_score', type: 'ui_add_score', targetObjectId: 'scene', params: { points: 50 } },
            { id: 'td_k_sfx', type: 'audio_play_sfx', targetObjectId: 'scene', params: { sound: 'quest' } },
          ],
        },
        {
          id: 'td_goal_col',
          type: 'event_on_collision',
          targetObjectId: hero.id,
          params: { otherRole: 'goal' },
          children: [
            {
              id: 'td_q_comp',
              type: 'adv_quest_complete',
              targetObjectId: 'scene',
              params: { questId: 'q_temple_key' },
            },
            {
              id: 'td_win',
              type: 'scene_victory',
              targetObjectId: 'scene',
              params: { reason: 'Tapınak Kapısı Açıldı!' },
            },
          ],
        },
      ],
      dialogues: [
        {
          id: 'dlg_temple',
          speaker: 'Tapınak Bilgesi',
          portraitColor: '#0D9488',
          text: 'Antik Kapıyı açmak için güneydoğudaki altın anahtarı çantana eklemelisin.',
          choices: [
            { id: 'c1', text: 'Anahtarı hemen bulacağım!', scoreDelta: 10 },
            { id: 'c2', text: 'Bilgi için teşekkürler.', giveItem: 'Antik Harita' },
          ],
        },
      ],
      quests: [
        {
          id: 'q_temple_key',
          title: 'Tapınak Anahtarını Bul',
          description: 'Anahtarı envantere ekle ve Antik Kapıdan geç.',
          status: 'inactive',
          rewardScore: 100,
        },
      ],
    };

    return {
      id: projectId,
      name: projectName,
      description: meta.description,
      version: '1.0.0',
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      template,
      createdAt: now,
      updatedAt: now,
      startSceneId: scene.id,
      activeSceneId: scene.id,
      settings: {
        resolutionWidth: 960,
        resolutionHeight: 540,
        targetFps: 60,
        pixelArtMode: false,
        defaultVolume: 80,
        touchControlsEnabled: true,
        author: 'Yerel Geliştirici',
        license: 'MIT',
      },
      variables: [{ id: 'v_anahtar', name: 'anahtarAlindi', type: 'boolean', scope: 'global', initialValue: false }],
      scenes: [scene],
      assets,
    };
  }

  if (template === 'clicker') {
    const crystalButton = createDefaultObject('ui_button', 360, 210, 'layer_main', 1);
    crystalButton.id = 'obj_click_crystal';
    crystalButton.name = 'Kozmik_Kristal';
    crystalButton.width = 220;
    crystalButton.height = 84;
    crystalButton.collision.width = 220;
    crystalButton.collision.height = 84;
    crystalButton.color = '#D97706';
    crystalButton.text = 'KRİSTAL KAZ (+15 Puan)';

    const scene: GameScene = {
      id: 'scene_clicker',
      name: 'Kozmik Maden İstasyonu',
      backgroundColor: '#1E1B4B',
      gridSize: 32,
      snapToGrid: true,
      gravityY: 0,
      camera: {
        width: 960,
        height: 540,
        zoom: 1,
        followTargetId: null,
        smoothing: 0.1,
        boundsX: 0,
        boundsY: 0,
        boundsWidth: 960,
        boundsHeight: 540,
      },
      layers: createBaseLayers(),
      objects: [crystalButton],
      blocks: [
        {
          id: 'clk_start',
          type: 'event_game_start',
          targetObjectId: 'scene',
          params: {},
          children: [
            {
              id: 'clk_msg',
              type: 'ui_show_message',
              targetObjectId: 'scene',
              params: { text: 'Kristale tıklayarak veya Space tuşuna basarak maden kaz!' },
            },
          ],
        },
        {
          id: 'clk_click',
          type: 'event_object_clicked',
          targetObjectId: crystalButton.id,
          params: {},
          children: [
            { id: 'clk_pts', type: 'ui_add_score', targetObjectId: 'scene', params: { points: 15 } },
            { id: 'clk_sfx', type: 'audio_play_sfx', targetObjectId: 'scene', params: { sound: 'coin' } },
          ],
        },
        {
          id: 'clk_timer',
          type: 'event_timer_interval',
          targetObjectId: 'scene',
          params: { seconds: 1 },
          children: [
            { id: 'clk_auto_pts', type: 'ui_add_score', targetObjectId: 'scene', params: { points: 5 } },
          ],
        },
      ],
      dialogues: [],
      quests: [
        {
          id: 'q_miner',
          title: '100 Kozmik Cevher Topla',
          description: 'Tıklayarak veya otomatik kazıcıyla 100 puana ulaş.',
          status: 'active',
          rewardScore: 50,
        },
      ],
    };

    return {
      id: projectId,
      name: projectName,
      description: meta.description,
      version: '1.0.0',
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      template,
      createdAt: now,
      updatedAt: now,
      startSceneId: scene.id,
      activeSceneId: scene.id,
      settings: {
        resolutionWidth: 960,
        resolutionHeight: 540,
        targetFps: 60,
        pixelArtMode: false,
        defaultVolume: 80,
        touchControlsEnabled: true,
        author: 'Yerel Geliştirici',
        license: 'MIT',
      },
      variables: [{ id: 'v_guc', name: 'kazimGucu', type: 'number', scope: 'global', initialValue: 15 }],
      scenes: [scene],
      assets,
    };
  }

  const player = createDefaultObject('player', 160, 288, 'layer_main', 1);
  player.id = 'obj_main_actor';
  player.physics.gravityScale = template === 'empty' ? 1 : 0;

  const groundOrTarget = createDefaultObject(
    template === 'puzzle' ? 'crate' : template === 'story' ? 'npc' : 'platform',
    template === 'empty' ? 128 : 416,
    template === 'empty' ? 416 : 288,
    'layer_main',
    1
  );
  if (template === 'empty') {
    groundOrTarget.width = 640;
    groundOrTarget.collision.width = 640;
  }

  const goalObj = createDefaultObject('goal', 672, 288, 'layer_main', 1);

  const defaultScene: GameScene = {
    id: 'scene_main',
    name: 'Ana Sahne',
    backgroundColor: '#0F172A',
    gridSize: 32,
    snapToGrid: true,
    gravityY: template === 'empty' ? 980 : 0,
    camera: {
      width: 960,
      height: 540,
      zoom: 1,
      followTargetId: player.id,
      smoothing: 0.12,
      boundsX: 0,
      boundsY: 0,
      boundsWidth: 960,
      boundsHeight: 540,
    },
    layers: createBaseLayers(),
    objects: [groundOrTarget, goalObj, player],
    blocks: [
      {
        id: 'blk_gen_start',
        type: 'event_game_start',
        targetObjectId: 'scene',
        params: {},
        children: [
          {
            id: 'blk_gen_msg',
            type: 'ui_show_message',
            targetObjectId: 'scene',
            params: { text: `${projectName} başlatıldı! Ok tuşları ile hareket edin.` },
          },
        ],
      },
      {
        id: 'blk_gen_right',
        type: 'event_key_held',
        targetObjectId: player.id,
        params: { key: 'ArrowRight' },
        children: [{ id: 'blk_gen_r_act', type: 'move_horizontal', targetObjectId: player.id, params: { speed: 200 } }],
      },
      {
        id: 'blk_gen_left',
        type: 'event_key_held',
        targetObjectId: player.id,
        params: { key: 'ArrowLeft' },
        children: [{ id: 'blk_gen_l_act', type: 'move_horizontal', targetObjectId: player.id, params: { speed: -200 } }],
      },
      {
        id: 'blk_gen_goal',
        type: 'event_on_collision',
        targetObjectId: player.id,
        params: { otherRole: 'goal' },
        children: [
          { id: 'blk_gen_pts', type: 'ui_add_score', targetObjectId: 'scene', params: { points: 100 } },
          { id: 'blk_gen_win', type: 'scene_victory', targetObjectId: 'scene', params: { reason: 'Hedefe Ulaşıldı!' } },
        ],
      },
    ],
    dialogues: [
      {
        id: 'dlg_intro',
        speaker: 'Başkomiser',
        portraitColor: '#DB2777',
        text: 'Gece trenindeki gizemli sinyali takip ederek hedefe ulaşmalısın.',
        choices: [{ id: 'c1', text: 'Anlaşıldı!', scoreDelta: 15 }],
      },
    ],
    quests: [],
  };

  return {
    id: projectId,
    name: projectName,
    description: meta.description,
    version: '1.0.0',
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    template,
    createdAt: now,
    updatedAt: now,
    startSceneId: defaultScene.id,
    activeSceneId: defaultScene.id,
    settings: {
      resolutionWidth: 960,
      resolutionHeight: 540,
      targetFps: 60,
      pixelArtMode: false,
      defaultVolume: 80,
      touchControlsEnabled: true,
      author: 'Yerel Geliştirici',
      license: 'MIT',
    },
    variables: [{ id: 'v_hamle', name: 'hamleSayisi', type: 'number', scope: 'global', initialValue: 0 }],
    scenes: [defaultScene],
    assets,
  };
}
