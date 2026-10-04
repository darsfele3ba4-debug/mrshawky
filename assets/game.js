// ===== محرك الألعاب (بدون مؤقت) =====
const params = new URLSearchParams(location.search);
const lessonId = LESSONS[params.get('l')] ? params.get('l') : Object.keys(LESSONS)[0];
const meta = LESSONS[lessonId];
let D = null;

document.getElementById('grade-text').innerText = TEACHER.grade;
document.getElementById('teacher-name').innerText = TEACHER.full;
document.getElementById('teacher-en').innerText = TEACHER.nameEn;
document.getElementById('hdr-teacher').innerText = TEACHER.full;
document.getElementById('lesson-order').innerText = meta.order;
document.getElementById('lesson-title').innerText = meta.title;
document.getElementById('hdr-lesson').innerText = meta.title;
document.getElementById('tips-list').innerHTML = meta.tips.map(t => '<li>' + fmt(t) + '</li>').join('');
document.title = meta.order + ' : ' + meta.title + ' | ' + TEACHER.full;
if (document.getElementById('lesson-unit')) document.getElementById('lesson-unit').innerText = meta.unit || '';
document.getElementById('games-grid').innerHTML = meta.games.map(g => {
    const G = GAME_DEFS[g];
    return `<button onclick="startGame('${g}')" class="btn-bounce bg-gradient-to-r ${G.color} text-white p-4 rounded-xl shadow-md flex items-center justify-between">
        <div class="text-right"><h4 class="font-bold text-lg">${G.title}</h4><p class="text-xs text-white/80">${G.sub}</p></div>
        <i class="fa-solid ${G.icon} text-3xl opacity-80"></i></button>`;
}).join('');

(function loadData() {
    const sc = document.createElement('script');
    sc.src = 'data/' + lessonId + '.js';
    sc.onload = () => { D = window.LESSON_DATA; };
    sc.onerror = () => { document.getElementById('lesson-title').innerText = 'تعذر تحميل بيانات الدرس'; };
    document.head.appendChild(sc);
})();

