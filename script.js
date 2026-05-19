// ==========================================
// STATE & CONSTANTS
// ==========================================
let aksaraData = [];
let kamusData = {};
let currentAksara = null;
let isGuideVisible = true;
let currentBrushSize = 5;

// Game State (Gamification)
let gameState = {
    xp: 0,
    hearts: 5,
    streak: 0,
    unlockedGatra: 1, // 1 to 4
    lastPlayedDate: null
};

// Elements
const canvas = document.getElementById('tracing-canvas');
const ctx = canvas.getContext('2d', { alpha: true });
let isDrawing = false;
let lastX = 0, lastY = 0;
let strokes = []; 
let currentStroke = [];

// Syllabary Map
const syllabaryMap = {
    'nga': 'ꦔ', 'nya': 'ꦚ', 'dha': 'ꦝ', 'tha': 'ꦛ',
    'ha': 'ꦲ', 'na': 'ꦤ', 'ca': 'ꦕ', 'ra': 'ꦫ', 'ka': 'ꦏ',
    'da': 'ꦢ', 'ta': 'ꦠ', 'sa': 'ꦱ', 'wa': 'ꦮ', 'la': 'ꦭ',
    'pa': 'ꦥ', 'ja': 'ꦗ', 'ya': 'ꦪ', 'ma': 'ꦩ', 'ga': 'ꦒ',
    'ba': 'ꦧ',
};

// ==========================================
// INIT
// ==========================================
async function init() {
    try {
        loadGameState();
        
        const [aksaraRes, kamusRes] = await Promise.all([
            fetch('data/aksara.json'),
            fetch('data/kamus.json')
        ]);
        const aksaraJson = await aksaraRes.json();
        const kamusJson = await kamusRes.json();
        aksaraData = aksaraJson.aksara;
        kamusData = kamusJson.kamus;
        
        initNavigation();
        renderJourneyMap();
        initCanvas();
        initTransliterasi();
        initKuis();
        initKamus();
        initBudaya();
        updateStatsUI();
    } catch (error) {
        console.error("Gagal memuat data:", error);
    }
}

// ==========================================
// CUSTOM MODAL (Neo Brutalism Alert)
// ==========================================
function showNeoModal(title, message, onOk = null) {
    const overlay = document.getElementById('neo-modal-overlay');
    const titleEl = document.getElementById('neo-modal-title');
    const messageEl = document.getElementById('neo-modal-message');
    const btnClose = document.getElementById('btn-close-modal');
    
    titleEl.textContent = title;
    messageEl.innerHTML = message;
    
    const newBtn = btnClose.cloneNode(true);
    btnClose.parentNode.replaceChild(newBtn, btnClose);
    
    newBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
        if(onOk) onOk();
    });
    
    overlay.classList.remove('hidden');
}

// ==========================================
// GAMIFICATION LOGIC
// ==========================================
function loadGameState() {
    const saved = localStorage.getItem('aksaratrace_state');
    if (saved) {
        gameState = { ...gameState, ...JSON.parse(saved) };
    }
    
    // Streak logic
    const today = new Date().toDateString();
    if (gameState.lastPlayedDate !== today) {
        if (gameState.lastPlayedDate) {
            const lastDate = new Date(gameState.lastPlayedDate);
            const currentDate = new Date(today);
            const diffTime = Math.abs(currentDate - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays === 1) {
                gameState.streak += 1;
            } else if (diffDays > 1) {
                gameState.streak = 1; // reset streak if missed a day
            }
        } else {
            gameState.streak = 1;
        }
        gameState.lastPlayedDate = today;
        saveGameState();
    }
    
    // Recovery system (setiap hari heart penuh lagi)
    if(gameState.hearts < 5 && gameState.lastPlayedDate !== today) {
        gameState.hearts = 5;
        saveGameState();
    }
}

function saveGameState() {
    localStorage.setItem('aksaratrace_state', JSON.stringify(gameState));
    updateStatsUI();
}

function updateStatsUI() {
    const xpEl = document.getElementById('stat-xp');
    const streakEl = document.getElementById('stat-streak');
    const heartsEl = document.getElementById('stat-hearts');
    
    xpEl.textContent = gameState.xp;
    streakEl.textContent = gameState.streak;
    heartsEl.textContent = gameState.hearts;
    
    // Animasi perubahan
    xpEl.parentElement.classList.remove('xp-anim');
    void xpEl.parentElement.offsetWidth; // trigger reflow
    xpEl.parentElement.classList.add('xp-anim');
}

function animateHeartLoss() {
    const heartsEl = document.getElementById('stat-hearts');
    heartsEl.parentElement.classList.remove('heart-anim');
    void heartsEl.parentElement.offsetWidth;
    heartsEl.parentElement.classList.add('heart-anim');
}

function addXP(amount) {
    gameState.xp += amount;
    checkUnlockProgress();
    saveGameState();
}

function loseHeart() {
    if (gameState.hearts > 0) {
        gameState.hearts -= 1;
        animateHeartLoss();
        saveGameState();
    }
    
    if (gameState.hearts === 0) {
        showNeoModal("Hati-Hati!", "Nyawa Anda habis. Lakukan Tracing secara akurat untuk memulihkan nyawa!", () => {
            document.querySelector('.nav-btn[data-target="tracing"]').click();
        });
    }
}

