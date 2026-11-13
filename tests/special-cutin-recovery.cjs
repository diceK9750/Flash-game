'use strict';
// Real sprite and game methods with mocked Canvas/DOM: verify a failed portrait can recover.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scope}=require('./phase2.cjs');
const H=scope.Hop,G=H.Graphics,S=H.Sprites,definition=S.definitions.CAST.BOOST.CUTIN_FACE;
const metadata=JSON.parse(fs.readFileSync(path.join(__dirname,'..',definition.metadata),'utf8')),makeFace=()=>({ready:true,image:{complete:true,naturalWidth:640,naturalHeight:320},data:S.normalizeCell(JSON.parse(JSON.stringify(metadata)))});
const bodyMeta=JSON.parse(fs.readFileSync(path.join(__dirname,'..',S.definitions.CAST.BOOST.IDLE.metadata),'utf8'));
const body={ready:true,image:{complete:true,naturalWidth:288,naturalHeight:288},data:S.normalizeCell(bodyMeta)};
const saved = { hasCreate:Object.hasOwn(scope.document,'createElement'), hasStorage:Object.hasOwn(scope,'localStorage'), hasCast:Object.hasOwn(S.castAssets,'BOOST'), hasLayer:Object.hasOwn(G,'cutinBandLayer'), create:scope.document.createElement, storage:scope.localStorage, cast:S.castAssets.BOOST, layer:G.cutinBandLayer, character:G.character, band:G.specialCutinBand };
try {
let storageWrites=0, storedBest=JSON.stringify({distance:123,height:45,speed:67});
const originalBest=storedBest;
scope.localStorage={getItem(){return storedBest;},setItem(key,value){storageWrites++;storedBest=value;}};
let face=makeFace(),throws=0,attempts=0,bodyAttempts=0,fallbacks=0,builds=0,blits=0;
const gradient=()=>({addColorStop(){}});
function context(screen=false){const state={filter:'none',globalCompositeOperation:'source-over',globalAlpha:1,
  getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};},createLinearGradient:gradient,
  drawImage(img){if(img===face.image){attempts++;if(throws>0){throws--;throw Error('injected face failure');}}
    else if(img===body.image){bodyAttempts++;if(throws>0){throws--;throw Error('injected body failure');}}else if(screen)blits++;}};
  return new Proxy(state,{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});}
