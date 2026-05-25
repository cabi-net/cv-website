// Wordmark — dotted halftone render of the name in The Blanger
const WORDMARK_DEFAULTS = {
  fontFactor: 0.82,   // fraction of canvas height used as initial font size
  gridDivisor: 34,    // grid spacing = fontSize / gridDivisor (smaller = denser)
  dotRatio: 1.05,     // dot diameter = grid spacing * dotRatio
};

function getWordmarkSettings() {
  const saved = localStorage.getItem('wordmark-settings');
  if (saved) {
    try { return { ...WORDMARK_DEFAULTS, ...JSON.parse(saved) }; }
    catch (e) {}
  }
  return { ...WORDMARK_DEFAULTS };
}

let wordmarkDots = [];
let wordmarkDotRadius = 2;
let wordmarkColor = '#a8456f';
let wordmarkAnimationFrame = null;
let pearlSprite = null;
let pearlSpriteSize = 0;

// Easter egg state
// States: 'idle' -> 'scattered' (more later)
let eggState = 'idle';
let scatteredPearls = [];
let mousePos = { x: -9999, y: -9999 };
let overlayCanvas = null;
let overlayCtx = null;
let overlayAnimFrame = null;
let threadIconEl = null;
let wordmarkListenersAttached = false;

// Proximity-based divisor: as cursor approaches the wordmark,
// the grid gets coarser (fewer, bigger pearls).
let wordmarkProximity = 1;       // 1 = far, 0 = on top of wordmark
let currentRenderedDivisor = null;
let smoothedDivisor = null;      // lerps toward target — paces the transformation
const NEAR_DIVISOR = 7;          // grid divisor when cursor is on wordmark
const PROXIMITY_RANGE_PX = 50;   // how close before proximity starts ramping
// Step has TWO constraints:
//   1) Cap (enforces minimum total duration when cursor jumps to wordmark)
//   2) Proportional to current divisor (perceptual slowdown at the low end)
// At 60fps: cap of 0.18 → ~2.5s constant pace for the early/mid range,
// then proportional kicks in below ~D=15 and slows the final steps.
const DIVISOR_STEP_CAP = 0.18;
const DIVISOR_STEP_FACTOR = 0.012;

const PHYS = {
  friction: 0.97,    // drag — slows pearls to a stop
  bounceDamp: 0.55,  // energy retained after bouncing off viewport edges
  stopThreshold: 0.4,
};

const OVERLAY_DPR = 2;

function createOverlayCanvas() {
  if (overlayCanvas) return;
  overlayCanvas = document.createElement('canvas');
  overlayCanvas.id = 'pearl-overlay';
  overlayCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:5';
  document.body.appendChild(overlayCanvas);
  overlayCtx = overlayCanvas.getContext('2d');
  resizeOverlayCanvas();
  window.addEventListener('resize', resizeOverlayCanvas);
}

function resizeOverlayCanvas() {
  if (!overlayCanvas) return;
  overlayCanvas.width = window.innerWidth * OVERLAY_DPR;
  overlayCanvas.height = window.innerHeight * OVERLAY_DPR;
}

function createThreadLabel() {
  if (threadIconEl) return;
  threadIconEl = document.createElement('button');
  threadIconEl.id = 'thread-icon';
  threadIconEl.type = 'button';
  threadIconEl.setAttribute('aria-label', 'what\'s in a name?');
  threadIconEl.textContent = 'what\'s in a name?';
  threadIconEl.style.cssText = `
    position: fixed;
    background: none;
    border: none;
    cursor: pointer;
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.6rem;
    color: var(--color-accent);
    padding: 0.25rem 0.5rem;
    opacity: 0;
    transition: opacity 0.6s ease, transform 0.3s ease;
    z-index: 9999;
  `;
  threadIconEl.addEventListener('mouseenter', () => {
    threadIconEl.style.transform = 'translateY(-2px)';
    threadIconEl.style.textDecoration = 'underline dotted';
  });
  threadIconEl.addEventListener('mouseleave', () => {
    threadIconEl.style.transform = '';
    threadIconEl.style.textDecoration = '';
  });
  threadIconEl.addEventListener('click', () => {
    if (eggState === 'scattered') startReformation();
  });
  document.body.appendChild(threadIconEl);
}

function hideThreadLabel() {
  if (threadIconEl) threadIconEl.style.opacity = '0';
}

function startReformation() {
  const wm = document.getElementById('wordmark-canvas');
  if (!wm) return;
  const rect = wm.getBoundingClientRect();
  const cssToCanvasX = wm.width / rect.width;
  const cssToCanvasY = wm.height / rect.height;

  for (const p of scatteredPearls) {
    const cssX = rect.left + p.home.x / cssToCanvasX;
    const cssY = rect.top + p.home.y / cssToCanvasY;
    p.target = { x: cssX * OVERLAY_DPR, y: cssY * OVERLAY_DPR };
    p.returnFrom = { x: p.x, y: p.y };
    p.returnT = 0;
  }
  eggState = 'reforming';
  hideThreadLabel();
}

