// Regression for source identity and the single-blit scene latch.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scope,launch,element}=require('./phase2.cjs');
const H=scope.Hop,S=H.Sprites,G=H.Graphics,C=H.CONFIG;
const meta=JSON.parse(fs.readFileSync(path.join(__dirname,'..',S.definitions.CAST.BOOST.CAST.metadata),'utf8'));
const data=S.normalizeCell({...meta}),image={complete:true,naturalWidth:288,naturalHeight:288,src:'fixture',currentSrc:'fixture'};
const asset={ready:true,image,data},callbacks=[],operations=[];
const saved={create:scope.document.createElement,idle:scope.requestIdleCallback,slots:S.castAssets.BOOST,cache:S.witchWindCache,
  pending:S.witchWindPending,render:S.renderWitchWindFrame,smooth:G.smooth};
try {
scope.document.createElement=()=>({width:0,height:0,getContext(){return {save(){},restore(){},beginPath(){},rect(){},clip(){},clearRect(){},drawImage(...x){operations.push(x)}}}});
scope.requestIdleCallback=fn=>callbacks.push(fn);S.castAssets.BOOST={...S.castAssets.BOOST,CAST:asset};S.witchWindCache=null;S.witchWindPending=null;
const run=()=>{while(callbacks.length)callbacks.shift()()};
function rebuild(){S.witchWindCache=null;S.witchWindPending=null;S.scheduleWitchWindCache(asset);run();return S.witchWindCache;}
assert.equal(typeof S.witchWindSourceValid,'function','validate exact image and data identity');
// No mixed-generation publication, whether mutation is seen before or after a frame.
for(const key of ['image','data']){S.witchWindCache=null;S.witchWindPending=null;S.scheduleWitchWindCache(asset);callbacks.shift()();const old=asset[key];asset[key]={...old};run();assert(!S.witchWindCache,`${key}: changed during generation`);asset[key]=old;}
S.witchWindCache=null;S.witchWindPending=null;S.scheduleWitchWindCache(asset);const oldRender=S.renderWitchWindFrame;
S.renderWitchWindFrame=function(cache){oldRender.call(this,cache);asset.image={...image};};callbacks.shift()();assert(!S.witchWindCache,'source checked after rendering');asset.image=image;S.renderWitchWindFrame=oldRender;run();
data.sequence=[0];let cache=rebuild();assert(cache?.ready);assert(!Object.hasOwn(cache.data,'sequence'));for(const s of cache.sheets)assert(!Object.hasOwn(s.data,'sequence'));
// Verify the actual frame builder, including the untouched entrance and C-curve boundary.
const sample=[];for(let f=0;f<16;f++){operations.length=0;const frameCache={sourceImage:image,nextFrame:f,sheets:Array.from({length:4},()=>({context:{save(){},restore(){},beginPath(){},rect(){},clip(){},clearRect(){},drawImage(...args){operations.push(args)}}}))};
  S.renderWitchWindFrame(frameCache);assert.equal(operations.length,f===0?1:126);assert.equal(operations[0][0],image);
  if(f===0){assert.deepEqual(operations[0].slice(1),[0,0,288,288,0,0,288,288]);}else{
    const p=2*Math.PI*f/16,w=[0,.44,.78,1,1,1,1,1,1,1,1,1,1,1,.78,.44][f],first=operations[1];
    assert(Math.abs(first[1]-(32+12*Math.sin(p)*w))<1e-8);assert(Math.abs(first[6]-(140+4.8*Math.sin(p+.7)*w))<1e-8);
  }
  const p=2*Math.PI*f/16,w=[0,.44,.78,1,1,1,1,1,1,1,1,1,1,1,.78,.44][f];sample.push([12*Math.sin(p)*w,4.8*Math.sin(p+.7)*w,12*Math.sin(p+.7)*w,4.8*Math.sin(p+1.4)*w]);
}
for(let i=0;i<16;i++)assert(Math.max(...sample[i].map((v,j)=>Math.abs(v-sample[(i+1)%16][j])))<4.75,'bounded adjacent motion including the loop seam');
for(const change of [()=>asset.image={...image},()=>asset.data={...data},()=>data.pivot={...data.pivot},()=>data.sequence[0]=1]){cache=rebuild();assert(S.witchWindSourceValid(cache));const oldImg=asset.image,oldData=asset.data,oldPivot=data.pivot;change();assert(!S.witchWindSourceValid(cache),'changed source invalidates cache');asset.image=oldImg;asset.data=oldData;data.pivot=oldPivot;data.sequence[0]=0;}
cache=rebuild();
const calls=[],stack=[];let fail=false;
const ctx={globalAlpha:1,filter:'none',save(){stack.push(this.globalAlpha)},restore(){this.globalAlpha=stack.pop()},translate(){},rotate(){},scale(){},drawImage(img){calls.push({img,alpha:this.globalAlpha});if(fail&&cache.sheets.some(s=>s.image===img))throw Error('temporary cached draw failure')}};
for(const outer of [.25,1])for(const alpha of [0,.01,.5,.99,1]){calls.length=0;ctx.globalAlpha=1;const gate={allowed:true,asset,cache};assert(S.drawCastScaled(ctx,'BOOST',400,500,'CAST',1,{alpha:outer,windTime:0,windAlpha:alpha,witchWindGate:gate}));assert.equal(calls.length,1,'single image during entrance');assert.equal(calls[0].alpha,outer);}
const gate={allowed:true,asset,cache};fail=true;calls.length=0;assert(S.drawCastScaled(ctx,'BOOST',400,500,'CAST',1,{windTime:.4,witchWindGate:gate}));assert(!gate.allowed);assert(calls.some(v=>v.img===image));fail=false;calls.length=0;assert(S.drawCastScaled(ctx,'BOOST',400,500,'CAST',1,{windTime:.5,witchWindGate:gate}));assert.equal(calls.length,1);assert.equal(calls[0].img,image,'cache stays disabled for rest of scene');
const game=launch(),ui=new H.UI(game,element('canvas'));game.objects=[];game.trail=[];game.launchCutin=null;game.specialCutin=null;game.comboAfter=null;G.smooth=false;ui.visual.reducedMotion=false;
const scene=()=>({type:'BOOST',elapsed:G.comboSceneStart(false)+.3,short:false,heroX:1200,heroY:30,source:{x:1080},partner:{x:1500},skipped:false,total:3});
game.combo=scene();const before=JSON.stringify(game);ui.draw();assert.equal(JSON.stringify(game),before);assert(ui.visual.witchWindGate.allowed);const saved=asset.image;asset.image={...saved};ui.draw();assert(!ui.visual.witchWindGate.allowed);asset.image=saved;ui.draw();assert(!ui.visual.witchWindGate.allowed,'restored source remains latched off');game.combo=scene();ui.draw();assert(ui.visual.witchWindGate.allowed,'new scene may use valid cache');
console.log('Witch cache safety PASS: identity, mutations, sequence, single blit, alpha, same-scene failure latch, new-scene reset and game state.');
} finally {
  if(saved.create===undefined)delete scope.document.createElement;else scope.document.createElement=saved.create;
  if(saved.idle===undefined)delete scope.requestIdleCallback;else scope.requestIdleCallback=saved.idle;
  S.castAssets.BOOST=saved.slots;S.witchWindCache=saved.cache;S.witchWindPending=saved.pending;S.renderWitchWindFrame=saved.render;G.smooth=saved.smooth;
}
