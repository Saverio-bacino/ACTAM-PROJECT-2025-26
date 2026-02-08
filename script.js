// ---------- Helper functions ----------
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function drawVerticalLine() {
  const lineX = canvas.width / 2;
  const canvasHeight = canvas.height;
  ctx.lineCap = 'round';
  ctx.save();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(lineX, 0);
  ctx.lineTo(lineX, canvasHeight / 2);
  ctx.stroke();
  ctx.restore();
}

function randomColor() {
  const h = Math.floor(randomInRange(0, 360));
  const s = Math.floor(randomInRange(60, 100));
  const l = Math.floor(randomInRange(45, 65));
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function randomFillFromStroke(stroke) {
  return stroke.replace("hsl", "hsla").replace(")", ", 0.25)");
}

function getNextRadius() {
  if (availableRadii.length > 0) {
    return availableRadii.pop();
  }
  const r = baseRadius + nextRadiusIndex * radiusStep;
  nextRadiusIndex++;
  return r;
}

function recycleRadius(radius) {
  availableRadii.push(radius);
}

// Helper to convert Hex to HSL
function hexToHSL(H) {
  let r = 0, g = 0, b = 0;
  if (H.length == 4) {
    r = "0x" + H[1] + H[1];
    g = "0x" + H[2] + H[2];
    b = "0x" + H[3] + H[3];
  } else if (H.length == 7) {
    r = "0x" + H[1] + H[2];
    g = "0x" + H[3] + H[4];
    b = "0x" + H[5] + H[6];
  }
  r /= 255;
  g /= 255;
  b /= 255;
  let cmin = Math.min(r, g, b),
      cmax = Math.max(r, g, b),
      delta = cmax - cmin,
      h = 0,
      s = 0,
      l = 0;

  if (delta == 0) h = 0;
  else if (cmax == r) h = ((g - b) / delta) % 6;
  else if (cmax == g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;
  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return "hsl(" + h + "," + s + "%," + l + "%)";
}

function hslToHex(hsl) {
  const matches = hsl.match(/\d+(\.\d+)?/g);
  if (!matches) return "#22d3ee";
  const [h, s, l] = matches.map(Number);
  const a = s * Math.min(l / 100, 1 - l / 100) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function adjustLightness(color, amount = 20) {
  const matches = color.match(/\d+(\.\d+)?/g);
  if (!matches) return color; 
  const [h, s, l] = matches.map(Number);
  let newL = Math.min(100, Math.max(0, l + amount));
  return `hsl(${h}, ${s}%, ${newL}%)`;
}

function getCanvasMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  return { x, y };
}

function freqToNoteLabel(freq) {
  let best = null;
  let bestDiff = Infinity;
  for (const n of NOTES) {
    const diff = Math.abs(n.freq - freq);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = n;
    }
  }
  return best && bestDiff < 2 ? best.name : "?";
}

function getNoteByRadius(note, radius) {
  if (radius < 20) return note * 4;
  else if (radius < 50) return note * 2;
  else if (radius < 100) return note;
  else if (radius < 200) return note / 2;
  else if (radius < 250) return note / 4;
  else return note / 8;
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a, b) {
  return (a * b) / gcd(a, b);
}

function lcmArray(arr) {
  return arr.reduce((acc, val) => lcm(acc, val), 1);
}

function freqToMidi(f) {
  if (f === 0) return null;
  return Math.round(69 + 12 * Math.log2(f / 440));
}

// ---------- Audio Engine ----------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playClick(volume = 0.1, freq = 1000, duration = 0.05) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.value = freq;

  const now = audioCtx.currentTime;

  gain.gain.setValueAtTime(0, now);
  const attackTime = 0.01;
  gain.gain.linearRampToValueAtTime(volume, now + attackTime);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.1);
}

// ---------- Constants ----------
const intersection_tolerance = 12 * (Math.PI / 180);

const NOTES = [
  { name: "C", freq: 261.63 },
  { name: "C#", freq: 277.18 },
  { name: "D", freq: 293.66 },
  { name: "D#", freq: 311.13 },
  { name: "E", freq: 329.63 },
  { name: "F", freq: 349.23 },
  { name: "F#", freq: 369.99 },
  { name: "G", freq: 392.00 },
  { name: "G#", freq: 415.30 },
  { name: "A", freq: 440.00 },
  { name: "A#", freq: 466.16 },
  { name: "B", freq: 493.88 },
  { name: "C", freq: 523.25 },
  { name: "pause", freq: 0 }
];