function finishEgg() {
  eggState = 'idle';
  scatteredPearls = [];
  const wm = document.getElementById('wordmark-canvas');
  if (wm) wm.style.opacity = '';
  if (overlayCtx) overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (overlayAnimFrame) {
    cancelAnimationFrame(overlayAnimFrame);
    overlayAnimFrame = null;
  }
  if (threadIconEl) {
    threadIconEl.remove();
    threadIconEl = null;
  }
}

function placeThreadLabel() {
  const wm = document.getElementById('wordmark-canvas');
  if (!wm || !threadIconEl) return;
  const rect = wm.getBoundingClientRect();
  threadIconEl.style.left = (rect.left + rect.width / 2) + 'px';
  threadIconEl.style.top = (rect.top + rect.height / 2) + 'px';
  threadIconEl.style.transform = 'translate(-50%, -50%)';
  threadIconEl.style.opacity = '1';
}

function triggerScatter() {
  if (eggState !== 'idle') return;
  createOverlayCanvas();

  const wm = document.getElementById('wordmark-canvas');
  const rect = wm.getBoundingClientRect();
  const cssToCanvasX = wm.width / rect.width;
  const cssToCanvasY = wm.height / rect.height;

  scatteredPearls = [];
  for (const d of wordmarkDots) {
    const cssX = rect.left + d.originalX / cssToCanvasX;
    const cssY = rect.top + d.originalY / cssToCanvasY;

    const angle = Math.random() * Math.PI * 2;
    const speed = 14 + Math.random() * 18;

    scatteredPearls.push({
      x: cssX * OVERLAY_DPR,
      y: cssY * OVERLAY_DPR,
      vx: Math.cos(angle) * speed * OVERLAY_DPR,
      vy: Math.sin(angle) * speed * OVERLAY_DPR,
      home: { x: d.originalX, y: d.originalY },
      stopped: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  wm.style.opacity = '0';
  eggState = 'scattered';
  startOverlayLoop();
}

function startOverlayLoop() {
  if (overlayAnimFrame) cancelAnimationFrame(overlayAnimFrame);

  function tick() {
    if (!overlayCtx || !pearlSprite) {
      overlayAnimFrame = requestAnimationFrame(tick);
      return;
    }
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const t = performance.now() / 1000;
    const halfSprite = pearlSprite.width / 2;
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;

    if (eggState === 'scattered') {
      let allStopped = true;
      for (const p of scatteredPearls) {
        if (!p.stopped) {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= PHYS.friction;
          p.vy *= PHYS.friction;

          // Bounce off all four viewport edges
          if (p.x < halfSprite)        { p.x = halfSprite;          p.vx = -p.vx * PHYS.bounceDamp; }
          if (p.x > w - halfSprite)    { p.x = w - halfSprite;      p.vx = -p.vx * PHYS.bounceDamp; }
          if (p.y < halfSprite)        { p.y = halfSprite;          p.vy = -p.vy * PHYS.bounceDamp; }
          if (p.y > h - halfSprite)    { p.y = h - halfSprite;      p.vy = -p.vy * PHYS.bounceDamp; }

          if (Math.abs(p.vx) < PHYS.stopThreshold && Math.abs(p.vy) < PHYS.stopThreshold) {
            p.stopped = true;
            p.vx = 0;
            p.vy = 0;
          } else {
            allStopped = false;
          }
        }
      }
      if (allStopped) {
        createThreadLabel();
        placeThreadLabel();
      }
    } else if (eggState === 'reforming') {
      let allHome = true;
      for (const p of scatteredPearls) {
        p.returnT = Math.min(1, p.returnT + 0.014);
        const e = 1 - Math.pow(1 - p.returnT, 3); // ease-out cubic
        p.x = p.returnFrom.x + (p.target.x - p.returnFrom.x) * e;
        p.y = p.returnFrom.y + (p.target.y - p.returnFrom.y) * e;
        if (p.returnT < 1) allHome = false;
      }
      if (allHome) {
        finishEgg();
        return;
      }
    }

    // Render all pearls
    for (const p of scatteredPearls) {
      const shimmer = 0.85 + 0.15 * Math.sin(t * 2 + p.pulse);
      overlayCtx.globalAlpha = shimmer;
      overlayCtx.drawImage(pearlSprite, p.x - halfSprite, p.y - halfSprite);
    }
    overlayCtx.globalAlpha = 1;

    overlayAnimFrame = requestAnimationFrame(tick);
  }
  tick();
}

function attachWordmarkListeners(canvas) {
  if (wordmarkListenersAttached) return;
  canvas.addEventListener('click', () => {
    if (eggState === 'idle' && wordmarkProximity < 0.15) {
      triggerScatter();
    }
  });
  canvas.style.cursor = 'pointer';

  document.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
  });

  wordmarkListenersAttached = true;
}

function parseAccent(color) {
  // Accept #rgb, #rrggbb, rgb(), rgba()
  color = color.trim();
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  return [168, 69, 111];
}

function buildPearlSprite(radius, accentHex) {
  const [r, g, b] = parseAccent(accentHex);
  // Lighter & darker variants
  const light = `rgb(${Math.min(255, r + 90)}, ${Math.min(255, g + 90)}, ${Math.min(255, b + 90)})`;
  const base = `rgb(${r}, ${g}, ${b})`;
  const deep = `rgb(${Math.max(0, r - 50)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 30)})`;

  const padding = 2; // room for soft edge / glow
  const size = Math.ceil(radius * 2 + padding * 2);
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const sctx = sprite.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  // Main pearl gradient — highlight at top-left, deep on bottom-right
  const grad = sctx.createRadialGradient(
    cx - radius * 0.4, cy - radius * 0.4, 0,
    cx, cy, radius
  );
  grad.addColorStop(0, light);
  grad.addColorStop(0.5, base);
  grad.addColorStop(1, deep);
  sctx.fillStyle = grad;
  sctx.beginPath();
  sctx.arc(cx, cy, radius, 0, Math.PI * 2);
  sctx.fill();

  // Specular highlight — small bright spot
  const spec = sctx.createRadialGradient(
    cx - radius * 0.35, cy - radius * 0.35, 0,
    cx - radius * 0.35, cy - radius * 0.35, radius * 0.55
  );
  spec.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  spec.addColorStop(0.4, 'rgba(255, 255, 255, 0.25)');
  spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
  sctx.fillStyle = spec;
  sctx.beginPath();
  sctx.arc(cx, cy, radius, 0, Math.PI * 2);
  sctx.fill();

  pearlSpriteSize = size;
  return sprite;
}

function renderWordmark(divisorOverride) {
  const canvas = document.getElementById('wordmark-canvas');
  if (!canvas) return;

  const text = 'Meric Sila Taskin';
  const font = 'the_blanger';
  const settings = getWordmarkSettings();
  const divisor = divisorOverride !== undefined ? divisorOverride : settings.gridDivisor;
  wordmarkColor = getComputedStyle(document.body).getPropertyValue('--color-accent').trim() || '#a8456f';

  const DPR = 2;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = cssW * DPR;
  canvas.height = cssH * DPR;

  const cw = canvas.width;
  const ch = canvas.height;

  // Offscreen text render — shrink font until BOTH width and height fit
  const off = document.createElement('canvas');
  off.width = cw;
  off.height = ch;
  const octx = off.getContext('2d');
  octx.fillStyle = '#000000';
  octx.fillRect(0, 0, cw, ch);
  octx.fillStyle = '#ffffff';

  let fszScaled = Math.floor(ch * settings.fontFactor);
  const fits = () => {
    octx.font = `${fszScaled}px "${font}"`;
    const m = octx.measureText(text);
    const widthOK = m.width <= cw * 0.94;
    const ascent = m.actualBoundingBoxAscent || fszScaled * 0.8;
    const descent = m.actualBoundingBoxDescent || fszScaled * 0.2;
    const totalH = ascent + descent;
    const heightOK = totalH <= ch * 0.92;
    return widthOK && heightOK;
  };
  while (!fits() && fszScaled > 20) fszScaled -= 4;
  octx.font = `${fszScaled}px "${font}"`;

  const gridScaled = Math.max(3, Math.floor(fszScaled / divisor));
  const dotScaled = gridScaled * settings.dotRatio;
  wordmarkDotRadius = dotScaled / 2;
  currentRenderedDivisor = divisor;

  // Build pearl sprite once per render based on current size + accent
  pearlSprite = buildPearlSprite(wordmarkDotRadius, wordmarkColor);

  // Center using actual bounding box for accurate vertical placement
  const metrics = octx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fszScaled * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fszScaled * 0.2;
  const centerY = ch / 2 + (ascent - descent) / 2;

  octx.textAlign = 'left';
  octx.textBaseline = 'alphabetic';
  const xPad = Math.max(8, fszScaled * 0.05);
  octx.fillText(text, xPad, centerY);

  const imgData = octx.getImageData(0, 0, cw, ch).data;

  // Sample grid → collect dot positions
  wordmarkDots = [];
  for (let y = 0; y < ch; y += gridScaled) {
    for (let x = 0; x < cw; x += gridScaled) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const idx = (yi * cw + xi) * 4;
      if (imgData[idx] > 128) {
        wordmarkDots.push({
          x,
          y,
          originalX: x,
          originalY: y,
          phase: Math.random() * Math.PI * 2,
          speed: 1.2 + Math.random() * 1.2,
        });
      }
    }
  }

  attachWordmarkListeners(canvas);

  if (wordmarkAnimationFrame) cancelAnimationFrame(wordmarkAnimationFrame);
  animateWordmark();
}

