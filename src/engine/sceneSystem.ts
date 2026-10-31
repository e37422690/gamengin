import {
  GameObject,
  GameScene,
  GodotNodeClass,
  ObjectRole,
  SceneLayer,
} from '../types/engine';

export interface ViewportTransform {
  panX: number;
  panY: number;
  zoom: number;
}

export function getGodotNodeClassForRole(role: ObjectRole): GodotNodeClass {
  switch (role) {
    case 'player':
    case 'enemy':
      return 'CharacterBody2D';
    case 'platform':
    case 'moving_platform':
    case 'invisible_wall':
    case 'crate':
    case 'prop':
      return 'StaticBody2D';
    case 'light_source':
      return 'PointLight2D';
    case 'ui_button':
      return 'Control';
    default:
      return 'Area2D';
  }
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  canvasRect: { left: number; top: number },
  viewport: ViewportTransform
): { x: number; y: number } {
  const localX = screenX - canvasRect.left;
  const localY = screenY - canvasRect.top;
  const safeZoom = Math.max(0.1, viewport.zoom);
  return {
    x: (localX - viewport.panX) / safeZoom,
    y: (localY - viewport.panY) / safeZoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: ViewportTransform
): { x: number; y: number } {
  const safeZoom = Math.max(0.1, viewport.zoom);
  return {
    x: worldX * safeZoom + viewport.panX,
    y: worldY * safeZoom + viewport.panY,
  };
}

export function snapValueToGrid(val: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 1) return Math.round(val);
  return Math.round(val / gridSize) * gridSize;
}

