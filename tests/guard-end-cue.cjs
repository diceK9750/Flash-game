// GUARD SPECIAL end cue (2026-10-17 auto cycle 29): when 聖護結界 runs out mid-flight the player gets exactly one
// GUARD_END SE + a fading ring (drawn < 0.45 s); never at other times, never when the run is already over.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.resolve(__dirname,'..');
const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:k==='measureText'?()=>({width:10}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,value:0,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
const sc={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
for(const n of['config','physics','game','sprites','graphics','ui','audio','voice','input'])vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),sc,{filename:n});
const H=sc.Hop,G=H.Graphics,A=H.Audio,rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
let sounds=[];A.play=k=>sounds.push(k);A.playCombo=()=>{};A.stopCombo=()=>{};H.Voice.play=()=>{};
assert.ok(A.peakSum(A.fxRecipes.GUARD_END)<A.peakSum(A.fxRecipes.RANK_STAMP),'quieter than RANK_STAMP');
let curG=null,curUi=null,draws=0;const gc=G.guardEndCue;G.guardEndCue=function(ctx,x,y,age){if(age>=0&&age<0.45){draws++;assert.equal(curG.state,'FLYING');}return gc.apply(this,arguments);};
let ends=0,cues=0;
for(const [seed,kind] of [...Array.from({length:300},(_,i)=>[i+1,null]),...Array.from({length:40},(_,i)=>[1000+i,'guard'])]){
 const g=new H.Game(rng(seed));g.tempoEnabled=true;g.launchCutinEnabled=true;if(kind)g.setDebugKind(kind);const ui=new H.UI(g,element('canvas'));curG=g;curUi=ui;
 const step=()=>{g.update(1/60);ui.update();ui.draw();};g.act();for(let i=0;i<30;i++)step();g.act();for(let i=0;i<20;i++)step();g.act();
 let cur=null,was=false;
 for(let i=0;i<60*240&&g.state==='FLYING';i++){if(g.special&&g.special!==cur){cur=g.special;g.act();}sounds=[];step();
  const now=g.guardSpecial.active,n=sounds.filter(k=>k==='GUARD_END').length;
  const endedInFlight=was&&!now&&g.state==='FLYING';if(endedInFlight)ends++;cues+=n;
  assert.equal(n,endedInFlight?1:0,'GUARD_END exactly on an in-flight end (seed '+seed+' frame '+i+')');
  was=now;}}
assert.ok(ends>=8,'in-flight ends covered: '+ends);assert.equal(cues,ends);assert.ok(draws>0,'ring drawn');
console.log('guard-end-cue OK: '+ends+' in-flight ends, '+draws+' ring frames');
