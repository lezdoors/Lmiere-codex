/* ==========================================================================
   LMIERE — landing behaviour
   ========================================================================== */
(() => {
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none)').matches;
const M = window.LUMEN_MODELS, money = window.lumenMoney;
const HAS = !!(window.gsap && window.ScrollTrigger);
if(HAS) gsap.registerPlugin(ScrollTrigger);
const fallbackStatic = () => {
  const pre = $('#pre'); if(pre) pre.remove(); document.body.classList.remove('no-scroll');
  $$('#film h1 .w span').forEach(e => e.style.transform='none');
  ['#heroSub','#heroMeta','#heroScroll','#ctaH .w span'].forEach(sel => $$(sel).forEach(e => { e.style.opacity=1; e.style.transform='none'; }));
  $$('.print .dev').forEach(e => e.style.opacity=0);
};

/* ---------------- lazy media ---------------- */
const vids = $$('video[data-src]').filter(v => v.id !== 'ribbon');
const io = new IntersectionObserver(es => es.forEach(e => {
  const v = e.target;
  if(e.isIntersecting){ if(!v.src){ v.src = v.dataset.src; v.load(); } if(!v.closest('.print')) v.play().catch(()=>{}); }
  else if(!v.closest('.print')) v.pause();
}), {rootMargin:'40% 0px'});
vids.forEach(v => io.observe(v));
const roomV = $('.pre .room'); if(roomV && !roomV.src){ roomV.src = roomV.dataset.src; roomV.play().catch(()=>{}); }

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if(!reduce && window.Lenis){
  lenis = new Lenis({lerp:.09, wheelMultiplier:1, smoothWheel:true});
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t*1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const t = $(a.getAttribute('href')); if(t){ e.preventDefault(); lenis.scrollTo(t, {offset:0, duration:1.4}); } }));
}

/* ---------------- preloader → hero ---------------- */
const pre = $('#pre'), preN = $('#preN');
if(!HAS){ fallbackStatic(); }
else {
document.body.classList.add('no-scroll');
const heroIn = () => {
  document.getElementById('film').classList.add('on');
  const tl = gsap.timeline({defaults:{ease:'expo.out'}});
  tl.to(pre, {yPercent:-100, duration:1.1, ease:'expo.inOut', onComplete:() => { pre.remove(); document.body.classList.remove('no-scroll'); ScrollTrigger.refresh(); }})
    .fromTo('#filmCanvas', {scale:1.1}, {scale:1, duration:2.2, clearProps:'transform'}, '-=0.9')
    .to('#film h1 .w span', {y:0, duration:1.3, stagger:.12}, '-=1.9')
    .to('#heroSub', {opacity:1, y:0, duration:1.1}, '-=0.9')
    .to('#heroMeta', {opacity:1, duration:1}, '-=0.7')
    .to('#heroScroll', {opacity:1, duration:.8}, '-=0.6');
};
if(reduce){ pre.remove(); document.body.classList.remove('no-scroll'); document.getElementById('film').classList.add('on'); }
else {
  const n = {v:0}; let ready = false, done = false;
  const finish = () => { if(done) return; done = true; heroIn(); };
  // the counter is driven by the film's opening frames (film.js writes #preN); this is the floor timing + the fallback
  gsap.to(n, {v:100, duration:1.9, ease:'power2.inOut', onComplete:() => { ready = true; if(filmOk) finish(); else setTimeout(finish, 6000); }});
  gsap.to('.pre .glow', {scale:1, opacity:1, duration:2.2, ease:'power2.out'});
  let filmOk = false;
  (window.LUMEN_FILM ? window.LUMEN_FILM.ready : Promise.resolve(false)).then(() => { filmOk = true; preN.textContent = '100'; if(ready) finish(); });
}
} // HAS