const NOTES_MAP = {
  c4: 261.63,
  "c#": 277.18,
  d: 293.66,
  "d#": 311.13,
  e: 329.63,
  f: 349.23,
  "f#": 369.99,
  g: 392.00,
  "g#": 415.30,
  a: 440.00,
  "a#": 466.16,
  b: 493.88,
  c5: 523.25
};

// ---------- Polygon Class ----------
class RotatingPolygon {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.id = options.id ?? 0;
    
    this.x = options.x ?? ctx.canvas.width / 2;
    this.y = options.y ?? ctx.canvas.height / 2;
    this.measures = options.measures ?? 1;
    
    this.currentPatternChar = 'A';
    this.sequence = ['A'];         
    this.patterns = {};            

    const initialSides = options.sides ?? 6;
    const initialRadius = options.radius ?? 80;
    const initialStroke = options.strokeStyle ?? "#22d3ee";
    const initialFill = options.fillStyle ?? "rgba(34,211,238,0.25)";

    const defaultState = {
      sides: initialSides,
      radius: initialRadius,
      strokeStyle: initialStroke,
      fillStyle: initialFill,
      corners: Array.from({ length: initialSides }, (_, i) => ({
        index: i,
        note: 261.63,
        lengthFactor: 0.2
      }))
    };

    ['A', 'B', 'C', 'D'].forEach(char => {
      this.patterns[char] = JSON.parse(JSON.stringify(defaultState));
    });

    this.applyState(this.patterns['A']);

