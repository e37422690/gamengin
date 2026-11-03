import React, { useState } from 'react';
import {
  BoundaryCollisionAction,
  CharacterFlipMode,
  GameObject,
  GameProject,
  GameScene,
  InvisibleWallTargetFilter,
  JumpModeType,
  ObjectRole,
} from '../types/engine';
import { createProjectFromTemplate } from '../engine/templates';
import { createDefaultObject } from '../engine/sceneSystem';
import { EngineLanguage } from '../engine/i18n';
import {
  Sparkles,
  X,
  Wand2,
  Gamepad2,
  Shield,
  Zap,
  CheckCircle2,
  Layers,
  Play,
  ArrowRight,
  Compass,
  Cpu,
  Flame,
  Trophy,
} from 'lucide-react';

export interface WizardConfig {
  projectName: string;
  genre: 'platformer' | 'cyber_action' | 'topdown' | 'sky_jumper';
  themeBg: string;
  heroSkin: 'hero' | 'knight' | 'mage' | 'ninja' | 'robot';
  flipMode: CharacterFlipMode;
  jumpMode: JumpModeType;
  maxJumps: number;
  wallJumpEnabled: boolean;
  enableLaserAbility: boolean;
  enableDashAbility: boolean;
  bottomBoundaryAction: BoundaryCollisionAction;
  sideBoundaryAction: BoundaryCollisionAction;
  addEnemyBarrierWall: boolean;
}

export interface SmartPrefabItem {
  id: string;
  titleTr: string;
  titleEn: string;
  descTr: string;
  descEn: string;
  badge: string;
  accentColor: string;
  spawn: (scene: GameScene) => {
    newObjects: GameObject[];
    extraBlocksCount: number;
    updatedScene: GameScene;
  };
}

