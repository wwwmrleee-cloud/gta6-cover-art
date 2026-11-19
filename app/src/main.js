// Wires Vice Cover Studio: uploads, drag/zoom on the preview, layout/grade
// pickers, caption inputs, PNG export. A `?shot=` query sets up a fixed
// scene for a screenshot instead (./shots.js).
import { drawCover, ensureFonts } from './cover.js';
import { LAYOUTS, GRADES, layoutPanels } from './layouts.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const statusEl = document.getElementById('status');
const zoomSlider = document.getElementById('zoom');
const zoomValue = document.getElementById('zoom-value');
const panelLabel = document.getElementById('panel-label');

export const EXPORT_SIZES = [
  { w: 1080, h: 1080 },
  { w: 1080, h: 1350 },
  { w: 1920, h: 1080 },
];

const state = {
  photos: [null, null, null, null],
  photoNames: ['', '', '', ''],
  panelPhoto: [-1, -1, -1, -1],
  panelZoom: [1, 1, 1, 1],
  panelOffset: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
  layoutId: 'trio',
  gradeId: 'sunset',
  caption: 'NEON SHORE',
  subtitle: 'welcome to',
  selectedPanel: 0,
  activePhoto: 0,
  previewSize: { w: 1080, h: 1080 },
};

function setStatus(text) {
  statusEl.textContent = text;
}

function redraw() {
  const { w, h } = state.previewSize;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state);
  syncControls();
}

function panelCount() {
  return layoutPanels(state.layoutId).length;
}

function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layoutId);
    b.setAttribute('aria-pressed', String(b.dataset.layout === state.layoutId));
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.gradeId);
    b.setAttribute('aria-pressed', String(b.dataset.grade === state.gradeId));
  });
  document.querySelectorAll('[data-size]').forEach((b) => {
    const [w, h] = b.dataset.size.split('x').map(Number);
    const on = w === state.previewSize.w && h === state.previewSize.h;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const names = ['Hero', 'Panel 2', 'Panel 3', 'Panel 4'];
  const i = Math.min(state.selectedPanel, panelCount() - 1);
  panelLabel.textContent = `Selected: ${names[i]} (panel ${i + 1} of ${panelCount()})`;
  zoomSlider.value = String(state.panelZoom[i]);
  zoomValue.textContent = `${Number(state.panelZoom[i]).toFixed(1)}×`;
  document.querySelectorAll('.photo-slot').forEach((slot, idx) => {
    slot.classList.toggle('active', idx === state.activePhoto);
    const thumb = slot.querySelector('.thumb');
    const name = slot.querySelector('.slot-name');
    if (state.photos[idx]) {
      thumb.textContent = '✓';
      name.textContent = state.photoNames[idx] || `Photo ${idx + 1}`;
    } else {
      thumb.textContent = '+';
      name.textContent = `Photo ${idx + 1} — empty`;
    }
  });
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadFileIntoSlot(file, slot) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('That file is not an image — pick a JPG, PNG or WebP photo.');
    return;
  }
  try {
    const img = await loadImage(URL.createObjectURL(file));
    state.photos[slot] = img;
    state.photoNames[slot] = file.name;
    state.activePhoto = slot;
    if (state.panelPhoto.every((p) => p === -1)) {
      state.panelPhoto[state.selectedPanel] = slot;
    }
    setStatus(`Loaded ${file.name} into photo slot ${slot + 1}.`);
    redraw();
  } catch {
    setStatus(`Could not read ${file.name}. Try a different image file.`);
  }
}

async function loadSample(name) {
  try {
    const img = await loadImage(`samples/${name}.jpg`);
    state.photos[0] = img;
    state.photoNames[0] = `${name}.jpg (sample)`;
    state.activePhoto = 0;
    state.panelPhoto = state.panelPhoto.map(() => 0);
    setStatus(`Sample photo “${name}” loaded into every panel.`);
    redraw();
  } catch {
    setStatus(`Sample photo “${name}” could not be loaded.`);
  }
}

// --- Photo slots -----------------------------------------------------------
document.querySelectorAll('.photo-slot input[type=file]').forEach((input) => {
  const slot = Number(input.dataset.slot);
  input.addEventListener('change', () => {
    if (input.files[0]) loadFileIntoSlot(input.files[0], slot);
    input.value = '';
  });
});
document.querySelectorAll('.photo-slot').forEach((slotEl) => {
  slotEl.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT') return;
    state.activePhoto = Number(slotEl.dataset.slot);
    syncControls();
  });
});
document.querySelectorAll('[data-sample]').forEach((b) => {
  b.addEventListener('click', () => loadSample(b.dataset.sample));
});

