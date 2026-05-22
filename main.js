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

function renderWordmark() {
  const canvas = document.getElementById('wordmark-canvas');
  if (!canvas) return;

  const text = 'Meric Sila Taskin';
  const font = 'the_blanger';
  const settings = getWordmarkSettings();
  const dotColor = getComputedStyle(document.body).getPropertyValue('--color-accent').trim() || '#a8456f';

  const DPR = 2;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = cssW * DPR;
  canvas.height = cssH * DPR;

  const cw = canvas.width;
  const ch = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, cw, ch);

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

  const gridScaled = Math.max(3, Math.floor(fszScaled / settings.gridDivisor));
  const dotScaled = gridScaled * settings.dotRatio;

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

  // Sample grid → draw dots
  ctx.fillStyle = dotColor;
  for (let y = 0; y < ch; y += gridScaled) {
    for (let x = 0; x < cw; x += gridScaled) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const idx = (yi * cw + xi) * 4;
      if (imgData[idx] > 128) {
        ctx.beginPath();
        ctx.arc(x, y, dotScaled / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
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
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    renderWordmark();
    initWordmarkDevPanel();
  });
} else {
  window.addEventListener('load', () => {
    renderWordmark();
    initWordmarkDevPanel();
  });
}
window.addEventListener('resize', renderWordmark);

// Dark mode toggle — dark is default; light requires explicit opt-in
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('cv-theme');
if (savedTheme === 'light') {
  document.body.classList.remove('dark-mode');
}
themeToggle.textContent = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  themeToggle.textContent = isDark ? 'light' : 'dark';
  localStorage.setItem('cv-theme', isDark ? 'dark' : 'light');
  renderWordmark();
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
  panel.style.marginTop = '';
  document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
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
    detailPanel.style.marginTop = Math.max(0, offsetWithinSidebar - 8) + 'px';
  });
});