    this.lineWidth = options.lineWidth ?? 3;
    this.wasHittingLine = false;
    this.selectedCornerIndex = null;
    this.hoveredCornerIndex = null;
    this.lastCycleIndex = -1;
  }

  saveCurrentStateTo(char) {
    this.patterns[char] = {
      sides: this.sides,
      radius: this.radius,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      corners: JSON.parse(JSON.stringify(this.corners))
    };
  }

  loadStateFrom(char) {
    const data = this.patterns[char];
    if (!data) return;

    this.sides = data.sides;
    this.radius = data.radius;
    this.strokeStyle = data.strokeStyle;
    this.fillStyle = data.fillStyle;
    this.corners = JSON.parse(JSON.stringify(data.corners)); 
    this.currentPatternChar = char;
    this._clampInsideCanvas();
  }

  applyState(data) {
    this.sides = data.sides;
    this.radius = data.radius;
    this.strokeStyle = data.strokeStyle;
    this.fillStyle = data.fillStyle;
    this.corners = JSON.parse(JSON.stringify(data.corners));
  }

  updateSequence(tSeconds) {
    const duration = this.getRotationDuration();
    if (duration <= 0) return;

    const safeTime = Math.max(0, tSeconds); 
    const totalBeats = (globalBpm / 60) * safeTime;
    const rotationProgress = totalBeats / duration;
    const currentCycleIndex = Math.floor(rotationProgress);

    if (currentCycleIndex > this.lastCycleIndex) {
      this.lastCycleIndex = currentCycleIndex;
      const seqIndex = currentCycleIndex % this.sequence.length;
      const nextChar = this.sequence[seqIndex];

      this.saveCurrentStateTo(this.currentPatternChar);

      if (nextChar !== this.currentPatternChar) {
        this.loadStateFrom(nextChar);
        if (selectedPolygonId === this.id) {
          refreshPolygonUI(this);
          updatePatternButtons(this);
        }
      }
    }
  }

  getRotationDuration() { return 4 * this.measures; }

  getNoteDurationSeconds() {
    return (this.getRotationDuration() / this.sides) / globalBpm * 60;
  }

  getNoteDurationTicks() {
    const dur = this.getRotationDuration();
    return Math.round((dur / this.sides) * 480);
  }

  setSides(n) {
    this.sides = Math.max(3, Math.floor(n));
    this.corners = Array.from({ length: this.sides }, (_, i) => ({
      index: i,
      note: 261.63,
      lengthFactor: 0.2
    }));
    this.selectedCornerIndex = null;
    this.saveCurrentStateTo(this.currentPatternChar);
  }

  setRadius(r) {
    this.radius = Math.max(5, r);
    this._clampInsideCanvas();
    this.saveCurrentStateTo(this.currentPatternChar);
  }

  _clampInsideCanvas() {
    const canvas = this.ctx.canvas;
    const r = this.radius;
    this.x = Math.max(r, Math.min(canvas.width - r, this.x));
    this.y = Math.max(r, Math.min(canvas.height - r, this.y));
  }

  getAngle(tSeconds) {
    const duration = this.getRotationDuration();
    if (duration <= 0) return 0;
    const totalBeats = (globalBpm / 60) * tSeconds;
    const rotationProgress = totalBeats / duration;
    return rotationProgress * 2 * Math.PI; // Linear rotation, no offset
  }

  getCornerPosition(i, tSeconds) {
    const rotation = this.getAngle(tSeconds);
    // Base angle for Corner 0 is -PI/2 (Top)
    const theta = rotation - Math.PI / 2 + (i / this.sides) * Math.PI * 2;
    return {
      x: this.x + Math.cos(theta) * this.radius,
      y: this.y + Math.sin(theta) * this.radius,
      theta
    };
  }

  checkForIntersection(tSeconds) {
    const TWO_PI = Math.PI * 2;
    // Hit Target: -PI/2 (which is 3PI/2 in normalized 0..2PI)
    const target = 1.5 * Math.PI; 

    for (const corner of this.corners) {
      const { theta } = this.getCornerPosition(corner.index, tSeconds);
      let normTheta = theta % TWO_PI;
      if (normTheta < 0) normTheta += TWO_PI;
      
      let diff = Math.abs(normTheta - target);
      if (diff > Math.PI) diff = TWO_PI - diff; 

      if (diff < intersection_tolerance) {
        return { angle: diff, corner };
      }
    }
    return null;
  }

  updateHover(px, py, tSeconds, radiusTolerance = 6) {
    this.hoveredCornerIndex = null;
    for (const corner of this.corners) {
      const { x, y } = this.getCornerPosition(corner.index, tSeconds);
      const dx = px - x;
      const dy = py - y;
      if (Math.sqrt(dx * dx + dy * dy) <= radiusTolerance) {
        this.hoveredCornerIndex = corner.index;
        break;
      }
    }
  }

  draw(tSeconds) {
    const ctx = this.ctx;
    const rotation = this.getAngle(tSeconds);

    ctx.save();
    ctx.translate(this.x, this.y);
    // Visual adjustment: Rotate -PI/2 so Corner 0 is at Top
    ctx.rotate(rotation - Math.PI / 2);

    ctx.beginPath();
    for (let i = 0; i < this.sides; i++) {
      const theta = (i / this.sides) * Math.PI * 2;
      const px = this.radius * Math.cos(theta);
      const py = this.radius * Math.sin(theta);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = this.fillStyle;
    ctx.strokeStyle = this.strokeStyle;
    ctx.lineWidth = this.lineWidth;
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < this.sides; i++) {
      const theta = (i / this.sides) * Math.PI * 2;
      const px = this.radius * Math.cos(theta);
      const py = this.radius * Math.sin(theta);

      ctx.beginPath();
      if (i === this.hoveredCornerIndex || i === this.selectedCornerIndex) {
        const r = this.lineWidth * 1.6;
        ctx.save();
        ctx.shadowColor = adjustLightness(this.strokeStyle, 25);
        ctx.shadowBlur = 14;
        const gradient = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.2, px, py, r);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.3, adjustLightness(this.strokeStyle, 35));
        gradient.addColorStop(1, this.strokeStyle);
        ctx.fillStyle = gradient;
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = this.strokeStyle;
        ctx.arc(px, py, this.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Pattern Badge (Counter-rotate)
    ctx.rotate(-(rotation - Math.PI / 2)); 
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.currentPatternChar, 0, 0);

    ctx.restore();
  }

  hitTest(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.radius + 5;
  }

  hitTestCorner(px, py, tSeconds, radiusTolerance = 10) {
    for (const corner of this.corners) {
      const { x, y } = this.getCornerPosition(corner.index, tSeconds);
      const dx = px - x;
      const dy = py - y;
      if (Math.sqrt(dx * dx + dy * dy) <= radiusTolerance) return corner;
    }
    return null;
  }
}

// ---------- Main App State ----------
const canvas = document.getElementById("polygonCanvas");
const ctx = canvas.getContext("2d");
const addPolygonBtn = document.getElementById("addPolygonBtn");
const polygonListEl = document.getElementById("polygonList");
const globalBpmInput = document.getElementById("globalBpmInput");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadMidiBtn = document.getElementById("download-midi");
const miniKeyboardEl = document.getElementById("miniKeyboard");
miniKeyboardEl.classList.add("hidden");

let polygons = [];
let nextPolygonId = 1;
let globalBpm = 120;
let isPlaying = true;
let elapsedSeconds = -0.1; // START OFFSET to ensure first hit detection
let lastTimestamp = null;
let baseRadius = 30;
let radiusStep = 40;
let nextRadiusIndex = 0;
let availableRadii = [];
let selectedPolygonId = null;
let assignIndex = 0;

