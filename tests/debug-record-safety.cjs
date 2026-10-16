// Cycle 31 audit: DEBUG plays must never write or change the saved records. Random action sequences (taps, DEBUG kind
// switches incl. OFF in every state, DEBUG menu open/close, mid-flight switches, RETRY chains); an independent
// harness-side "tainted" flag per run is compared with storage writes, game.best and the RESULT texts.
// Regression guard from the 2026-10-17 auto cycle 31 audit (two densities of DEBUG switching).
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..'),assert=require('assert/strict');
const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:k==='measureText'?()=>({width:10}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,value:0,style:{},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},addEventListener(){},focus(){},querySelector(){return null;},querySelectorAll(){return [];},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
const store={},writes=[];const sc={document:{getElementById:element,addEventListener(){},activeElement:null},requestAnimationFrame(){},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{writes.push({k,v});store[k]=v;}},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
for(const n of['config','physics','game','sprites','graphics','ui','audio','voice','input'])vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),sc,{filename:n});
const H=sc.Hop,c=H.CONFIG,S=H.STATES,rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);H.Audio.play=()=>{};H.Audio.playCombo=()=>{};H.Audio.stopCombo=()=>{};H.Voice.play=()=>{};
const kinds=['off',...H.DEBUG_KINDS.map(k=>k.id).filter(k=>k!=='off')];
function fuzz(N,P,seedG,seedP){
const bad=[],stats={results:0,tainted:0,clean:0,writesClean:0,newRecords:0,switches:0,menu:0};
const g=new H.Game(rng(seedG));g.tempoEnabled=true;g.launchCutinEnabled=true;const ui=new H.UI(g,element('canvas'));const pick=rng(seedP);
let tainted=!!g.debug,lastState=g.state,bestBefore=JSON.stringify(g.best),runs=0,menuOpen=false;
const BK=c.storageKey;
for(let f=0;runs<N&&f<6e6;f++){
 const r=pick(),w0=writes.length;
 if(r<P){const k=kinds[Math.floor(pick()*kinds.length)];const prevState=g.state;if(g.setDebugKind(k)){stats.switches++;if(prevState!==S.RESULT)tainted=true;}}
 else if(r>0.995&&typeof ui.toggleDebugMenu==='function'){try{ui.toggleDebugMenu();menuOpen=!menuOpen;stats.menu++;}catch{}}
 else if(r<0.02||(g.state!==S.FLYING&&r<0.05))g.act();
 g.update(menuOpen?0:1/60);ui.update();
 if(g.state===S.RESULT&&lastState!==S.RESULT){stats.results++;runs++;
  const wrote=writes.slice(w0).some(w=>w.k===BK);const status=element('record-status').textContent;
  if(tainted){stats.tainted++;if(wrote)bad.push({why:'DEBUG run wrote records',runs});if(JSON.stringify(g.best)!==bestBefore)bad.push({why:'DEBUG run changed best',runs});if(!status.includes('記録対象外'))bad.push({why:'DEBUG run not labelled',status,runs});if(g.newRecords.length)bad.push({why:'DEBUG newRecords',runs});}
  else{stats.clean++;if(wrote)stats.writesClean++;if(!wrote)bad.push({why:'clean run did not save',runs});if(status.includes('記録対象外'))bad.push({why:'clean run labelled DEBUG',runs});if(g.newRecords.length)stats.newRecords++;}
  bestBefore=JSON.stringify(g.best);}
 if(g.state!==S.RESULT&&lastState===S.RESULT){tainted=!!g.debug;}
 // writes outside a finish are never allowed
 for(const w of writes.slice(w0))if(w.k===BK&&!(g.state===S.RESULT&&lastState!==S.RESULT))bad.push({why:'record write outside finish',f});
 lastState=g.state;}
return {stats,bad};}
for(const [N,P,a,b] of [[150,0.0002,7,99],[150,0.00003,8,98]]){const {stats,bad}=fuzz(N,P,a,b);assert.deepEqual(bad,[],'DEBUG plays never touch records');assert.ok(stats.clean>=1&&stats.tainted>20,JSON.stringify(stats));console.log('debug-record-safety '+JSON.stringify(stats));}
console.log('debug-record-safety OK');
