require('./controls.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scope,element}=require('./phase2.cjs');
const {isolated,hit}=require('./specials.cjs');
const {UI,CONFIG:c,Audio}=scope.Hop;
let cases=0;function test(name,fn){try{fn();cases++;}catch(e){e.message=name+': '+e.message;throw e;}}
function setup(){const g=isolated();Object.assign(g.body,{x:500,y:200,vy:500,grounded:false});g.cameraX=300;const ui=new UI(g,element('canvas'));scope.Hop.bindInput(g,ui);ui.update();return {g,ui};}
function obj(type,x){return {type,x,used:false};}
test('stage-only scroll policy, one pointer, mute cannot advance state',()=>{
 const {g,ui}=setup();assert.equal(element('stage').className,'stage flying');
 assert.deepEqual(Object.keys(element('stage').listeners),['pointerdown']);
 const snapshot=JSON.stringify(g);element('se-toggle').listeners.click();assert.equal(JSON.stringify(g),snapshot);element('se-toggle').listeners.click();
 for(const state of ['READY','AIM_ANGLE','AIM_POWER','RESULT']){g.state=state;g.finalDistance=0;ui.update();assert.equal(element('stage').className,'stage');assert(element('flight-hud').hidden);}
 const css=fs.readFileSync(path.join(__dirname,'../css/style.css'),'utf8');assert(css.includes('.stage.flying { touch-action: none; overscroll-behavior: none; }'));assert(css.includes('touch-action: pan-y pinch-zoom'));
});
test('preview arming, adjacent x-order, used/behind filtering, chance never sampled',()=>{
 const {g,ui}=setup();g.random=()=>{throw Error('UI must not sample RNG');};
 g.objects=[obj('BOUNCE',1000),obj('BOOST',700),obj('ANGLE',1200)];assert.equal(UI.readyTargets(g)[0].object.type,'BOOST');
 g.objects.push(obj('BRAKE',850));assert.equal(UI.readyTargets(g).length,0);
 g.objects[3].used=true;assert.equal(UI.readyTargets(g).length,1);
 for(const [key,type] of [['dash','DASH'],['stopper','STOPPER'],['brake','BRAKE']]){g.specialArmed[key]=true;g.objects=[obj(type,700)];ui.update();assert.equal(UI.readyTargets(g).length,1);assert(element('ready-targets').textContent.includes(scope.Hop.CAST[type].name));g.specialArmed[key]=false;}
 g.objects=[obj('GUARD',700)];g.normalGuard=1;assert.equal(UI.readyTargets(g).length,1);g.guardSpecial.active=true;assert.equal(UI.readyTargets(g).length,0);
 g.objects=[obj('BOOST',100),obj('BOUNCE',200)];assert.equal(UI.readyTargets(g).length,0);
 const before=JSON.stringify(g);ui.update();ui.draw();assert.equal(JSON.stringify(g),before);
});
test('zone and merchant marker require guard, zone, correct boundary and type',()=>{
 const {g,ui}=setup();g.body.x=752;g.objects=[obj('DASH',800)];assert.equal(UI.zone(g),null);
 g.normalGuard=1;assert.equal(UI.zone(g).remaining,6);
 // Hidden merchant: normal play shows no marker and no MERCHANT ZONE, even in the zone with a merchant-type target.
 assert.equal(UI.readyTargets(g).length,0);ui.update();assert(element('merchant-zone').hidden);assert.equal(element('merchant-zone').textContent,'');
 g.specialArmed.dash=true;assert.equal(UI.readyTargets(g)[0].label,'SPECIAL','a guaranteed ordinary SPECIAL keeps its label');g.specialArmed.dash=false;
 // DEBUG only: marker + zone.
 g.debug=true;assert.equal(UI.readyTargets(g)[0].label,'MERCHANT');ui.update();assert(!element('merchant-zone').hidden);assert(element('merchant-zone').textContent.includes('6.0m'));g.debug=false;ui.update();assert(element('merchant-zone').hidden);
 g.body.x=719;assert.equal(UI.zone(g),null);g.body.x=801;assert.equal(UI.zone(g),null);
 g.body.x=752;g.normalGuard=0;g.guardSpecial.active=true;assert(UI.zone(g));g.objects=[obj('DASH',790)];assert.equal(UI.readyTargets(g).length,0);
 g.objects=[obj('BRAKE',800)];assert.equal(UI.readyTargets(g).length,0);g.special={type:'DASH',remaining:1};assert.equal(UI.zone(g),null);assert.equal(UI.readyTargets(g).length,0);
 g.special=null;g.debug=true;ui.update();ui.draw();
});
test('HUD A-D overwrite, gauges, float and special priority',()=>{
 const {g,ui}=setup();assert(element('merchant-hud').hidden);
 for(const [type,expected] of [['A','🧪 TYPE A ×3'],['B','⚡ CHARGE 7/10'],['C','FLOAT 63/100'],['D','BOUND ×5']]){
  g.acquireMerchant(type);if(type==='B')g.merchant.charge=7;if(type==='C')g.merchant.remaining=63;ui.update();assert.equal(element('merchant-hud-text').textContent,expected);assert(!element('merchant-hud').hidden);
  if(type==='B')assert.equal(element('merchant-hud-charge').value,.7);
  if(type==='C')assert.equal(element('aerial-hud-text').textContent,'AERIAL 使用不可');
 }
 g.merchant=null;g.downCharge=.635;g.aerialMode='DOWN';ui.update();assert.equal(element('aerial-hud-text').textContent,'AERIAL ↓ 63%');assert.equal(element('aerial-hud-charge').value,.635);
 g.specialArmed.brake=true;hit(g,'BRAKE');ui.update();assert.equal(element('aerial-hud-text').textContent,'SPECIAL優先');assert(element('ready-targets').hidden);assert.equal(element('special-fill').style.width,'100%');
 const charge=g.downCharge,up=g.upRemaining;g.act();ui.update();assert.equal(g.downCharge,charge);assert.equal(g.upRemaining,up);assert.equal(element('special-title').textContent,'SPECIAL SUCCESS!');
});
test('aria writes only events, not frames, charge percentages or repeats',()=>{
 const {g,ui}=setup(),live=element('announcements');let value=live.textContent,writes=0;
 Object.defineProperty(live,'textContent',{configurable:true,get(){return value;},set(v){value=v;writes++;}});
 g.downCharge=.1;ui.update();const start=writes;for(let i=2;i<10;i++){g.downCharge=i/10;ui.update();}assert.equal(writes,start);
 g.downCharge=1;ui.update();assert.equal(value,'AERIAL DOWN READY');const ready=writes;for(let i=0;i<10;i++)ui.update();assert.equal(writes,ready);
 g.specialArmed.brake=true;hit(g,'BRAKE');ui.update();assert(value.includes('SPECIAL受付開始'));const accepted=writes;g.special.remaining=.5;ui.update();assert.equal(writes,accepted);g.resolveSpecial(false);ui.update();assert(value.includes('SPECIAL MISS'));const missed=writes;ui.update();assert.equal(writes,missed);
 Object.defineProperty(live,'textContent',{configurable:true,writable:true,value});
});
test('highlights priority, unique max three, fallback and retry clearing',()=>{
 const {g,ui}=setup();g.history=[{type:'BOOST',label:'BOOST (GUARDED)'},{type:'BRAKE',label:'BRAKE SPECIAL'},{type:'STOPPER',label:'STOPPER SPECIAL'},{type:'DASH',label:'DASH / MERCHANT TYPE B'},{type:'DASH',label:'DASH / MERCHANT TYPE B'}];
 const highlights=UI.highlights(g);assert.equal(highlights.length,3);assert(highlights[0].includes('商人 Type B'));assert(highlights[1].includes('聖光反転'));assert(highlights[2].includes('盗賊 SPECIAL'));
 g.debugUsed=true;g.finish();ui.update();assert(element('result-highlights').textContent.includes('今回のハイライト'));assert(element('record-status').textContent.includes('記録対象外'));
 g.act();ui.update();assert.equal(element('result-highlights').textContent,'');assert(UI.highlights(g)[0].includes('0回の接触'));
});
test('mute persistence restoration, denied storage, muted no-op and active sound stop',()=>{
 const saved=scope.localStorage,ctx=Audio.context;const data={};scope.localStorage={getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v};
 Audio.setMuted(true);Audio.muted=false;Audio.loadMute();assert(Audio.muted);
 Audio.context={get state(){throw Error('muted should not touch audio');}};Audio.play('SPECIAL');Audio.unlock();
 Audio.setMuted(false);Audio.loadMute();assert(!Audio.muted);
 let stopped=0;const node={stop(){stopped++;Audio.active.delete(node);}};Audio.active.add(node);Audio.setMuted(true);assert.equal(stopped,1);
 scope.localStorage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};Audio.setMuted(false);Audio.loadMute();assert(!Audio.muted);
 Audio.context=ctx;scope.localStorage=saved;
});
test('reduced motion disables strong flash and preserves static HUD, no game mutation',()=>{
 const old=scope.matchMedia;scope.matchMedia=()=>({matches:true});const {g,ui}=setup();assert(ui.visual.reducedMotion);
 g.flash=c.stopperFlashDuration;g.successVisual={strong:true,remaining:c.stopperTrailDuration};
 const colors=[];const ctx=element('canvas').getContext('2d');const proxy=new Proxy(ctx,{set(o,k,v){if(k==='fillStyle')colors.push(v);o[k]=v;return true;}});
 const before=JSON.stringify(g);scope.Hop.Graphics.draw(proxy,g,ui.visual);assert.equal(JSON.stringify(g),before);assert(!colors.some(v=>String(v).startsWith('rgba(255,')));scope.matchMedia=old;
});
test('stopping SPECIAL MISS stays briefly visible on RESULT without game timer changes',()=>{
 const {g,ui}=setup();g.specialArmed.stopper=true;hit(g,'STOPPER');g.resolveSpecial(false);assert.equal(g.state,'RESULT');
 const originalDate=scope.Date;let now=1000;scope.Date={now:()=>now};ui.update();assert(!element('special-panel').hidden);assert.equal(element('special-title').textContent,'SPECIAL MISS');
 const snapshot=JSON.stringify(g);now=2500;ui.update();assert(element('special-panel').hidden);assert.equal(JSON.stringify(g),snapshot);if(originalDate===undefined)delete scope.Date;else scope.Date=originalDate;
});
test('GUARD announcements are edges only, combine simultaneous events and suppress identical messages',()=>{
 const {g,ui}=setup(),live=element('announcements');let value=live.textContent,writes=0;
 Object.defineProperty(live,'textContent',{configurable:true,get(){return value;},set(v){value=v;writes++;}});
 g.guardSpecial={active:true,remaining:10};g.specialMessage={label:'SPECIAL SUCCESS',detail:'聖護結界',remaining:1};ui.update();
 assert(value.includes('GUARD SPECIAL開始'));assert(value.includes('SPECIAL SUCCESS'));const started=writes;
 for(let i=0;i<10;i++){g.guardSpecial.remaining-=.1;ui.update();}assert.equal(writes,started);
 g.specialMessage={...g.specialMessage};ui.update();assert.equal(writes,started);
 g.guardSpecial.active=false;g.specialMessage=null;ui.update();assert.equal(value,'GUARD SPECIAL終了');const ended=writes;ui.update();assert.equal(writes,ended);
 g.downCharge=.1;ui.update();g.downCharge=1;g.guardSpecial.active=true;ui.update();assert(value.includes('AERIAL DOWN READY'));assert(value.includes('GUARD SPECIAL開始'));
 Object.defineProperty(live,'textContent',{configurable:true,writable:true,value});
});
test('reduced-motion preference changes are reflected without reloading',()=>{
 const old=scope.matchMedia;let change;scope.matchMedia=()=>({matches:false,addEventListener(name,fn){assert.equal(name,'change');change=fn;}});
 const {ui}=setup();assert(!ui.visual.reducedMotion);change({matches:true});assert(ui.visual.reducedMotion);change({matches:false});assert(!ui.visual.reducedMotion);scope.matchMedia=old;
});
console.log(JSON.stringify({uiQuality:'PASS',cases}));
