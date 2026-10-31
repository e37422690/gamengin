import {
  BlockInstance,
  DialogueNode,
  GameObject,
  GameProject,
  GameScene,
  QuestDefinition,
} from '../types/engine';
import { audioSystem } from './audioSystem';
import { CompiledRule, compileBlocksToIR } from './blockSystem';
import {
  checkCollisionOverlap,
  doesInvisibleWallAffectObject,
  doesWorldBoundsAffectObject,
} from './sceneSystem';

export type RuntimeStatus = 'playing' | 'paused' | 'victory' | 'gameover';

export interface FloatingCombatText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  ttl: number;
}

export interface RuntimeObjectState extends GameObject {
  originX: number;
  originY: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpsLeft: number;
  maxJumps: number;
  touchingWallDir: -1 | 0 | 1;
  patrolDir: number;
  facingDir: 1 | -1;
  animTimer: number;
  animFrameIndex: number;
  animLockTimer?: number;
  projectileDamage?: number;
  lifetimeSec?: number;
}

export interface RuntimeSnapshot {
  status: RuntimeStatus;
  statusReason: string;
  sceneId: string;
  sceneName: string;
  score: number;
  hp: number;
  maxHp: number;
  bannerMessage: string;
  activeDialogue: DialogueNode | null;
  inventory: string[];
  quests: QuestDefinition[];
  variables: Record<string, number | string | boolean>;
  cameraX: number;
  cameraY: number;
  fps: number;
  elapsedSec: number;
  objects: RuntimeObjectState[];
  floatingTexts: FloatingCombatText[];
}

export class GameRuntimeEngine {
  private project: GameProject;
  private activeScene!: GameScene;
  private rules: CompiledRule[] = [];
  private objects: RuntimeObjectState[] = [];
  private floatingTexts: FloatingCombatText[] = [];
  private status: RuntimeStatus = 'playing';
  private statusReason = '';
  private score = 0;
  private bannerMessage = '';
  private activeDialogue: DialogueNode | null = null;
  private inventory: string[] = [];
  private quests: QuestDefinition[] = [];
  private variables: Record<string, number | string | boolean> = {};
  private cameraX = 0;
  private cameraY = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private lastShotTime = -999;
  private elapsedSec = 0;
  private fps = 60;

  private keysHeld = new Set<string>();
  private keysJustPressed = new Set<string>();
  private collisionCooldowns = new Map<string, number>();
  private timerAccumulators = new Map<string, number>();

  constructor(project: GameProject, initialSceneId?: string) {
    this.project = JSON.parse(JSON.stringify(project));
    for (const v of this.project.variables) {
      this.variables[v.name] = v.initialValue;
    }
    audioSystem.setVolume(this.project.settings.defaultVolume ?? 80);
    const startId = initialSceneId || this.project.startSceneId || this.project.scenes[0]?.id;
    this.loadScene(startId, true);
  }