/* ---------------- marquee ---------------- */
const marq = $('#marq');
const items = M.map(m => `<span><i></i><b>${m.name}</b>${money(m.rate)}${m.kind==='video'?'/s':''}</span>`).join('');
marq.innerHTML = items + items;
if(HAS && !reduce) gsap.to(marq, {xPercent:-50, duration:60, ease:'none', repeat:-1});
else marq.style.animation = 'marq 60s linear infinite';

/* ---------------- the sentence travels: scrub the ink to the scroll ---------------- */
(() => {
  const sec = $('#travel'), v = $('#ribbon'); if(!sec || !v) return;
  v.src = v.dataset.src; v.load(); v.pause();
  const lines = $$('.travel .ln');
  const showLine = p => lines.forEach((l, i) => { const at = Number(l.dataset.at), next = lines[i+1] ? Number(lines[i+1].dataset.at) : 1.05; const on = p >= at && p < next; if(HAS) gsap.to(l, {opacity:on?1:0, y:on?0:(p<at?24:-24), duration:.6, ease:'expo.out', overwrite:true}); else { l.style.opacity = on?1:0; } });
  if(!HAS || reduce){ v.loop = true; v.play().catch(()=>{}); lines[0].style.opacity = 1; const dv = $('#travelDev'); if(dv) dv.style.opacity = 0; return; }
  let target = 0, cur = 0, dur = 0;
  v.addEventListener('loadedmetadata', () => { dur = v.duration; });
  gsap.ticker.add(() => { if(!dur) return; cur += (target - cur) * .12; const t = Math.max(0, Math.min(dur - .05, cur * dur)); if(Math.abs(v.currentTime - t) > .02) v.currentTime = t; });
  ScrollTrigger.create({trigger:sec, start:'top top', end:'+=260%', pin:'.travel .stage', scrub:true, anticipatePin:1, refreshPriority:2, onUpdate:s => { target = s.progress; showLine(s.progress); }});
  const dev = $('#travelDev'); if(dev) ScrollTrigger.create({trigger:sec, start:'top 90%', end:'top top', scrub:true, onUpdate:s => { dev.style.opacity = (0.92 * (1 - s.progress)).toFixed(3); }});
  showLine(0);
})();

/* ---------------- prints: horizontal scroll ---------------- */
const track = $('#printsTrack'), wrap = $('#printsWrap');
let printsST;
const buildPrints = () => {
  if(printsST){ printsST.kill(); printsST = null; }
  if(!HAS || innerWidth < 820 || reduce){ wrap.style.height = 'auto'; track.style.overflowX = 'auto'; track.style.height = 'auto'; track.style.padding = '60px var(--gutter)'; track.style.transform='none'; $$('.print .dev').forEach(d => d.style.opacity = 0); return; }
  wrap.style.height = ''; track.style.overflowX = ''; track.style.height = ''; track.style.padding = '';
  const dist = () => track.scrollWidth - innerWidth;
  const tween = gsap.to(track, {x:() => -dist(), ease:'none', scrollTrigger:{trigger:wrap, start:'top top', end:() => '+=' + dist(), scrub:.8, pin:true, anticipatePin:1, invalidateOnRefresh:true, refreshPriority:1}});
  printsST = tween.scrollTrigger;
  $$('.print').forEach(p => {
    gsap.to(p.querySelector('.dev'), {opacity:0, duration:1.2, ease:'power2.out', scrollTrigger:{trigger:p, containerAnimation:tween, start:'left 70%', toggleActions:'play none none reverse'}});
  });
};
buildPrints();
addEventListener('resize', () => { clearTimeout(buildPrints._t); buildPrints._t = setTimeout(() => { buildPrints(); ScrollTrigger.refresh(); }, 250); });
$$('.print').forEach(p => {
  const v = p.querySelector('video');
  const on = () => { if(!v) return; if(!v.src){ v.src = v.dataset.src; v.load(); } p.classList.add('playing'); v.play().catch(()=>{}); };
  const off = () => { if(!v) return; p.classList.remove('playing'); v.pause(); };
  p.addEventListener('mouseenter', on); p.addEventListener('mouseleave', off);
  if(touch) p.addEventListener('click', () => p.classList.contains('playing') ? off() : on());
});

