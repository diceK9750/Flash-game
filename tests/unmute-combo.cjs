// Unmute during a combo scene (2026-10-17 auto cycle 30). Real-Chrome check: muting silences SE + voice within one
// frame and nothing replays on unmute, but a scene unmuted part-way stayed silent except its finisher voice.
// Now the scene SE continues from the scene's current time: nothing already past is replayed, level unchanged.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.resolve(__dirname,'..');
const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:k==='measureText'?()=>({width:10}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const els=new Map();const element=id=>{if(!els.has(id))els.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,value:0,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),getContext:ctx2d});return els.get(id);};
const sc={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:1};sc.window=sc;vm.createContext(sc);
for(const n of['config','physics','game','sprites','graphics','ui','audio','voice','input'])vm.runInContext(fs.readFileSync(path.join(root,'js',n+'.js'),'utf8'),sc,{filename:n});
const H=sc.Hop,A=H.Audio,rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
// Fake AudioContext: records source start times and the master gain.
function fakeCtx(t){const starts=[],gains=[];const param=()=>({setValueAtTime(v){gains.push(v);},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({connect(){},disconnect(){},gain:param(),frequency:param(),Q:param()});
 const src=()=>({...node(),start(at){starts.push(at);},stop(){},set onended(f){}});
 return {state:'running',currentTime:t,sampleRate:8000,destination:{},starts,gains,createGain:node,createBiquadFilter:node,createOscillator:src,createBufferSource:src,createBuffer:()=>({getChannelData:()=>new Float32Array(8000)})};}
// 1) render from: only voices at/after `from`, none in the past, same master level as the whole track
for(const kind of Object.keys(A.comboRecipes))for(const rate of [1,1.5])for(const from of [0.5,1.2,2.0,2.9]){
 const full=fakeCtx(10),part=fakeCtx(10);A.noise=null;A.render(full,kind,10,rate!==1?{rate}:null);A.noise=null;A.render(part,kind,10-from,{rate,from});
 const want=A.comboRecipes[kind].filter(v=>v[1]/rate>=from-1e-9).length;
 assert.equal(part.starts.length,want,kind+' from '+from+' schedules the remaining voices');
 assert.ok(part.starts.every(t=>t>=10-1e-9),kind+' nothing replays from the past');
 assert.equal(part.gains[0],full.gains[0],kind+' same master level');}
// 2) UI: unmute mid-scene resumes once at the scene time; never outside a scene
const calls=[];A.resumeCombo=(k,off,r)=>calls.push({k,off,r});A.playCombo=()=>{};A.stopCombo=()=>{};A.play=()=>{};H.Voice.play=()=>{};
let scenes=0;
for(const [seed,kind] of [[1,'boost'],[2,'bounce'],[3,'boost'],[4,'bounce']]){const g=new H.Game(rng(seed));g.tempoEnabled=true;g.launchCutinEnabled=true;g.setDebugKind(kind);const ui=new H.UI(g,element('canvas'));
 const step=()=>{g.update(1/60);ui.update();};g.act();for(let i=0;i<30;i++)step();g.act();for(let i=0;i<20;i++)step();g.act();
 // mute/unmute before any scene: no resume
 const pre=!!g.combo,n0=calls.length;A.muted=true;step();A.muted=false;step();if(!pre)assert.equal(calls.length,n0,'no scene: no resume '+JSON.stringify({calls,combo:!!g.combo,special:!!g.special,lc:!!g.launchCutin}));
 let cur=null,done=false;for(let i=0;i<60*120&&g.state==='FLYING'&&!done;i++){if(g.special&&g.special!==cur){cur=g.special;g.act();}step();
  if(g.combo&&g.combo.elapsed>1.2){A.muted=true;step();step();const n=calls.length;A.muted=false;step();assert.equal(calls.length,n+1,'resumed once');
   const c=calls.at(-1);assert.ok(Math.abs(c.off-g.combo.elapsed)<0.05,'at the scene time');assert.ok(/^COMBO_(WITCH|FIGHTER)/.test(c.k));step();assert.equal(calls.length,n+1,'only once');scenes++;done=true;}}}
assert.ok(scenes>=2,'scenes covered: '+scenes);
console.log('unmute-combo OK: '+scenes+' scenes');
