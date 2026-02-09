/* =========================================
   Utility & Helper Functions
   ========================================= */

/**
 * Returns a random floating point number between min and max.
 */
function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Adjusts the canvas resolution to match the display size for sharp rendering.
 * Resets polygon positions to the center of the new size.
 */
function resizeCanvas() {
    const parent = canvas.parentElement;
    const dpr = 1; // Device Pixel Ratio (can be window.devicePixelRatio for HiDPI)
    const rect = parent.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.visualWidth = rect.width;
    canvas.visualHeight = rect.height;

    polygons.forEach(p => {
        p.x = canvas.visualWidth / 2;
        p.y = canvas.visualHeight / 2;
    });
}

/**
 * Renders the static vertical "playhead" line in the center of the canvas.
 */
function drawVerticalLine() {
  const lineX = canvas.width / 2;
  const canvasHeight = canvas.height;
  ctx.lineCap = 'round';
  ctx.save();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lineX, 0);
  ctx.lineTo(lineX, canvasHeight / 2);
  ctx.stroke();
  ctx.restore();
}

// Generates a random HSL color string
function randomColor() {
    const h = Math.floor(randomInRange(0, 360));
    return `hsl(${h}, 90%, 65%)`;
}

// Creates a transparent fill color based on the stroke color
function randomFillFromStroke(stroke) {
    return stroke.replace("hsl", "hsla").replace(")", ", 0.15)");
}

// Radius Management: Ensures new polygons don't overlap perfectly with existing ones
function getNextRadius() {
    if (availableRadii.length > 0) return availableRadii.pop();
    const r = baseRadius + nextRadiusIndex * radiusStep;
    nextRadiusIndex++;
    return r;
}

function recycleRadius(radius) {
    availableRadii.push(radius);
}

/* --- Color Conversion Utilities --- */

// Converts Hex string (e.g., #FFFFFF) to HSL string
function hexToHSL(H) {
  let r = 0, g = 0, b = 0;
  if (H.length == 4) {
    r = "0x" + H[1] + H[1]; g = "0x" + H[2] + H[2]; b = "0x" + H[3] + H[3];
  } else if (H.length == 7) {
    r = "0x" + H[1] + H[2]; g = "0x" + H[3] + H[4]; b = "0x" + H[5] + H[6];
  }
  r /= 255; g /= 255; b /= 255;
  let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin, h = 0, s = 0, l = 0;

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

// Converts HSL string to Hex string
function hslToHex(hsl) {
  const matches = hsl.match(/\d+(\.\d+)?/g);
  if (!matches) return "#22d3ee";
  const [h, s, l] = matches.map(Number);
  const a = s * Math.min(l / 100, 1 - l / 100) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    const nRound = Math.round(255 * c).toString(16).padStart(2, "0");
    return nRound;
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* --- Coordinate & Math Utilities --- */

function getCanvasMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left); 
    const y = (e.clientY - rect.top);
    return { x, y };
}

// Finds the closest musical note name for a given frequency
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

// Adjusts octave based on polygon radius (smaller = higher pitch)
function getNoteByRadius(note, radius) {
    if (radius < 20) return note * 4;
    else if (radius < 50) return note * 2;
    else if (radius < 100) return note;
    else if (radius < 200) return note / 2;
    else if (radius < 250) return note / 4;
    else return note / 8;
}

// Math for MIDI Export (Least Common Multiple)
function lcm(a, b) { return (a * b) / (function gcd(x, y) { return y === 0 ? x : gcd(y, x % y); })(a, b); }
function lcmArray(arr) { return arr.reduce((acc, val) => lcm(acc, val), 1); }
function freqToMidi(f) { return f === 0 ? null : Math.round(69 + 12 * Math.log2(f / 440)); }

/* =========================================
   Audio Engine (Web Audio API)
   ========================================= */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Synthesizes a simple tone using an oscillator.
 * Uses an envelope (linear ramp up, exponential ramp down) to avoid clicking.
 */
function playClick(volume = 0.1, freq = 1000, duration = 0.05) {
    if (volume <= 0.001) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = "sine"; 
    osc.frequency.value = freq;
    
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Decay
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + duration + 0.1);
}

// Detection constants and Note Frequencies
const intersection_tolerance = 12 * (Math.PI / 180);
const NOTES = [
    { name: "C", freq: 261.63 }, { name: "C#", freq: 277.18 }, { name: "D", freq: 293.66 },
    { name: "D#", freq: 311.13 }, { name: "E", freq: 329.63 }, { name: "F", freq: 349.23 },
    { name: "F#", freq: 369.99 }, { name: "G", freq: 392.00 }, { name: "G#", freq: 415.30 },
    { name: "A", freq: 440.00 }, { name: "A#", freq: 466.16 }, { name: "B", freq: 493.88 },
    { name: "C", freq: 523.25 }, { name: "pause", freq: 0 }
];
const NOTES_MAP = {
    c4: 261.63, "c#": 277.18, d: 293.66, "d#": 311.13, e: 329.63, f: 349.23,
    "f#": 369.99, g: 392.00, "g#": 415.30, a: 440.00, "a#": 466.16, b: 493.88, c5: 523.25
};