/* ---------------- section reveals ---------------- */
$$('.sec-head, .move, .instr .left, .instr .glass, .oc, .q, .prices .note').forEach(el => { el.classList.add('rv'); });
if(HAS && !reduce) ScrollTrigger.batch('.rv', {start:'top 88%', onEnter:b => gsap.to(b, {opacity:1, y:0, duration:1.1, stagger:.08, ease:'expo.out', overwrite:true})});
else $$('.rv').forEach(e => { e.style.opacity=1; e.style.transform='none'; });

/* ---------------- manifesto words ---------------- */
const mt = $('#maniText');
const emph = new Set(['dollar','button.','read','press','once,','money.','expires.']);
mt.innerHTML = mt.textContent.trim().split(/\s+/).map(w => `<span class="w ${emph.has(w.toLowerCase())?'em':''}">${w}</span>`).join(' ');
const words = $$('#maniText .w');
if(!HAS || reduce) words.forEach(w => w.classList.add('on'));
else ScrollTrigger.create({trigger:'#manifesto', start:'top 60%', end:'bottom 90%', scrub:true, onUpdate:s => { const k = Math.floor(s.progress * words.length * 1.15); words.forEach((w,i) => w.classList.toggle('on', i < k)); }});

/* ---------------- CTA ---------------- */
if(HAS) gsap.to('#ctaH .w span', {y:0, duration:1.4, stagger:.14, ease:'expo.out', scrollTrigger:{trigger:'.cta', start:'top 60%'}});

/* ---------------- clock ---------------- */
const clock = $('#clock');
const tick = () => { const d = new Date(); clock.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2,'0')).join(':'); };
tick(); setInterval(tick, 1000);

/* ---------------- rate card ---------------- */
const col = kind => `<div class="col"><h4><span>${kind==='video'?'Motion — per second':'Stills — per image'}</span><span>Rate</span></h4>${M.filter(m=>m.kind===kind).map((m,i) => `<div class="prow"><span class="i">${String(i+1).padStart(2,'0')}</span><span class="n">${m.name}<small>${m.slug}${m.note?' — '+m.note:''}</small></span><span class="r num">${money(m.rate)}<em>${m.kind==='video'?'/ s':m.cond==='per image'?'':'/ '+m.cond}</em></span></div>`).join('')}</div>`;
if($('#priceTable')) $('#priceTable').innerHTML = col('video') + col('image');

/* ==========================================================================
   THE INSTRUMENT — live pricer + developing tray
   ========================================================================== */