export const SMART_PREFAB_CATALOG: SmartPrefabItem[] = [
  {
    id: 'prefab_enemy_only_wall',
    titleTr: '🛡️ Düşman Geçirmez Görünmez Duvar',
    titleEn: '🛡️ Enemy-Only Invisible Barrier Wall',
    descTr:
      'Kahraman içinden serbestçe geçebilir; yalnızca düşmanları (enemies_only) durdurur ve geri çevirir.',
    descEn:
      'Player walks right through it, while enemies (enemies_only) are blocked from crossing.',
    badge: 'enemies_only · StaticBody2D',
    accentColor: '#06B6D4',
    spawn: (scene) => {
      const wall = createDefaultObject('invisible_wall', 420, 260, 'layer_main', scene.objects.length + 1);
      wall.name = 'Dusman_Sinir_Duvari';
      wall.width = 28;
      wall.height = 220;
      wall.collision.width = 28;
      wall.collision.height = 220;
      wall.collision.boundaryAction = 'solid';
      wall.collision.wallTargetFilter = 'enemies_only';
      return {
        newObjects: [wall],
        extraBlocksCount: 0,
        updatedScene: {
          ...scene,
          objects: [...scene.objects, wall],
        },
      };
    },
  },
  {
    id: 'prefab_player_bounce_shield',
    titleTr: '⚡ Oyuncu Elastik Sekme Sınırı',
    titleEn: '⚡ Player Bounce Forcefield Wall',
    descTr:
      'Yalnızca kahramanı (player_only) etkileyen ve değdiğinde trambolin gibi geri fırlatan görünmez kalkan.',
    descEn:
      'Affects only the player character (player_only) and bounces them back with elastic impulse.',
    badge: 'player_only · Bounce',
    accentColor: '#EC4899',
    spawn: (scene) => {
      const wall = createDefaultObject('invisible_wall', 680, 240, 'layer_main', scene.objects.length + 1);
      wall.name = 'Oyuncu_Sekme_Kalkani';
      wall.width = 28;
      wall.height = 220;
      wall.collision.width = 28;
      wall.collision.height = 220;
      wall.collision.boundaryAction = 'bounce';
      wall.collision.wallTargetFilter = 'player_only';
      return {
        newObjects: [wall],
        extraBlocksCount: 0,
        updatedScene: {
          ...scene,
          objects: [...scene.objects, wall],
        },
      };
    },
  },
  {
    id: 'prefab_patrol_boss_bundle',
    titleTr: '👾 Akıllı Devriye Boss + Hasar Kuralı',
    titleEn: '👾 Smart Patrol Boss + Damage Script',
    descTr:
      'Otomatik sağa/sola devriye gezen, can barlı Boss Slime ve çarpışma hasar bloklarını sahneye ekler.',
    descEn:
      'Spawns a patrolling Boss Enemy with health bar and auto-wires collision damage blocks.',
    badge: 'CharacterBody2D + AI Blocks',
    accentColor: '#EF4444',
    spawn: (scene) => {
      const boss = createDefaultObject('enemy', 520, 310, 'layer_main', scene.objects.length + 1);
      boss.name = `Boss_Slime_${scene.objects.filter((o) => o.role === 'enemy').length + 1}`;
      boss.width = 52;
      boss.height = 48;
      boss.collision.width = 52;
      boss.collision.height = 48;
      boss.hp = 120;
      boss.maxHp = 120;
      boss.patrolDistance = 130;
      boss.patrolSpeed = 95;
      boss.vfx = {
        lightEnabled: true,
        lightColor: '#EF4444',
        lightRadius: 110,
        lightIntensity: 0.6,
        particlePreset: 'aura',
      };
      return {
        newObjects: [boss],
        extraBlocksCount: 0,
        updatedScene: {
          ...scene,
          objects: [...scene.objects, boss],
        },
      };
    },
  },
  {
    id: 'prefab_coin_combo_arc',
    titleTr: '💎 3’lü Altın Kemeri + Skor Sistemi',
    titleEn: '💎 3-Coin Jump Arc + Score Logic',
    descTr:
      'Zıplama rotasına uygun 3 adet parlayan altın ödülü ve +25 puan toplama kuralını ekler.',
    descEn:
      'Places a parabolic arc of 3 glowing coins and ensures collectible score blocks are active.',
    badge: '3x Area2D + Score',
    accentColor: '#F59E0B',
    spawn: (scene) => {
      const c1 = createDefaultObject('collectible', 280, 290, 'layer_main', scene.objects.length + 1);
      const c2 = createDefaultObject('collectible', 330, 250, 'layer_main', scene.objects.length + 2);
      const c3 = createDefaultObject('collectible', 380, 290, 'layer_main', scene.objects.length + 3);
      return {
        newObjects: [c1, c2, c3],
        extraBlocksCount: 0,
        updatedScene: {
          ...scene,
          objects: [...scene.objects, c1, c2, c3],
        },
      };
    },
  },
  {
    id: 'prefab_checkpoint_station',
    titleTr: '🚩 Kayıt Noktası + Can İksiri İstasyonu',
    titleEn: '🚩 Checkpoint + Health Potion Station',
    descTr:
      'Harita sınırından düşünce geri doğacağınız aktif kayıt kristali ve +35 Can veren iksir ekler.',
    descEn:
      'Adds a respawn checkpoint crystal alongside a +35 HP healing potion.',
    badge: 'Checkpoint + PowerUp',
    accentColor: '#10B981',
    spawn: (scene) => {
      const cp = createDefaultObject('checkpoint', 440, 320, 'layer_main', scene.objects.length + 1);
      const pot = createDefaultObject('powerup', 485, 340, 'layer_main', scene.objects.length + 2);
      return {
        newObjects: [cp, pot],
        extraBlocksCount: 0,
        updatedScene: {
          ...scene,
          objects: [...scene.objects, cp, pot],
        },
      };
    },
  },
  {
    id: 'prefab_moving_elevator',
    titleTr: '🛗 Hareketli Platform + Trambolin Yay',
    titleEn: '🛗 Moving Platform + Bounce Pad',
    descTr:
      'Kahramanı üzerinde taşıyan yatay hareketli platform ve yüksek yerlere fırlatan trambolin yay ekler.',
    descEn:
      'Spawns a horizontal moving platform and a high-impulse bounce spring.',
    badge: 'MovingPlatform + Spring',
    accentColor: '#38BDF8',
    spawn: (scene) => {
      const mp = createDefaultObject('moving_platform', 360, 240, 'layer_main', scene.objects.length + 1);
      mp.patrolDistance = 120;
      mp.patrolSpeed = 85;
      const sp = createDefaultObject('bounce_pad', 230, 390, 'layer_main', scene.objects.length + 2);
      return {
        newObjects: [mp, sp],
        extraBlocksCount: 0,
        updatedScene: {
          ...scene,
          objects: [...scene.objects, mp, sp],
        },
      };
    },
  },
];