// ---------- Polygon Management ----------
function addPolygon(options = {}) {
  const x = options.x ?? canvas.width / 2;
  const y = options.y ?? canvas.height / 2;
  const sides = options.sides ?? Math.floor(randomInRange(3, 8));
  const radius = options.radius ?? getNextRadius();
  const bpm = options.bpm ?? Math.floor(randomInRange(60, 180));
  const stroke = randomColor();
  const fill = randomFillFromStroke(stroke);

  const poly = new RotatingPolygon(ctx, {
    id: nextPolygonId++,
    sides,
    radius,
    bpm,
    x,
    y,
    strokeStyle: stroke,
    fillStyle: fill,
    lineWidth: 3,
  });

  polygons.push(poly);
  createPolygonPanel(poly);
}

function removePolygon(id) {
  const poly = polygons.find(p => p.id === id);
  if (!poly) return;
  recycleRadius(poly.radius);
  polygons = polygons.filter(p => p.id !== id);
  const panel = polygonListEl.querySelector(`[data-id="${id}"]`);
  if (panel) panel.remove();
  if (selectedPolygonId === id) deselectPolygon();
}

function selectPolygon(id) {
  selectedPolygonId = id;
  const poly = polygons.find(p => p.id === id);
  if (!poly) return;

  if (poly.selectedCornerIndex === null) poly.selectedCornerIndex = 0;
  assignIndex = poly.selectedCornerIndex;

  const panels = polygonListEl.querySelectorAll(".poly-panel");
  panels.forEach(panel => {
    panel.style.display = Number(panel.dataset.id) === id ? "block" : "none";
  });

  if (miniKeyboardEl) miniKeyboardEl.classList.remove("hidden");
  renderCornerDotsSelector(poly);
  renderCornerNoteSelector(poly);
  updatePatternButtons(poly);
}

function deselectPolygon() {
  selectedPolygonId = null;
  const panels = polygonListEl.querySelectorAll(".poly-panel");
  panels.forEach(panel => panel.style.display = "none");
  if (miniKeyboardEl) miniKeyboardEl.classList.add("hidden");
  polygons.forEach(p => p.selectedCornerIndex = null);
}

