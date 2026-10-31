import { GameObject, TileBrushKind, TileMapCell } from '../types/engine';

export const TILE_BRUSH_PALETTE: {
  kind: TileBrushKind;
  label: string;
  color: string;
  topColor: string;
  isSolid: boolean;
  isHazard?: boolean;
  isBounce?: boolean;
}[] = [
  {
    kind: 'grass_ground',
    label: 'Çim Zemin (Katı)',
    color: '#334155',
    topColor: '#10B981',
    isSolid: true,
  },
  {
    kind: 'stone_wall',
    label: 'Taş Duvar (Katı)',
    color: '#475569',
    topColor: '#94A3B8',
    isSolid: true,
  },
  {
    kind: 'crystal_block',
    label: 'Kristal Blok (Katı)',
    color: '#1E1B4B',
    topColor: '#38BDF8',
    isSolid: true,
  },
  {
    kind: 'wood_bridge',
    label: 'Ahşap Köprü (Katı)',
    color: '#78350F',
    topColor: '#D97706',
    isSolid: true,
  },
  {
    kind: 'ice_floor',
    label: 'Buz Zemin (Kaygan)',
    color: '#0369A1',
    topColor: '#BAE6FD',
    isSolid: true,
  },
  {
    kind: 'bounce_tile',
    label: 'Zıplatıcı Yay (Bounce)',
    color: '#4C1D95',
    topColor: '#F472B6',
    isSolid: true,
    isBounce: true,
  },
  {
    kind: 'lava_hazard',
    label: 'Lav / Diken (Tuzak)',
    color: '#7F1D1D',
    topColor: '#EF4444',
    isSolid: false,
    isHazard: true,
  },
  {
    kind: 'gold_ore',
    label: 'Altın Cevher (Dekor)',
    color: '#422006',
    topColor: '#FACC15',
    isSolid: true,
  },
];

/**
 * Hem editör içi sahne/önizleme kanvasında hem de dışa aktarılan bağımsız HTML/ZIP oyunlarında
 * %100 birebir aynı çalışan ortak TileMap + 2D Işık + Vektör Sprite çizici.
 */
export function drawTileMapCellsOnCanvas(
  ctx: CanvasRenderingContext2D,
  cells: TileMapCell[] | undefined,
  gridSize: number
): void {
  if (!cells || cells.length === 0) return;
  const step = Math.max(16, gridSize || 32);

  for (const cell of cells) {
    const x = cell.col * step;
    const y = cell.row * step;

    switch (cell.kind) {
      case 'grass_ground':
        ctx.fillStyle = '#334155';
        ctx.fillRect(x, y, step, step);
        ctx.fillStyle = '#10B981';
        ctx.fillRect(x, y, step, 6);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeRect(x + 0.5, y + 0.5, step - 1, step - 1);
        break;
      case 'stone_wall':
        ctx.fillStyle = '#3E4C5E';
        ctx.fillRect(x, y, step, step);
        ctx.fillStyle = '#64748B';
        ctx.fillRect(x + 2, y + 2, step / 2 - 3, step / 2 - 3);
        ctx.fillRect(x + step / 2 + 1, y + step / 2 + 1, step / 2 - 3, step / 2 - 3);
        ctx.strokeStyle = '#1E293B';
        ctx.strokeRect(x + 0.5, y + 0.5, step - 1, step - 1);
        break;
      case 'crystal_block':
        ctx.fillStyle = '#1E1B4B';
        ctx.fillRect(x, y, step, step);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 2, y + 2, step - 4, step - 4);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + step - 4);
        ctx.lineTo(x + step / 2, y + 4);
        ctx.lineTo(x + step - 4, y + step - 4);
        ctx.fill();
        break;
      case 'wood_bridge':
        ctx.fillStyle = '#78350F';
        ctx.fillRect(x, y, step, Math.round(step * 0.45));
        ctx.fillStyle = '#B45309';
        ctx.fillRect(x + 2, y + 2, step - 4, 4);
        break;
      case 'ice_floor':
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(x, y, step, step);
        ctx.fillStyle = '#E0F2FE';
        ctx.fillRect(x, y, step, 5);
        break;
      case 'bounce_tile':
        ctx.fillStyle = '#3B0764';
        ctx.fillRect(x, y + 8, step, step - 8);
        ctx.fillStyle = '#F472B6';
        ctx.fillRect(x + 2, y + 2, step - 4, 6);
        break;
      case 'lava_hazard':
        ctx.fillStyle = '#7F1D1D';
        ctx.fillRect(x, y + 8, step, step - 8);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x + step * 0.25, y + 2);
        ctx.lineTo(x + step * 0.5, y + 12);
        ctx.lineTo(x + step * 0.75, y + 2);
        ctx.lineTo(x + step, y + 12);
        ctx.fill();
        break;
      case 'gold_ore':
        ctx.fillStyle = '#334155';
        ctx.fillRect(x, y, step, step);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(x + 6, y + 6, 5, 5);
        ctx.fillRect(x + step - 12, y + 10, 6, 5);
        ctx.fillRect(x + 10, y + step - 11, 5, 5);
        break;
    }
  }
}