function updateWordmarkProximity() {
  const wm = document.getElementById('wordmark-canvas');
  if (!wm) return;
  const rect = wm.getBoundingClientRect();
  const dx = Math.max(rect.left - mousePos.x, 0, mousePos.x - rect.right);
  const dy = Math.max(rect.top - mousePos.y, 0, mousePos.y - rect.bottom);
  const distance = Math.sqrt(dx * dx + dy * dy);
  wordmarkProximity = Math.min(1, distance / PROXIMITY_RANGE_PX);
}

function maybeReRenderWordmark() {
  if (eggState !== 'idle') return;
  const baseDivisor = getWordmarkSettings().gridDivisor;
  const targetDivisor = NEAR_DIVISOR + (baseDivisor - NEAR_DIVISOR) * wordmarkProximity;

  if (smoothedDivisor === null) smoothedDivisor = baseDivisor;

  // Step = min(cap, proportional). Cap dominates at high D (steady pace),
  // proportional dominates at low D (slows final steps).
  const diff = targetDivisor - smoothedDivisor;
  if (Math.abs(diff) > 0.001) {
    const proportionalStep = smoothedDivisor * DIVISOR_STEP_FACTOR;
    const stepRate = Math.min(DIVISOR_STEP_CAP, proportionalStep);
    const step = Math.min(Math.abs(diff), stepRate);
    smoothedDivisor += Math.sign(diff) * step;
  }

  const rounded = Math.round(smoothedDivisor);
  if (currentRenderedDivisor === null || Math.abs(rounded - currentRenderedDivisor) >= 1) {
    renderWordmark(rounded);
  }
}

