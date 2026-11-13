// UPPER's optional wind cache is presentation-only and always falls back to the original.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { scope, launch, element } = require('./phase2.cjs');
const H=scope.Hop,S=H.Sprites,G=H.Graphics,C=H.CONFIG,F=C.comboFighterTimes;
const metadata=JSON.parse(fs.readFileSync(path.join(__dirname,'..',S.definitions.CAST.BOUNCE.UPPER.metadata),'utf8'));
const data=S.normalizeCell({...metadata}), source={ready:true,image:{complete:true,naturalWidth:288,naturalHeight:288},data};
const saved={create:scope.document.createElement,idle:scope.requestIdleCallback,timeout:scope.setTimeout,slots:S.castAssets.BOUNCE,
  boost:S.castAssets.BOOST,cache:S.fighterWindCache,pending:S.fighterWindPending,witch:S.witchWindCache,witchPending:S.witchWindPending,
  drawCast:S.drawCastScaled,smooth:G.smooth};
try {
  const operations=[],callbacks=[],canvases=[];
  function context(){const stack=[];return {globalAlpha:1,globalCompositeOperation:'source-over',
    save(){stack.push({globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation});},restore(){Object.assign(this,stack.pop());},
    beginPath(){},rect(...a){operations.push(['rect',...a]);},clip(){},clearRect(...a){operations.push(['clear',...a]);},
    createLinearGradient(){return {addColorStop(){}};},fillRect(...a){operations.push(['fill',...a]);},
    drawImage(...a){operations.push(['draw',...a]);}};}
  scope.document.createElement=()=>{const c=context(),canvas={width:0,height:0,getContext(){return c;}};canvases.push(canvas);return canvas;};
  scope.requestIdleCallback=fn=>{callbacks.push(fn);return callbacks.length;};
  S.castAssets.BOUNCE={...saved.slots,UPPER:source};S.fighterWindCache=null;S.fighterWindPending=null;
  const witchSentinel={ready:true,sourceAsset:{}};S.witchWindCache=witchSentinel;
  S.scheduleFighterWindCache(source);assert.equal(callbacks.length,1);assert.equal(operations.length,0,'no synchronous raster');
  S.scheduleFighterWindCache(source);assert.equal(callbacks.length,1,'duplicate schedule ignored');
  for(let i=0;i<9;i++){
    const old=operations.filter(x=>x[0]==='draw').length;callbacks.shift()();
    assert.equal(operations.filter(x=>x[0]==='draw').length-old,i===0?2:152,'one bounded idle phase');
    if(i<8){assert.equal(S.fighterWindCache,null,'partial cache never published');assert.equal(callbacks.length,1);}
  }
  const cache=S.fighterWindCache;assert(cache?.ready&&cache.sourceAsset===source);assert.equal(S.witchWindCache,witchSentinel,'witch cache untouched');
  assert.equal(cache.sheets.length,3);assert.deepEqual(Array.from(cache.sheets,x=>x.image.width),[1152,1152,288]);
  assert(cache.sheets.every(x=>x.image.height===288&&x.canvasSource));
  assert.equal(cache.sheets.reduce((n,x)=>n+x.image.width*x.image.height*4,0),2985984,'bounded RGBA cache');
  assert.equal(cache.data.frames,16);assert.equal(cache.data.fps,16/.7);assert.equal(cache.data.pivot.x,144);assert.equal(cache.data.pivot.y,264);
  assert.equal(source.data.frames,1,'source metadata is never modified');
  const rects=operations.filter(x=>x[0]==='rect').map(x=>x.slice(1));
  assert.equal(rects.length,8*4,'two clipped regions in mask and work for eight deformed frames');
  for(let i=0;i<rects.length;i+=4)assert.deepEqual(rects.slice(i,i+4),[[40,44,83,59],[40,44,83,59],[55,103,65,29],[55,103,65,29]]);
  assert.equal(S.createFighterWindCache({...source,ready:false}),null);
  assert.equal(S.createFighterWindCache({...source,data:{...data,pivot:{x:144,y:265}}}),null);
  scope.document.createElement=()=>({getContext(){throw Error('denied');}});assert.equal(S.createFighterWindCache(source),null,'canvas denied safely');
  // A context which silently refuses an unsupported composite is rejected too.
  scope.document.createElement=()=>({width:0,height:0,getContext(){const c=context();Object.defineProperty(c,'globalCompositeOperation',{get(){return 'source-over';},set(){}});return c;}});
  assert.equal(S.createFighterWindCache(source),null,'unsupported composite safely rejected');
  scope.document.createElement=()=>({width:0,height:0,getContext(){return context();}});
  S.fighterWindCache=null;S.fighterWindPending=null;S.scheduleFighterWindCache(source);S.castAssets.BOUNCE.UPPER={...source};callbacks.shift()();
  assert.equal(S.fighterWindCache,null);assert.equal(S.fighterWindPending,null,'changed source never publishes old cache');
  S.castAssets.BOUNCE.UPPER=source;const render=S.renderFighterWindFrame;S.renderFighterWindFrame=()=>{throw Error('broken canvas');};
  try{S.scheduleFighterWindCache(source);callbacks.shift()();assert.equal(S.fighterWindCache,null);assert.equal(S.fighterWindPending,null);}finally{S.renderFighterWindFrame=render;}
  // A changed image or metadata inside the same asset cannot be mixed into later phases.
  const img=source.image,d=source.data,pivot=d.pivot,unit=d.unit,smooth=d.smooth,frames=d.frames;
  for(const [mutate,restore] of [
    [()=>{source.image={...img};},()=>{source.image=img;}],
    [()=>{source.data={...d};},()=>{source.data=d;}],
    [()=>{img.complete=false;},()=>{img.complete=true;}],
    [()=>{img.naturalWidth=287;},()=>{img.naturalWidth=288;}],
    [()=>{img.naturalHeight=287;},()=>{img.naturalHeight=288;}],
    [()=>{img.src='changed.png';},()=>{delete img.src;}],
    [()=>{img.currentSrc='changed.png';},()=>{delete img.currentSrc;}],
    [()=>{d.pivot={...pivot};},()=>{d.pivot=pivot;}],
    [()=>{pivot.y=265;},()=>{pivot.y=264;}],
    [()=>{d.unit=4;},()=>{d.unit=unit;}],
    [()=>{d.frames=2;},()=>{d.frames=frames;}],
    [()=>{d.smooth=!smooth;},()=>{d.smooth=smooth;}]
  ]){
    S.fighterWindCache=null;S.fighterWindPending=null;S.scheduleFighterWindCache(source);callbacks.shift()();mutate();callbacks.shift()();
    assert.equal(S.fighterWindCache,null,'mutated source cannot publish mixed phases');assert.equal(S.fighterWindPending,null);
    assert(!S.fighterWindSourceValid(cache),'already-built cache no longer matches');restore();assert(S.fighterWindSourceValid(cache));
  }
  delete scope.requestIdleCallback;scope.setTimeout=fn=>{callbacks.push(fn);return callbacks.length;};
  S.scheduleFighterWindCache(source);assert.equal(callbacks.length,1);for(let i=0;i<9;i++)callbacks.shift()();assert(S.fighterWindCache?.ready);
  assert.equal(S.witchWindCache,witchSentinel,'witch cache survives independent rebuild');
  // Both asset builds may interleave; their pending identities and failure handling are independent.
  const witchMeta=JSON.parse(fs.readFileSync(path.join(__dirname,'..',S.definitions.CAST.BOOST.CAST.metadata),'utf8'));
  const witchSource={ready:true,image:{complete:true,naturalWidth:288,naturalHeight:288},data:S.normalizeCell({...witchMeta})};
  S.castAssets.BOOST={...saved.boost,CAST:witchSource};S.witchWindCache=null;S.witchWindPending=null;S.fighterWindCache=null;S.fighterWindPending=null;
  S.scheduleWitchWindCache(witchSource);S.scheduleFighterWindCache(source);while(callbacks.length)callbacks.shift()();
  assert(S.witchWindCache?.ready&&S.fighterWindCache?.ready);assert.equal(S.witchWindCache.sourceAsset,witchSource);assert.equal(S.fighterWindCache.sourceAsset,source);
  S.witchWindCache=null;S.witchWindPending=null;S.fighterWindCache=null;S.fighterWindPending=null;
  S.renderFighterWindFrame=()=>{throw Error('fighter only');};
  try {S.scheduleWitchWindCache(witchSource);S.scheduleFighterWindCache(source);while(callbacks.length)callbacks.shift()();
    assert(S.witchWindCache?.ready,'fighter failure cannot stop witch cache');assert.equal(S.fighterWindCache,null);}
  finally{S.renderFighterWindFrame=render;}
  S.castAssets.BOOST=saved.boost;S.witchWindCache=witchSentinel;S.fighterWindCache=cache;

  const calls=[],stack=[],ctx={globalAlpha:1,globalCompositeOperation:'source-over',filter:'none',
    save(){stack.push({alpha:this.globalAlpha,blend:this.globalCompositeOperation});},restore(){const s=stack.pop();this.globalAlpha=s.alpha;this.globalCompositeOperation=s.blend;},
    translate(){},rotate(){},scale(){},drawImage(...args){calls.push({image:args[0],alpha:this.globalAlpha,args});}};
  const map=[0,1,2,3,4,3,2,1,0,5,6,7,8,7,6,5];
  for(let logical=0;logical<16;logical++)for(const face of ['left','right']){
    calls.length=0;const box=S.drawCastScaled(ctx,'BOUNCE',400,500,'UPPER',1,{face,windTime:(logical+.25)/cache.data.fps,windAlpha:1});
    assert(box);assert.equal(calls.length,1);const stored=map[logical];assert.equal(calls[0].image,cache.sheets[Math.floor(stored/4)].image);
    assert.equal(calls[0].args[1],stored%4*288);assert.equal(box.flipped,face==='left');
  }
  for(const fps of [30,60,120,144])for(let k=0;k<fps*2;k++){
    const time=k/fps,logical=Math.floor(time*cache.data.fps)%16,stored=map[logical];calls.length=0;
    assert(S.drawCastScaled(ctx,'BOUNCE',400,500,'UPPER',1,{windTime:time}));
    assert.equal(calls[0].image,cache.sheets[Math.floor(stored/4)].image);assert.equal(calls[0].args[1],stored%4*288);
    calls.length=0;S.drawCastScaled(ctx,'BOUNCE',400,500,'UPPER',1,{windTime:time});assert.equal(calls[0].args[1],stored%4*288,'pause is stable');
  }
  // A legal hold sequence on the one-frame source must not freeze or scramble generated phases.
  const sequence=[0,0],sequenceSource={...source,data:{...data,sequence}};
  const sequenceCache=S.createFighterWindCache(sequenceSource);assert(sequenceCache);for(let f=0;f<9;f++)S.renderFighterWindFrame(sequenceCache);sequenceCache.ready=true;
  assert.equal(sequenceCache.data.sequence,undefined);assert(sequenceCache.sheets.every(sheet=>sheet.data.sequence===undefined));assert.strictEqual(sequenceSource.data.sequence,sequence);
  S.castAssets.BOUNCE.UPPER=sequenceSource;S.fighterWindCache=sequenceCache;
  for(let logical=0;logical<16;logical++){
    calls.length=0;assert(S.drawCastScaled(ctx,'BOUNCE',400,500,'UPPER',1,{windTime:(logical+.25)/sequenceCache.data.fps}));
    const stored=map[logical];assert.equal(calls[0].image,sequenceCache.sheets[Math.floor(stored/4)].image);assert.equal(calls[0].args[1],stored%4*288);
  }
  sequence.push(1);assert(!S.fighterWindSourceValid(sequenceCache),'in-place source sequence mutation invalidates cache');sequence.pop();assert(S.fighterWindSourceValid(sequenceCache));
  S.fighterWindCache=null;S.fighterWindPending=null;S.scheduleFighterWindCache(sequenceSource);callbacks.shift()();sequence.push(0);callbacks.shift()();
  assert.equal(S.fighterWindCache,null,'in-place sequence change cannot publish mixed phases');assert.equal(S.fighterWindPending,null);sequence.pop();
  S.castAssets.BOUNCE.UPPER=source;S.fighterWindCache=cache;
  calls.length=0;S.drawCastScaled(ctx,'BOUNCE',400,500,'UPPER',1,{windTime:.1,windAlpha:0});assert.equal(calls.length,1);assert.equal(calls[0].image,source.image);
  ctx.globalCompositeOperation='lighter';calls.length=0;S.drawCastScaled(ctx,'BOUNCE',400,500,'UPPER',1,{windTime:.1,windAlpha:.4,alpha:.8});
  assert.equal(calls.length,1);assert.equal(calls[0].image,source.image);assert(Math.abs(calls[0].alpha-.8)<1e-9,'partial blend never double-adds aura');
  const failed=[],bad={...ctx,globalAlpha:1,globalCompositeOperation:'lighter',drawImage(image){failed.push({image,alpha:this.globalAlpha});if(cache.sheets.some(s=>s.image===image))throw Error('lost');}};
  const gate={allowed:true,cache,asset:source};
  assert(S.drawCastScaled(bad,'BOUNCE',400,500,'UPPER',1,{windTime:.1,windAlpha:1,alpha:.8,fighterWindGate:gate}));
  assert.equal(failed.length,2);assert.equal(failed[1].image,source.image);assert(Math.abs(failed[1].alpha-.8)<1e-9);
  assert.equal(gate.allowed,false,'cache failure disables later draws');
  ctx.globalCompositeOperation='source-over';calls.length=0;
  assert(S.drawCastScaled(ctx,'BOUNCE',400,500,'UPPER',1,{windTime:.1,windAlpha:.4}));assert.equal(calls.length,1);assert.equal(calls[0].image,source.image);
  S.fighterWindCache={ready:true,sourceAsset:source};calls.length=0;assert(S.drawCastScaled(ctx,'BOUNCE',400,500,'UPPER',1,{windTime:.1}));assert.equal(calls[0].image,source.image,'malformed cache falls back');

  // Whole renderer: a cache finishing late or reduced motion changing never pops into the current scene.
  const game=launch(),ui=new H.UI(game,element('canvas')),start=G.comboSceneStart(false),seen=[];
  game.objects=[];game.trail=[];game.launchCutin=null;game.specialCutin=null;game.comboAfter=null;
  const scene=()=>({type:'BOUNCE',elapsed:start+F.rise+.1,short:false,heroX:1200,heroY:30,source:{x:1080},partner:{x:1500},skipped:false,total:3});
  S.drawCastScaled=(ctx,id,x,feet,pose,mul,opts)=>{if(id==='BOUNCE'&&pose==='UPPER')seen.push(opts);return {w:1};};
  G.smooth=false;ui.visual.reducedMotion=false;S.fighterWindCache=null;game.combo=scene();let snapshot=JSON.stringify(game);
  ui.draw();assert.equal(JSON.stringify(game),snapshot);assert(!ui.visual.fighterWindGate.allowed);
  S.fighterWindCache=cache;seen.length=0;ui.draw();assert(!ui.visual.fighterWindGate.allowed);assert(seen.length&&seen.every(x=>x.windTime===undefined),'late cache waits');
  game.combo=scene();seen.length=0;ui.draw();assert(ui.visual.fighterWindGate.allowed);assert(seen.some(x=>Number.isFinite(x.windTime)),'new scene uses ready cache');
  ui.visual.reducedMotion=true;seen.length=0;ui.draw();assert(!ui.visual.fighterWindGate.allowed);assert(seen.every(x=>x.windTime===undefined));
  ui.visual.reducedMotion=false;seen.length=0;ui.draw();assert(!ui.visual.fighterWindGate.allowed);assert(seen.every(x=>x.windTime===undefined),'reduced OFF waits for next scene');
  game.combo=scene();ui.draw();assert(ui.visual.fighterWindGate.allowed);game.combo.skipped=true;seen.length=0;ui.draw();assert(!ui.visual.fighterWindGate.allowed);assert(seen.every(x=>x.windTime===undefined));
  game.combo=scene();ui.draw();assert(ui.visual.fighterWindGate.allowed);S.castAssets.BOUNCE.UPPER={...source};ui.draw();assert(!ui.visual.fighterWindGate.allowed,'source change disables current scene');
  S.castAssets.BOUNCE.UPPER=source;ui.draw();assert(!ui.visual.fighterWindGate.allowed,'recovery waits for next scene');
  game.combo=scene();game.combo.short=true;ui.draw();assert(!ui.visual.fighterWindGate.allowed,'short is static');
  game.combo=null;game.comboAfter={...scene(),remaining:.2,total:.6};seen.length=0;ui.draw();assert.equal(ui.visual.fighterWindGate,null);assert(seen.every(x=>x.windTime===undefined),'afterglow stays static');
  game.comboAfter=null;game.state='RESULT';ui.draw();assert.equal(ui.visual.fighterWindGate,null,'RESULT clears gate');
  game.act();assert.equal(game.state,'AIM_ANGLE');ui.draw();assert.equal(ui.visual.fighterWindGate,null,'RETRY stays static');
  game.act();game.act();assert.equal(game.state,'FLYING');game.combo=scene();ui.draw();assert(ui.visual.fighterWindGate.allowed,'next play may animate');
  assert.equal(S.witchWindCache,witchSentinel,'renderer leaves other cache intact');
  console.log('Fighter UPPER wind PASS: 9 shared frames, bounded idle cache, 16 logical phases, flip, single additive draw, failures, gate and game purity.');
} finally {
  if(saved.create===undefined)delete scope.document.createElement;else scope.document.createElement=saved.create;
  if(saved.idle===undefined)delete scope.requestIdleCallback;else scope.requestIdleCallback=saved.idle;
  if(saved.timeout===undefined)delete scope.setTimeout;else scope.setTimeout=saved.timeout;
  S.castAssets.BOUNCE=saved.slots;S.castAssets.BOOST=saved.boost;S.fighterWindCache=saved.cache;S.fighterWindPending=saved.pending;
  S.witchWindCache=saved.witch;S.witchWindPending=saved.witchPending;S.drawCastScaled=saved.drawCast;G.smooth=saved.smooth;
}
