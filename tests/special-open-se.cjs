// SPECIAL window open SE (2026-10-17 auto cycle 31): exactly one SPECIAL_OPEN per opened window (normal + merchant),
// never at any other frame; quieter than RANK_STAMP; the game is unchanged with or without the SE.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.resolve(__dirname,'..');
const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:k==='measureText'?()=>({width:10}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,value:0,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
const sc={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
for(const n of['config','physics','game','sprites','graphics','ui','audio','voice','input'])vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),sc,{filename:n});
const H=sc.Hop,A=H.Audio,rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
assert.ok(A.peakSum(A.fxRecipes.SPECIAL_OPEN)<A.peakSum(A.fxRecipes.RANK_STAMP),'quieter than RANK_STAMP');
let sounds=[];A.play=k=>sounds.push(k);A.playCombo=()=>{};A.stopCombo=()=>{};H.Voice.play=()=>{};
let windows=0,merchant=0;
function play(seed,kind,withUi){const g=new H.Game(rng(seed));g.tempoEnabled=true;g.launchCutinEnabled=true;if(kind)g.setDebugKind(kind);const ui=withUi?new H.UI(g,element('canvas')):null;
 const step=()=>{g.update(1/60);ui?.update();};g.act();for(let i=0;i<30;i++)step();g.act();for(let i=0;i<20;i++)step();g.act();
 let cur=null,openAt=-1;for(let i=0;i<60*240&&g.state==='FLYING';i++){sounds=[];step();const n=sounds.filter(k=>k==='SPECIAL_OPEN').length;
  const opened=g.special&&g.special!==cur;if(opened){cur=g.special;openAt=i;if(withUi){windows++;if(g.special.merchantType)merchant++;}}
  if(withUi)assert.equal(n,opened&&g.state==='FLYING'?1:0,'one SPECIAL_OPEN exactly when a window opens (seed '+seed+' frame '+i+')');
  if(g.special&&i-openAt===(seed%3?30:70))g.act();}
 return g.finalDistance;}
const kinds=H.DEBUG_KINDS.map(k=>k.id).filter(k=>k!=='off');
for(const [seed,kind] of [...Array.from({length:40},(_,i)=>[i+1,null]),...kinds.map((k,i)=>[300+i,k])])assert.equal(play(seed,kind,true),play(seed,kind,false),'game unchanged');
assert.ok(windows>40&&merchant>0,'coverage '+windows+'/'+merchant);
console.log('special-open-se OK: '+windows+' windows ('+merchant+' merchant)');
