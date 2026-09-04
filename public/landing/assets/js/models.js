/* Lumen — routes and rates. Read from fal's public price list on 2026-09-01. Motion is billed per second. */
window.LUMEN_MODELS = [
  // ---- motion ----
  {id:'veo31lite', kind:'video', name:'Veo 3.1 Lite', slug:'fal-ai/veo3.1/lite', rate:0.03, audioRate:0.05, lengths:[4,6,8], cond:'720p', note:'Sound on is $0.05/s. Refuses 5 s.'},
  {id:'hailuo02s', kind:'video', name:'Hailuo 02 Standard', slug:'fal-ai/minimax/hailuo-02/standard/text-to-video', rate:0.045, lengths:[6,10], cond:'768p', note:'Six or ten seconds only.'},
  {id:'wan30', kind:'video', name:'Wan 3.0', slug:'alibaba/wan-3.0/text-to-video', rate:0.05, lengths:[2,4,5,8,10,15,20,30], cond:'480p', note:'Any length from 2 to 30 s. 720p is $0.10/s.'},
  {id:'kling25t', kind:'video', name:'Kling 2.5 Turbo Pro', slug:'fal-ai/kling-video/v2.5-turbo/pro/text-to-video', rate:0.07, lengths:[5,10], cond:'per second', note:''},
  {id:'kling3s', kind:'video', name:'Kling 3 Standard', slug:'fal-ai/kling-video/v3/standard/text-to-video', rate:0.084, audioRate:0.126, lengths:[3,5,10], cond:'sound off', note:'Sound on is $0.126/s.'},
  {id:'veo31fast', kind:'video', name:'Veo 3.1 Fast', slug:'fal-ai/veo3.1/fast', rate:0.10, audioRate:0.15, lengths:[4,6,8], cond:'720p / 1080p', note:'Sound on is $0.15/s.'},
  {id:'kling3p', kind:'video', name:'Kling 3 Pro', slug:'fal-ai/kling-video/v3/pro/text-to-video', rate:0.112, audioRate:0.168, lengths:[3,5,10], cond:'sound off', note:'Sound on is $0.168/s.'},
  {id:'veo31', kind:'video', name:'Veo 3.1', slug:'fal-ai/veo3.1', rate:0.20, audioRate:0.40, lengths:[4,6,8], cond:'720p / 1080p', note:'Sound doubles it: $0.40/s.'},
  {id:'seedance25', kind:'video', name:'Seedance 2.5', slug:'bytedance/seedance-2.5/text-to-video', rate:0.2205, lengths:[4,8,12], cond:'480p', note:'1080p is $0.473/s — the dearest second on the list.'},
  {id:'seedance20', kind:'video', name:'Seedance 2.0', slug:'bytedance/seedance-2.0/text-to-video', rate:0.3034, lengths:[4,8,12], cond:'720p', note:''},
  // ---- stills ----
  {id:'muse', kind:'image', name:'Muse Image 1.0', slug:'meta/muse-image-1.0', rate:0.01, cond:'per image', note:''},
  {id:'recraft2', kind:'image', name:'Recraft V2', slug:'recraft/recraft-v2', rate:0.022, cond:'per image', note:''},
  {id:'flux2pro', kind:'image', name:'FLUX.2 Pro', slug:'fal-ai/flux-2-pro', rate:0.03, cond:'first megapixel', note:'Each extra megapixel is $0.015.'},
  {id:'nanobanana', kind:'image', name:'Nano Banana', slug:'fal-ai/nano-banana', rate:0.039, cond:'per image', note:''},
  {id:'seedream45', kind:'image', name:'Seedream 4.5', slug:'bytedance/seedream-4.5', rate:0.04, cond:'per image', note:''},
  {id:'flux11pro', kind:'image', name:'FLUX 1.1 Pro', slug:'bfl/flux-pro-1.1', rate:0.04, cond:'per image', note:''},
  {id:'nanobanana2', kind:'image', name:'Nano Banana 2', slug:'fal-ai/nano-banana-2', rate:0.08, res:{'1K':1,'2K':1.5,'4K':2}, cond:'1K', note:'2K is 1.5×, 4K is 2×.'},
  {id:'kontextmax', kind:'image', name:'FLUX.1 Kontext Max', slug:'bfl/flux-kontext-max', rate:0.08, cond:'per image', note:''},
  {id:'nanobananapro', kind:'image', name:'Nano Banana Pro', slug:'fal-ai/nano-banana-pro', rate:0.15, res:{'2K':1,'4K':2}, cond:'2K', note:'4K is double.'},
  {id:'recraft4pro', kind:'image', name:'Recraft V4 Pro', slug:'recraft/recraft-v4-pro', rate:0.25, cond:'per image', note:''},
];
window.LUMEN_FRAMES = ['4:3','3:2','16:9','1:1','3:4','9:16'];
window.lumenMoney = n => '$' + (Math.round(n*1000)/1000).toFixed(n < 1 ? 3 : 2).replace(/(\.\d\d)0$/,'$1');
window.lumenModel = id => window.LUMEN_MODELS.find(m => m.id===id);
/* price a draft {mode, model, vmodel, length, sound, res, frame} */
window.lumenPrice = function(d){
  const m = lumenModel(d.mode==='video' ? d.vmodel : d.model);
  if(!m) return {m:null, amount:0, line:''};
  if(m.kind==='video'){
    const len = m.lengths.includes(d.length) ? d.length : m.lengths[0];
    const rate = (d.sound && m.audioRate) ? m.audioRate : m.rate;
    return {m, len, rate, amount:rate*len, line:`${m.name} · ${len} s × ${lumenMoney(rate)}/s${m.audioRate ? (d.sound ? ' · sound on' : ' · sound off') : ''} · charged on completion`};
  }
  let mult = 1, resLabel = '', res = null;
  if(m.res){ const keys = Object.keys(m.res); res = d.res && m.res[d.res] ? d.res : keys[0]; mult = m.res[res]; resLabel = ' · ' + res; }
  const amount = m.rate*mult;
  return {m, amount, rate:m.rate, res, line:`${m.name} · ${d.frame||'4:3'}${resLabel} · ${lumenMoney(amount)} per image · charged on completion`};
};

/* media path resolver: identity on the real site; the single-file preview build maps paths to inline data */
window.mediaUrl = p => (window.LUMEN_MEDIA && window.LUMEN_MEDIA[p]) || p;