function animateWordmark() {
  const canvas = document.getElementById('wordmark-canvas');
  if (!canvas || !pearlSprite) {
    wordmarkAnimationFrame = requestAnimationFrame(animateWordmark);
    return;
  }

  if (eggState === 'idle') {
    updateWordmarkProximity();
    maybeReRenderWordmark();
  }

  // If scattered, overlay handles rendering; just keep ticking
  if (eggState !== 'idle') {
    wordmarkAnimationFrame = requestAnimationFrame(animateWordmark);
    return;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const t = performance.now() / 1000;
  const halfSprite = pearlSprite.width / 2;

  for (let i = 0; i < wordmarkDots.length; i++) {
    const d = wordmarkDots[i];
    const shimmer = 0.85 + 0.15 * Math.sin(t * d.speed + d.phase);
    ctx.globalAlpha = shimmer;
    ctx.drawImage(pearlSprite, d.originalX - halfSprite, d.originalY - halfSprite);
  }
  ctx.globalAlpha = 1;

  wordmarkAnimationFrame = requestAnimationFrame(animateWordmark);
}

// ============================================================
// GARLAND — meandering string of pearls flowing around the page
// ============================================================

const GARLAND_DEFAULTS = {
  pearlRadius: 2.5,
  pearlSpacing: 20,
  // Control points expressed as fractions of viewport (x, y in 0..1).
  // Catmull-Rom spline interpolates smoothly through these.
  controlPoints: [
    { x: 0.15, y: 0.23 },
    { x: 0.11, y: 0.29 },
    { x: 0.21, y: 0.47 },
    { x: 0.18, y: 0.61 },
    { x: 0.11, y: 0.57 },
    { x: 0.05, y: 0.66 },
    { x: 0.15, y: 0.91 },
    { x: 0.38, y: 0.88 },
    { x: 0.57, y: 0.87 },
    { x: 0.81, y: 0.95 },
    { x: 0.71, y: 0.59 },
    { x: 0.85, y: 0.53 },
    { x: 0.90, y: 0.22 },
    { x: 0.92, y: 0.16 },
  ],
  // Where labels sit along the path (fraction 0..1 of arc length)
  labelAnchors: { edu: 0.11, cert: 0.24, lang: 0.29, contact: 0.99 },
};

let garlandSettings = null;
let garlandPearls = [];
let garlandSamples = []; // arc-length sampling for label positioning
let garlandTotalLength = 0;
let garlandAnimFrame = null;
let garlandPearlSprite = null;

function getGarlandSettings() {
  const saved = localStorage.getItem('garland-settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        pearlRadius: parsed.pearlRadius ?? GARLAND_DEFAULTS.pearlRadius,
        pearlSpacing: parsed.pearlSpacing ?? GARLAND_DEFAULTS.pearlSpacing,
        controlPoints: parsed.controlPoints || GARLAND_DEFAULTS.controlPoints.map(p => ({ ...p })),
        labelAnchors: { ...GARLAND_DEFAULTS.labelAnchors, ...(parsed.labelAnchors || {}) },
      };
    } catch (e) {}
  }
  return {
    pearlRadius: GARLAND_DEFAULTS.pearlRadius,
    pearlSpacing: GARLAND_DEFAULTS.pearlSpacing,
    controlPoints: GARLAND_DEFAULTS.controlPoints.map(p => ({ ...p })),
    labelAnchors: { ...GARLAND_DEFAULTS.labelAnchors },
  };
}

