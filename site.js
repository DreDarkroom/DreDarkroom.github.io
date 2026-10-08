/* Dre Darkroom: the home page. A robot drummer plays the kit at the top while you scroll; the music is built from one number,
   how far down the page you are (see kit/groove/arrange.js). Everything the music needs is loaded when you press play, not before. */
import { Groove } from './kit/groove/engine.js';
import { Scene } from './kit/groove/scene.js';
import { mountDesk } from './kit/groove/desk.js';
import { focusAt } from './kit/groove/arrange.js';

const $ = (id) => document.getElementById(id), root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
const toast = (t) => { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2600); };

const groove = new Groove({ volume: +store.get('dd.vol', 0.7) });
const scene = new Scene($('kit'), groove, { reduceMotion: reduce });
scene.start();

/* ---------- where you are on the page is the music: the climb ends at the drop, then it stays there ---------- */
const progress = () => { const end = Math.max(1, $('drop').offsetTop - innerHeight * 0.35); return Math.min(1, Math.max(0, scrollY / end)); };

/* ---------- play, volume ---------- */
let wasPlaying = false;
const label = () => { const on = groove.playing; $('snd').textContent = on ? 'Pause' : 'Play'; $('snd').setAttribute('aria-pressed', String(on)); $('enter').textContent = on ? 'Sound on' : 'Enter with sound'; desk.setLive(on); setDeck(); };
async function play() { try { await groove.start(); } catch (e) { toast('The browser would not start the sound.'); return; } label(); }
function pause() { groove.stop(); label(); }
$('snd').addEventListener('click', () => { if (groove.playing) { stopAuto(); pause(); } else play(); });
groove.on((t) => { if (t === 'missing') toast('One instrument could not load; the drums carry on.'); });

let muted = false;
const showVol = () => { const v = Math.round((muted ? 0 : groove.volume) * 100); $('vol').value = Math.round(groove.volume * 100); $('volO').textContent = v; $('mute').setAttribute('aria-pressed', String(muted)); $('mute').textContent = muted || v === 0 ? '\u{1F507}' : v < 40 ? '\u{1F508}' : '\u{1F50A}'; };
function setVol(v) { muted = false; groove.setVolume(Math.min(1, Math.max(0, v))); store.set('dd.vol', groove.volume); showVol(); }
$('vol').addEventListener('input', (e) => setVol(e.target.value / 100));
$('mute').addEventListener('click', () => { muted = !muted; if (groove.graph) groove.graph.vol.gain.setTargetAtTime(muted ? 0 : groove.volume * groove.volume, groove.ctx.currentTime, 0.03); showVol(); });
addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  e.preventDefault();
  setVol(groove.volume + (e.key === 'ArrowUp' ? 0.1 : -0.1));
  toast(`Volume ${Math.round(groove.volume * 100)}%`);
});
showVol();

/* ---------- the tonearm: dropping the needle starts the sound and lets the page scroll itself, slowly ---------- */
const AUTO_SECS = 120, ARM_REST = 181, ARM_OUT = 170.8, ARM_IN = 150.4;
const auto = { on: false, y: 0, set: 0, t0: 0 };
function setDeck() { $('deck').setAttribute('aria-pressed', String(groove.playing)); $('deckTag').textContent = auto.on ? 'needle down' : groove.playing ? 'needle lifted' : 'needle up'; }
function stopAuto() { if (!auto.on) return; auto.on = false; setDeck(); }
async function dropNeedle() {
  if (!groove.playing) await play(); if (!groove.playing) return;
  if (reduce) { setDeck(); return; }                                              // reduced motion: sound on, but the page stays still
  const m = root.scrollHeight - innerHeight; if (scrollY >= m - 4) scrollTo({ top: 0, behavior: 'instant' });
  auto.on = true; auto.y = auto.set = scrollY; auto.t0 = performance.now(); setDeck();
}
$('enter').addEventListener('click', dropNeedle);
$('deck').addEventListener('click', () => { auto.on ? stopAuto() : dropNeedle(); });
for (const ev of ['wheel', 'touchstart', 'pointerdown']) addEventListener(ev, (e) => { if (!(e.target.closest && e.target.closest('#deck, .stage'))) stopAuto(); }, { passive: true });
addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key) && !(e.ctrlKey || e.metaKey)) stopAuto(); });

/* ---------- the mixing desk, and the full MixingMagic loaded inline ---------- */
const MM = new URL('/darklabs/mixingmagic/mount.js', location.href).href;
let mmOpen = null;
const desk = mountDesk($('mixer'), groove, { onExpand: toggleMM });
desk.setLive(false);
async function toggleMM(btn) {
  const host = $('mm');
  if (mmOpen) { mmOpen.close(); return; }
  btn.disabled = true; btn.textContent = 'Loading MixingMagic...';
  try {
    const mod = await import(MM);
    if (groove.playing) { stopAuto(); pause(); }                                  // MixingMagic has its own sound: this page's music steps aside
    host.hidden = false;
    mmOpen = await mod.mount(host, { onClose: () => { host.hidden = true; host.replaceChildren(); mmOpen = null; btn.textContent = 'Open MixingMagic: the full instrument'; btn.setAttribute('aria-expanded', 'false'); btn.focus(); } });
    btn.textContent = 'Close MixingMagic'; btn.setAttribute('aria-expanded', 'true');
    host.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  } catch (e) {
    host.hidden = false; host.replaceChildren(Object.assign(document.createElement('p'), { className: 'say', innerHTML: 'MixingMagic did not load here. <a href="/darklabs/mixingmagic/">Open it on its own page</a>.' }));
    btn.textContent = 'Open MixingMagic: the full instrument';
  }
  btn.disabled = false;
}