// ---------- UI Panels ----------
function createPolygonPanel(polygon) {
  const panel = document.createElement("div");
  panel.className = "poly-panel";
  panel.dataset.id = polygon.id;
  panel.style.display = "none";

  const header = document.createElement("div");
  header.className = "poly-header";

  const name = document.createElement("div");
  name.className = "poly-name";
  name.textContent = `Polygon #${polygon.id}`;

  const rightHeader = document.createElement("div");
  rightHeader.style.display = "flex";
  rightHeader.style.gap = "6px";

  // -- Round Color Picker Wrapper --
  const colorWrapper = document.createElement("div");
  colorWrapper.className = "color-picker-wrapper";
  colorWrapper.style.backgroundColor = hslToHex(polygon.strokeStyle);

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = hslToHex(polygon.strokeStyle);
  
  colorInput.addEventListener("input", () => {
    const hex = colorInput.value;
    const hsl = hexToHSL(hex);
    polygon.strokeStyle = hsl;
    polygon.fillStyle = hexToRgba(hex, 0.25);
    polygon.saveCurrentStateTo(polygon.currentPatternChar);
    colorWrapper.style.backgroundColor = hex;
  });
  
  colorWrapper.appendChild(colorInput);
  rightHeader.appendChild(colorWrapper);

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "X";
  removeBtn.addEventListener("click", () => removePolygon(polygon.id));
  rightHeader.appendChild(removeBtn);

  header.appendChild(name);
  header.appendChild(rightHeader);
  panel.appendChild(header);

  // --- Pattern Controls ---
  const patternContainer = document.createElement("div");
  patternContainer.style.marginBottom = "8px";
  
  const patternRow = document.createElement("div");
  patternRow.className = "pattern-row";
  
  ['A', 'B', 'C', 'D'].forEach(char => {
    const btn = document.createElement("button");
    btn.className = `pattern-btn ${polygon.currentPatternChar === char ? 'active' : ''}`;
    btn.textContent = char;
    btn.dataset.char = char;
    btn.disabled = isPlaying;

    btn.addEventListener("click", () => {
        polygon.saveCurrentStateTo(polygon.currentPatternChar);
        polygon.loadStateFrom(char);
        patternRow.querySelectorAll('.pattern-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.char === char);
        });
        refreshPolygonUI(polygon);
    });
    patternRow.appendChild(btn);
  });
  patternContainer.appendChild(patternRow);

  const seqLabel = document.createElement("div");
  seqLabel.textContent = "Sequence (e.g. AABB)";
  seqLabel.style.fontSize = "10px"; 
  seqLabel.style.marginBottom = "2px";
  seqLabel.style.opacity = "0.7";
  patternContainer.appendChild(seqLabel);

  const seqInput = document.createElement("input");
  seqInput.className = "seq-input";
  seqInput.value = polygon.sequence.join("");
  
  seqInput.addEventListener("input", (e) => {
     const clean = e.target.value.toUpperCase().replace(/[^ABCD]/g, '');
     polygon.sequence = clean.length > 0 ? clean.split('') : ['A'];
     polygon.lastCycleIndex = -1; 
  });
  patternContainer.appendChild(seqInput);

  panel.appendChild(patternContainer);

  // --- Standard Controls ---
  const controls = document.createElement("div");
  controls.className = "poly-controls";

  const sidesControl = document.createElement("div");
  sidesControl.className = "control";
  sidesControl.innerHTML = "<label>Sides</label>";
  const sidesInput = document.createElement("input");
  sidesInput.type = "number";
  sidesInput.min = "3";
  sidesInput.max = "64";
  sidesInput.value = polygon.sides;
  sidesInput.addEventListener("input", () => {
    polygon.setSides(Number(sidesInput.value));
    refreshPolygonUI(polygon);
  });
  sidesControl.appendChild(sidesInput);
  controls.appendChild(sidesControl);

  const measuresControl = document.createElement("div");
  measuresControl.className = "control";
  measuresControl.innerHTML = "<label>Measures</label>";
  const measuresInput = document.createElement("input");
  measuresInput.type = "number";
  measuresInput.min = "1";
  measuresInput.value = polygon.measures;
  
  measuresInput.addEventListener("input", () => {
    polygon.measures = Math.max(1, Number(measuresInput.value));
    const duration = polygon.getRotationDuration();
    const totalBeats = (globalBpm / 60) * elapsedSeconds;
    polygon.lastCycleIndex = Math.floor(totalBeats / duration);
  });
  measuresControl.appendChild(measuresInput);
  controls.appendChild(measuresControl);

  const radiusControl = document.createElement("div");
  radiusControl.className = "control full-width";
  const radiusHeader = document.createElement("div");
  radiusHeader.style.display = "flex";
  radiusHeader.style.justifyContent = "space-between";
  const radiusLabel = document.createElement("label");
  radiusLabel.textContent = "Radius";
  const radiusVal = document.createElement("span");
  radiusVal.style.fontSize="11px"; 
  radiusVal.style.opacity="0.8";
  radiusVal.textContent = Math.round(polygon.radius);
  radiusHeader.appendChild(radiusLabel);
  radiusHeader.appendChild(radiusVal);
  radiusControl.appendChild(radiusHeader);

  const radiusInput = document.createElement("input");
  radiusInput.type = "range";
  radiusInput.min = "5";
  radiusInput.max = "300";
  radiusInput.step = "1";
  radiusInput.value = Math.round(polygon.radius);
  radiusInput.style.setProperty("--value", "50%");
  
  const updateRadiusColor = () => {
      radiusInput.style.background = `linear-gradient(to right, ${polygon.strokeStyle} 0%, ${polygon.strokeStyle} var(--value), #1f2937 var(--value), #1f2937 100%)`;
  };
  
  radiusInput.addEventListener("input", () => {
    const val = Number(radiusInput.value);
    polygon.setRadius(val);
    radiusVal.textContent = val;
    const min = 5, max = 300;
    const percent = ((val - min) / (max - min)) * 100;
    radiusInput.style.setProperty("--value", `${percent}%`);
    updateRadiusColor();
  });
  {
      const val = Number(radiusInput.value);
      const percent = ((val - 5) / (300 - 5)) * 100;
      radiusInput.style.setProperty("--value", `${percent}%`);
      updateRadiusColor();
  }

  radiusControl.appendChild(radiusInput);
  controls.appendChild(radiusControl);
  panel.appendChild(controls);
  
  const cornerGrid = document.createElement("div");
  cornerGrid.className = "corner-grid";
  panel.appendChild(cornerGrid);
  
  const cornerMenu = document.createElement("div");
  cornerMenu.className = "corner-menu";
  panel.appendChild(cornerMenu);

  polygonListEl.appendChild(panel);
  renderCornerDotsSelector(polygon);
}

function updatePatternButtons(polygon) {
    const panel = document.querySelector(`.poly-panel[data-id="${polygon.id}"]`);
    if(!panel) return;
    const btns = panel.querySelectorAll('.pattern-btn');
    btns.forEach(b => {
        b.classList.toggle('active', b.dataset.char === polygon.currentPatternChar);
        b.disabled = isPlaying; 
    });
}

