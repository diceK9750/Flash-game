const { near, isolated, hit, impact } = require('./specials.cjs');
const { scope } = require('./phase2.cjs');
const assert = require('node:assert/strict');
const c=scope.Hop.CONFIG;
let cases=0;
function test(name,fn){try{fn();cases++;}catch(e){e.message=name+': '+e.message;throw e;}}
function shield(g,remaining=10){g.guardSpecial={active:true,remaining};}
function advance(g,seconds,fps=120){for(let i=0;i<Math.round(seconds*fps);i++)g.update(1/fps);}
function high(g){g.objects=[];Object.assign(g.body,{y:100000,vx:500,vy:0,grounded:false,stopped:false});}
for(const [type,angle,impulse] of [['BOOST',45,800],['BOUNCE',60,880],['DASH',25,880]])test(type+' additive vector',()=>{
 const g=isolated();Object.assign(g.body,{vx:200,vy:-100});g.applyContact(type);
 near(g.body.vx,200+impulse*Math.cos(angle*Math.PI/180));near(g.body.vy,-100+impulse*Math.sin(angle*Math.PI/180));
});
test('BRAKE both components; ANGLE exact complementary rotation including high speed',()=>{
 const g=isolated();Object.assign(g.body,{vx:800,vy:-600});g.applyContact('BRAKE');near(g.body.vx,400);near(g.body.vy,-300);
 for(const angle of [-80,-30,0,10,20,30,45,60,80])for(const speed of [500,2300]){
  Object.assign(g.body,{vx:speed*Math.cos(angle*Math.PI/180),vy:speed*Math.sin(angle*Math.PI/180)});
  g.applyContact('ANGLE');near(Math.hypot(g.body.vx,g.body.vy),speed);near(Math.atan2(g.body.vy,g.body.vx)*180/Math.PI,90-Math.abs(angle));
 }
});
test('STOPPER forces stop, Type B charged revival has priority',()=>{
 const g=isolated();hit(g,'STOPPER');assert(g.body.stopped);near(g.body.vx,0);near(g.body.vy,0);g.objects=[];g.update(c.physicsStep);assert.equal(g.state,'RESULT');
 const b=isolated();b.acquireMerchant('B');b.merchant.charge=4;hit(b,'STOPPER');assert(!b.body.stopped);assert.equal(b.merchant,null);near(Math.hypot(b.body.vx,b.body.vy),c.typeBBaseSpeed+4*c.typeBChargeBonus);
});
test('STOPPER SPECIAL miss finishes immediately, cannot be rescued by an extra aerial input',()=>{
 const g=isolated();g.specialArmed.stopper=true;hit(g,'STOPPER');g.resolveSpecial(false);
 assert.equal(g.state,'RESULT');assert.equal(g.aerial('UP'),false);
});
test('STOPPER SPECIAL initial vector remains strongest of four after acceleration caps',()=>{
 const speeds=[];
 for(const type of ['BOOST','BOUNCE','DASH','STOPPER']){
  const g=isolated(),rule=c.specials[type];g.specialArmed[rule.trigger]=true;
  hit(g,type,{next:rule.partner?[{x:900,type:rule.partner}]:[]});g.act();speeds.push(Math.hypot(g.body.vx,g.body.vy));
 }
 assert(speeds[3]>Math.max(...speeds.slice(0,3)));near(speeds[3],2300);
});
test('BRAKE ready from successful automatic DOWN, no wall-clock expiry',()=>{
 const g=isolated();high(g);g.body.vy=500;g.act();assert(g.specialArmed.brake);assert.equal(g.downCooldown,1.5);
 advance(g,3);assert(g.specialArmed.brake);hit(g,'BRAKE');assert.equal(g.special.type,'BRAKE');assert(!g.specialArmed.brake);
 g.act();near(g.body.vx,500);near(g.body.vy,-100);assert.equal(g.upRemaining,3);
});
for(const cancel of ['BOOST','BOUNCE','ANGLE','DASH','GUARD','STOPPER','GROUND','UP'])test('BRAKE ready canceled by '+cancel,()=>{
 const g=isolated();g.specialArmed.brake=true;
 if(cancel==='GROUND')impact(g);else if(cancel==='UP'){g.body.y=100;g.body.vy=-100;g.act();}else hit(g,cancel);
 assert(!g.specialArmed.brake);
});
test('BRAKE miss vector half, not consumed by failed DOWN cooldown',()=>{
 const g=isolated();g.body.y=100;g.body.vy=100;g.downCooldown=1;g.act();assert(!g.specialArmed.brake);
 g.specialArmed.brake=true;hit(g,'BRAKE');g.resolveSpecial(false);near(g.body.vx,250);near(g.body.vy,-50);
});
test('ANGLE deterministic draw exactly once per contact; success and miss',()=>{
 for(const [roll,expected] of [[0,true],[0.099999,true],[0.1,false],[0.9,false]]){
  const g=isolated();let draws=0;g.random=()=>{draws++;return roll;};hit(g,'ANGLE');assert.equal(!!g.special,expected);assert.equal(draws,1);
  g.contactObjects({x:400,y:10});assert.equal(draws,1);
  if(expected){g.act();near(g.body.vx,Math.hypot(500,100));near(g.body.vy,0);}else{near(g.body.vx,100);near(g.body.vy,500);}
 }
 const g=isolated();g.random=()=>0;hit(g,'ANGLE');g.resolveSpecial(false);near(g.body.vx,100);near(g.body.vy,500);
});
for(const type of ['BOOST','BOUNCE','DASH','STOPPER','BRAKE','ANGLE'])test('normalGuard next contact '+type,()=>{
 const g=isolated();hit(g,'GUARD');hit(g,type);assert.equal(g.normalGuard,0);assert.equal(g.special,null);
 if(['BOOST','BOUNCE','DASH','STOPPER'].includes(type)){near(g.body.vx,500);near(g.body.vy,-100);assert(!g.body.stopped);}
 if(type==='BRAKE'){near(g.body.vx,250);near(g.body.vy,-50);}
 if(type==='ANGLE'){near(g.body.vx,100);near(g.body.vy,500);}
});
test('GUARD special double contact, no precondition time limit, success replaces normal',()=>{
 const g=isolated();hit(g,'GUARD');high(g);advance(g,20);assert.equal(g.normalGuard,1);
 hit(g,'GUARD');assert.equal(g.special.type,'GUARD');assert.equal(g.normalGuard,0);g.act();assert(g.guardSpecial.active);near(g.guardSpecial.remaining,10);assert.equal(g.normalGuard,0);
});
test('GUARD special MISS gives ordinary GUARD',()=>{
 const g=isolated();hit(g,'GUARD');hit(g,'GUARD');g.resolveSpecial(false);assert.equal(g.normalGuard,1);assert(!g.guardSpecial.active);
});
for(const type of ['BOOST','BOUNCE','BRAKE','ANGLE','DASH','GUARD'])test('GUARD SPECIAL persists through '+type,()=>{
 const g=isolated();shield(g,7.4);hit(g,type);assert(g.guardSpecial.active);near(g.guardSpecial.remaining,7.4);assert.equal(g.special,null);
 if(type==='GUARD'){assert.equal(g.normalGuard,1);hit(g,'GUARD');assert.equal(g.special,null);near(g.guardSpecial.remaining,7.4);assert.equal(g.normalGuard,1);}
});
test('both shields: normal STOPPER first, special STOPPER second',()=>{
 const g=isolated();shield(g,7.4);hit(g,'GUARD');hit(g,'STOPPER');assert.equal(g.normalGuard,0);assert(g.guardSpecial.active);near(g.body.vx,500);
 hit(g,'STOPPER');assert(!g.guardSpecial.active);assert(!g.body.stopped);near(g.body.vx,500);
});
for(const success of [true,false])test('STOPPER SPECIAL before special shield '+success,()=>{
 const g=isolated();shield(g,7.4);hit(g,'BOOST');hit(g,'STOPPER');assert(g.special);g.resolveSpecial(success);
 assert.equal(g.guardSpecial.active,success);assert(!g.body.stopped);
 if(success){near(Math.hypot(g.body.vx,g.body.vy),2300);assert(g.successVisual.strong);assert.equal(g.soundEvent,'STOPPER');}
});
for(const fps of [30,60,120,144])test('10s playable guard timer at '+fps+' fps',()=>{
 const g=isolated();high(g);shield(g);advance(g,9,fps);near(g.guardSpecial.remaining,1);advance(g,1,fps);assert(!g.guardSpecial.active);near(g.guardSpecial.remaining,0);
});
for(const pause of ['special','specialMessage','merchantVisual','C'])test('guard timer pauses for '+pause,()=>{
 const g=isolated();high(g);shield(g,7.4);
 if(pause==='special'){g.specialArmed.brake=true;hit(g,'BRAKE');}
 else if(pause==='C')g.acquireMerchant('C');
 else g[pause]={remaining:1};
 advance(g,0.5);near(g.guardSpecial.remaining,7.4);
 if(pause==='C')g.merchant=null;else g[pause]=null;
 high(g);advance(g,0.5);near(g.guardSpecial.remaining,6.9);
});
test('partial visual expiry consumes only playable time independent of FPS',()=>{
 for(const fps of [30,60,120,144]){
  const g=isolated();high(g);shield(g);g.specialMessage={remaining:0.5};advance(g,1,fps);near(g.guardSpecial.remaining,9.5);
 }
});
test('ordinary contact/effect does not pause guard timer',()=>{
 const g=isolated();high(g);shield(g);g.contact={label:'BOOST',remaining:2};g.effect={label:'AERIAL UP',remaining:2};
 advance(g,0.5);near(g.guardSpecial.remaining,9.5);
});
test('merchant STOPPER miss spends contact normal shield before special shield',()=>{
 const g=isolated();shield(g,7.4);g.normalGuard=1;hit(g,'STOPPER',{x:800});
 assert.equal(g.special.merchantType,'A');assert.equal(g.normalGuard,0);g.resolveSpecial(false);
 assert(g.guardSpecial.active);near(g.guardSpecial.remaining,7.4);assert(!g.body.stopped);assert.equal(g.special,null);
});
for(const type of Object.keys(c.merchantTypes))test('merchant with special shield '+type,()=>{
 const g=isolated();shield(g,7.4);hit(g,type,{x:800});assert.equal(g.special.merchantType,c.merchantTypes[type]);g.act();assert(g.guardSpecial.active);near(g.guardSpecial.remaining,7.4);
 if(type==='BOOST'){advance(g,3);near(g.guardSpecial.remaining,7.4);}
});
for(const merchantType of ['A','B'])for(const type of ['BRAKE','ANGLE','GUARD'])test(merchantType+' excludes '+type+' SPECIAL',()=>{
 const g=isolated();g.acquireMerchant(merchantType);g.specialArmed.brake=true;g.random=()=>0;
 if(type==='GUARD')g.normalGuard=1;hit(g,type);assert(g.special);g.act();
 if(merchantType==='A')assert.equal(g.merchant.remaining,3);else assert.equal(g.merchant.charge,0);
});
test('RETRY clears guard timer, BRAKE ready, mode and sound',()=>{
 const g=isolated();shield(g);g.normalGuard=1;g.specialArmed.brake=true;g.aerialMode='UP';g.soundEvent='GUARD';g.finish();g.act();
 assert(!g.guardSpecial.active);near(g.guardSpecial.remaining,0);assert.equal(g.normalGuard,0);assert(!g.specialArmed.brake);assert.equal(g.aerialMode,'DOWN');assert.equal(g.soundEvent,null);
});
console.log(JSON.stringify({guardAndContact:'PASS',cases}));