/* =========================================
   UI Component: Rotary Knob
   ========================================= */
function createKnob(container, label, min, max, step, initialValue, onChange) {
    const wrapper = document.createElement("div");
    wrapper.className = "knob-control";

    const lbl = document.createElement("div");
    lbl.className = "knob-label";
    lbl.textContent = label;

    const dial = document.createElement("div");
    dial.className = "knob-dial";

    const indicator = document.createElement("div");
    indicator.className = "knob-indicator";
    dial.appendChild(indicator);

    const valDisplay = document.createElement("div");
    valDisplay.className = "knob-value";

    wrapper.append(lbl, dial, valDisplay);
    container.appendChild(wrapper);

    // Internal State
    let value = initialValue;
    const range = max - min;
    
    // Updates the visual rotation of the knob
    // Maps value to -150deg (approx 7pm) to +150deg (approx 5pm)
    const updateVisuals = () => {
        // Clamp logic
        if (value < min) value = min;
        if (value > max) value = max;

        // Step logic
        if (step > 0) {
            value = Math.round(value / step) * step;
            value = parseFloat(value.toFixed(2));
        }

        const pct = (value - min) / range;
        
        // Calculate CSS rotation (300 degree spread)
        const angle = -150 + (pct * 300);
        
        indicator.style.transform = `translate(-50%, 0) rotate(${angle}deg)`;
        valDisplay.textContent = value;
    };

    updateVisuals();

    // Drag Interaction Logic
    let startY = 0;
    let startVal = 0;

    const onMove = (e) => {
        const currentY = e.clientY;
        const deltaY = startY - currentY; // Up mouse movement is positive
        const sensitiveRange = 200; // Pixels required to cover the full value range
        
        const deltaVal = (deltaY / sensitiveRange) * range;
        value = startVal + deltaVal;
        
        updateVisuals();
        onChange(value);
    };

    const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
    };

    dial.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startY = e.clientY;
        startVal = value;
        document.body.style.cursor = "ns-resize";
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    });

    return {
        setValue: (v) => {
            value = v;
            updateVisuals();
        },
        getValue: () => value,
        wrapper: wrapper
    };
}

/* =========================================
   Core Logic: Polygon Class
   ========================================= */
class RotatingPolygon {
    constructor(ctx, options = {}) {
        this.ctx = ctx;
        this.id = options.id ?? 0;
        this.name = options.name ?? `Polygon #${this.id}`;
        this.x = canvas.visualWidth / 2;
        this.y = canvas.visualHeight / 2;
        this.measures = options.measures ?? 1;
        
        // Pattern State (Sequencer)
        this.currentPatternChar = 'A';
        this.sequence = ['A'];            
        this.patterns = {};                
        this.polyVolume = options.polyVolume ?? 1.0;

        // Visual defaults
        const initialSides = options.sides ?? 6;
        const initialRadius = options.radius ?? 80;
        const initialStroke = options.strokeStyle ?? "#00ff9d";
        const initialFill = options.fillStyle ?? "rgba(0, 255, 157, 0.15)";

        // Define default pattern structure
        const defaultState = {
            sides: initialSides,
            radius: initialRadius,
            strokeStyle: initialStroke,
            fillStyle: initialFill,
            corners: Array.from({ length: initialSides }, (_, i) => ({
                index: i, note: 261.63, lengthFactor: 0.2, volume: 1.0
            }))
        };

        // Initialize all patterns (A, B, C, D)
        ['A', 'B', 'C', 'D'].forEach(char => {
            this.patterns[char] = JSON.parse(JSON.stringify(defaultState));
        });

        this.applyState(this.patterns['A']);
        this.lineWidth = options.lineWidth ?? 3;
        
        // Hit detection state
        this.wasHittingLine = false;
        this.selectedCornerIndex = null;
        this.hoveredCornerIndex = null;
        this.lastCycleIndex = -1;
    }

    saveCurrentStateTo(char) {
        this.patterns[char] = {
            sides: this.sides, radius: this.radius, strokeStyle: this.strokeStyle,
            fillStyle: this.fillStyle, corners: JSON.parse(JSON.stringify(this.corners))
        };
    }

    loadStateFrom(char) {
        const data = this.patterns[char];
        if (!data) return;
        this.applyState(data);
        this.currentPatternChar = char;
    }