/* ---------- hover a card, hear a meow in the key ---------- */
document.querySelectorAll('[data-n]').forEach((el) => {
  const ping = () => groove.ping(+el.dataset.n);
  el.addEventListener('pointerenter', ping); el.addEventListener('focus', ping);
});

/* ---------- which section are we in ---------- */
const links = [...document.querySelectorAll('.bar nav a')];
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.getAttribute('href') === `#${e.target.id}`)); }), { rootMargin: '-45% 0px -45% 0px' });
document.querySelectorAll('.screen').forEach((s) => io.observe(s));

/* ---------- the frame loop: scroll -> music, the autoscroll, the tonearm, the little caption ---------- */
const FOCUS_NAME = { hats: 'hi-hats', snare: 'snare', kick: 'kick drum', toms: 'toms', ride: 'ride cymbal', splash: 'splash and crash', china: 'china cymbal', kit: 'the full kit' };
let armDeg0, lastNow = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000); frame.last = now;
  const p = progress();
  groove.setProgress(reduce ? Math.min(p, 0.3) : p);
  if (auto.on) {                                                                  // the slow glide, easing in as the needle settles
    const m = root.scrollHeight - innerHeight, ease = Math.min(1, (now - auto.t0) / 2500);
    if (Math.abs(scrollY - auto.set) > 3) stopAuto();                              // the reader moved the page themselves
    else { auto.y = Math.min(m, auto.y + (m / AUTO_SECS) * ease * dt); auto.set = auto.y; scrollTo({ top: auto.y, behavior: 'instant' }); if (auto.y >= m - 1) stopAuto(); }
  }
  const armDeg = auto.on || (groove.playing && scrollY > 0 && p < 0.995) ? ARM_OUT + (ARM_IN - ARM_OUT) * p : (groove.playing && p >= 0.995 ? ARM_IN : ARM_REST);
  if (Math.abs(armDeg - (armDeg0 ?? 999)) > 0.05) { $('arm').style.transform = `translate(196px,26px) rotate(${armDeg.toFixed(2)}deg)`; armDeg0 = armDeg; }
  if (now - lastNow > 250) {
    lastNow = now;
    const s = groove.state;
    $('now').textContent = groove.playing ? `${Math.round(s.bpm)} BPM · ${FOCUS_NAME[focusAt(s.p)] || ''}` : 'press play';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- the pointer ---------- */
const setCursor = (on) => { root.dataset.cursor = on ? 'stick' : 'off'; $('curBtn').textContent = `Drumstick pointer: ${on ? 'on' : 'off'}`; store.set('dd.cursor', on ? '1' : '0'); };
$('curBtn').addEventListener('click', () => setCursor(root.dataset.cursor !== 'stick'));
setCursor(store.get('dd.cursor', '1') === '1');

/* ---------- easter eggs: the roll of film, a dinosaur, and the Konami negative ---------- */
const FRAMES = { 1: 'Exposure: you, looking.', 2: 'Stop bath. Nothing here is moving.', 3: 'A drummer, on a break.', 4: null, 5: 'Fixer. Do not open the door.', 6: 'A contact sheet, but real.', 7: 'Dust. Always dust.', 8: 'There is no ninth frame. Try: ↑ ↑ ↓ ↓ ← → ← → B A' };
let found = new Set(); try { found = new Set(JSON.parse(store.get('dd.frames', '[]'))); } catch (e) { /* storage may be blocked */ }
const showFound = () => { $('found').textContent = `Frames developed: ${found.size} / 8${found.size === 8 ? ' · roll complete' : ''}`; document.querySelectorAll('.frame').forEach((f) => { const on = found.has(+f.dataset.f); f.classList.toggle('found', on); f.setAttribute('aria-label', `Film frame 0${f.dataset.f}, ${on ? 'developed' : 'undeveloped'}`); }); };
const shutter = () => groove.ping(76, 0.35);
function negative(on) { const next = on === undefined ? !root.classList.contains('neg') : on; root.classList.toggle('neg', next); shutter(); toast(next ? 'Negative developed. Same again to reverse it.' : 'Back to positive.'); }
document.querySelectorAll('.frame').forEach((f) => f.addEventListener('click', () => {
  const n = +f.dataset.f; shutter(); const wasNew = !found.has(n); found.add(n); store.set('dd.frames', JSON.stringify([...found]));
  showFound(); if (n === 4) $('dino').showModal(); else toast(FRAMES[n]);
  if (wasNew && found.size === 8) setTimeout(() => { toast('Roll developed. Here is the negative.'); negative(true); }, 900);
}));
$('dinoX').addEventListener('click', () => $('dino').close()); $('dino').addEventListener('click', (e) => { if (e.target === $('dino')) $('dino').close(); });
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']; let ki = 0, typed = '';
addEventListener('keydown', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  ki = k === KONAMI[ki] ? ki + 1 : (k === KONAMI[0] ? 1 : 0); if (ki === KONAMI.length) { ki = 0; negative(); }
  if (e.key.length === 1) { typed = (typed + k).slice(-4); if (typed === 'dino') { typed = ''; found.add(4); showFound(); $('dino').showModal(); } }
});
let taps = 0, tapT = 0; document.querySelector('.logo').addEventListener('click', () => { const t = performance.now(); taps = t - tapT < 900 ? taps + 1 : 1; tapT = t; if (taps >= 7) { taps = 0; negative(); } });   // mobile: tap the logo seven times
showFound();
window.__home = { groove, scene, progress, auto, desk };