function renderCornerNoteSelector(polygon) {
  const panel = polygonListEl.querySelector(`.poly-panel[data-id="${polygon.id}"]`);
  const menu = panel.querySelector(".corner-menu");
  menu.innerHTML = "";

  if (polygon.selectedCornerIndex === null) {
    menu.style.display = "none";
    return;
  }
  menu.style.display = "flex";
  menu.style.flexDirection = "column"; 
  menu.style.gap = "6px";

  const corner = polygon.corners[polygon.selectedCornerIndex];

  const noteWrapper = document.createElement("div");
  noteWrapper.style.display = "flex";
  noteWrapper.style.alignItems = "center";
  noteWrapper.style.gap = "6px";

  const noteLabel = document.createElement("label");
  noteLabel.textContent = `Note:`;
  noteLabel.style.minWidth = "50px";

  const noteSelect = document.createElement("select");
  noteSelect.style.flex = "1";
  NOTES.forEach(note => {
    const option = document.createElement("option");
    option.value = note.freq;
    option.textContent = note.name;
    if (note.freq === corner.note) option.selected = true;
    noteSelect.appendChild(option);
  });
  noteSelect.addEventListener("change", () => {
    corner.note = Number(noteSelect.value);
    polygon.saveCurrentStateTo(polygon.currentPatternChar);
    renderCornerDotsSelector(polygon);
  });

  noteWrapper.appendChild(noteLabel);
  noteWrapper.appendChild(noteSelect);
  menu.appendChild(noteWrapper);

  const lengthWrapper = document.createElement("div");
  lengthWrapper.style.display = "flex";
  lengthWrapper.style.alignItems = "center";
  lengthWrapper.style.gap = "6px";

  const lengthLabel = document.createElement("label");
  lengthLabel.textContent = `Len: ${corner.lengthFactor.toFixed(2)}`;
  lengthLabel.style.minWidth = "50px";

  const lengthSlider = document.createElement("input");
  lengthSlider.type = "range";
  lengthSlider.min = 0.1;
  lengthSlider.max = 1;
  lengthSlider.step = 0.01;
  lengthSlider.value = corner.lengthFactor;
  lengthSlider.style.flex = "1";
  
  function updateRangeFill(input) {
    const min = input.min || 0;
    const max = input.max || 100;
    const val = input.value;
    const percent = ((val - min) / (max - min)) * 100;
    input.style.setProperty("--value", `${percent}%`);
  }
  updateRangeFill(lengthSlider);

  lengthSlider.addEventListener("input", () => {
    corner.lengthFactor = Number(lengthSlider.value);
    polygon.saveCurrentStateTo(polygon.currentPatternChar);
    lengthLabel.textContent = `Len: ${corner.lengthFactor.toFixed(2)}`;
    updateRangeFill(lengthSlider);
  });

  lengthWrapper.appendChild(lengthLabel);
  lengthWrapper.appendChild(lengthSlider);
  menu.appendChild(lengthWrapper);
}

function renderCornerDotsSelector(polygon) {
  const panel = polygonListEl.querySelector(`.poly-panel[data-id="${polygon.id}"]`);
  if (!panel) return;
  const grid = panel.querySelector(".corner-grid");
  if (!grid) return;
  grid.innerHTML = "";

  polygon.corners.forEach((corner, i) => {
    const dot = document.createElement("div");
    dot.className = "corner-dot";
    if (polygon.selectedCornerIndex === i) dot.classList.add("active");
    dot.textContent = freqToNoteLabel(corner.note);
    const idx = document.createElement("div");
    idx.className = "idx";
    idx.textContent = i + 1;
    dot.appendChild(idx);
    dot.addEventListener("click", () => {
      polygons.forEach(p => p.selectedCornerIndex = null);
      polygon.selectedCornerIndex = i;
      assignIndex = i;
      renderCornerDotsSelector(polygon);
      renderCornerNoteSelector(polygon);
    });
    grid.appendChild(dot);
  });
}