export function drawGameObjectOnCanvas(
  ctx: CanvasRenderingContext2D,
  obj: GameObject,
  isSelected: boolean,
  showCollision: boolean,
  animOffsetY = 0
): void {
  // Invisible boundary walls are only visible in the 2D editor when collision boxes or selection are shown
  if (obj.role === 'invisible_wall' && !showCollision && !isSelected) {
    return;
  }

  // Compute active animation pose transform
  let poseOffsetY = animOffsetY;
  let poseScaleX = 1;
  let poseScaleY = 1;
  let poseRotation = 0;

  if (obj.animations && obj.animations.length > 0 && obj.activeAnimation) {
    const clip = obj.animations.find(
      (c) => c.id === obj.activeAnimation || c.name === obj.activeAnimation
    );
    if (clip && clip.frames && clip.frames.length > 0) {
      const fIdx = ((obj as any).animFrameIndex || 0) % clip.frames.length;
      const frame = clip.frames[fIdx];
      if (frame) {
        poseOffsetY += frame.poseOffsetY || 0;
        poseScaleX = frame.poseScaleX || 1;
        poseScaleY = frame.poseScaleY || 1;
        poseRotation = frame.poseRotation || 0;
      }
    }
  }

  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2 + poseOffsetY;

  // 1. PointLight2D / Dynamic Radial Glow (if enabled on object)
  if (obj.vfx?.lightEnabled || obj.role === 'light_source' || obj.shapePreset === 'torch') {
    const radius = obj.vfx?.lightRadius || 130;
    const color = obj.vfx?.lightColor || obj.secondaryColor || '#38BDF8';
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(0.5, color + '22');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const facingDir: 1 | -1 =
    (obj as any).facingDir ?? obj.physics?.initialFacing ?? 1;
  const flipMode = obj.physics?.flipMode ?? 'horizontal';
  const horizontalMirror = flipMode === 'horizontal' ? facingDir : 1;
  const dirRotation = flipMode === 'rotate' && facingDir === -1 ? 180 : 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((((obj.rotation || 0) + poseRotation + dirRotation) * Math.PI) / 180);
  ctx.scale(
    (obj.scaleX || 1) * poseScaleX * horizontalMirror,
    (obj.scaleY || 1) * poseScaleY
  );

  const w = obj.width;
  const h = obj.height;
  const x = -w / 2;
  const y = -h / 2;

  switch (obj.shapePreset) {
    case 'hero': {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, h / 2 - 2, w * 0.38, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cape / Scarf trailing behind (-X side)
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 16);
      ctx.lineTo(x - 6, y + 26);
      ctx.lineTo(x + 6, y + 30);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = obj.color || '#2563EB';
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 12, w - 8, h - 14, 8);
      ctx.fill();

      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(x + 5, y + h - 14, w - 10, 4);

      ctx.fillStyle = obj.secondaryColor || '#93C5FD';
      ctx.beginPath();
      ctx.roundRect(x + 7, y + 2, w - 14, 19, 7);
      ctx.fill();

      // Eyes looking forward (+X side)
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(x + w - 15, y + 8, 4, 5);
      ctx.fillRect(x + w - 23, y + 8, 4, 5);

      // Attack / Dash energy effect
      if (obj.activeAnimation === 'attack') {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(w / 2 + 4, 0, 14, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      }
      break;
    }
    case 'knight': {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, h / 2 - 2, w * 0.4, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Plume on helmet
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.roundRect(x + 6, y - 4, w - 16, 7, 3);
      ctx.fill();

      // Armor body
      ctx.fillStyle = obj.color || '#475569';
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 12, w - 8, h - 14, 6);
      ctx.fill();

      // Helmet
      ctx.fillStyle = obj.secondaryColor || '#CBD5E1';
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 2, w - 12, 18, 5);
      ctx.fill();

      // Visor slit facing +X
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(x + w - 22, y + 9, 14, 4);

      // Energy blade in front (+X)
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(x + w - 4, y + 8, 6, 22);
      break;
    }
    case 'mage': {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, h / 2 - 2, w * 0.38, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Robe
      ctx.fillStyle = obj.color || '#7C3AED';
      ctx.beginPath();
      ctx.moveTo(0, y + 8);
      ctx.lineTo(x + w - 3, y + h - 2);
      ctx.lineTo(x + 3, y + h - 2);
      ctx.closePath();
      ctx.fill();

      // Face
      ctx.fillStyle = obj.secondaryColor || '#DDD6FE';
      ctx.beginPath();
      ctx.arc(2, y + 14, 9, 0, Math.PI * 2);
      ctx.fill();

      // Wizard Hat
      ctx.fillStyle = '#4C1D95';
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 8);
      ctx.lineTo(0, y - 6);
      ctx.lineTo(x + w - 2, y + 8);
      ctx.closePath();
      ctx.fill();

      // Glowing Staff in front (+X)
      ctx.fillStyle = '#B45309';
      ctx.fillRect(x + w - 5, y + 8, 3, h - 10);
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(x + w - 3.5, y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ninja': {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, h / 2 - 2, w * 0.38, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Headband tails trailing behind (-X)
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 8);
      ctx.lineTo(x - 8, y + 5);
      ctx.moveTo(x + 6, y + 10);
      ctx.lineTo(x - 7, y + 13);
      ctx.stroke();

      // Ninja Suit
      ctx.fillStyle = obj.color || '#1E293B';
      ctx.beginPath();
      ctx.roundRect(x + 5, y + 4, w - 10, h - 6, 8);
      ctx.fill();

      // Headband
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(x + 5, y + 6, w - 10, 4);

      // Eyes slot (+X)
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(x + w - 21, y + 11, 13, 5);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(x + w - 13, y + 12, 3, 3);
      break;
    }
    case 'robot': {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, h / 2 - 2, w * 0.4, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Antenna
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + 4);
      ctx.lineTo(0, y - 5);
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, y - 5, 3, 0, Math.PI * 2);
      ctx.fill();

      // Chassis
      ctx.fillStyle = obj.color || '#0284C7';
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, w - 8, h - 6, 6);
      ctx.fill();

      // LED Visor (+X)
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(x + w - 24, y + 9, 17, 7);
      ctx.fillStyle = obj.secondaryColor || '#34D399';
      ctx.fillRect(x + w - 22, y + 11, 13, 3);
      break;
    }
    case 'invisible_wall': {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.setLineDash([]);
      break;
    }
    case 'checkpoint': {
      // Base pedestal
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 4, y + h - 8, w - 8, 8);
      // Glowing Crystal Pillar
      const isActivated = Boolean((obj as any).checkpointActivated);
      ctx.fillStyle = isActivated ? '#10B981' : obj.color || '#0EA5E9';
      ctx.beginPath();
      ctx.moveTo(0, y + 2);
      ctx.lineTo(x + w - 6, y + h / 2);
      ctx.lineTo(0, y + h - 8);
      ctx.lineTo(x + 6, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isActivated ? '#A7F3D0' : '#BAE6FD';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'slime': {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, h / 2 - 1, w * 0.42, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = obj.color || '#DC2626';
      ctx.beginPath();
      ctx.arc(0, 4, w / 2 - 2, Math.PI, 0, false);
      ctx.lineTo(w / 2 - 2, h / 2);
      ctx.lineTo(-w / 2 + 2, h / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = obj.secondaryColor || '#FCA5A5';
      ctx.beginPath();
      ctx.ellipse(-w * 0.15, -h * 0.12, 5, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-10, -2, 6, 6);
      ctx.fillRect(4, -2, 6, 6);
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-7, 0, 3, 4);
      ctx.fillRect(7, 0, 3, 4);
      break;
    }
    case 'coin':
    case 'key': {
      const r = Math.min(w, h) / 2 - 1;
      ctx.fillStyle = obj.color || '#D97706';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = obj.secondaryColor || '#FDE68A';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = obj.secondaryColor || '#FDE68A';
      if (obj.shapePreset === 'key') {
        ctx.fillRect(-5, -2, 10, 4);
        ctx.fillRect(2, 2, 3, 4);
      } else {
        ctx.fillRect(-2, -6, 4, 12);
      }
      break;
    }
    case 'flag': {
      ctx.fillStyle = '#64748B';
      ctx.fillRect(x + 2, y + h - 6, 14, 6);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(x + 7, y + 2, 4, h - 8);

      ctx.fillStyle = obj.color || '#16A34A';
      ctx.beginPath();
      ctx.moveTo(x + 11, y + 4);
      ctx.lineTo(x + w - 2, y + 15);
      ctx.lineTo(x + 11, y + 28);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'platform': {
      ctx.fillStyle = obj.color || '#334155';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();

      ctx.fillStyle = obj.secondaryColor || '#10B981';
      ctx.beginPath();
      ctx.roundRect(x, y, w, 7, [5, 5, 0, 0]);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let px = x + 32; px < x + w; px += 32) {
        ctx.beginPath();
        ctx.moveTo(px, y + 7);
        ctx.lineTo(px, y + h);
        ctx.stroke();
      }
      break;
    }
    case 'npc': {
      ctx.fillStyle = obj.color || '#7C3AED';
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 10, w - 8, h - 10, 9);
      ctx.fill();
      ctx.fillStyle = obj.secondaryColor || '#DDD6FE';
      ctx.beginPath();
      ctx.arc(0, y + 11, w * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(w / 2 - 10, y - 10, 14, 10);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(w / 2 - 7, y - 6, 2, 2);
      ctx.fillRect(w / 2 - 3, y - 6, 2, 2);
      ctx.fillRect(w / 2 + 1, y - 6, 2, 2);
      break;
    }
    case 'crate': {
      ctx.fillStyle = obj.color || '#B45309';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();
      ctx.strokeStyle = obj.secondaryColor || '#FCD34D';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3);
      ctx.lineTo(x + w - 3, y + h - 3);
      ctx.moveTo(x + w - 3, y + 3);
      ctx.lineTo(x + 3, y + h - 3);
      ctx.stroke();
      break;
    }
    case 'spikes': {
      ctx.fillStyle = '#450A0A';
      ctx.fillRect(x, y + h - 6, w, 6);
      ctx.fillStyle = obj.color || '#EF4444';
      const spikeCount = Math.max(2, Math.floor(w / 14));
      const sw = w / spikeCount;
      for (let i = 0; i < spikeCount; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * sw, y + h - 6);
        ctx.lineTo(x + (i + 0.5) * sw, y + 2);
        ctx.lineTo(x + (i + 1) * sw, y + h - 6);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'spring': {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 4, y + h - 6, w - 8, 6);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + h - 6);
      ctx.lineTo(x + w - 8, y + h / 2);
      ctx.lineTo(x + 8, y + 8);
      ctx.stroke();
      ctx.fillStyle = obj.color || '#EC4899';
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, w - 4, 8, 3);
      ctx.fill();
      break;
    }
    case 'torch': {
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-3, 0, 6, h / 2);
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, -4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(0, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'laser_bolt': {
      ctx.fillStyle = obj.color || '#38BDF8';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();
      ctx.fillStyle = obj.secondaryColor || '#E0F2FE';
      ctx.fillRect(x + 3, y + 2, w - 6, Math.max(2, h - 4));
      break;
    }
    case 'potion': {
      ctx.fillStyle = obj.color || '#10B981';
      ctx.beginPath();
      ctx.arc(0, 4, Math.min(w, h) * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-4, -h / 2 + 4, 8, 7);
      ctx.fillStyle = '#D97706';
      ctx.fillRect(-3, -h / 2 + 1, 6, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-2, 1, 4, 8);
      ctx.fillRect(-4, 3, 8, 4);
      break;
    }
    case 'portal':
    case 'crystal': {
      ctx.fillStyle = obj.color || '#0891B2';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(0, y + h);
      ctx.lineTo(x, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = obj.secondaryColor || '#A5F3FC';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    default: {
      ctx.fillStyle = obj.color || '#1E293B';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = obj.secondaryColor || '#38BDF8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      break;
    }
  }

  ctx.restore();

  // Un-mirrored overlays (text, moving platform badge, invisible wall badge)
  ctx.save();
  ctx.translate(cx, cy);

  if (obj.role === 'moving_platform') {
    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◀ HAREKETLİ ▶', 0, 2);
  } else if (obj.role === 'invisible_wall' && (showCollision || isSelected)) {
    const wf = obj.collision?.wallTargetFilter || 'all';
    const wfLabel =
      wf === 'player_only'
        ? '[Sadece Kahraman]'
        : wf === 'enemies_only'
        ? '[Sadece Düşman]'
        : wf === 'npcs_only'
        ? '[Sadece NPC]'
        : wf === 'custom'
        ? `[Özel: ${(obj.collision?.wallTargetIds || []).length} Karakter]`
        : '[Tüm Karakterler]';
    ctx.fillStyle = '#22D3EE';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`GÖRÜNMEZ SINIR ${wfLabel}`, 0, 0);
  } else if (obj.collision?.oneWayPlatform && (showCollision || isSelected)) {
    ctx.fillStyle = '#FBBF24';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲ TEK YÖN ▲', 0, -h / 2 - 8);
  }

  if (obj.text) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obj.text, 0, 0);
  }

  ctx.restore();

  // Enemy Overhead HP Bar (shows health status during combat)
  if (obj.role === 'enemy' && (obj.maxHp || 0) > 0) {
    const barW = Math.max(36, obj.width);
    const barH = 5;
    const bx = obj.x + (obj.width - barW) / 2;
    const by = obj.y - 11;
    const ratio = Math.max(0, Math.min(1, (obj.hp ?? obj.maxHp) / obj.maxHp));
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.fillStyle = ratio > 0.45 ? '#EF4444' : '#F59E0B';
    ctx.fillRect(bx, by, barW * ratio, barH);
    ctx.restore();
  }

  if (showCollision && obj.collision && obj.collision.shape !== 'none') {
    ctx.save();
    ctx.strokeStyle = obj.collision.isTrigger ? '#22D3EE' : '#F43F5E';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    const colX = obj.x + (obj.collision.offsetX || 0);
    const colY = obj.y + (obj.collision.offsetY || 0);
    if (obj.collision.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(
        colX + obj.collision.width / 2,
        colY + obj.collision.height / 2,
        obj.collision.radius || Math.min(obj.width, obj.height) / 2,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    } else {
      ctx.strokeRect(colX, colY, obj.collision.width, obj.collision.height);
    }
    ctx.restore();
  }

  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = '#FF7043';
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x - 2, obj.y - 2, obj.width + 4, obj.height + 4);

    // Godot 2D X (Red) and Y (Green) Origin Axis Gizmo Arrows
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 28 * facingDir, cy);
    ctx.stroke();
    ctx.strokeStyle = '#22C55E';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 28);
    ctx.stroke();

    // 4 Corner resize handles
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FF7043';
    ctx.lineWidth = 1.5;
    const handles = [
      [obj.x - 5, obj.y - 5],
      [obj.x + obj.width - 2, obj.y - 5],
      [obj.x - 5, obj.y + obj.height - 2],
      [obj.x + obj.width - 3, obj.y + obj.height - 3],
    ];
    for (const [hx, hy] of handles) {
      ctx.fillRect(hx, hy, 7, 7);
      ctx.strokeRect(hx, hy, 7, 7);
    }

    const dirBadge = obj.role === 'player' || obj.role === 'enemy' ? (facingDir === -1 ? ' [◀ SOL]' : ' [SAĞ ▶]') : '';
    const labelText = `${obj.name}${dirBadge} (${Math.round(obj.x)}, ${Math.round(obj.y)}) · ${Math.round(obj.width)}×${Math.round(obj.height)}`;
    const boxW = Math.max(92, labelText.length * 6.8 + 12);
    ctx.fillStyle = 'rgba(24, 28, 36, 0.94)';
    ctx.fillRect(obj.x - 2, obj.y - 25, boxW, 20);
    ctx.strokeStyle = '#478CBF';
    ctx.lineWidth = 1;
    ctx.strokeRect(obj.x - 2, obj.y - 25, boxW, 20);
    ctx.fillStyle = '#8EEF97';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(labelText, obj.x + 4, obj.y - 11);
    ctx.restore();
  }
}

/**
 * Dışa aktarılan Tek HTML ve Web Dağıtım Paketi içine gömülmek üzere,
 * yukarıdaki TileMap ve vektör çizim motorunun birebir JavaScript kaynak kodunu döndürür.
 */
export function getEmbeddedVectorRendererScript(): string {
  return `${drawTileMapCellsOnCanvas.toString()}\n${drawGameObjectOnCanvas.toString()}`;
}
