/* ==========================================================================
   LUMEN — the scroll-film hero. Canvas + pre-extracted JPEG frames, scrubbed by
   scroll. ImageBitmap sliding window (off-thread decode), lerped playhead,
   beat overlays, chapter + receipt HUD, adaptive nav, seam handoff, dev contract.
   Reads film/manifest.json: { dir, count, width, height, fps, seam, mobile:{dir,count},
   chapters:[{at,label}], receipt:{route,rate,seconds} }.
   ========================================================================== */
(() => {
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const JUMP = new URLSearchParams(location.search).get('jump');
if(JUMP !== null) history.scrollRestoration = 'manual';

const sec = $('#film'), stage = $('#film .stage'), canvas = $('#filmCanvas');
if(!sec || !canvas){ window.__ready = true; return; }
const ctx = canvas.getContext('2d', {alpha:false, desynchronized:true});
const beats = $$('#film .beat').map(el => ({el, in:+el.dataset.in, peak:+el.dataset.peak, out:+el.dataset.out}));
const hud = { ch: $('#hudChapter'), n: $('#hudN'), bar: $('#hudBar'), amt: $('#hudAmt'), sec: $('#hudSec'), stamp: $('#hudStamp') };
const finPrice = $('#finPrice'); let finDone = false;
const handoff = $('#film .handoff'), vig = $('#film .vig');
const nav = $('.nav');
const splashCv = $('#splashCanvas'); const sctx = splashCv ? splashCv.getContext('2d') : null;
const money = window.lumenMoney || (v => '$' + v.toFixed(2));

const FILM = { dir:'', count:0, w:1280, h:720, fps:24, seam:'#070605', chapters:[], receipt:null };
const state = { p:0, target:0, current:0, displayed:-1, ready:false, loaded:0 };
const images = [], bitmaps = new Map(), decoding = new Set(), failed = new Set();
let AHEAD = 48, KEEP = 32, bmpCenter = -999, inflight = 0, queue = [], pumpMax = 10;
const mq = matchMedia('(max-width: 768px)');

const readyP = new Promise(res => { state._resolve = res; });
window.LUMEN_FILM = { ready: readyP, progress: () => state.p };

/* ---------------- manifest ---------------- */
function pick(m){
  const mob = mq.matches && m.mobile && m.mobile.count ? m.mobile : null;
  FILM.dir = (mob ? mob.dir : m.dir).replace(/\/?$/, '/');
  FILM.count = mob ? mob.count : m.count;
  FILM.w = mob && mob.width ? mob.width : (m.width || 1280);
  FILM.h = mob && mob.height ? mob.height : (m.height || 720);
  FILM.fps = m.fps || 24; FILM.seam = m.seam || '#070605';
  FILM.chapters = m.chapters || []; FILM.receipt = m.receipt || null; FILM.splash = m.splash || null; if(FILM.splash) seedSplash(FILM.splash);
  AHEAD = Math.round(FILM.fps * 2); KEEP = Math.round(FILM.fps * 1.3);
  // scroll length follows the film's runtime: VH_PER_SECOND of scroll per second of film (≈15 px per frame at 900px tall)
  const secs = (m.receipt && m.receipt.seconds) || FILM.count / FILM.fps;
  sec.style.height = `calc(100vh + ${Math.round(secs * (m.vhPerSecond || 45))}vh)`;
}
const frameUrl = i => `${FILM.dir}f_${String(i + 1).padStart(4, '0')}.jpg`;

/* ---------------- frame pump (concurrency-capped) ---------------- */
function load(i){
  if(images[i] || failed.has(i)) return;
  const im = new Image(); im.decoding = 'async';
  images[i] = im; inflight++;
  const done = () => { inflight--; state.loaded++; pump(); };
  im.onload = () => { done(); if(Math.abs(i - Math.round(state.current)) <= AHEAD) ensureBitmaps(Math.round(state.current), true); };
  im.onerror = () => { images[i] = null; failed.add(i); done(); };
  im.src = frameUrl(i);
}
function pump(){ while(inflight < pumpMax && queue.length){ load(queue.shift()); } }
function prioritise(center){
  // rebuild queue: nearest to the playhead first, then the rest in order
  const seen = new Set(); queue = [];
  for(let d = 0; d < FILM.count; d++){ for(const i of [center + d, center - d]){ if(i >= 0 && i < FILM.count && !images[i] && !seen.has(i)){ seen.add(i); queue.push(i); } } if(queue.length > 400) break; }
  pump();
}
function nearestFrame(i){
  if(images[i] && images[i].complete && images[i].naturalWidth) return images[i];
  for(let d = 1; d < FILM.count; d++){ const a = images[i - d], b = images[i + d]; if(a && a.complete && a.naturalWidth) return a; if(b && b.complete && b.naturalWidth) return b; }
  return null;
}

/* ---------------- ImageBitmap sliding window ---------------- */
function ensureBitmaps(center, force){
  if(!force && Math.abs(center - bmpCenter) < 3) return;
  bmpCenter = center;
  const lo = Math.max(0, center - KEEP), hi = Math.min(FILM.count - 1, center + AHEAD);
  for(let i = lo; i <= hi; i++){
    const im = images[i];
    if(bitmaps.has(i) || decoding.has(i) || !im || !im.complete || !im.naturalWidth) continue;
    decoding.add(i);
    createImageBitmap(im).then(b => {
      decoding.delete(i);
      if(i < bmpCenter - KEEP - 4 || i > bmpCenter + AHEAD + 4){ b.close(); return; }
      bitmaps.set(i, b);
      if(i === state.displayed) draw(i, true);
    }).catch(() => decoding.delete(i));
  }
  for(const k of Array.from(bitmaps.keys())) if(k < center - KEEP - 4 || k > center + AHEAD + 4){ bitmaps.get(k).close(); bitmaps.delete(k); }
}

/* ---------------- canvas ---------------- */
const MAX_CROP = 0.22;
function size(){
  const dpr = Math.min(1, devicePixelRatio || 1); // source is matched to the canvas width, not to device pixels
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; state.displayed = -1; }
  if(splashCv && (splashCv.width !== w || splashCv.height !== h)){ splashCv.width = w; splashCv.height = h; }
}
function draw(i, force){
  if(i === state.displayed && !force) return;
  const src = bitmaps.get(i) || nearestFrame(i); if(!src) return;
  const cw = canvas.width, ch = canvas.height, sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  const sCover = Math.max(cw / sw, ch / sh);
  const crop = 1 - Math.min(cw / (sw * sCover), ch / (sh * sCover));
  const s = crop > MAX_CROP ? Math.min(cw / sw, ch / sh) : sCover;
  const w = sw * s, h = sh * s;
  if(s !== sCover){ ctx.fillStyle = '#070605'; ctx.fillRect(0, 0, cw, ch); }
  ctx.drawImage(src, (cw - w) / 2, (ch - h) / 2, w, h);
  state.displayed = i;
}

/* ---------------- the splash: paint droplets that fly out with the scroll ---------------- */
// Deterministic from progress (no clock), so it scrubs both ways. Brand palette + the saturated few.
let drops = [];
function seedSplash(sp){
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const cols = sp.colors || ['#D8261C','#FF3B2E','#ECE4D6','#E0A526','#6F7A2E','#1FB5A8','#7A3FA8','#F26B1D'];
  drops = [];
  for(let i = 0; i < (sp.count || 140); i++){
    const a = rnd() * Math.PI * 2, sp0 = .35 + rnd() * .65, r = 6 + Math.pow(rnd(), 1.8) * 70;
    drops.push({ a, v: sp0, r, c: cols[Math.floor(rnd() * cols.length)], w: .6 + rnd() * 1.6, t0: rnd() * .25, g: .2 + rnd() * .8, tail: rnd() < .35 });
  }
}
function drawSplash(p){
  if(!sctx || !FILM.splash) return;
  const sp = FILM.splash, q = (p - sp.at) / (sp.len || .12);   // 0 → 1 across the burst
  const cw = splashCv.width, ch = splashCv.height;
  sctx.clearRect(0, 0, cw, ch);
  if(q <= 0 || q >= 1.6){ splashCv.style.display = 'none'; return; }
  splashCv.style.display = '';
  const ox = (sp.origin ? sp.origin[0] : .5) * cw, oy = (sp.origin ? sp.origin[1] : .45) * ch, R = Math.max(cw, ch) * .9;
  const fade = q < 1 ? 1 : 1 - (q - 1) / .6;
  sctx.globalAlpha = Math.max(0, fade);
  for(const d of drops){
    const t = Math.max(0, q - d.t0); if(t <= 0) continue;
    const e = 1 - Math.pow(1 - Math.min(1, t), 3);                    // burst out fast, then drift
    const dist = e * d.v * R;
    const x = ox + Math.cos(d.a) * dist, y = oy + Math.sin(d.a) * dist + d.g * t * t * ch * .35;
    const rr = d.r * (.4 + e * d.w) * (cw / 1440);
    const g = sctx.createRadialGradient(x - rr * .35, y - rr * .4, rr * .05, x, y, rr * 1.05);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.18, d.c); g.addColorStop(.85, d.c); g.addColorStop(1, 'rgba(0,0,0,.35)');
    sctx.fillStyle = d.c;
    if(d.tail){ const an = Math.atan2(y - oy, x - ox); sctx.beginPath(); sctx.ellipse(x - Math.cos(an) * rr * .9, y - Math.sin(an) * rr * .9, rr * 1.6, rr * .55, an, 0, Math.PI * 2); sctx.fill(); }
    sctx.fillStyle = g; sctx.beginPath(); sctx.arc(x, y, rr, 0, Math.PI * 2); sctx.fill();
  }
  sctx.globalAlpha = 1;
}

