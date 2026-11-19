// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample
// photo loaded; ?shot=cover shows the cover alone, full-bleed.
// Query params: photo (sample name), caption, subtitle, layout, grade,
// size (WxH — for cover shots the page's canvas is sized to it).
// window.__shotReady is set once fonts are loaded and two frames have painted.
export async function runShot(shot, query, apply) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const sizeParam = query.get('size');
  let size = null;
  if (sizeParam) {
    const [w, h] = sizeParam.split('x').map(Number);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) size = { w, h };
  }
  await apply({
    photo: query.get('photo') ?? 'pier',
    caption: query.get('caption') ?? 'Sunset Heist',
    subtitle: query.get('subtitle') ?? 'welcome to',
    layout: query.get('layout') ?? 'trio',
    grade: query.get('grade') ?? 'sunset',
    size,
  });
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.__shotReady = true;
}