  public addFloatingText(text: string, x: number, y: number, color = '#FBBF24'): void {
    this.floatingTexts.push({
      id: `ft_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      text,
      x,
      y,
      color,
      ttl: 0.95,
    });
  }

  public loadScene(sceneId: string, isInitial = false): void {
    const found =
      this.project.scenes.find((s) => s.id === sceneId) || this.project.scenes[0];
    if (!found) throw new Error(`Sahne bulunamadı: ${sceneId}`);

    this.activeScene = JSON.parse(JSON.stringify(found));
    if (!this.activeScene.worldBounds) {
      this.activeScene.worldBounds = {
        enabled: true,
        showGizmoInEditor: true,
        leftAction: 'solid',
        rightAction: 'solid',
        topAction: 'solid',
        bottomAction: 'respawn_damage',
        bottomDamage: 25,
        bouncePower: 520,
      };
    }
    this.rules = compileBlocksToIR(this.activeScene.blocks);
    this.quests = JSON.parse(JSON.stringify(this.activeScene.quests || []));
    this.activeDialogue = null;
    this.floatingTexts = [];
    this.collisionCooldowns.clear();
    this.timerAccumulators.clear();

    this.objects = this.activeScene.objects.map((o) => {
      const jumpMode = o.physics.jumpMode || 'multi_jump';
      const maxJumps =
        jumpMode === 'infinite'
          ? 999
          : jumpMode === 'grounded_only'
          ? 1
          : Math.max(1, o.physics.maxJumps ?? 2);
      return {
        ...JSON.parse(JSON.stringify(o)),
        originX: o.x,
        originY: o.y,
        grounded: false,
        coyoteTimer: 0,
        jumpsLeft: maxJumps,
        maxJumps,
        touchingWallDir: 0,
        patrolDir: 1,
        facingDir: o.physics.initialFacing ?? 1,
        animTimer: 0,
        animFrameIndex: 0,
        animLockTimer: 0,
      };
    });

    for (const rule of this.rules) {
      if (
        (isInitial && rule.eventType === 'event_game_start') ||
        rule.eventType === 'event_scene_enter'
      ) {
        this.executeActionList(rule.actions, null);
      }
    }
  }

  public restartCurrentScene(): void {
    this.status = 'playing';
    this.statusReason = '';
    this.score = 0;
    this.inventory = [];
    this.loadScene(this.activeScene.id, true);
  }

  public setPaused(paused: boolean): void {
    if (this.status === 'victory' || this.status === 'gameover') return;
    this.status = paused ? 'paused' : 'playing';
  }

  public pressKey(code: string): void {
    if (!this.keysHeld.has(code)) {
      this.keysJustPressed.add(code);
    }
    this.keysHeld.add(code);
  }

  public releaseKey(code: string): void {
    this.keysHeld.delete(code);
  }

  public clearInputs(): void {
    this.keysHeld.clear();
    this.keysJustPressed.clear();
  }

  public clickAtWorld(worldX: number, worldY: number): void {
    if (this.status !== 'playing') return;
    for (const obj of this.objects) {
      if (!obj.visible) continue;
      if (
        worldX >= obj.x &&
        worldX <= obj.x + obj.width &&
        worldY >= obj.y &&
        worldY <= obj.y + obj.height
      ) {
        for (const rule of this.rules) {
          if (
            rule.eventType === 'event_object_clicked' &&
            (rule.targetObjectId === obj.id || rule.targetObjectId === 'scene')
          ) {
            this.executeActionList(rule.actions, null);
          }
        }
      }
    }
  }

  public chooseDialogueOption(choiceId: string): void {
    if (!this.activeDialogue) return;
    const choice = this.activeDialogue.choices.find((c) => c.id === choiceId);
    if (choice) {
      if (choice.scoreDelta) this.score += choice.scoreDelta;
      if (choice.giveItem && !this.inventory.includes(choice.giveItem)) {
        this.inventory.push(choice.giveItem);
      }
      if (choice.startQuestId) {
        const q = this.quests.find((item) => item.id === choice.startQuestId);
        if (q) q.status = 'active';
      }
      if (choice.completeQuestId) {
        const q = this.quests.find((item) => item.id === choice.completeQuestId);
        if (q && q.status !== 'completed') {
          q.status = 'completed';
          this.score += q.rewardScore;
        }
      }
      if (choice.nextNodeId) {
        this.activeDialogue =
          this.activeScene.dialogues.find((d) => d.id === choice.nextNodeId) || null;
        return;
      }
    }
    this.activeDialogue = null;
  }

  private getTargetObject(targetId: string | 'scene'): RuntimeObjectState | null {
    if (targetId === 'scene') {
      return this.objects.find((o) => o.role === 'player') || this.objects[0] || null;
    }
    return this.objects.find((o) => o.id === targetId) || null;
  }

  private triggerStateEvent(
    subjectObj: RuntimeObjectState,
    stateName: 'landed' | 'jumped' | 'double_jumped' | 'turned_left' | 'turned_right' | 'damaged'
  ): void {
    for (const rule of this.rules) {
      if (rule.eventType !== 'event_state_changed') continue;
      if (rule.targetObjectId !== 'scene' && rule.targetObjectId !== subjectObj.id) continue;
      if (String(rule.eventParams.state ?? 'landed') === stateName) {
        this.executeActionList(rule.actions, null);
      }
    }
  }

  private triggerAnimEvent(
    subjectObj: RuntimeObjectState,
    clipName: string,
    phase: 'on_start' | 'on_finish'
  ): void {
    for (const rule of this.rules) {
      if (rule.eventType !== 'event_anim_trigger') continue;
      if (rule.targetObjectId !== 'scene' && rule.targetObjectId !== subjectObj.id) continue;
      const wantedClip = String(rule.eventParams.clip ?? 'attack');
      const wantedPhase = String(rule.eventParams.triggerPhase ?? 'on_start');
      if (wantedClip === clipName && wantedPhase === phase) {
        this.executeActionList(rule.actions, null);
      }
    }
  }

  private triggerBoundaryEvent(
    subjectObj: RuntimeObjectState,
    edge: 'left' | 'right' | 'top' | 'bottom'
  ): void {
    const cooldownKey = `bound_${subjectObj.id}_${edge}`;
    const lastHit = this.collisionCooldowns.get(cooldownKey) ?? -999;
    if (this.elapsedSec - lastHit < 0.25) return;
    this.collisionCooldowns.set(cooldownKey, this.elapsedSec);

    for (const rule of this.rules) {
      if (rule.eventType !== 'event_boundary_hit') continue;
      if (rule.targetObjectId !== 'scene' && rule.targetObjectId !== subjectObj.id) continue;
      const wantedEdge = String(rule.eventParams.edge ?? 'any');
      if (wantedEdge === 'any' || wantedEdge === edge) {
        this.executeActionList(rule.actions, null);
      }
    }
  }

  private applyBoundaryAction(
    obj: RuntimeObjectState,
    edge: 'left' | 'right' | 'top' | 'bottom',
    action: string,
    bouncePower = 520,
    damage = 25
  ): void {
    this.triggerBoundaryEvent(obj, edge);

    if (action === 'bounce') {
      if (edge === 'left') {
        obj.physics.velocityX = Math.abs(bouncePower);
        obj.facingDir = 1;
      } else if (edge === 'right') {
        obj.physics.velocityX = -Math.abs(bouncePower);
        obj.facingDir = -1;
      } else if (edge === 'top') {
        obj.physics.velocityY = Math.abs(bouncePower * 0.75);
      } else if (edge === 'bottom') {
        obj.physics.velocityY = -Math.abs(bouncePower);
        obj.grounded = false;
      }
      audioSystem.playPreset('jump');
      this.addFloatingText('⚡ SINIR SEKMESİ!', obj.x + obj.width / 2, obj.y - 10, '#38BDF8');
    } else if (action === 'wrap') {
      const cam = this.activeScene.camera;
      const minX = cam.boundsX || 0;
      const maxX = Math.max(minX + 320, (cam.boundsX || 0) + (cam.boundsWidth || 1600));
      const minY = cam.boundsY || 0;
      const maxY = Math.max(minY + 240, (cam.boundsY || 0) + (cam.boundsHeight || 900));
      if (edge === 'left') obj.x = maxX - obj.width - 6;
      else if (edge === 'right') obj.x = minX + 6;
      else if (edge === 'top') obj.y = maxY - obj.height - 6;
      else if (edge === 'bottom') obj.y = minY + 6;
      this.addFloatingText('🌀 EKRAN GEÇİŞİ', obj.x + obj.width / 2, obj.y - 8, '#A855F7');
    } else if (action === 'respawn_damage') {
      obj.x = obj.originX;
      obj.y = obj.originY;
      obj.physics.velocityX = 0;
      obj.physics.velocityY = 0;
      if (obj.role === 'player' && damage > 0) {
        obj.hp = Math.max(0, obj.hp - damage);
        this.shakeIntensity = 7;
        this.shakeTimer = 0.25;
        audioSystem.playPreset('hit');
        this.bannerMessage = `Harita sınırından düştün! Başlangıç noktasına döndün (-${damage} Can)`;
        this.addFloatingText(`-${damage} CAN (BAŞA DÖNDÜ)`, obj.x + obj.width / 2, obj.y - 12, '#F43F5E');
        this.triggerStateEvent(obj, 'damaged');
      }
    } else if (action === 'gameover' && obj.role === 'player') {
      obj.hp = 0;
      this.status = 'gameover';
      this.statusReason = 'Harita sınırından çıkıldı!';
      audioSystem.playPreset('lose');
    } else if (action === 'victory' && obj.role === 'player') {
      this.status = 'victory';
      this.statusReason = 'Sınır hedefine ulaşıldı!';
      audioSystem.playPreset('win');
    } else {
      // 'solid' default
      if (edge === 'left' || edge === 'right') {
        obj.physics.velocityX = 0;
      } else if (edge === 'top') {
        if (obj.physics.velocityY < 0) obj.physics.velocityY = 0;
      } else if (edge === 'bottom') {
        obj.physics.velocityY = 0;
        obj.grounded = true;
        obj.coyoteTimer = 0.12;
        obj.jumpsLeft = obj.maxJumps;
      }
    }
  }

  private executeActionList(
    actions: BlockInstance[],
    otherCollisionObject: RuntimeObjectState | null,
    budget = { count: 0, max: 250 }
  ): void {
    for (const act of actions) {
      if (budget.count++ > budget.max) {
        this.bannerMessage = 'Güvenlik Sınırı: Aşırı döngü işlemi durduruldu.';
        return;
      }
      if (act.disabled) continue;

      const target = this.getTargetObject(act.targetObjectId);

      switch (act.type) {
        case 'move_horizontal':
          if (target) {
            const spd = Number(act.params.speed ?? 0);
            target.physics.velocityX = spd;
            const prevFacing = target.facingDir;
            if (target.physics.flipMode !== 'none') {
              if (spd > 0) target.facingDir = 1;
              else if (spd < 0) target.facingDir = -1;
            }
            if (target.physics.flipMode === 'rotate') {
              target.rotation = target.facingDir < 0 ? 180 : 0;
            }
            if (prevFacing !== target.facingDir) {
              this.triggerStateEvent(
                target,
                target.facingDir < 0 ? 'turned_left' : 'turned_right'
              );
            }
          }
          break;
        case 'move_set_facing':
          if (target) {
            const dirParam = String(act.params.direction ?? 'right');
            const flipModeParam = String(act.params.flipMode ?? 'horizontal') as
              | 'horizontal'
              | 'rotate'
              | 'none';
            target.physics.flipMode = flipModeParam;
            const prevFacing = target.facingDir;
            if (dirParam === 'left') target.facingDir = -1;
            else if (dirParam === 'right') target.facingDir = 1;
            else if (dirParam === 'toggle') target.facingDir = target.facingDir === 1 ? -1 : 1;
            if (flipModeParam === 'rotate') {
              target.rotation = target.facingDir < 0 ? 180 : 0;
            } else {
              target.rotation = 0;
            }
            if (prevFacing !== target.facingDir) {
              this.triggerStateEvent(
                target,
                target.facingDir < 0 ? 'turned_left' : 'turned_right'
              );
            }
          }
          break;
        case 'move_vertical':
          if (target) {
            target.physics.velocityY = Number(act.params.speed ?? 0);
          }
          break;
        case 'move_jump':
          if (target) {
            const jumpMode = target.physics.jumpMode || 'multi_jump';
            const force = Math.abs(Number(act.params.force ?? target.physics.jumpForce ?? 460));
            const gSign = Math.sign(target.physics.gravityScale || 1) || 1;
            const canGroundJump =
              target.grounded || target.coyoteTimer > 0 || this.activeScene.gravityY === 0;

            if (canGroundJump) {
              target.physics.velocityY = -gSign * force;
              target.grounded = false;
              target.coyoteTimer = 0;
              const configuredMax =
                jumpMode === 'infinite'
                  ? 999
                  : jumpMode === 'grounded_only'
                  ? 1
                  : Math.max(1, target.physics.maxJumps ?? 2);
              target.maxJumps = configuredMax;
              target.jumpsLeft = Math.max(0, configuredMax - 1);
              this.triggerStateEvent(target, 'jumped');
            } else if (target.physics.wallJumpEnabled && target.touchingWallDir !== 0) {
              // Wall jump!
              target.physics.velocityY = -gSign * force * 0.95;
              target.physics.velocityX = -target.touchingWallDir * 290;
              target.facingDir = (-target.touchingWallDir) as 1 | -1;
              target.touchingWallDir = 0;
              audioSystem.playPreset('jump');
              this.addFloatingText(
                '🧗 DUVAR ZIPLAMASI!',
                target.x + target.width / 2,
                target.y - 10,
                '#38BDF8'
              );
              this.triggerStateEvent(target, 'double_jumped');
            } else if (jumpMode === 'infinite') {
              target.physics.velocityY = -gSign * force;
              target.grounded = false;
              this.addFloatingText(
                '🚀 SINIRSIZ ZIPLAMA',
                target.x + target.width / 2,
                target.y - 8,
                '#A855F7'
              );
              this.triggerStateEvent(target, 'double_jumped');
            } else if (jumpMode === 'multi_jump' && target.jumpsLeft > 0) {
              target.jumpsLeft -= 1;
              target.physics.velocityY = -gSign * force * 0.92;
              target.grounded = false;
              this.addFloatingText(
                `✨ HAVA ZIPLAMASI (${target.maxJumps - target.jumpsLeft}/${target.maxJumps})`,
                target.x + target.width / 2,
                target.y - 8,
                '#38BDF8'
              );
              this.triggerStateEvent(target, 'double_jumped');
            }
          }
          break;
        case 'physics_set_jump_mode':
          if (target) {
            const newMode = String(act.params.jumpMode ?? 'multi_jump') as
              | 'grounded_only'
              | 'multi_jump'
              | 'infinite';
            const newMax = Math.max(1, Number(act.params.maxJumps ?? 2));
            target.physics.jumpMode = newMode;
            target.physics.maxJumps = newMax;
            target.maxJumps =
              newMode === 'infinite' ? 999 : newMode === 'grounded_only' ? 1 : newMax;
            target.jumpsLeft = target.maxJumps;
            this.addFloatingText(
              newMode === 'infinite'
                ? '🚀 SINIRSIZ ZIPLAMA AKTİF!'
                : newMode === 'grounded_only'
                ? '⚓ TEK ZIPLAMA MODU'
                : `🦘 ${newMax}X ÇOKLU ZIPLAMA`,
              target.x + target.width / 2,
              target.y - 12,
              '#34D399'
            );
          }
          break;
        case 'world_set_boundary_action': {
          if (!this.activeScene.worldBounds) {
            this.activeScene.worldBounds = {
              enabled: true,
              showGizmoInEditor: true,
              leftAction: 'solid',
              rightAction: 'solid',
              topAction: 'solid',
              bottomAction: 'respawn_damage',
              bottomDamage: 25,
              bouncePower: 520,
            };
          }
          const edge = String(act.params.edge ?? 'bottom');
          const action = String(act.params.action ?? 'respawn_damage') as
            | 'solid'
            | 'bounce'
            | 'wrap'
            | 'respawn_damage'
            | 'gameover'
            | 'victory';
          if (edge === 'left') this.activeScene.worldBounds.leftAction = action;
          else if (edge === 'right') this.activeScene.worldBounds.rightAction = action;
          else if (edge === 'top') this.activeScene.worldBounds.topAction = action;
          else if (edge === 'all') {
            this.activeScene.worldBounds.leftAction = action;
            this.activeScene.worldBounds.rightAction = action;
            this.activeScene.worldBounds.topAction = action;
            this.activeScene.worldBounds.bottomAction = action;
          } else this.activeScene.worldBounds.bottomAction = action;
          break;
        }
        case 'world_set_wall_filter': {
          const filter = String(act.params.filter ?? 'all') as
            | 'all'
            | 'player_only'
            | 'enemies_only'
            | 'npcs_only'
            | 'custom';
          const customTarget = String(act.params.customTarget ?? '').trim();
          if (target && target.role === 'invisible_wall') {
            target.collision.wallTargetFilter = filter;
            if (filter === 'custom' && customTarget) {
              const matched = this.objects.filter(
                (o) => o.id === customTarget || o.name.toLowerCase() === customTarget.toLowerCase()
              );
              target.collision.wallTargetIds = matched.length > 0 ? matched.map((m) => m.id) : [customTarget];
            }
          } else {
            for (const w of this.objects) {
              if (w.role === 'invisible_wall') {
                w.collision.wallTargetFilter = filter;
                if (filter === 'custom' && customTarget) {
                  w.collision.wallTargetIds = [customTarget];
                }
              }
            }
            if (this.activeScene.worldBounds) {
              this.activeScene.worldBounds.targetFilter = filter;
              if (filter === 'custom' && customTarget) {
                this.activeScene.worldBounds.targetIds = [customTarget];
              }
            }
          }
          break;
        }
        case 'move_dash':
          if (target) {
            const power = Math.abs(Number(act.params.power ?? 540));
            const dir = target.facingDir || 1;
            target.physics.velocityX = dir * power;
            target.activeAnimation = 'dash';
            target.animLockTimer = 0.25;
            audioSystem.playPreset('jump');
            this.addFloatingText('💨 DASH!', target.x + target.width / 2, target.y - 8, '#38BDF8');
            this.triggerAnimEvent(target, 'dash', 'on_start');
          }
          break;
        case 'act_shoot_projectile':
          if (target && this.elapsedSec - this.lastShotTime >= 0.16) {
            this.lastShotTime = this.elapsedSec;
            const speed = Math.abs(Number(act.params.speed ?? 520));
            const damage = Math.abs(Number(act.params.damage ?? 30));
            const dir = target.facingDir || 1;
            const spawnX = dir > 0 ? target.x + target.width + 4 : target.x - 28;
            const spawnY = target.y + Math.round(target.height * 0.38);
            target.activeAnimation = 'attack';
            target.animLockTimer = 0.22;
            this.triggerAnimEvent(target, 'attack', 'on_start');
            const bolt: RuntimeObjectState = {
              id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: 'Lazer_Mermisi',
              role: 'projectile',
              nodeClass: 'Area2D',
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
              locked: false,
              color: '#38BDF8',
              secondaryColor: '#E0F2FE',
              shapePreset: 'laser_bolt',
              hp: 1,
              maxHp: 1,
              collision: {
                shape: 'rect',
                isStatic: false,
                isTrigger: true,
                layer: 'sensor',
                offsetX: 0,
                offsetY: 0,
                width: 24,
                height: 10,
                radius: 6,
                bounciness: 0,
              },
              physics: {
                enabled: true,
                gravityScale: 0,
                velocityX: dir * speed,
                velocityY: 0,
                maxSpeed: speed,
                jumpForce: 0,
                friction: 1,
              },
              vfx: {
                lightEnabled: true,
                lightColor: '#38BDF8',
                lightRadius: 55,
                lightIntensity: 0.7,
                particlePreset: 'sparkles',
              },
              animations: [],
              variables: {},
              tags: ['projectile'],
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
              lifetimeSec: 1.6,
            };
            this.objects.push(bolt);
            audioSystem.playPreset('laser');
          }
          break;
        case 'physics_flip_gravity':
          if (target) {
            target.physics.gravityScale = -(target.physics.gravityScale || 1);
            target.grounded = false;
            this.addFloatingText('⇅ YERÇEKİMİ TERS!', target.x, target.y - 10, '#A855F7');
          }
          break;
        case 'camera_shake':
          this.shakeIntensity = Math.max(2, Number(act.params.intensity ?? 8));
          this.shakeTimer = 0.28;
          break;
        case 'move_to_position':
          if (target) {
            target.x = Number(act.params.x ?? target.x);
            target.y = Number(act.params.y ?? target.y);
          }
          break;
        case 'move_rotate':
          if (target) {
            target.rotation = (target.rotation + Number(act.params.degrees ?? 15)) % 360;
          }
          break;
        case 'move_stop':
          if (target) {
            target.physics.velocityX = 0;
            target.physics.velocityY = 0;
          }
          break;
        case 'ui_add_score': {
          const pts = Number(act.params.points ?? 10);
          this.score += pts;
          if (target) {
            this.addFloatingText(
              pts >= 0 ? `+${pts}` : `${pts}`,
              target.x + target.width / 2,
              target.y - 10,
              '#FBBF24'
            );
          }
          break;
        }
        case 'ui_show_message':
          this.bannerMessage = String(act.params.text ?? '');
          break;
        case 'ui_start_dialogue': {
          const dlgId = String(act.params.dialogueId ?? 'dlg_intro');
          const dlg =
            this.activeScene.dialogues.find((d) => d.id === dlgId) ||
            this.activeScene.dialogues[0];
          if (dlg) this.activeDialogue = dlg;
          break;
        }
        case 'audio_play_sfx':
          audioSystem.playPreset(String(act.params.sound ?? 'coin'));
          break;
        case 'audio_set_volume':
          audioSystem.setVolume(Number(act.params.volume ?? 80));
          break;
        case 'sense_destroy_other':
          if (otherCollisionObject) {
            otherCollisionObject.visible = false;
          }
          break;
        case 'sense_damage_target':
          if (target) {
            const delta = Number(act.params.amount ?? -20);
            target.hp = Math.max(0, Math.min(target.maxHp, target.hp + delta));
            this.addFloatingText(
              delta >= 0 ? `+${delta} CAN` : `${delta} CAN`,
              target.x + target.width / 2,
              target.y - 12,
              delta >= 0 ? '#34D399' : '#F43F5E'
            );
            if (delta < 0) this.triggerStateEvent(target, 'damaged');
          }
          break;
        case 'anim_play':
          if (target) {
            const clip = String(act.params.clip ?? 'move');
            target.activeAnimation = clip;
            if (clip === 'attack' || clip === 'dash') {
              target.animLockTimer = 0.28;
            }
            this.triggerAnimEvent(target, clip, 'on_start');
          }
          break;
        case 'anim_set_character_skin':
          if (target) {
            const skin = String(act.params.skin ?? 'knight') as GameObject['shapePreset'];
            target.shapePreset = skin;
            const skinColorMap: Record<string, { color: string; secondary: string }> = {
              hero: { color: '#38BDF8', secondary: '#0284C7' },
              knight: { color: '#94A3B8', secondary: '#475569' },
              mage: { color: '#A855F7', secondary: '#6B21A8' },
              ninja: { color: '#1E293B', secondary: '#0F172A' },
              robot: { color: '#38BDF8', secondary: '#0369A1' },
            };
            if (skinColorMap[skin]) {
              target.color = skinColorMap[skin].color;
              target.secondaryColor = skinColorMap[skin].secondary;
            }
            this.addFloatingText(
              `🎭 SINIF: ${skin.toUpperCase()}`,
              target.x + target.width / 2,
              target.y - 10,
              '#C084FC'
            );
          }
          break;
        case 'scene_change': {
          const requestedId = String(act.params.sceneId ?? 'next');
          if (requestedId === 'next') {
            const idx = this.project.scenes.findIndex((s) => s.id === this.activeScene.id);
            const nextScene = this.project.scenes[(idx + 1) % this.project.scenes.length];
            if (nextScene) this.loadScene(nextScene.id, false);
          } else {
            this.loadScene(requestedId, false);
          }
          return;
        }
        case 'scene_restart':
          this.restartCurrentScene();
          return;
        case 'scene_victory':
          this.status = 'victory';
          this.statusReason = String(act.params.reason ?? 'Bölüm Tamamlandı!');
          return;
        case 'scene_gameover':
          this.status = 'gameover';
          this.statusReason = String(act.params.reason ?? 'Oyun Bitti!');
          return;
        case 'var_set':
          this.variables[String(act.params.varName ?? 'var')] = act.params.value ?? 0;
          break;
        case 'var_change': {
          const k = String(act.params.varName ?? 'var');
          const cur = Number(this.variables[k] ?? 0);
          this.variables[k] = cur + Number(act.params.delta ?? 1);
          break;
        }
        case 'var_random': {
          const k = String(act.params.varName ?? 'rnd');
          const min = Number(act.params.min ?? 1);
          const max = Number(act.params.max ?? 100);
          this.variables[k] = Math.floor(Math.random() * (max - min + 1)) + min;
          break;
        }
        case 'adv_inventory_add': {
          const item = String(act.params.itemName ?? 'Eşya');
          if (!this.inventory.includes(item)) {
            this.inventory.push(item);
            this.bannerMessage = `Envantere eklendi: ${item}`;
          }
          break;
        }
        case 'adv_quest_start': {
          const q = this.quests.find((item) => item.id === String(act.params.questId ?? ''));
          if (q && q.status === 'inactive') {
            q.status = 'active';
            this.bannerMessage = `Yeni Görev: ${q.title}`;
          }
          break;
        }
        case 'adv_quest_complete': {
          const q = this.quests.find((item) => item.id === String(act.params.questId ?? ''));
          if (q && q.status !== 'completed') {
            q.status = 'completed';
            this.score += q.rewardScore;
            this.bannerMessage = `Görev Tamamlandı: ${q.title} (+${q.rewardScore} Puan)`;
          }
          break;
        }
        case 'adv_enemy_patrol':
          if (target) {
            target.patrolDistance = Number(act.params.range ?? 120);
            target.patrolSpeed = Number(act.params.speed ?? 95);
          }
          break;
        case 'adv_follow_player':
          if (target) {
            const player = this.objects.find((o) => o.role === 'player');
            if (player) {
              const spd = Number(act.params.speed ?? 85);
              const dx = player.x - target.x;
              const dy = player.y - target.y;
              const dist = Math.hypot(dx, dy) || 1;
              target.physics.velocityX = (dx / dist) * spd;
              if (target.physics.flipMode !== 'none') {
                target.facingDir = dx >= 0 ? 1 : -1;
              }
              if (this.activeScene.gravityY === 0) {
                target.physics.velocityY = (dy / dist) * spd;
              }
            }
          }
          break;
        case 'control_if_score_gte':
          if (this.score >= Number(act.params.threshold ?? 50)) {
            this.executeActionList(act.children || [], otherCollisionObject, budget);
          }
          break;
        case 'control_repeat_count': {
          const count = Math.max(1, Math.min(50, Number(act.params.count ?? 3)));
          for (let i = 0; i < count; i++) {
            this.executeActionList(act.children || [], otherCollisionObject, budget);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  public step(rawDt: number): RuntimeSnapshot {
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.fps = Math.round(1 / dt);

    if (this.status !== 'playing') {
      return this.getSnapshot();
    }

    this.elapsedSec += dt;

    // Update floating combat text particles
    for (const ft of this.floatingTexts) {
      ft.y -= 28 * dt;
      ft.ttl -= dt;
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.ttl > 0);

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    const aliasMap: Record<string, string[]> = {
      ArrowRight: ['ArrowRight', 'KeyD'],
      ArrowLeft: ['ArrowLeft', 'KeyA'],
      ArrowUp: ['ArrowUp', 'KeyW'],
      ArrowDown: ['ArrowDown', 'KeyS'],
      Space: ['Space'],
      KeyE: ['KeyE', 'KeyF'],
      KeyF: ['KeyF', 'KeyE'],
      ShiftLeft: ['ShiftLeft', 'ShiftRight', 'KeyQ'],
    };

    for (const rule of this.rules) {
      if (rule.eventType === 'event_key_held') {
        const keyParam = String(rule.eventParams.key ?? 'ArrowRight');
        const candidates = aliasMap[keyParam] || [keyParam];
        if (candidates.some((k) => this.keysHeld.has(k))) {
          this.executeActionList(rule.actions, null);
        }
      } else if (rule.eventType === 'event_key_pressed') {
        const keyParam = String(rule.eventParams.key ?? 'Space');
        const candidates = aliasMap[keyParam] || [keyParam];
        if (candidates.some((k) => this.keysJustPressed.has(k))) {
          this.executeActionList(rule.actions, null);
        }
      } else if (rule.eventType === 'event_timer_interval') {
        const interval = Math.max(0.1, Number(rule.eventParams.seconds ?? 1));
        const prev = (this.timerAccumulators.get(rule.id) ?? 0) + dt;
        if (prev >= interval) {
          this.timerAccumulators.set(rule.id, prev - interval);
          this.executeActionList(rule.actions, null);
        } else {
          this.timerAccumulators.set(rule.id, prev);
        }
      }
    }
    this.keysJustPressed.clear();

    // Update Moving Platforms first so they can carry the player
    const platformDeltaX = new Map<string, number>();
    for (const mp of this.objects) {
      if (!mp.visible) continue;
      if (mp.role === 'moving_platform' && (mp.patrolDistance ?? 100) > 0) {
        const spd = mp.patrolSpeed || 75;
        const range = mp.patrolDistance || 110;
        const dx = mp.patrolDir * spd * dt;
        mp.x += dx;
        platformDeltaX.set(mp.id, dx);
        if (mp.x > mp.originX + range) mp.patrolDir = -1;
        else if (mp.x < mp.originX - range) mp.patrolDir = 1;
      }
    }

    const gridStep = Math.max(16, this.activeScene.gridSize || 32);
    const tileGeneratedStatics: RuntimeObjectState[] = (this.activeScene.tilemapCells || [])
      .filter((c) => c.kind !== 'lava_hazard')
      .map((c, idx) => ({
        id: `tile_${c.col}_${c.row}_${idx}`,
        name: `Tile_${c.kind}`,
        role: c.kind === 'bounce_tile' ? 'bounce_pad' : 'platform',
        layerId: 'layer_main',
        x: c.col * gridStep,
        y: c.row * gridStep,
        width: gridStep,
        height: c.kind === 'wood_bridge' ? Math.round(gridStep * 0.45) : gridStep,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        zIndex: 1,
        visible: true,
        locked: true,
        color: '#334155',
        shapePreset: 'platform',
        hp: 100,
        maxHp: 100,
        collision: {
          shape: 'rect',
          isStatic: true,
          isTrigger: false,
          layer: 'world',
          offsetX: 0,
          offsetY: 0,
          width: gridStep,
          height: c.kind === 'wood_bridge' ? Math.round(gridStep * 0.45) : gridStep,
          radius: 16,
          bounciness: c.kind === 'bounce_tile' ? 1.35 : 0,
          oneWayPlatform: c.kind === 'wood_bridge',
        },
        physics: {
          enabled: false,
          gravityScale: 0,
          velocityX: 0,
          velocityY: 0,
          maxSpeed: 0,
          jumpForce: 0,
          friction: c.kind === 'ice_floor' ? 0.97 : 0.82,
        },
        animations: [],
        variables: {},
        tags: [c.kind],
        originX: c.col * gridStep,
        originY: c.row * gridStep,
        grounded: false,
        coyoteTimer: 0,
        jumpsLeft: 0,
        maxJumps: 0,
        touchingWallDir: 0,
        patrolDir: 1,
        facingDir: 1,
        animTimer: 0,
        animFrameIndex: 0,
      }));

    const statics = [
      ...this.objects.filter(
        (o) =>
          o.visible &&
          o.collision.isStatic &&
          !o.collision.isTrigger &&
          o.collision.shape !== 'none'
      ),
      ...tileGeneratedStatics,
    ];

    for (const obj of this.objects) {
      if (!obj.visible) continue;

      const activeClipObj = obj.animations.find((a) => a.name === obj.activeAnimation);
      const clipFps = activeClipObj?.fps || 8;
      const frameDuration = 1 / Math.max(1, clipFps);
      obj.animTimer += dt;
      if (obj.animTimer >= frameDuration) {
        obj.animTimer = 0;
        const frameCount = Math.max(2, activeClipObj?.frames?.length || 2);
        obj.animFrameIndex = (obj.animFrameIndex + 1) % frameCount;
      }

      if (obj.animLockTimer && obj.animLockTimer > 0) {
        obj.animLockTimer = Math.max(0, obj.animLockTimer - dt);
        if (obj.animLockTimer === 0 && obj.activeAnimation) {
          this.triggerAnimEvent(obj, obj.activeAnimation, 'on_finish');
        }
      }

      // Projectile lifecycle & enemy hit detection
      if (obj.role === 'projectile') {
        obj.x += obj.physics.velocityX * dt;
        obj.y += obj.physics.velocityY * dt;
        if (obj.lifetimeSec !== undefined) {
          obj.lifetimeSec -= dt;
          if (obj.lifetimeSec <= 0) {
            obj.visible = false;
            continue;
          }
        }
        for (const targetObj of this.objects) {
          if (!targetObj.visible || targetObj.id === obj.id) continue;
          if (
            (targetObj.role === 'enemy' || targetObj.role === 'crate') &&
            checkCollisionOverlap(obj, targetObj)
          ) {
            obj.visible = false;
            const dmg = obj.projectileDamage ?? 30;
            targetObj.hp = Math.max(0, targetObj.hp - dmg);
            audioSystem.playPreset('hit');
            this.addFloatingText(`-${dmg} HP`, targetObj.x + targetObj.width / 2, targetObj.y - 8, '#F43F5E');
            if (targetObj.hp <= 0) {
              targetObj.visible = false;
              this.score += 50;
              this.bannerMessage = `${targetObj.name} lazerle etkisiz hale getirildi! (+50 Puan)`;
              this.addFloatingText('+50 PUAN!', targetObj.x + targetObj.width / 2, targetObj.y - 24, '#34D399');
            }
            break;
          }
        }
        continue;
      }

      if (obj.collision.isStatic) continue;

      if (obj.role === 'enemy' && (obj.patrolDistance ?? 0) > 0 && (obj.patrolSpeed ?? 0) > 0) {
        obj.physics.velocityX = obj.patrolDir * (obj.patrolSpeed || 90);
        if (obj.physics.flipMode !== 'none') {
          obj.facingDir = obj.patrolDir >= 0 ? 1 : -1;
        }
        if (obj.x > obj.originX + (obj.patrolDistance || 120)) {
          obj.patrolDir = -1;
        } else if (obj.x < obj.originX - (obj.patrolDistance || 120)) {
          obj.patrolDir = 1;
        }
      }

      if (this.activeScene.gravityY !== 0 && obj.physics.gravityScale !== 0) {
        obj.physics.velocityY += this.activeScene.gravityY * obj.physics.gravityScale * dt;
      }

      const prevX = obj.x;
      const prevY = obj.y;
      obj.touchingWallDir = 0;

      obj.x += obj.physics.velocityX * dt;
      for (const wall of statics) {
        if (wall.id === obj.id) continue;
        if (wall.collision.oneWayPlatform) continue;
        if (wall.role === 'invisible_wall' && !doesInvisibleWallAffectObject(wall.collision, obj)) {
          continue;
        }
        if (checkCollisionOverlap(obj, wall)) {
          if (wall.role === 'invisible_wall' && wall.collision.boundaryAction && wall.collision.boundaryAction !== 'solid') {
            const edgeDir = obj.physics.velocityX >= 0 ? 'right' : 'left';
            if (obj.physics.velocityX > 0) obj.x = wall.x - obj.width;
            else if (obj.physics.velocityX < 0) obj.x = wall.x + wall.width;
            this.applyBoundaryAction(obj, edgeDir, wall.collision.boundaryAction);
            continue;
          }
          if (obj.physics.velocityX > 0) {
            obj.x = wall.x - obj.width;
            obj.touchingWallDir = 1;
          } else if (obj.physics.velocityX < 0) {
            obj.x = wall.x + wall.width;
            obj.touchingWallDir = -1;
          }
          obj.physics.velocityX = 0;
          if (wall.role === 'invisible_wall') {
            this.triggerBoundaryEvent(obj, obj.touchingWallDir >= 0 ? 'right' : 'left');
          }
        }
      }

      const wasGrounded = obj.grounded;
      obj.grounded = false;
      obj.y += obj.physics.velocityY * dt;

      for (const plat of statics) {
        if (plat.id === obj.id) continue;
        if (plat.role === 'invisible_wall' && !doesInvisibleWallAffectObject(plat.collision, obj)) {
          continue;
        }
        if (checkCollisionOverlap(obj, plat)) {
          if (plat.collision.oneWayPlatform) {
            // One-way platform: only collide if falling down from above plat.y
            if (obj.physics.velocityY < 0 || prevY + obj.height > plat.y + 10) {
              continue;
            }
          }
          if (plat.role === 'invisible_wall' && plat.collision.boundaryAction && plat.collision.boundaryAction !== 'solid') {
            const edgeDir = obj.physics.velocityY >= 0 ? 'bottom' : 'top';
            if (obj.physics.velocityY >= 0) obj.y = plat.y - obj.height;
            else obj.y = plat.y + plat.height;
            this.applyBoundaryAction(obj, edgeDir, plat.collision.boundaryAction);
            continue;
          }
          const gScale = obj.physics.gravityScale ?? 1;
          if (gScale >= 0 && obj.physics.velocityY >= 0) {
            obj.y = plat.y - obj.height;
            if (plat.role === 'bounce_pad' || plat.collision.bounciness > 1) {
              obj.physics.velocityY = -620;
              audioSystem.playPreset('jump');
            } else {
              obj.physics.velocityY = 0;
              obj.grounded = true;
              obj.coyoteTimer = 0.12;
              obj.jumpsLeft = obj.maxJumps;
              const carryDx = platformDeltaX.get(plat.id);
              if (carryDx) obj.x += carryDx;
            }
          } else if (gScale < 0 && obj.physics.velocityY <= 0) {
            obj.y = plat.y + plat.height;
            obj.physics.velocityY = 0;
            obj.grounded = true;
            obj.coyoteTimer = 0.12;
            obj.jumpsLeft = obj.maxJumps;
          } else if (obj.physics.velocityY < 0) {
            obj.y = plat.y + plat.height;
            obj.physics.velocityY = 0;
          } else {
            obj.y = plat.y - obj.height;
            obj.physics.velocityY = 0;
          }
        }
      }

      // World Boundaries (KareForge 2D invisible map bounds with character filter)
      const wb = this.activeScene.worldBounds;
      if (wb && wb.enabled && doesWorldBoundsAffectObject(wb, obj)) {
        const cam = this.activeScene.camera;
        const minX = cam.boundsX || 0;
        const maxX = Math.max(minX + 320, (cam.boundsX || 0) + (cam.boundsWidth || 1600));
        const minY = cam.boundsY || 0;
        const maxY = Math.max(minY + 240, (cam.boundsY || 0) + (cam.boundsHeight || 620));

        if (obj.x < minX) {
          obj.x = minX;
          this.applyBoundaryAction(obj, 'left', wb.leftAction || 'solid', wb.bouncePower ?? 520, wb.bottomDamage ?? 25);
        } else if (obj.x + obj.width > maxX) {
          obj.x = maxX - obj.width;
          this.applyBoundaryAction(obj, 'right', wb.rightAction || 'solid', wb.bouncePower ?? 520, wb.bottomDamage ?? 25);
        }

        if (obj.y < minY) {
          obj.y = minY;
          this.applyBoundaryAction(obj, 'top', wb.topAction || 'solid', wb.bouncePower ?? 520, wb.bottomDamage ?? 25);
        } else if (obj.y + obj.height > maxY) {
          obj.y = maxY - obj.height;
          this.applyBoundaryAction(obj, 'bottom', wb.bottomAction || 'respawn_damage', wb.bouncePower ?? 520, wb.bottomDamage ?? 25);
        }
      }

      if (obj.grounded && !wasGrounded) {
        obj.jumpsLeft = obj.maxJumps;
        this.triggerStateEvent(obj, 'landed');
      } else if (!obj.grounded && wasGrounded) {
        obj.coyoteTimer = 0.12;
      } else if (!obj.grounded) {
        obj.coyoteTimer = Math.max(0, obj.coyoteTimer - dt);
      }

      // Auto state animation switching (idle / move / jump / fall) when not locked in attack/dash
      if (obj.physics.autoAnimateState !== false && (!obj.animLockTimer || obj.animLockTimer <= 0)) {
        const prevClip = obj.activeAnimation || 'idle';
        let nextClip = prevClip;
        if (!obj.grounded && this.activeScene.gravityY !== 0) {
          nextClip = obj.physics.velocityY < -20 ? 'jump' : 'fall';
        } else if (Math.abs(obj.physics.velocityX) > 12 || (this.activeScene.gravityY === 0 && Math.abs(obj.physics.velocityY) > 12)) {
          nextClip = 'move';
        } else {
          nextClip = 'idle';
        }
        if (nextClip !== prevClip) {
          obj.activeAnimation = nextClip;
          this.triggerAnimEvent(obj, nextClip, 'on_start');
        }
      }

      obj.physics.velocityX *= obj.physics.friction || 0.82;
      if (this.activeScene.gravityY === 0) {
        obj.physics.velocityY *= obj.physics.friction || 0.82;
      }
      if (Math.abs(obj.physics.velocityX) < 2) obj.physics.velocityX = 0;
      void prevX;
    }

    // Built-in Bounce Pad, PowerUp Potion, Checkpoint, Hazard & Lava Tile interactions for Player
    const playerObj = this.objects.find((o) => o.role === 'player' && o.visible);
    if (playerObj) {
      for (const other of this.objects) {
        if (!other.visible || other.id === playerObj.id) continue;
        if (other.role === 'bounce_pad' && checkCollisionOverlap(playerObj, other)) {
          playerObj.physics.velocityY = -640;
          playerObj.grounded = false;
          audioSystem.playPreset('jump');
        } else if (other.role === 'checkpoint' && checkCollisionOverlap(playerObj, other)) {
          const cpKey = `cp_${other.id}`;
          const lastSaved = this.collisionCooldowns.get(cpKey) ?? -999;
          if (this.elapsedSec - lastSaved >= 3.0 && (playerObj.originX !== other.x || playerObj.originY !== other.y - 10)) {
            this.collisionCooldowns.set(cpKey, this.elapsedSec);
            playerObj.originX = other.x;
            playerObj.originY = other.y - 10;
            playerObj.hp = Math.min(playerObj.maxHp, playerObj.hp + 15);
            other.color = '#10B981';
            audioSystem.playPreset('quest');
            this.bannerMessage = `🚩 Kayıt Noktası (${other.name}) etkinleştirildi! (+15 Can)`;
            this.addFloatingText('🚩 KAYIT ALINDI!', other.x + other.width / 2, other.y - 12, '#34D399');
          }
        } else if (
          other.role === 'invisible_wall' &&
          other.collision.isTrigger &&
          doesInvisibleWallAffectObject(other.collision, playerObj) &&
          checkCollisionOverlap(playerObj, other)
        ) {
          this.applyBoundaryAction(
            playerObj,
            'bottom',
            other.collision.boundaryAction || 'respawn_damage',
            this.activeScene.worldBounds?.bouncePower ?? 520,
            this.activeScene.worldBounds?.bottomDamage ?? 25
          );
        } else if (other.role === 'powerup' && checkCollisionOverlap(playerObj, other)) {
          other.visible = false;
          playerObj.hp = Math.min(playerObj.maxHp, playerObj.hp + 35);
          this.score += 25;
          audioSystem.playPreset('quest');
          this.bannerMessage = 'Can İksiri alındı! (+35 Can, +25 Puan)';
          this.addFloatingText('+35 CAN', playerObj.x + playerObj.width / 2, playerObj.y - 10, '#34D399');
        } else if (other.role === 'hazard' && checkCollisionOverlap(playerObj, other)) {
          const hKey = `hazard_${other.id}`;
          const lastHit = this.collisionCooldowns.get(hKey) ?? -999;
          if (this.elapsedSec - lastHit >= 0.6) {
            this.collisionCooldowns.set(hKey, this.elapsedSec);
            playerObj.hp = Math.max(0, playerObj.hp - 25);
            playerObj.physics.velocityY = -320;
            this.shakeIntensity = 6;
            this.shakeTimer = 0.2;
            audioSystem.playPreset('hit');
            this.bannerMessage = 'Diken/Tuzak hasarı! (-25 Can)';
            this.addFloatingText('-25 CAN', playerObj.x + playerObj.width / 2, playerObj.y - 10, '#F43F5E');
            this.triggerStateEvent(playerObj, 'damaged');
          }
        }
      }

      for (const cell of this.activeScene.tilemapCells || []) {
        if (cell.kind !== 'lava_hazard') continue;
        const lx = cell.col * gridStep;
        const ly = cell.row * gridStep;
        if (
          playerObj.x < lx + gridStep &&
          playerObj.x + playerObj.width > lx &&
          playerObj.y < ly + gridStep &&
          playerObj.y + playerObj.height > ly
        ) {
          const lKey = `lava_${cell.col}_${cell.row}`;
          const lastHit = this.collisionCooldowns.get(lKey) ?? -999;
          if (this.elapsedSec - lastHit >= 0.6) {
            this.collisionCooldowns.set(lKey, this.elapsedSec);
            playerObj.hp = Math.max(0, playerObj.hp - 25);
            playerObj.physics.velocityY = -340;
            audioSystem.playPreset('hit');
            this.bannerMessage = 'Lav tuzağına değdin! (-25 Can)';
            this.triggerStateEvent(playerObj, 'damaged');
          }
        }
      }
    }

    for (const rule of this.rules) {
      if (rule.eventType === 'event_on_collision') {
        const subject = this.getTargetObject(rule.targetObjectId);
        if (!subject || !subject.visible) continue;
        const desiredRole = String(rule.eventParams.otherRole ?? 'collectible');

        for (const other of this.objects) {
          if (other.id === subject.id || !other.visible || other.role !== desiredRole) continue;
          const pairKey = `${rule.id}_${subject.id}_${other.id}`;
          const overlapping = checkCollisionOverlap(subject, other);
          const lastFired = this.collisionCooldowns.get(pairKey) ?? -999;

          if (overlapping && this.elapsedSec - lastFired >= 0.45) {
            this.collisionCooldowns.set(pairKey, this.elapsedSec);
            this.executeActionList(rule.actions, other);
          }
        }
      } else if (rule.eventType === 'event_health_zero') {
        const subject = this.getTargetObject(rule.targetObjectId);
        if (subject && subject.hp <= 0) {
          this.executeActionList(rule.actions, null);
        }
      }
    }

    const cam = this.activeScene.camera;
    if (cam.followTargetId) {
      const target = this.objects.find((o) => o.id === cam.followTargetId);
      if (target) {
        const desiredX = target.x + target.width / 2 - cam.width / 2;
        const desiredY = target.y + target.height / 2 - cam.height / 2;
        const maxCamX = Math.max(0, cam.boundsWidth - cam.width);
        const maxCamY = Math.max(0, cam.boundsHeight - cam.height);
        const clampedX = Math.max(cam.boundsX, Math.min(maxCamX, desiredX));
        const clampedY = Math.max(cam.boundsY, Math.min(maxCamY, desiredY));
        this.cameraX += (clampedX - this.cameraX) * (cam.smoothing || 0.15);
        this.cameraY += (clampedY - this.cameraY) * (cam.smoothing || 0.15);
      }
    }

    return this.getSnapshot();
  }

  public getSnapshot(): RuntimeSnapshot {
    const player = this.objects.find((o) => o.role === 'player');
    const shakeX =
      this.shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 2 * this.shakeIntensity) : 0;
    const shakeY =
      this.shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 2 * this.shakeIntensity) : 0;
    return {
      status: this.status,
      statusReason: this.statusReason,
      sceneId: this.activeScene.id,
      sceneName: this.activeScene.name,
      score: this.score,
      hp: player ? player.hp : 100,
      maxHp: player ? player.maxHp : 100,
      bannerMessage: this.bannerMessage,
      activeDialogue: this.activeDialogue,
      inventory: [...this.inventory],
      quests: this.quests.map((q) => ({ ...q })),
      variables: { ...this.variables },
      cameraX: Math.round(this.cameraX) + shakeX,
      cameraY: Math.round(this.cameraY) + shakeY,
      fps: this.fps,
      elapsedSec: Number(this.elapsedSec.toFixed(1)),
      objects: this.objects,
      floatingTexts: this.floatingTexts,
    };
  }
}
