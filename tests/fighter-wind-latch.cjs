// Fail once, then recover: no animated UPPER may pop back into the same live scene.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scope,launch,element}=require('./phase2.cjs'),H=scope.Hop,S=H.Sprites,G=H.Graphics,C=H.CONFIG,F=C.comboFighterTimes;
const meta=JSON.parse(fs.readFileSync(path.join(__dirname,'..',S.definitions.CAST.BOUNCE.UPPER.metadata),'utf8'));
const source={ready:true,image:{complete:true,naturalWidth:288,naturalHeight:288,src:'fighter.png',currentSrc:'fighter.png'},data:S.normalizeCell({...meta})};
const saved={create:scope.document.createElement,slots:S.castAssets.BOUNCE,cache:S.fighterWindCache,pending:S.fighterWindPending,smooth:G.smooth,drawCast:S.drawCastScaled};
try {
  function buildContext(){return {globalCompositeOperation:'source-over',save(){},restore(){},beginPath(){},rect(){},clip(){},clearRect(){},fillRect(){},drawImage(){},createLinearGradient(){return{addColorStop(){}};}};}
  scope.document.createElement=()=>({width:0,height:0,getContext(){return buildContext();}});
  S.castAssets.BOUNCE={...saved.slots,UPPER:source};const cache=S.createFighterWindCache(source);assert(cache);
  for(let i=0;i<9;i++)S.renderFighterWindFrame(cache);cache.ready=true;S.fighterWindCache=cache;
  const stack=[],records=[],canvases=cache.sheets.map(s=>s.image);let failCache=false;
  const raw={globalAlpha:1,globalCompositeOperation:'source-over',filter:'none',
    save(){stack.push({alpha:this.globalAlpha,op:this.globalCompositeOperation,filter:this.filter});},
    restore(){const p=stack.pop();this.globalAlpha=p.alpha;this.globalCompositeOperation=p.op;this.filter=p.filter;},
    drawImage(...args){if(canvases.includes(args[0])){records.push({kind:'cache',args});if(failCache){failCache=false;throw Error('once');}}
      else if(args[0]===source.image)records.push({kind:'source',args});},
    createRadialGradient(){return{addColorStop(){}};},createLinearGradient(){return{addColorStop(){}};}};
  const ctx=new Proxy(raw,{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  const g=launch(),ui=new H.UI(g,element('canvas')),start=G.comboSceneStart(false);
  g.objects=[];g.trail=[];g.launchCutin=null;g.specialCutin=null;g.comboAfter=null;ui.ctx=ctx;ui.visual.reducedMotion=false;G.smooth=false;
  const scene=elapsed=>({type:'BOUNCE',elapsed:start+elapsed,short:false,heroX:1200,heroY:30,source:{x:1080},partner:{x:1500},skipped:false,total:3});
  const num=kind=>records.filter(r=>r.kind===kind).length;
  g.combo=scene(F.rise+.02);failCache=true;let snapshot=JSON.stringify(g);ui.draw();assert.equal(JSON.stringify(g),snapshot,'game unchanged');
  assert.equal(num('cache'),1,'failed cache attempted only once, including all ghosts and aura');assert(num('source')>0,'original fallback drawn');
  assert.equal(ui.visual.fighterWindGate.allowed,false,'failure latches visual gate');
  records.length=0;ui.draw();assert.equal(num('cache'),0,'recovery does not pop back in the same scene');assert(num('source')>0);
  g.combo=scene(F.rise+.02);records.length=0;ui.draw();assert(ui.visual.fighterWindGate.allowed);assert(num('cache')>0,'next scene can use cache again');
  for(const [breakSource,restore] of [
    [()=>{source.image={...source.image};},()=>{source.image=cache.sourceImage;}],
    [()=>{source.data={...source.data};},()=>{source.data=cache.sourceData;}],
    [()=>{source.image.complete=false;},()=>{source.image.complete=true;}],
    [()=>{source.image.naturalHeight=287;},()=>{source.image.naturalHeight=288;}],
    [()=>{source.image.src='other.png';},()=>{source.image.src='fighter.png';}],
    [()=>{source.data.pivot={...source.data.pivot};},()=>{source.data.pivot=cache.sourcePivot;}]
  ]){
    g.combo=scene(F.rise+.02);ui.draw();assert(ui.visual.fighterWindGate.allowed);breakSource();ui.draw();assert(!ui.visual.fighterWindGate.allowed,'mutated source latches off');
    restore();records.length=0;ui.draw();assert.equal(num('cache'),0,'source recovery waits for next scene');
  }
  // The first visible frame is phase 0 at every refresh rate, even when the first render misses F.rise.
  const map=[0,1,2,3,4,3,2,1,0,5,6,7,8,7,6,5];
  for(const fps of [30,60,120,144]){
    const first=F.rise+.7/fps;g.combo=scene(first);records.length=0;ui.draw();assert(ui.visual.fighterWindGate.allowed);assert(num('cache')>0);
    assert(records.filter(r=>r.kind==='cache').every(r=>r.args[0]===cache.sheets[0].image&&r.args[1]===0),'first rendered phase is 0');
    let previous=0;
    for(let step=1;step<Math.min(12,Math.floor(.5*fps));step++){
      g.combo.elapsed=start+first+step/fps;records.length=0;ui.draw();const windTime=step/fps,logical=Math.floor(windTime*cache.data.fps)%16,stored=map[logical];
      assert((logical-previous+16)%16<=1,'30–144fps cannot skip a logical phase');previous=logical;
      assert(records.filter(r=>r.kind==='cache').every(r=>r.args[0]===cache.sheets[Math.floor(stored/4)].image&&r.args[1]===stored%4*288));
    }
  }
  // If the sprite method throws instead of returning false, its exception still latches before Canvas fallback.
  const draw=S.drawCastScaled;S.drawCastScaled=()=>{throw Error('sprite failed');};
  try {const gate={allowed:true},a={pose:'UPPER',face:'right',x:100,scale:1};G.comboCast(ctx,'BOUNCE',a,x=>x,C.groundY,1,0,1,gate);assert.equal(gate.allowed,false);}
  finally {S.drawCastScaled=draw;}
  console.log('Fighter wind latch PASS: cache fail/recover, source identity/ready/dimensions, phase-0 entry, 30–144Hz, scene gate and purity.');
} finally {
  if(saved.create===undefined)delete scope.document.createElement;else scope.document.createElement=saved.create;
  S.castAssets.BOUNCE=saved.slots;S.fighterWindCache=saved.cache;S.fighterWindPending=saved.pending;G.smooth=saved.smooth;S.drawCastScaled=saved.drawCast;
}