function recoverHeart() {
    if (gameState.hearts < 5) {
        gameState.hearts += 1;
        saveGameState();
    }
}

function checkUnlockProgress() {
    let unlockedBefore = gameState.unlockedGatra;
    
    if (gameState.xp >= 300) gameState.unlockedGatra = 4;
    else if (gameState.xp >= 150) gameState.unlockedGatra = 3;
    else if (gameState.xp >= 50) gameState.unlockedGatra = 2;
    else gameState.unlockedGatra = 1;
    
    if (gameState.unlockedGatra > unlockedBefore) {
        showNeoModal("Luar Biasa!", `Selamat! Anda telah mengumpulkan cukup XP untuk membuka <strong>Gatra ${gameState.unlockedGatra}</strong> di Peta Perjalanan!`);
        renderJourneyMap(); // render ulang map
    }
}

// ==========================================
// NAVIGATION (SPA)
// ==========================================
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn, .cta-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            if(e.currentTarget.classList.contains('nav-btn')) {
                e.currentTarget.classList.add('active');
            } else {
                const navMatch = document.querySelector(`.nav-btn[data-target="${target}"]`);
                if(navMatch) navMatch.classList.add('active');
            }
            
            document.querySelectorAll('.page-section').forEach(sec => {
                sec.classList.remove('active');
                sec.classList.remove('fade-in');
            });
            const targetSec = document.getElementById(`section-${target}`);
            targetSec.classList.add('active');
            targetSec.classList.add('fade-in');
            
            if(target === 'tracing') {
                setTimeout(resizeCanvas, 50);
            }
        });
    });
}