    applyState(data) {
        this.sides = data.sides;
        this.radius = data.radius;
        this.strokeStyle = data.strokeStyle;
        this.fillStyle = data.fillStyle;
        this.corners = data.corners.map(c => ({
            ...c, 
            volume: c.volume !== undefined ? c.volume : 1.0
        }));
    }

    // Handles the timing and pattern switching logic
    updateSequence(tSeconds) {
        this.x = canvas.visualWidth / 2;
        this.y = canvas.visualHeight / 2;

        const duration = this.getRotationDuration();
        if (duration <= 0) return;
        
        const totalBeats = (globalBpm / 60) * Math.max(0, tSeconds);
        const currentCycleIndex = Math.floor(totalBeats / duration);

        // Check if we entered a new cycle to switch patterns
        if (currentCycleIndex > this.lastCycleIndex) {
            this.lastCycleIndex = currentCycleIndex;
            const seqIndex = currentCycleIndex % this.sequence.length;
            const nextChar = this.sequence[seqIndex];
            
            this.saveCurrentStateTo(this.currentPatternChar);
            
            if (nextChar !== this.currentPatternChar) {
                this.loadStateFrom(nextChar);
                // Update UI if this polygon is currently being edited
                if (selectedPolygonId === this.id) {
                    refreshPolygonUI(this);
                    updatePatternButtons(this);
                }
            }
        }
    }

    getRotationDuration() { return 4 * this.measures; }
    getNoteDurationSeconds() { return (this.getRotationDuration() / this.sides) / globalBpm * 60; }
  getNoteDurationTicks() {
        const polygonDurationBeats = this.getRotationDuration();
        const noteDurationBeats = polygonDurationBeats / this.sides;
        const noteDurationTicks = Math.round(noteDurationBeats * 480);
        return noteDurationTicks;
      }
    
    // Updates side count and preserves/generates corner data
    setSides(n) {
        const newCount = Math.max(3, Math.floor(n));
        if (newCount === this.sides) return;

        let newCorners = [...this.corners];
        if (newCount > this.sides) {
            const diff = newCount - this.sides;
            for (let i = 0; i < diff; i++) {
                newCorners.push({
                    index: this.sides + i, 
                    note: 261.63, 
                    lengthFactor: 0.2,
                    volume: 1.0
                });
            }
        } else {
            newCorners = newCorners.slice(0, newCount);
        }

        newCorners.forEach((c, i) => c.index = i);
        this.sides = newCount;
        this.corners = newCorners;
        
        if (this.selectedCornerIndex !== null && this.selectedCornerIndex >= this.sides) {
            this.selectedCornerIndex = this.sides - 1;
        }

        this.saveCurrentStateTo(this.currentPatternChar);
    }

    setRadius(r) {
        this.radius = Math.max(5, r);
        this.saveCurrentStateTo(this.currentPatternChar);
    }

    // Calculates current rotation based on playback time
    getAngle(tSeconds) {
        const duration = this.getRotationDuration();
        if (duration <= 0) return 0;
        const totalBeats = (globalBpm / 60) * tSeconds;
        return (totalBeats / duration) * 2 * Math.PI;
    }

    // Calculates the absolute X,Y coordinates of a specific vertex
    getCornerPosition(i, tSeconds) {
        const rotation = this.getAngle(tSeconds);
        // Phase shift: Start aligned
        const theta = rotation - Math.PI / 2 - (i / this.sides) * Math.PI * 2;
        return {
            x: this.x + Math.cos(theta) * this.radius,
            y: this.y + Math.sin(theta) * this.radius,
            theta
        };
    }

    // Detects if any corner is currently crossing the vertical playhead (270 degrees / 1.5 PI)
    checkForIntersection(tSeconds) {
        const TWO_PI = Math.PI * 2;
        const target = 1.5 * Math.PI; // 12 o'clock visual, physics 270 deg
        
        for (const corner of this.corners) {
            const { theta } = this.getCornerPosition(corner.index, tSeconds);
            let normTheta = theta % TWO_PI;
            if (normTheta < 0) normTheta += TWO_PI;
            
            let diff = Math.abs(normTheta - target);
            if (diff > Math.PI) diff = TWO_PI - diff; 
            if (diff < intersection_tolerance) return { angle: diff, corner };
        }
        return null;
    }

    // Interactions
    updateHover(px, py, tSeconds, radiusTolerance = 6) {
        this.hoveredCornerIndex = null;
        for (const corner of this.corners) {
            const { x, y } = this.getCornerPosition(corner.index, tSeconds);
            const dx = px - x, dy = py - y;
            if (Math.sqrt(dx * dx + dy * dy) <= radiusTolerance) {
                this.hoveredCornerIndex = corner.index;
                break;
            }
        }
    }

