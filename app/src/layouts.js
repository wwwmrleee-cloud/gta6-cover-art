// Layouts and colour grades for Vice Cover Studio.
// All rectangles are normalized (0..1) so one definition serves every export size.

// Each layout: photo panels plus the caption band the title sits in.
// For "strip" the caption band overlaps the hero panel (title over the photo's foot).
export const LAYOUTS = {
  trio: {
    id: 'trio',
    name: 'Sunset Trio',
    panels: [
      { id: 'hero', x: 0, y: 0, w: 0.66, h: 0.72 },
      { id: 'small1', x: 0.68, y: 0, w: 0.32, h: 0.35 },
      { id: 'small2', x: 0.68, y: 0.37, w: 0.32, h: 0.35 },
    ],
    caption: { x: 0, y: 0.74, w: 1, h: 0.26 },
    overlay: false,
  },
  grid: {
    id: 'grid',
    name: 'Neon Grid',
    panels: [
      { id: 'p1', x: 0, y: 0, w: 0.49, h: 0.38 },
      { id: 'p2', x: 0.51, y: 0, w: 0.49, h: 0.38 },
      { id: 'p3', x: 0, y: 0.4, w: 0.49, h: 0.38 },
      { id: 'p4', x: 0.51, y: 0.4, w: 0.49, h: 0.38 },
    ],
    caption: { x: 0, y: 0.8, w: 1, h: 0.2 },
    overlay: false,
  },
  strip: {
    id: 'strip',
    name: 'Boulevard Strip',
    panels: [
      { id: 'hero', x: 0, y: 0, w: 1, h: 0.62 },
      { id: 's1', x: 0, y: 0.64, w: 0.32, h: 0.34 },
      { id: 's2', x: 0.34, y: 0.64, w: 0.32, h: 0.34 },
      { id: 's3', x: 0.68, y: 0.64, w: 0.32, h: 0.34 },
    ],
    caption: { x: 0, y: 0.4, w: 1, h: 0.22 },
    overlay: true,
  },
};

// Grades: sky gradient, panel tint for empty panels, caption colour + outline,
// accent colour (script word, small labels), panel border colour.
export const GRADES = {
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    sky: ['#ff9a3d', '#ff2e63', '#7b2ff7'],
    bg: '#2b103f',
    emptyTint: '#5a2350',
    caption: '#ffffff',
    captionOutline: '#c4005a',
    accent: '#ffd319',
    border: '#ffffff',
    glow: 'rgba(255, 46, 99, 0.85)',
  },
  neon: {
    id: 'neon',
    name: 'Neon Night',
    sky: ['#0d0221', '#1b0a4a', '#3d0a5e'],
    bg: '#0d0221',
    emptyTint: '#1c0a3d',
    caption: '#00e5ff',
    captionOutline: '#ff2e88',
    accent: '#ff2e88',
    border: '#00e5ff',
    glow: 'rgba(255, 46, 136, 0.9)',
  },
  gold: {
    id: 'gold',
    name: 'Gold Hour',
    sky: ['#101418', '#2a2118', '#4a3410'],
    bg: '#101418',
    emptyTint: '#241d12',
    caption: '#f5c518',
    captionOutline: '#1a1206',
    accent: '#f5c518',
    border: '#f5c518',
    glow: 'rgba(245, 197, 24, 0.7)',
  },
  palm: {
    id: 'palm',
    name: 'Palm Coast',
    sky: ['#00b4a2', '#3ec9b6', '#f2d8a7'],
    bg: '#0a3a36',
    emptyTint: '#0f4a44',
    caption: '#ffffff',
    captionOutline: '#007a6e',
    accent: '#ffd319',
    border: '#ffffff',
    glow: 'rgba(0, 180, 162, 0.8)',
  },
};

export function layoutPanels(id) {
  const layout = LAYOUTS[id] ?? LAYOUTS.trio;
  return layout.panels;
}

export function layoutCaption(id) {
  return (LAYOUTS[id] ?? LAYOUTS.trio).caption;
}