/* ---------------- adaptive nav (sample top strip luminance) ---------------- */
const probe = document.createElement('canvas'); probe.width = 16; probe.height = 4; const pctx = probe.getContext('2d', {willReadFrequently:true});
let lastProbe = 0;
function probeLight(now){
  if(now - lastProbe < 180 || !nav) return; lastProbe = now;
  try{ pctx.drawImage(canvas, 0, 0, canvas.width, Math.max(1, canvas.height * .12), 0, 0, 16, 4); const d = pctx.getImageData(0, 0, 16, 4).data; let l = 0; for(let i = 0; i < d.length; i += 4) l += d[i] * .299 + d[i+1] * .587 + d[i+2] * .114; l /= d.length / 4; nav.classList.toggle('on-light', l > 138 && state.p < .985); } catch(e){}
}

/* ---------------- beats + HUD ---------------- */
function beatAlpha(b, p){
  if(p < b.in || p > b.out) return 0;
  if(p < b.peak) return (p - b.in) / Math.max(1e-4, b.peak - b.in);
  if(b.out > 1.5) return 1;
  return 1 - (p - b.peak) / Math.max(1e-4, b.out - b.peak);
}
let lastChapter = -1;
function overlays(p){
  for(const b of beats){
    const a = beatAlpha(b, p); const e = Math.max(0, Math.min(1, a));
    const ease = e * e * (3 - 2 * e);
    b.el.style.opacity = ease.toFixed(3);
    b.el.style.transform = `translateY(-50%) translateY(${((1 - ease) * 26 * (p < b.peak ? 1 : -1)).toFixed(1)}px)`;
    b.el.style.visibility = e > 0.001 ? 'visible' : 'hidden';
  }
  if(hud.ch && FILM.chapters.length){
    let k = 0; for(let i = 0; i < FILM.chapters.length; i++) if(p >= FILM.chapters[i].at) k = i;
    if(k !== lastChapter){ lastChapter = k; hud.ch.textContent = FILM.chapters[k].label; hud.n.textContent = String(k).padStart(2, '0'); if(hud.stamp) hud.stamp.textContent = FILM.chapters[k].stamp || ''; sec.classList.toggle('light', !!FILM.chapters[k].light); }
    hud.bar.style.transform = `scaleX(${p.toFixed(4)})`;
  }
  if(hud.amt && FILM.receipt){
    const secs = p * FILM.receipt.seconds;
    hud.sec.textContent = secs.toFixed(1).padStart(4, '0') + ' s';
    hud.amt.textContent = money(secs * FILM.receipt.rate);
  }
  if(p > 0.002){ const mo = Math.max(0, 1 - p / .08).toFixed(3); for(const id of ['heroMeta','heroScroll']){ const e = document.getElementById(id); if(e) e.style.opacity = mo; } }
  if(finPrice){ // the price on the button resolves from noise as the last frames arrive
    const q = Math.max(0, Math.min(1, (p - .88) / .08));
    if(q <= 0){ finDone = false; }
    else if(q < 1){ finDone = false; const target = finPrice.dataset.price; finPrice.textContent = '$' + target.slice(1).split('').map((c, i) => (i / target.length) < q ? c : String(Math.floor(Math.random() * 10))).join(''); }
    else if(!finDone){ finDone = true; finPrice.textContent = '$' + finPrice.dataset.price; }
  }
  { // the last frame shrinks into a rounded card: the film hands off as an object, not a cut
    const c = Math.max(0, Math.min(1, (p - .9) / .1)), e = c * c * (3 - 2 * c);
    canvas.style.transform = c > 0 ? `scale(${(1 - .12 * e).toFixed(4)})` : ''; canvas.style.borderRadius = c > 0 ? `${(22 * e).toFixed(1)}px` : '0';
  }
  const ho = Math.max(0, Math.min(1, (p - .92) / .08));
  if(handoff) handoff.style.opacity = ho.toFixed(3);
  if(vig) vig.style.opacity = (1 - ho).toFixed(3);
}

