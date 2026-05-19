// State & Constants
let aksaraData = [];
let currentAksara = null;
let isGuideVisible = true;

const syllabaryMap = {
    // 3 karakter dulu
    'nga': 'ꦔ', 'nya': 'ꦚ', 'dha': 'ꦝ', 'tha': 'ꦛ',
    // 2 karakter
    'ha': 'ꦲ', 'na': 'ꦤ', 'ca': 'ꦕ', 'ra': 'ꦫ', 'ka': 'ꦏ',
    'da': 'ꦢ', 'ta': 'ꦠ', 'sa': 'ꦱ', 'wa': 'ꦮ', 'la': 'ꦭ',
    'pa': 'ꦥ', 'ja': 'ꦗ', 'ya': 'ꦪ', 'ma': 'ꦩ', 'ga': 'ꦒ',
    'ba': 'ꦧ',
};

// Canvas Variables
const canvas = document.getElementById('tracing-canvas');
const ctx = canvas.getContext('2d', { alpha: true });
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let strokes = []; // To store user strokes for redraw
let currentStroke = [];

// Initialize
async function init() {
    try {
        const response = await fetch('data/aksara.json');
        const data = await response.json();
        aksaraData = data.aksara;
        
        renderEdukasiGrid();
        initCanvas();
        initTransliterasi();
    } catch (error) {
        console.error("Gagal memuat data aksara:", error);
    }
}

// ==========================================
// MODUL 1: EDUKASI
// ==========================================
function renderEdukasiGrid() {
    const grid = document.getElementById('aksara-grid');
    grid.innerHTML = '';
    
    aksaraData.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'aksara-card';
        card.dataset.id = item.id;
        
        card.innerHTML = `
            <div class="aksara-unicode">${item.unicode}</div>
            <div class="aksara-latin">${item.latin}</div>
            <div class="aksara-gatra">${item.gatra_makna}</div>
            <div class="aksara-filosofi">${item.filosofi}</div>
        `;
        
        card.addEventListener('click', () => {
            document.querySelectorAll('.aksara-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectAksara(item);
        });
        
        grid.appendChild(card);
    });
}

function selectAksara(item) {
    currentAksara = item;
    
    const info = document.getElementById('current-aksara-info');
    info.innerHTML = `Latihan: <strong>${item.latin}</strong> (${item.bunyi}) - ${item.filosofi}`;
    
    clearCanvas();
    
    // Auto-scroll ke bagian canvas
    const tracingSection = document.getElementById('section-tracing');
    if (tracingSection) {
        tracingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ==========================================
// MODUL 2: TRACING CANVAS
// ==========================================
function initCanvas() {
    resizeCanvas();
    window.addEventListener('resize', () => {
        // Debounce resize
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(() => {
            resizeCanvas();
        }, 100);
    });
    
    // Pointer events
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointerout', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    
    // Buttons
    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
    
    const btnToggle = document.getElementById('btn-toggle-guide');
    btnToggle.addEventListener('click', () => {
        isGuideVisible = !isGuideVisible;
        btnToggle.textContent = isGuideVisible ? "Tampilkan Panduan" : "Sembunyikan Panduan";
        redrawCanvas();
    });
    
    document.getElementById('btn-export').addEventListener('click', exportPNG);
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Normalize coordinate system to use css pixels
    ctx.scale(dpr, dpr);
    
    // Element style size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    redrawCanvas();
}

function renderGuide() {
    if (!currentAksara || !isGuideVisible) return;
    
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const fontSize = Math.min(width, height) * 0.75;
    
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#8B2E0F';
    ctx.font = `${fontSize}px 'Noto Serif Javanese', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentAksara.unicode, width / 2, height / 2 + (fontSize * 0.05));
    ctx.restore();
}

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function startDrawing(e) {
    if (!currentAksara) {
        return;
    }
    
    isDrawing = true;
    const pos = getPointerPos(e);
    lastX = pos.x;
    lastY = pos.y;
    currentStroke = [{x: pos.x, y: pos.y}];
    
    // Provide initial dot
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#8B2E0F';
    ctx.fill();
    ctx.closePath();
}

let pendingDraw = false;
let currentPos = null;

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent default touch actions
    currentPos = getPointerPos(e);
    
    if (!pendingDraw) {
        pendingDraw = true;
        requestAnimationFrame(() => {
            if (!isDrawing) { pendingDraw = false; return; }
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.strokeStyle = '#8B2E0F';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.closePath();
            
            lastX = currentPos.x;
            lastY = currentPos.y;
            currentStroke.push({x: lastX, y: lastY});
            
            pendingDraw = false;
        });
    }
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        if (currentStroke.length > 0) {
            strokes.push([...currentStroke]);
        }
    }
}

function clearCanvas() {
    strokes = [];
    currentStroke = [];
    redrawCanvas();
}

function redrawCanvas() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    renderGuide();
    
    // Redraw user strokes
    strokes.forEach(stroke => {
        if (stroke.length === 0) return;
        
        if (stroke.length === 1) {
            ctx.beginPath();
            ctx.arc(stroke[0].x, stroke[0].y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#8B2E0F';
            ctx.fill();
            ctx.closePath();
            return;
        }
        
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.strokeStyle = '#8B2E0F';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.closePath();
    });
}

function exportPNG() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    const dpr = window.devicePixelRatio || 1;
    tempCtx.scale(dpr, dpr);
    
    strokes.forEach(stroke => {
        if (stroke.length === 0) return;
        
        if (stroke.length === 1) {
            tempCtx.beginPath();
            tempCtx.arc(stroke[0].x, stroke[0].y, 2.5, 0, Math.PI * 2);
            tempCtx.fillStyle = '#8B2E0F';
            tempCtx.fill();
            tempCtx.closePath();
            return;
        }
        
        tempCtx.beginPath();
        tempCtx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
            tempCtx.lineTo(stroke[i].x, stroke[i].y);
        }
        tempCtx.strokeStyle = '#8B2E0F';
        tempCtx.lineWidth = 5;
        tempCtx.lineCap = 'round';
        tempCtx.lineJoin = 'round';
        tempCtx.stroke();
        tempCtx.closePath();
    });
    
    const link = document.createElement('a');
    link.download = `aksaratrace-${currentAksara ? currentAksara.latin : 'export'}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

// ==========================================
// MODUL 3: TRANSLITERASI
// ==========================================
function initTransliterasi() {
    const input = document.getElementById('latin-input');
    
    input.addEventListener('input', (e) => {
        const text = e.target.value.toLowerCase();
        transliterate(text);
    });
}

function transliterate(text) {
    const output = document.getElementById('aksara-output');
    if (!text) {
        output.textContent = '';
        return;
    }
    
    let result = '';
    let i = 0;
    
    while (i < text.length) {
        if (i + 2 < text.length) {
            const str3 = text.substr(i, 3);
            if (syllabaryMap[str3]) {
                result += syllabaryMap[str3];
                i += 3;
                continue;
            }
        }
        
        if (i + 1 < text.length) {
            const str2 = text.substr(i, 2);
            if (syllabaryMap[str2]) {
                result += syllabaryMap[str2];
                i += 2;
                continue;
            }
        }
        
        result += text[i];
        i++;
    }
    
    output.textContent = result;
}

document.addEventListener('DOMContentLoaded', init);