    draw(tSeconds) {
        const rotation = this.getAngle(tSeconds);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(rotation - Math.PI / 2);

        // Draw Polygon Shape
        ctx.beginPath();
        for (let i = 0; i < this.sides; i++) {
            const theta = -(i / this.sides) * Math.PI * 2;
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

        // Draw Corner Dots
        for (let i = 0; i < this.sides; i++) {
            const theta = -(i / this.sides) * Math.PI * 2;
            const px = this.radius * Math.cos(theta);
            const py = this.radius * Math.sin(theta);

            ctx.beginPath();
            if (i === this.hoveredCornerIndex || i === this.selectedCornerIndex) {
                // Highlight active corner
                const r = this.lineWidth * 2.5;
                ctx.fillStyle = "#fff";
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Standard corner
                ctx.fillStyle = this.strokeStyle;
                ctx.arc(px, py, this.lineWidth * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Click Detection
    hitTest(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius + 10;
    }

    hitTestCorner(px, py, tSeconds, radiusTolerance = 15) {
        for (const corner of this.corners) {
            const { x, y } = this.getCornerPosition(corner.index, tSeconds);
            const dx = px - x;
            const dy = py - y;
            if (Math.sqrt(dx * dx + dy * dy) <= radiusTolerance) return corner;
        }
        return null;
    }
}

/* =========================================
   Application State & DOM Elements
   ========================================= */
const canvas = document.getElementById("polygonCanvas");
const ctx = canvas.getContext("2d");
const addPolygonBtn = document.getElementById("addPolygonBtn");

// UI Panels
const overviewPanel = document.getElementById("overviewPanel");
const detailPanel = document.getElementById("detailPanel");
const overviewListEl = document.getElementById("overviewList");
const detailListEl = document.getElementById("detailList");
const backToMenuBtn = document.getElementById("backToMenuBtn");
const emptyStateMsg = document.getElementById("emptyStateMsg");

// Transport Controls
const globalBpmInput = document.getElementById("globalBpmInput");
const globalVolInput = document.getElementById("globalVolInput");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadMidiBtn = document.getElementById("download-midi");

// Global State
let polygons = [];
let nextPolygonId = 1;
let globalBpm = 120;
let globalMasterVolume = 0.5;
let isPlaying = true;
let elapsedSeconds = -0.1;
let lastTimestamp = null;

// Appearance defaults
let baseRadius = 40;
let radiusStep = 35;
let nextRadiusIndex = 0;
let availableRadii = [];

// Selection State
let selectedPolygonId = null;
let assignIndex = 0; // Tracks which corner gets the next keyboard input
let uiKnobs = {}; // Stores references to active knob instances

/* =========================================
   Initialization & Event Listeners
   ========================================= */

// Handle Window Resize
window.addEventListener("resize", resizeCanvas);
resizeCanvas(); 

/* --- Polygon Management --- */

function addPolygon(options = {}) {
    const x = options.x ?? canvas.visualWidth / 2;
    const y = options.y ?? canvas.visualHeight / 2;
    const sides = options.sides ?? Math.floor(randomInRange(3, 8));
    const radius = options.radius ?? getNextRadius();
    const bpm = options.bpm ?? Math.floor(randomInRange(60, 180));
    const stroke = randomColor();
    const fill = randomFillFromStroke(stroke);

    const poly = new RotatingPolygon(ctx, {
        id: nextPolygonId++, sides, radius, bpm, x, y,
        strokeStyle: stroke, fillStyle: fill, lineWidth: 3,
        polyVolume: 1.0
    });

    polygons.push(poly);
    createOverviewItem(poly);
    createDetailPanel(poly);
    updateEmptyState();
}

function removePolygon(id) {
    const poly = polygons.find(p => p.id === id);
    if (!poly) return;
    recycleRadius(poly.radius);
    polygons = polygons.filter(p => p.id !== id);
    
    // Cleanup DOM
    const panel = detailListEl.querySelector(`[data-id="${id}"]`);
    if (panel) panel.remove();
    const overviewItem = overviewListEl.querySelector(`[data-id="${id}"]`);
    if (overviewItem) overviewItem.remove();
    
    delete uiKnobs[id]; 

    updateEmptyState();
    if (selectedPolygonId === id) deselectPolygon();
}

function updateEmptyState() {
    emptyStateMsg.style.display = polygons.length === 0 ? "block" : "none";
}

function selectPolygon(id) {
    selectedPolygonId = id;
    const poly = polygons.find(p => p.id === id);
    if (!poly) return;

    if (poly.selectedCornerIndex === null) poly.selectedCornerIndex = 0;
    assignIndex = poly.selectedCornerIndex;

    overviewPanel.classList.add("hidden");
    detailPanel.classList.remove("hidden");

    // Toggle visibility of detail panels
    const panels = detailListEl.querySelectorAll(".poly-panel");
    panels.forEach(panel => {
        panel.style.display = Number(panel.dataset.id) === id ? "block" : "none";
    });

    renderCornerDotsSelector(poly);
    updatePatternButtons(poly);
    refreshPolygonUI(poly);
}

function deselectPolygon() {
    selectedPolygonId = null;
    polygons.forEach(p => p.selectedCornerIndex = null);
    detailPanel.classList.add("hidden");
    overviewPanel.classList.remove("hidden");
}

/* --- UI Construction (DOM Manipulation) --- */

function createOverviewItem(polygon) {
    const item = document.createElement("div");
    item.className = "overview-item";
    item.dataset.id = polygon.id;
    
    const leftPart = document.createElement("div");
    leftPart.style.display = "flex"; leftPart.style.alignItems = "center";
    
    const dot = document.createElement("span");
    dot.className = "overview-color-dot";
    dot.style.backgroundColor = hslToHex(polygon.strokeStyle);
    dot.style.color = hslToHex(polygon.strokeStyle); 

    const name = document.createElement("span");
    name.className = "overview-name";
    name.textContent = polygon.name;

    // Context Menu for Renaming
    item.addEventListener("contextmenu", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (item.querySelector("input")) return;
        const input = document.createElement("input");
        input.type = "text"; input.value = polygon.name; input.className = "rename-input";
        
        const saveName = () => {
            const newName = input.value.trim();
            if (newName) {
                polygon.name = newName;
                name.textContent = newName;
                const dp = detailListEl.querySelector(`.poly-panel[data-id="${polygon.id}"]`);
                if(dp) dp.querySelector('.poly-name').textContent = newName;
            }
            if(input.parentNode) input.parentNode.replaceChild(name, input);
        };
        input.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") saveName();
            else if (ev.key === "Escape") input.parentNode.replaceChild(name, input);
            ev.stopPropagation();
        });
        input.addEventListener("blur", saveName);
        input.addEventListener("click", ev => ev.stopPropagation());
        name.parentNode.replaceChild(input, name);
        input.focus(); input.select();
    });

    leftPart.append(dot, name);
    const info = document.createElement("div");
    info.className = "overview-info";
    info.textContent = `${polygon.sides} sides`;

    item.append(leftPart, info);
    item.addEventListener("click", (e) => {
        if (e.target.tagName !== 'INPUT') selectPolygon(polygon.id);
    });
    overviewListEl.appendChild(item);
}

function createDetailPanel(polygon) {
    const panel = document.createElement("div");
    panel.className = "poly-panel";
    panel.dataset.id = polygon.id;
    panel.style.display = "none";
    
    // Initialize Knob Storage for this polygon
    uiKnobs[polygon.id] = {};

    // --- Header Section ---
    const header = document.createElement("div");
    header.className = "poly-header";
    const name = document.createElement("div");
    name.className = "poly-name";
    name.textContent = polygon.name;

    const headerControls = document.createElement("div");
    headerControls.style.display="flex"; headerControls.style.gap="10px";

    // Color Picker
    const colorWrapper = document.createElement("div");
    colorWrapper.className = "color-picker-wrapper";
    colorWrapper.style.backgroundColor = hslToHex(polygon.strokeStyle);
    const colorInput = document.createElement("input");
    colorInput.type = "color"; colorInput.value = hslToHex(polygon.strokeStyle);
    colorInput.addEventListener("input", () => {
        const hex = colorInput.value;
        const hsl = hexToHSL(hex);
        polygon.strokeStyle = hsl;
        polygon.fillStyle = hexToRgba(hex, 0.15);
        polygon.saveCurrentStateTo(polygon.currentPatternChar);
        colorWrapper.style.backgroundColor = hex;
        const ovItem = overviewListEl.querySelector(`[data-id="${polygon.id}"] .overview-color-dot`);
        if(ovItem) { ovItem.style.backgroundColor = hex; ovItem.style.color = hex; }
    });
    colorWrapper.appendChild(colorInput);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-secondary";
    removeBtn.textContent = "Remove";
    removeBtn.style.padding = "4px 8px"; removeBtn.style.fontSize="10px";
    removeBtn.addEventListener("click", () => removePolygon(polygon.id));

    headerControls.append(colorWrapper, removeBtn);
    header.append(name, headerControls);
    panel.appendChild(header);

    // --- Pattern Section (A,B,C,D) ---
    const patternRow = document.createElement("div");
    patternRow.className = "pattern-row";
    ['A', 'B', 'C', 'D'].forEach(char => {
        const btn = document.createElement("button");
        btn.className = `pattern-btn ${polygon.currentPatternChar === char ? 'active' : ''}`;
        btn.textContent = char; btn.dataset.char = char; btn.disabled = isPlaying;
        btn.addEventListener("click", () => {
            polygon.saveCurrentStateTo(polygon.currentPatternChar);
            polygon.loadStateFrom(char);
            patternRow.querySelectorAll('.pattern-btn').forEach(b => b.classList.toggle('active', b.dataset.char === char));
            refreshPolygonUI(polygon);
        });
        patternRow.appendChild(btn);
    });
    panel.appendChild(patternRow);

    // Pattern Sequencer Input
    const seqInput = document.createElement("input");
    seqInput.className = "seq-input";
    seqInput.value = polygon.sequence.join("");
    seqInput.addEventListener("input", (e) => {
         const clean = e.target.value.toUpperCase().replace(/[^ABCD]/g, '');
         polygon.sequence = clean.length > 0 ? clean.split('') : ['A'];
         polygon.lastCycleIndex = -1; // Force pattern refresh
    });
    panel.appendChild(seqInput);

    // --- Stats Controls (Sides/Measures) ---
    const grid = document.createElement("div");
    grid.className = "control-grid";
    
    const dSides = document.createElement("div"); dSides.className = "control-item";
    dSides.innerHTML = "<label>Sides</label>";
    const inpSides = document.createElement("input"); inpSides.type="number"; inpSides.min="3"; inpSides.value=polygon.sides;
    inpSides.addEventListener("input", () => {
        polygon.setSides(Number(inpSides.value));
        refreshPolygonUI(polygon);
        const ov = overviewListEl.querySelector(`[data-id="${polygon.id}"] .overview-info`);
        if(ov) ov.textContent = `${polygon.sides} sides`;
    });
    dSides.appendChild(inpSides);

    const dMeas = document.createElement("div"); dMeas.className = "control-item";
    dMeas.innerHTML = "<label>Measures</label>";
    const inpMeas = document.createElement("input"); inpMeas.type="number"; inpMeas.min="1"; inpMeas.value=polygon.measures;
    inpMeas.addEventListener("input", () => {
        polygon.measures = Math.max(1, Number(inpMeas.value));
        polygon.lastCycleIndex = -1;
    });
    dMeas.appendChild(inpMeas);
    grid.append(dSides, dMeas);
    panel.appendChild(grid);

    // --- Knob Controls ---
    const knobRow1 = document.createElement("div");
    knobRow1.className = "knob-row";
    panel.appendChild(knobRow1);

    // 1. Radius Knob
    uiKnobs[polygon.id].radius = createKnob(knobRow1, "Radius", 10, 400, 1, Math.round(polygon.radius), (val) => {
        polygon.setRadius(val);
    });

    // 2. Poly Volume Knob
    uiKnobs[polygon.id].polyVol = createKnob(knobRow1, "Poly Vol", 0, 1, 0.01, polygon.polyVolume, (val) => {
        polygon.polyVolume = val;
    });

    // 3. Corner Volume Knob
    uiKnobs[polygon.id].cornerVol = createKnob(knobRow1, "Note Vol", 0, 1, 0.01, 1.0, (val) => {
        if(polygon.selectedCornerIndex !== null) {
            polygon.corners[polygon.selectedCornerIndex].volume = val;
            polygon.saveCurrentStateTo(polygon.currentPatternChar);
        }
    });
  // 3. Corner Length Knob
    uiKnobs[polygon.id].cornerLen = createKnob(knobRow1, "Note Len", 0, 0.95, 0.01, 0.2, (val) => {
        if(polygon.selectedCornerIndex !== null) {
            polygon.corners[polygon.selectedCornerIndex].lengthFactor = val;
            polygon.saveCurrentStateTo(polygon.currentPatternChar);
        }
    });
    
    // Corner Grid (Container)
    const cornerGrid = document.createElement("div");
    cornerGrid.className = "corner-grid";
    panel.appendChild(cornerGrid);

    detailListEl.appendChild(panel);
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

function renderCornerDotsSelector(polygon) {
    const panel = detailListEl.querySelector(`.poly-panel[data-id="${polygon.id}"]`);
    if (!panel) return;
    const grid = panel.querySelector(".corner-grid");
    grid.innerHTML = "";

    polygon.corners.forEach((corner, i) => {
        const dot = document.createElement("div");
        dot.className = "corner-dot";
        if (polygon.selectedCornerIndex === i) dot.classList.add("active");
        dot.textContent = freqToNoteLabel(corner.note);
        
        const idx = document.createElement("span");
        idx.className="idx"; idx.textContent = i+1;
        dot.appendChild(idx);

        dot.addEventListener("click", () => {
            polygons.forEach(p => p.selectedCornerIndex = null);
            polygon.selectedCornerIndex = i;
            assignIndex = i;
            renderCornerDotsSelector(polygon);
            refreshPolygonUI(polygon); // Update knobs for new selection
        });
        grid.appendChild(dot);
    });
}

// Synchronizes the UI controls with the internal state of the polygon
function refreshPolygonUI(polygon) {
    const panel = detailListEl.querySelector(`.poly-panel[data-id="${polygon.id}"]`);
    if(!panel) return;

    // Inputs
    const inpSides = panel.querySelector(".control-grid input");
    if(inpSides) inpSides.value = polygon.sides;
    
    // Color
    const colInp = panel.querySelector(".color-picker-wrapper input");
    const colWrap = panel.querySelector(".color-picker-wrapper");
    if(colInp) {
        const h = hslToHex(polygon.strokeStyle);
        colInp.value = h; colWrap.style.backgroundColor = h;
    }

    // Knobs Update
    const knobs = uiKnobs[polygon.id];
    if(knobs) {
        if(knobs.radius) knobs.radius.setValue(Math.round(polygon.radius));
        if(knobs.polyVol) knobs.polyVol.setValue(polygon.polyVolume);
        
        if(knobs.cornerVol && polygon.selectedCornerIndex !== null) {
            const vol = polygon.corners[polygon.selectedCornerIndex].volume;
            knobs.cornerVol.setValue(vol !== undefined ? vol : 1.0);
        }
        if(knobs.cornerLen && polygon.selectedCornerIndex !== null) {
            const vol = polygon.corners[polygon.selectedCornerIndex].lengthFactor;
            knobs.cornerLen.setValue(vol !== undefined ? vol : 0.2);
        }
    }

    renderCornerDotsSelector(polygon);
}

function assignNextCornerNote(noteKey) {
    if (!selectedPolygonId) return;
    const poly = polygons.find(p => p.id === selectedPolygonId);
    if (!poly) return;
    const freq = NOTES_MAP[noteKey];
    if (freq == null) return;
    if (poly.selectedCornerIndex === null) poly.selectedCornerIndex = 0;
    
    // Assign note to current corner and advance index
    const i = assignIndex % poly.corners.length;
    poly.corners[i].note = freq;
    poly.selectedCornerIndex = i;
    poly.saveCurrentStateTo(poly.currentPatternChar);
    
    renderCornerDotsSelector(poly);
    refreshPolygonUI(poly);
    assignIndex = (i + 1) % poly.corners.length;
}

/* =========================================
   Main Animation Loop
   ========================================= */
function animate(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const deltaMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (isPlaying) elapsedSeconds += deltaMs / 1000;
    const tSeconds = elapsedSeconds;

    ctx.clearRect(0, 0, canvas.visualWidth, canvas.visualHeight);
    drawVerticalLine();

    // Sort draw order by radius (largest in back)
    const drawOrder = [...polygons].sort((a, b) => b.radius - a.radius);
    let lineIntensity = 0.2;

    for (const p of drawOrder) {
        if (isPlaying) p.updateSequence(tSeconds);
        p.draw(tSeconds);

        const hit = p.checkForIntersection(tSeconds);
        if (hit) {
            //lineIntensity = Math.max(lineIntensity, hit.angle);
            lineIntensity = lineIntensity + (0.7 - hit.angle / intersection_tolerance * 0.7) / polygons.length;
            if (!p.wasHittingLine && hit.angle < 4 * (Math.PI / 180)) {
                // Trigger sound
                const noteDuration = Math.max(0.01, p.getNoteDurationSeconds() * hit.corner.lengthFactor);
                const freq = getNoteByRadius(hit.corner.note, p.radius);
                const finalVolume = globalMasterVolume * p.polyVolume * hit.corner.volume;

                if (freq > 20 && freq < 10000) playClick(finalVolume, freq, noteDuration);
                p.wasHittingLine = true;
            }
        } else {
            p.wasHittingLine = false;
        }
      if (lineIntensity) {
      ctx.strokeStyle = `rgba(255,255,255,${lineIntensity})`;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    }

    drawVerticalLine();
    }
    requestAnimationFrame(animate);
}

/* =========================================
   MIDI Export Functionality
   ========================================= */
function exportPolygonsToMIDI(polygons) {
  if (!window.MidiWriter) {
    console.error("MidiWriterJS not loaded!");
    return;
  }
  const MidiWriter = window.MidiWriter;

  const totalMeasures = lcmArray(polygons.map(p => p.measures));
  const totalBeats = totalMeasures * 4;

  const tracks = [];

  polygons.forEach((polygon, polyIndex) => {
    const track = new MidiWriter.Track();
    track.setTempo(globalBpm);

    const polygonDurationBeats = polygon.getRotationDuration();
    const repetitions = Math.ceil(totalBeats / polygonDurationBeats);

    for (let r = 0; r < repetitions; r++) {
      polygon.corners.forEach(corner => {
        if (corner.note === 0) return;

        const midiNote = freqToMidi(getNoteByRadius(corner.note, polygon.radius));

        const deltaBeat = (corner.index / polygon.sides) * polygonDurationBeats + r * polygonDurationBeats;

        const noteDurationTicks = polygon.getNoteDurationTicks() * corner.lengthFactor;

        track.addEvent(
          new MidiWriter.NoteEvent({
            pitch: [midiNote],
            duration: "T" + Math.round(noteDurationTicks),
            startTick: Math.round(deltaBeat * 480)
          })
        );
      });
    }

    tracks.push(track); 
  });

  const writer = new MidiWriter.Writer(tracks);

  const midiBytes = writer.buildFile();

  // Patch PPQ to 480
  midiBytes[12] = 0x01;
  midiBytes[13] = 0xE0;

  const midiBlob = new Blob([midiBytes], { type: "audio/midi" });
  const url = URL.createObjectURL(midiBlob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "polygons.mid";
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================================
   User Input Handling
   ========================================= */

// Global Controls
globalBpmInput.addEventListener("input", () => globalBpm = Math.max(1, Number(globalBpmInput.value)));
globalVolInput.addEventListener("input", () => globalMasterVolume = Number(globalVolInput.value));
addPolygonBtn.addEventListener("click", () => addPolygon());
backToMenuBtn.addEventListener("click", () => deselectPolygon());

function togglePatternButtons(enabled) {
    document.querySelectorAll('.pattern-btn').forEach(b => b.disabled = !enabled);
}

// Transport Buttons
playBtn.addEventListener("click", () => {
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (!isPlaying) { isPlaying = true; togglePatternButtons(false); }
});
pauseBtn.addEventListener("click", () => {
    if (isPlaying) { isPlaying = false; togglePatternButtons(true); }
});
resetBtn.addEventListener("click", () => {
    elapsedSeconds = -0.1;
    polygons.forEach(p => { p.wasHittingLine = false; p.lastCycleIndex = -1; p.loadStateFrom(p.sequence[0]||'A'); });
    if(selectedPolygonId) {
        const p = polygons.find(px => px.id === selectedPolygonId);
        if(p) { refreshPolygonUI(p); updatePatternButtons(p); }
    }
    togglePatternButtons(!isPlaying);
});
downloadMidiBtn.addEventListener("click", () => exportPolygonsToMIDI(polygons));

// Canvas Interaction (Click & Drag)
canvas.addEventListener("pointerdown", (e) => {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const { x, y } = getCanvasMousePos(e);
    let clickedPoly = null;
    let clickedCorner = null;
    const hitTestOrder = [...polygons].sort((a, b) => a.radius - b.radius);

    // Check click against polygons (check small ones first for accuracy)
    for (const p of hitTestOrder) {
        const corner = p.hitTestCorner(x, y, elapsedSeconds);
        if (corner) { clickedPoly = p; clickedCorner = corner; break; }
        else if (p.hitTest(x, y)) { clickedPoly = p; break; }
    }

    if (clickedPoly) {
        selectPolygon(clickedPoly.id);
        if (clickedCorner) {
            polygons.forEach(p => p.selectedCornerIndex = null);
            clickedPoly.selectedCornerIndex = clickedCorner.index;
            renderCornerDotsSelector(clickedPoly);
            refreshPolygonUI(clickedPoly); // Will update knobs
        } else {
            polygons.forEach(p => p.selectedCornerIndex = null);
            refreshPolygonUI(clickedPoly);
        }
    }
});

canvas.addEventListener("pointermove", (e) => {
   const { x, y } = getCanvasMousePos(e);
   polygons.forEach(p => p.updateHover(x, y, elapsedSeconds, 15));
});

// Virtual Keyboard Click
document.querySelectorAll('#miniKeyboard button[data-note]').forEach(btn => {
    btn.addEventListener("click", () => assignNextCornerNote(btn.dataset.note));
});

// Global Keyboard Shortcuts
document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    
    if (e.code === "Space") {
        e.preventDefault();
        if (audioCtx.state === "suspended") audioCtx.resume();
        isPlaying = !isPlaying;
        togglePatternButtons(!isPlaying);
    } else if (e.code === "Escape") {
        deselectPolygon();
    } else if (e.code === "Delete" || e.code === "Backspace") {
        if (selectedPolygonId !== null) removePolygon(selectedPolygonId);
    }
});

/* =========================================
   Entry Point
   ========================================= */
// Add demo polygons to start
addPolygon({ sides: 6, bpm: 120, name: "Lead Synth", radius: 25});
addPolygon({ sides: 4, bpm: 90, name: "Bass", radius: 50});

// Start Animation Loop
requestAnimationFrame(animate);