function refreshPolygonUI(polygon) {
  const panel = polygonListEl.querySelector(`.poly-panel[data-id="${polygon.id}"]`);
  
  const sidesInput = panel.querySelector(".control input[type='number']");
  if(sidesInput) sidesInput.value = polygon.sides;
  
  const radiusInput = panel.querySelector(".control.full-width input[type='range']");
  const radiusVal = panel.querySelector(".control.full-width span");
  if (radiusInput && radiusVal) {
     const r = Math.round(polygon.radius);
     radiusInput.value = r;
     radiusVal.textContent = r;
     const min = 5, max = 300;
     const percent = ((r - min) / (max - min)) * 100;
     radiusInput.style.setProperty("--value", `${percent}%`);
     radiusInput.style.background = `linear-gradient(to right, ${polygon.strokeStyle} 0%, ${polygon.strokeStyle} var(--value), #1f2937 var(--value), #1f2937 100%)`;
  }

  // Update Color Input wrapper
  const colorWrapper = panel.querySelector(".color-picker-wrapper");
  const colorInput = panel.querySelector(".color-picker-wrapper input[type='color']");
  if(colorInput && colorWrapper) {
      const hex = hslToHex(polygon.strokeStyle);
      colorInput.value = hex;
      colorWrapper.style.backgroundColor = hex;
  }

  renderCornerDotsSelector(polygon);
  renderCornerNoteSelector(polygon);
}

function assignNextCornerNote(noteKey) {
  if (!selectedPolygonId) return;
  const poly = polygons.find(p => p.id === selectedPolygonId);
  if (!poly) return;
  const freq = NOTES_MAP[noteKey];
  if (freq == null) return;
  if (poly.selectedCornerIndex === null) poly.selectedCornerIndex = 0;
  
  const i = assignIndex % poly.corners.length;
  poly.corners[i].note = freq;
  poly.selectedCornerIndex = i;
  poly.saveCurrentStateTo(poly.currentPatternChar);
  
  renderCornerDotsSelector(poly);
  renderCornerNoteSelector(poly);
  assignIndex = (i + 1) % poly.corners.length;
}

// ---------- Animation Loop ----------
function animate(timestamp) {
  if (lastTimestamp === null) lastTimestamp = timestamp;
  const deltaMs = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (isPlaying) {
    elapsedSeconds += deltaMs / 1000;
  }
  const tSeconds = elapsedSeconds;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawVerticalLine();

  const drawOrder = [...polygons].sort((a, b) => b.radius - a.radius);
  let lineIntensity = 0;

  for (const p of drawOrder) {
    if (isPlaying) {
       p.updateSequence(tSeconds);
    }

    p.draw(tSeconds);

    const hit = p.checkForIntersection(tSeconds);
    if (hit) {
      lineIntensity = Math.max(lineIntensity, hit.angle);
      if (!p.wasHittingLine) {
        const noteDuration = Math.max(0.01, p.getNoteDurationSeconds() * hit.corner.lengthFactor);
        const freq = getNoteByRadius(hit.corner.note, p.radius);
        if (freq > 20 && freq < 10000) {
           playClick(0.2, freq, noteDuration);
        }
        p.wasHittingLine = true;
      }
    } else {
      p.wasHittingLine = false;
    }
  }

  if (lineIntensity) {
    ctx.strokeStyle = `rgba(255,255,255,${0.7 - lineIntensity / intersection_tolerance * 0.5})`;
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  }

  requestAnimationFrame(animate);
}

