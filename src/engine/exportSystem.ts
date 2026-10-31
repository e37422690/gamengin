import JSZip from 'jszip';
import {
  ENGINE_VERSION,
  ExportManifest,
  GameProject,
  SCHEMA_VERSION,
} from '../types/engine';
import { compileBlocksToIR, generateReadableCode } from './blockSystem';
import { getEmbeddedVectorRendererScript } from './sharedRenderer';
import { loadAssetBinaryFromStorage, migrateProjectData } from './storageSystem';

const MAX_IMPORT_ZIP_BYTES = 50 * 1024 * 1024; // 50 MB güvenlik sınırı

export function computeChecksum(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createExportManifest(
  project: GameProject,
  format: ExportManifest['format']
): ExportManifest {
  const blockCount = project.scenes.reduce((acc, s) => acc + s.blocks.length, 0);
  const serialized = JSON.stringify(project);
  return {
    format,
    projectId: project.id,
    projectName: project.name,
    projectVersion: project.version,
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    exportedAt: new Date().toISOString(),
    sceneCount: project.scenes.length,
    assetCount: project.assets.length,
    blockCount,
    checksum: computeChecksum(serialized),
  };
}

/**
 * Editör içindeki GameRuntimeEngine + drawGameObjectOnCanvas + WebAudio + HUD ile
 * %100 BİREBİR AYNI GÖRÜNÜM VE FİZİK DİNAMİKLERİNE sahip bağımsız çalışma zamanı kodu üretir.
 */
export function buildFullParityStandaloneRuntimeScript(project: GameProject): string {
  const compiledScenes = project.scenes.map((s) => ({
    ...s,
    irRules: compileBlocksToIR(s.blocks),
  }));
  const payload = JSON.stringify({
    name: project.name,
    startSceneId: project.startSceneId,
    settings: project.settings,
    variables: project.variables,
    scenes: compiledScenes,
  });

  const embeddedDrawFn = getEmbeddedVectorRendererScript();

  return `
(function() {
  const GAME_DATA = ${payload};
  ${embeddedDrawFn}

  // Web Audio Sentezleyici (Editör içi audioSystem ile birebir aynı)
  let audioCtx = null;
  let muted = false;
  let masterVol = (GAME_DATA.settings && GAME_DATA.settings.defaultVolume ? GAME_DATA.settings.defaultVolume : 80) / 100;

  function playPreset(preset) {
    if (muted || masterVol <= 0) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const vol = masterVol * 0.18;
      if (preset === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.16);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now); osc.stop(now + 0.18);
      } else if (preset === 'coin') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.07);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
      } else if (preset === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.2);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now); osc.stop(now + 0.22);
      } else if (preset === 'victory') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.1);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        osc.frequency.setValueAtTime(880, now + 0.3);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now); osc.stop(now + 0.55);
      } else if (preset === 'laser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(780, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.14);
        gain.gain.setValueAtTime(vol * 0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.1);
        gain.gain.setValueAtTime(vol * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now); osc.stop(now + 0.12);
      }
    } catch (e) {}
  }

  function checkCollisionOverlap(a, b) {
    if (a.id === b.id || !a.visible || !b.visible) return false;
    if (!a.collision || !b.collision || a.collision.shape === 'none' || b.collision.shape === 'none') return false;
    const ax = a.x + (a.collision.offsetX || 0);
    const ay = a.y + (a.collision.offsetY || 0);
    const aw = a.collision.width * Math.abs(a.scaleX || 1);
    const ah = a.collision.height * Math.abs(a.scaleY || 1);
    const bx = b.x + (b.collision.offsetX || 0);
    const by = b.y + (b.collision.offsetY || 0);
    const bw = b.collision.width * Math.abs(b.scaleX || 1);
    const bh = b.collision.height * Math.abs(b.scaleY || 1);
    if (a.collision.shape === 'circle' && b.collision.shape === 'circle') {
      const acx = ax + aw / 2, acy = ay + ah / 2;
      const bcx = bx + bw / 2, bcy = by + bh / 2;
      const rSum = (a.collision.radius || 14) + (b.collision.radius || 14);
      const dx = acx - bcx, dy = acy - bcy;
      return dx * dx + dy * dy <= rSum * rSum;
    }
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('hud-score');
  const hpTextEl = document.getElementById('hud-hp-text');
  const hpPipsEl = document.getElementById('hud-hp-pips');
  const msgEl = document.getElementById('hud-msg');
  const questsEl = document.getElementById('hud-quests');
  const invEl = document.getElementById('hud-inv');
  const sceneTitleEl = document.getElementById('hud-scene-title');
  const fpsEl = document.getElementById('hud-fps');
  const dlgModal = document.getElementById('dialogue-overlay');
  const dlgSpeaker = document.getElementById('dlg-speaker');
  const dlgText = document.getElementById('dlg-text');
  const dlgChoices = document.getElementById('dlg-choices');
  const statusModal = document.getElementById('status-modal');
  const statusTitle = document.getElementById('status-title');
  const statusReasonEl = document.getElementById('status-reason');
  const statusScoreEl = document.getElementById('status-score');
  const statusHpEl = document.getElementById('status-hp');
  const statusTimeEl = document.getElementById('status-time');
  const btnResume = document.getElementById('btn-modal-resume');

  let activeScene = null;
  let objects = [];
  let floatingTexts = [];
  let quests = [];
  let inventory = [];
  let variables = {};
  let activeDialogue = null;
  let score = 0;
  let status = 'playing';
  let statusReason = '';
  let bannerMessage = '';
  let cameraX = 0, cameraY = 0;
  let shakeTimer = 0, shakeIntensity = 0;
  let lastShotTime = -999;
  let elapsedSec = 0;
  let fps = 60;

  const keysHeld = new Set();
  const keysJustPressed = new Set();
  const collisionCooldowns = new Map();
  const timerAccumulators = new Map();

  for (const v of (GAME_DATA.variables || [])) {
    variables[v.name] = v.initialValue;
  }

  function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text: text, x: x, y: y, color: color || '#FBBF24', ttl: 0.95 });
  }

  function getTargetObject(targetId) {
    if (targetId === 'scene') {
      return objects.find(o => o.role === 'player') || objects[0] || null;
    }
    return objects.find(o => o.id === targetId) || null;
  }

  function triggerStateEvent(subjectObj, stateName) {
    for (const r of (activeScene.irRules || [])) {
      if (r.eventType !== 'event_state_changed') continue;
      if (r.targetObjectId !== 'scene' && r.targetObjectId !== subjectObj.id) continue;
      if (String(r.eventParams.state || 'landed') === stateName) executeActionList(r.actions, null);
    }
  }

  function triggerAnimEvent(subjectObj, clipName, phase) {
    for (const r of (activeScene.irRules || [])) {
      if (r.eventType !== 'event_anim_trigger') continue;
      if (r.targetObjectId !== 'scene' && r.targetObjectId !== subjectObj.id) continue;
      if (String(r.eventParams.clip || 'attack') === clipName && String(r.eventParams.triggerPhase || 'on_start') === phase) {
        executeActionList(r.actions, null);
      }
    }
  }

  function triggerBoundaryEvent(subjectObj, edge) {
    const cooldownKey = 'bound_' + subjectObj.id + '_' + edge;
    const lastHit = collisionCooldowns.get(cooldownKey) ?? -999;
    if (elapsedSec - lastHit < 0.25) return;
    collisionCooldowns.set(cooldownKey, elapsedSec);
    for (const r of (activeScene.irRules || [])) {
      if (r.eventType !== 'event_boundary_hit') continue;
      if (r.targetObjectId !== 'scene' && r.targetObjectId !== subjectObj.id) continue;
      const wantedEdge = String(r.eventParams.edge || 'any');
      if (wantedEdge === 'any' || wantedEdge === edge) executeActionList(r.actions, null);
    }
  }

  function applyBoundaryAction(obj, edge, action, bouncePower, damage) {
    bouncePower = bouncePower || 520;
    damage = damage ?? 25;
    triggerBoundaryEvent(obj, edge);
    if (action === 'bounce') {
      if (edge === 'left') { obj.physics.velocityX = Math.abs(bouncePower); obj.facingDir = 1; }
      else if (edge === 'right') { obj.physics.velocityX = -Math.abs(bouncePower); obj.facingDir = -1; }
      else if (edge === 'top') { obj.physics.velocityY = Math.abs(bouncePower * 0.75); }
      else if (edge === 'bottom') { obj.physics.velocityY = -Math.abs(bouncePower); obj.grounded = false; }
      playPreset('jump');
      addFloatingText('⚡ SINIR SEKMESİ!', obj.x + obj.width / 2, obj.y - 10, '#38BDF8');
    } else if (action === 'wrap') {
      const cam = activeScene.camera || {};
      const minX = cam.boundsX || 0;
      const maxX = Math.max(minX + 320, minX + (cam.boundsWidth || 1600));
      const minY = cam.boundsY || 0;
      const maxY = Math.max(minY + 240, minY + (cam.boundsHeight || 620));
      if (edge === 'left') obj.x = maxX - obj.width - 6;
      else if (edge === 'right') obj.x = minX + 6;
      else if (edge === 'top') obj.y = maxY - obj.height - 6;
      else if (edge === 'bottom') obj.y = minY + 6;
      addFloatingText('🌀 EKRAN GEÇİŞİ', obj.x + obj.width / 2, obj.y - 8, '#A855F7');
    } else if (action === 'respawn_damage') {
      obj.x = obj.originX;
      obj.y = obj.originY;
      obj.physics.velocityX = 0;
      obj.physics.velocityY = 0;
      if (obj.role === 'player' && damage > 0) {
        obj.hp = Math.max(0, obj.hp - damage);
        shakeIntensity = 7;
        shakeTimer = 0.25;
        playPreset('hit');
        bannerMessage = 'Harita sınırından düştün! Başlangıç noktasına döndün (-' + damage + ' Can)';
        addFloatingText('-' + damage + ' CAN (BAŞA DÖNDÜ)', obj.x + obj.width / 2, obj.y - 12, '#F43F5E');
        triggerStateEvent(obj, 'damaged');
      }
    } else if (action === 'gameover' && obj.role === 'player') {
      obj.hp = 0;
      status = 'gameover';
      statusReason = 'Harita sınırından çıkıldı!';
      syncHudDom();
    } else if (action === 'victory' && obj.role === 'player') {
      status = 'victory';
      statusReason = 'Sınır hedefine ulaşıldı!';
      syncHudDom();
    } else {
      if (edge === 'left' || edge === 'right') obj.physics.velocityX = 0;
      else if (edge === 'top' && obj.physics.velocityY < 0) obj.physics.velocityY = 0;
      else if (edge === 'bottom') {
        obj.physics.velocityY = 0;
        obj.grounded = true;
        obj.coyoteTimer = 0.12;
        obj.jumpsLeft = obj.maxJumps;
      }
    }
  }

  function loadScene(sceneId, isInitial) {
    const found = GAME_DATA.scenes.find(s => s.id === sceneId) || GAME_DATA.scenes[0];
    activeScene = JSON.parse(JSON.stringify(found));
    if (!activeScene.worldBounds) {
      activeScene.worldBounds = {
        enabled: true,
        showGizmoInEditor: true,
        leftAction: 'solid',
        rightAction: 'solid',
        topAction: 'solid',
        bottomAction: 'respawn_damage',
        bottomDamage: 25,
        bouncePower: 520
      };
    }
    quests = JSON.parse(JSON.stringify(activeScene.quests || []));
    activeDialogue = null;
    floatingTexts = [];
    collisionCooldowns.clear();
    timerAccumulators.clear();
    objects = activeScene.objects.map(o => {
      const jumpMode = (o.physics && o.physics.jumpMode) || 'multi_jump';
      const maxJumps = jumpMode === 'infinite' ? 999 : jumpMode === 'grounded_only' ? 1 : Math.max(1, (o.physics && o.physics.maxJumps) || 2);
      return Object.assign({}, JSON.parse(JSON.stringify(o)), {
        originX: o.x,
        originY: o.y,
        grounded: false,
        coyoteTimer: 0,
        jumpsLeft: maxJumps,
        maxJumps: maxJumps,
        touchingWallDir: 0,
        patrolDir: 1,
        facingDir: (o.physics && o.physics.initialFacing) || 1,
        animTimer: 0,
        animFrameIndex: 0,
        animLockTimer: 0
      });
    });
    for (const rule of (activeScene.irRules || [])) {
      if ((isInitial && rule.eventType === 'event_game_start') || rule.eventType === 'event_scene_enter') {
        executeActionList(rule.actions, null);
      }
    }
    syncHudDom();
  }

  function restartGame() {
    status = 'playing';
    statusReason = '';
    score = 0;
    inventory = [];
    elapsedSec = 0;
    loadScene(activeScene ? activeScene.id : GAME_DATA.startSceneId, true);
  }

  function executeActionList(actions, otherObj, budget) {
    budget = budget || { count: 0, max: 250 };
    for (const act of (actions || [])) {
      if (budget.count++ > budget.max) break;
      if (act.disabled) continue;
      const target = getTargetObject(act.targetObjectId);
      switch (act.type) {
        case 'move_horizontal':
          if (target) {
            const spd = Number(act.params.speed || 0);
            target.physics.velocityX = spd;
            const prevFacing = target.facingDir;
            if (target.physics.flipMode !== 'none') {
              if (spd > 0) target.facingDir = 1;
              else if (spd < 0) target.facingDir = -1;
            }
            if (target.physics.flipMode === 'rotate') target.rotation = target.facingDir < 0 ? 180 : 0;
            if (prevFacing !== target.facingDir) triggerStateEvent(target, target.facingDir < 0 ? 'turned_left' : 'turned_right');
          }
          break;
        case 'move_set_facing':
          if (target) {
            const dirParam = String(act.params.direction || 'right');
            const flipModeParam = String(act.params.flipMode || 'horizontal');
            target.physics.flipMode = flipModeParam;
            const prevFacing = target.facingDir;
            if (dirParam === 'left') target.facingDir = -1;
            else if (dirParam === 'right') target.facingDir = 1;
            else if (dirParam === 'toggle') target.facingDir = target.facingDir === 1 ? -1 : 1;
            target.rotation = flipModeParam === 'rotate' && target.facingDir < 0 ? 180 : 0;
            if (prevFacing !== target.facingDir) triggerStateEvent(target, target.facingDir < 0 ? 'turned_left' : 'turned_right');
          }
          break;
        case 'move_vertical':
          if (target) target.physics.velocityY = Number(act.params.speed || 0);
          break;
        case 'move_jump':
          if (target) {
            const jumpMode = target.physics.jumpMode || 'multi_jump';
            const force = Math.abs(Number(act.params.force || target.physics.jumpForce || 460));
            const gSign = Math.sign(target.physics.gravityScale || 1) || 1;
            const canGroundJump = target.grounded || target.coyoteTimer > 0 || activeScene.gravityY === 0;
            if (canGroundJump) {
              target.physics.velocityY = -gSign * force;
              target.grounded = false;
              target.coyoteTimer = 0;
              const configuredMax = jumpMode === 'infinite' ? 999 : jumpMode === 'grounded_only' ? 1 : Math.max(1, target.physics.maxJumps || 2);
              target.maxJumps = configuredMax;
              target.jumpsLeft = Math.max(0, configuredMax - 1);
              triggerStateEvent(target, 'jumped');
            } else if (target.physics.wallJumpEnabled && target.touchingWallDir !== 0) {
              target.physics.velocityY = -gSign * force * 0.95;
              target.physics.velocityX = -target.touchingWallDir * 290;
              target.facingDir = -target.touchingWallDir;
              target.touchingWallDir = 0;
              playPreset('jump');
              addFloatingText('🧗 DUVAR ZIPLAMASI!', target.x + target.width / 2, target.y - 10, '#38BDF8');
              triggerStateEvent(target, 'double_jumped');
            } else if (jumpMode === 'infinite') {
              target.physics.velocityY = -gSign * force;
              target.grounded = false;
              addFloatingText('🚀 SINIRSIZ ZIPLAMA', target.x + target.width / 2, target.y - 8, '#A855F7');
              triggerStateEvent(target, 'double_jumped');
            } else if (jumpMode === 'multi_jump' && target.jumpsLeft > 0) {
              target.jumpsLeft -= 1;
              target.physics.velocityY = -gSign * force * 0.92;
              target.grounded = false;
              addFloatingText('✨ HAVA ZIPLAMASI (' + (target.maxJumps - target.jumpsLeft) + '/' + target.maxJumps + ')', target.x + target.width / 2, target.y - 8, '#38BDF8');
              triggerStateEvent(target, 'double_jumped');
            }
          }
          break;
        case 'physics_set_jump_mode':
          if (target) {
            const newMode = String(act.params.jumpMode || 'multi_jump');
            const newMax = Math.max(1, Number(act.params.maxJumps || 2));
            target.physics.jumpMode = newMode;
            target.physics.maxJumps = newMax;
            target.maxJumps = newMode === 'infinite' ? 999 : newMode === 'grounded_only' ? 1 : newMax;
            target.jumpsLeft = target.maxJumps;
            addFloatingText(newMode === 'infinite' ? '🚀 SINIRSIZ ZIPLAMA!' : newMode === 'grounded_only' ? '⚓ TEK ZIPLAMA MODU' : '🦘 ' + newMax + 'X ÇOKLU ZIPLAMA', target.x + target.width / 2, target.y - 12, '#34D399');
          }
          break;
        case 'world_set_boundary_action': {
          if (!activeScene.worldBounds) activeScene.worldBounds = { enabled: true };
          const edge = String(act.params.edge || 'bottom');
          const action = String(act.params.action || 'respawn_damage');
          if (edge === 'left') activeScene.worldBounds.leftAction = action;
          else if (edge === 'right') activeScene.worldBounds.rightAction = action;
          else if (edge === 'top') activeScene.worldBounds.topAction = action;
          else if (edge === 'all') {
            activeScene.worldBounds.leftAction = action;
            activeScene.worldBounds.rightAction = action;
            activeScene.worldBounds.topAction = action;
            activeScene.worldBounds.bottomAction = action;
          } else activeScene.worldBounds.bottomAction = action;
          break;
        }
        case 'world_set_wall_filter': {
          const filter = String(act.params.filter || 'all');
          const customTarget = String(act.params.customTarget || '').trim();
          if (target && target.role === 'invisible_wall' && target.collision) {
            target.collision.wallTargetFilter = filter;
            if (filter === 'custom' && customTarget) target.collision.wallTargetIds = [customTarget];
          } else {
            objects.forEach(w => {
              if (w.role === 'invisible_wall' && w.collision) {
                w.collision.wallTargetFilter = filter;
                if (filter === 'custom' && customTarget) w.collision.wallTargetIds = [customTarget];
              }
            });
            if (activeScene.worldBounds) {
              activeScene.worldBounds.targetFilter = filter;
              if (filter === 'custom' && customTarget) activeScene.worldBounds.targetIds = [customTarget];
            }
          }
          break;
        }
        case 'move_dash':
          if (target) {
            const power = Math.abs(Number(act.params.power || 540));
            const dir = target.facingDir || 1;
            target.physics.velocityX = dir * power;
            target.activeAnimation = 'dash';
            target.animLockTimer = 0.25;
            playPreset('jump');
            addFloatingText('💨 DASH!', target.x + target.width / 2, target.y - 8, '#38BDF8');
            triggerAnimEvent(target, 'dash', 'on_start');
          }
          break;
        case 'act_shoot_projectile':
          if (target && elapsedSec - lastShotTime >= 0.16) {
            lastShotTime = elapsedSec;
            const speed = Math.abs(Number(act.params.speed || 520));
            const damage = Math.abs(Number(act.params.damage || 30));
            const dir = target.facingDir || 1;
            const spawnX = dir > 0 ? target.x + target.width + 4 : target.x - 28;
            const spawnY = target.y + Math.round(target.height * 0.38);
            target.activeAnimation = 'attack';
            target.animLockTimer = 0.22;
            triggerAnimEvent(target, 'attack', 'on_start');
            objects.push({
              id: 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              name: 'Lazer_Mermisi',
              role: 'projectile',
              layerId: target.layerId || 'layer_main',
              x: spawnX,
              y: spawnY,
              width: 24,
              height: 10,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              zIndex: 12,
              visible: true,
              color: '#38BDF8',
              secondaryColor: '#E0F2FE',
              shapePreset: 'laser_bolt',
              hp: 1,
              maxHp: 1,
              collision: { shape: 'rect', isStatic: false, isTrigger: true, offsetX: 0, offsetY: 0, width: 24, height: 10, radius: 6, bounciness: 0 },
              physics: { enabled: true, gravityScale: 0, velocityX: dir * speed, velocityY: 0, maxSpeed: speed, jumpForce: 0, friction: 1 },
              vfx: { lightEnabled: true, lightColor: '#38BDF8', lightRadius: 55, lightIntensity: 0.7 },
              originX: spawnX,
              originY: spawnY,
              grounded: false,
              coyoteTimer: 0,
              jumpsLeft: 0,
              maxJumps: 0,
              touchingWallDir: 0,
              patrolDir: dir,
              facingDir: dir,
              animTimer: 0,
              animFrameIndex: 0,
              projectileDamage: damage,
              lifetimeSec: 1.6
            });
            playPreset('laser');
          }
          break;
        case 'physics_flip_gravity':
          if (target) {
            target.physics.gravityScale = -(target.physics.gravityScale || 1);
            target.grounded = false;
            addFloatingText('⇅ YERÇEKİMİ TERS!', target.x, target.y - 10, '#A855F7');
          }
          break;
        case 'camera_shake':
          shakeIntensity = Math.max(2, Number(act.params.intensity || 8));
          shakeTimer = 0.28;
          break;
        case 'move_to_position':
          if (target) { target.x = Number(act.params.x || target.x); target.y = Number(act.params.y || target.y); }
          break;
        case 'move_rotate':
          if (target) target.rotation = ((target.rotation || 0) + Number(act.params.degrees || 15)) % 360;
          break;
        case 'move_stop':
          if (target) { target.physics.velocityX = 0; target.physics.velocityY = 0; }
          break;
        case 'ui_add_score': {
          const pts = Number(act.params.points || 10);
          score += pts;
          if (target) addFloatingText(pts >= 0 ? '+' + pts : String(pts), target.x + target.width / 2, target.y - 10, '#FBBF24');
          break;
        }
        case 'ui_show_message':
          bannerMessage = String(act.params.text || '');
          break;
        case 'ui_start_dialogue': {
          const dlgId = String(act.params.dialogueId || 'dlg_intro');
          const dlg = (activeScene.dialogues || []).find(d => d.id === dlgId) || (activeScene.dialogues || [])[0];
          if (dlg) activeDialogue = dlg;
          break;
        }
        case 'audio_play_sfx':
          playPreset(String(act.params.sound || 'coin'));
          break;
        case 'audio_set_volume':
          masterVol = Math.max(0, Math.min(1, Number(act.params.volume || 80) / 100));
          break;
        case 'sense_destroy_other':
          if (otherObj) otherObj.visible = false;
          break;
        case 'sense_damage_target':
          if (target) {
            const delta = Number(act.params.amount || -20);
            target.hp = Math.max(0, Math.min(target.maxHp || 100, target.hp + delta));
            addFloatingText(delta >= 0 ? '+' + delta + ' CAN' : delta + ' CAN', target.x + target.width / 2, target.y - 12, delta >= 0 ? '#34D399' : '#F43F5E');
            if (delta < 0) triggerStateEvent(target, 'damaged');
          }
          break;
        case 'anim_play':
          if (target) {
            const clip = String(act.params.clip || 'move');
            target.activeAnimation = clip;
            if (clip === 'attack' || clip === 'dash') target.animLockTimer = 0.28;
            triggerAnimEvent(target, clip, 'on_start');
          }
          break;
        case 'anim_set_character_skin':
          if (target) {
            const skin = String(act.params.skin || 'knight');
            target.shapePreset = skin;
            const skinColors = {
              hero: { color: '#38BDF8', secondary: '#0284C7' },
              knight: { color: '#94A3B8', secondary: '#475569' },
              mage: { color: '#A855F7', secondary: '#6B21A8' },
              ninja: { color: '#1E293B', secondary: '#0F172A' },
              robot: { color: '#38BDF8', secondary: '#0369A1' }
            };
            if (skinColors[skin]) {
              target.color = skinColors[skin].color;
              target.secondaryColor = skinColors[skin].secondary;
            }
            addFloatingText('🎭 SINIF: ' + skin.toUpperCase(), target.x + target.width / 2, target.y - 10, '#C084FC');
          }
          break;
        case 'scene_change': {
          const reqId = String(act.params.sceneId || 'next');
          if (reqId === 'next') {
            const idx = GAME_DATA.scenes.findIndex(s => s.id === activeScene.id);
            const nextS = GAME_DATA.scenes[(idx + 1) % GAME_DATA.scenes.length];
            if (nextS) loadScene(nextS.id, false);
          } else {
            loadScene(reqId, false);
          }
          return;
        }
        case 'scene_restart':
          restartGame();
          return;
        case 'scene_victory':
          status = 'victory';
          statusReason = String(act.params.reason || 'Bölüm Tamamlandı!');
          syncHudDom();
          return;
        case 'scene_gameover':
          status = 'gameover';
          statusReason = String(act.params.reason || 'Oyun Bitti!');
          syncHudDom();
          return;
        case 'var_set':
          variables[String(act.params.varName || 'var')] = act.params.value || 0;
          break;
        case 'var_change': {
          const k = String(act.params.varName || 'var');
          variables[k] = Number(variables[k] || 0) + Number(act.params.delta || 1);
          break;
        }
        case 'adv_inventory_add': {
          const item = String(act.params.itemName || 'Eşya');
          if (!inventory.includes(item)) {
            inventory.push(item);
            bannerMessage = 'Envantere eklendi: ' + item;
          }
          break;
        }
        case 'adv_quest_start': {
          const q = quests.find(it => it.id === String(act.params.questId || ''));
          if (q && q.status === 'inactive') { q.status = 'active'; bannerMessage = 'Yeni Görev: ' + q.title; }
          break;
        }
        case 'adv_quest_complete': {
          const q = quests.find(it => it.id === String(act.params.questId || ''));
          if (q && q.status !== 'completed') { q.status = 'completed'; score += (q.rewardScore || 50); bannerMessage = 'Görev Tamamlandı: ' + q.title; }
          break;
        }
        case 'adv_enemy_patrol':
          if (target) { target.patrolDistance = Number(act.params.range || 120); target.patrolSpeed = Number(act.params.speed || 95); }
          break;
        case 'adv_follow_player':
          if (target) {
            const pl = objects.find(o => o.role === 'player');
            if (pl) {
              const spd = Number(act.params.speed || 85);
              const dx = pl.x - target.x, dy = pl.y - target.y;
              const dist = Math.hypot(dx, dy) || 1;
              target.physics.velocityX = (dx / dist) * spd;
              if (target.physics.flipMode !== 'none') target.facingDir = dx >= 0 ? 1 : -1;
              if (activeScene.gravityY === 0) target.physics.velocityY = (dy / dist) * spd;
            }
          }
          break;
        case 'control_if_score_gte':
          if (score >= Number(act.params.threshold || 50)) executeActionList(act.children || [], otherObj, budget);
          break;
        case 'control_repeat_count': {
          const cnt = Math.max(1, Math.min(50, Number(act.params.count || 3)));
          for (let i = 0; i < cnt; i++) executeActionList(act.children || [], otherObj, budget);
          break;
        }
      }
    }
    syncHudDom();
  }

  function syncHudDom() {
    const player = objects.find(o => o.role === 'player');
    const hp = player ? player.hp : 100;
    const maxHp = player ? player.maxHp : 100;
    if (scoreEl) scoreEl.textContent = String(Math.round(score));
    if (hpTextEl) hpTextEl.textContent = 'CAN (' + hp + '/' + maxHp + ')';
    if (sceneTitleEl && activeScene) sceneTitleEl.textContent = activeScene.name;
    if (fpsEl) fpsEl.textContent = fps + ' FPS · Süre: ' + elapsedSec.toFixed(1) + 's';
    if (msgEl) msgEl.textContent = bannerMessage || 'Ok tuşları / WASD ile hareket, Space zıpla, E/F Lazer, Shift Dash!';

    if (hpPipsEl) {
      const filled = Math.max(0, Math.min(5, Math.ceil((hp / Math.max(1, maxHp)) * 5)));
      let svgHtml = '';
      for (let i = 0; i < 5; i++) {
        const fill = i < filled ? '#EF4444' : '#1E293B';
        svgHtml += '<svg viewBox="0 0 24 24" class="pip-icon"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="' + fill + '" stroke="#0F172A" stroke-width="2"/></svg>';
      }
      hpPipsEl.innerHTML = svgHtml;
    }

    if (questsEl) {
      questsEl.innerHTML = quests.map(q =>
        '<div class="quest-row"><span style="color:' + (q.status === 'completed' ? '#34D399' : '#FBBF24') + '">●</span> <span>' + q.title + '</span></div>'
      ).join('');
    }
    if (invEl) {
      invEl.textContent = inventory.length > 0 ? 'Çanta: ' + inventory.join(', ') : '';
    }

    if (dlgModal) {
      if (activeDialogue) {
        dlgModal.style.display = 'block';
        dlgSpeaker.textContent = activeDialogue.speaker;
        dlgText.textContent = activeDialogue.text;
        dlgChoices.innerHTML = '';
        (activeDialogue.choices || []).forEach(ch => {
          const b = document.createElement('button');
          b.className = 'btn-primary';
          b.textContent = ch.text;
          b.onclick = () => {
            if (ch.scoreDelta) score += ch.scoreDelta;
            if (ch.giveItem && !inventory.includes(ch.giveItem)) inventory.push(ch.giveItem);
            activeDialogue = null;
            syncHudDom();
          };
          dlgChoices.appendChild(b);
        });
      } else {
        dlgModal.style.display = 'none';
      }
    }

    if (statusModal) {
      if (status !== 'playing') {
        statusModal.style.display = 'flex';
        statusTitle.textContent = status === 'victory' ? 'Bölüm Tamamlandı!' : status === 'gameover' ? 'Oyun Bitti' : 'Oyun Duraklatıldı';
        statusReasonEl.textContent = statusReason || 'Oyuna devam edebilir veya sahneyi sıfırlayabilirsiniz.';
        statusScoreEl.textContent = String(Math.round(score));
        statusHpEl.textContent = String(hp);
        statusTimeEl.textContent = elapsedSec.toFixed(1) + 's';
        if (btnResume) btnResume.style.display = status === 'paused' ? 'inline-flex' : 'none';
      } else {
        statusModal.style.display = 'none';
      }
    }
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (status === 'playing') status = 'paused';
      else if (status === 'paused') status = 'playing';
      syncHudDom();
      return;
    }
    if (e.code === 'KeyR') { restartGame(); return; }
    if (!keysHeld.has(e.code)) keysJustPressed.add(e.code);
    keysHeld.add(e.code);
  });
  window.addEventListener('keyup', (e) => keysHeld.delete(e.code));

  document.querySelectorAll('[data-touch-key]').forEach(btn => {
    const code = btn.getAttribute('data-touch-key');
    btn.addEventListener('pointerdown', () => { keysJustPressed.add(code); keysHeld.add(code); });
    btn.addEventListener('pointerup', () => keysHeld.delete(code));
    btn.addEventListener('pointerleave', () => keysHeld.delete(code));
  });

  const btnRestartTop = document.getElementById('btn-restart');
  if (btnRestartTop) btnRestartTop.onclick = restartGame;
  const btnModalRestart = document.getElementById('btn-modal-restart');
  if (btnModalRestart) btnModalRestart.onclick = restartGame;
  if (btnResume) btnResume.onclick = () => { status = 'playing'; syncHudDom(); };
  const btnPauseTop = document.getElementById('btn-pause');
  if (btnPauseTop) btnPauseTop.onclick = () => {
    status = status === 'playing' ? 'paused' : 'playing';
    syncHudDom();
  };
  const btnMuteTop = document.getElementById('btn-mute');
  if (btnMuteTop) btnMuteTop.onclick = () => {
    muted = !muted;
    btnMuteTop.textContent = muted ? 'Sessiz' : 'Ses Açık';
  };

  // Pencere / Kanvas Boyut Kontrol Butonları
  const shellEl = document.getElementById('game-shell-container');
  document.querySelectorAll('[data-size-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.getAttribute('data-size-preset');
      if (shellEl) shellEl.style.maxWidth = w;
    });
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (status !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width) + cameraX;
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height) + cameraY;
    for (const obj of objects) {
      if (!obj.visible) continue;
      if (sx >= obj.x && sx <= obj.x + obj.width && sy >= obj.y && sy <= obj.y + obj.height) {
        for (const r of (activeScene.irRules || [])) {
          if (r.eventType === 'event_object_clicked' && (r.targetObjectId === obj.id || r.targetObjectId === 'scene')) {
            executeActionList(r.actions, null);
          }
        }
      }
    }
  });

  loadScene(GAME_DATA.startSceneId, true);

  let lastTime = performance.now();
  let frameCount = 0;
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    fps = Math.round(1 / dt);

    if (status === 'playing') {
      elapsedSec += dt;
      for (const ft of floatingTexts) { ft.y -= 28 * dt; ft.ttl -= dt; }
      floatingTexts = floatingTexts.filter(ft => ft.ttl > 0);
      if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);

      const aliasMap = {
        ArrowRight: ['ArrowRight', 'KeyD'],
        ArrowLeft: ['ArrowLeft', 'KeyA'],
        ArrowUp: ['ArrowUp', 'KeyW'],
        ArrowDown: ['ArrowDown', 'KeyS'],
        Space: ['Space'],
        KeyE: ['KeyE', 'KeyF'],
        KeyF: ['KeyF', 'KeyE'],
        ShiftLeft: ['ShiftLeft', 'ShiftRight', 'KeyQ']
      };

      for (const r of (activeScene.irRules || [])) {
        if (r.eventType === 'event_key_held') {
          const cands = aliasMap[r.eventParams.key] || [r.eventParams.key];
          if (cands.some(k => keysHeld.has(k))) executeActionList(r.actions, null);
        } else if (r.eventType === 'event_key_pressed') {
          const cands = aliasMap[r.eventParams.key] || [r.eventParams.key];
          if (cands.some(k => keysJustPressed.has(k))) executeActionList(r.actions, null);
        } else if (r.eventType === 'event_timer_interval') {
          const iv = Math.max(0.1, Number(r.eventParams.seconds || 1));
          const acc = (timerAccumulators.get(r.id) || 0) + dt;
          if (acc >= iv) {
            timerAccumulators.set(r.id, acc - iv);
            executeActionList(r.actions, null);
          } else {
            timerAccumulators.set(r.id, acc);
          }
        }
      }
      keysJustPressed.clear();

      const platformDeltaX = new Map();
      for (const mp of objects) {
        if (!mp.visible) continue;
        if (mp.role === 'moving_platform' && (mp.patrolDistance || 100) > 0) {
          const spd = mp.patrolSpeed || 75;
          const range = mp.patrolDistance || 110;
          const dx = mp.patrolDir * spd * dt;
          mp.x += dx;
          platformDeltaX.set(mp.id, dx);
          if (mp.x > mp.originX + range) mp.patrolDir = -1;
          else if (mp.x < mp.originX - range) mp.patrolDir = 1;
        }
      }

      const gridStep = Math.max(16, activeScene.gridSize || 32);
      const tileStatics = (activeScene.tilemapCells || [])
        .filter(c => c.kind !== 'lava_hazard')
        .map((c, idx) => ({
          id: 'tile_' + c.col + '_' + c.row + '_' + idx,
          role: c.kind === 'bounce_tile' ? 'bounce_pad' : 'platform',
          visible: true,
          x: c.col * gridStep,
          y: c.row * gridStep,
          width: gridStep,
          height: c.kind === 'wood_bridge' ? Math.round(gridStep * 0.45) : gridStep,
          scaleX: 1,
          scaleY: 1,
          collision: {
            shape: 'rect',
            isStatic: true,
            isTrigger: false,
            offsetX: 0,
            offsetY: 0,
            width: gridStep,
            height: c.kind === 'wood_bridge' ? Math.round(gridStep * 0.45) : gridStep,
            bounciness: c.kind === 'bounce_tile' ? 1.35 : 0,
            oneWayPlatform: c.kind === 'wood_bridge'
          }
        }));

      const statics = objects
        .filter(o => o.visible && o.collision && o.collision.isStatic && !o.collision.isTrigger && o.collision.shape !== 'none')
        .concat(tileStatics);

      for (const obj of objects) {
        if (!obj.visible) continue;
        obj.animTimer += dt;
        if (obj.animTimer >= 0.14) { obj.animTimer = 0; obj.animFrameIndex = (obj.animFrameIndex + 1) % 2; }
        if (obj.animLockTimer && obj.animLockTimer > 0) {
          obj.animLockTimer = Math.max(0, obj.animLockTimer - dt);
          if (obj.animLockTimer === 0 && obj.activeAnimation) triggerAnimEvent(obj, obj.activeAnimation, 'on_finish');
        }

        if (obj.role === 'projectile') {
          obj.x += obj.physics.velocityX * dt;
          obj.y += obj.physics.velocityY * dt;
          if (obj.lifetimeSec !== undefined) {
            obj.lifetimeSec -= dt;
            if (obj.lifetimeSec <= 0) { obj.visible = false; continue; }
          }
          for (const targetObj of objects) {
            if (!targetObj.visible || targetObj.id === obj.id) continue;
            if ((targetObj.role === 'enemy' || targetObj.role === 'crate') && checkCollisionOverlap(obj, targetObj)) {
              obj.visible = false;
              const dmg = obj.projectileDamage || 30;
              targetObj.hp = Math.max(0, targetObj.hp - dmg);
              playPreset('hit');
              addFloatingText('-' + dmg + ' HP', targetObj.x + targetObj.width / 2, targetObj.y - 8, '#F43F5E');
              if (targetObj.hp <= 0) {
                targetObj.visible = false;
                score += 50;
                bannerMessage = targetObj.name + ' lazerle etkisiz hale getirildi! (+50 Puan)';
                addFloatingText('+50 PUAN!', targetObj.x + targetObj.width / 2, targetObj.y - 24, '#34D399');
              }
              break;
            }
          }
          continue;
        }

        if (obj.collision && obj.collision.isStatic) continue;

        if (obj.role === 'enemy' && (obj.patrolDistance || 0) > 0 && (obj.patrolSpeed || 0) > 0) {
          obj.physics.velocityX = obj.patrolDir * (obj.patrolSpeed || 90);
          if (obj.physics.flipMode !== 'none') obj.facingDir = obj.patrolDir >= 0 ? 1 : -1;
          if (obj.x > obj.originX + obj.patrolDistance) obj.patrolDir = -1;
          else if (obj.x < obj.originX - obj.patrolDistance) obj.patrolDir = 1;
        }

        if ((activeScene.gravityY || 0) !== 0 && (obj.physics.gravityScale ?? 1) !== 0) {
          obj.physics.velocityY += activeScene.gravityY * (obj.physics.gravityScale ?? 1) * dt;
        }

        const prevY = obj.y;
        obj.touchingWallDir = 0;

        const doesWallAffect = (wallCfg, candidate) => {
          const f = (wallCfg && (wallCfg.wallTargetFilter || wallCfg.targetFilter)) || 'all';
          if (f === 'all') return true;
          if (f === 'player_only') return candidate.role === 'player';
          if (f === 'enemies_only') return candidate.role === 'enemy';
          if (f === 'npcs_only') return candidate.role === 'npc';
          if (f === 'custom') {
            const ids = (wallCfg && (wallCfg.wallTargetIds || wallCfg.targetIds)) || [];
            return ids.includes(candidate.id) || (candidate.name ? ids.includes(candidate.name) : false);
          }
          return true;
        };

        obj.x += obj.physics.velocityX * dt;
        for (const wall of statics) {
          if (wall.id === obj.id || (wall.collision && wall.collision.oneWayPlatform)) continue;
          if (wall.role === 'invisible_wall' && !doesWallAffect(wall.collision, obj)) continue;
          if (checkCollisionOverlap(obj, wall)) {
            if (wall.role === 'invisible_wall' && wall.collision && wall.collision.boundaryAction && wall.collision.boundaryAction !== 'solid') {
              const edgeDir = obj.physics.velocityX >= 0 ? 'right' : 'left';
              if (obj.physics.velocityX > 0) obj.x = wall.x - obj.width;
              else if (obj.physics.velocityX < 0) obj.x = wall.x + wall.width;
              applyBoundaryAction(obj, edgeDir, wall.collision.boundaryAction);
              continue;
            }
            if (obj.physics.velocityX > 0) { obj.x = wall.x - obj.width; obj.touchingWallDir = 1; }
            else if (obj.physics.velocityX < 0) { obj.x = wall.x + wall.width; obj.touchingWallDir = -1; }
            obj.physics.velocityX = 0;
            if (wall.role === 'invisible_wall') triggerBoundaryEvent(obj, obj.touchingWallDir >= 0 ? 'right' : 'left');
          }
        }

        const wasGrounded = obj.grounded;
        obj.grounded = false;
        obj.y += obj.physics.velocityY * dt;
        for (const plat of statics) {
          if (plat.id === obj.id) continue;
          if (plat.role === 'invisible_wall' && !doesWallAffect(plat.collision, obj)) continue;
          if (checkCollisionOverlap(obj, plat)) {
            if (plat.collision && plat.collision.oneWayPlatform) {
              if (obj.physics.velocityY < 0 || prevY + obj.height > plat.y + 10) continue;
            }
            if (plat.role === 'invisible_wall' && plat.collision && plat.collision.boundaryAction && plat.collision.boundaryAction !== 'solid') {
              const edgeDir = obj.physics.velocityY >= 0 ? 'bottom' : 'top';
              if (obj.physics.velocityY >= 0) obj.y = plat.y - obj.height;
              else obj.y = plat.y + plat.height;
              applyBoundaryAction(obj, edgeDir, plat.collision.boundaryAction);
              continue;
            }
            if (obj.physics.velocityY >= 0) {
              obj.y = plat.y - obj.height;
              if (plat.role === 'bounce_pad' || (plat.collision && plat.collision.bounciness > 1)) {
                obj.physics.velocityY = -620;
                playPreset('jump');
              } else {
                obj.physics.velocityY = 0;
                obj.grounded = true;
                obj.coyoteTimer = 0.12;
                obj.jumpsLeft = obj.maxJumps;
                const carryDx = platformDeltaX.get(plat.id);
                if (carryDx) obj.x += carryDx;
              }
            } else if (obj.physics.velocityY < 0) {
              obj.y = plat.y + plat.height;
              obj.physics.velocityY = 0;
            }
          }
        }

        const wb = activeScene.worldBounds;
        if (wb && wb.enabled && doesWallAffect(wb, obj)) {
          const cam = activeScene.camera || {};
          const minX = cam.boundsX || 0;
          const maxX = Math.max(minX + 320, minX + (cam.boundsWidth || 1600));
          const minY = cam.boundsY || 0;
          const maxY = Math.max(minY + 240, minY + (cam.boundsHeight || 620));
          if (obj.x < minX) { obj.x = minX; applyBoundaryAction(obj, 'left', wb.leftAction || 'solid', wb.bouncePower, wb.bottomDamage); }
          else if (obj.x + obj.width > maxX) { obj.x = maxX - obj.width; applyBoundaryAction(obj, 'right', wb.rightAction || 'solid', wb.bouncePower, wb.bottomDamage); }
          if (obj.y < minY) { obj.y = minY; applyBoundaryAction(obj, 'top', wb.topAction || 'solid', wb.bouncePower, wb.bottomDamage); }
          else if (obj.y + obj.height > maxY) { obj.y = maxY - obj.height; applyBoundaryAction(obj, 'bottom', wb.bottomAction || 'respawn_damage', wb.bouncePower, wb.bottomDamage); }
        }

        if (obj.grounded && !wasGrounded) {
          obj.jumpsLeft = obj.maxJumps;
          triggerStateEvent(obj, 'landed');
        } else if (!obj.grounded && wasGrounded) obj.coyoteTimer = 0.12;
        else if (!obj.grounded) obj.coyoteTimer = Math.max(0, obj.coyoteTimer - dt);

        if ((!obj.physics || obj.physics.autoAnimateState !== false) && (!obj.animLockTimer || obj.animLockTimer <= 0)) {
          const prevClip = obj.activeAnimation || 'idle';
          let nextClip = prevClip;
          if (!obj.grounded && (activeScene.gravityY || 0) !== 0) nextClip = obj.physics.velocityY < -20 ? 'jump' : 'fall';
          else if (Math.abs(obj.physics.velocityX) > 12) nextClip = 'move';
          else nextClip = 'idle';
          if (nextClip !== prevClip) { obj.activeAnimation = nextClip; triggerAnimEvent(obj, nextClip, 'on_start'); }
        }

        obj.physics.velocityX *= (obj.physics.friction || 0.82);
        if ((activeScene.gravityY || 0) === 0) obj.physics.velocityY *= (obj.physics.friction || 0.82);
        if (Math.abs(obj.physics.velocityX) < 2) obj.physics.velocityX = 0;
      }

      const playerObj = objects.find(o => o.role === 'player' && o.visible);
      if (playerObj) {
        for (const other of objects) {
          if (!other.visible || other.id === playerObj.id) continue;
          if (other.role === 'bounce_pad' && checkCollisionOverlap(playerObj, other)) {
            playerObj.physics.velocityY = -640;
            playerObj.grounded = false;
            playPreset('jump');
          } else if (other.role === 'checkpoint' && checkCollisionOverlap(playerObj, other)) {
            const cpKey = 'cp_' + other.id;
            const lastSaved = collisionCooldowns.get(cpKey) ?? -999;
            if (elapsedSec - lastSaved >= 3.0 && (playerObj.originX !== other.x || playerObj.originY !== other.y - 10)) {
              collisionCooldowns.set(cpKey, elapsedSec);
              playerObj.originX = other.x;
              playerObj.originY = other.y - 10;
              playerObj.hp = Math.min(playerObj.maxHp || 100, playerObj.hp + 15);
              other.color = '#10B981';
              playPreset('coin');
              bannerMessage = '🚩 Kayıt Noktası (' + other.name + ') etkinleştirildi! (+15 Can)';
              addFloatingText('🚩 KAYIT ALINDI!', other.x + other.width / 2, other.y - 12, '#34D399');
            }
          } else if (other.role === 'invisible_wall' && other.collision && other.collision.isTrigger && ((!other.collision.wallTargetFilter || other.collision.wallTargetFilter === 'all' || other.collision.wallTargetFilter === 'player_only' || (other.collision.wallTargetFilter === 'custom' && (other.collision.wallTargetIds || []).includes(playerObj.id)))) && checkCollisionOverlap(playerObj, other)) {
            applyBoundaryAction(playerObj, 'bottom', other.collision.boundaryAction || 'respawn_damage');
          } else if (other.role === 'powerup' && checkCollisionOverlap(playerObj, other)) {
            other.visible = false;
            playerObj.hp = Math.min(playerObj.maxHp || 100, playerObj.hp + 35);
            score += 25;
            playPreset('coin');
            bannerMessage = 'Can İksiri alındı! (+35 Can, +25 Puan)';
            addFloatingText('+35 CAN', playerObj.x + playerObj.width / 2, playerObj.y - 10, '#34D399');
          } else if (other.role === 'hazard' && checkCollisionOverlap(playerObj, other)) {
            const hKey = 'hazard_' + other.id;
            const lastHit = collisionCooldowns.get(hKey) ?? -999;
            if (elapsedSec - lastHit >= 0.6) {
              collisionCooldowns.set(hKey, elapsedSec);
              playerObj.hp = Math.max(0, playerObj.hp - 25);
              playerObj.physics.velocityY = -320;
              shakeIntensity = 6;
              shakeTimer = 0.2;
              playPreset('hit');
              bannerMessage = 'Diken/Tuzak hasarı! (-25 Can)';
              addFloatingText('-25 CAN', playerObj.x + playerObj.width / 2, playerObj.y - 10, '#F43F5E');
              triggerStateEvent(playerObj, 'damaged');
            }
          }
        }
      }

      for (const r of (activeScene.irRules || [])) {
        if (r.eventType === 'event_on_collision') {
          const subject = getTargetObject(r.targetObjectId);
          if (!subject || !subject.visible) continue;
          const desiredRole = String(r.eventParams.otherRole || 'collectible');
          for (const other of objects) {
            if (other.id === subject.id || !other.visible || other.role !== desiredRole) continue;
            const pairKey = r.id + '_' + subject.id + '_' + other.id;
            const lastFired = collisionCooldowns.get(pairKey) ?? -999;
            if (checkCollisionOverlap(subject, other) && elapsedSec - lastFired >= 0.45) {
              collisionCooldowns.set(pairKey, elapsedSec);
              executeActionList(r.actions, other);
            }
          }
        } else if (r.eventType === 'event_health_zero') {
          const subject = getTargetObject(r.targetObjectId);
          if (subject && subject.hp <= 0) executeActionList(r.actions, null);
        }
      }

      const cam = activeScene.camera;
      if (cam && cam.followTargetId) {
        const target = objects.find(o => o.id === cam.followTargetId);
        if (target) {
          const desiredX = target.x + target.width / 2 - cam.width / 2;
          const desiredY = target.y + target.height / 2 - cam.height / 2;
          const maxCamX = Math.max(0, cam.boundsWidth - cam.width);
          const maxCamY = Math.max(0, cam.boundsHeight - cam.height);
          const clampedX = Math.max(cam.boundsX || 0, Math.min(maxCamX, desiredX));
          const clampedY = Math.max(cam.boundsY || 0, Math.min(maxCamY, desiredY));
          cameraX += (clampedX - cameraX) * (cam.smoothing || 0.15);
          cameraY += (clampedY - cameraY) * (cam.smoothing || 0.15);
        }
      }
    }

    ctx.fillStyle = activeScene.backgroundColor || '#0F172A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const shakeX = shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 2 * shakeIntensity) : 0;
    const shakeY = shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 2 * shakeIntensity) : 0;

    ctx.save();
    ctx.translate(-Math.round(cameraX) - shakeX, -Math.round(cameraY) - shakeY);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = 0; gx <= 1200; gx += 48) { ctx.moveTo(gx, 0); ctx.lineTo(gx, 720); }
    for (let gy = 0; gy <= 720; gy += 48) { ctx.moveTo(0, gy); ctx.lineTo(1200, gy); }
    ctx.stroke();

    if (typeof drawTileMapCellsOnCanvas === 'function') {
      drawTileMapCellsOnCanvas(ctx, activeScene.tilemapCells || [], activeScene.gridSize || 32);
    }

    for (const obj of objects) {
      if (!obj.visible) continue;
      const bobY = (obj.activeAnimation === 'move' && Math.abs(obj.physics.velocityX) > 5)
        ? (obj.animFrameIndex === 1 ? -3 : 0)
        : 0;
      drawGameObjectOnCanvas(ctx, obj, false, false, bobY);
    }

    for (const ft of floatingTexts) {
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.fillStyle = ft.color || '#FBBF24';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }

    ctx.restore();

    if (++frameCount % 10 === 0) syncHudDom();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
`;
}

export function buildStandaloneGameStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body { background: #020617; color: #F8FAFC; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    .shell { width: 100%; max-width: 960px; background: #0F172A; border: 1px solid #1E293B; border-radius: 14px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); transition: max-width 0.2s ease; }
    .top-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: #0F172A; border-bottom: 1px solid #1E293B; font-size: 12px; }
    .badge-live { background: rgba(16, 185, 129, 0.18); color: #6EE7B7; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; }
    .top-actions { display: flex; align-items: center; gap: 8px; }
    .btn-ctrl { background: #1E293B; color: #E2E8F0; border: 1px solid #334155; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; }
    .btn-ctrl:hover { background: #334155; }
    .btn-primary { background: #2563EB; color: #fff; border: none; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; }
    .btn-primary:hover { background: #3B82F6; }
    .viewport-wrap { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #0F172A; overflow: hidden; }
    canvas { display: block; width: 100%; height: 100%; }
    .hud-layer { position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; padding: 16px; }
    .hud-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .hud-card { background: rgba(2, 6, 23, 0.86); border: 1px solid #1E293B; padding: 8px 14px; border-radius: 10px; }
    .kicker { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
    .pips-row { display: flex; gap: 5px; align-items: center; }
    .pip-icon { width: 20px; height: 20px; }
    .score-num { font-family: monospace; font-size: 24px; font-weight: 800; color: #FBBF24; font-variant-numeric: tabular-nums; text-align: right; }
    .quest-row { font-size: 12px; color: #E2E8F0; margin-bottom: 2px; }
    .hud-bottom { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
    .touch-pad { pointer-events: auto; display: flex; align-items: center; gap: 6px; background: rgba(2, 6, 23, 0.84); padding: 6px; border-radius: 12px; border: 1px solid #1E293B; }
    .touch-btn { background: #1E293B; color: #F8FAFC; border: none; padding: 9px 12px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px; }
    .touch-btn:active { background: #2563EB; }
    .touch-jump { background: #2563EB; color: #fff; padding: 9px 14px; border-radius: 8px; border: none; font-weight: 700; font-size: 12px; cursor: pointer; }
    .banner-box { background: rgba(2, 6, 23, 0.90); border: 1px solid #1E293B; padding: 8px 14px; border-radius: 10px; font-size: 12px; color: #E2E8F0; max-width: 440px; }
    .dlg-modal { display: none; position: absolute; left: 24px; right: 24px; bottom: 64px; pointer-events: auto; background: rgba(2, 6, 23, 0.96); border: 1px solid #334155; border-radius: 12px; padding: 16px; }
    .status-overlay { display: none; position: absolute; inset: 0; pointer-events: auto; background: rgba(2, 6, 23, 0.86); align-items: center; justify-content: center; padding: 20px; }
    .status-card { width: 100%; max-width: 380px; background: #0F172A; border: 1px solid #334155; border-radius: 14px; padding: 24px; text-align: center; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 16px 0; font-family: monospace; }
    .stat-tile { background: #020617; border: 1px solid #1E293B; padding: 10px; border-radius: 8px; }
  `;
}

export function buildStandaloneGameBodyHtml(project: GameProject, safeTitle: string): string {
  return `
  <div class="shell" id="game-shell-container">
    <div class="top-bar">
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="badge-live">CANLI OYUN ÇALIŞMA ZAMANI</span>
        <strong id="hud-scene-title">${safeTitle}</strong>
        <span style="color:#64748B">·</span>
        <span id="hud-fps" style="font-family:monospace;color:#94A3B8">60 FPS · Süre: 0.0s</span>
      </div>
      <div class="top-actions">
        <span style="color:#94A3B8;font-size:11px;">Boyut:</span>
        <button class="btn-ctrl" data-size-preset="760px">Küçük</button>
        <button class="btn-ctrl" data-size-preset="960px">Standart</button>
        <button class="btn-ctrl" data-size-preset="1280px">Geniş</button>
        <button class="btn-ctrl" data-size-preset="100%">Tam Ekran</button>
        <button class="btn-ctrl" id="btn-mute">Ses Açık</button>
        <button class="btn-ctrl" id="btn-pause">Duraklat [P]</button>
        <button class="btn-primary" id="btn-restart">Yeniden Başlat [R]</button>
      </div>
    </div>

    <div class="viewport-wrap">
      <canvas id="game-canvas" width="${project.settings.resolutionWidth}" height="${project.settings.resolutionHeight}"></canvas>

      <div class="hud-layer">
        <div class="hud-top">
          <div class="hud-card">
            <div class="kicker" id="hud-hp-text">CAN (100/100)</div>
            <div class="pips-row" id="hud-hp-pips"></div>
          </div>

          <div style="display:flex;gap:10px;align-items:flex-start;">
            <div class="hud-card" id="hud-quest-box">
              <div id="hud-quests"></div>
              <div id="hud-inv" style="font-size:11px;color:#67E8F9;margin-top:3px;"></div>
            </div>
            <div class="hud-card">
              <div class="kicker">PUAN</div>
              <div class="score-num" id="hud-score">0</div>
            </div>
          </div>
        </div>

        <div class="hud-bottom">
          <div class="touch-pad">
            <button class="touch-btn" data-touch-key="ArrowLeft">◀</button>
            <button class="touch-btn" data-touch-key="ArrowUp">▲</button>
            <button class="touch-btn" data-touch-key="ArrowDown">▼</button>
            <button class="touch-btn" data-touch-key="ArrowRight">▶</button>
            <button class="touch-jump" data-touch-key="Space">ZIPLA</button>
            <button class="touch-jump" style="background:#0284C7;" data-touch-key="KeyE">⚡ LAZER [E/F]</button>
            <button class="touch-jump" style="background:#7C3AED;" data-touch-key="ShiftLeft">💨 DASH [Shift]</button>
          </div>
          <div class="banner-box" id="hud-msg">Hazır. Ok tuşları / Space / E (Lazer) / Shift (Dash) ile oynayın.</div>
        </div>
      </div>

      <div class="dlg-modal" id="dialogue-overlay">
        <div style="font-weight:700;font-size:13px;color:#38BDF8;margin-bottom:4px;" id="dlg-speaker"></div>
        <div style="font-size:14px;color:#F1F5F9;margin-bottom:12px;" id="dlg-text"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;" id="dlg-choices"></div>
      </div>

      <div class="status-overlay" id="status-modal">
        <div class="status-card">
          <h3 style="font-size:20px;font-weight:800;margin-bottom:4px;" id="status-title">Oyun Duraklatıldı</h3>
          <p style="font-size:12px;color:#94A3B8;" id="status-reason"></p>
          <div class="stat-grid">
            <div class="stat-tile"><div class="kicker">PUAN</div><div style="font-size:16px;font-weight:700;color:#FBBF24;" id="status-score">0</div></div>
            <div class="stat-tile"><div class="kicker">CAN</div><div style="font-size:16px;font-weight:700;color:#34D399;" id="status-hp">100</div></div>
            <div class="stat-tile"><div class="kicker">SÜRE</div><div style="font-size:16px;font-weight:700;color:#F8FAFC;" id="status-time">0.0s</div></div>
          </div>
          <div style="display:flex;justify-content:center;gap:8px;">
            <button class="btn-primary" id="btn-modal-resume" style="background:#059669;">Oyuna Devam Et</button>
            <button class="btn-primary" id="btn-modal-restart">Tekrar Oyna</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

export function exportSingleHtml(project: GameProject): {
  filename: string;
  htmlContent: string;
  sizeBytes: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const totalBytes = project.assets.reduce((a, b) => a + (b.sizeBytes || 0), 0);
  if (totalBytes > 15 * 1024 * 1024) {
    warnings.push(
      'Varlık boyutu 15 MB sınırını aştığı için bazı tarayıcılarda Tek HTML açılışı yavaşlayabilir. Web Dağıtım Paketi (ZIP) önerilir.'
    );
  }

  const runtimeJs = buildFullParityStandaloneRuntimeScript(project);
  const safeTitle = project.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const styles = buildStandaloneGameStyles();
  const bodyHtml = buildStandaloneGameBodyHtml(project, safeTitle);

  const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:;" />
  <title>${safeTitle} — KareForge 2D Bağımsız Oyun</title>
  <style>${styles}</style>
</head>
<body>
  ${bodyHtml}
  <script>${runtimeJs}</script>
</body>
</html>`;

  const slug =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]+/gi, '-')
      .replace(/^-|-$/g, '') || 'oyun';

  return {
    filename: `${slug}-bagimsiz.html`,
    htmlContent,
    sizeBytes: new TextEncoder().encode(htmlContent).byteLength,
    warnings,
  };
}

export async function exportProjectZip(project: GameProject): Promise<{
  filename: string;
  blob: Blob;
  manifest: ExportManifest;
}> {
  const zip = new JSZip();
  const manifest = createExportManifest(project, 'project-zip');

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('project.json', JSON.stringify(project, null, 2));

  const scenesFolder = zip.folder('scenes');
  const blocksFolder = zip.folder('blocks');
  const scriptsFolder = zip.folder('scripts');

  for (const scene of project.scenes) {
    scenesFolder?.file(`${scene.id}.json`, JSON.stringify(scene, null, 2));
    blocksFolder?.file(`${scene.id}.blocks.json`, JSON.stringify(scene.blocks, null, 2));
    scriptsFolder?.file(`${scene.id}.generated.ts`, generateReadableCode(scene));
  }

  const assetsFolder = zip.folder('assets');
  for (const asset of project.assets) {
    const bin = await loadAssetBinaryFromStorage(asset.id);
    if (bin) {
      assetsFolder?.file(`${asset.id}.bin`, bin);
    }
    assetsFolder?.file(`${asset.id}.meta.json`, JSON.stringify(asset, null, 2));
  }

  zip.file(
    'README.md',
    `# ${project.name} — KareForge 2D Tam Proje Arşivi\n\n` +
      `- Proje Sürümü: ${project.version}\n` +
      `- Motor Sürümü: ${ENGINE_VERSION}\n` +
      `- Şema Sürümü: ${SCHEMA_VERSION}\n` +
      `- Dışa Aktarma Tarihi: ${manifest.exportedAt}\n`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const slug =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]+/gi, '-')
      .replace(/^-|-$/g, '') || 'proje';

  return {
    filename: `${slug}-proje-arsivi.zip`,
    blob,
    manifest,
  };
}

export async function exportDistributionZip(project: GameProject): Promise<{
  filename: string;
  blob: Blob;
  manifest: ExportManifest;
}> {
  const zip = new JSZip();
  const manifest = createExportManifest(project, 'web-distribution');
  const runtimeJs = buildFullParityStandaloneRuntimeScript(project);
  const safeTitle = project.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('runtime.js', runtimeJs);
  zip.file('style.css', buildStandaloneGameStyles());
  zip.file(
    'index.html',
    `<!DOCTYPE html>\n<html lang="tr">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${safeTitle}</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n${buildStandaloneGameBodyHtml(project, safeTitle)}\n  <script src="runtime.js"></script>\n</body>\n</html>`
  );
  zip.file(
    'LICENSES.md',
    `# Açık Kaynak Lisans Bildirimleri\n\n` +
      `- Oyun Projesi Lisansı: ${project.settings.license || 'MIT'}\n` +
      `- KareForge 2D Çalışma Zamanı: MIT Lisansı\n` +
      `- JSZip (Paketleme): MIT Lisansı\n` +
      `- Lucide Icons: ISC Lisansı\n`
  );
  zip.file(
    'BASLANGIC_TALIMATLARI.md',
    `# Web Dağıtım Paketi Çalıştırma Kılavuzu\n\n` +
      `1. Bu ZIP arşivini bir klasöre çıkartın.\n` +
      `2. \`index.html\` dosyasını doğrudan modern bir tarayıcıda açın veya \`npx serve .\` ile yerel sunucuda yayınlayın.\n` +
      `3. Editör içindeki görünüm, vektör sprite çizimleri, ses sentezleyici, görev/diyalog ve fizik motoru ile %100 birebir aynı çalışır.\n`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const slug =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]+/gi, '-')
      .replace(/^-|-$/g, '') || 'oyun';

  return {
    filename: `${slug}-dagitim-paketi.zip`,
    blob,
    manifest,
  };
}

export function isSafeZipEntryPath(entryPath: string): boolean {
  if (!entryPath || entryPath.startsWith('/') || entryPath.startsWith('\\')) return false;
  if (entryPath.includes('..') || entryPath.includes(':')) return false;
  return true;
}

export async function importProjectFromZipBuffer(
  zipData: ArrayBuffer | Uint8Array,
  existingProjectIds: string[] = []
): Promise<{
  project: GameProject;
  migrated: boolean;
  warnings: string[];
}> {
  const byteLength = zipData.byteLength;
  if (byteLength > MAX_IMPORT_ZIP_BYTES) {
    throw new Error(
      `ZIP dosyası güvenlik sınırını (${(MAX_IMPORT_ZIP_BYTES / (1024 * 1024)).toFixed(0)} MB) aşıyor.`
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipData);
  } catch {
    throw new Error('Geçersiz veya bozuk ZIP arşivi. Mevcut projeleriniz korundu.');
  }

  const warnings: string[] = [];
  for (const relativePath of Object.keys(zip.files)) {
    if (!isSafeZipEntryPath(relativePath)) {
      throw new Error(
        `Güvenlik İhlali: Zararlı dosya yolu tespit edildi ("${relativePath}"). İçe aktarma reddedildi.`
      );
    }
  }

  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error(
      'Arşiv içinde "project.json" bulunamadı. Lütfen geçerli bir Tam Proje ZIP dosyası seçin.'
    );
  }

  const rawJsonText = await projectFile.async('string');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch {
    throw new Error('Proje JSON dosyası bozuk (sözdizimi hatası). Mevcut verileriniz korundu.');
  }

  const originalSchema = (parsed as { schemaVersion?: number })?.schemaVersion ?? 1;
  const project = migrateProjectData(parsed);
  const migrated = originalSchema < SCHEMA_VERSION;

  if (migrated) {
    warnings.push(
      `Eski proje şeması (v${originalSchema}) otomatik olarak v${SCHEMA_VERSION} sürümüne yükseltildi.`
    );
  }

  if (existingProjectIds.includes(project.id)) {
    project.id = `${project.id}_imp_${Date.now().toString(36).slice(-4)}`;
    project.name = `${project.name} (İçe Aktarılan)`;
    warnings.push(
      'Aynı kimliğe sahip bir projenin üzerine yazılmasını önlemek için içe aktarılan projeye yeni bir kimlik atandı.'
    );
  }

  const seenAssetNames = new Set<string>();
  for (const asset of project.assets) {
    if (seenAssetNames.has(asset.name)) {
      asset.name = `${asset.name}_${asset.id.slice(-4)}`;
      warnings.push(`Aynı isimli varlık çakışması çözüldü: "${asset.name}".`);
    }
    seenAssetNames.add(asset.name);
  }

  return {
    project,
    migrated,
    warnings,
  };
}