function shuffleArray(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// صورة السؤال (أشكال مقتطعة من الكتاب)
function imgHtml(q, cls) {
    if (!q || !q.img) return '';
    return `<img src="img/${q.img}.png" alt="شكل السؤال" class="${cls || 'q-img'} block" loading="eager">`;
}

let gameState = { currentScreen: 'home', activeGame: null, score: 0, questionIndex: 0, subLevel: 0, tempData: null, onFeedbackClose: null, total: 15 };
const titles = Object.fromEntries(Object.entries(GAME_DEFS).map(([k, v]) => [k, v.title]));
let matchSelectedA = null, matchSelectedB = null;

function pauseAnimations() { document.querySelectorAll('.game-anim-element').forEach(t => t.style.animationPlayState = 'paused'); }

function showScreen(screenId) {
    document.querySelectorAll('.game-screen').forEach(el => el.classList.add('hidden'));
    if (screenId === 'home') {
        document.getElementById('screen-home').classList.remove('hidden');
        document.getElementById('game-header').classList.add('hidden');
    } else {
        document.getElementById('screen-home').classList.add('hidden');
        document.getElementById('game-header').classList.remove('hidden');
        document.getElementById('screen-' + screenId).classList.remove('hidden');
        document.getElementById('current-game-title').innerText = titles[gameState.activeGame];
        updateScoreDisplay();
    }
    gameState.currentScreen = screenId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
    pauseAnimations();
    document.getElementById('feedback-modal').classList.add('hidden');
    document.getElementById('endgame-modal').classList.add('hidden');
    gameState.onFeedbackClose = null; gameState.activeGame = null;
    showScreen('home');
}

function startGame(type) {
    if (!D) { alert('جارٍ تحميل الأسئلة... حاول مرة أخرى'); return; }
    document.getElementById('endgame-modal').classList.add('hidden');
    gameState.activeGame = type; gameState.score = 0; gameState.questionIndex = 0; gameState.subLevel = 0;
    const src = D[type] || [];
    gameState.tempData = shuffleArray(src);
    gameState.total = src.length;
    document.querySelectorAll('.total-count').forEach(e => e.innerText = gameState.total);
    showScreen(type);
    if (type === 'mcq') loadMCQ();
    else if (type === 'match') loadMatchRound();
    else if (type === 'tf') loadTF();
    else if (type === 'fill') loadFill();
    else if (type === 'bubbles') loadBubbles();
    else if (type === 'shoot') loadShoot();
    else if (type === 'tug') { gameState.tugPos = 0; moveRope(); loadTug(); }
    else if (type === 'goal') loadGoal();
}

function updateScoreDisplay() { document.getElementById('current-score').innerText = gameState.score; }
function setProgress(id) { document.getElementById(id).style.width = `${(gameState.questionIndex / gameState.total) * 100}%`; }

function endGame() {
    document.getElementById('endgame-score').innerText = gameState.score;
    const r = gameState.score / gameState.total;
    document.getElementById('endgame-msg').innerText = r === 1 ? 'بطل حقيقى! درجة نهائية 🌟' : r >= 0.8 ? 'ممتاز! أداء رائع 👏' : r >= 0.5 ? 'جيد، راجع الدرس وحاول مرة أخرى 💪' : 'لا تيأس! راجع الدرس ثم أعد المحاولة 📘';
    if (gameState.activeGame === 'tug') {
        const p = gameState.tugPos;
        document.getElementById('endgame-msg').innerText = p > 0 ? 'فاز فريقك فى شد الحبل! 🏆' : p < 0 ? 'فاز المنافس هذه المرة .. أعد المحاولة 💪' : 'تعادل! الحبل فى المنتصف 🤝';
    } else if (gameState.activeGame === 'goal') {
        document.getElementById('endgame-msg').innerText = 'سجّلت ' + toAr(gameState.score) + ' أهداف ⚽ ' + document.getElementById('endgame-msg').innerText;
    }
    (gameState.score / gameState.total >= 0.5) ? SFX.fanfare() : SFX.wrong();
    document.getElementById('endgame-modal').classList.remove('hidden');
}

function showFeedback(isCorrect, messageHtml, callback) {
    const modal = document.getElementById('feedback-modal'), content = document.getElementById('feedback-content');
    const icon = document.getElementById('feedback-icon'), title = document.getElementById('feedback-title');
    gameState.onFeedbackClose = callback;
    if (!['tug', 'goal'].includes(gameState.activeGame)) isCorrect ? SFX.correct() : SFX.wrong();
    if (isCorrect) {
        icon.innerHTML = '<i class="fa-solid fa-circle-check text-green-500 popup-anim"></i>';
        title.innerText = "إجابة صحيحة!"; title.className = "text-2xl font-bold mb-2 text-green-600";
    } else {
        icon.innerHTML = '<i class="fa-solid fa-circle-xmark text-red-500 popup-anim"></i>';
        title.innerText = "إجابة خاطئة"; title.className = "text-2xl font-bold mb-2 text-red-600";
    }
    document.getElementById('feedback-msg').innerHTML = messageHtml || "";
    modal.classList.remove('hidden');
    setTimeout(() => { content.classList.remove('scale-50', 'opacity-0'); content.classList.add('scale-100', 'opacity-100'); }, 10);
}
function closeFeedback() {
    const modal = document.getElementById('feedback-modal'), content = document.getElementById('feedback-content');
    content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-50', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        if (gameState.onFeedbackClose) { const cb = gameState.onFeedbackClose; gameState.onFeedbackClose = null; cb(); }
    }, 300);
}
function explain(q) { return q.exp ? `<br><span class="text-sm text-blue-700">${fmt(q.exp)}</span>` : ''; }

