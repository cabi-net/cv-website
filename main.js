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
  violet: 'rgba(255, 109, 226, ',
  olive: 'rgba(155, 186, 111, ',
  pink: 'rgba(255, 182, 235, ',
  sage: 'rgba(180, 200, 150, '
};

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
    color: Math.random() > 0.5 ? 'violet' : 'pink',
    life: 1,
    decay: 0.008 + Math.random() * 0.005
  });
}

function globalFlowerLoop() {
  globalCtx.clearRect(0, 0, globalCanvas.width, globalCanvas.height);

  for (let i = globalFlowers.length - 1; i >= 0; i--) {
    const flower = globalFlowers[i];
    flower.life -= flower.decay;
    if (flower.life <= 0) { globalFlowers.splice(i, 1); continue; }

    globalCtx.save();
    globalCtx.translate(flower.x, flower.y);
    globalCtx.rotate(flower.rotation);
    globalCtx.globalAlpha = flower.life * 0.6;

    globalCtx.fillStyle = flowerColors[flower.color] + '0.7)';
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

    globalCtx.fillStyle = flowerColors.olive + '0.8)';
    globalCtx.beginPath();
    globalCtx.arc(0, 0, flower.size * 0.25, 0, Math.PI * 2);
    globalCtx.fill();
    globalCtx.restore();
  }
  requestAnimationFrame(globalFlowerLoop);
}

document.addEventListener('mousemove', (e) => {
  const dist = Math.hypot(e.clientX - lastGlobalMousePos.x, e.clientY - lastGlobalMousePos.y);
  if (dist > 30) {
    addGlobalFlower(e.clientX, e.clientY);
    lastGlobalMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('resize', resizeGlobalCanvas);
window.addEventListener('load', initGlobalFlowers);

// Navigation switching
const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    const targetSection = link.dataset.section;

    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    contentSections.forEach(section => {
      section.classList.toggle('active', section.dataset.section === targetSection);
    });

    // Reset everything
    document.querySelectorAll('.section-footer').forEach(f => f.classList.remove('visible'));
    document.querySelectorAll('.experience-item, .capability-item').forEach(i => i.classList.remove('expanded'));
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.detail-panel').forEach(p => {
      p.classList.add('empty');
      p.innerHTML = 'click on a tag for details';
    });
  });
});

// Accordion functionality - Experience
document.querySelectorAll('.experience-item').forEach(item => {
  item.querySelector('.exp-header').addEventListener('click', (e) => {
    if (e.target.classList.contains('tag')) return;
    const wasExpanded = item.classList.contains('expanded');

    document.querySelectorAll('.experience-item').forEach(i => i.classList.remove('expanded'));

    if (!wasExpanded) {
      item.classList.add('expanded');
      document.getElementById('experience-footer').classList.add('visible');
    } else {
      document.getElementById('experience-footer').classList.remove('visible');
    }
  });
});

// Accordion functionality - Tools
document.querySelectorAll('.capability-item').forEach(item => {
  item.querySelector('.capability-header').addEventListener('click', (e) => {
    if (e.target.classList.contains('tag')) return;
    const wasExpanded = item.classList.contains('expanded');

    document.querySelectorAll('.capability-item').forEach(i => i.classList.remove('expanded'));

    if (!wasExpanded) {
      item.classList.add('expanded');
      document.getElementById('tools-footer').classList.add('visible');
    } else {
      document.getElementById('tools-footer').classList.remove('visible');
    }
  });
});

// Tag click functionality
document.querySelectorAll('.tag').forEach(tag => {
  tag.addEventListener('click', (e) => {
    e.stopPropagation();

    const skillId = tag.dataset.skill;
    const tagType = tag.dataset.type;
    const skillData = skillDetails[skillId];
    const detailPanel = document.querySelector('.content-section.active .detail-panel');

    if (!detailPanel) return;

    document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');

    detailPanel.classList.toggle('tool-detail', tagType === 'tool');

    if (skillData) {
      detailPanel.classList.remove('empty');
      detailPanel.innerHTML = `
        <h3>${skillData.title}</h3>
        <p>${skillData.description}</p>
        <ul>${skillData.examples.map(ex => `<li>${ex}</li>`).join('')}</ul>
      `;
    } else {
      detailPanel.classList.remove('empty');
      detailPanel.innerHTML = `<h3>${tag.textContent}</h3><p>Details coming soon...</p>`;
    }
  });
});

// Garden canvas for Work section
const gardenCanvas = document.getElementById('garden-canvas');
const workContainer = document.getElementById('work-container');

if (gardenCanvas && workContainer) {
  const gardenCtx = gardenCanvas.getContext('2d');
  let cursorFlowers = [];
  let lastMousePos = { x: 0, y: 0 };

  function resizeGardenCanvas() {
    const rect = workContainer.getBoundingClientRect();
    gardenCanvas.width = rect.width;
    gardenCanvas.height = rect.height;
  }

  function gardenLoop() {
    gardenCtx.clearRect(0, 0, gardenCanvas.width, gardenCanvas.height);

    for (let i = cursorFlowers.length - 1; i >= 0; i--) {
      const flower = cursorFlowers[i];
      flower.life -= flower.decay;
      if (flower.life <= 0) { cursorFlowers.splice(i, 1); continue; }

      gardenCtx.save();
      gardenCtx.translate(flower.x, flower.y);
      gardenCtx.rotate(flower.rotation);
      gardenCtx.globalAlpha = flower.life * 0.6;

      gardenCtx.fillStyle = flowerColors[flower.color] + '0.7)';
      for (let j = 0; j < flower.petals; j++) {
        const angle = (j / flower.petals) * Math.PI * 2;
        gardenCtx.beginPath();
        gardenCtx.ellipse(
          Math.cos(angle) * flower.size * 0.5,
          Math.sin(angle) * flower.size * 0.5,
          flower.size * 0.6, flower.size * 0.3,
          angle, 0, Math.PI * 2
        );
        gardenCtx.fill();
      }

      gardenCtx.fillStyle = flowerColors.olive + '0.8)';
      gardenCtx.beginPath();
      gardenCtx.arc(0, 0, flower.size * 0.25, 0, Math.PI * 2);
      gardenCtx.fill();
      gardenCtx.restore();
    }
    requestAnimationFrame(gardenLoop);
  }

  workContainer.addEventListener('mousemove', (e) => {
    const rect = workContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (Math.hypot(x - lastMousePos.x, y - lastMousePos.y) > 30) {
      cursorFlowers.push({
        x, y,
        size: 3 + Math.random() * 5,
        petals: 4 + Math.floor(Math.random() * 3),
        rotation: Math.random() * Math.PI * 2,
        color: Math.random() > 0.5 ? 'violet' : 'pink',
        life: 1,
        decay: 0.008 + Math.random() * 0.005
      });
      lastMousePos = { x, y };
    }
  });

  resizeGardenCanvas();
  gardenLoop();
  window.addEventListener('resize', resizeGardenCanvas);
}
