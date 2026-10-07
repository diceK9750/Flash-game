require('./guard-special.cjs');
const {scope,element,document,launch}=require('./phase2.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {isolated,hit,near}=require('./specials.cjs');
let cases=0;function test(name,fn){try{fn();cases++;}catch(e){e.message=name+': '+e.message;throw e;}}
function bind(g){const ui=new scope.Hop.UI(g,element('canvas'));scope.Hop.bindInput(g,ui);return ui;}
function tap(extra={}){element('stage').listeners.pointerdown({button:0,isPrimary:true,preventDefault(){},...extra});}
test('stage has exactly one pointer listener, only external SE button; full state loop',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.equal((html.match(/<button\b/g)||[]).length,1);assert(html.includes('id="se-toggle"'));
 const g=new scope.Hop.Game();const ui=bind(g);assert.deepEqual(Object.keys(element('stage').listeners),['pointerdown']);
 for(const state of ['AIM_ANGLE','AIM_POWER','FLYING']){tap();assert.equal(g.state,state);}
 g.finish();tap();assert.equal(g.state,'AIM_ANGLE');ui.draw();
});
test('one tap ascending DOWN, descending UP, charge/no charges are no-ops',()=>{
 const g=isolated();bind(g);Object.assign(g.body,{y:100,vy:300});tap();assert.equal(g.upRemaining,3);near(g.downCharge,0);assert(g.specialArmed.brake);
 g.body.vy=200;const vx=g.body.vx;tap();near(g.body.vx,vx);assert.equal(g.upRemaining,3);
 g.body.vy=-100;tap();assert.equal(g.upRemaining,2);assert(!g.specialArmed.brake);
 g.upRemaining=0;g.body.vy=-200;const vy=g.body.vy;tap();near(g.body.vy,vy);
});
test('hysteresis retains last mode in inclusive dead band',()=>{
 const g=isolated();for(const [vy,mode] of [[0,'DOWN'],[41,'DOWN'],[-40,'DOWN'],[-41,'UP'],[40,'UP'],[0,'UP'],[41,'DOWN']]){g.body.vy=vy;assert.equal(g.updateAerialMode(),mode);}
});
test('nonprimary/right/middle pointer cannot advance, keyboard ignored except D',()=>{
 const g=new scope.Hop.Game();bind(g);tap({button:2});tap({button:1});tap({isPrimary:false});assert.equal(g.state,'READY');
 for(const code of ['Space','Enter'])document.listeners.keydown({code,repeat:false});assert.equal(g.state,'READY');
 document.listeners.keydown({code:'KeyD',repeat:false});assert(g.debug);document.listeners.keydown({code:'KeyD',repeat:true});assert(g.debug);
});
test('all seven special taps only resolve, never trigger AERIAL',()=>{
 for(const type of Object.keys(scope.Hop.CONFIG.specials)){
  const g=isolated();bind(g);g.random=()=>0;const rule=scope.Hop.CONFIG.specials[type];
  if(type==='GUARD')g.normalGuard=1;else g.specialArmed[rule.trigger]=true;
  hit(g,type,{next:rule.partner?[{x:900,type:rule.partner}]:[]});assert(g.special);
  for(const code of ['Space','Enter'])document.listeners.keydown({code,repeat:false});assert(g.special);
  tap();assert.equal(g.special,null);assert.equal(g.upRemaining,3);near(g.downCharge,1);
 }
});
test('audio absent, denied, or suspended never breaks controls',()=>{
 scope.Hop.Audio.context=null;scope.Hop.Audio.unlock();scope.Hop.Audio.play('STOPPER');
 scope.AudioContext=class {constructor(){throw Error('denied');}};scope.Hop.Audio.unlock();assert.equal(scope.Hop.Audio.context,null);
 scope.AudioContext=class {constructor(){this.state='suspended';}resume(){return Promise.reject(Error('denied'));}};
 scope.Hop.Audio.unlock();scope.Hop.Audio.play('GUARD');delete scope.AudioContext;scope.Hop.Audio.context=null;
});
test('three distinct synthetic sounds and node cleanup',()=>{
 const sounds=[];scope.Hop.Audio.context={state:'running',currentTime:0,destination:{},createOscillator(){const node={type:'',frequency:{setValueAtTime(f){sounds.push(f);}},connect(){},disconnect(){},start(){},stop(){this.onended();}};return node;},createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
 for(const kind of ['SPECIAL','STOPPER','GUARD'])scope.Hop.Audio.play(kind);
 assert.deepEqual(sounds,[520,780,100,520,1100,660,990]);scope.Hop.Audio.context=null;
});
test('twenty bounded one-input integration runs eventually stop',()=>{
 for(let seed=1;seed<=20;seed++){
  const g=launch(seed);let frame=0;
  while(g.state==='FLYING' && frame<36000){if(frame<2400 && frame%60===0)g.act();g.update(1/120);frame++;assert(Number.isFinite(g.body.x));}
  assert.equal(g.state,'RESULT','seed '+seed);
 }
});

function chargeFlight(){const g=isolated();Object.assign(g.body,{y:100000,vy:500,grounded:false,stopped:false});return g;}
function advanceCharge(g,seconds,fps=120){for(let i=0;i<Math.round(seconds*fps);i++)g.update(1/fps);}
test('initial/full, DOWN zero, failed DOWN leaves BRAKE unarmed, UP preserves charge',()=>{
 const g=chargeFlight();bind(g);assert.equal(g.downCharge,1);tap();assert.equal(g.downCharge,0);assert(g.specialArmed.brake);
 g.specialArmed.brake=false;g.body.vy=500;tap();assert.equal(g.downCharge,0);assert(!g.specialArmed.brake);
 g.downCharge=0.5;tap();assert.equal(g.downCharge,0.5);assert(!g.specialArmed.brake);
 g.body.vy=-500;tap();assert.equal(g.downCharge,0.5);assert.equal(g.upRemaining,2);
 g.finish();tap();assert.equal(g.downCharge,1);assert(!g.specialArmed.brake);
});
for(const fps of [30,60,120,144])test('charge timing, cap, reuse and pause expiry at '+fps+'fps',()=>{
 const g=chargeFlight();g.downCharge=0;advanceCharge(g,0.75,120);near(g.downCharge,0.5);
 g.downCharge=0;g.accumulator=0;advanceCharge(g,1.5,fps);assert.equal(g.downCharge,1);
 advanceCharge(g,1,fps);assert.equal(g.downCharge,1);g.body.vy=500;g.act();assert.equal(g.downCharge,0);
 g.specialMessage={remaining:0.5};advanceCharge(g,1,fps);near(g.downCharge,1/3);
});
for(const pause of ['special','merchantSpecial','SUCCESS','MISS','merchantVisual','C'])test('charge pauses and resumes for '+pause,()=>{
 const g=chargeFlight();g.downCharge=0.25;g.guardSpecial={active:true,remaining:7};
 if(pause==='special'||pause==='merchantSpecial'){g.specialArmed.brake=true;if(pause==='merchantSpecial'){g.normalGuard=1;g.random=()=>0;}hit(g,pause==='special'?'BRAKE':'DASH',{x:800});assert(g.special);}
 else if(pause==='C')g.acquireMerchant('C');
 else if(pause==='merchantVisual')g.merchantVisual={remaining:1};
 else g.specialMessage={label:'SPECIAL '+pause,remaining:1};
 advanceCharge(g,0.5);near(g.downCharge,0.25);near(g.guardSpecial.remaining,7);
 if(g.special){bind(g);const up=g.upRemaining;tap();near(g.downCharge,0.25);assert.equal(g.upRemaining,up);}
 g.special=null;g.specialMessage=null;g.merchantVisual=null;g.merchant=null;
 Object.assign(g.body,{y:100000,vy:500,stopped:false,grounded:false});advanceCharge(g,0.75);near(g.downCharge,0.75);
});
for(const state of ['READY','AIM_ANGLE','AIM_POWER','RESULT'])test('no charge in '+state,()=>{
 const g=chargeFlight();g.downCharge=0.25;g.state=state;advanceCharge(g,2);near(g.downCharge,0.25);
});
test('charge UI percentage, bar and hysteresis hint agree without early READY',()=>{
 const g=chargeFlight(),ui=bind(g);g.downCharge=0.635;ui.update();assert.equal(element('down-status').textContent,'AERIAL ↓ 63%');near(element('down-charge').value,0.635);
 g.downCharge=0.9999999999;ui.update();assert.equal(element('down-status').textContent,'AERIAL ↓ 99%');
 g.downCharge=1;ui.update();assert.equal(element('hint').textContent,'AERIAL ↓ READY');
 g.body.vy=-41;g.updateAerialMode();ui.update();assert.equal(element('hint').textContent,'AERIAL ↑ ×3');
 g.body.vy=40;g.updateAerialMode();ui.update();assert.equal(element('hint').textContent,'AERIAL ↑ ×3');
});

console.log(JSON.stringify({controlsAndAudio:'PASS',cases}));