const panel = $('#panel');
const d = {mode:'video', model:'nanobanana', vmodel:'kling3s', length:5, sound:false, res:null, frame:'4:3', prompt:'A figure at the edge of a sun that has not risen'};
const STILLS = ['p-sunrise','p-lava','p-dancer','p-portrait','p-cube','p-glass'];
const CLIPS = ['sunrise','lava','dancer'];
let plateIx = 0, busy = false, shown = 0;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function render(){
  const p = window.lumenPrice(d); const cur = p.m; const isV = d.mode==='video';
  const list = M.filter(m => m.kind === (isV?'video':'image'));
  panel.innerHTML = `
    <div class="row"><div class="lab">Mode</div><div class="seg"><button data-set="mode" data-v="image" class="${!isV?'on':''}">Still</button><button data-set="mode" data-v="video" class="${isV?'on':''}">Motion</button></div></div>
    <div class="row"><div class="lab">Route</div><div class="mlist">${list.map(m => `<button class="mrow ${cur.id===m.id?'on':''}" data-set="${isV?'vmodel':'model'}" data-v="${m.id}"><span class="n"><i></i>${m.name}<small>${m.cond}</small></span><span class="r num">${money(m.rate)}${m.kind==='video'?'/s':''}</span></button>`).join('')}</div></div>
    ${isV ? `<div class="row"><div class="lab">Length</div><div class="chips">${cur.lengths.map(l => `<button class="chip ${p.len===l?'on':''}" data-set="length" data-v="${l}"><span class="num">${l} s</span><small class="num">${money(p.rate*l)}</small></button>`).join('')}</div></div>
    <div class="row"><div class="lab">Sound</div><div class="chips"><button class="chip ${!d.sound?'on':''}" data-set="sound" data-v="0">Off</button><button class="chip ${d.sound?'on':''}" data-set="sound" data-v="1" ${cur.audioRate?'':'disabled'}>On ${cur.audioRate?`<small class="num">${money(cur.audioRate)}/s</small>`:'<small>not offered</small>'}</button></div></div>`
    : `<div class="row"><div class="lab">Frame</div><div class="chips">${window.LUMEN_FRAMES.map(f => `<button class="chip ${d.frame===f?'on':''}" data-set="frame" data-v="${f}"><span class="num">${f}</span></button>`).join('')}</div></div>
    ${cur.res ? `<div class="row"><div class="lab">Size</div><div class="chips">${Object.entries(cur.res).map(([k,mult]) => `<button class="chip ${p.res===k?'on':''}" data-set="res" data-v="${k}">${k}<small class="num">${money(cur.rate*mult)}</small></button>`).join('')}</div></div>` : ''}`}
    <div class="row"><div class="lab">Sentence</div><div>
      <textarea class="prompt" id="prompt" rows="2" placeholder="Describe the unseen. One ordinary sentence.">${esc(d.prompt)}</textarea>
      <div class="receipt num" id="receipt">${p.line}</div>
      <button class="gen" id="go" data-cursor="PRESS"><span id="goLabel">Develop</span><span class="amt num"><span id="amt">${money(p.amount)}</span><small>on completion</small></span></button>
      <div class="fine" id="fine">You approve this exact amount · a failed run releases it</div>
      <div class="tray idle" id="tray"><img id="trayImg" src="${mediaUrl(`/landing/assets/media/${STILLS[0]}.jpg`)}" alt=""><div class="liquid"></div><div class="bar" id="trayBar"></div><div class="empty" id="trayEmpty">Press the button. The print develops here, in the safelight.</div><div class="hud num"><span id="hudL">Tray · empty</span><span id="hudR">00:00</span></div></div>
    </div></div>`;
}
render();
let lastAmt = window.lumenPrice(d).amount;
function tweenAmount(){
  const to = window.lumenPrice(d).amount; const o = {v:lastAmt}; const el = $('#amt');
  if(HAS) gsap.to(o, {v:to, duration:.5, ease:'power3.out', onUpdate:() => el.textContent = money(o.v)}); else el.textContent = money(to);
  lastAmt = to;
}
panel.addEventListener('click', e => {
  const b = e.target.closest('[data-set]'); if(!b || b.disabled || busy) return;
  const k = b.dataset.set; let v = b.dataset.v; if(k==='length') v = Number(v); if(k==='sound') v = v==='1';
  d[k] = v;
  if(k==='model' || k==='vmodel'){ d.res = null; const m = window.lumenModel(v); if(m && m.lengths && !m.lengths.includes(d.length)) d.length = m.lengths[0]; }
  d.prompt = $('#prompt').value; render(); tweenAmount();
  if(e.target.closest('#go')) return;
});
panel.addEventListener('input', e => { if(e.target.id==='prompt') d.prompt = e.target.value; });
panel.addEventListener('click', e => { if(e.target.closest('#go')) develop(); });
document.addEventListener('keydown', e => { if((e.metaKey||e.ctrlKey) && e.key==='Enter' && document.activeElement && document.activeElement.id==='prompt'){ e.preventDefault(); develop(); } });

