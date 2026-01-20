let img, maskImg, maskGraphic;
let flowers, girl;
let universFont;

// Character groups
const vowels1 = ['a','o','A','O'];
const vowels2 = ['e','i','E','I'];
const vowels3 = ['u','y','U','Y'];
const consonants1 = ['b','c','d','f','g','B','C','D','F','G'];
const consonants2 = ['h','j','k','l','m','H','J','K','L','M'];
const consonants3 = ['n','p','q','r','s','N','P','Q','R','S'];
const consonants4 = ['t','v','w','x','z','T','V','W','X','Z'];
const numbers1 = ['1','2','3','4','5'];
const numbers2 = ['6','7','8','9','0'];
const symbols1 = [':', ',' ,';'];
const symbols2 = ['.', '!' ];
const symbols3 = ["'",'"','@','(',')'];

function preload() {
  img = loadImage('gfx/015.GIF');
  maskImg = loadImage('gfx/picmix.gif');
  universFont = loadFont('assets/Univers/UniversBold.ttf');
  girl = loadImage('gfx/giribal.gif');
  flowers = loadImage('gfx/flowers02.gif');
}

function setup() {
  let canvasSize = min(windowWidth, windowHeight) * 0.85;
  createCanvas(canvasSize, canvasSize);
  clear();
  noStroke();
  textFont('Quicksand');

  let userInput = createInput('');
  userInput.attribute('placeholder', 'start typing');
  userInput.style('font-size', '20px');
  userInput.style('width', canvasSize + 'px');
  userInput.style('background-color', 'transparent');
  userInput.style('border', 'none');
  userInput.style('color', '#888');
  userInput.style('text-align', 'center');
  userInput.style('outline', 'none');
  userInput.style('margin-top', '20px');
  userInput.elt.focus();

  frameRate(3);
  img.mask(maskImg);

  maskGraphic = createGraphics(100, 40);
  maskGraphic.background(0);
  maskGraphic.fill(255);
  maskGraphic.ellipse(50, 20, 80, 30);
}

function draw() {
}

function keyTyped() {
  // Vowels1 - tall pink rectangles
  if (vowels1.includes(key)) {
    let x = 50, y = 50;
    for (let j = 0; j < 7; j++) {
      fill(random(cherryBlossomBloom));
      rect(x + 70*j, y, 20, 120);
    }
  }

  // Vowels2 - short pink rectangles at bottom
  if (vowels2.includes(key)) {
    let x = 20, y = 420;
    for (let j = 0; j < 7; j++) {
      fill(random(cherryBlossomBloom));
      rect(x + 70*j, y, 60, 30);
    }
  }

  // Vowels3 - purple grid pattern
  if (vowels3.includes(key)) {
    let x = 40, y = 130;
    for (let j = 0; j < 7; j++) {
      for (let k = 0; k < 7; k++) {
        fill(random(palette2));
        rect(x + 70*j, y + 30*k, 4, 6);
      }
    }
  }

  // Consonants1 - diagonal flower cascade
  if (consonants1.includes(key)) {
    let x = 340, y = 30;
    for (let j = 0; j < 5; j++) {
      image(flowers, x - (j*10), y*j);
    }
  }

  // Consonants2 - random girl images
  if (consonants2.includes(key)) {
    for (let j = 0; j < 5; j++) {
      image(girl, random()*600, random()*600, girl.width/2, girl.height/2);
    }
  }

  // Consonants3 - random pink circles
  if (consonants3.includes(key)) {
    for (let j = 0; j < 7; j++) {
      fill(random(cherryBlossomBloom));
      circle(random()*400, random()*400, random()*100);
    }
  }

  // Consonants4 - threshold invert effect
  if (consonants4.includes(key)) {
    let topHalf = get(0, 0, width, height/2);
    topHalf.filter(THRESHOLD);
    image(topHalf, 0, height/2);
  }

  // Numbers1 - horizontal pixel glitch
  if (numbers1.includes(key)) {
    let d = pixelDensity();
    let totalPixels = 4 * (d * width) * (d * height);
    let chunkSize = floor(random(totalPixels / 4));
    let offset = floor(random(totalPixels - chunkSize));

    loadPixels();
    for (let i = 0; i < chunkSize; i++) {
      pixels[offset + i] = pixels[i];
    }
    updatePixels();
  }

  // Numbers2 - random masked image
  if (numbers2.includes(key)) {
    image(img, random()*600, random()*500);
  }

  // Symbols1 - vertical dilate glitch
  if (symbols1.includes(key)) {
    let stripWidth = random(20, 60);
    let sourceX = random(width - stripWidth);
    let destX = random(width - stripWidth);

    let strip = get(sourceX, 0, stripWidth, height);
    strip.filter(DILATE);
    image(strip, destX, 0);
  }

  // Symbols2 - "trust me" text
  if (symbols2.includes(key)) {
    textSize(random(70, 200));
    fill(255);
    stroke(0);
    strokeWeight(4);
    text('trust me', random(600), random(600));
    noStroke();
  }

  // Symbols3 - "trust me" as points
  if (symbols3.includes(key)) {
    textSize(35);
    stroke(255);
    strokeWeight(2);

    let points = universFont.textToPoints('trust me', random(600), random(600), 35, {
      sampleFactor: 0.5
    });

    for (let p of points) {
      point(p.x, p.y);
    }
    noStroke();
  }
}

function keyPressed() {
     if (keyCode === DELETE || keyCode === BACKSPACE) {
       fill(27, 27, 27, 30); // semi-transparent dark to match background
       noStroke();
       rect(0, 0, width, height);
     }
   }

function windowResized() {
  let canvasSize = min(windowWidth, windowHeight) * 0.85;
  resizeCanvas(canvasSize, canvasSize);

  // Update input width to match new canvas size
  let inputs = selectAll('input');
  if (inputs.length > 0) {
    inputs[0].style('width', canvasSize + 'px');
  }
}