function exportPolygonsToMIDI(polygons) {
  if (!window.MidiWriter) {
    console.error("MidiWriterJS not loaded!");
    return;
  }
  const MidiWriter = window.MidiWriter;

  const sequenceLengths = polygons.map(p => p.sequence.length * p.measures);
  const totalMeasures = lcmArray(sequenceLengths);
  const finalMeasures = Math.min(totalMeasures, 128); 
  const totalBeats = finalMeasures * 4;

  const tracks = [];

  polygons.forEach((polygon) => {
    const track = new MidiWriter.Track();
    track.setTempo(global);

    const rotationDurationBeats = polygon.getRotationDuration();

    for (let beat = 0; beat < totalBeats; beat += rotationDurationBeats) {
      
      const cycleIndex = Math.floor(beat / rotationDurationBeats);
      const seqIndex = cycleIndex % polygon.sequence.length;
      const patternChar = polygon.sequence[seqIndex];
      const patternData = polygon.patterns[patternChar];
      
      if (!patternData) continue;

      const sides = patternData.sides;
      const radius = patternData.radius;
      const corners = patternData.corners;

      corners.forEach(corner => {
        if (corner.note === 0) return;

        const midiNote = freqToMidi(getNoteByRadius(corner.note, radius));
        const timeInRotation = (corner.index / sides) * rotationDurationBeats;
        const absoluteStartTick = Math.round((beat + timeInRotation) * 480);
        
        const baseNoteDuration = rotationDurationBeats / sides;
        const durationTicks = Math.round(baseNoteDuration * 480 * corner.lengthFactor);

        track.addEvent(
          new MidiWriter.NoteEvent({
            pitch: [midiNote],
            duration: "T" + durationTicks,
            startTick: absoluteStartTick
          })
        );
      });
    }
    tracks.push(track);
  });

  const writer = new MidiWriter.Writer(tracks);
  const midiBytes = writer.buildFile();
  midiBytes[12] = 0x01; 
  midiBytes[13] = 0xE0;

  const midiBlob = new Blob([midiBytes], { type: "audio/midi" });
  const url = URL.createObjectURL(midiBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "polygons_full_sequence.mid";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Event Listeners & Init ----------
globalBpmInput.addEventListener("input", () => {
  globalBpm = Math.max(1, Number(globalBpmInput.value));
});

addPolygonBtn.addEventListener("click", () => addPolygon());

// Helper to Disable/Enable Buttons
function togglePatternButtons(enabled) {
    const btns = document.querySelectorAll('.pattern-btn');
    btns.forEach(b => b.disabled = !enabled);
}

playBtn.addEventListener("click", () => {
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (!isPlaying) {
      isPlaying = true;
      togglePatternButtons(false); // Disable
  }
});

pauseBtn.addEventListener("click", () => {
  if (isPlaying) {
      isPlaying = false;
      togglePatternButtons(true); // Enable
  }
});

resetBtn.addEventListener("click", () => {
  elapsedSeconds = -0.1; // Rewind slightly
  
  for (const p of polygons) {
    p.wasHittingLine = false;
    p.lastCycleIndex = -1; 
    const firstChar = p.sequence[0] || 'A';
    p.loadStateFrom(firstChar);
  }
  
  if (selectedPolygonId) {
     const poly = polygons.find(p => p.id === selectedPolygonId);
     if(poly) {
        refreshPolygonUI(poly);
        updatePatternButtons(poly);
     }
  }
  togglePatternButtons(!isPlaying);
});

downloadMidiBtn.addEventListener("click", () => {
  downloadMidiBtn.disabled = true;
  downloadMidiBtn.textContent = "Generating MIDI…";
  setTimeout(() => {
    try {
      exportPolygonsToMIDI(polygons);
    } catch (err) {
      console.error(err);
      alert("Error exporting MIDI");
    } finally {
      downloadMidiBtn.disabled = false;
      downloadMidiBtn.textContent = "Download MIDI";
    }
  }, 10);
});

document.addEventListener("pointerdown", () => {
  if (audioCtx.state === "suspended") audioCtx.resume();
}, { once: true });

canvas.addEventListener("pointerdown", (e) => {
  const { x, y } = getCanvasMousePos(e);
  let clickedPoly = null;
  let clickedCorner = null;
  const hitTestOrder = [...polygons].sort((a, b) => a.radius - b.radius);

  for (const p of hitTestOrder) {
    const corner = p.hitTestCorner(x, y, elapsedSeconds);
    if (corner) {
      clickedPoly = p;
      clickedCorner = corner;
      break;
    } else if (p.hitTest(x, y)) {
      clickedPoly = p;
      break;
    }
  }

  if (clickedPoly) {
    selectPolygon(clickedPoly.id);
    if (clickedCorner) {
     polygons.forEach(p => p.selectedCornerIndex = null); clickedPoly.selectedCornerIndex = clickedCorner.index;
      renderCornerDotsSelector(clickedPoly);
      renderCornerNoteSelector(clickedPoly);
    } else {
      polygons.forEach(p => p.selectedCornerIndex = null);
    }
    refreshPolygonUI(clickedPoly);
  } else {
    deselectPolygon();
  }
});

canvas.addEventListener("pointermove", (e) => {
   const { x, y } = getCanvasMousePos(e);
   for (const p of polygons) {
     p.updateHover(x, y, elapsedSeconds, 10);
   }
});

document.querySelectorAll('#miniKeyboard button[data-note]').forEach(btn => {
  btn.addEventListener("click", () => {
    assignNextCornerNote(btn.dataset.note);
  });
});

// ---------- Keyboard Shortcuts ----------
document.addEventListener("keydown", (e) => {
  // Ignore shortcuts if typing in an input field
  if (e.target.tagName === "INPUT") return;

  switch (e.code) {
    case "Space":
      e.preventDefault(); // Prevent scrolling
      if (audioCtx.state === "suspended") audioCtx.resume();
      
      if (isPlaying) {
        isPlaying = false;
        togglePatternButtons(true); // Enable editing
      } else {
        isPlaying = true;
        togglePatternButtons(false); // Disable editing
      }
      break;

    case "Delete":
    case "Backspace":
      if (selectedPolygonId !== null) {
        removePolygon(selectedPolygonId);
      }
      break;
  }
});

// Initial Polygons
addPolygon({ sides: 6, bpm: 120 });
addPolygon({ sides: 4, bpm: 90 });

requestAnimationFrame(animate);