// ---- 1. MCQ ----
function loadMCQ() {
    if (gameState.questionIndex >= gameState.total) return endGame();
    const q = gameState.tempData[gameState.questionIndex];
    document.getElementById('mcq-img').innerHTML = imgHtml(q);
    document.getElementById('mcq-question').innerHTML = toAr(gameState.questionIndex + 1) + " - " + fmt(q.q);
    setProgress('mcq-progress');
    const box = document.getElementById('mcq-options'); box.innerHTML = '';
    shuffleArray(q.options).forEach(opt => {
        const b = document.createElement('button');
        b.className = "btn-bounce w-full bg-white border-2 border-blue-200 hover:bg-blue-50 text-blue-900 font-bold py-4 px-6 rounded-xl text-center shadow-sm text-lg transition-colors";
        b.innerHTML = fmt(opt);
        b.onclick = () => checkMCQ(opt, q);
        box.appendChild(b);
    });
}
function checkMCQ(sel, q) {
    const ok = sel === q.ans; if (ok) gameState.score++; updateScoreDisplay();
    showFeedback(ok, ok ? "أحسنت!" + explain(q) : `الإجابة الصحيحة هى: ${fmt(q.ans)}` + explain(q), () => { gameState.questionIndex++; loadMCQ(); });
}

// ---- 2. Bubbles ----
function loadBubbles() {
    if (gameState.questionIndex >= gameState.total) return endGame();
    const q = gameState.tempData[gameState.questionIndex];
    document.getElementById('bubbles-question').innerHTML = toAr(gameState.questionIndex + 1) + " - " + fmt(q.q);
    document.getElementById('bubbles-img').innerHTML = imgHtml(q, 'q-img-sm');
    setProgress('bubbles-progress');
    const area = document.getElementById('bubbles-game-area'); area.innerHTML = '';
    const xs = [2, 27, 52, 77]; const delays = shuffleArray([0, -3, -6, -9]);
    shuffleArray(q.options).forEach((opt, i) => {
        const el = document.createElement('div');
        const long = String(opt).length > 14;
        el.className = `game-anim-element anim-fall game-bubble absolute flex items-center justify-center p-2 ${long ? 'w-24 h-24 sm:w-32 sm:h-32 text-[10px] sm:text-xs' : 'w-20 h-20 sm:w-28 sm:h-28 text-xs sm:text-base'} font-bold text-center cursor-pointer z-10`;
        el.style.left = xs[i] + '%'; el.style.animationDelay = delays[i] + 's';
        el.innerHTML = '<span>' + fmt(opt) + '</span>';
        el.onclick = () => processAnim(opt, q, 'bubbles');
        area.appendChild(el);
    });
}

// ---- 3. Shoot ----
function loadShoot() {
    if (gameState.questionIndex >= gameState.total) return endGame();
    const q = gameState.tempData[gameState.questionIndex];
    document.getElementById('shoot-question').innerHTML = toAr(gameState.questionIndex + 1) + " - " + fmt(q.q);
    document.getElementById('shoot-img').innerHTML = imgHtml(q, 'q-img-sm');
    setProgress('shoot-progress');
    const area = document.getElementById('shoot-game-area'); area.innerHTML = '';
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'], ys = [4, 28, 52, 76], dirs = [1, -1, 1, -1];
    const delays = shuffleArray([0, -3, -6, -9]);
    shuffleArray(q.options).forEach((opt, i) => {
        const el = document.createElement('div');
        const long = String(opt).length > 14;
        el.className = `game-anim-element ${dirs[i] === 1 ? 'anim-right' : 'anim-left'} horizontal-target absolute text-gray-800 p-1 rounded-full text-center font-bold flex flex-col items-center justify-center ${long ? 'w-28 h-28 sm:w-36 sm:h-36 text-[10px] sm:text-xs' : 'w-24 h-24 sm:w-28 sm:h-28 text-xs sm:text-sm'} cursor-pointer z-10`;
        el.style.borderColor = colors[i]; el.style.top = ys[i] + '%'; el.style.animationDelay = delays[i] + 's';
        el.innerHTML = `<i class="fa-solid fa-bullseye text-xl sm:text-2xl mb-1" style="color:${colors[i]}"></i><span>${fmt(opt)}</span>`;
        el.onclick = () => processAnim(opt, q, 'shoot');
        area.appendChild(el);
    });
}
function processAnim(sel, q, type) {
    pauseAnimations();
    const ok = sel === q.ans; if (ok) gameState.score++; updateScoreDisplay();
    showFeedback(ok, ok ? "إصابة دقيقة وممتازة!" + explain(q) : `للأسف أخطأت الهدف! الإجابة هى: ${fmt(q.ans)}` + explain(q), () => {
        gameState.questionIndex++; type === 'bubbles' ? loadBubbles() : loadShoot();
    });
}

