// SPECIAL text truth guard (2026-10-17 auto cycle 26), from the cycle 26 audit: at every SPECIAL resolve, does the shown text (cut-in, SUCCESS/MISS panel + reason, live notice)
// match what the game actually did? Seeds 1-150 with random hit/miss choice + every DEBUG kind. Also: a MISS notice for screen readers carries the same reason line as the panel.
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..'),assert=require('assert/strict');
const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:k==='measureText'?()=>({width:10}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
const sc={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
for(const n of['config','physics','game','sprites','graphics','ui','audio','voice','input'])vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),sc,{filename:n});
const H=sc.Hop,c=H.CONFIG,G=H.Game.prototype,rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
H.Audio.play=()=>{};H.Audio.playCombo=()=>{};H.Audio.stopCombo=()=>{};H.Voice.play=()=>{};
const rec=[];const orig=G.resolveSpecial;
G.resolveSpecial=function(success){const p=this.special;if(!p)return orig.call(this,success);const b=this.body;
 const pre={vx:b.vx,vy:b.vy,guard:this.guardSpecial.active,normalGuard:this.normalGuard,merchant:this.merchant?.type||null,cutin:this.specialCutin};
 const r=orig.call(this,success);
 rec.push({type:p.type,merchantType:p.merchantType||null,success,pre,post:{vx:b.vx,vy:b.vy,stopped:!!b.stopped,guard:this.guardSpecial.active,merchant:this.merchant?.type||null,state:this.state},
  entryLabel:p.entry?.label,cutin:this.specialCutin&&this.specialCutin!==pre.cutin?{type:this.specialCutin.type,name:this.specialCutin.name,mt:this.specialCutin.merchantType}:null,
  msg:this.specialMessage&&{label:this.specialMessage.label,detail:this.specialMessage.detail,missOutcome:this.specialMessage.missOutcome},shown:H.UI.specialMessageDetail(this.specialMessage),sound:this.soundEvent,game:this,endCause:this.endCause&&{...this.endCause}});
 return r;};
const kinds=(H.DEBUG_KINDS||[]).map(k=>k.id).filter(k=>k!=='off');
const runs=[...Array.from({length:60},(_,i)=>[i+1,null]),...kinds.flatMap((k,i)=>[[300+i,k],[400+i,k]])];
for(const [seed,kind] of runs){const g=new H.Game(rng(seed));g.tempoEnabled=true;g.launchCutinEnabled=true;g.comboEnabled=g.comboEnabled;if(kind)g.setDebugKind(kind);
 const ui=new H.UI(g,element('canvas'));const pick=rng(seed*31+7);const step=()=>{g.update(1/60);ui.update();};
 g.act();for(let i=0;i<30;i++)step();g.act();for(let i=0;i<20;i++)step();g.act();let cur=null;
 for(let i=0;i<60*240&&g.state==='FLYING';i++){if(g.special&&g.special!==cur){cur=g.special;if(pick()<0.6)g.act();}step();
  for(const e of rec){if(e.game===g){e.live=element('announcements').textContent;e.seed=seed;e.kind=kind;delete e.game;}}}}
// Checks
const bad=[],C=(cond,why,e)=>{if(!cond)bad.push({why,seed:e.seed,kind:e.kind,type:e.type,mt:e.merchantType,success:e.success,shown:e.shown,live:e.live,entry:e.entryLabel,pre:e.pre,post:e.post});};
for(const e of rec){const name=e.merchantType?c.merchantNames[e.merchantType]:c.specials[e.type].name;
 C(e.msg.label===(e.success?'SPECIAL SUCCESS':'SPECIAL MISS'),'panel label',e);
 C(e.msg.detail.includes(name),'panel name',e);
 if(e.success){C(e.cutin&&e.cutin.name===name&&e.cutin.type===(e.merchantType?'MERCHANT':e.type),'cut-in matches',e);
  if(e.merchantType)C(e.post.merchant===e.merchantType||['C'].includes(e.merchantType),'merchant acquired',e);
  else if(e.type==='GUARD')C(e.post.guard,'guard active',e);
  else if(c.specials[e.type].speed)C(Math.hypot(e.post.vx,e.post.vy)>0,'launched',e);}
 else{C(!e.cutin,'no cut-in on miss',e);C(!e.sound||!e.sound.startsWith('SPECIAL_'),'no SPECIAL SE on miss',e);
  const s=e.shown;
  if(s.includes('僧侶の効果で停止'))C(e.post.stopped,'says stopped',e);
  if(e.post.stopped)C(s.includes('停止')&&!s.includes('防いだ'),'stopped but text says otherwise',e);
  if(s.includes('GUARDで停止を防いだ'))C(!e.post.stopped&&e.type==='STOPPER','says guard prevented stop',e);
  if(s.includes('効果なし'))C(Math.abs(e.post.vx-e.pre.vx)<1e-9&&Math.abs(e.post.vy-e.pre.vy)<1e-9,'says no effect but velocity changed',e);
  if(s.includes('通常の効果のみ'))C(!/GUARDED/.test(e.entryLabel||''),'says normal effect but was guarded',e);}
 C(e.live.includes(e.success?'SUCCESS':'MISS')||e.live==='','live notice outcome',e);
 if(!e.success&&e.live.includes('SPECIAL MISS'))C(e.live.includes('SPECIAL MISS · '+e.shown),'MISS notice carries the panel reason',e);}
const misses=rec.filter(e=>!e.success&&e.live.includes('SPECIAL MISS')).length;
assert.ok(rec.length>50&&misses>5,'enough resolves / announced misses: '+rec.length+'/'+misses);
assert.deepEqual(bad.map(b=>b.why+' '+b.type+' seed '+b.seed),[],'shown SPECIAL text matches the outcome');
console.log('special-text-truth OK: '+rec.length+' resolves, '+misses+' announced misses');
