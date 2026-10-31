export const ENGINE_VERSION = '3.0.0';
export const SCHEMA_VERSION = 3;

export type TemplateType =
  | 'empty'
  | 'platformer'
  | 'topdown'
  | 'puzzle'
  | 'clicker'
  | 'story';

export type ObjectRole =
  | 'player'
  | 'platform'
  | 'moving_platform'
  | 'invisible_wall'
  | 'checkpoint'
  | 'enemy'
  | 'collectible'
  | 'powerup'
  | 'projectile'
  | 'npc'
  | 'goal'
  | 'trigger'
  | 'prop'
  | 'ui_button'
  | 'crate'
  | 'hazard'
  | 'bounce_pad'
  | 'light_source';

export type GodotNodeClass =
  | 'CharacterBody2D'
  | 'StaticBody2D'
  | 'Area2D'
  | 'RigidBody2D'
  | 'PointLight2D'
  | 'Control';

export type CollisionShapeType = 'none' | 'rect' | 'circle';

export type BoundaryCollisionAction =
  | 'solid'
  | 'bounce'
  | 'wrap'
  | 'respawn_damage'
  | 'gameover'
  | 'victory'
  | 'trigger_only'
  | 'none';

export type JumpModeType = 'grounded_only' | 'multi_jump' | 'infinite';

export type CharacterFlipMode = 'horizontal' | 'rotate' | 'none';

export type InvisibleWallTargetFilter =
  | 'all'
  | 'player_only'
  | 'enemies_only'
  | 'npcs_only'
  | 'custom';

export interface WorldBoundsConfig {
  enabled: boolean;
  showGizmoInEditor: boolean;
  leftAction: BoundaryCollisionAction;
  rightAction: BoundaryCollisionAction;
  topAction: BoundaryCollisionAction;
  bottomAction: BoundaryCollisionAction;
  bottomDamage: number;
  bouncePower: number;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
  targetFilter?: InvisibleWallTargetFilter;
  targetIds?: string[];
}

export interface CollisionConfig {
  shape: CollisionShapeType;
  isStatic: boolean;
  isTrigger: boolean;
  layer: 'default' | 'player' | 'world' | 'enemy' | 'item' | 'sensor';
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  radius: number;
  bounciness: number;
  oneWayPlatform?: boolean;
  boundaryAction?: BoundaryCollisionAction;
  wallTargetFilter?: InvisibleWallTargetFilter;
  wallTargetIds?: string[];
}

export interface PhysicsConfig {
  enabled: boolean;
  gravityScale: number;
  velocityX: number;
  velocityY: number;
  maxSpeed: number;
  jumpForce: number;
  friction: number;
  jumpMode?: JumpModeType;
  maxJumps?: number;
  wallJumpEnabled?: boolean;
  flipMode?: CharacterFlipMode;
  initialFacing?: 1 | -1;
  autoAnimateState?: boolean;
}

export interface AnimationFrame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colorOverride?: string;
  svgPath?: string;
  poseOffsetY?: number;
  poseScaleX?: number;
  poseScaleY?: number;
  poseRotation?: number;
}

export interface AnimationClip {
  id: string;
  name: string;
  fps: number;
  loop: boolean;
  triggerTag?: string;
  frames: AnimationFrame[];
}

export type ParticlePresetType = 'none' | 'sparkles' | 'fire' | 'smoke' | 'aura' | 'rain';

export interface LightAndParticleConfig {
  lightEnabled: boolean;
  lightColor: string;
  lightRadius: number;
  lightIntensity: number;
  particlePreset: ParticlePresetType;
  particleColor?: string;
}

export interface GameObject {
  id: string;
  name: string;
  role: ObjectRole;
  nodeClass?: GodotNodeClass;
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  color: string;
  secondaryColor?: string;
  spriteAssetId?: string;
  customSpriteDataUrl?: string;
  shapePreset:
    | 'hero'
    | 'knight'
    | 'mage'
    | 'ninja'
    | 'robot'
    | 'platform'
    | 'invisible_wall'
    | 'checkpoint'
    | 'coin'
    | 'slime'
    | 'flag'
    | 'key'
    | 'chest'
    | 'npc'
    | 'crate'
    | 'crystal'
    | 'button'
    | 'portal'
    | 'spikes'
    | 'spring'
    | 'torch'
    | 'laser_bolt'
    | 'potion';
  text?: string;
  hp: number;
  maxHp: number;
  patrolDistance?: number;
  patrolSpeed?: number;
  dialogueId?: string;
  questId?: string;
  inventoryItemId?: string;
  collision: CollisionConfig;
  physics: PhysicsConfig;
  vfx?: LightAndParticleConfig;
  animations: AnimationClip[];
  activeAnimation?: string;
  variables: Record<string, number | string | boolean>;
  tags: string[];
}

export type TileBrushKind =
  | 'grass_ground'
  | 'stone_wall'
  | 'crystal_block'
  | 'lava_hazard'
  | 'wood_bridge'
  | 'bounce_tile'
  | 'ice_floor'
  | 'gold_ore';

export interface TileMapCell {
  col: number;
  row: number;
  kind: TileBrushKind;
  layerId?: string;
}

export interface SceneLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
  parallaxFactor: number;
}

export interface CameraConfig {
  width: number;
  height: number;
  zoom: number;
  followTargetId: string | null;
  smoothing: number;
  boundsX: number;
  boundsY: number;
  boundsWidth: number;
  boundsHeight: number;
}