// Catmull-Rom spline point interpolation (alpha = 0.5 centripetal)
function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

// Build arc-length-parameterized sampling of the path in CSS px (viewport space)
function buildGarlandSamples(controlPoints, vw, vh) {
  const samples = [];
  let cumulative = 0;

  // Pad endpoints by reflecting so Catmull-Rom has neighbors
  const pts = controlPoints.map(p => ({ x: p.x * vw, y: p.y * vh }));
  if (pts.length < 2) return { samples: [], total: 0 };
  const padStart = { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y };
  const padEnd = { x: 2 * pts[pts.length-1].x - pts[pts.length-2].x, y: 2 * pts[pts.length-1].y - pts[pts.length-2].y };
  const padded = [padStart, ...pts, padEnd];

  const STEPS_PER_SEGMENT = 40;
  let prev = null;
  for (let i = 0; i < padded.length - 3; i++) {
    const p0 = padded[i], p1 = padded[i+1], p2 = padded[i+2], p3 = padded[i+3];
    for (let s = 0; s <= STEPS_PER_SEGMENT; s++) {
      // Skip duplicate endpoint between segments
      if (i > 0 && s === 0) continue;
      const t = s / STEPS_PER_SEGMENT;
      const pt = catmullRomPoint(p0, p1, p2, p3, t);
      if (prev) {
        cumulative += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      }
      samples.push({ x: pt.x, y: pt.y, len: cumulative });
      prev = pt;
    }
  }
  return { samples, total: cumulative };
}

function pointAtArcLength(samples, total, targetLen) {
  if (samples.length === 0) return { x: 0, y: 0 };
  if (targetLen <= 0) return { x: samples[0].x, y: samples[0].y };
  if (targetLen >= total) {
    const last = samples[samples.length - 1];
    return { x: last.x, y: last.y };
  }
  // Binary search for the sample bracketing targetLen
  let lo = 0, hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].len < targetLen) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const segLen = b.len - a.len;
  const t = segLen > 0 ? (targetLen - a.len) / segLen : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function renderGarland() {
  const canvas = document.getElementById('garland-canvas');
  if (!canvas) return;
  garlandSettings = getGarlandSettings();

  const accent = getComputedStyle(document.body).getPropertyValue('--color-accent').trim() || '#a8456f';
  const DPR = 2;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  canvas.width = vw * DPR;
  canvas.height = vh * DPR;
  canvas.style.width = vw + 'px';
  canvas.style.height = vh + 'px';

  // Build/refresh pearl sprite at garland radius
  garlandPearlSprite = buildPearlSprite(garlandSettings.pearlRadius * DPR, accent);

  // Build path samples in CSS px space
  const built = buildGarlandSamples(garlandSettings.controlPoints, vw, vh);
  garlandSamples = built.samples;
  garlandTotalLength = built.total;

  // Walk along path placing pearls every `pearlSpacing` CSS px
  garlandPearls = [];
  if (garlandTotalLength > 0) {
    for (let len = 0; len <= garlandTotalLength; len += garlandSettings.pearlSpacing) {
      const pt = pointAtArcLength(garlandSamples, garlandTotalLength, len);
      garlandPearls.push({
        x: pt.x * DPR,
        y: pt.y * DPR,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
      });
    }
  }

  if (garlandAnimFrame) cancelAnimationFrame(garlandAnimFrame);
  animateGarland();
}