/* ---------------- tick ---------------- */
let lastT = 0, jankMax = 0, jankLog = 0;
function progress(){
  const r = sec.getBoundingClientRect();
  return Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight)));
}
function tick(now){
  if(lastT){ const d = now - lastT; if(d > jankMax) jankMax = d; if(now - jankLog > 2000){ window.__jankMax = jankMax; jankLog = now; jankMax = 0; } }
  lastT = now;
  state.p = progress();
  state.target = state.p * (FILM.count - 1);
  state.current += (state.target - state.current) * (reduce ? 1 : .11);
  if(Math.abs(state.target - state.current) < .02) state.current = state.target;
  const idx = Math.round(state.current);
  ensureBitmaps(idx);
  if(idx !== state.displayed){ if(!images[idx]) prioritise(idx); draw(idx); }
  overlays(state.p); drawSplash(state.p);
  probeLight(now);
  requestAnimationFrame(tick);
}

/* ---------------- boot ---------------- */
async function boot(){
  let m;
  try{ m = await (await fetch('/landing/film/manifest.json', {cache:'no-cache'})).json(); }
  catch(e){ console.warn('film: no manifest', e); state._resolve(false); window.__ready = true; return; }
  if(!m || !m.count){ state._resolve(false); window.__ready = true; return; }
  pick(m);
  sec.style.setProperty('--seam', FILM.seam);
  size(); addEventListener('resize', () => { size(); draw(Math.round(state.current), true); });
  mq.addEventListener('change', () => { pick(m); for(const b of bitmaps.values()) b.close(); bitmaps.clear(); images.length = 0; failed.clear(); state.displayed = -1; prioritise(Math.round(state.current)); });

  // opening run first, then stream the rest
  const OPEN = Math.min(FILM.count, Math.round(FILM.fps * 2.5));
  const pre = $('#preN');
  await new Promise(res => {
    let got = 0; const need = OPEN;
    for(let i = 0; i < need; i++){ const im = new Image(); im.decoding = 'async'; images[i] = im; const f = () => { got++; if(pre) pre.textContent = String(Math.min(99, Math.round(got / need * 99))).padStart(2, '0'); if(got >= need) res(); }; im.onload = f; im.onerror = () => { images[i] = null; failed.add(i); f(); }; im.src = frameUrl(i); }
  });
  ensureBitmaps(0, true);
  draw(0, true);
  prioritise(OPEN);
  state.ready = true; state._resolve(true);
  requestAnimationFrame(tick);

  if(JUMP !== null){
    // dev contract: land pre-scrolled, settle every scroll-driven value, draw once
    scrollTo(0, +JUMP || 0);
    await new Promise(r => setTimeout(r, 120));
    state.p = progress(); state.current = state.target = state.p * (FILM.count - 1);
    const idx = Math.round(state.current);
    await new Promise(res => { let n = 0; const w = () => { if((images[idx] && images[idx].complete) || n++ > 80) res(); else setTimeout(w, 50); }; prioritise(idx); w(); });
    ensureBitmaps(idx, true); draw(idx, true); overlays(state.p); drawSplash(state.p);
    await new Promise(r => setTimeout(r, 300));
    draw(idx, true);
  }
  // ready means ready: the preloader has left the screen (cap 12 s so a stalled entrance never blocks the harness)
  await new Promise(res => { let n = 0; const w = () => { if(!document.getElementById('pre') || n++ > 240) res(); else setTimeout(w, 50); }; w(); });
  window.__ready = true;
}
if(reduce){
  // poster + copy only: the first frame, no scrub
  fetch('/landing/film/manifest.json').then(r => r.json()).then(m => { pick(m); size(); const im = new Image(); im.onload = () => { images[0] = im; draw(0, true); }; im.src = frameUrl(0); beats.forEach(b => { b.el.style.opacity = b.peak <= 0.01 ? 1 : 0; b.el.style.visibility = b.peak <= 0.01 ? 'visible' : 'hidden'; }); state._resolve(true); window.__ready = true; }).catch(() => { state._resolve(false); window.__ready = true; });
} else boot();
})();