// ---- 4. True / False ----
function loadTF() {
    if (gameState.questionIndex >= gameState.total) return endGame();
    const q = gameState.tempData[gameState.questionIndex];
    setProgress('tf-progress');
    document.getElementById('tf-img').innerHTML = imgHtml(q);
    const st = document.getElementById('tf-statement'); st.innerHTML = '<span>' + fmt(q.text) + '</span>';
    st.classList.remove('popup-anim'); void st.offsetWidth; st.classList.add('popup-anim');
}
function checkTF(ans) {
    const q = gameState.tempData[gameState.questionIndex];
    const ok = q.isCorrect === ans; if (ok) gameState.score++; updateScoreDisplay();
    showFeedback(ok, (ok ? "إجابة صحيحة وممتازة!" : `العبارة ${q.isCorrect ? "صحيحة" : "خاطئة"}.`) + explain(q), () => { gameState.questionIndex++; loadTF(); });
}

// ---- 5. Matching (3 جولات × 5) ----
function loadMatchRound() {
    const rounds = Math.ceil(gameState.total / 5);
    if (gameState.subLevel >= rounds) return endGame();
    const items = gameState.tempData.slice(gameState.subLevel * 5, gameState.subLevel * 5 + 5);
    setProgress('match-progress');
    renderMatchList('match-list-a', shuffleArray(items.map((it, k) => ({ id: gameState.subLevel + '-' + it.a, html: fmt(it.a), type: 'A' }))));
    renderMatchList('match-list-b', shuffleArray(items.map((it, k) => ({ id: gameState.subLevel + '-' + it.a, html: fmt(it.b), type: 'B' }))));
    matchSelectedA = null; matchSelectedB = null;
}
function renderMatchList(cid, items) {
    const c = document.getElementById(cid); c.innerHTML = '';
    items.forEach(it => {
        const b = document.createElement('button');
        b.className = "match-item bg-white border-2 border-gray-200 text-gray-700 font-bold py-3 px-2 rounded-lg shadow-sm text-xs sm:text-sm text-center min-h-[60px] flex items-center justify-center";
        b.innerHTML = '<span>' + it.html + '</span>'; b.dataset.id = it.id; b.dataset.type = it.type;
        b.onclick = () => handleMatchClick(b); c.appendChild(b);
    });
}
function handleMatchClick(btn) {
    if (btn.classList.contains('matched')) return;
    const type = btn.dataset.type;
    document.querySelectorAll(`#match-list-${type.toLowerCase()} .match-item`).forEach(el => { if (!el.classList.contains('matched')) el.classList.remove('selected'); });
    btn.classList.add('selected');
    if (type === 'A') matchSelectedA = btn; else matchSelectedB = btn;
    if (matchSelectedA && matchSelectedB) {
        const a = matchSelectedA, b = matchSelectedB;
        if (a.dataset.id === b.dataset.id) {
            a.classList.remove('selected'); a.classList.add('matched');
            b.classList.remove('selected'); b.classList.add('matched');
            if (!a.dataset.missed) gameState.score++;
            SFX.correct();
            gameState.questionIndex++; updateScoreDisplay(); setProgress('match-progress');
            const done = document.querySelectorAll('#match-list-a .matched').length;
            const inRound = document.querySelectorAll('#match-list-a .match-item').length;
            if (done === inRound) setTimeout(() => { gameState.subLevel++; loadMatchRound(); }, 900);
        } else {
            SFX.wrong();
            a.dataset.missed = '1'; // المحاولة الخاطئة تُفقد نقطة هذا العنصر
            a.classList.add('error'); b.classList.add('error');
            setTimeout(() => { a.classList.remove('selected', 'error'); b.classList.remove('selected', 'error'); }, 500);
        }
        matchSelectedA = null; matchSelectedB = null;
    }
}