const CLEAR = 'blur(0px) contrast(1) brightness(1) sepia(0) hue-rotate(0deg) saturate(1)';
const WET   = 'blur(22px) contrast(1.5) brightness(0.35) sepia(1) hue-rotate(-30deg) saturate(3)';
const REST  = 'blur(0px) contrast(1.2) brightness(0.25) sepia(0.9) hue-rotate(-20deg) saturate(2)';
function develop(){
  if(busy) return;
  d.prompt = ($('#prompt').value || '').trim();
  const fine = $('#fine');
  if(!d.prompt){ fine.textContent = 'Write the thing first — one sentence is enough.'; fine.classList.add('err'); $('#prompt').focus(); return; }
  fine.classList.remove('err');
  const p = window.lumenPrice(d); busy = true;
  const tray = $('#tray'), img = $('#trayImg'), bar = $('#trayBar'), hudL = $('#hudL'), hudR = $('#hudR'), go = $('#go'), lab = $('#goLabel');
  const isV = p.m.kind==='video';
  const dur = isV ? 6.5 : 3.6;
  // swap the plate: a new still (or clip) each press
  const key = isV ? CLIPS[plateIx % CLIPS.length] : STILLS[plateIx % STILLS.length]; plateIx++;
  let media = img;
  if(isV){ const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.src = mediaUrl(`/landing/assets/media/${key}.mp4`); v.poster = mediaUrl(`/landing/assets/media/${key}.jpg`); img.replaceWith(v); media = v; v.id = 'trayImg'; v.play().catch(()=>{}); }
  else { if(img.tagName==='VIDEO'){ const i = document.createElement('img'); i.id='trayImg'; i.alt=''; img.replaceWith(i); media = i; } media.src = mediaUrl(`/landing/assets/media/${key}.jpg`); }
  tray.classList.remove('idle'); $('#trayEmpty').style.display = 'none';
  go.classList.add('busy'); lab.textContent = 'Developing';
  fine.textContent = `${money(p.amount)} held · ${p.m.name}${isV?' · '+p.len+' s':''}`;
  if(!HAS){ media.style.filter = WET; media.style.transition = `filter ${dur}s ease-in-out`; bar.style.transition = `transform ${dur}s linear`; requestAnimationFrame(() => { media.style.filter = CLEAR; bar.style.transform = 'scaleX(1)'; }); setTimeout(() => { busy=false; go.classList.remove('busy'); lab.textContent='Develop again'; hudL.textContent=`Charged ${money(p.amount)} · ${p.m.name}`; }, dur*1000); return; }
  gsap.set(media, {filter:WET, scale:1.08});
  gsap.set(bar, {scaleX:0});
  const t0 = performance.now();
  const tl = gsap.timeline({onUpdate:() => { const s = (performance.now()-t0)/1000; hudR.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`; hudL.textContent = `Developing · ${Math.round(tl.progress()*100)}%`; },
    onComplete:() => {
      busy = false; go.classList.remove('busy'); lab.textContent = 'Develop again';
      hudL.textContent = `Charged ${money(p.amount)} · ${p.m.name}`;
      fine.innerHTML = `Charged <b class="num" style="color:var(--paper)">${money(p.amount)}</b> on completion · <a href="/studio?prompt=${encodeURIComponent(d.prompt)}" style="color:var(--paper);text-decoration:underline;text-underline-offset:3px">open the studio to run the real thing →</a>`;
    }});
  tl.to(bar, {scaleX:1, duration:dur, ease:'none'}, 0)
    .to(media, {filter:CLEAR, scale:1, duration:dur, ease:'power2.inOut'}, 0);
}

/* ---------------- nav pill contrast on paper section ---------------- */
if(HAS) ScrollTrigger.create({trigger:'#manifesto', start:'top 40px', end:'bottom 40px', onToggle:s => document.querySelector('.nav').classList.toggle('on-paper', s.isActive)});

if(HAS) addEventListener('load', () => ScrollTrigger.refresh());
})();
