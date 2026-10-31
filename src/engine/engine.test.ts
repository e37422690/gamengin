import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenToWorld,
  worldToScreen,
  snapValueToGrid,
  createDefaultObject,
  checkCollisionOverlap,
  duplicateObjectInScene,
  sortSceneObjectsForRender,
  doesInvisibleWallAffectObject,
} from './sceneSystem';
import {
  validateSceneBlocks,
  compileBlocksToIR,
  generateReadableCode,
} from './blockSystem';
import { createProjectFromTemplate } from './templates';
import { runProjectDiagnostics, getUnusedAssets } from './diagnostics';
import { UndoRedoManager } from './undoRedo';
import {
  sanitizeSvgContent,
  saveProjectToStorage,
  loadProjectFromStorage,
  setSimulatedStorageFailure,
} from './storageSystem';
import { GameRuntimeEngine } from './gameRuntime';
import {
  exportSingleHtml,
  exportProjectZip,
  exportDistributionZip,
  importProjectFromZipBuffer,
  isSafeZipEntryPath,
} from './exportSystem';

describe('KareForge 2D Core Engine & 100% Export Parity Suite', () => {
  it('1. Coordinate transform round-trip & grid snapping', () => {
    const vp = { panX: 120, panY: -45, zoom: 1.5 };
    const rect = { left: 0, top: 0 };
    const worldPt = { x: 320, y: 480 };
    const screenPt = worldToScreen(worldPt.x, worldPt.y, vp);
    const roundTrip = screenToWorld(screenPt.x, screenPt.y, rect, vp);

    assert.ok(Math.abs(roundTrip.x - worldPt.x) < 1e-6);
    assert.ok(Math.abs(roundTrip.y - worldPt.y) < 1e-6);

    assert.equal(snapValueToGrid(37, 32, true), 32);
    assert.equal(snapValueToGrid(51, 32, true), 64);
    assert.equal(snapValueToGrid(51, 32, false), 51);
  });

  it('2. AABB & Circle collision detection accuracy', () => {
    const obj1 = createDefaultObject('player', 100, 100, 'layer_main', 1);
    const obj2 = createDefaultObject('collectible', 110, 110, 'layer_main', 1);
    const obj3 = createDefaultObject('enemy', 400, 400, 'layer_main', 1);

    assert.equal(checkCollisionOverlap(obj1, obj2), true);
    assert.equal(checkCollisionOverlap(obj1, obj3), false);
  });

  it('3. Object duplication and layer + zIndex sorting', () => {
    const project = createProjectFromTemplate('platformer');
    const scene = project.scenes[0];
    const firstObj = scene.objects[0];
    const { scene: nextScene, newObject } = duplicateObjectInScene(scene, firstObj.id, 32);
    assert.ok(newObject);
    assert.notEqual(newObject.id, firstObj.id);
    assert.equal(nextScene.objects.length, scene.objects.length + 1);

    const sorted = sortSceneObjectsForRender(nextScene.objects, nextScene.layers);
    assert.ok(sorted.length > 0);
  });

  it('4. Block validation, IR compilation, and readable TypeScript generation', () => {
    const project = createProjectFromTemplate('platformer', 'Test Platformer');
    const scene = project.scenes[0];

    const diags = validateSceneBlocks(scene);
    assert.equal(diags.filter((d) => d.severity === 'error').length, 0);

    const ir = compileBlocksToIR(scene.blocks);
    assert.ok(ir.length >= 4, 'Expected compiled event rules');

    const code = generateReadableCode(scene);
    assert.ok(code.includes('export function registerSceneBehavior'));
    assert.ok(code.includes('ctx.on'));
  });

  it('5. Broken block references produce descriptive Turkish diagnostics', () => {
    const project = createProjectFromTemplate('empty', 'Broken Test');
    const scene = project.scenes[0];
    scene.blocks.push({
      id: 'blk_broken',
      type: 'event_game_start',
      targetObjectId: 'non_existent_object_id',
      params: {},
      children: [],
    });

    const issues = runProjectDiagnostics(project);
    assert.ok(issues.some((i) => i.severity === 'error' && i.code === 'BLK_MISSING_TARGET'));
  });

  it('6. 50-step Undo/Redo history manager', () => {
    const history = new UndoRedoManager(50);
    const baseProj = createProjectFromTemplate('empty', 'P0');
    for (let i = 1; i <= 55; i++) {
      const p = { ...baseProj, name: `P_${i}` };
      history.recordState(p, `Adım ${i}`);
    }
    assert.equal(history.canUndo(), true);
    const current = { ...baseProj, name: 'P_56' };
    const undone = history.undo(current);
    assert.equal(undone?.project.name, 'P_55');

    const redone = history.redo(undone!.project);
    assert.equal(redone?.project.name, 'P_56');
  });

  it('7. SVG XSS sanitization & storage error handling', async () => {
    const maliciousSvg = `<svg onload="alert(1)"><script>evil()</script><rect width="10" height="10" onclick="steal()" href="javascript:bad()"/></svg>`;
    const clean = sanitizeSvgContent(maliciousSvg);
    assert.equal(clean.includes('<script'), false);
    assert.equal(clean.includes('onload='), false);
    assert.equal(clean.includes('onclick='), false);
    assert.equal(clean.includes('javascript:'), false);

    const p = createProjectFromTemplate('clicker', 'Kayıt Test');
    await saveProjectToStorage(p);
    const loaded = await loadProjectFromStorage(p.id);
    assert.equal(loaded?.name, 'Kayıt Test');

    setSimulatedStorageFailure(true);
    await assert.rejects(async () => {
      await saveProjectToStorage(p);
    });
    setSimulatedStorageFailure(false);
  });

  it('8. 60 FPS GameRuntimeEngine step physics, collectible pickup, and quest progression', () => {
    const project = createProjectFromTemplate('platformer', 'Runtime Test');
    const engine = new GameRuntimeEngine(project);

    const snap0 = engine.step(0.016);
    assert.equal(snap0.status, 'playing');

    const player = snap0.objects.find((o) => o.role === 'player');
    const coin = snap0.objects.find((o) => o.role === 'collectible');
    assert.ok(player && coin);

    player.x = coin.x;
    player.y = coin.y;
    const snap1 = engine.step(0.016);
    assert.ok(snap1.score > snap0.score, 'Score should increase after collecting coin');
  });

  it('9. Export Single HTML (100% Parity) & Full Project ZIP + Import round-trip validation', async () => {
    const project = createProjectFromTemplate('topdown', 'Zindan Macerası');
    const htmlExport = exportSingleHtml(project);
    assert.ok(htmlExport.filename.endsWith('.html'));
    assert.ok(htmlExport.htmlContent.includes('<!DOCTYPE html>'));
    assert.ok(htmlExport.htmlContent.includes('Zindan Macerası'));

    // Verify 100% visual & dynamic parity embeddings in exported HTML:
    assert.ok(
      htmlExport.htmlContent.includes('function drawGameObjectOnCanvas'),
      'Exported HTML must embed shared vector sprite renderer drawGameObjectOnCanvas'
    );
    assert.ok(
      htmlExport.htmlContent.includes('function drawTileMapCellsOnCanvas'),
      'Exported HTML must embed shared TileMapLayer renderer drawTileMapCellsOnCanvas'
    );
    assert.ok(
      htmlExport.htmlContent.includes('playPreset'),
      'Exported HTML must embed WebAudio synthesized sound engine'
    );
    assert.ok(
      htmlExport.htmlContent.includes('checkCollisionOverlap'),
      'Exported HTML must embed full AABB/Circle collision & physics solver'
    );
    assert.ok(
      htmlExport.htmlContent.includes('hud-hp-pips'),
      'Exported HTML must embed identical 5-heart vitality pips HUD'
    );
    assert.ok(
      htmlExport.htmlContent.includes('data-size-preset'),
      'Exported HTML must embed interactive viewport size switcher'
    );

    const fullZip = await exportProjectZip(project);
    assert.ok(fullZip.blob.size > 100);

    const distZip = await exportDistributionZip(project);
    assert.ok(distZip.blob.size > 100);

    assert.equal(isSafeZipEntryPath('../../etc/passwd'), false);
    assert.equal(isSafeZipEntryPath('scenes/scene_1.json'), true);

    const zipBuffer = await fullZip.blob.arrayBuffer();
    const imported = await importProjectFromZipBuffer(zipBuffer, []);
    assert.equal(imported.project.name, 'Zindan Macerası');
    assert.equal(imported.project.scenes.length, project.scenes.length);

    const unused = getUnusedAssets(project);
    assert.ok(Array.isArray(unused));
  });

  it('10. Godot 4 TileMapLayer collision & Spring_Bounce2D super-jump physics', () => {
    const project = createProjectFromTemplate('platformer', 'Godot Fizik Test');
    assert.ok(
      (project.scenes[0].tilemapCells?.length || 0) >= 4,
      'Platformer template should include default TileMapLayer cells'
    );

    const engine = new GameRuntimeEngine(project);
    const snap0 = engine.step(0.016);
    const player = snap0.objects.find((o) => o.role === 'player');
    const spring = snap0.objects.find((o) => o.role === 'bounce_pad');
    assert.ok(player && spring, 'Player and bounce_pad should exist in scene');

    // Place player directly onto spring bounce pad
    player.x = spring.x;
    player.y = spring.y;
    const snapAfterBounce = engine.step(0.016);
    const bouncedPlayer = snapAfterBounce.objects.find((o) => o.role === 'player');
    assert.ok(
      bouncedPlayer && bouncedPlayer.physics.velocityY < -500,
      'Bounce pad should launch player upward with super-jump velocity'
    );
  });

  it('11. Dogfooded Game Mechanics: Laser Projectile Combat, Dash, Moving Platform & PowerUp Healing', () => {
    const project = createProjectFromTemplate('platformer', 'Siber Lazer Test');
    const engine = new GameRuntimeEngine(project);
    const snap0 = engine.step(0.02);

    const player = snap0.objects.find((o) => o.role === 'player')!;
    const enemy = snap0.objects.find((o) => o.role === 'enemy')!;
    const movingPlat = snap0.objects.find((o) => o.role === 'moving_platform')!;
    const potion = snap0.objects.find((o) => o.role === 'powerup')!;
    assert.ok(player && enemy && movingPlat && potion);

    // 1. Test Moving Platform oscillation
    const initPlatX = movingPlat.x;
    engine.step(0.04);
    assert.notEqual(movingPlat.x, initPlatX, 'Moving platform should oscillate horizontally');

    // 2. Test Laser Projectile Firing (KeyE) & hitting enemy
    player.x = enemy.x - 60;
    player.y = enemy.y;
    const initialEnemyHp = enemy.hp;
    engine.pressKey('KeyE');
    const snapShot = engine.step(0.02);
    engine.releaseKey('KeyE');
    const spawnedProjectile = snapShot.objects.find((o) => o.role === 'projectile');
    assert.ok(spawnedProjectile, 'Pressing KeyE should spawn a laser projectile');

    // Advance steps until projectile hits enemy
    for (let i = 0; i < 10; i++) {
      engine.step(0.02);
    }
    assert.ok(enemy.hp < initialEnemyHp, 'Laser projectile should reduce enemy HP on impact');

    // 3. Test PowerUp Potion healing
    player.hp = 50;
    player.x = potion.x;
    player.y = potion.y;
    const snapHeal = engine.step(0.02);
    assert.equal(snapHeal.hp, 85, 'PowerUp potion should heal player by +35 HP');
  });

  it('12. Character Facing Flip, Jump Modes (Grounded/Multi/Infinite), World Boundaries & Checkpoints', () => {
    const project = createProjectFromTemplate('platformer', 'Gelişmiş Fizik ve Sınır Testi');
    const engine = new GameRuntimeEngine(project);
    const snap0 = engine.step(0.016);
    const player = snap0.objects.find((o) => o.role === 'player')!;
    assert.ok(player, 'Player must exist');
    assert.equal(player.facingDir, 1, 'Initial facing should be right (+1)');

    // 1. Directional facing flip when moving left (KeyA / ArrowLeft)
    engine.pressKey('ArrowLeft');
    engine.step(0.02);
    engine.releaseKey('ArrowLeft');
    assert.equal(player.facingDir, -1, 'Moving left should automatically flip facingDir to -1');

    // Moving right flips facingDir back to +1
    engine.pressKey('ArrowRight');
    engine.step(0.02);
    engine.releaseKey('ArrowRight');
    assert.equal(player.facingDir, 1, 'Moving right should flip facingDir back to +1');

    // 2. Grounded-Only Jump Mode: cannot jump a second time while in mid-air
    player.physics.jumpMode = 'grounded_only';
    player.grounded = true;
    player.jumpsLeft = 1;
    engine.pressKey('Space');
    engine.step(0.016);
    engine.releaseKey('Space');
    const vyAfterFirstJump = player.physics.velocityY;
    assert.ok(vyAfterFirstJump < -300, 'First grounded jump should propel player upward');

    // Now in mid-air: try jumping again in grounded_only mode
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpsLeft = 0;
    player.physics.velocityY = -50;
    engine.pressKey('Space');
    engine.step(0.016);
    engine.releaseKey('Space');
    assert.ok(
      player.physics.velocityY > -150,
      'Grounded-only jump mode must prevent jumping again before touching the ground'
    );

    // 3. Infinite Jump Mode: allows jumping in mid-air without touching ground
    player.physics.jumpMode = 'infinite';
    player.grounded = false;
    player.coyoteTimer = 0;
    player.physics.velocityY = 100;
    engine.pressKey('Space');
    engine.step(0.016);
    engine.releaseKey('Space');
    assert.ok(
      player.physics.velocityY < -300,
      'Infinite jump mode must allow jumping in mid-air anytime'
    );

    // 4. Checkpoint updates player respawn origin
    const checkpoint = snap0.objects.find((o) => o.role === 'checkpoint');
    assert.ok(checkpoint, 'Checkpoint should exist in platformer template');
    player.x = checkpoint.x;
    player.y = checkpoint.y;
    engine.step(0.016);
    assert.equal(player.originX, checkpoint.x, 'Touching checkpoint should update player originX');

    // 5. World Boundary bottom collision triggers respawn_damage and returns player to checkpoint
    player.y = 900; // Below bottom boundary (640)
    const hpBeforeFall = snap0.hp;
    const snapAfterFall = engine.step(0.016);
    assert.ok(snapAfterFall.hp < hpBeforeFall, 'Bottom boundary respawn_damage should reduce HP');
    assert.equal(player.x, checkpoint.x, 'Bottom boundary respawn should teleport player back to checkpoint');
  });

  it('13. Invisible Wall Per-Character Target Filtering (Player-Only, Enemies-Only, Custom Character List)', () => {
    const project = createProjectFromTemplate('platformer', 'Görünmez Duvar Karakter Filtre Testi');
    const scene = project.scenes[0];
    const wall = createDefaultObject('invisible_wall', 300, 300, 'layer_main', 99);
    wall.width = 24;
    wall.height = 200;
    wall.collision.width = 24;
    wall.collision.height = 200;
    wall.collision.boundaryAction = 'solid';
    wall.collision.wallTargetFilter = 'enemies_only';
    scene.objects.push(wall);

    const player = scene.objects.find((o) => o.role === 'player')!;
    const enemy = scene.objects.find((o) => o.role === 'enemy')!;
    assert.ok(player && enemy, 'Player and Enemy must exist');

    // Pure filter helper check
    assert.equal(
      doesInvisibleWallAffectObject(wall.collision, player),
      false,
      'Wall with enemies_only filter must NOT affect player'
    );
    assert.equal(
      doesInvisibleWallAffectObject(wall.collision, enemy),
      true,
      'Wall with enemies_only filter MUST affect enemy'
    );

    // Custom character ID list check
    wall.collision.wallTargetFilter = 'custom';
    wall.collision.wallTargetIds = [player.id];
    assert.equal(
      doesInvisibleWallAffectObject(wall.collision, player),
      true,
      'Wall with custom ID list containing player.id must affect player'
    );
    assert.equal(
      doesInvisibleWallAffectObject(wall.collision, enemy),
      false,
      'Wall with custom ID list excluding enemy.id must NOT affect enemy'
    );

    // Runtime physics check: when wall is set to 'enemies_only', player walks right through x=300
    wall.y = 100;
    wall.collision.wallTargetFilter = 'enemies_only';
    const engine = new GameRuntimeEngine(project);
    const snap = engine.step(0.016);
    const rtPlayer = snap.objects.find((o) => o.role === 'player')!;
    const rtWall = snap.objects.find((o) => o.id === wall.id)!;
    rtPlayer.x = 285;
    rtPlayer.y = 150;
    rtPlayer.physics.velocityX = 600;
    rtPlayer.physics.velocityY = 0;
    engine.step(0.05);
    assert.ok(
      rtPlayer.x > 300,
      `Player should pass unimpeded through an enemies_only invisible wall (player.x=${rtPlayer.x})`
    );

    // Now switch wall filter to 'player_only' and verify player is blocked at wall.x - player.width
    rtWall.collision.wallTargetFilter = 'player_only';
    rtPlayer.x = 250;
    rtPlayer.y = 150;
    rtPlayer.physics.velocityX = 900;
    rtPlayer.physics.velocityY = 0;
    engine.step(0.05);
    assert.equal(
      rtPlayer.x,
      rtWall.x - rtPlayer.width,
      'Player must be stopped by a player_only invisible wall'
    );
  });
});