// ---- 6. Fill ----
function loadFill() {
    if (gameState.questionIndex >= gameState.total) return endGame();
    const q = gameState.tempData[gameState.questionIndex];
    setProgress('fill-progress');
    document.getElementById('fill-img').innerHTML = imgHtml(q);
    const blank = '<span id="fill-blank" class="inline-block border-b-4 border-dashed border-purple-400 min-w-[70px] md:min-w-[100px] text-center text-purple-600 px-1 md:px-2 pb-1 mx-1 md:mx-2">؟</span>';
    const el = document.getElementById('fill-sentence');
    el.innerHTML = fmt(q.text).replace('...', blank);
    el.classList.remove('popup-anim'); void el.offsetWidth; el.classList.add('popup-anim');
    const box = document.getElementById('fill-options'); box.innerHTML = '';
    shuffleArray(q.options).forEach(opt => {
        const b = document.createElement('button');
        b.className = "btn-bounce bg-white hover:bg-purple-50 border-2 border-purple-200 text-purple-800 font-bold py-3 md:py-4 px-3 md:px-6 rounded-xl shadow-sm text-base md:text-lg transition-colors";
        b.innerHTML = fmt(opt); b.onclick = () => checkFill(opt, q); box.appendChild(b);
    });
}
function checkFill(sel, q) {
    const ok = sel === q.blank; if (ok) gameState.score++; updateScoreDisplay();
    const bl = document.getElementById('fill-blank');
    if (bl) { bl.innerHTML = fmt(sel); bl.className = 'inline-block border-b-4 border-solid px-2 mx-1 ' + (ok ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600 line-through'); }
    showFeedback(ok, (ok ? "ممتاز! إجابة فى مكانها الصحيح." : `الإجابة الصحيحة هى: ${fmt(q.blank)}`) + explain(q), () => { gameState.questionIndex++; loadFill(); });
}


// ---- 7. شد الحبل ----
function moveRope() {
    const p = Math.max(-6, Math.min(6, gameState.tugPos || 0));
    document.getElementById('tug-rope').style.transform = `translateX(${p * 6}%)`; // موجب = نحو فريقك (اليمين)
}
function pullAnim(side) {
    const el = document.querySelector(side === 'me' ? '.tug-me' : '.tug-op');
    el.classList.remove('pulling'); void el.offsetWidth; el.classList.add('pulling');
}
function loadTug() {
    if (gameState.questionIndex >= gameState.total) return endGame();
    gameState.locked = false;
    const q = gameState.tempData[gameState.questionIndex];
    document.getElementById('tug-question').innerHTML = toAr(gameState.questionIndex + 1) + " - " + fmt(q.q);
    document.getElementById('tug-img').innerHTML = imgHtml(q, 'q-img-sm');
    setProgress('tug-progress');
    const box = document.getElementById('tug-options'); box.innerHTML = '';
    shuffleArray(q.options).forEach(opt => {
        const b = document.createElement('button');
        b.className = "btn-bounce w-full bg-white border-2 border-amber-300 hover:bg-amber-50 text-amber-900 font-bold py-3 px-3 rounded-xl shadow-sm text-base md:text-lg";
        b.innerHTML = fmt(opt);
        b.onclick = () => checkTug(opt, q, b);
        box.appendChild(b);
    });
}
function checkTug(sel, q, btn) {
    if (gameState.locked) return; gameState.locked = true;
    const ok = sel === q.ans;
    if (ok) gameState.score++;
    ok ? SFX.correct() : SFX.wrong();
    gameState.tugPos = Math.max(-6, Math.min(6, gameState.tugPos + (ok ? 1 : -1))); moveRope(); pullAnim(ok ? 'me' : 'op');
    btn.classList.add(ok ? 'opt-right' : 'opt-wrong');
    updateScoreDisplay();
    setTimeout(() => showFeedback(ok, (ok ? "سحبة قوية! الحبل يقترب من فريقك 💪" : `سحبة للمنافس! الإجابة الصحيحة: ${fmt(q.ans)}`) + explain(q),
        () => { gameState.questionIndex++; loadTug(); }), 650);
}

// ---- 8. تسجيل الأهداف ----
const GOAL_SPOTS = [{ x: 27, y: 20 }, { x: 73, y: 20 }, { x: 27, y: 46 }, { x: 73, y: 46 }];
function placeEl(el, p, anim) {
    el.style.transition = anim ? 'left .6s ease-out, top .6s ease-out, transform .6s ease-out' : 'none';
    el.style.left = p.x + '%'; el.style.top = p.y + '%';
}
function loadGoal() {
    if (gameState.questionIndex >= gameState.total) return endGame();
    gameState.locked = false;
    const q = gameState.tempData[gameState.questionIndex];
    document.getElementById('goal-question').innerHTML = toAr(gameState.questionIndex + 1) + " - " + fmt(q.q);
    document.getElementById('goal-img').innerHTML = imgHtml(q, 'q-img-sm');
    setProgress('goal-progress');
    const ball = document.getElementById('goal-ball'), keeper = document.getElementById('goal-keeper');
    placeEl(ball, { x: 50, y: 86 }); ball.style.transform = 'translate(-50%,-50%) scale(1)';
    placeEl(keeper, { x: 50, y: 36 }); keeper.style.transform = 'translate(-50%,-50%) rotate(0deg)';
    document.getElementById('goal-flash').className = 'goal-flash';
    const box = document.getElementById('goal-targets'); box.innerHTML = '';
    shuffleArray(q.options).forEach((opt, i) => {
        const t = document.createElement('button');
        t.className = 'goal-target' + (String(opt).replace(/[$\s{}]/g, '').length > 12 ? ' long' : '');
        t.style.left = GOAL_SPOTS[i].x + '%'; t.style.top = GOAL_SPOTS[i].y + '%';
        t.innerHTML = '<span>' + fmt(opt) + '</span>';
        t.onclick = () => shootGoal(opt, q, i, t);
        box.appendChild(t);
    });
}
function shootGoal(sel, q, idx, target) {
    if (gameState.locked) return; gameState.locked = true;
    const ok = sel === q.ans;
    const ball = document.getElementById('goal-ball'), keeper = document.getElementById('goal-keeper');
    const others = [0, 1, 2, 3].filter(k => k !== idx);
    const kSpot = ok ? GOAL_SPOTS[others[Math.floor(Math.random() * others.length)]] : GOAL_SPOTS[idx];
    placeEl(ball, GOAL_SPOTS[idx], true); ball.style.transform = 'translate(-50%,-50%) scale(.6) rotate(540deg)';
    placeEl(keeper, { x: 50 + (kSpot.x - 50) * 0.8, y: kSpot.y + 6 }, true);
    keeper.style.transform = `translate(-50%,-50%) rotate(${kSpot.x < 50 ? -35 : 35}deg)`;
    target.classList.add(ok ? 'hit' : 'miss');
    if (ok) gameState.score++;
    updateScoreDisplay();
    setTimeout(() => {
        const f = document.getElementById('goal-flash');
        f.innerText = ok ? 'جووووول! ⚽' : 'تصدّى الحارس! 🧤';
        f.className = 'goal-flash show ' + (ok ? 'ok' : 'no');
        ok ? SFX.correct(true) : SFX.wrong();
    }, 600);
    setTimeout(() => showFeedback(ok, (ok ? "هدف رائع فى الزاوية الصحيحة!" : `ضاعت الفرصة! الإجابة الصحيحة: ${fmt(q.ans)}`) + explain(q),
        () => { gameState.questionIndex++; loadGoal(); }), 1400);
}

// ---- زر الصوت ----
function refreshSoundBtn() {
    const b = document.getElementById('sound-btn'); if (!b) return;
    b.innerHTML = SFX.isMuted() ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
    b.title = SFX.isMuted() ? 'تشغيل الصوت' : 'كتم الصوت';
}
function toggleSound() { SFX.setMuted(!SFX.isMuted()); refreshSoundBtn(); if (!SFX.isMuted()) SFX.small(true); }
refreshSoundBtn();
document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