function animateGarland() {
  const canvas = document.getElementById('garland-canvas');
  if (!canvas || !garlandPearlSprite || garlandPearls.length === 0) {
    garlandAnimFrame = requestAnimationFrame(animateGarland);
    return;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const t = performance.now() / 1000;
  const half = garlandPearlSprite.width / 2;
  for (let i = 0; i < garlandPearls.length; i++) {
    const p = garlandPearls[i];
    const shimmer = 0.75 + 0.25 * Math.sin(t * p.speed + p.phase);
    ctx.globalAlpha = shimmer;
    ctx.drawImage(garlandPearlSprite, p.x - half, p.y - half);
  }
  ctx.globalAlpha = 1;

  garlandAnimFrame = requestAnimationFrame(animateGarland);
}

function positionGarlandLabels() {
  if (!garlandSettings || garlandSamples.length === 0) return;
  const vw = window.innerWidth;
  // Drop label positioning on narrow viewports — CSS handles fallback layout
  if (vw <= 56 * 16) return;

  document.querySelectorAll('.garland-label').forEach(el => {
    const anchor = el.dataset.anchor;
    const fraction = garlandSettings.labelAnchors[anchor];
    if (fraction === undefined) return;
    const pt = pointAtArcLength(garlandSamples, garlandTotalLength, fraction * garlandTotalLength);

    const offsetX = 32; // CSS px gap from pearl
    const labelW = el.offsetWidth || 220;
    const labelH = el.offsetHeight || 60;

    // Side override via data-side="left|right"; otherwise infer from x position
    const sideAttr = el.dataset.side;
    let placeRight; // place label to the right of the pearl?
    if (sideAttr === 'left') placeRight = false;       // label sits LEFT of pearl
    else if (sideAttr === 'right') placeRight = true;  // label sits RIGHT of pearl
    else placeRight = pt.x < vw * 0.5;                  // default: left-half pearls → label on right

    let left = placeRight ? (pt.x + offsetX) : (pt.x - offsetX - labelW);
    let top = pt.y - labelH / 2;

    // Clamp to viewport
    left = Math.max(8, Math.min(vw - labelW - 8, left));
    top = Math.max(8, Math.min(window.innerHeight - labelH - 8, top));

    el.style.left = left + 'px';
    el.style.top = top + 'px';
  });
}

// Dev panel for tuning garland — toggle with 'g' key
function initGarlandDevPanel() {
  const panel = document.createElement('div');
  panel.id = 'garland-dev-panel';
  panel.className = 'wdp';

  const cps = garlandSettings.controlPoints;
  const cpRows = cps.map((p, i) => `
    <label>P${i} x <span data-val="cp-${i}-x"></span>
      <input type="range" data-setting="cp-${i}-x" min="0" max="1" step="0.01" value="${p.x}">
    </label>
    <label>P${i} y <span data-val="cp-${i}-y"></span>
      <input type="range" data-setting="cp-${i}-y" min="0" max="1" step="0.01" value="${p.y}">
    </label>
  `).join('');

  const anchorRows = Object.entries(garlandSettings.labelAnchors).map(([key, val]) => `
    <label>anchor: ${key} <span data-val="anchor-${key}"></span>
      <input type="range" data-setting="anchor-${key}" min="0" max="1" step="0.01" value="${val}">
    </label>
  `).join('');

  panel.innerHTML = `
    <div class="wdp-header">
      <span>Garland tuner</span>
      <button class="wdp-close" type="button">×</button>
    </div>
    <label>Pearl radius <span data-val="pearlRadius"></span>
      <input type="range" data-setting="pearlRadius" min="2" max="10" step="0.5" value="${garlandSettings.pearlRadius}">
    </label>
    <label>Pearl spacing <span data-val="pearlSpacing"></span>
      <input type="range" data-setting="pearlSpacing" min="8" max="40" step="1" value="${garlandSettings.pearlSpacing}">
    </label>
    <details><summary>Control points</summary>${cpRows}</details>
    <details><summary>Label anchors</summary>${anchorRows}</details>
    <div class="wdp-actions">
      <button class="wdp-reset" type="button">Reset</button>
      <button class="wdp-log" type="button">Log values</button>
    </div>
  `;
  document.body.appendChild(panel);

  // Initialize displayed values
  panel.querySelectorAll('input[data-setting]').forEach(input => {
    const valEl = panel.querySelector(`[data-val="${input.dataset.setting}"]`);
    if (valEl) valEl.textContent = input.value;
  });

  const saveAndRender = () => {
    localStorage.setItem('garland-settings', JSON.stringify(garlandSettings));
    renderGarland();
    positionGarlandLabels();
  };

  panel.querySelectorAll('input[data-setting]').forEach(input => {
    const setting = input.dataset.setting;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      const valEl = panel.querySelector(`[data-val="${setting}"]`);
      if (valEl) valEl.textContent = input.value;
      if (setting === 'pearlRadius') garlandSettings.pearlRadius = v;
      else if (setting === 'pearlSpacing') garlandSettings.pearlSpacing = v;
      else if (setting.startsWith('cp-')) {
        const [, idx, axis] = setting.split('-');
        garlandSettings.controlPoints[parseInt(idx)][axis] = v;
      } else if (setting.startsWith('anchor-')) {
        const key = setting.replace('anchor-', '');
        garlandSettings.labelAnchors[key] = v;
      }
      saveAndRender();
    });
  });

  panel.querySelector('.wdp-reset').addEventListener('click', () => {
    localStorage.removeItem('garland-settings');
    garlandSettings = getGarlandSettings();
    renderGarland();
    positionGarlandLabels();
    panel.remove();
    initGarlandDevPanel();
    const fresh = document.getElementById('garland-dev-panel');
    if (fresh) fresh.classList.add('open');
  });

  panel.querySelector('.wdp-log').addEventListener('click', () => {
    console.log('Current garland settings:', JSON.stringify(garlandSettings, null, 2));
  });

  panel.querySelector('.wdp-close').addEventListener('click', () => {
    panel.classList.remove('open');
  });

  // Make panel draggable by its header
  makeDraggable(panel, panel.querySelector('.wdp-header'));

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.matches('input, textarea')) {
      panel.classList.toggle('open');
    }
  });
}