export function createDefaultObject(
  role: ObjectRole,
  x: number,
  y: number,
  layerId: string,
  indexSuffix = 1
): GameObject {
  const presets: Record<
    ObjectRole,
    {
      name: string;
      width: number;
      height: number;
      color: string;
      secondaryColor: string;
      shapePreset: GameObject['shapePreset'];
      isStatic: boolean;
      isTrigger: boolean;
      gravityScale: number;
      collisionLayer: GameObject['collision']['layer'];
    }
  > = {
    player: {
      name: `Player_CharacterBody2D_${indexSuffix}`,
      width: 44,
      height: 52,
      color: '#2563EB',
      secondaryColor: '#93C5FD',
      shapePreset: 'hero',
      isStatic: false,
      isTrigger: false,
      gravityScale: 1,
      collisionLayer: 'player',
    },
    platform: {
      name: `StaticPlatform_${indexSuffix}`,
      width: 192,
      height: 32,
      color: '#334155',
      secondaryColor: '#10B981',
      shapePreset: 'platform',
      isStatic: true,
      isTrigger: false,
      gravityScale: 0,
      collisionLayer: 'world',
    },
    moving_platform: {
      name: `Hareketli_Platform2D_${indexSuffix}`,
      width: 144,
      height: 26,
      color: '#1E293B',
      secondaryColor: '#38BDF8',
      shapePreset: 'platform',
      isStatic: true,
      isTrigger: false,
      gravityScale: 0,
      collisionLayer: 'world',
    },
    invisible_wall: {
      name: `Gorunmez_Sinir2D_${indexSuffix}`,
      width: 32,
      height: 192,
      color: '#06B6D4',
      secondaryColor: '#F59E0B',
      shapePreset: 'invisible_wall',
      isStatic: true,
      isTrigger: false,
      gravityScale: 0,
      collisionLayer: 'world',
    },
    checkpoint: {
      name: `Kayit_Noktasi2D_${indexSuffix}`,
      width: 36,
      height: 56,
      color: '#0EA5E9',
      secondaryColor: '#38BDF8',
      shapePreset: 'checkpoint',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'sensor',
    },
    enemy: {
      name: `Slime_Enemy2D_${indexSuffix}`,
      width: 44,
      height: 40,
      color: '#DC2626',
      secondaryColor: '#FCA5A5',
      shapePreset: 'slime',
      isStatic: false,
      isTrigger: false,
      gravityScale: 1,
      collisionLayer: 'enemy',
    },
    collectible: {
      name: `Coin_Area2D_${indexSuffix}`,
      width: 28,
      height: 28,
      color: '#D97706',
      secondaryColor: '#FDE68A',
      shapePreset: 'coin',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'item',
    },
    powerup: {
      name: `Can_Iksiri_Area2D_${indexSuffix}`,
      width: 30,
      height: 34,
      color: '#10B981',
      secondaryColor: '#A7F3D0',
      shapePreset: 'potion',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'item',
    },
    projectile: {
      name: `Lazer_Mermisi2D_${indexSuffix}`,
      width: 24,
      height: 10,
      color: '#38BDF8',
      secondaryColor: '#E0F2FE',
      shapePreset: 'laser_bolt',
      isStatic: false,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'sensor',
    },
    goal: {
      name: `GoalFlag_Area2D_${indexSuffix}`,
      width: 40,
      height: 64,
      color: '#16A34A',
      secondaryColor: '#86EFAC',
      shapePreset: 'flag',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'sensor',
    },
    npc: {
      name: `DialogNPC_Area2D_${indexSuffix}`,
      width: 44,
      height: 52,
      color: '#7C3AED',
      secondaryColor: '#DDD6FE',
      shapePreset: 'npc',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'sensor',
    },
    crate: {
      name: `Crate_Rigid2D_${indexSuffix}`,
      width: 48,
      height: 48,
      color: '#B45309',
      secondaryColor: '#FCD34D',
      shapePreset: 'crate',
      isStatic: false,
      isTrigger: false,
      gravityScale: 0,
      collisionLayer: 'world',
    },
    trigger: {
      name: `Portal_Area2D_${indexSuffix}`,
      width: 48,
      height: 48,
      color: '#0891B2',
      secondaryColor: '#A5F3FC',
      shapePreset: 'portal',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'sensor',
    },
    prop: {
      name: `Crystal_Static2D_${indexSuffix}`,
      width: 36,
      height: 44,
      color: '#0D9488',
      secondaryColor: '#99F6E4',
      shapePreset: 'crystal',
      isStatic: true,
      isTrigger: false,
      gravityScale: 0,
      collisionLayer: 'world',
    },
    ui_button: {
      name: `Button_Control_${indexSuffix}`,
      width: 160,
      height: 48,
      color: '#1E293B',
      secondaryColor: '#38BDF8',
      shapePreset: 'button',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'sensor',
    },
    hazard: {
      name: `Spikes_Hazard2D_${indexSuffix}`,
      width: 64,
      height: 24,
      color: '#EF4444',
      secondaryColor: '#FCA5A5',
      shapePreset: 'spikes',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'enemy',
    },
    bounce_pad: {
      name: `Spring_Bounce2D_${indexSuffix}`,
      width: 48,
      height: 24,
      color: '#EC4899',
      secondaryColor: '#FBCFE8',
      shapePreset: 'spring',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'sensor',
    },
    light_source: {
      name: `PointLight2D_${indexSuffix}`,
      width: 32,
      height: 40,
      color: '#F59E0B',
      secondaryColor: '#FEF08A',
      shapePreset: 'torch',
      isStatic: true,
      isTrigger: true,
      gravityScale: 0,
      collisionLayer: 'sensor',
    },
  };

  const p = presets[role] || presets.platform;
  const id = `obj_${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    name: p.name,
    role,
    nodeClass: getGodotNodeClassForRole(role),
    layerId,
    x: Math.round(x),
    y: Math.round(y),
    width: p.width,
    height: p.height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex:
      role === 'platform' || role === 'moving_platform' || role === 'invisible_wall'
        ? 1
        : role === 'player'
        ? 10
        : 5,
    visible: true,
    locked: false,
    color: p.color,
    secondaryColor: p.secondaryColor,
    shapePreset: p.shapePreset,
    text: role === 'ui_button' ? 'Tıkla (+10)' : undefined,
    hp: role === 'player' ? 100 : role === 'enemy' ? 60 : 100,
    maxHp: role === 'player' ? 100 : role === 'enemy' ? 60 : 100,
    patrolDistance: role === 'enemy' || role === 'moving_platform' ? 110 : 0,
    patrolSpeed: role === 'enemy' ? 95 : role === 'moving_platform' ? 75 : 0,
    collision: {
      shape: role === 'collectible' ? 'circle' : role === 'light_source' ? 'none' : 'rect',
      isStatic: p.isStatic,
      isTrigger: p.isTrigger,
      layer: p.collisionLayer,
      offsetX: 0,
      offsetY: 0,
      width: p.width,
      height: p.height,
      radius: Math.round(Math.min(p.width, p.height) / 2),
      bounciness: role === 'bounce_pad' ? 1.3 : 0,
      oneWayPlatform: false,
      boundaryAction: role === 'invisible_wall' ? 'solid' : undefined,
      wallTargetFilter: role === 'invisible_wall' ? 'all' : undefined,
      wallTargetIds: role === 'invisible_wall' ? [] : undefined,
    },
    physics: {
      enabled: !p.isStatic,
      gravityScale: p.gravityScale,
      velocityX: 0,
      velocityY: 0,
      maxSpeed: 260,
      jumpForce: 460,
      friction: 0.85,
      jumpMode: role === 'player' ? 'multi_jump' : 'grounded_only',
      maxJumps: role === 'player' ? 2 : 1,
      wallJumpEnabled: role === 'player',
      flipMode: 'horizontal',
      initialFacing: 1,
      autoAnimateState: true,
    },
    vfx: {
      lightEnabled:
        role === 'light_source' ||
        role === 'goal' ||
        role === 'collectible' ||
        role === 'checkpoint',
      lightColor:
        role === 'light_source'
          ? '#F59E0B'
          : role === 'goal'
          ? '#10B981'
          : role === 'checkpoint'
          ? '#38BDF8'
          : role === 'collectible'
          ? '#FACC15'
          : '#38BDF8',
      lightRadius: role === 'light_source' ? 160 : role === 'goal' || role === 'checkpoint' ? 95 : 65,
      lightIntensity: 0.65,
      particlePreset: role === 'light_source' ? 'fire' : role === 'goal' ? 'sparkles' : 'none',
    },
    animations: [
      {
        id: 'idle',
        name: 'Durma (Idle)',
        fps: 4,
        loop: true,
        triggerTag: 'on_idle',
        frames: [
          { id: 'f1', x: 0, y: 0, width: p.width, height: p.height, poseOffsetY: 0, poseScaleY: 1 },
          { id: 'f2', x: 0, y: -2, width: p.width, height: p.height, poseOffsetY: -2, poseScaleY: 0.98 },
        ],
      },
      {
        id: 'move',
        name: 'Koşma (Run)',
        fps: 10,
        loop: true,
        triggerTag: 'on_run',
        frames: [
          { id: 'f1', x: -2, y: 0, width: p.width, height: p.height, poseOffsetY: -1, poseRotation: 4 },
          { id: 'f2', x: 2, y: -3, width: p.width, height: p.height, poseOffsetY: -4, poseRotation: -4 },
        ],
      },
      {
        id: 'jump',
        name: 'Zıplama (Jump)',
        fps: 8,
        loop: false,
        triggerTag: 'on_jump',
        frames: [
          { id: 'f1', x: 0, y: -4, width: p.width, height: p.height, poseOffsetY: -5, poseScaleX: 0.92, poseScaleY: 1.08 },
        ],
      },
      {
        id: 'fall',
        name: 'Düşme (Fall)',
        fps: 6,
        loop: true,
        triggerTag: 'on_fall',
        frames: [
          { id: 'f1', x: 0, y: 2, width: p.width, height: p.height, poseOffsetY: 2, poseScaleX: 1.05, poseScaleY: 0.95 },
        ],
      },
      {
        id: 'attack',
        name: 'Saldırı / Lazer (Attack)',
        fps: 12,
        loop: false,
        triggerTag: 'on_attack',
        frames: [
          { id: 'f1', x: 4, y: 0, width: p.width, height: p.height, poseScaleX: 1.12, poseRotation: 6 },
          { id: 'f2', x: 0, y: 0, width: p.width, height: p.height, poseScaleX: 1.0, poseRotation: 0 },
        ],
      },
      {
        id: 'dash',
        name: 'Atılma (Dash)',
        fps: 14,
        loop: false,
        triggerTag: 'on_dash',
        frames: [
          { id: 'f1', x: 6, y: 0, width: p.width, height: p.height, poseScaleX: 1.18, poseScaleY: 0.86, poseRotation: 10 },
        ],
      },
    ],
    activeAnimation: 'idle',
    variables: {},
    tags: [role],
  };
}

export function checkCollisionOverlap(a: GameObject, b: GameObject): boolean {
  if (a.id === b.id || !a.visible || !b.visible) return false;
  if (a.collision.shape === 'none' || b.collision.shape === 'none') return false;

  const ax = a.x + a.collision.offsetX;
  const ay = a.y + a.collision.offsetY;
  const aw = a.collision.width * Math.abs(a.scaleX);
  const ah = a.collision.height * Math.abs(a.scaleY);

  const bx = b.x + b.collision.offsetX;
  const by = b.y + b.collision.offsetY;
  const bw = b.collision.width * Math.abs(b.scaleX);
  const bh = b.collision.height * Math.abs(b.scaleY);

  if (a.collision.shape === 'circle' && b.collision.shape === 'circle') {
    const acx = ax + aw / 2;
    const acy = ay + ah / 2;
    const bcx = bx + bw / 2;
    const bcy = by + bh / 2;
    const rSum = a.collision.radius + b.collision.radius;
    const dx = acx - bcx;
    const dy = acy - bcy;
    return dx * dx + dy * dy <= rSum * rSum;
  }

  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function measureDistance(a: GameObject, b: GameObject): number {
  const acx = a.x + a.width / 2;
  const acy = a.y + a.height / 2;
  const bcx = b.x + b.width / 2;
  const bcy = b.y + b.height / 2;
  return Math.hypot(acx - bcx, acy - bcy);
}

export function duplicateObjectInScene(
  scene: GameScene,
  objectId: string,
  offset = 24
): { scene: GameScene; newObject: GameObject | null } {
  const original = scene.objects.find((o) => o.id === objectId);
  if (!original) return { scene, newObject: null };

  const copy: GameObject = JSON.parse(JSON.stringify(original));
  copy.id = `obj_${original.role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  copy.name = `${original.name}_Kopya`;
  copy.x = snapValueToGrid(original.x + offset, scene.gridSize, scene.snapToGrid);
  copy.y = snapValueToGrid(original.y + offset, scene.gridSize, scene.snapToGrid);

  return {
    scene: {
      ...scene,
      objects: [...scene.objects, copy],
    },
    newObject: copy,
  };
}

export function doesInvisibleWallAffectObject(
  wallCollision: { wallTargetFilter?: string; wallTargetIds?: string[] } | undefined,
  candidate: { id: string; role: string; name?: string }
): boolean {
  const filter = wallCollision?.wallTargetFilter || 'all';
  if (filter === 'all') return true;
  if (filter === 'player_only') return candidate.role === 'player';
  if (filter === 'enemies_only') return candidate.role === 'enemy';
  if (filter === 'npcs_only') return candidate.role === 'npc';
  if (filter === 'custom') {
    const ids = wallCollision?.wallTargetIds || [];
    return ids.includes(candidate.id) || (candidate.name ? ids.includes(candidate.name) : false);
  }
  return true;
}

export function doesWorldBoundsAffectObject(
  worldBounds: { targetFilter?: string; targetIds?: string[] } | undefined,
  candidate: { id: string; role: string; name?: string }
): boolean {
  const filter = worldBounds?.targetFilter || 'all';
  if (filter === 'all') return true;
  if (filter === 'player_only') return candidate.role === 'player';
  if (filter === 'enemies_only') return candidate.role === 'enemy';
  if (filter === 'npcs_only') return candidate.role === 'npc';
  if (filter === 'custom') {
    const ids = worldBounds?.targetIds || [];
    return ids.includes(candidate.id) || (candidate.name ? ids.includes(candidate.name) : false);
  }
  return true;
}

export function sortSceneObjectsForRender(
  objects: GameObject[],
  layers: SceneLayer[]
): GameObject[] {
  const layerOrderMap = new Map<string, number>();
  const layerVisibleMap = new Map<string, boolean>();
  for (const l of layers) {
    layerOrderMap.set(l.id, l.order);
    layerVisibleMap.set(l.id, l.visible);
  }

  return objects
    .filter((o) => o.visible && layerVisibleMap.get(o.layerId) !== false)
    .slice()
    .sort((a, b) => {
      const la = layerOrderMap.get(a.layerId) ?? 0;
      const lb = layerOrderMap.get(b.layerId) ?? 0;
      if (la !== lb) return la - lb;
      return a.zIndex - b.zIndex;
    });
}
