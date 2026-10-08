/* Home page tests: the markup, the labels, the shortcuts, and that every file the page loads exists. Run from this repo's root:  node --test tests/home.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync('index.html', 'utf8'), js = fs.readFileSync('site.js', 'utf8'), css = fs.readFileSync('site.css', 'utf8');

test('the page has the stage, the volume control, and the mixing desk mount', () => {
  for (const id of ['kit', 'snd', 'vol', 'mute', 'now', 'mixer', 'mm', 'drop', 'enter', 'deck', 'toast', 'dino']) assert.ok(html.includes(`id="${id}"`), `#${id}`);
  assert.ok(/<canvas id="kit"[^>]*aria-label=/.test(html), 'the drummer has a text description');
  assert.ok(/<input id="vol" type="range"/.test(html));
});

test('no NEW, LIVE or PREVIEW labels: symbols with explanations instead', () => {
  assert.ok(!/>(NEW|LIVE|PREVIEW|FEATURED)</.test(html));
  const tags = [...html.matchAll(/<i class="tag"[^>]*data-tip="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(tags.length >= 5);
  for (const t of tags) assert.ok(t.length > 25 && t.includes(':'), `tooltip is descriptive: ${t}`);
  assert.ok(/aria-label="Featured"/.test(html) && /aria-label="VR"/.test(html) && /aria-label="Work in progress"/.test(html));
});

test('volume: Ctrl or Cmd + Up and Down change it, in tenths, clamped, and it is remembered', () => {
  assert.ok(/e\.ctrlKey \|\| e\.metaKey/.test(js) && /'ArrowUp'/.test(js) && /'ArrowDown'/.test(js));
  assert.ok(/groove\.volume \+ \(e\.key === 'ArrowUp' \? 0\.1 : -0\.1\)/.test(js));
  assert.ok(/Math\.min\(1, Math\.max\(0, v\)\)/.test(js));
  assert.ok(/dd\.vol/.test(js));
});

test('readable by default: no cursor-following darkness, no heavy glow, text colours with room to spare', () => {
  assert.ok(!/#dark|#glow|--beam|--mx|--my/.test(css + html + js));
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  assert.ok(ratio('#f2e8e8', '#070304') > 14, 'body text');
  assert.ok(ratio('#c4b0b0', '#140a0c') > 7, 'secondary text on cards');
  assert.ok(ratio('#ff6b78', '#070304') > 7, 'accent text');
});

test('the drumstick pointer can be switched off, and keyboard focus is visible', () => {
  assert.ok(/id="curBtn"/.test(html) && /dd\.cursor/.test(js) && /data-cursor/.test(css));
  assert.ok(/:focus-visible/.test(css));
});

test('every local file the page, its script and the engine load exists, and every import resolves', () => {
  const need = new Set(['site.css', 'site.js']);
  for (const m of html.matchAll(/(?:href|src)="([^"#:]+\.(?:css|js))"/g)) need.add(m[1]);
  for (const f of need) assert.ok(fs.existsSync(f), `${f} exists`);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  for (const f of ['site.js', ...walk('kit/groove').filter((x) => x.endsWith('.js') && !x.includes('worklets'))]) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/from '(\.[^']+)'/g)) assert.ok(fs.existsSync(path.join(path.dirname(f), m[1])), `${f} imports ${m[1]}`);
  }
  for (const s of ['classic', 'chirp', 'swell']) assert.ok(fs.existsSync(`samples/${s}.mp3`));
  for (const w of ['bass-worklet.js', 'cello-worklet.js']) assert.ok(fs.existsSync(`kit/groove/worklets/${w}`));
});

test('the page starts quietly: nothing audio is created until Play is pressed', () => {
  assert.ok(!/new (Audio|Offline)?AudioContext|new AC\(/.test(js), 'site.js makes no audio context itself');
  assert.ok(/await groove\.start\(\)/.test(js));
  const engine = fs.readFileSync('kit/groove/engine.js', 'utf8');
  assert.ok(/async start\(\)/.test(engine) && /new AC\(/.test(engine));
});

test('the files are small', () => {
  assert.ok(html.length < 24000, `index.html ${html.length}`);
  assert.ok(js.length < 14000, `site.js ${js.length}`);
  const total = ['arrange', 'bank', 'engine', 'scene', 'desk'].reduce((n, f) => n + fs.statSync(`kit/groove/${f}.js`).size, 0);
  assert.ok(total < 60000, `engine ${total}`);
});