function makeDraggable(panel, handle) {
  if (!handle) return;
  handle.style.cursor = 'grab';
  let dragging = false;
  let startX, startY, originLeft, originTop;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return; // don't drag from buttons
    dragging = true;
    handle.style.cursor = 'grabbing';
    const rect = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    originLeft = rect.left;
    originTop = rect.top;
    // Switch to left/top positioning instead of right/bottom
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, originLeft + (e.clientX - startX)));
    const newTop = Math.max(0, Math.min(window.innerHeight - 40, originTop + (e.clientY - startY)));
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      handle.style.cursor = 'grab';
    }
  });
}

// Dev panel for fine-tuning wordmark — toggle with ` (backtick)
function initWordmarkDevPanel() {
  const panel = document.createElement('div');
  panel.id = 'wordmark-dev-panel';
  panel.innerHTML = `
    <div class="wdp-header">
      <span>Wordmark tuner</span>
      <button class="wdp-close" type="button">×</button>
    </div>
    <label>Font factor <span data-val="fontFactor"></span>
      <input type="range" data-setting="fontFactor" min="0.4" max="1.2" step="0.02">
    </label>
    <label>Grid divisor <span data-val="gridDivisor"></span>
      <input type="range" data-setting="gridDivisor" min="8" max="60" step="1">
    </label>
    <label>Dot ratio <span data-val="dotRatio"></span>
      <input type="range" data-setting="dotRatio" min="0.2" max="1.4" step="0.05">
    </label>
    <div class="wdp-actions">
      <button class="wdp-reset" type="button">Reset</button>
      <button class="wdp-log" type="button">Log values</button>
    </div>
  `;
  document.body.appendChild(panel);

  const settings = getWordmarkSettings();
  panel.querySelectorAll('input[data-setting]').forEach(input => {
    const key = input.dataset.setting;
    input.value = settings[key];
    panel.querySelector(`[data-val="${key}"]`).textContent = settings[key];
    input.addEventListener('input', () => {
      const current = getWordmarkSettings();
      current[key] = parseFloat(input.value);
      localStorage.setItem('wordmark-settings', JSON.stringify(current));
      panel.querySelector(`[data-val="${key}"]`).textContent = input.value;
      renderWordmark();
    });
  });

  panel.querySelector('.wdp-reset').addEventListener('click', () => {
    localStorage.removeItem('wordmark-settings');
    panel.querySelectorAll('input[data-setting]').forEach(input => {
      const key = input.dataset.setting;
      input.value = WORDMARK_DEFAULTS[key];
      panel.querySelector(`[data-val="${key}"]`).textContent = WORDMARK_DEFAULTS[key];
    });
    renderWordmark();
  });

  panel.querySelector('.wdp-log').addEventListener('click', () => {
    console.log('Current wordmark settings:', getWordmarkSettings());
  });

  panel.querySelector('.wdp-close').addEventListener('click', () => {
    panel.classList.remove('open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '`' && !e.target.matches('input, textarea')) {
      panel.classList.toggle('open');
    }
  });

  makeDraggable(panel, panel.querySelector('.wdp-header'));
}

function initAll() {
  renderWordmark();
  renderGarland();
  positionGarlandLabels();
  initWordmarkDevPanel();
  initGarlandDevPanel();
  revealEmailLinks();
}

// Assemble email addresses at runtime so they don't appear in raw HTML
function revealEmailLinks() {
  document.querySelectorAll('.email-link').forEach(el => {
    const user = el.dataset.user;
    const domain = el.dataset.domain;
    if (!user || !domain) return;
    const addr = user + '@' + domain;
    el.href = 'mailto:' + addr;
    el.textContent = addr;
    el.removeAttribute('aria-label');
  });
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(initAll);
} else {
  window.addEventListener('load', initAll);
}

window.addEventListener('resize', () => {
  renderWordmark();
  renderGarland();
  positionGarlandLabels();
});

// Dark mode toggle — light is default; dark requires explicit opt-in
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('cv-theme');
if (savedTheme === 'dark') {
  document.body.classList.add('dark-mode');
}
themeToggle.textContent = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  themeToggle.textContent = isDark ? 'light' : 'dark';
  localStorage.setItem('cv-theme', isDark ? 'dark' : 'light');
  renderWordmark();
  renderGarland();
});

// Load skill details from JSON file
let skillDetails = {};

fetch('./skills-data.json')
  .then(response => {
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  })
  .then(data => { skillDetails = data; })
  .catch(error => console.error('Error loading skill details:', error));

// Global flower trail effect
const globalFlowers = [];
const flowerColors = {
  light: {
    primary: 'rgba(255, 109, 226, ',
    secondary: 'rgba(155, 186, 111, ',
    petal: 'rgba(255, 182, 235, ',
  },
  dark: {
    primary: 'rgba(255, 179, 240, ',
    secondary: 'rgba(255, 60, 100, ',
    petal: 'rgba(255, 220, 245, ',
  }
};

function getColors() {
  return document.body.classList.contains('dark-mode') ? flowerColors.dark : flowerColors.light;
}

let globalCanvas, globalCtx;
let lastGlobalMousePos = { x: 0, y: 0 };

function initGlobalFlowers() {
  globalCanvas = document.createElement('canvas');
  globalCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(globalCanvas);
  globalCtx = globalCanvas.getContext('2d');
  resizeGlobalCanvas();
  globalFlowerLoop();
}

function resizeGlobalCanvas() {
  globalCanvas.width = window.innerWidth;
  globalCanvas.height = window.innerHeight;
}

function addGlobalFlower(x, y) {
  globalFlowers.push({
    x, y,
    size: 3 + Math.random() * 5,
    petals: 4 + Math.floor(Math.random() * 3),
    rotation: Math.random() * Math.PI * 2,
    usePrimary: Math.random() > 0.5,
    life: 1,
    decay: 0.008 + Math.random() * 0.005
  });
}

function globalFlowerLoop() {
  globalCtx.clearRect(0, 0, globalCanvas.width, globalCanvas.height);
  const colors = getColors();

  for (let i = globalFlowers.length - 1; i >= 0; i--) {
    const flower = globalFlowers[i];
    flower.life -= flower.decay;
    if (flower.life <= 0) { globalFlowers.splice(i, 1); continue; }

    globalCtx.save();
    globalCtx.translate(flower.x, flower.y);
    globalCtx.rotate(flower.rotation);
    const isDark = document.body.classList.contains('dark-mode');
    globalCtx.globalAlpha = flower.life * (isDark ? 0.9 : 0.6);

    globalCtx.fillStyle = (flower.usePrimary ? colors.primary : colors.petal) + (isDark ? '1)' : '0.7)');
    for (let j = 0; j < flower.petals; j++) {
      const angle = (j / flower.petals) * Math.PI * 2;
      globalCtx.beginPath();
      globalCtx.ellipse(
        Math.cos(angle) * flower.size * 0.5,
        Math.sin(angle) * flower.size * 0.5,
        flower.size * 0.6, flower.size * 0.3,
        angle, 0, Math.PI * 2
      );
      globalCtx.fill();
    }

    globalCtx.fillStyle = colors.secondary + (isDark ? '1)' : '0.8)');
    globalCtx.beginPath();
    globalCtx.arc(0, 0, flower.size * 0.25, 0, Math.PI * 2);
    globalCtx.fill();
    globalCtx.restore();
  }
  requestAnimationFrame(globalFlowerLoop);
}

document.addEventListener('mousemove', (e) => {
  if (document.body.classList.contains('dark-mode')) return;
  const dist = Math.hypot(e.clientX - lastGlobalMousePos.x, e.clientY - lastGlobalMousePos.y);
  if (dist > 30) {
    addGlobalFlower(e.clientX, e.clientY);
    lastGlobalMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('resize', resizeGlobalCanvas);
window.addEventListener('load', initGlobalFlowers);


function hideDetailPanel() {
  const panel = document.getElementById('detail-panel');
  panel.classList.remove('visible', 'tool-detail', 'empty');
  panel.innerHTML = '';
  panel.style.top = '';
  document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
  const hint = document.getElementById('detail-hint');
  if (hint) hint.classList.remove('hidden');
}

// Accordion functionality - Experience
document.querySelectorAll('.experience-item').forEach(item => {
  item.querySelector('.exp-header').addEventListener('click', (e) => {
    if (e.target.classList.contains('tag')) return;
    const wasExpanded = item.classList.contains('expanded');
    document.querySelectorAll('.experience-item').forEach(i => i.classList.remove('expanded'));
    if (!wasExpanded) item.classList.add('expanded');
    else hideDetailPanel();
  });
});


// Tag click functionality
document.querySelectorAll('.tag').forEach(tag => {
  tag.addEventListener('click', (e) => {
    e.stopPropagation();

    const skillId = tag.dataset.skill;
    const tagType = tag.dataset.type;
    const skillData = skillDetails[skillId];
    const detailPanel = document.getElementById('detail-panel');

    document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');

    detailPanel.classList.toggle('tool-detail', tagType === 'tool');
    detailPanel.classList.add('visible');
    detailPanel.classList.remove('empty');
    const hint = document.getElementById('detail-hint');
    if (hint) hint.classList.add('hidden');

    if (skillData) {
      detailPanel.innerHTML = `
        <h3>${skillData.title}</h3>
        <p>${skillData.description}</p>
        ${skillData.examples ? `<ul>${skillData.examples.map(ex => `<li>${ex}</li>`).join('')}</ul>` : ''}
      `;
    } else {
      detailPanel.innerHTML = `<h3>${tag.textContent}</h3><p>Details coming soon...</p>`;
    }

    // Anchor panel vertically to the clicked tag
    const sidebarDetail = document.querySelector('.sidebar-detail');
    const tagRect = tag.getBoundingClientRect();
    const sidebarRect = sidebarDetail.getBoundingClientRect();
    const offsetWithinSidebar = tagRect.top - sidebarRect.top;
    detailPanel.style.top = Math.max(0, offsetWithinSidebar - 8) + 'px';
  });
});

