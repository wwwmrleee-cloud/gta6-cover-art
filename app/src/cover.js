// Cover renderer for Vice Cover Studio — one draw function serves the live
// preview and the exported PNG (canvas backing store = export size).
// Drawing is fully deterministic: a seeded PRNG only, no Math.random, no Date.
import { LAYOUTS, GRADES, layoutPanels, layoutCaption } from './layouts.js';

// Seeded PRNG (mulberry32) — same seed, same grain, every run.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function ensureFonts() {
  if (typeof document === 'undefined') return;
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
      document.fonts.load('40px Pacifico'),
      document.fonts.load('bold 40px Anton'),
    ]);
    await document.fonts.ready;
  } catch {
    // Fonts are local files; if one fails to load the canvas falls back, but
    // the app still draws. The screenshot script waits on __shotReady, which
    // is only set after this resolves.
  }
}

function rectPx(rect, w, h) {
  return { x: rect.x * w, y: rect.y * h, w: rect.w * w, h: rect.h * h };
}

function drawSun(ctx, cx, cy, r, grade) {
  // Synthwave sun disc with horizontal slits, clipped to the disc.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, '#ffd319');
  g.addColorStop(0.55, '#ff7a3d');
  g.addColorStop(1, grade.id === 'neon' ? '#ff2e88' : '#ff2e63');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Slits cut through the lower half.
  ctx.fillStyle = grade.bg;
  let y = cy + r * 0.05;
  let thick = Math.max(2, r * 0.05);
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, thick);
    y += thick + Math.max(4, r * 0.16);
    thick *= 1.35;
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(2, r * 0.04);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPalm(ctx, x, y, s, color) {
  // Stylised palm silhouette: curved trunk + slim drooping fronds.
  // The drawing spans about x -45..+70 and y -100..0 in its own units, so
  // callers must keep the base far enough inside the canvas.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk, leaning slightly right.
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(4, -40, 16, -66);
  ctx.stroke();
  // Fronds from the crown at (16, -66): each is a slim filled crescent
  // that starts at the crown, arcs out, and droops back toward it.
  const fronds = [
    [-44, -18, -30, -62, -6, -72],
    [-40, 8, -36, -40, -4, -58],
    [-10, -88, 4, -70, 30, -82],
    [22, -52, 44, -70, 60, -60],
    [34, -30, 46, -48, 64, -36],
    [-26, -78, -6, -88, 12, -84],
  ];
  for (const [c1x, c1y, c2x, c2y, ex, ey] of fronds) {
    ctx.beginPath();
    ctx.moveTo(16, -66);
    ctx.quadraticCurveTo(16 + c1x, -66 + c1y, 16 + ex, -66 + ey);
    ctx.quadraticCurveTo(16 + c2x, -66 + c2y, 16, -66);
    ctx.fill();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(12, -61, 3, 0, Math.PI * 2);
  ctx.arc(21, -60, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHalftone(ctx, w, y0, y1, color, rng) {
  // Rows of dots, shrinking toward the bottom — a print-poster texture.
  const rows = 7;
  for (let r = 0; r < rows; r += 1) {
    const y = y0 + ((y1 - y0) * r) / rows;
    const radius = Math.max(0.8, (w * 0.004 * (rows - r)) / rows);
    const gap = radius * 4.2;
    ctx.globalAlpha = 0.16 + (0.22 * (rows - r)) / rows;
    ctx.fillStyle = color;
    for (let x = gap / 2; x < w; x += gap) {
      const jitter = (rng() - 0.5) * gap * 0.2;
      ctx.beginPath();
      ctx.arc(x + jitter, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawPhotoPanel(ctx, panel, photo, zoom, offset, grade, gutter) {
  const px = panel.x + gutter;
  const py = panel.y + gutter;
  const pw = Math.max(1, panel.w - gutter * 2);
  const ph = Math.max(1, panel.h - gutter * 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  if (photo) {
    const iw = photo.naturalWidth || photo.width;
    const ih = photo.naturalHeight || photo.height;
    const scale = Math.max(pw / iw, ph / ih) * (zoom || 1);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = px + (pw - dw) / 2 + (offset?.x || 0) * pw;
    const dy = py + (ph - dh) / 2 + (offset?.y || 0) * ph;
    ctx.drawImage(photo, dx, dy, dw, dh);
    // Warm grade tint over the photo, light enough to keep it readable.
    const tint = ctx.createLinearGradient(0, py, 0, py + ph);
    tint.addColorStop(0, 'rgba(255, 120, 60, 0.08)');
    tint.addColorStop(1, 'rgba(123, 47, 247, 0.14)');
    ctx.fillStyle = tint;
    ctx.fillRect(px, py, pw, ph);
  } else {
    ctx.fillStyle = grade.emptyTint;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = grade.border;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([Math.max(4, pw * 0.02), Math.max(4, pw * 0.02)]);
    ctx.lineWidth = Math.max(1.5, pw * 0.004);
    ctx.strokeRect(px + 4, py + 4, pw - 8, ph - 8);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const label = 'Add a photo';
    const size = Math.max(14, Math.min(pw * 0.09, ph * 0.22));
    ctx.font = `${size}px "Bebas Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grade.caption;
    ctx.globalAlpha = 0.85;
    ctx.fillText(label.toUpperCase(), px + pw / 2, py + ph / 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // Panel border.
  ctx.save();
  ctx.strokeStyle = grade.border;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = Math.max(1.5, gutter * 0.45);
  ctx.strokeRect(px, py, pw, ph);
  ctx.restore();
}

function wrapCaption(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [''];
  for (const word of words) {
    const trial = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || lines[lines.length - 1] === '') {
      lines[lines.length - 1] = trial;
    } else if (lines.length < 2) {
      lines.push(word);
    } else {
      // No room for a third line: squeeze the last word onto line 2 anyway;
      // the auto-fit loop below shrinks the font until it fits.
      lines[1] = `${lines[1]} ${word}`;
    }
  }
  return lines.slice(0, 2);
}

function drawCaption(ctx, band, grade, caption, subtitle) {
  const bx = band.x;
  const by = band.y;
  const bw = band.w;
  const bh = band.h;
  const cx = bx + bw / 2;
  const text = (caption || '').trim().toUpperCase();
  if (!text) return;
  const maxWidth = bw * 0.92;
  // Script accent word above the title.
  const script = (subtitle || '').trim();
  let scriptH = 0;
  if (script) {
    const sSize = Math.max(16, bh * 0.2);
    ctx.font = `${sSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = grade.accent;
    ctx.shadowColor = grade.glow;
    ctx.shadowBlur = sSize * 0.35;
    const sy = by + bh * 0.24;
    ctx.fillText(script, cx, sy);
    ctx.shadowBlur = 0;
    scriptH = bh * 0.26;
  }
  // Title: shrink until it fits, wrapping to at most two lines.
  const availH = bh - scriptH - bh * 0.08;
  let size = Math.min(availH * 0.62, bh * 0.52);
  let lines = [];
  while (size > 12) {
    ctx.font = `${size}px Anton, sans-serif`;
    lines = wrapCaption(ctx, text, maxWidth);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const fitsW = widest <= maxWidth;
    const lineH = size * 1.02;
    const fitsH = lines.length * lineH <= availH;
    if (fitsW && fitsH) break;
    size -= Math.max(2, size * 0.06);
  }
  ctx.font = `${size}px Anton, sans-serif`;
  lines = wrapCaption(ctx, text, maxWidth);
  const lineH = size * 1.02;
  const totalH = lines.length * lineH;
  let y = by + scriptH + (availH - totalH) / 2 + size * 0.78;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = grade.captionOutline;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.fillStyle = grade.caption;
  ctx.shadowColor = grade.glow;
  ctx.shadowBlur = size * 0.28;
  for (const line of lines) {
    ctx.strokeText(line, cx, y);
    ctx.fillText(line, cx, y);
    y += lineH;
  }
  ctx.shadowBlur = 0;
}

/**
 * Draws the cover onto `canvas` at its own backing size.
 * state = { photos, panelPhoto[4], panelZoom[4], panelOffset[4] ({x,y}),
 *           layoutId, gradeId, caption, subtitle }
 * photos are HTMLImageElement (or null); panelPhoto[i] is a photos index or -1.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = LAYOUTS[state.layoutId] ?? LAYOUTS.trio;
  const grade = GRADES[state.gradeId] ?? GRADES.sunset;
  const rng = mulberry32(1337);
  const gutter = Math.max(2, Math.round(w * 0.006));

  // Sky / grade background.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Halftone dots across the top sky.
  const band = rectPx(layout.caption, w, h);
  const skyBottom = layout.overlay ? h * 0.4 : band.y;
  drawHalftone(ctx, w, h * 0.02, Math.max(h * 0.06, skyBottom * 0.55), '#ffffff', rng);

  // Synthwave sun: in the caption band for trio/grid (drawn now, behind the
  // panels); for the strip layout it sits on the hero photo's sky, so it is
  // drawn after the panels below.
  if (!layout.overlay) {
    const r = Math.min(band.h * 0.42, w * 0.1);
    drawSun(ctx, w * 0.88, band.y + band.h * 0.52, r, grade);
  }

  // Palm silhouettes framing the caption band (non-overlay layouts only,
  // so they never cover a photo in the strip layout). Kept small and fully
  // inside the canvas so they read as palms, not blobs at the edge.
  if (!layout.overlay) {
    const palmColor = 'rgba(20, 6, 32, 0.85)';
    const s = Math.max(0.35, (band.h / 300) * (w / 1080));
    drawPalm(ctx, w * 0.055, band.y + band.h * 0.99, s, palmColor);
    drawPalm(ctx, w * 0.945, band.y + band.h * 0.99, s * 0.8, palmColor);
  }

  // Photo panels, inset by the gutter on the grade background.
  const panels = layoutPanels(state.layoutId);
  panels.forEach((p, i) => {
    const rect = rectPx(p, w, h);
    const photoIdx = state.panelPhoto?.[i];
    const photo = photoIdx != null && photoIdx >= 0 ? state.photos?.[photoIdx] : null;
    drawPhotoPanel(
      ctx,
      rect,
      photo,
      state.panelZoom?.[i] ?? 1,
      state.panelOffset?.[i] ?? { x: 0, y: 0 },
      grade,
      gutter,
    );
  });

  // Caption: scrim first when it overlays a photo, then the lettering.
  if (layout.overlay) {
    // Sun on the hero photo's sky (it would be hidden behind the photo if
    // drawn before the panels).
    drawSun(ctx, w * 0.87, h * 0.13, Math.min(w, h) * 0.085, grade);
    const scrim = ctx.createLinearGradient(0, band.y - band.h * 0.35, 0, band.y + band.h);
    scrim.addColorStop(0, 'rgba(10, 4, 20, 0)');
    scrim.addColorStop(1, 'rgba(10, 4, 20, 0.72)');
    ctx.fillStyle = scrim;
    ctx.fillRect(band.x, band.y - band.h * 0.35, band.w, band.h * 1.35);
  }
  drawCaption(ctx, band, grade, state.caption, state.subtitle);

  // Deterministic grain.
  const dots = Math.floor((w * h) / 900);
  for (let i = 0; i < dots; i += 1) {
    const gx = rng() * w;
    const gy = rng() * h;
    ctx.globalAlpha = 0.02 + rng() * 0.05;
    ctx.fillStyle = rng() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(gx, gy, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;

  // Vignette.
  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}
