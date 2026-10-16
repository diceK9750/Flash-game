// RESULT screen-reader announcement (2026-10-17 auto cycle 25): once per RESULT, same distance / rank / record text as
// the screen, cleared on RETRY; DEBUG plays say 記録対象外. Text only (sr-only live region), game unchanged.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.resolve(__dirname,'..');
const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:k==='measureText'?()=>({width:10}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
const store={};const sc={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
for(const n of['config','physics','game','sprites','graphics','ui','audio','voice','input'])vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),sc,{filename:n});
const H=sc.Hop,rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296),live=element('announcements');
function run(seed,kind){const g=new H.Game(rng(seed));g.tempoEnabled=true;g.launchCutinEnabled=true;if(kind)g.setDebugKind(kind);const ui=new H.UI(g,element('canvas'));
 const step=()=>{g.update(1/60);ui.update();};g.act();for(let i=0;i<30;i++)step();g.act();for(let i=0;i<20;i++)step();g.act();
 let cur=null;for(let i=0;i<60*240&&g.state==='FLYING';i++){if(g.special&&g.special!==cur){cur=g.special;g.act();}step();}
 assert.equal(g.state,'RESULT');const seen=new Set();for(let i=0;i<240;i++){step();if(live.textContent.startsWith('RESULT'))seen.add(live.textContent);}
 return {g,ui,seen,step};}
let records=0;
for(const seed of [1,2,3,4,5,6,7,8]){const {g,seen,step}=run(seed);assert.equal(seen.size,1,'announced once');const t=[...seen][0];
 assert.ok(t.startsWith('RESULT '+g.finalDistance.toFixed(1)+' m · ランク '+H.Game.rank(g.finalDistance)),t);
 assert.equal(t.endsWith('NEW RECORD!'),g.newRecords.length>0,'record flag matches the screen: '+t);
 assert.equal(element('record-status').textContent.includes('NEW RECORD'),t.includes('NEW RECORD'));records+=t.includes('NEW RECORD');
 g.act();for(let i=0;i<5;i++)step();assert.ok(!live.textContent.startsWith('RESULT'),'cleared on RETRY');}
assert.ok(records>0,'some runs set a record');
const kind=(H.DEBUG_KINDS||[]).map(k=>k.id).find(k=>k!=='off');if(kind){const {seen}=run(50,kind);assert.ok([...seen][0].endsWith('DEBUG PLAY / 記録対象外'),[...seen][0]);}
console.log('result-announce OK');