export type BlockCategory =
  | 'events'
  | 'movement'
  | 'control'
  | 'variables'
  | 'sensing'
  | 'audio'
  | 'animation'
  | 'scene'
  | 'ui'
  | 'advanced';

export interface BlockParamDef {
  name: string;
  label: string;
  type:
    | 'number'
    | 'string'
    | 'boolean'
    | 'key'
    | 'objectRole'
    | 'sceneId'
    | 'variable'
    | 'operator'
    | 'sound'
    | 'animation'
    | 'direction';
  defaultValue: string | number | boolean;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
}

export type BlockType = string;

export interface BlockDefinition {
  type: BlockType;
  category: BlockCategory;
  label: string;
  description: string;
  isHat?: boolean;
  isContainer?: boolean;
  params: BlockParamDef[];
}

export interface BlockInstance {
  id: string;
  type: string;
  targetObjectId: string | 'scene';
  params: Record<string, string | number | boolean>;
  children?: BlockInstance[];
  elseChildren?: BlockInstance[];
  disabled?: boolean;
  collapsed?: boolean;
  minHeightPx?: number;
  comment?: string;
}

export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId?: string;
  giveItem?: string;
  startQuestId?: string;
  completeQuestId?: string;
  scoreDelta?: number;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  portraitColor: string;
  text: string;
  choices: DialogueChoice[];
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  status: 'inactive' | 'active' | 'completed';
  targetItem?: string;
  rewardScore: number;
}

export type DialogueEntry = DialogueNode;
export type QuestEntry = QuestDefinition;

export interface GameScene {
  id: string;
  name: string;
  backgroundColor: string;
  ambientLight?: number;
  gridSize: number;
  snapToGrid: boolean;
  gravityY: number;
  camera: CameraConfig;
  worldBounds?: WorldBoundsConfig;
  layers: SceneLayer[];
  objects: GameObject[];
  tilemapCells?: TileMapCell[];
  blocks: BlockInstance[];
  customScriptCode?: string;
  codeSyncLocked?: boolean;
  dialogues: DialogueNode[];
  quests: QuestDefinition[];
}

export type AssetKind = 'image' | 'audio' | 'font' | 'atlas';

export interface SpriteAtlasSlice {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameAsset {
  id: string;
  name: string;
  kind: AssetKind;
  mimeType: string;
  sizeBytes: number;
  folder: string;
  tags: string[];
  createdAt: string;
  width?: number;
  height?: number;
  durationSec?: number;
  previewDataUrl?: string;
  atlasSlices?: SpriteAtlasSlice[];
  builtinSvg?: string;
  synthPreset?:
    | 'jump'
    | 'coin'
    | 'hit'
    | 'victory'
    | 'laser'
    | 'click'
    | 'quest'
    | 'bgm_adventure'
    | 'bgm_arcade';
}

export interface GlobalVariable {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean';
  scope: 'global' | 'scene';
  initialValue: number | string | boolean;
}

export interface ProjectSettings {
  resolutionWidth: number;
  resolutionHeight: number;
  targetFps: number;
  pixelArtMode: boolean;
  defaultVolume: number;
  touchControlsEnabled: boolean;
  author: string;
  license: string;
  customSandboxScript?: string;
}

export interface GameProject {
  id: string;
  name: string;
  description: string;
  version: string;
  schemaVersion: number;
  engineVersion: string;
  template: TemplateType;
  createdAt: string;
  updatedAt: string;
  startSceneId: string;
  activeSceneId: string;
  settings: ProjectSettings;
  variables: GlobalVariable[];
  scenes: GameScene[];
  assets: GameAsset[];
}

export interface DiagnosticIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  title: string;
  message: string;
  sceneId?: string;
  objectId?: string;
  blockId?: string;
  assetId?: string;
  suggestion: string;
}

export interface StorageStatus {
  state: 'saved' | 'saving' | 'dirty' | 'error';
  lastSavedAt: string | null;
  usedBytes: number;
  quotaBytes: number;
  persisted: boolean;
  errorMessage?: string;
}

export interface ExportManifest {
  format: 'project-zip' | 'web-distribution' | 'single-html';
  projectId: string;
  projectName: string;
  projectVersion: string;
  schemaVersion: number;
  engineVersion: string;
  exportedAt: string;
  sceneCount: number;
  assetCount: number;
  blockCount: number;
  checksum: string;
}

export interface WorkspaceLayoutDimensions {
  sceneLeftWidth: number;
  sceneLeftSplitRatio: number;
  sceneRightWidth: number;
  sceneBottomHeight: number;
  sceneBottomOpen: boolean;
  blocksPaletteWidth: number;
  blocksCodeWidth: number;
  blocksCodeSplitRatio: number;
  blocksScale: number;
  assetsRightWidth: number;
  codeRightWidth: number;
  previewCanvasScale: number;
}

export const DEFAULT_WORKSPACE_DIMENSIONS: WorkspaceLayoutDimensions = {
  sceneLeftWidth: 280,
  sceneLeftSplitRatio: 0.56,
  sceneRightWidth: 350,
  sceneBottomHeight: 175,
  sceneBottomOpen: true,
  blocksPaletteWidth: 740,
  blocksCodeWidth: 360,
  blocksCodeSplitRatio: 0.58,
  blocksScale: 1.05,
  assetsRightWidth: 380,
  codeRightWidth: 460,
  previewCanvasScale: 1.0,
};