// ==========================================
// MODUL 1: EDUKASI / JOURNEY MAP
// ==========================================
function renderJourneyMap() {
    const container = document.getElementById('aksara-grid');
    container.innerHTML = '';
    
    // Mengelompokkan berdasarkan Gatra (1 to 4)
    for (let g = 1; g <= 4; g++) {
        const gatraItems = aksaraData.filter(item => item.gatra === g);
        if (gatraItems.length === 0) continue;
        
        const isLocked = g > gameState.unlockedGatra;
        
        const section = document.createElement('div');
        section.className = 'gatra-section neo-card';
        
        // Target XP display (hardcoded thresholds for demo)
        let xpRequired = 0;
        if(g === 2) xpRequired = 50;
        if(g === 3) xpRequired = 150;
        if(g === 4) xpRequired = 300;
        
        const lockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" style="display:inline; vertical-align:middle; margin-right:5px;">
          <defs>
            <linearGradient id="lockGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#F1C40F" />
              <stop offset="100%" stop-color="#F39C12" />
            </linearGradient>
          </defs>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" fill="url(#lockGrad)" stroke="#1A1510" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#1A1510" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <circle cx="12" cy="16" r="1.5" fill="#1A1510"/>
        </svg>`;
        
        const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" style="display:inline; vertical-align:middle; margin-right:5px;">
          <defs>
            <linearGradient id="checkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#2ECC71" />
              <stop offset="100%" stop-color="#27AE60" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="url(#checkGrad)" stroke="#1A1510" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 9l-5.5 5.5L8 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>`;
        
        section.innerHTML = `
            <div class="gatra-header">
                <div class="gatra-title">Gatra ${g}</div>
                <div class="gatra-status">${isLocked ? lockSvg + 'Butuh ' + xpRequired + ' XP' : checkSvg + 'Terbuka'}</div>
            </div>
            <div class="aksara-grid"></div>
        `;
        
        const grid = section.querySelector('.aksara-grid');
        
        gatraItems.forEach(item => {
            const card = document.createElement('div');
            card.className = `aksara-card neo-card ${isLocked ? 'locked' : ''}`;
            
            if (isLocked) {
                const bigLockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id="bigLockGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#F1C40F" />
                      <stop offset="100%" stop-color="#F39C12" />
                    </linearGradient>
                  </defs>
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" fill="url(#bigLockGrad)" stroke="#1A1510" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#1A1510" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                  <circle cx="12" cy="16" r="1.5" fill="#1A1510"/>
                </svg>`;
                card.innerHTML = `
                    <div class="lock-icon">${bigLockSvg}</div>
                    <div class="aksara-unicode">${item.unicode}</div>
                    <div class="aksara-latin">${item.latin}</div>
                    <div class="aksara-filosofi">Terkunci</div>
                `;
            } else {
                card.innerHTML = `
                    <div class="aksara-unicode">${item.unicode}</div>
                    <div class="aksara-latin">${item.latin}</div>
                    <div class="aksara-filosofi">${item.filosofi}</div>
                `;
                
                card.addEventListener('click', () => {
                    document.querySelectorAll('.aksara-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    selectAksara(item);
                    document.querySelector('.nav-btn[data-target="tracing"]').click();
                });
            }
            
            grid.appendChild(card);
        });
        
        container.appendChild(section);
    }
}

function selectAksara(item) {
    currentAksara = item;
    const info = document.getElementById('current-aksara-info');
    info.innerHTML = `Latihan: <strong>${item.latin}</strong> (${item.bunyi}) - ${item.filosofi}`;
    clearCanvas();
}

// ==========================================
// MODUL 2: TRACING CANVAS
// ==========================================
function initCanvas() {
    window.addEventListener('resize', () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(resizeCanvas, 100);
    });
    
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointerout', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    
    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
    
    const btnToggle = document.getElementById('btn-toggle-guide');
    btnToggle.addEventListener('click', () => {
        isGuideVisible = !isGuideVisible;
        btnToggle.textContent = isGuideVisible ? "Tutup Panduan" : "Buka Panduan";
        redrawCanvas();
    });
    
    document.getElementById('btn-export').addEventListener('click', exportPNG);
    
    const brushSlider = document.getElementById('brush-size');
    brushSlider.addEventListener('input', (e) => {
        currentBrushSize = parseInt(e.target.value);
    });
    
    document.getElementById('btn-cek-akurasi').addEventListener('click', checkAccuracy);
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    redrawCanvas();
}

function renderGuide(context = ctx, isValidation = false) {
    if (!currentAksara) return;
    if (!isGuideVisible && !isValidation) return;
    
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const fontSize = Math.min(width, height) * 0.75;
    
    context.save();
    context.globalAlpha = isValidation ? 1.0 : 0.12; 
    context.fillStyle = isValidation ? '#000000' : '#8B2E0F';
    context.font = `${fontSize}px 'Noto Serif Javanese', serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(currentAksara.unicode, width / 2, height / 2 + (fontSize * 0.05));
    context.restore();
}

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function startDrawing(e) {
    if (!currentAksara) return;
    document.getElementById('accuracy-result').classList.add('hidden');
    isDrawing = true;
    const pos = getPointerPos(e);
    lastX = pos.x; lastY = pos.y;
    currentStroke = [{x: pos.x, y: pos.y}];
    
    ctx.beginPath();
    ctx.arc(lastX, lastY, currentBrushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1A1510'; 
    ctx.fill();
    ctx.closePath();
}

let pendingDraw = false;
let currentPos = null;

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault(); 
    currentPos = getPointerPos(e);
    
    if (!pendingDraw) {
        pendingDraw = true;
        requestAnimationFrame(() => {
            if (!isDrawing) { pendingDraw = false; return; }
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.strokeStyle = '#1A1510';
            ctx.lineWidth = currentBrushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.closePath();
            
            lastX = currentPos.x; lastY = currentPos.y;
            currentStroke.push({x: lastX, y: lastY});
            pendingDraw = false;
        });
    }
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        if (currentStroke.length > 0) strokes.push([...currentStroke]);
    }
}

function clearCanvas() {
    strokes = []; currentStroke = [];
    document.getElementById('accuracy-result').classList.add('hidden');
    redrawCanvas();
}

function redrawCanvas() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    renderGuide();
    
    strokes.forEach(stroke => {
        if (stroke.length === 0) return;
        if (stroke.length === 1) {
            ctx.beginPath();
            ctx.arc(stroke[0].x, stroke[0].y, currentBrushSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#1A1510';
            ctx.fill();
            ctx.closePath();
            return;
        }
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.strokeStyle = '#1A1510';
        ctx.lineWidth = currentBrushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.closePath();
    });
}

function checkAccuracy() {
    if (!currentAksara || strokes.length === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width * dpr;
    const h = rect.height * dpr;
    
    ctx.clearRect(0, 0, rect.width, rect.height);
    redrawUserStrokesOnly();
    const userImgData = ctx.getImageData(0, 0, w, h).data;
    
    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = w; hiddenCanvas.height = h;
    const hCtx = hiddenCanvas.getContext('2d');
    hCtx.scale(dpr, dpr);
    renderGuide(hCtx, true); 
    
    hCtx.lineWidth = 15; 
    hCtx.strokeStyle = '#000';
    hCtx.strokeText(currentAksara.unicode, rect.width/2, rect.height/2 + (Math.min(rect.width, rect.height)*0.75*0.05));
    
    const guideImgData = hCtx.getImageData(0, 0, w, h).data;
    
    let userPixels = 0;
    let overlapPixels = 0;
    
    for (let i = 3; i < userImgData.length; i += 4) {
        if (userImgData[i] > 100) {
            userPixels++;
            if (guideImgData[i] > 100) overlapPixels++;
        }
    }
    
    redrawCanvas();
    
    let score = 0;
    if (userPixels > 0) score = Math.floor((overlapPixels / userPixels) * 100);
    
    const minPixelsRequired = w * h * 0.01; 
    if (userPixels < minPixelsRequired) score = Math.floor(score * 0.5);
    
    const resultDiv = document.getElementById('accuracy-result');
    resultDiv.classList.remove('hidden');
    resultDiv.className = `accuracy-result neo-card ${score >= 90 ? 'accuracy-success' : 'accuracy-fail'}`;
    
    if (score >= 90) {
        resultDiv.innerHTML = `Akurasi: ${score}% <br> <span style="font-size:0.5em; font-weight:normal">Luar Biasa! +10 XP</span>`;
        addXP(10);
        recoverHeart(); // Latihan memulihkan 1 nyawa
    } else {
        resultDiv.innerHTML = `Akurasi: ${score}% <br> <span style="font-size:0.5em; font-weight:normal">Coba Lagi! ❤️ -1</span>`;
        loseHeart();
    }
}

function redrawUserStrokesOnly() {
    strokes.forEach(stroke => {
        if (stroke.length === 0) return;
        if (stroke.length === 1) {
            ctx.beginPath(); ctx.arc(stroke[0].x, stroke[0].y, currentBrushSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#1A1510'; ctx.fill(); ctx.closePath();
            return;
        }
        ctx.beginPath(); ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.strokeStyle = '#1A1510'; ctx.lineWidth = currentBrushSize;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.closePath();
    });
}

function exportPNG() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    tempCtx.scale(dpr, dpr);
    
    strokes.forEach(stroke => {
        if (stroke.length === 0) return;
        if (stroke.length === 1) {
            tempCtx.beginPath(); tempCtx.arc(stroke[0].x, stroke[0].y, currentBrushSize / 2, 0, Math.PI * 2);
            tempCtx.fillStyle = '#1A1510'; tempCtx.fill(); tempCtx.closePath();
            return;
        }
        tempCtx.beginPath(); tempCtx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) tempCtx.lineTo(stroke[i].x, stroke[i].y);
        tempCtx.strokeStyle = '#1A1510'; tempCtx.lineWidth = currentBrushSize;
        tempCtx.lineCap = 'round'; tempCtx.lineJoin = 'round'; tempCtx.stroke(); tempCtx.closePath();
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
        transliterate(e.target.value.toLowerCase());
    });
}

function transliterate(text) {
    const output = document.getElementById('aksara-output');
    if (!text) { output.textContent = ''; return; }
    
    let result = ''; let i = 0;
    while (i < text.length) {
        if (i + 2 < text.length) {
            const str3 = text.substr(i, 3);
            if (syllabaryMap[str3]) { result += syllabaryMap[str3]; i += 3; continue; }
        }
        if (i + 1 < text.length) {
            const str2 = text.substr(i, 2);
            if (syllabaryMap[str2]) { result += syllabaryMap[str2]; i += 2; continue; }
        }
        result += text[i]; i++;
    }
    output.textContent = result;
}

// ==========================================
// MODUL 4: KUIS INTERAKTIF
// ==========================================
let currentQuizCorrect = null;
let kuisActive = true;

function initKuis() {
    document.getElementById('btn-next-kuis').addEventListener('click', generateQuiz);
}

function generateQuiz() {
    if (gameState.hearts === 0) {
        showNeoModal("Ups!", "Anda kehabisan nyawa! Berlatihlah di menu <strong>Latihan Menulis</strong> dengan akurasi 90% untuk memulihkan nyawa.");
        return;
    }
    
    kuisActive = true;
    const feedback = document.getElementById('kuis-feedback');
    feedback.classList.add('hidden');
    feedback.className = 'kuis-feedback neo-card hidden';
    
    // Hanya kuis aksara yang sudah di-unlock (berdasarkan Gatra yang sudah terbuka)
    const availableAksara = aksaraData.filter(item => item.gatra <= gameState.unlockedGatra);
    
    const correctIdx = Math.floor(Math.random() * availableAksara.length);
    currentQuizCorrect = availableAksara[correctIdx];
    
    document.querySelector('.kuis-aksara').textContent = currentQuizCorrect.unicode;
    
    let options = [currentQuizCorrect];
    while(options.length < 4) {
        const randIdx = Math.floor(Math.random() * availableAksara.length);
        const item = availableAksara[randIdx];
        if(!options.includes(item)) options.push(item);
    }
    options.sort(() => Math.random() - 0.5);
    
    const optionsContainer = document.getElementById('kuis-options');
    optionsContainer.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn kuis-option-btn';
        btn.textContent = opt.latin;
        
        btn.addEventListener('click', () => {
            if(!kuisActive) return; // cegah klik double setelah terjawab
            kuisActive = false;
            
            feedback.classList.remove('hidden');
            if(opt.id === currentQuizCorrect.id) {
                feedback.innerHTML = `Benar! <strong>${currentQuizCorrect.latin}</strong> <br><small>💎 +15 XP</small>`;
                feedback.classList.add('accuracy-success');
                feedback.classList.remove('accuracy-fail');
                addXP(15);
            } else {
                feedback.innerHTML = `Salah! Jawaban yang benar adalah <strong>${currentQuizCorrect.latin}</strong> <br><small>❤️ -1 Nyawa</small>`;
                feedback.classList.add('accuracy-fail');
                feedback.classList.remove('accuracy-success');
                loseHeart();
            }
        });
        
        optionsContainer.appendChild(btn);
    });
}

// ==========================================
// MODUL: KAMUS (Penerjemah Indonesia - Jawa Ngoko)
// ==========================================
function translateToNgoko(text) {
    if (!text.trim()) return '';

    // Build sorted keys (longest first) for multi-word matching
    const keys = Object.keys(kamusData).sort((a, b) => b.length - a.length);

    // Tokenize preserving whitespace and punctuation
    const tokens = text.split(/([ \t\n,.!?;:"'()\[\]{}]+)/);
    const resultParts = [];
    let translated = 0, untranslated = 0;

    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];
        if (/^[ \t\n,.!?;:"'()\[\]{}]+$/.test(token)) {
            resultParts.push(token);
            i++;
            continue;
        }

        // Try multi-word phrases first (up to 3 words)
        let matched = false;
        for (let wordCount = 3; wordCount >= 1; wordCount--) {
            // Collect wordCount non-separator tokens
            let phrase = '';
            let tokenIndices = [];
            let j = i;
            let words = 0;
            while (j < tokens.length && words < wordCount) {
                if (/^[ \t\n,.!?;:"'()\[\]{}]+$/.test(tokens[j])) {
                    phrase += tokens[j];
                } else {
                    phrase += tokens[j];
                    words++;
                }
                tokenIndices.push(j);
                j++;
            }
            if (words < wordCount) break;

            const phraseKey = phrase.trim().toLowerCase();
            if (kamusData[phraseKey]) {
                const ngoko = kamusData[phraseKey];
                resultParts.push(`<span class="kamus-word-translated" title="${phraseKey}">${ngoko}</span>`);
                translated++;
                i = j;
                matched = true;
                break;
            }
        }

        if (!matched) {
            const wordKey = token.toLowerCase();
            if (kamusData[wordKey]) {
                resultParts.push(`<span class="kamus-word-translated" title="${wordKey}">${kamusData[wordKey]}</span>`);
                translated++;
            } else {
                resultParts.push(`<span class="kamus-word-unknown" title="Kata tidak ditemukan">${token}</span>`);
                untranslated++;
            }
            i++;
        }
    }

    return { html: resultParts.join(''), translated, untranslated };
}

const QUICK_REF = [
    { indo: 'Selamat pagi', ngoko: 'Sugeng enjing' },
    { indo: 'Terima kasih', ngoko: 'Matur nuwun' },
    { indo: 'Maaf', ngoko: 'Ngapunten' },
    { indo: 'Saya pergi', ngoko: 'Aku lunga' },
    { indo: 'Saya makan', ngoko: 'Aku mangan' },
    { indo: 'Di mana rumah?', ngoko: 'Ing endi omah?' },
    { indo: 'Apa kabar?', ngoko: 'Piye kabare?' },
    { indo: 'Saya tidak tahu', ngoko: 'Aku ora ngerti' },
    { indo: 'Sampai jumpa', ngoko: 'Sugeng tindak' },
    { indo: 'Saya lapar', ngoko: 'Aku luwe' },
    { indo: 'Air minum', ngoko: 'Banyu omben' },
    { indo: 'Rumah besar', ngoko: 'Omah gedhe' },
];

function initKamus() {
    const input = document.getElementById('kamus-input');
    const output = document.getElementById('kamus-output');
    const stats = document.getElementById('kamus-stats');
    const btnClear = document.getElementById('btn-kamus-clear');

    // Quick Reference render
    const qGrid = document.getElementById('quick-ref-grid');
    if (qGrid) {
        QUICK_REF.forEach(item => {
            const div = document.createElement('div');
            div.className = 'quick-ref-item';
            div.innerHTML = `<span class="quick-ref-indo">${item.indo}</span><span class="quick-ref-ngoko">${item.ngoko}</span>`;
            div.addEventListener('click', () => {
                input.value = item.indo;
                input.dispatchEvent(new Event('input'));
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            qGrid.appendChild(div);
        });
    }

    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const text = input.value;
            if (!text.trim()) {
                output.innerHTML = '';
                stats.textContent = '';
                return;
            }
            const result = translateToNgoko(text);
            output.innerHTML = result.html;
            const total = result.translated + result.untranslated;
            const pct = total > 0 ? Math.round((result.translated / total) * 100) : 0;
            stats.textContent = `✅ ${result.translated} kata diterjemahkan · ❓ ${result.untranslated} tidak ditemukan · Akurasi ~${pct}%`;
        }, 250);
    });

    btnClear.addEventListener('click', () => {
        input.value = '';
        output.innerHTML = '';
        stats.textContent = '';
        input.focus();
    });
}

// ==========================================
// MODUL: BUDAYA JAWA
// ==========================================
const BUDAYA_DATA = [
    {
        id: 'gamelan', kategori: 'musik', icon: '🥁', warna: '#FFF3CD',
        nama: 'Gamelan',
        deskripsi: 'Orkestra tradisional Jawa yang terdiri dari alat musik pukul seperti gong, kenong, saron, bonang, dan kendang. Gamelan adalah jiwa dari kebudayaan Jawa.',
        fakta: ['Abad ke-8', 'UNESCO 2021', 'Ratusan instrumen'],
        detail: '<p><strong>Gamelan</strong> adalah ansambel musik yang berasal dari budaya Jawa, Bali, dan Sunda. Kata "gamelan" berasal dari bahasa Jawa, <em>gamel</em>, yang berarti "memukul".</p><p>Gamelan Jawa didominasi oleh nada-nada yang lebih lembut dan meditatif dibanding Gamelan Bali. Ada dua tangga nada utama: <strong>Pelog</strong> (7 nada) dan <strong>Slendro</strong> (5 nada).</p><ul><li><strong>Gong</strong>: Penanda akhir gatra (frase) terbesar</li><li><strong>Saron</strong>: Melodi utama dari bilah logam</li><li><strong>Kendang</strong>: Pengatur tempo dan ritme</li><li><strong>Bonang</strong>: Melodi ornamental dari gong kecil</li><li><strong>Gender</strong>: Instrumen melodi dengan resonator bambu</li></ul><p>Pada tahun 2021, UNESCO menetapkan Gamelan sebagai Warisan Budaya Tak Benda Kemanusiaan.</p>'
    },
    {
        id: 'wayang', kategori: 'seni', icon: '🎭', warna: '#FFE0B2',
        nama: 'Wayang Kulit',
        deskripsi: 'Seni pertunjukan bayangan menggunakan boneka dari kulit kerbau yang diukir halus. Dimainkan oleh dalang yang juga menjadi narator dan penggerak wayang.',
        fakta: ['Kulit kerbau', 'UNESCO 2003', 'Semalam suntuk'],
        detail: '<p><strong>Wayang Kulit</strong> adalah seni teater bayangan tertua di dunia yang masih berkembang. UNESCO mengakuinya sebagai Masterpiece of the Oral and Intangible Heritage of Humanity pada 2003.</p><p>Lakon yang dimainkan umumnya bersumber dari epik Mahabharata dan Ramayana, yang diadaptasi ke dalam konteks budaya Jawa. Tokoh utama dalam wayang Jawa antara lain:</p><ul><li><strong>Pandawa Lima</strong>: Penjelmaan dharma dan kebenaran</li><li><strong>Punakawan</strong>: Semar, Gareng, Petruk, Bagong — penasehat bijak berbentuk lawak</li><li><strong>Kurawa</strong>: Simbol keserakahan dan kejahatan</li></ul><p>Seorang <strong>dalang</strong> menjadi sutradara, aktor, dan narator sekaligus — bisa memainkan semalam suntuk (8–9 jam) seorang diri dibantu gamelan.</p>'
    },
    {
        id: 'batik', kategori: 'seni', icon: '🎨', warna: '#E8F5E9',
        nama: 'Batik Jawa',
        deskripsi: 'Seni melukis kain menggunakan lilin panas (malam) dan pewarna alami. Setiap motif batik menyimpan filosofi dan makna mendalam tentang kehidupan.',
        fakta: ['Canting & malam', 'UNESCO 2009', '1000+ motif'],
        detail: '<p><strong>Batik</strong> adalah teknik pewarnaan kain dengan menggunakan malam (lilin panas) sebagai perintang warna. Kata batik berasal dari Jawa: <em>amba</em> (menulis) dan <em>titik</em>.</p><p>Batik Jawa dibagi menjadi dua gaya utama:</p><ul><li><strong>Batik Kraton</strong>: Motif seperti Parang, Kawung, Sido Mukti — hanya boleh dikenakan bangsawan</li><li><strong>Batik Pesisir</strong>: Motif bebas, warna cerah, pengaruh Tionghoa dan Arab</li></ul><p>Motif batik yang terkenal:</p><ul><li><strong>Parang Rusak</strong>: Simbol kekuatan dan keberanian, milik raja</li><li><strong>Kawung</strong>: Empat lingkaran = empat arah mata angin, simbol keseimbangan</li><li><strong>Mega Mendung</strong>: Dari Cirebon, motif awan bertingkat</li></ul><p>UNESCO menetapkan Batik Indonesia sebagai Warisan Budaya Tak Benda pada 2009.</p>'
    },
    {
        id: 'bedhaya', kategori: 'tari', icon: '💃', warna: '#F3E5F5',
        nama: 'Tari Bedhaya',
        deskripsi: 'Tari sakral keraton yang ditarikan oleh 9 penari putri. Melambangkan persatuan antara manusia, alam semesta, dan Sang Pencipta.',
        fakta: ['9 penari', 'Sakral Keraton', 'Filosofi tinggi'],
        detail: '<p><strong>Bedhaya</strong> adalah tarian paling sakral di keraton Jawa (Yogyakarta dan Surakarta). Jumlah 9 penari melambangkan wali sanga (sembilan wali) atau sembilan lubang pada tubuh manusia.</p><p>Tarian ini bergerak sangat lambat dan meditatif — penonton perlu pemahaman khusus untuk menangkap makna di setiap gerakannya. Musik pengiringnya adalah Gamelan dengan tembang Jawa.</p><ul><li><strong>Bedhaya Ketawang</strong>: Tarian paling sakral di Kasunanan Surakarta, hanya ditampilkan saat peringatan tahta raja</li><li><strong>Busana</strong>: Kain batik Dodot, mahkota, dan riasan tebal khas</li><li><strong>Durasi</strong>: Bisa mencapai 2–3 jam</li></ul><p>Gerakan tangan (mudra) dan posisi tubuh dalam Bedhaya mengandung simbolisme kosmik yang sangat dalam.</p>'
    },
    {
        id: 'serimpi', kategori: 'tari', icon: '🌸', warna: '#FCE4EC',
        nama: 'Tari Serimpi',
        deskripsi: 'Tari putri keraton yang ditarikan oleh 4 penari, mewakili empat unsur alam: api, air, angin, dan tanah. Gerakannya lembut dan penuh keanggunan.',
        fakta: ['4 penari', 'Unsur alam', 'Keraton Yogya'],
        detail: '<p><strong>Serimpi</strong> adalah tarian sakral keraton Yogyakarta yang melibatkan 4 penari putri. Angka empat merepresentasikan empat arah angin, empat elemen alam, dan empat sifat manusia.</p><ul><li><strong>Grama</strong>: Api — semangat dan tekad</li><li><strong>Toya</strong>: Air — keluwesan dan adaptasi</li><li><strong>Angin</strong>: Udara — kebebasan pikiran</li><li><strong>Bumi</strong>: Tanah — keteguhan hati</li></ul><p>Gerakan Serimpi sangat halus dan lambat, mengikuti filosofi Jawa tentang <em>alon-alon waton kelakon</em> (pelan namun pasti tercapai). Kostumnya berupa kain batik parang, kemben, dan hiasan kepala khas keraton.</p>'
    },
    {
        id: 'keris', kategori: 'seni', icon: '⚔️', warna: '#E3F2FD',
        nama: 'Keris',
        deskripsi: 'Senjata pusaka berbilah asimetris dengan pamor unik. Lebih dari senjata, keris adalah karya seni, benda spiritual, dan simbol status sosial.',
        fakta: ['UNESCO 2005', 'Pamor baja', '11 luk (lekukan)'],
        detail: '<p><strong>Keris</strong> adalah senjata tikam khas Nusantara dengan bilah asimetris berlekuk (luk) yang khas. UNESCO mengakuinya sebagai Warisan Budaya Tak Benda pada 2005.</p><p>Keris bukan sekadar senjata — ia adalah:</p><ul><li><strong>Simbol status</strong>: Jumlah luk dan jenis pamor menunjukkan derajat sosial</li><li><strong>Benda spiritual</strong>: Dipercaya memiliki kekuatan magis penjaga</li><li><strong>Karya seni tinggi</strong>: Proses pembuatan bisa berbulan-bulan oleh Empu (pandai keris)</li></ul><p>Bagian-bagian keris:</p><ul><li><strong>Wilah</strong>: Bilah besi/baja berlapis pamor (meteorit/nikel)</li><li><strong>Ganja</strong>: Pangkal bilah yang melindungi tangan</li><li><strong>Hulu</strong>: Gagang keris dari kayu atau gading</li><li><strong>Warangka</strong>: Sarung keris dari kayu timoho</li></ul>'
    },
    {
        id: 'reog', kategori: 'seni', icon: '🦁', warna: '#FFF9C4',
        nama: 'Reog Ponorogo',
        deskripsi: 'Seni pertunjukan spektakuler dari Ponorogo, Jawa Timur. Penampilan utamanya adalah topeng Dadak Merak — singa berkepala merak berbobot 40–50 kg.',
        fakta: ['Ponorogo', '40-50 kg topeng', 'Bulu merak asli'],
        detail: '<p><strong>Reog Ponorogo</strong> adalah kesenian rakyat dari Kabupaten Ponorogo, Jawa Timur, yang terkenal dengan topeng Dadak Merak yang sangat besar dan berat.</p><p>Tokoh utama dalam pertunjukan Reog:</p><ul><li><strong>Singo Barong</strong>: Penari yang membawa topeng kepala singa bertutup merak seberat 40-50 kg dengan rahangnya saja</li><li><strong>Warok</strong>: Pria berbusana hitam, simbol kekuatan spiritual dan moral</li><li><strong>Jathil</strong>: Prajurit berkuda, kini ditarikan oleh wanita</li><li><strong>Klono Sewandono</strong>: Raja yang jatuh cinta</li></ul><p>Reog bukan sekadar hiburan — ia adalah ekspresi kebanggaan, kekuatan, dan identitas masyarakat Ponorogo yang diwariskan turun-temurun.</p>'
    },
    {
        id: 'javanophilosophy', kategori: 'filosofi', icon: '📜', warna: '#E8EAF6',
        nama: 'Filosofi Jawa',
        deskripsi: 'Kearifan lokal Jawa mencakup konsep Hamemayu Hayuning Bawana (menjaga keindahan dunia), Manunggaling Kawula Gusti, dan Memayu Hayuning Urip.',
        fakta: ['Hamemayu', 'Sangkan Paran', 'Alon-alon'],
        detail: '<p>Orang Jawa memiliki kekayaan filsafat hidup yang mendalam. Beberapa prinsip utama:</p><ul><li><strong>Hamemayu Hayuning Bawana</strong>: Manusia berkewajiban menjaga keselamatan dan keindahan dunia — konsep ramah lingkungan asli Jawa</li><li><strong>Manunggaling Kawula Gusti</strong>: Penyatuan manusia dengan Tuhan — spiritualitas tertinggi dalam tasawuf Jawa</li><li><strong>Nrimo ing Pandum</strong>: Menerima dengan ikhlas apa yang diberikan — bukan pasrah, tapi ketenangan batin</li><li><strong>Alon-alon waton kelakon</strong>: Pelan tapi pasti — mendahulukan kualitas daripada kecepatan</li><li><strong>Tepa slira</strong>: Empati dan tenggang rasa — merasakan perasaan orang lain</li><li><strong>Sangkan Paraning Dumadi</strong>: Kesadaran asal-usul dan tujuan hidup manusia</li></ul><p>Filosofi ini tercermin dalam seni, ritual, arsitektur, dan cara hidup masyarakat Jawa sehari-hari.</p>'
    },
    {
        id: 'tembang', kategori: 'musik', icon: '🎶', warna: '#E0F7FA',
        nama: 'Tembang Macapat',
        deskripsi: 'Puisi musikal Jawa dengan aturan guru gatra (baris), guru wilangan (suku kata), dan guru lagu (vokal akhir). Setiap jenis tembang memiliki makna dan suasana berbeda.',
        fakta: ['11 jenis', 'Filsafat hidup', 'Gamelan'],
        detail: '<p><strong>Macapat</strong> adalah bentuk puisi Jawa yang dinyanyikan dengan aturan ketat. Terdapat 11 jenis tembang, masing-masing melambangkan fase kehidupan manusia:</p><ul><li><strong>Maskumambang</strong>: Bayi dalam kandungan — melankolis, sendu</li><li><strong>Mijil</strong>: Kelahiran — harapan dan semangat</li><li><strong>Sinom</strong>: Masa muda — ceria dan dinamis</li><li><strong>Asmarandana</strong>: Jatuh cinta — romantis dan penuh perasaan</li><li><strong>Gambuh</strong>: Pernikahan dan kedewasaan</li><li><strong>Dhandhanggula</strong>: Puncak kejayaan — indah dan optimis</li><li><strong>Durma</strong>: Amarah dan perjuangan</li><li><strong>Pangkur</strong>: Masa tua — nasihat bijak</li><li><strong>Megatruh</strong>: Menjelang kematian — pelepasan</li><li><strong>Pocung</strong>: Kematian — teka-teki filosofis</li></ul><p>Setiap tembang memiliki aturan <em>guru gatra</em> (jumlah baris), <em>guru wilangan</em> (jumlah suku kata), dan <em>guru lagu</em> (vokal akhir baris).</p>'
    },
];

let activeBudayaTab = 'semua';

function renderBudayaGrid(filter) {
    const grid = document.getElementById('budaya-grid');
    grid.innerHTML = '';
    const filtered = filter === 'semua' ? BUDAYA_DATA : BUDAYA_DATA.filter(b => b.kategori === filter);
    
    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'budaya-card';
        const tagColors = { musik: '#E3F2FD', tari: '#FCE4EC', seni: '#FFF9C4', filosofi: '#E8EAF6' };
        card.innerHTML = `
            <div class="budaya-card-icon" style="background:${item.warna}">${item.icon}</div>
            <div class="budaya-card-body">
                <span class="budaya-card-tag" style="background:${tagColors[item.kategori] || '#eee'}">${item.kategori}</span>
                <div class="budaya-card-title">${item.nama}</div>
                <p class="budaya-card-desc">${item.deskripsi}</p>
                <div class="budaya-card-facts">${item.fakta.map(f => `<span class="budaya-fact-chip">${f}</span>`).join('')}</div>
            </div>`;
        card.addEventListener('click', () => openBudayaDetail(item));
        grid.appendChild(card);
    });
}

function openBudayaDetail(item) {
    // Remove existing overlay
    const existing = document.getElementById('budaya-detail-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'budaya-detail-overlay';
    overlay.id = 'budaya-detail-overlay';
    overlay.innerHTML = `
        <div class="budaya-detail-card">
            <div class="budaya-detail-header" style="background:${item.warna}">
                <div class="budaya-detail-icon">${item.icon}</div>
                <div>
                    <div style="font-size:0.8rem; text-transform:uppercase; font-weight:700; letter-spacing:0.08em; opacity:0.7;">${item.kategori}</div>
                    <h3 style="font-size:1.6rem; margin:4px 0;">${item.nama}</h3>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">${item.fakta.map(f => `<span class="budaya-fact-chip">${f}</span>`).join('')}</div>
                </div>
            </div>
            <div class="budaya-detail-body">${item.detail}</div>
            <div style="padding: 0 24px 24px;">
                <button class="btn btn-primary budaya-detail-close" id="btn-close-budaya">Tutup</button>
            </div>
        </div>`;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    
    document.getElementById('btn-close-budaya').addEventListener('click', () => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 200);
        }
    });
}

function initBudaya() {
    renderBudayaGrid('semua');
    document.querySelectorAll('.budaya-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.budaya-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeBudayaTab = btn.dataset.tab;
            renderBudayaGrid(activeBudayaTab);
        });
    });
}

document.addEventListener('DOMContentLoaded', init);