// --- Assign photo to panels --------------------------------------------------
document.getElementById('use-photo').addEventListener('click', () => {
  const slot = state.activePhoto;
  if (!state.photos[slot]) {
    setStatus('No photo in the selected slot yet — upload one or try a sample first.');
    return;
  }
  state.panelPhoto[state.selectedPanel] = slot;
  setStatus(`Photo ${slot + 1} is now in panel ${state.selectedPanel + 1}.`);
  redraw();
});
document.getElementById('fill-all').addEventListener('click', () => {
  const slot = state.activePhoto;
  if (!state.photos[slot]) {
    setStatus('No photo in the selected slot yet — upload one or try a sample first.');
    return;
  }
  state.panelPhoto = state.panelPhoto.map(() => slot);
  setStatus(`Photo ${slot + 1} fills every panel.`);
  redraw();
});

// --- Layout / grade / size pickers -------------------------------------------
document.querySelectorAll('[data-layout]').forEach((b) => {
  b.addEventListener('click', () => {
    state.layoutId = b.dataset.layout;
    if (state.selectedPanel >= panelCount()) state.selectedPanel = 0;
    setStatus(`Layout: ${LAYOUTS[state.layoutId].name}.`);
    redraw();
  });
});
document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => {
    state.gradeId = b.dataset.grade;
    setStatus(`Colour grade: ${GRADES[state.gradeId].name}.`);
    redraw();
  });
});
document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => {
    const [w, h] = b.dataset.size.split('x').map(Number);
    state.previewSize = { w, h };
    setStatus(`Preview size: ${w} × ${h}.`);
    redraw();
  });
});

// --- Caption / subtitle -------------------------------------------------------
captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  redraw();
});

// --- Zoom + reset position ------------------------------------------------------
zoomSlider.addEventListener('input', () => {
  state.panelZoom[state.selectedPanel] = Number(zoomSlider.value);
  redraw();
});
document.getElementById('reset-position').addEventListener('click', () => {
  state.panelZoom[state.selectedPanel] = 1;
  state.panelOffset[state.selectedPanel] = { x: 0, y: 0 };
  setStatus(`Panel ${state.selectedPanel + 1} position and zoom reset.`);
  redraw();
});

// --- Drag a photo inside its panel on the preview ------------------------------
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}
function hitPanel(x, y) {
  const panels = layoutPanels(state.layoutId);
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const p = panels[i];
    if (x >= p.x * canvas.width && x <= (p.x + p.w) * canvas.width
      && y >= p.y * canvas.height && y <= (p.y + p.h) * canvas.height) {
      return i;
    }
  }
  return -1;
}
canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  const i = hitPanel(x, y);
  if (i < 0) return;
  state.selectedPanel = i;
  syncControls();
  if (state.panelPhoto[i] < 0 || !state.photos[state.panelPhoto[i]]) {
    setStatus(`Panel ${i + 1} is empty — upload a photo or try a sample, then use “Use this photo”.`);
    return;
  }
  drag = { panel: i, lastX: x, lastY: y };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = canvasPoint(e);
  const p = layoutPanels(state.layoutId)[drag.panel];
  const pw = p.w * canvas.width;
  const ph = p.h * canvas.height;
  const off = state.panelOffset[drag.panel];
  off.x = Math.max(-0.5, Math.min(0.5, off.x + (x - drag.lastX) / pw));
  off.y = Math.max(-0.5, Math.min(0.5, off.y + (y - drag.lastY) / ph));
  drag.lastX = x;
  drag.lastY = y;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

// Drag-and-drop a photo file onto the preview.
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    loadFileIntoSlot(file, state.activePhoto).then(() => {
      state.panelPhoto[state.selectedPanel] = state.activePhoto;
      redraw();
    });
  }
});

// --- Export ---------------------------------------------------------------------
export function exportCover(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  const name = `vice-cover-${w}x${h}.png`;
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — the browser could not make the PNG. Try again.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved ${name} (${w} × ${h}).`);
  }, 'image/png');
}
document.querySelectorAll('[data-export]').forEach((b) => {
  b.addEventListener('click', () => {
    const [w, h] = b.dataset.export.split('x').map(Number);
    exportCover(w, h);
  });
});

// --- Boot -----------------------------------------------------------------------
async function boot() {
  await ensureFonts();
  redraw();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    await runShot(shot, params, async (scene) => {
      // scene: { photo, caption, subtitle, layout, grade, size }
      if (scene.size) {
        state.previewSize = { w: scene.size.w, h: scene.size.h };
        canvas.width = scene.size.w;
        canvas.height = scene.size.h;
      }
      if (scene.layout && LAYOUTS[scene.layout]) state.layoutId = scene.layout;
      if (scene.grade && GRADES[scene.grade]) state.gradeId = scene.grade;
      if (scene.caption != null) {
        state.caption = scene.caption;
        captionInput.value = scene.caption;
      }
      if (scene.subtitle != null) {
        state.subtitle = scene.subtitle;
        subtitleInput.value = scene.subtitle;
      }
      if (scene.photo) {
        const img = await loadImage(`samples/${scene.photo}.jpg`);
        state.photos[0] = img;
        state.photoNames[0] = `${scene.photo}.jpg (sample)`;
        state.activePhoto = 0;
        state.panelPhoto = state.panelPhoto.map(() => 0);
      }
      await ensureFonts();
      redraw();
    });
  }
}
boot();
