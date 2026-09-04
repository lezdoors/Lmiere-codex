/* ==========================================================================
   LUMEN — studio. State in localStorage. Generation runs through /api (fal)
   when the site is deployed with FAL_KEY; otherwise it is simulated so the
   whole flow — hold, develop, charge or release — still works end to end.
   ========================================================================== */
(() => {
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const M = window.LUMEN_MODELS, money = window.lumenMoney, modelById = window.lumenModel;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const when = ts => new Date(ts).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const uid = () => Math.random().toString(36).slice(2,9);
const money2 = n => '$' + n.toFixed(2);

const VIEWS = [
  {id:'studio', label:'Studio', render:vStudio},
  {id:'queue', label:'Queue', render:vQueue},
  {id:'prints', label:'Prints', render:vPrints},
  {id:'ledger', label:'Ledger', render:vLedger},
  {id:'models', label:'Models', render:vModels},
  {id:'settings', label:'Settings', render:vSettings},
];

/* ---------------- state ---------------- */
const DEF = {
  balance:10, runs:[], ledger:[],
  settings:{mode:'video', model:'nanobanana', vmodel:'kling3s'},
  draft:{prompt:'', mode:'video', model:'nanobanana', vmodel:'kling3s', length:5, sound:false, res:null, frame:'16:9'},
};
let S = load();
function load(){
  try{ const raw = localStorage.getItem('lumen.studio.v1'); if(raw){ const s = JSON.parse(raw); return {...DEF, ...s, settings:{...DEF.settings, ...(s.settings||{})}, draft:{...DEF.draft, ...(s.draft||{})}}; } }catch(e){}
  const s = JSON.parse(JSON.stringify(DEF));
  s.ledger.push({id:uid(), ts:Date.now(), label:'Sample balance to start with — no card is charged here', amount:10, status:'credit'});
  return s;
}
function save(){ try{ localStorage.setItem('lumen.studio.v1', JSON.stringify(S)); }catch(e){} }
// prompt handed over from the landing page
const qp = new URLSearchParams(location.search).get('prompt'); if(qp){ S.draft.prompt = qp; save(); history.replaceState(null,'',location.pathname + location.hash); }

/* ---------------- provider ---------------- */
let LIVE = false;
const modeTag = $('#modeTag');
fetch('api/health').then(r => r.ok ? r.json() : null).then(j => { LIVE = !!(j && j.ok && j.key); paintMode(); }).catch(() => { LIVE = false; paintMode(); });
function paintMode(){ modeTag.classList.toggle('live', LIVE); modeTag.innerHTML = `<i></i>${LIVE ? 'Provider live' : 'Simulated — no provider key'}`; }

/* real: through the serverless proxy → fal queue */
async function runReal(job, onProgress){
  const m = modelById(job.modelId);
  const input = {prompt: job.prompt};
  if(m.kind==='video'){ input.duration = String(job.length); input.aspect_ratio = '16:9'; if(m.audioRate) input.generate_audio = !!job.sound; }
  else { input.aspect_ratio = job.frame; if(job.res) input.resolution = job.res; input.num_images = 1; }
  const r = await fetch('api/generate', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({slug:m.slug, input})});
  if(!r.ok) throw new Error((await r.json().catch(()=>({}))).error || `Provider refused (${r.status})`);
  const q = await r.json();
  const status_url = q.status_url, response_url = q.response_url;
  if(!status_url) throw new Error('No status url from provider');
  const t0 = Date.now(), est = m.kind==='video' ? 90000 : 12000;
  for(;;){
    await new Promise(r => setTimeout(r, 2500));
    const s = await fetch('api/status?u=' + encodeURIComponent(status_url)).then(r => r.json());
    onProgress(Math.min(.95, (Date.now()-t0)/est));
    if(s.status==='COMPLETED') break;
    if(s.status==='FAILED' || s.error) throw new Error(s.error || 'Provider failed the run');
  }
  const out = await fetch('api/status?u=' + encodeURIComponent(response_url)).then(r => r.json());
  const url = (out.video && out.video.url) || (out.images && out.images[0] && out.images[0].url) || (out.image && out.image.url) || (out.output && out.output.url);
  if(!url) throw new Error('Provider returned no output');
  return {url, remote:true};
}
/* simulated: paints a plate from the prompt, on the same contract */
const SAMPLE_STILLS = ['p-sunrise','p-lava','p-dancer','p-portrait','p-cube','p-glass'];
const SAMPLE_CLIPS = ['sunrise','lava','dancer'];
let sampleIx = Math.floor(Math.random()*6);
async function runSim(job, onProgress){
  const dur = job.kind==='video' ? 9000 + Math.random()*4000 : 3200 + Math.random()*1800;
  const t0 = Date.now();
  await new Promise((res, rej) => { const tick = () => { const p = Math.min(1,(Date.now()-t0)/dur); onProgress(p); if(p>=1) return (Math.random()<0.05 ? rej(new Error('Provider returned no output')) : res()); setTimeout(tick, 120); }; tick(); });
  const key = job.kind==='video' ? SAMPLE_CLIPS[sampleIx % SAMPLE_CLIPS.length] : SAMPLE_STILLS[sampleIx % SAMPLE_STILLS.length]; sampleIx++;
  return {url: mediaUrl(job.kind==='video' ? `assets/media/${key}.mp4` : `assets/media/${key}.jpg`), poster:mediaUrl(`assets/media/${key}.jpg`), sample:true};
}

/* ---------------- jobs ---------------- */
function startRun(){
  const d = S.draft; const prompt = (d.prompt||'').trim(); const p = window.lumenPrice(d);
  if(!prompt) return toast('Write the thing first — one sentence is enough');
  if(!p.m) return;
  if(p.amount > S.balance + 1e-9) return toast(`That run is ${money(p.amount)} — balance is ${money2(S.balance)}`);
  const job = {id:uid(), ts:Date.now(), prompt, modelId:p.m.id, kind:p.m.kind, length:p.len||null, sound:!!d.sound, res:p.res||null, frame:d.mode==='video'?'16:9':d.frame, amount:p.amount, status:'running', progress:0, url:null, poster:null, live:LIVE};
  S.runs.unshift(job); S.balance -= job.amount;
  S.ledger.unshift({id:job.id, ts:job.ts, label:`${p.m.name} — ${prompt}`, amount:-job.amount, status:'held'});
  if(S.runs.length > 80) S.runs.length = 80;
  save(); paint();
  const runner = LIVE ? runReal : runSim;
  runner(job, pr => { job.progress = pr; progress(job); })
    .then(out => { job.status='done'; job.url=out.url; job.poster=out.poster||null; job.sample=!!out.sample; job.progress=1; const l=S.ledger.find(e=>e.id===job.id); if(l) l.status='charged'; toast(`Charged ${money(job.amount)} · ${p.m.name}`); })
    .catch(err => { job.status='failed'; job.error=err.message; S.balance += job.amount; const l=S.ledger.find(e=>e.id===job.id); if(l) l.status='released'; toast(`Run failed · ${money(job.amount)} released`); })
    .finally(() => { save(); paint(); });
}
function progress(job){
  $$(`[data-bar="${job.id}"] i`).forEach(el => el.style.width = (job.progress*100).toFixed(1)+'%');
  $$(`[data-pct="${job.id}"]`).forEach(el => el.textContent = Math.round(job.progress*100)+'%');
  const rb = $('#resBar'); if(rb && rb.dataset.job===job.id) rb.style.transform = `scaleX(${job.progress})`;
  const hl = $('#resHudL'); if(hl && hl.dataset.job===job.id) hl.textContent = `Developing · ${Math.round(job.progress*100)}%`;
}
function rerun(id){ const j = S.runs.find(r=>r.id===id); if(!j) return; Object.assign(S.draft, {prompt:j.prompt, mode:j.kind, [j.kind==='video'?'vmodel':'model']:j.modelId, length:j.length||S.draft.length, sound:j.sound, res:j.res, frame:j.frame}); save(); location.hash = '#studio'; }
function removeRun(id){ S.runs = S.runs.filter(r=>r.id!==id); save(); location.hash = '#prints'; }
function topUp(n){ S.balance += n; S.ledger.unshift({id:uid(), ts:Date.now(), label:`Top-up ${money2(n)} — sample, no card is charged here`, amount:n, status:'credit'}); save(); paint(); toast(`Added ${money2(n)}`); }
let toastT; function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

/* ---------------- views ---------------- */
const pane = $('#pane');
function media(j, cls=''){ if(!j.url) return ''; return j.kind==='video' ? `<video class="${cls}" src="${j.url}" ${j.poster?`poster="${j.poster}"`:''} muted loop playsinline autoplay></video>` : `<img class="${cls}" src="${j.url}" alt="">`; }

function vStudio(){
  const d = S.draft; const p = window.lumenPrice(d); const cur = p.m; const isV = d.mode==='video';
  const list = M.filter(m => m.kind === (isV?'video':'image'));
  const latest = S.runs[0];
  const res = latest ? (latest.status==='running'
      ? `<div class="result busy"><div class="liquid"></div><div class="bar" id="resBar" data-job="${latest.id}" style="transform:scaleX(${latest.progress})"></div><div class="empty">Developing “${esc(latest.prompt)}”</div><div class="hud num"><span id="resHudL" data-job="${latest.id}">Developing · ${Math.round(latest.progress*100)}%</span><span>${money(latest.amount)} held</span></div></div>`
      : latest.status==='done'
      ? `<div class="result">${media(latest)}<div class="hud num"><span>${modelById(latest.modelId).name}${latest.sample?' · sample plate':''}</span><span>Charged ${money(latest.amount)}</span></div></div>`
      : `<div class="result"><div class="empty">The last run failed — ${esc(latest.error||'')}. ${money(latest.amount)} was released.</div></div>`)
    : `<div class="result"><div class="empty">Press the button. The print develops here, in the safelight.</div></div>`;
  return `
    <h1>Describe <em>the unseen.</em></h1>
    <p class="lead">Write one sentence, choose a route, read the button. ${LIVE ? 'The provider is live — this spends real money from your fal account.' : 'No provider key on this deployment, so runs are simulated: the flow is real, the plates are samples.'}</p>
    <div class="studio-grid">
      <div>
        <textarea class="prompt" id="prompt" rows="3" placeholder="Describe the unseen. One ordinary sentence.">${esc(d.prompt)}</textarea>
        <div class="receipt num" id="receipt">${p.line}</div>
        <button class="gen" id="go">Develop <span class="amt num"><span id="amt">${money(p.amount)}</span><small>on completion</small></span></button>
        <div class="fine">You approve this exact amount · a failed run releases it · balance ${money2(S.balance)} · ⌘/Ctrl + Enter</div>
        ${res}
      </div>
      <div class="side">
        <div class="row"><div class="lab">Mode</div><div class="seg"><button data-set="mode" data-v="image" class="${!isV?'on':''}">Still</button><button data-set="mode" data-v="video" class="${isV?'on':''}">Motion</button></div></div>
        <div class="row"><div class="lab">Route</div><div class="mlist">${list.map(m => `<button class="mrow ${cur.id===m.id?'on':''}" data-set="${isV?'vmodel':'model'}" data-v="${m.id}"><span class="n"><i></i>${m.name}<small>${m.cond}</small></span><span class="r num">${money(m.rate)}${m.kind==='video'?'/s':''}</span></button>`).join('')}</div></div>
        ${isV ? `<div class="row"><div class="lab">Length</div><div class="chips">${cur.lengths.map(l => `<button class="chip ${p.len===l?'on':''}" data-set="length" data-v="${l}"><span class="num">${l} s</span><small class="num">${money(p.rate*l)}</small></button>`).join('')}</div></div>
        <div class="row"><div class="lab">Sound</div><div class="chips"><button class="chip ${!d.sound?'on':''}" data-set="sound" data-v="0">Off</button><button class="chip ${d.sound?'on':''}" data-set="sound" data-v="1" ${cur.audioRate?'':'disabled'}>On ${cur.audioRate?`<small class="num">${money(cur.audioRate)}/s</small>`:'<small>not offered</small>'}</button></div></div>`
        : `<div class="row"><div class="lab">Frame</div><div class="chips">${window.LUMEN_FRAMES.map(f => `<button class="chip ${d.frame===f?'on':''}" data-set="frame" data-v="${f}"><span class="num">${f}</span></button>`).join('')}</div></div>
        ${cur.res ? `<div class="row"><div class="lab">Size</div><div class="chips">${Object.entries(cur.res).map(([k,mult]) => `<button class="chip ${p.res===k?'on':''}" data-set="res" data-v="${k}">${k}<small class="num">${money(cur.rate*mult)}</small></button>`).join('')}</div></div>` : ''}`}
        ${S.runs.length ? `<div class="row"><div class="lab">Recent</div><div class="runs">${S.runs.slice(0,4).map(runRow).join('')}</div></div>` : ''}
      </div>
    </div>`;
}
function runRow(j){
  const m = modelById(j.modelId);
  const st = j.status==='running' ? `<span class="st">running <span data-pct="${j.id}">${Math.round(j.progress*100)}%</span></span>` : j.status==='done' ? '<span class="st ok">charged</span>' : '<span class="st bad">failed · released</span>';
  return `<a class="run" href="#prints/${j.id}">
    <div class="th ${j.status==='running'?'wet':''}">${j.url ? (j.kind==='video' ? `<video src="${j.url}" muted playsinline ${j.poster?`poster="${j.poster}"`:''}></video>` : `<img src="${j.url}" alt="">`) : ''}</div>
    <div class="meta"><div class="p">${esc(j.prompt)}</div><div class="s">${m?m.name:''}${j.kind==='video'?` · ${j.length} s`:''} · ${when(j.ts)}</div>${j.status==='running'?`<div class="bar" data-bar="${j.id}"><i style="width:${j.progress*100}%"></i></div>`:''}</div>
    <div class="amt num">${money(j.amount)}${st}</div></a>`;
}
function vQueue(){
  const running = S.runs.filter(r=>r.status==='running'), recent = S.runs.filter(r=>r.status!=='running').slice(0,8);
  return `<h1>The <em>queue.</em></h1><p class="lead">Motion queues for minutes. A run advances while someone is looking at it, and lands in the prints with its sentence, its route and what it cost.</p>
    <div class="studio-grid"><div><div class="lab mono" style="margin-bottom:10px">Running</div><div class="runs">${running.length ? running.map(runRow).join('') : '<div class="empty-note">Nothing is running. The studio is one tab to the left.</div>'}</div></div>
    <div>${recent.length ? `<div class="lab mono" style="margin-bottom:10px">Just finished</div><div class="runs">${recent.map(runRow).join('')}</div>` : ''}</div></div>`;
}
let filter = 'all';
function vPrints(sub){
  if(sub){ const j = S.runs.find(r=>r.id===sub); if(j) return vDetail(j); }
  const runs = S.runs.filter(r => r.status==='done' && (filter==='all' || r.kind===filter));
  return `<h1>The <em>prints.</em></h1><p class="lead">Every finished run, as a print: the result, the sentence that made it, the route, the exact amount charged.</p>
    <div class="filters seg">${['all','image','video'].map(f => `<button data-filter="${f}" class="${filter===f?'on':''}">${f==='all'?'Everything':f==='image'?'Stills':'Motion'}</button>`).join('')}</div>
    ${runs.length ? `<div class="pgrid">${runs.map((j,i) => { const m = modelById(j.modelId); return `<a class="pcard" style="--tilt:${((i%5)-2)*0.6}deg" href="#prints/${j.id}"><div class="img">${media(j)}${j.kind==='video'?`<span class="k num">▶ ${j.length} s</span>`:''}</div><div class="cap"><div class="p">${esc(j.prompt)}</div><div class="m">${m?m.name:''}<b class="num">${money(j.amount)}</b></div></div></a>`; }).join('')}</div>` : '<div class="empty-note">Nothing on the line yet. Your first print is one sentence away.</div>'}`;
}
function vDetail(j){
  const m = modelById(j.modelId);
  return `<h1>Print <em>${String(S.runs.length - S.runs.indexOf(j)).padStart(3,'0')}</em></h1>
    <div class="detail" style="margin-top:26px">
      <div class="big">${media(j)}</div>
      <div>
        <p class="p">${esc(j.prompt)}</p>
        <div class="kv"><span class="k">Route</span><span>${m?m.name:''}<br><span class="mono mute" style="text-transform:none;letter-spacing:.04em">${m?m.slug:''}</span></span></div>
        <div class="kv"><span class="k">Setting</span><span class="num">${j.kind==='video'?`${j.length} s · sound ${j.sound?'on':'off'}`:`${j.frame}${j.res?' · '+j.res:''}`}</span></div>
        <div class="kv"><span class="k">Charged</span><span class="num">${money(j.amount)} · ${j.status==='done'?'on completion':'released'} · ${when(j.ts)}</span></div>
        <div class="kv"><span class="k">Output</span><span class="mute">${j.sample ? 'Sample plate — simulated run.' : 'Provider output.'}${j.url && !j.sample ? ` <a href="${j.url}" target="_blank" rel="noopener" style="text-decoration:underline">Open file</a>` : ''}</span></div>
        <div class="acts"><button class="pill" data-act="rerun" data-id="${j.id}">Run again · ${money(j.amount)}</button><button class="pill" data-act="copy" data-id="${j.id}">Copy the sentence</button><button class="pill" data-act="remove" data-id="${j.id}">Remove</button><a class="pill" href="#prints">← All prints</a></div>
      </div>
    </div>`;
}
function vLedger(){
  return `<h1>The <em>ledger.</em></h1><p class="lead">Held means approved and waiting on the run. Charged means it finished. Released means it failed and the amount came back.</p>
    <div class="balance"><span class="b num">${money2(S.balance)}</span><span class="mono mute">available · yours alone</span></div>
    <div class="packs">${[10,25,50].map(n => `<button class="pill" data-topup="${n}">Add $${n}</button>`).join('')}</div>
    <div class="tablewrap"><table><tr><th>When</th><th>Entry</th><th class="r">Amount</th><th class="r">State</th></tr>
    ${S.ledger.slice(0,60).map(e => `<tr><td class="m">${when(e.ts)}</td><td>${esc(e.label.length>90?e.label.slice(0,90)+'…':e.label)}</td><td class="r">${e.amount<0?'−':'+'}${money(Math.abs(e.amount))}</td><td class="r"><span class="st ${e.status}">${e.status}</span></td></tr>`).join('')}
    </table></div>
    <div class="fine">Top-ups are samples until payment is wired. When it is, this table is the receipt.</div>`;
}
function vModels(){
  const rows = kind => M.filter(m=>m.kind===kind).map((m,i) => `<tr><td class="m">${String(i+1).padStart(2,'0')}</td><td>${m.name}<br><span class="mono mute" style="text-transform:none;letter-spacing:.04em">${m.slug}</span></td><td class="mute">${m.cond}${m.note?' — '+m.note:''}${m.lengths?`<br><span class="mono">${m.lengths.join(' · ')} s</span>`:''}</td><td class="r">${money(m.rate)}${m.kind==='video'?' /s':''}</td></tr>`).join('');
  return `<h1>The <em>routes.</em></h1><p class="lead">Twenty routes, priced at the stated resolution and sound setting. Read from fal on 1 September 2026.</p>
    <div class="tablewrap"><table><tr><th></th><th>Motion — per second</th><th>Conditions · accepted lengths</th><th class="r">Rate</th></tr>${rows('video')}</table></div>
    <div class="tablewrap" style="margin-top:40px"><table><tr><th></th><th>Stills — per image</th><th>Conditions</th><th class="r">Rate</th></tr>${rows('image')}</table></div>`;
}
function vSettings(){
  return `<h1>The <em>settings.</em></h1><p class="lead">Provider status, defaults, and the local data this browser keeps.</p>
    <div class="setrow"><div class="lab">Provider</div><div>${LIVE ? '<span class="st charged">Live</span> — FAL_KEY is set on this deployment; runs spend real money.' : '<span class="st released">Simulated</span> — no FAL_KEY on this deployment. Set it in Vercel → Environment Variables and redeploy; nothing else changes.'}<div class="fine">The key never reaches the browser: the page talks to /api, the function talks to fal.</div></div></div>
    <div class="setrow"><div class="lab">Open in</div><div class="seg"><button class="${S.settings.mode==='image'?'on':''}" data-setting="mode" data-v="image">Still</button><button class="${S.settings.mode==='video'?'on':''}" data-setting="mode" data-v="video">Motion</button></div></div>
    <div class="setrow"><div class="lab">Local data</div><div><button class="pill danger" id="wipe">Clear prints, ledger and balance on this browser</button><div class="fine">${S.runs.length} runs · ${S.ledger.length} ledger entries</div></div></div>`;
}

/* ---------------- routing + paint ---------------- */
function route(){ const h = location.hash.replace(/^#/, ''); const [id, sub] = h.split('/'); return {id: VIEWS.some(v=>v.id===id) ? id : 'studio', sub}; }
let lastKey = '';
function paint(){
  const {id, sub} = route(); const v = VIEWS.find(x=>x.id===id);
  $('#tabs').innerHTML = VIEWS.map(x => `<a href="#${x.id}" class="${x.id===id?'on':''}">${x.label}${x.id==='queue' && S.runs.some(r=>r.status==='running') ? ' ·' : ''}</a>`).join('');
  pane.innerHTML = v.render(sub);
  $('#bal').textContent = money2(S.balance);
  const key = id+'/'+(sub||''); if(key!==lastKey){ scrollTo({top:0}); lastKey = key; }
  if(id==='studio'){ const ta = $('#prompt'); if(ta && !matchMedia('(hover:none)').matches){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
}
addEventListener('hashchange', paint);

/* ---------------- interactions ---------------- */
let lastAmt = 0;
pane.addEventListener('click', e => {
  const set = e.target.closest('[data-set]');
  if(set && !set.disabled){
    const k = set.dataset.set; let v = set.dataset.v; if(k==='length') v = Number(v); if(k==='sound') v = v==='1';
    const before = window.lumenPrice(S.draft).amount;
    S.draft[k] = v;
    if(k==='model' || k==='vmodel'){ S.draft.res = null; const m = modelById(v); if(m && m.lengths && !m.lengths.includes(S.draft.length)) S.draft.length = m.lengths[0]; }
    const ta = $('#prompt'); if(ta) S.draft.prompt = ta.value;
    save(); paint();
    const to = window.lumenPrice(S.draft).amount, o = {v:before}, el = $('#amt');
    if(el && window.gsap) gsap.to(o, {v:to, duration:.5, ease:'power3.out', onUpdate:() => el.textContent = money(o.v)});
    return;
  }
  if(e.target.closest('#go')){ S.draft.prompt = $('#prompt').value; save(); startRun(); return; }
  const f = e.target.closest('[data-filter]'); if(f){ filter = f.dataset.filter; paint(); return; }
  const t = e.target.closest('[data-topup]'); if(t){ topUp(Number(t.dataset.topup)); return; }
  const a = e.target.closest('[data-act]');
  if(a){ const id = a.dataset.id, j = S.runs.find(r=>r.id===id);
    if(a.dataset.act==='rerun') rerun(id);
    if(a.dataset.act==='copy' && j){ navigator.clipboard && navigator.clipboard.writeText(j.prompt); toast('Sentence copied'); }
    if(a.dataset.act==='remove') removeRun(id);
    return; }
  const st = e.target.closest('[data-setting]'); if(st){ S.settings[st.dataset.setting] = st.dataset.v; S.draft.mode = st.dataset.v; save(); paint(); return; }
  if(e.target.closest('#wipe')){ try{ localStorage.removeItem('lumen.studio.v1'); }catch(e){} S = load(); save(); paint(); toast('Local data cleared'); return; }
});
pane.addEventListener('input', e => { if(e.target.id==='prompt'){ S.draft.prompt = e.target.value; save(); } });
document.addEventListener('keydown', e => {
  if((e.metaKey||e.ctrlKey) && e.key==='Enter' && route().id==='studio'){ e.preventDefault(); const ta = $('#prompt'); if(ta) S.draft.prompt = ta.value; save(); startRun(); return; }
  if(/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
  if(/^[1-6]$/.test(e.key)) location.hash = '#' + VIEWS[Number(e.key)-1].id;
});

/* runs interrupted by a closed tab: release the hold */
S.runs.forEach(j => { if(j.status==='running'){ j.status='failed'; j.error='Interrupted'; S.balance += j.amount; const l=S.ledger.find(e=>e.id===j.id); if(l) l.status='released'; } });
save(); paint();
})();
