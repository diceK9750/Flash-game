// "タップで結果へ" truth (2026-10-17 auto cycle 28): the canvas badge line and the DOM hint say a tap finishes the
// run only when it really does (Game.tapFinishesRun == the act() branch that runs finishTail). Before: on the frame
// a SPECIAL window opened while rolling, the badge still promised the result although the tap took the SPECIAL.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.resolve(__dirname,'..');
let texts=[];const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:k==='fillText'?t=>texts.push(String(t)):k==='measureText'?()=>({width:10}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,value:0,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
const sc={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
for(const n of['config','physics','game','sprites','graphics','ui','audio','voice','input'])vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),sc,{filename:n});
const H=sc.Hop,rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);H.Audio.play=()=>{};H.Audio.playCombo=()=>{};H.Audio.stopCombo=()=>{};H.Voice.play=()=>{};
const TAP='タップで結果へ';
// Reference = the act() FLYING branch condition (so the test also runs against code without tapFinishesRun).
const TF=g=>g.state==='FLYING'&&g.tempoEnabled&&!g.launchCutin&&!g.combo&&!g.special&&g.body.grounded&&g.tailActive();
function start(seed){const g=new H.Game(rng(seed));g.tempoEnabled=true;g.launchCutinEnabled=true;const ui=new H.UI(g,element('canvas'));
 g.act();for(let i=0;i<30;i++){g.update(1/60);ui.update();}g.act();for(let i=0;i<20;i++){g.update(1/60);ui.update();}g.act();return {g,ui};}
let frames=0,promised=0,replays=0,specialOpen=0;
for(const seed of [43,61,1,2,3,4,5,6,7,8]){const {g,ui}=start(seed);let cur=null;const marks=[];
 for(let i=0;i<60*240&&g.state==='FLYING';i++){if(g.special&&g.special!==cur){cur=g.special;g.act();}g.update(1/60);ui.update();texts=[];ui.draw();
  if(g.state!=='FLYING')break;frames++;const t=TF(g);if(g.tapFinishesRun)assert.equal(g.tapFinishesRun(),t,'tapFinishesRun == act branch');
  const canvasSays=texts.some(x=>x.includes(TAP)),domSays=element('hint').textContent.includes(TAP);
  if(canvasSays||domSays)promised++;
  if(canvasSays)assert.ok(t,'canvas promises the result only when a tap finishes (seed '+seed+' frame '+i+')');
  if(domSays)assert.ok(t,'DOM hint promises the result only when a tap finishes (seed '+seed+' frame '+i+')');
  if(g.body.grounded&&(t||g.special))marks.push({i,t});if(g.special&&g.body.grounded&&g.timeScale>1.05)specialOpen++;}
 // replay: tapping at a marked frame finishes the run iff tapFinishesRun said so
 for(const m of marks.filter((_,k)=>k%4===0).slice(0,12)){const r=start(seed);let c2=null;
  for(let i=0;i<=m.i;i++){if(r.g.special&&r.g.special!==c2){c2=r.g.special;r.g.act();}r.g.update(1/60);r.ui.update();}
  const before=r.g.tailFinished;r.g.act();assert.equal(!!r.g.tailFinished&&!before,m.t,'tap outcome matches tapFinishesRun (seed '+seed+' frame '+m.i+')');replays++;}}
assert.ok(promised>20&&replays>20,'coverage '+promised+'/'+replays);assert.ok(specialOpen>0,'covers the SPECIAL-opens-while-rolling frame');
console.log('tail-hint-truth OK: '+frames+' frames, '+promised+' promise frames, '+replays+' tap replays, '+specialOpen+' special-open frames');
