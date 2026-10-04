// ===== المؤثرات الصوتية (تُولَّد داخل المتصفح بدون ملفات صوت - تعمل بدون إنترنت) =====
const SFX = (() => {
    let ctx = null, muted = false;
    try { muted = localStorage.getItem('sfx-muted') === '1'; } catch (e) {}

    function ac() {
        if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }
    function tone(c, freq, t0, dur, type, vol, dest) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(dest || c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noiseBuffer(c, sec) {
        const b = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }
    // تصفيق
    function claps(c, t0, n, span) {
        for (let i = 0; i < n; i++) {
            const t = t0 + Math.random() * span, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
            s.buffer = noiseBuffer(c, 0.06); f.type = 'bandpass'; f.frequency.value = 1200 + Math.random() * 1500; f.Q.value = 0.8;
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 + Math.random() * 0.25, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
            s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + 0.07);
        }
    }
    // هتاف الجمهور
    function crowd(c, t0, dur) {
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = noiseBuffer(c, dur); f.type = 'bandpass'; f.frequency.setValueAtTime(700, t0); f.frequency.linearRampToValueAtTime(1100, t0 + dur * 0.4); f.Q.value = 0.6;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0); s.stop(t0 + dur);
    }

    function correct(big) {
        if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime + 0.01;
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(c, f, t + i * 0.08, 0.28, 'triangle', 0.32); tone(c, f * 2, t + i * 0.08, 0.15, 'sine', 0.06); });
        tone(c, 1318.5, t + 0.34, 0.45, 'triangle', 0.25);
        crowd(c, t + 0.15, big ? 1.8 : 1.2);
        claps(c, t + 0.2, big ? 26 : 16, big ? 1.4 : 0.9);
    }
    function wrong() {
        if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime + 0.01;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(c.destination);
        const notes = [293.66, 277.18, 261.63, 246.94]; // وا وا وا واااا
        notes.forEach((f, i) => {
            const st = t + i * 0.32, dur = i === 3 ? 0.9 : 0.3;
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(f, st);
            if (i === 3) { // اهتزاز حزين فى النغمة الأخيرة
                const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 6; lg.gain.value = 7;
                lfo.connect(lg); lg.connect(o.frequency); lfo.start(st); lfo.stop(st + dur);
                o.frequency.linearRampToValueAtTime(f * 0.94, st + dur);
            }
            g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.22, st + 0.04);
            g.gain.setValueAtTime(0.22, st + dur - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
            o.connect(g); g.connect(lp); o.start(st); o.stop(st + dur + 0.05);
        });
    }
    function small(ok) { // صوت قصير (التوصيل)
        if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime + 0.01;
        if (ok) { tone(c, 659.25, t, 0.15, 'triangle', 0.3); tone(c, 987.77, t + 0.08, 0.25, 'triangle', 0.3); }
        else { tone(c, 196, t, 0.18, 'sawtooth', 0.15); tone(c, 155.56, t + 0.15, 0.3, 'sawtooth', 0.15); }
    }
    function fanfare() {
        if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime + 0.01;
        [523.25, 523.25, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.13, i === 7 ? 0.8 : 0.16, 'triangle', 0.28));
        crowd(c, t + 0.3, 2.2); claps(c, t + 0.4, 34, 1.8);
    }
    function setMuted(m) { muted = m; try { localStorage.setItem('sfx-muted', m ? '1' : '0'); } catch (e) {} }
    return { correct, wrong, small, fanfare, setMuted, isMuted: () => muted, unlock: ac };
})();
