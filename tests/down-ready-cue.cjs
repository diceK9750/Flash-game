// AERIAL ↓ READY cue (2026-10-17 auto cycle 27): the cue (ring + chevron + DOWN_READY SE) fires once per recharge, only
// at a moment when a tap really dives (UI.downReadyNow == canvas HUD "AERIAL ↓ READY"), never for the launch charge.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.resolve(__dirname,'..');
const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:k==='measureText'?()=>({width:10}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,value:0,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
const sc={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
for(const n of['config','physics','game','sprites','graphics','ui','audio','voice','input'])vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),sc,{filename:n});
const H=sc.Hop,G=H.Graphics,A=H.Audio,rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
let ses=0,drawn=0;A.play=k=>{if(k==='DOWN_READY')ses++;};A.playCombo=()=>{};A.stopCombo=()=>{};H.Voice.play=()=>{};
let curG=null;const dc=G.downReadyCue;G.downReadyCue=function(...a){drawn++;assert.ok(curG.downCharge>=1,'cue never drawn after the charge is used');return dc.apply(this,a);};
assert.ok(A.peakSum(A.fxRecipes.DOWN_READY)<A.peakSum(A.fxRecipes.RANK_STAMP),'quieter than RANK_STAMP');
let cues=0,recharges=0,firstFrameCue=0;
for(const [seed,kind,rm] of [[1],[2],[3],[4],[5],[6],[7],[8],[9,null,true],[10,'boost'],[11,'merchant-c']]){
 const g=new H.Game(rng(seed));g.tempoEnabled=true;g.launchCutinEnabled=true;if(kind&&g.setDebugKind)try{g.setDebugKind(kind);}catch{}
 curG=g;const ui=new H.UI(g,element('canvas'));ui.visual.reducedMotion=!!rm;const step=()=>{g.update(1/60);ui.update();ui.draw();};
 g.act();for(let i=0;i<30;i++)step();g.act();for(let i=0;i<20;i++)step();g.act();
 let cur=null,last=ui.visual.downCueAt,wasLow=false,seen=0;
 for(let i=0;i<60*120&&g.state==='FLYING';i++){if(g.special&&g.special!==cur){cur=g.special;g.act();}else if(i%90===45)g.act();
  const before=ses;step();
  const ready=H.UI.downReadyNow(g);if(g.state==='FLYING')assert.equal(ready,/AERIAL ↓ READY/.test(element('aerial-hud-text').textContent),'downReadyNow mirrors the HUD (frame '+i+')');
  if(g.downCharge<1)wasLow=true;
  if(ui.visual.downCueAt!==last&&ui.visual.downCueAt!=null){cues++;seen++;last=ui.visual.downCueAt;assert.ok(ready,'cue only when a tap dives');assert.ok(wasLow,'cue only after a recharge');wasLow=false;recharges++;assert.equal(ses-before,1,'one SE per cue');
   if(i===0)firstFrameCue++;}}
 assert.ok(seen>=0);}
assert.ok(cues>=5,'cues fired: '+cues);assert.equal(ses,cues,'SE count');assert.equal(firstFrameCue,0);assert.ok(drawn>0,'cue drawn');
console.log('down-ready-cue OK: '+cues+' cues, '+drawn+' cue draw calls');
