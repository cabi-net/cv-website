// Dark mode toggle
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('cv-theme');
if (savedTheme === 'dark') {
  document.body.classList.add('dark-mode');
  themeToggle.textContent = 'light';
}
themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  themeToggle.textContent = isDark ? 'light' : 'dark';
  localStorage.setItem('cv-theme', isDark ? 'dark' : 'light');
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
  });
});

