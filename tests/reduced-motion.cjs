// Reduced-motion guard (2026-10-17 auto cycle 23), from the cycle 23 audit: with reducedMotion on, which motion helpers / shakes / flashes still run? Plays normal seeds and
// every DEBUG kind (cut-ins, combos, merchants), drawing every frame. Also: does reduced motion change the game?
const fs=require('fs'),path=require('path'),vm=require('vm');const root=require('path').resolve(__dirname,'..'),assert=require('assert/strict');
const ctx2d=()=>new Proxy({__t:[]},{get:(o,k)=>k in o?o[k]:k==='translate'?(x,y)=>o.__t.push([x,y]):k==='measureText'?()=>({width:10}):k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
const sc={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
for(const n of['config','physics','game','sprites','graphics','ui','audio','voice','input'])vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),sc,{filename:n});
const H=sc.Hop,G=H.Graphics,rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
const MOTION=['speedLines','windLines','contactEffect','truckMotion','dustPuffs','skidDust','landRing','riseBurst','diveStreaks','downReadyCue','guardEndCue'].filter(k=>typeof G[k]==='function');
const calls={},style={special:0,launch:0,combo:0,tempoShake:0};
for(const k of MOTION){const f=G[k];G[k]=function(...a){if(sc.__rm)calls[k]=(calls[k]||0)+1;return f.apply(this,a);};}
const ss=G.specialCutinStyle;G.specialCutinStyle=function(age,rm,st){const r=ss.call(this,age,rm,st);if(sc.__rm&&(r.shakeX||r.shakeY||r.flash>0.01))style.special++;return r;};
const ls=G.launchCutinStyle;G.launchCutinStyle=function(cut,rm){const r=ls.call(this,cut,rm);if(sc.__rm&&(r.shakeX||r.shakeY||r.flash>0.01))style.launch++;return r;};
const ci=G.comboImpact;if(ci)G.comboImpact=function(cb,rm){const r=ci.call(this,cb,rm);if(sc.__rm&&(r.x||r.y||r.flash>0.01))style.combo++;return r;};
const ts=G.tempoShake;G.tempoShake=function(g,v){const r=ts.call(this,g,v);if(sc.__rm&&(r.x||r.y))style.tempoShake++;return r;};
function play(seed,rm,kind){sc.__rm=rm;const g=new H.Game(rng(seed));g.tempoEnabled=true;g.launchCutinEnabled=true;if(kind)g.setDebugKind?.(kind);
 const ui=new H.UI(g,element('canvas'));ui.visual.reducedMotion=rm;const pr=rng(seed*7919);
 g.act();for(let i=0;i<30;i++){g.update(1/60);ui.update();}g.act();for(let i=0;i<20;i++){g.update(1/60);ui.update();}g.act();
 let cur=null,frames=0;for(let i=0;i<60*240&&g.state==='FLYING';i++){if(g.special&&g.special!==cur){cur=g.special;g.act();}g.update(1/60);ui.update();ui.draw();frames++;}
 return {d:g.finalDistance,frames,launchMode:g.launchCutin?.mode,comboShort:g.comboShort};}
const kinds=(H.DEBUG_KINDS||[]).map(k=>k.id).filter(k=>k!=='off');
const out={motionHelpers:MOTION,runs:[]};let same=0,diff=[];
for(const [seed,kind] of [[1],[2],[3],[4],[5],[8],[13],[21],...kinds.map((k,i)=>[100+i,k])]){
 const a=play(seed,true,kind),b=play(seed,false,kind);out.runs.push({seed,kind:kind||null,rmDist:a.d,normalDist:b.d,rmFrames:a.frames,normalFrames:b.frames});
 if(a.d===b.d)same++;else diff.push({seed,kind,rm:a.d,normal:b.d});}
assert.deepEqual(calls,{},'reduced motion: no motion helper runs');assert.deepEqual(style,{special:0,launch:0,combo:0,tempoShake:0},'reduced motion: no shake / flash');
assert.equal(diff.length,0,'reduced motion never changes the game: '+JSON.stringify(diff));
// matchMedia wiring: initial value + live change, modern addEventListener and legacy addListener (old Safari).
for(const legacy of [false,true]){let cb=null;const mq={matches:true};if(legacy)mq.addListener=f=>cb=f;else mq.addEventListener=(t,f)=>cb=f;
 sc.matchMedia=()=>mq;const ui=new H.UI(new H.Game(rng(1)),element('canvas'));assert.equal(!!ui.visual.reducedMotion,true,'initial');cb({matches:false});assert.equal(ui.visual.reducedMotion,false,'live change '+(legacy?'legacy':'modern'));}
delete sc.matchMedia;
console.log(JSON.stringify({reducedMotion:'PASS',runs:out.runs.length,helpers:MOTION.length}));
