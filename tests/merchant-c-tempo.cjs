// Type C tempo (2026-10-17 auto cycle 32): the float ride is typeCTempo times shorter in real time, while every
// same-seed final distance (forced DEBUG ride and normal plays with merchant forced to Type C) equals the 1x ride.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.resolve(__dirname,'..');
function load(tempo){const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:k==='measureText'?()=>({width:10}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,value:0,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
 const sc={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
 for(const n of['config','physics','game']){let src=fs.readFileSync(path.join(root,'js',n+'.js'),'utf8');
  if(n==='config'){src=src.replace('merchantChance: 0.10,','merchantChance: 1,').replace('STOPPER: "A", DASH: "B", BOOST: "C", BOUNCE: "D"','STOPPER: "C", DASH: "C", BOOST: "C", BOUNCE: "C"');if(tempo)src=src.replace(/typeCTempo: \d+,/,'typeCTempo: '+tempo+',');}
  vm.runInContext(src,sc,{filename:n});}return sc.Hop;}
const rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
function run(H,seed,debug){const g=new H.Game(rng(seed));g.tempoEnabled=true;g.launchCutinEnabled=true;if(debug)g.setDebugKind('merchant-c');
 g.act();for(let i=0;i<30;i++)g.update(1/60);g.act();for(let i=0;i<20;i++)g.update(1/60);g.act();
 let frames=0,rode=false;for(let i=0;i<60*900&&g.state==='FLYING';i++){if(g.special?.merchantType&&g.special.remaining<0.9)g.act();g.update(1/60);if(g.merchant?.type==='C'){frames++;rode=true;}}
 return {d:g.finalDistance,frames,rode};}
const fast=load(),slow=load(1);assert.equal(slow.CONFIG.typeCTempo,1);assert.equal(fast.CONFIG.merchantChance,1);
assert.ok(fast.CONFIG.typeCTempo>=2,'at least half the wait');
let rides=0,fs_=0,ss=0;
for(const [seed,debug] of [[1,true],[2,true],...Array.from({length:120},(_,i)=>[i+10,false])]){
 const a=run(fast,seed,debug),b=run(slow,seed,debug);
 assert.equal(a.d,b.d,'same final distance seed '+seed);assert.equal(a.rode,b.rode);
 if(a.rode){rides++;fs_+=a.frames;ss+=b.frames;assert.ok(a.frames<=b.frames/2+2,'wait halved seed '+seed+' '+JSON.stringify([a,b]));}}
assert.ok(rides>=10,'rides '+rides);
console.log(`merchant-c-tempo OK: ${rides} rides, mean wait ${(ss/rides/60).toFixed(1)} s -> ${(fs_/rides/60).toFixed(1)} s, distances identical`);
