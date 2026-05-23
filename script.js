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
            if (words < wordCount) continue;

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
    { indo: 'Apa kabar?', ngoko: 'Piye kabare?' },
    { indo: 'Terima kasih', ngoko: 'Matur nuwun' },
    { indo: 'Maaf', ngoko: 'Ngapuro' },
    { indo: 'Saya pergi', ngoko: 'Aku lungo' },
    { indo: 'Saya makan', ngoko: 'Aku mangan' },
    { indo: 'Di mana rumah?', ngoko: 'Neng endi omah?' },
    { indo: 'Tidak apa-apa', ngoko: 'Ora opo-opo' },
    { indo: 'Saya tidak tahu', ngoko: 'Aku ora reti' },
    { indo: 'Sampai jumpa', ngoko: 'Dadah' },
    { indo: 'Saya lapar', ngoko: 'Aku luwe' },
    { indo: 'Sebentar dulu', ngoko: 'Sek sek...' },
    { indo: 'Sudah habis', ngoko: 'Wis entek' },
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

// Realistic hand-drawn SVG icons (not emoji)
const BUDAYA_SVG = {
    gamelan: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <defs>
            <linearGradient id="gongGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFE082" />
                <stop offset="30%" stop-color="#FFB300" />
                <stop offset="70%" stop-color="#FF8F00" />
                <stop offset="100%" stop-color="#8D6E63" />
            </linearGradient>
            <linearGradient id="gongWood" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#5D4037" />
                <stop offset="50%" stop-color="#8D6E63" />
                <stop offset="100%" stop-color="#3E2723" />
            </linearGradient>
            <radialGradient id="gongCenter" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#FFF9C4" />
                <stop offset="50%" stop-color="#FFB300" />
                <stop offset="100%" stop-color="#FF6F00" />
            </radialGradient>
        </defs>
        <path d="M15 85 L20 85 L25 15 L75 15 L80 85 L85 85" stroke="#1A1510" stroke-width="3" fill="none" stroke-linecap="round"/>
        <rect x="8" y="80" width="16" height="8" rx="2" fill="url(#gongWood)" stroke="#1A1510" stroke-width="2"/>
        <rect x="76" y="80" width="16" height="8" rx="2" fill="url(#gongWood)" stroke="#1A1510" stroke-width="2"/>
        <rect x="18" y="10" width="64" height="10" rx="3" fill="url(#gongWood)" stroke="#1A1510" stroke-width="2.5"/>
        <path d="M22 15 Q30 8 40 15 T58 15 T78 15" stroke="#FFB300" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <circle cx="50" cy="15" r="3" fill="#FF8F00" stroke="#1A1510" stroke-width="1"/>
        <line x1="38" y1="20" x2="38" y2="35" stroke="#1A1510" stroke-width="2"/>
        <line x1="62" y1="20" x2="62" y2="35" stroke="#1A1510" stroke-width="2"/>
        <circle cx="50" cy="50" r="24" fill="url(#gongGold)" stroke="#1A1510" stroke-width="2.5"/>
        <circle cx="50" cy="50" r="16" fill="none" stroke="#8D6E63" stroke-width="1.5" stroke-dasharray="3,2"/>
        <circle cx="50" cy="50" r="10" fill="none" stroke="#FF6F00" stroke-width="2"/>
        <circle cx="50" cy="50" r="5" fill="url(#gongCenter)" stroke="#1A1510" stroke-width="1.5"/>
        <line x1="72" y1="75" x2="88" y2="60" stroke="#1A1510" stroke-width="2.5"/>
        <circle cx="88" cy="60" r="4.5" fill="#D32F2F" stroke="#1A1510" stroke-width="1.5"/>
    </svg>`,
    wayang: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <defs>
            <linearGradient id="wayangGold" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="#5D4037" />
                <stop offset="40%" stop-color="#D4AF37" />
                <stop offset="80%" stop-color="#F3E5AB" />
                <stop offset="100%" stop-color="#FFE082" />
            </linearGradient>
        </defs>
        <line x1="50" y1="45" x2="50" y2="95" stroke="#3E2723" stroke-width="3" stroke-linecap="round"/>
        <path d="M49 85 L51 85 L50 95 Z" fill="#5D4037" />
        <path d="M50 8 C40 25 22 45 22 68 C22 75 32 78 50 78 C68 78 78 75 78 68 C78 45 60 25 50 8 Z" fill="url(#wayangGold)" stroke="#1A1510" stroke-width="2.5"/>
        <path d="M50 78 L50 40" stroke="#1A1510" stroke-width="2" stroke-linecap="round"/>
        <path d="M50 50 Q35 40 32 45 Q40 55 50 58" fill="none" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M50 45 Q65 35 68 40 Q60 50 50 53" fill="none" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M50 35 Q30 25 28 32 Q42 42 50 40" fill="none" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M50 30 Q70 20 72 27 Q58 37 50 35" fill="none" stroke="#1A1510" stroke-width="1.5"/>
        <rect x="38" y="60" width="24" height="18" fill="#5D4037" stroke="#1A1510" stroke-width="1.5" rx="1"/>
        <path d="M38 60 L50 48 L62 60 Z" fill="#D4AF37" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M45 68 L45 78 M55 68 L55 78" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M50 64 A5 5 0 0 0 45 69 L55 69 A5 5 0 0 0 50 64 Z" fill="#FFE082" stroke="#1A1510" stroke-width="1"/>
        <path d="M30 65 C26 58 24 60 22 68 C24 67 28 66 30 65 Z" fill="#5D4037" stroke="#1A1510" stroke-width="1"/>
        <path d="M70 65 C74 58 76 60 78 68 C76 67 72 66 70 65 Z" fill="#5D4037" stroke="#1A1510" stroke-width="1"/>
      </svg>`,
    batik: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <defs>
            <linearGradient id="batikGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#F3E5AB" />
                <stop offset="50%" stop-color="#D4AF37" />
                <stop offset="100%" stop-color="#8D6E63" />
            </linearGradient>
            <linearGradient id="batikIndigo" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#1A237E" />
                <stop offset="100%" stop-color="#0D1B2A" />
            </linearGradient>
        </defs>
        <rect x="8" y="8" width="84" height="84" rx="4" fill="url(#batikIndigo)" stroke="#1A1510" stroke-width="3"/>
        <g stroke="url(#batikGold)" stroke-width="1.5" fill="none">
            <path d="M50 50 C40 32 60 32 50 50 Z" fill="url(#batikGold)" fill-opacity="0.25" stroke-width="2"/>
            <path d="M50 50 C40 68 60 68 50 50 Z" fill="url(#batikGold)" fill-opacity="0.25" stroke-width="2"/>
            <path d="M50 50 C32 40 32 60 50 50 Z" fill="url(#batikGold)" fill-opacity="0.25" stroke-width="2"/>
            <path d="M50 50 C68 40 68 60 50 50 Z" fill="url(#batikGold)" fill-opacity="0.25" stroke-width="2"/>
            <circle cx="50" cy="38" r="1.5" fill="url(#batikGold)"/>
            <circle cx="50" cy="62" r="1.5" fill="url(#batikGold)"/>
            <circle cx="38" cy="50" r="1.5" fill="url(#batikGold)"/>
            <circle cx="62" cy="50" r="1.5" fill="url(#batikGold)"/>
            <path d="M22 22 C14 8 30 8 22 22 Z" fill-opacity="0.1"/>
            <path d="M22 22 C14 36 30 36 22 22 Z" fill-opacity="0.1"/>
            <path d="M22 22 C8 14 8 30 22 22 Z" fill-opacity="0.1"/>
            <path d="M22 22 C36 14 36 30 22 22 Z" fill-opacity="0.1"/>
            <path d="M78 22 C70 8 86 8 78 22 Z" fill-opacity="0.1"/>
            <path d="M78 22 C70 36 86 36 78 22 Z" fill-opacity="0.1"/>
            <path d="M78 22 C64 14 64 30 78 22 Z" fill-opacity="0.1"/>
            <path d="M78 22 C92 14 92 30 78 22 Z" fill-opacity="0.1"/>
            <path d="M22 78 C14 64 30 64 22 78 Z" fill-opacity="0.1"/>
            <path d="M22 78 C14 92 30 92 22 78 Z" fill-opacity="0.1"/>
            <path d="M22 78 C8 70 8 86 22 78 Z" fill-opacity="0.1"/>
            <path d="M22 78 C36 70 36 86 22 78 Z" fill-opacity="0.1"/>
            <path d="M78 78 C70 64 86 64 78 78 Z" fill-opacity="0.1"/>
            <path d="M78 78 C70 92 86 92 78 78 Z" fill-opacity="0.1"/>
            <path d="M78 78 C64 70 64 86 78 78 Z" fill-opacity="0.1"/>
            <path d="M78 78 C92 70 92 86 78 78 Z" fill-opacity="0.1"/>
            <line x1="15" y1="50" x2="85" y2="50" stroke-dasharray="2,3" stroke-width="1"/>
            <line x1="50" y1="15" x2="50" y2="85" stroke-dasharray="2,3" stroke-width="1"/>
        </g>
        <circle cx="50" cy="50" r="3" fill="#D32F2F" stroke="#1A1510" stroke-width="1"/>
        <circle cx="22" cy="22" r="2" fill="#D32F2F" stroke="#1A1510" stroke-width="1"/>
        <circle cx="78" cy="22" r="2" fill="#D32F2F" stroke="#1A1510" stroke-width="1"/>
        <circle cx="22" cy="78" r="2" fill="#D32F2F" stroke="#1A1510" stroke-width="1"/>
        <circle cx="78" cy="78" r="2" fill="#D32F2F" stroke="#1A1510" stroke-width="1"/>
      </svg>`,
    bedhaya: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <defs>
            <linearGradient id="danceGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFE082" />
                <stop offset="50%" stop-color="#FFD54F" />
                <stop offset="100%" stop-color="#B8860B" />
            </linearGradient>
            <linearGradient id="shawlPurple" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#8E24AA" />
                <stop offset="50%" stop-color="#D81B60" />
                <stop offset="100%" stop-color="#4A148C" />
            </linearGradient>
        </defs>
        <circle cx="50" cy="20" r="6" fill="#F5CBA7" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M47 14 Q53 11 55 17 Q58 20 54 23 Z" fill="#1A1510"/>
        <path d="M45 17 Q50 12 55 17" stroke="url(#danceGold)" stroke-width="2" fill="none"/>
        <circle cx="50" cy="12" r="1.5" fill="#D32F2F"/>
        <path d="M46 26 L54 26 L56 42 L44 42 Z" fill="#FFB300" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M44 26 Q50 28 56 26" fill="none" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M47 20 L47 26 M53 20 L53 26" stroke="#1A1510" stroke-width="1"/>
        <path d="M44 28 C35 30 30 38 22 36 C20 35 21 33 24 33 C32 34 38 27 44 26" fill="none" stroke="#1A1510" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M56 28 C65 30 70 38 78 36 C80 35 79 33 76 33 C68 34 62 27 56 26" fill="none" stroke="#1A1510" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="43" cy="21" r="1" fill="#FFD54F" stroke="#1A1510" stroke-width="0.5"/>
        <circle cx="57" cy="21" r="1" fill="#FFD54F" stroke="#1A1510" stroke-width="0.5"/>
        <path d="M36 32 Q25 40 28 55 Q30 68 45 70" fill="none" stroke="url(#shawlPurple)" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M64 32 Q75 40 72 55 Q70 68 55 70" fill="none" stroke="url(#shawlPurple)" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M44 42 Q32 60 30 85 L70 85 Q68 60 56 42 Z" fill="url(#danceGold)" stroke="#1A1510" stroke-width="2"/>
        <path d="M30 85 C30 88 70 88 70 85 Z" fill="#B8860B" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M46 44 L36 82" stroke="#5D4037" stroke-width="1" stroke-dasharray="2,3"/>
        <path d="M50 44 L44 82" stroke="#5D4037" stroke-width="1" stroke-dasharray="2,3"/>
        <path d="M54 44 L52 82" stroke="#5D4037" stroke-width="1" stroke-dasharray="2,3"/>
      </svg>`,
    serimpi: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <defs>
            <linearGradient id="danceGold2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFF59D" />
                <stop offset="50%" stop-color="#FFD54F" />
                <stop offset="100%" stop-color="#B8860B" />
            </linearGradient>
            <linearGradient id="shawlRed" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#E91E63" />
                <stop offset="50%" stop-color="#FF4081" />
                <stop offset="100%" stop-color="#C2185B" />
            </linearGradient>
        </defs>
        <circle cx="50" cy="20" r="6" fill="#F5CBA7" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M47 14 Q53 11 55 17 Q58 20 54 23 Z" fill="#1A1510"/>
        <path d="M45 17 Q50 12 55 17" stroke="url(#danceGold2)" stroke-width="2" fill="none"/>
        <circle cx="50" cy="12" r="1.5" fill="#FF4081"/>
        <path d="M46 26 L54 26 L56 42 L44 42 Z" fill="#E91E63" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M44 26 Q50 28 56 26" fill="none" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M44 27 C38 32 36 44 32 46 C30 47 30 45 32 43 C35 41 38 32 44 27" fill="none" stroke="#1A1510" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M56 27 C64 30 68 35 74 44 C75 45 74 47 72 45 C67 38 62 32 56 27" fill="none" stroke="#1A1510" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="43" cy="21" r="1" fill="#FFD54F" stroke="#1A1510" stroke-width="0.5"/>
        <circle cx="57" cy="21" r="1" fill="#FFD54F" stroke="#1A1510" stroke-width="0.5"/>
        <path d="M38 32 Q25 45 30 65 Q33 72 48 70" fill="none" stroke="url(#shawlRed)" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M62 32 Q75 45 70 65 Q67 72 52 70" fill="none" stroke="url(#shawlRed)" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M44 42 Q32 60 30 85 L70 85 Q68 60 56 42 Z" fill="url(#danceGold2)" stroke="#1A1510" stroke-width="2"/>
        <path d="M30 85 C30 88 70 88 70 85 Z" fill="#B8860B" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M46 44 L36 82" stroke="#5D4037" stroke-width="1" stroke-dasharray="2,3"/>
        <path d="M50 44 L44 82" stroke="#5D4037" stroke-width="1" stroke-dasharray="2,3"/>
        <path d="M54 44 L52 82" stroke="#5D4037" stroke-width="1" stroke-dasharray="2,3"/>
      </svg>`,
    keris: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <defs>
            <linearGradient id="kerisIron" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ECEFF1" />
                <stop offset="50%" stop-color="#90A4AE" />
                <stop offset="100%" stop-color="#37474F" />
            </linearGradient>
            <linearGradient id="kerisGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFE082" />
                <stop offset="50%" stop-color="#FFB300" />
                <stop offset="100%" stop-color="#8D6E63" />
            </linearGradient>
            <linearGradient id="kerisWood" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#8D6E63" />
                <stop offset="100%" stop-color="#3E2723" />
            </linearGradient>
        </defs>
        <path d="M60 45 L50 90 L40 90 L45 45 Z" fill="url(#kerisWood)" stroke="#1A1510" stroke-width="2"/>
        <path d="M35 45 C35 38 65 38 65 45 Z" fill="url(#kerisGold)" stroke="#1A1510" stroke-width="2"/>
        <g transform="translate(10, -5)">
            <path d="M40 70 Q36 62 40 54 Q44 46 40 38 Q36 30 40 22 Q44 14 40 8 L43 8 Q48 14 44 22 Q40 30 44 38 Q48 46 44 54 Q40 62 45 70 Z" fill="url(#kerisIron)" stroke="#1A1510" stroke-width="1.8"/>
            <path d="M41 68 Q38 62 41 54 Q44 46 41 38 Q38 30 41 22 Q44 14 41 9" fill="none" stroke="#FFFFFF" stroke-width="0.8" opacity="0.8"/>
            <path d="M42 66 Q39 62 42 54 Q45 46 42 38 Q39 30 42 22" fill="none" stroke="#CFD8DC" stroke-width="0.5" opacity="0.6"/>
            <path d="M32 70 C32 68 53 68 53 70 C53 72 32 72 32 70 Z" fill="url(#kerisGold)" stroke="#1A1510" stroke-width="1.8"/>
            <path d="M40 72 Q37 77 42 84 Q45 88 40 92 L35 90 Q38 84 35 77 Z" fill="url(#kerisWood)" stroke="#1A1510" stroke-width="1.8"/>
            <ellipse cx="38" cy="73" rx="3.5" ry="1.5" fill="url(#kerisGold)" stroke="#1A1510" stroke-width="1"/>
        </g>
      </svg>`,
    reog: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <defs>
            <linearGradient id="reogRed" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#E74C3C" />
                <stop offset="100%" stop-color="#C0392B" />
            </linearGradient>
            <linearGradient id="reogYellow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#F1C40F" />
                <stop offset="100%" stop-color="#D35400" />
            </linearGradient>
            <radialGradient id="peacockEye" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#00E5FF" />
                <stop offset="40%" stop-color="#006064" />
                <stop offset="70%" stop-color="#81C784" />
                <stop offset="100%" stop-color="#1B5E20" />
            </radialGradient>
        </defs>
        <path d="M50 75 Q15 65 15 35 Q15 10 50 15 Q85 10 85 35 Q85 65 50 75 Z" fill="#2E7D32" stroke="#1A1510" stroke-width="2.5"/>
        <path d="M50 75 Q25 68 25 40 Q25 18 50 22 Q75 18 75 40 Q75 68 50 75 Z" fill="#1B5E20" stroke="#1A1510" stroke-width="1.5"/>
        <circle cx="30" cy="25" r="4.5" fill="url(#peacockEye)" stroke="#1A1510" stroke-width="1"/>
        <circle cx="50" cy="20" r="4.5" fill="url(#peacockEye)" stroke="#1A1510" stroke-width="1"/>
        <circle cx="70" cy="25" r="4.5" fill="url(#peacockEye)" stroke="#1A1510" stroke-width="1"/>
        <circle cx="22" cy="40" r="4.5" fill="url(#peacockEye)" stroke="#1A1510" stroke-width="1"/>
        <circle cx="78" cy="40" r="4.5" fill="url(#peacockEye)" stroke="#1A1510" stroke-width="1"/>
        <circle cx="35" cy="52" r="4" fill="url(#peacockEye)" stroke="#1A1510" stroke-width="1"/>
        <circle cx="65" cy="52" r="4" fill="url(#peacockEye)" stroke="#1A1510" stroke-width="1"/>
        <circle cx="50" cy="65" r="16" fill="url(#reogRed)" stroke="#1A1510" stroke-width="2.5"/>
        <circle cx="50" cy="65" r="11" fill="url(#reogYellow)" stroke="#1A1510" stroke-width="2"/>
        <polygon points="41 56 34 50 43 50" fill="url(#reogRed)" stroke="#1A1510" stroke-width="1.5"/>
        <polygon points="59 56 66 50 57 50" fill="url(#reogRed)" stroke="#1A1510" stroke-width="1.5"/>
        <circle cx="46" cy="62" r="2.5" fill="#FFFFFF" stroke="#1A1510" stroke-width="1"/>
        <circle cx="46" cy="62" r="1.2" fill="#000000"/>
        <circle cx="54" cy="62" r="2.5" fill="#FFFFFF" stroke="#1A1510" stroke-width="1"/>
        <circle cx="54" cy="62" r="1.2" fill="#000000"/>
        <path d="M48 66 L52 66 L50 70 Z" fill="#000" stroke="#1A1510" stroke-width="1"/>
        <path d="M44 71 Q50 75 56 71 Z" fill="#FFFFFF" stroke="#1A1510" stroke-width="1.5"/>
        <path d="M43 71 L45 74 L47 71 L49 74 L51 71 M53 71 L55 74 L57 71" stroke="#1A1510" stroke-width="1"/>
      </svg>`,
    filosofi: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <defs>
            <linearGradient id="lontarBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#FCE4D6" />
                <stop offset="50%" stop-color="#E8D5B7" />
                <stop offset="100%" stop-color="#D4A373" />
            </linearGradient>
            <linearGradient id="scrollWood" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#5D4037" />
                <stop offset="50%" stop-color="#8D6E63" />
                <stop offset="100%" stop-color="#3E2723" />
            </linearGradient>
        </defs>
        <path d="M12 28 C25 24 35 24 50 28 C65 24 75 24 88 28 L88 78 C75 74 65 74 50 78 C35 74 25 74 12 78 Z" fill="url(#lontarBg)" stroke="#1A1510" stroke-width="2.5"/>
        <line x1="50" y1="28" x2="50" y2="78" stroke="#8D6E63" stroke-width="1.8" stroke-dasharray="3,3"/>
        <rect x="7" y="24" width="6" height="58" rx="2" fill="url(#scrollWood)" stroke="#1A1510" stroke-width="2"/>
        <rect x="87" y="24" width="6" height="58" rx="2" fill="url(#scrollWood)" stroke="#1A1510" stroke-width="2"/>
        <circle cx="10" cy="24" r="2.5" fill="#FFD54F" stroke="#1A1510" stroke-width="1"/>
        <circle cx="10" cy="82" r="2.5" fill="#FFD54F" stroke="#1A1510" stroke-width="1"/>
        <circle cx="90" cy="24" r="2.5" fill="#FFD54F" stroke="#1A1510" stroke-width="1"/>
        <circle cx="90" cy="82" r="2.5" fill="#FFD54F" stroke="#1A1510" stroke-width="1"/>
        <path d="M18 36 Q22 34 26 36 T34 36 T42 36" stroke="#5D4037" stroke-width="1.5" fill="none"/>
        <path d="M18 46 Q22 44 26 46 T34 46 T42 46" stroke="#5D4037" stroke-width="1.5" fill="none"/>
        <path d="M18 56 Q22 54 26 56 T34 56 T42 56" stroke="#5D4037" stroke-width="1.5" fill="none"/>
        <path d="M18 66 Q22 64 26 66 T34 66 T42 66" stroke="#5D4037" stroke-width="1.5" fill="none"/>
        <path d="M58 36 Q62 34 66 36 T74 36 T82 36" stroke="#5D4037" stroke-width="1.5" fill="none"/>
        <path d="M58 46 Q62 44 66 46 T74 46 T82 46" stroke="#5D4037" stroke-width="1.5" fill="none"/>
        <path d="M58 56 Q62 54 66 56 T74 56 T82 56" stroke="#5D4037" stroke-width="1.5" fill="none"/>
        <path d="M58 66 Q62 64 66 66 T74 66 T82 66" stroke="#5D4037" stroke-width="1.5" fill="none"/>
        <rect x="18" y="32" width="6" height="6" fill="#D32F2F" rx="1" opacity="0.8"/>
      </svg>`,
    tembang: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <defs>
            <linearGradient id="tembangBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFF9C4" />
                <stop offset="100%" stop-color="#FBC02D" />
            </linearGradient>
        </defs>
        <rect x="12" y="10" width="76" height="80" rx="3" fill="url(#tembangBg)" stroke="#1A1510" stroke-width="2.5"/>
        <line x1="20" y1="18" x2="80" y2="18" stroke="#F57F17" stroke-width="1.5"/>
        <g stroke="#8D6E63" stroke-width="1">
            <line x1="20" y1="32" x2="80" y2="32"/>
            <line x1="20" y1="37" x2="80" y2="37"/>
            <line x1="20" y1="42" x2="80" y2="42"/>
            <line x1="20" y1="47" x2="80" y2="47"/>
            <line x1="20" y1="52" x2="80" y2="52"/>
        </g>
        <path d="M24 55 Q28 30 25 28 Q22 26 23 35 Q24 45 28 42 T24 55" fill="none" stroke="#1A1510" stroke-width="2"/>
        <circle cx="38" cy="47" r="3.5" fill="#1A1510"/>
        <line x1="41" y1="47" x2="41" y2="32" stroke="#1A1510" stroke-width="1.8"/>
        <circle cx="50" cy="42" r="3.5" fill="#1A1510"/>
        <line x1="53" y1="42" x2="53" y2="28" stroke="#1A1510" stroke-width="1.8"/>
        <circle cx="62" cy="37" r="3.5" fill="#1A1510"/>
        <line x1="65" cy="37" x2="65" y2="23" stroke="#1A1510" stroke-width="1.8"/>
        <path d="M65 23 Q72 26 70 30" fill="none" stroke="#1A1510" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M20 72 Q24 70 28 72 T36 72 T44 72 T52 72 T60 72 T68 72 T76 72" stroke="#5D4037" stroke-width="1.5" fill="none"/>
        <path d="M20 80 Q24 78 28 80 T36 80 T44 80 T52 80 T60 80 T68 80" stroke="#5D4037" stroke-width="1.5" fill="none"/>
      </svg>`
};

const BUDAYA_DATA = [
    {
        id: 'gamelan', kategori: 'musik', svgKey: 'gamelan', warna: '#FFF8E1', warnaTag: '#F9A825',
        nama: 'Gamelan',
        deskripsi: 'Orkestra tradisional Jawa yang terdiri dari alat musik pukul seperti gong, kenong, saron, bonang, dan kendang. Gamelan adalah jiwa dari kebudayaan Jawa.',
        fakta: ['Abad ke-8', 'UNESCO 2021', 'Ratusan instrumen'],
        detail: '<p><strong>Gamelan</strong> adalah ansambel musik yang berasal dari budaya Jawa, Bali, dan Sunda. Kata "gamelan" berasal dari bahasa Jawa, <em>gamel</em>, yang berarti "memukul".</p><p>Gamelan Jawa didominasi oleh nada-nada yang lebih lembut dan meditatif dibanding Gamelan Bali. Ada dua tangga nada utama: <strong>Pelog</strong> (7 nada) dan <strong>Slendro</strong> (5 nada).</p><ul><li><strong>Gong</strong>: Penanda akhir gatra (frase) terbesar</li><li><strong>Saron</strong>: Melodi utama dari bilah logam</li><li><strong>Kendang</strong>: Pengatur tempo dan ritme</li><li><strong>Bonang</strong>: Melodi ornamental dari gong kecil</li><li><strong>Gender</strong>: Instrumen melodi dengan resonator bambu</li></ul><p>Pada tahun 2021, UNESCO menetapkan Gamelan sebagai Warisan Budaya Tak Benda Kemanusiaan.</p>'
    },
    {
        id: 'wayang', kategori: 'seni', svgKey: 'wayang', warna: '#FFF3E0', warnaTag: '#FB8C00',
        nama: 'Wayang Kulit',
        deskripsi: 'Seni pertunjukan bayangan menggunakan boneka dari kulit kerbau yang diukir halus. Dimainkan oleh dalang yang juga menjadi narator dan penggerak wayang.',
        fakta: ['Kulit kerbau', 'UNESCO 2003', 'Semalam suntuk'],
        detail: '<p><strong>Wayang Kulit</strong> adalah seni teater bayangan tertua di dunia yang masih berkembang. UNESCO mengakuinya sebagai Masterpiece of the Oral and Intangible Heritage of Humanity pada 2003.</p><p>Lakon yang dimainkan umumnya bersumber dari epik Mahabharata dan Ramayana, yang diadaptasi ke dalam konteks budaya Jawa. Tokoh utama dalam wayang Jawa antara lain:</p><ul><li><strong>Pandawa Lima</strong>: Penjelmaan dharma dan kebenaran</li><li><strong>Punakawan</strong>: Semar, Gareng, Petruk, Bagong — penasehat bijak berbentuk lawak</li><li><strong>Kurawa</strong>: Simbol keserakahan dan kejahatan</li></ul><p>Seorang <strong>dalang</strong> menjadi sutradara, aktor, dan narator sekaligus — bisa memainkan semalam suntuk (8–9 jam) seorang diri dibantu gamelan.</p>'
    },
    {
        id: 'batik', kategori: 'seni', svgKey: 'batik', warna: '#F9FBE7', warnaTag: '#9E9D24',
        nama: 'Batik Jawa',
        deskripsi: 'Seni melukis kain menggunakan lilin panas (malam) dan pewarna alami. Setiap motif batik menyimpan filosofi dan makna mendalam tentang kehidupan.',
        fakta: ['Canting & malam', 'UNESCO 2009', '1000+ motif'],
        detail: '<p><strong>Batik</strong> adalah teknik pewarnaan kain dengan menggunakan malam (lilin panas) sebagai perintang warna. Kata batik berasal dari Jawa: <em>amba</em> (menulis) dan <em>titik</em>.</p><p>Batik Jawa dibagi menjadi dua gaya utama:</p><ul><li><strong>Batik Kraton</strong>: Motif seperti Parang, Kawung, Sido Mukti — hanya boleh dikenakan bangsawan</li><li><strong>Batik Pesisir</strong>: Motif bebas, warna cerah, pengaruh Tionghoa dan Arab</li></ul><p>Motif batik yang terkenal:</p><ul><li><strong>Parang Rusak</strong>: Simbol kekuatan dan keberanian, milik raja</li><li><strong>Kawung</strong>: Empat lingkaran = empat arah mata angin, simbol keseimbangan</li><li><strong>Mega Mendung</strong>: Dari Cirebon, motif awan bertingkat</li></ul><p>UNESCO menetapkan Batik Indonesia sebagai Warisan Budaya Tak Benda pada 2009.</p>'
    },
    {
        id: 'bedhaya', kategori: 'tari', svgKey: 'bedhaya', warna: '#F3E5F5', warnaTag: '#8E24AA',
        nama: 'Tari Bedhaya',
        deskripsi: 'Tari sakral keraton yang ditarikan oleh 9 penari putri. Melambangkan persatuan antara manusia, alam semesta, dan Sang Pencipta.',
        fakta: ['9 penari', 'Sakral Keraton', 'Filosofi tinggi'],
        detail: '<p><strong>Bedhaya</strong> adalah tarian paling sakral di keraton Jawa (Yogyakarta dan Surakarta). Jumlah 9 penari melambangkan wali sanga (sembilan wali) atau sembilan lubang pada tubuh manusia.</p><p>Tarian ini bergerak sangat lambat dan meditatif — penonton perlu pemahaman khusus untuk menangkap makna di setiap gerakannya. Musik pengiringnya adalah Gamelan dengan tembang Jawa.</p><ul><li><strong>Bedhaya Ketawang</strong>: Tarian paling sakral di Kasunanan Surakarta, hanya ditampilkan saat peringatan tahta raja</li><li><strong>Busana</strong>: Kain batik Dodot, mahkota, dan riasan tebal khas</li><li><strong>Durasi</strong>: Bisa mencapai 2–3 jam</li></ul><p>Gerakan tangan (mudra) dan posisi tubuh dalam Bedhaya mengandung simbolisme kosmik yang sangat dalam.</p>'
    },
    {
        id: 'serimpi', kategori: 'tari', svgKey: 'serimpi', warna: '#FCE4EC', warnaTag: '#D81B60',
        nama: 'Tari Serimpi',
        deskripsi: 'Tari putri keraton yang ditarikan oleh 4 penari, mewakili empat unsur alam: api, air, angin, dan tanah. Gerakannya lembut dan penuh keanggunan.',
        fakta: ['4 penari', 'Unsur alam', 'Keraton Yogya'],
        detail: '<p><strong>Serimpi</strong> adalah tarian sakral keraton Yogyakarta yang melibatkan 4 penari putri. Angka empat merepresentasikan empat arah angin, empat elemen alam, dan empat sifat manusia.</p><ul><li><strong>Grama</strong>: Api — semangat dan tekad</li><li><strong>Toya</strong>: Air — keluwesan dan adaptasi</li><li><strong>Angin</strong>: Udara — kebebasan pikiran</li><li><strong>Bumi</strong>: Tanah — keteguhan hati</li></ul><p>Gerakan Serimpi sangat halus dan lambat, mengikuti filosofi Jawa tentang <em>alon-alon waton kelakon</em> (pelan namun pasti tercapai). Kostumnya berupa kain batik parang, kemben, dan hiasan kepala khas keraton.</p>'
    },
    {
        id: 'keris', kategori: 'seni', svgKey: 'keris', warna: '#ECEFF1', warnaTag: '#546E7A',
        nama: 'Keris',
        deskripsi: 'Senjata pusaka berbilah asimetris dengan pamor unik. Lebih dari senjata, keris adalah karya seni, benda spiritual, dan simbol status sosial.',
        fakta: ['UNESCO 2005', 'Pamor baja', '11 luk (lekukan)'],
        detail: '<p><strong>Keris</strong> adalah senjata tikam khas Nusantara dengan bilah asimetris berlekuk (luk) yang khas. UNESCO mengakuinya sebagai Warisan Budaya Tak Benda pada 2005.</p><p>Keris bukan sekadar senjata — ia adalah:</p><ul><li><strong>Simbol status</strong>: Jumlah luk dan jenis pamor menunjukkan derajat sosial</li><li><strong>Benda spiritual</strong>: Dipercaya memiliki kekuatan magis penjaga</li><li><strong>Karya seni tinggi</strong>: Proses pembuatan bisa berbulan-bulan oleh Empu (pandai keris)</li></ul><p>Bagian-bagian keris:</p><ul><li><strong>Wilah</strong>: Bilah besi/baja berlapis pamor (meteorit/nikel)</li><li><strong>Ganja</strong>: Pangkal bilah yang melindungi tangan</li><li><strong>Hulu</strong>: Gagang keris dari kayu atau gading</li><li><strong>Warangka</strong>: Sarung keris dari kayu timoho</li></ul>'
    },
    {
        id: 'reog', kategori: 'seni', svgKey: 'reog', warna: '#FFFDE7', warnaTag: '#F57F17',
        nama: 'Reog Ponorogo',
        deskripsi: 'Seni pertunjukan spektakuler dari Ponorogo, Jawa Timur. Penampilan utamanya adalah topeng Dadak Merak — singa berkepala merak berbobot 40–50 kg.',
        fakta: ['Ponorogo', '40-50 kg topeng', 'Bulu merak asli'],
        detail: '<p><strong>Reog Ponorogo</strong> adalah kesenian rakyat dari Kabupaten Ponorogo, Jawa Timur, yang terkenal dengan topeng Dadak Merak yang sangat besar dan berat.</p><p>Tokoh utama dalam pertunjukan Reog:</p><ul><li><strong>Singo Barong</strong>: Penari yang membawa topeng kepala singa bertutup merak seberat 40-50 kg dengan rahangnya saja</li><li><strong>Warok</strong>: Pria berbusana hitam, simbol kekuatan spiritual dan moral</li><li><strong>Jathil</strong>: Prajurit berkuda, kini ditarikan oleh wanita</li><li><strong>Klono Sewandono</strong>: Raja yang jatuh cinta</li></ul><p>Reog bukan sekadar hiburan — ia adalah ekspresi kebanggaan, kekuatan, dan identitas masyarakat Ponorogo yang diwariskan turun-temurun.</p>'
    },
    {
        id: 'javanophilosophy', kategori: 'filosofi', svgKey: 'filosofi', warna: '#FFF8E1', warnaTag: '#6D4C41',
        nama: 'Filosofi Jawa',
        deskripsi: 'Kearifan lokal Jawa mencakup konsep Hamemayu Hayuning Bawana (menjaga keindahan dunia), Manunggaling Kawula Gusti, dan Memayu Hayuning Urip.',
        fakta: ['Hamemayu', 'Sangkan Paran', 'Alon-alon'],
        detail: '<p>Orang Jawa memiliki kekayaan filsafat hidup yang mendalam. Beberapa prinsip utama:</p><ul><li><strong>Hamemayu Hayuning Bawana</strong>: Manusia berkewajiban menjaga keselamatan dan keindahan dunia — konsep ramah lingkungan asli Jawa</li><li><strong>Manunggaling Kawula Gusti</strong>: Penyatuan manusia dengan Tuhan — spiritualitas tertinggi dalam tasawuf Jawa</li><li><strong>Nrimo ing Pandum</strong>: Menerima dengan ikhlas apa yang diberikan — bukan pasrah, tapi ketenangan batin</li><li><strong>Alon-alon waton kelakon</strong>: Pelan tapi pasti — mendahulukan kualitas daripada kecepatan</li><li><strong>Tepa slira</strong>: Empati dan tenggang rasa — merasakan perasaan orang lain</li><li><strong>Sangkan Paraning Dumadi</strong>: Kesadaran asal-usul dan tujuan hidup manusia</li></ul><p>Filosofi ini tercermin dalam seni, ritual, arsitektur, dan cara hidup masyarakat Jawa sehari-hari.</p>'
    },
    {
        id: 'tembang', kategori: 'musik', svgKey: 'tembang', warna: '#E8F5E9', warnaTag: '#388E3C',
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

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="padding:20px; color:#888;">Tidak ada konten untuk kategori ini.</p>';
        return;
    }

    filtered.forEach(item => {
        const svg = BUDAYA_SVG[item.svgKey] || '';
        const card = document.createElement('div');
        card.className = 'budaya-card';
        card.innerHTML = `
            <div class="budaya-card-icon" style="background:${item.warna}">${svg}</div>
            <div class="budaya-card-body">
                <span class="budaya-card-tag" style="background:${item.warnaTag || '#ddd'}; color:#fff;">${item.kategori.toUpperCase()}</span>
                <div class="budaya-card-title">${item.nama}</div>
                <p class="budaya-card-desc">${item.deskripsi}</p>
                <div class="budaya-card-facts">${item.fakta.map(f => `<span class="budaya-fact-chip">${f}</span>`).join('')}</div>
                <div class="budaya-card-cta">Baca selengkapnya &rarr;</div>
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
                <div class="budaya-detail-icon">${BUDAYA_SVG[item.svgKey] || ''}</div>
                <div>
                    <span style="font-size:0.72rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; background:${item.warnaTag || '#888'}; color:#fff; padding:2px 10px; border-radius:3px;">${item.kategori}</span>
                    <h3 style="font-size:1.5rem; margin:8px 0 6px;">${item.nama}</h3>
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