scope.document.createElement=()=>({width:0,height:0,getContext(){return context();}});
const ch=G.character,band=G.specialCutinBand;G.character=function(...args){if(args[1]==='BOOST')fallbacks++;return ch.apply(this,args);};G.specialCutinBand=function(...args){builds++;return band.apply(this,args);};
const target=context(true),cut=()=>({castId:'BOOST',strong:false,total:1,remaining:.5});
const draw=x=>assert.equal(G.specialCutinBandCached(target,x,'#ffa',1200,240,1),true);
const reset=()=>{S.castAssets.BOOST={CUTIN_FACE:face,IDLE:body};G.cutinBandLayer=null;throws=attempts=bodyAttempts=fallbacks=builds=blits=0;};
// Normal cached band: one build on repeated frames and a fresh SPECIAL with unchanged source.
reset();let first=cut();draw(first);for(let i=0;i<20;i++)draw(first);draw(cut());
assert.equal(attempts,1);assert.equal(builds,1);assert.equal(blits,22);assert.equal(fallbacks,0);
// Initially absent image: cache the legitimate Canvas fallback, rebuild when the face appears.
reset();S.castAssets.BOOST={};first=cut();draw(first);assert.equal(fallbacks,1);draw(first);assert.equal(fallbacks,1);
S.castAssets.BOOST.CUTIN_FACE=face;draw(first);assert.equal(attempts,1);assert.equal(builds,2);
// A ready asset with an incomplete image uses fallback; decoded readiness changes the key in this same cut-in.
reset();face.image.complete=false;first=cut();draw(first);assert.equal(fallbacks,1);draw(first);assert.equal(fallbacks,1);
face.image.complete=true;draw(first);assert.equal(attempts,1);assert.equal(builds,2);
// One temporary paint failure is latched for the current cut; next SPECIAL retries instead of keeping a stale fallback.
reset();throws=1;first=cut();draw(first);assert.equal(attempts,1);assert.equal(fallbacks,1);
for(let i=0;i<20;i++)draw(first);assert.equal(attempts,1,'no expensive per-frame retry or pop');
const game=new H.Game(()=>.5), initialBest=JSON.stringify(game.best);game.debugUsed=true;game.body.x=100000;game.finish();game.act();assert.equal(game.state,H.STATES.AIM_ANGLE);assert.equal(JSON.stringify(game.best),initialBest,'DEBUG RETRY preserves in-memory BEST');
const second=cut();draw(second);assert.equal(attempts,2);assert.equal(fallbacks,1);draw(second);assert.equal(attempts,2);
// A real Game/UI draw and RETRY: use a forced cut-in fixture, without waiting for real time.
reset();throws=1;const g=new H.Game(()=>.5);g.debugUsed=true;g.state=H.STATES.FLYING;g.objects=[];g.trail=[];g.launchCutin=null;
const ui=new H.UI(g,scope.document.getElementById('canvas'));ui.ctx=context(true);
const makeCut=()=>({castId:'BOOST',castName:'魔法使い',name:'爆裂斜光',strong:false,total:1,remaining:.5});
g.specialCutin=makeCut();const physics=JSON.stringify(g.body);ui.draw();assert.equal(attempts,1);assert.equal(fallbacks,1);ui.draw();assert.equal(attempts,1);assert.equal(JSON.stringify(g.body),physics);
g.body.x=100000;g.finish();g.act();assert.equal(g.state,H.STATES.AIM_ANGLE);g.act();g.act();assert.equal(g.state,H.STATES.FLYING);g.debugUsed=true;g.objects=[];g.trail=[];g.specialCutin=makeCut();
const retryPhysics=JSON.stringify(g.body);ui.draw();assert.equal(attempts,2,'fresh cut-in after real RETRY attempts face');assert.equal(JSON.stringify(g.body),retryPhysics);ui.draw();assert.equal(attempts,2);
// Persistent failure remains once per cut and never interrupts drawing.
reset();throws=100;first=cut();draw(first);for(let i=0;i<20;i++)draw(first);assert.equal(attempts,1);draw(cut());assert.equal(attempts,2);assert.equal(fallbacks,2);
// Face missing, loaded body draw failure: same behaviour, with no blank band.
reset();S.castAssets.BOOST={IDLE:body};throws=1;first=cut();draw(first);for(let i=0;i<5;i++)draw(first);assert.equal(bodyAttempts,1);assert.equal(fallbacks,1);draw(cut());assert.equal(bodyAttempts,2);assert.equal(blits,7,'fallback and recovered bands reach the main canvas');
// Replacing the image object with the same ready flag and dimensions rebuilds the cache.
reset();first=cut();draw(first);const old=face;face=makeFace();S.castAssets.BOOST.CUTIN_FACE=face;draw(first);assert.equal(attempts,2);assert.notEqual(face,old);
face.image={...face.image};draw(first);assert.equal(attempts,3,'same asset with a new same-size image is rebuilt');draw(first);assert.equal(attempts,3);
assert.equal(storageWrites,0,'DEBUG finish and RETRY do not write records');assert.equal(storedBest,originalBest,'existing BEST is preserved');
console.log('SPECIAL cut-in recovery PASS: cache reuse, late decode, temporary/permanent failures, RETRY, body fallback and image replacement. Canvas/DOM mocked.');

} finally { if(saved.hasCreate)scope.document.createElement=saved.create;else delete scope.document.createElement; if(saved.hasStorage)scope.localStorage=saved.storage;else delete scope.localStorage; if(saved.hasCast)S.castAssets.BOOST=saved.cast;else delete S.castAssets.BOOST; if(saved.hasLayer)G.cutinBandLayer=saved.layer;else delete G.cutinBandLayer; G.character=saved.character; G.specialCutinBand=saved.band; }