interface GameWizardAndPrefabsModalProps {
  isOpen: boolean;
  initialMode: 'wizard' | 'prefabs';
  lang: EngineLanguage;
  scene: GameScene;
  onClose: () => void;
  onApplyWizardProject: (project: GameProject) => void;
  onUpdateScene: (nextScene: GameScene, commitLabel: string) => void;
}

export const GameWizardAndPrefabsModal: React.FC<GameWizardAndPrefabsModalProps> = ({
  isOpen,
  initialMode,
  lang,
  scene,
  onClose,
  onApplyWizardProject,
  onUpdateScene,
}) => {
  const [mode, setMode] = useState<'wizard' | 'prefabs'>(initialMode);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [spawnNotice, setSpawnNotice] = useState<string | null>(null);

  const [config, setConfig] = useState<WizardConfig>({
    projectName: 'Siber Zümrüt Efsanesi',
    genre: 'platformer',
    themeBg: '#0F172A',
    heroSkin: 'knight',
    flipMode: 'horizontal',
    jumpMode: 'multi_jump',
    maxJumps: 2,
    wallJumpEnabled: true,
    enableLaserAbility: true,
    enableDashAbility: true,
    bottomBoundaryAction: 'respawn_damage',
    sideBoundaryAction: 'solid',
    addEnemyBarrierWall: true,
  });

  if (!isOpen) return null;

  const handleBuildWizardGame = () => {
    const baseTemplate = config.genre === 'topdown' ? 'topdown' : 'platformer';
    const proj = createProjectFromTemplate(baseTemplate, config.projectName);
    const sc = proj.scenes[0];

    sc.backgroundColor = config.themeBg;
    if (config.genre === 'sky_jumper') {
      sc.gravityY = 820;
    } else if (config.genre === 'topdown') {
      sc.gravityY = 0;
    } else {
      sc.gravityY = 980;
    }

    sc.worldBounds = {
      enabled: true,
      showGizmoInEditor: true,
      leftAction: config.sideBoundaryAction,
      rightAction: config.sideBoundaryAction,
      topAction: 'solid',
      bottomAction: config.bottomBoundaryAction,
      bottomDamage: 25,
      bouncePower: 540,
      targetFilter: 'all',
    };

    const skinColorMap: Record<
      WizardConfig['heroSkin'],
      { color: string; secondary: string }
    > = {
      hero: { color: '#2563EB', secondary: '#93C5FD' },
      knight: { color: '#475569', secondary: '#CBD5E1' },
      mage: { color: '#7C3AED', secondary: '#DDD6FE' },
      ninja: { color: '#1E293B', secondary: '#EF4444' },
      robot: { color: '#0284C7', secondary: '#34D399' },
    };

    sc.objects = sc.objects.map((obj) => {
      if (obj.role === 'player') {
        const palette = skinColorMap[config.heroSkin];
        return {
          ...obj,
          shapePreset: config.heroSkin,
          color: palette.color,
          secondaryColor: palette.secondary,
          physics: {
            ...obj.physics,
            flipMode: config.flipMode,
            jumpMode: config.jumpMode,
            maxJumps:
              config.jumpMode === 'grounded_only'
                ? 1
                : config.jumpMode === 'infinite'
                ? 999
                : config.maxJumps,
            wallJumpEnabled: config.wallJumpEnabled,
          },
        };
      }
      if (obj.role === 'invisible_wall' && config.addEnemyBarrierWall) {
        return {
          ...obj,
          collision: {
            ...obj.collision,
            wallTargetFilter: 'all' as InvisibleWallTargetFilter,
          },
        };
      }
      return obj;
    });

    if (config.addEnemyBarrierWall) {
      const enemyWall = createDefaultObject(
        'invisible_wall',
        520,
        260,
        'layer_main',
        sc.objects.length + 1
      );
      enemyWall.name = 'Sadece_Dusman_Siniri';
      enemyWall.width = 24;
      enemyWall.height = 120;
      enemyWall.collision.width = 24;
      enemyWall.collision.height = 120;
      enemyWall.collision.boundaryAction = 'solid';
      enemyWall.collision.wallTargetFilter = 'enemies_only';
      sc.objects.push(enemyWall);
    }

    if (!config.enableLaserAbility) {
      sc.blocks = sc.blocks.filter((b) => b.id !== 'blk_shoot_laser');
    }
    if (!config.enableDashAbility) {
      sc.blocks = sc.blocks.filter((b) => b.id !== 'blk_dash_move');
    }

    onApplyWizardProject(proj);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-4xl bg-[#141821] border border-[#2B3242] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0D1017] border-b border-[#2B3242] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('wizard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mode === 'wizard'
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white bg-[#181C24]'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>
                {lang === 'en'
                  ? '✨ 60-Second Interactive Game Wizard'
                  : '✨ 60 Saniyede İnteraktif Oyun Kurucu Sihirbaz'}
              </span>
            </button>
            <button
              onClick={() => setMode('prefabs')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mode === 'prefabs'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white bg-[#181C24]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>
                {lang === 'en'
                  ? '🧩 Smart Prefab & Mechanic Store'
                  : '🧩 Hazır Akıllı Prefab & Mekanik Mağazası'}
              </span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {mode === 'wizard' ? (
            <>
              {/* Stepper Bar */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  {
                    s: 1,
                    title: lang === 'en' ? '1. Genre & World' : '1. Oyun Türü & Atmosfer',
                  },
                  {
                    s: 2,
                    title: lang === 'en' ? '2. Hero & Facing' : '2. Kahraman & Yön Dönüşü',
                  },
                  {
                    s: 3,
                    title: lang === 'en' ? '3. Jump & Combat' : '3. Zıplama & Yetenekler',
                  },
                  {
                    s: 4,
                    title: lang === 'en' ? '4. Invisible Bounds' : '4. Görünmez Sınırlar',
                  },
                ].map((item) => (
                  <button
                    key={item.s}
                    onClick={() => setStep(item.s as 1 | 2 | 3 | 4)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-left transition-all ${
                      step === item.s
                        ? 'bg-indigo-600/25 border-indigo-400 text-white'
                        : step > item.s
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#0D1017] border-[#2B3242] text-slate-400'
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      {lang === 'en' ? 'Game Title' : 'Oyun Projenizin Adı'}
                    </label>
                    <input
                      type="text"
                      value={config.projectName}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, projectName: e.target.value }))
                      }
                      className="w-full bg-[#0D1017] border border-[#2B3242] rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      {lang === 'en' ? 'Choose Gameplay Style' : 'Oyun Türü Seçin'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        {
                          id: 'platformer',
                          title: '2D Aksiyon Platformer',
                          desc: 'Yerçekimi, hareketli platformlar, trambolin yaylar, kayıt noktaları ve Boss Slime savaşı.',
                        },
                        {
                          id: 'cyber_action',
                          title: 'Siberpunk Lazer & Dash Arenası',
                          desc: 'Hızlı dash atılmaları, lazer mermileri, duvar zıplaması ve dinamik neon ışıklandırma.',
                        },
                        {
                          id: 'sky_jumper',
                          title: 'Gökyüzü Çoklu / Sınırsız Zıplama',
                          desc: 'Düşük yerçekimi, havada çoklu veya sınırsız zıplama ve elastik seken harita sınırları.',
                        },
                        {
                          id: 'topdown',
                          title: 'Üstten Görünümlü RPG & Görev',
                          desc: 'Yerçekimsiz 4 yönlü serbest keşif, NPC diyalog ağacı, anahtar envanteri ve görev sistemi.',
                        },
                      ].map((g) => (
                        <div
                          key={g.id}
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              genre: g.id as WizardConfig['genre'],
                              jumpMode: g.id === 'sky_jumper' ? 'infinite' : prev.jumpMode,
                            }))
                          }
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            config.genre === g.id
                              ? 'bg-indigo-950/50 border-sky-400 shadow-lg'
                              : 'bg-[#0D1017] border-[#2B3242] hover:border-slate-600'
                          }`}
                        >
                          <div className="text-sm font-bold text-white mb-1">{g.title}</div>
                          <p className="text-xs text-slate-400 leading-relaxed">{g.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      {lang === 'en' ? 'World Atmosphere Color' : 'Dünya Atmosfer Teması'}
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {[
                        { hex: '#0F172A', name: 'Zümrüt Gece (#0F172A)' },
                        { hex: '#1E1B4B', name: 'Kristal Kozmos (#1E1B4B)' },
                        { hex: '#090D16', name: 'Siber Karanlık (#090D16)' },
                        { hex: '#27121B', name: 'Kızıl Kanyon (#27121B)' },
                        { hex: '#062825', name: 'Derin Okyanus (#062825)' },
                      ].map((th) => (
                        <button
                          key={th.hex}
                          onClick={() => setConfig((prev) => ({ ...prev, themeBg: th.hex }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
                            config.themeBg === th.hex
                              ? 'border-sky-400 bg-sky-500/15 text-white'
                              : 'border-[#2B3242] bg-[#0D1017] text-slate-300'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-white/30"
                            style={{ backgroundColor: th.hex }}
                          />
                          <span>{th.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Kahraman Görsel Sınıfı (Character Skin)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {[
                        { id: 'hero', name: '🚀 Uzay Kaşifi', tag: 'Pelerinli Klasik' },
                        { id: 'knight', name: '⚔️ Zırhlı Şövalye', tag: 'Enerji Kılıçlı' },
                        { id: 'mage', name: '🔮 Kristal Büyücü', tag: 'Işıklı Asalı' },
                        { id: 'ninja', name: '🥷 Gölge Ninja', tag: 'Hızlı Çevik' },
                        { id: 'robot', name: '🤖 Meka Robot', tag: 'Lazer Vizörlü' },
                      ].map((sk) => (
                        <div
                          key={sk.id}
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              heroSkin: sk.id as WizardConfig['heroSkin'],
                            }))
                          }
                          className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                            config.heroSkin === sk.id
                              ? 'bg-sky-500/20 border-sky-400 text-white'
                              : 'bg-[#0D1017] border-[#2B3242] text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-xs font-bold mb-1">{sk.name}</div>
                          <div className="text-[10px] text-slate-400">{sk.tag}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Sağa & Sola Giderken Yön Dönüşü (Facing Direction Flip)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          id: 'horizontal',
                          title: '↔ Yatay Aynala (Otomatik FlipH)',
                          desc: 'Karakter sola giderken sola, sağa giderken sağa döner (Pelerin, kılıç ve gözler yön değiştirir).',
                        },
                        {
                          id: 'rotate',
                          title: '🔄 180° Tam Döndürme',
                          desc: 'Yön değiştirdiğinde gövde açısını 180 derece çevirir.',
                        },
                        {
                          id: 'none',
                          title: '🔒 Sabit Yön (Dönmesin)',
                          desc: 'Karakter hareket etse bile her zaman aynı yöne bakar.',
                        },
                      ].map((fl) => (
                        <div
                          key={fl.id}
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              flipMode: fl.id as CharacterFlipMode,
                            }))
                          }
                          className={`p-3.5 rounded-xl border cursor-pointer ${
                            config.flipMode === fl.id
                              ? 'bg-emerald-500/15 border-emerald-400 text-white'
                              : 'bg-[#0D1017] border-[#2B3242] text-slate-300'
                          }`}
                        >
                          <div className="text-xs font-bold mb-1">{fl.title}</div>
                          <p className="text-[11px] text-slate-400">{fl.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Zıplama Modu & Hava Kontrolleri
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          id: 'grounded_only',
                          title: '⚓ Tek Zıplama (Zemin Şartlı)',
                          desc: 'Karakter tekrar yere basmadan havada ikinci kez zıplayamaz (Klasik Mario tarzı).',
                        },
                        {
                          id: 'multi_jump',
                          title: '🦘 Çoklu Zıplama (2x / 3x Hava Zıplaması)',
                          desc: 'Yere inmeden havada belirlediğiniz sayıda (Örn: Çift veya Üçlü) zıplayabilir.',
                        },
                        {
                          id: 'infinite',
                          title: '🚀 Sınırsız Zıplama (Jetpack / Flappy)',
                          desc: 'Havada sınır olmadan istediğiniz kadar zıplayabilirsiniz.',
                        },
                      ].map((jm) => (
                        <div
                          key={jm.id}
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              jumpMode: jm.id as JumpModeType,
                            }))
                          }
                          className={`p-3.5 rounded-xl border cursor-pointer ${
                            config.jumpMode === jm.id
                              ? 'bg-indigo-600/25 border-indigo-400 text-white'
                              : 'bg-[#0D1017] border-[#2B3242] text-slate-300'
                          }`}
                        >
                          <div className="text-xs font-bold mb-1">{jm.title}</div>
                          <p className="text-[11px] text-slate-400">{jm.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {config.jumpMode === 'multi_jump' && (
                    <div className="p-3.5 rounded-xl bg-[#0D1017] border border-[#2B3242] flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        Havada Maksimum Zıplama Hakkı (2 = Çift Zıplama, 3 = Üçlü Zıplama):
                      </span>
                      <div className="flex items-center gap-2">
                        {[2, 3, 4, 5].map((cnt) => (
                          <button
                            key={cnt}
                            onClick={() => setConfig((prev) => ({ ...prev, maxJumps: cnt }))}
                            className={`px-3 py-1 rounded-lg text-xs font-bold ${
                              config.maxJumps === cnt
                                ? 'bg-sky-500 text-white'
                                : 'bg-[#181C24] text-slate-400'
                            }`}
                          >
                            {cnt}x Zıplama
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <label className="flex items-center gap-2.5 p-3.5 rounded-xl bg-[#0D1017] border border-[#2B3242] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.wallJumpEnabled}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, wallJumpEnabled: e.target.checked }))
                        }
                        className="accent-sky-400 w-4 h-4"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">🧗 Duvar Zıplaması (Wall Jump)</div>
                        <div className="text-[10px] text-slate-400">Duvarlardan sekerek tırmanma</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3.5 rounded-xl bg-[#0D1017] border border-[#2B3242] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableLaserAbility}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            enableLaserAbility: e.target.checked,
                          }))
                        }
                        className="accent-sky-400 w-4 h-4"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">⚡ Lazer Ateşi [E / F Tuşu]</div>
                        <div className="text-[10px] text-slate-400">Baktığı yöne enerji mermisi atar</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3.5 rounded-xl bg-[#0D1017] border border-[#2B3242] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableDashAbility}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            enableDashAbility: e.target.checked,
                          }))
                        }
                        className="accent-sky-400 w-4 h-4"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">💨 Hızlı Dash [Shift Tuşu]</div>
                        <div className="text-[10px] text-slate-400">İleriye ani hız patlaması</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                        ⬇ Alt Görünmez Harita Sınırı (Uçurum) Davranışı
                      </label>
                      <select
                        value={config.bottomBoundaryAction}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            bottomBoundaryAction: e.target.value as BoundaryCollisionAction,
                          }))
                        }
                        className="w-full bg-[#0D1017] border border-[#2B3242] rounded-xl px-3.5 py-2.5 text-xs font-bold text-rose-300"
                      >
                        <option value="respawn_damage">
                          Başlangıca / Kayıt Noktasına Döndür + Can Azalt
                        </option>
                        <option value="bounce">Trambolin Gibi Yukarı Sektir (Bounce)</option>
                        <option value="wrap">Üst Tavandan Geri Çıkar (Ekran Sarma / Wrap)</option>
                        <option value="solid">Katı Zemin Gibi Durdur (Düşmeyi Engelle)</option>
                        <option value="gameover">Anında Oyunu Bitir (Game Over)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                        ⬅➡ Sol & Sağ Görünmez Harita Sınırları
                      </label>
                      <select
                        value={config.sideBoundaryAction}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            sideBoundaryAction: e.target.value as BoundaryCollisionAction,
                          }))
                        }
                        className="w-full bg-[#0D1017] border border-[#2B3242] rounded-xl px-3.5 py-2.5 text-xs font-bold text-sky-300"
                      >
                        <option value="solid">Katı Görünmez Duvar (Harita Dışına Çıkamaz)</option>
                        <option value="wrap">Karşı Kenardan Çıkar (Pac-Man Tarzı Wrap)</option>
                        <option value="bounce">İçeriye Doğru Geri Sektir (Bounce)</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.addEnemyBarrierWall}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          addEnemyBarrierWall: e.target.checked,
                        }))
                      }
                      className="accent-cyan-400 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-cyan-300">
                        🛡️ Sahneye "Sadece Düşmanları Durduran" Özel Görünmez Duvar Ekle (enemies_only)
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Kahraman bu görünmez duvardan serbestçe geçebilirken Boss Slime platformdan aşağı düşmez!
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* Wizard Footer Navigation */}
              <div className="pt-4 border-t border-[#2B3242] flex items-center justify-between">
                <button
                  onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
                  disabled={step === 1}
                  className="px-4 py-2 rounded-xl bg-[#181C24] hover:bg-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40"
                >
                  ← Önceki Adım
                </button>

                <div className="flex items-center gap-2.5">
                  {step < 4 ? (
                    <button
                      onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3 | 4))}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg"
                    >
                      <span>Sonraki Adım</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : null}

                  <button
                    onClick={handleBuildWizardGame}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-extrabold text-white shadow-xl"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>🚀 Oyunumu Şimdi İnşa Et ve Sahneyi Aç!</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Smart Prefabs Catalog */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-emerald-300">
                    🧩 Tek Tıkla Sahneye Akıllı Prefab & Mekanik Ekle
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Bu hazır paketler yalnızca nesneyi değil; fizik ayarlarını, karakter filtrelerini ve görsel efektlerini otomatik yapılandırarak aktif sahneye (`{scene.name}`) ekler.
                  </p>
                </div>
                {spawnNotice && (
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold animate-bounce">
                    ✓ {spawnNotice}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {SMART_PREFAB_CATALOG.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-[#0D1017] border border-[#2B3242] hover:border-slate-600 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-bold text-white">
                          {lang === 'en' ? item.titleEn : item.titleTr}
                        </span>
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold"
                          style={{
                            backgroundColor: `${item.accentColor}20`,
                            color: item.accentColor,
                          }}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {lang === 'en' ? item.descEn : item.descTr}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        const res = item.spawn(scene);
                        onUpdateScene(
                          res.updatedScene,
                          `Prefab Eklendi: ${item.titleTr}`
                        );
                        setSpawnNotice(`${item.titleTr} sahneye eklendi!`);
                        setTimeout(() => setSpawnNotice(null), 2200);
                      }}
                      className="w-full py-2 rounded-lg bg-[#181C24] hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-colors"
                    >
                      + Sahneye Şimdi Ekle ({scene.name})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
