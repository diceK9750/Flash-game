require('./guard-special.cjs');
const {scope,element,document,launch}=require('./phase2.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {isolated,hit,near}=require('./specials.cjs');
let cases=0;function test(name,fn){try{fn();cases++;}catch(e){e.message=name+': '+e.message;throw e;}}
function bind(g){const ui=new scope.Hop.UI(g,element('canvas'));scope.Hop.bindInput(g,ui);return ui;}
function tap(extra={}){element('stage').listeners.pointerdown({button:0,isPrimary:true,preventDefault(){},...extra});}
test('stage has exactly one pointer listener, no game buttons; full state loop',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert(!/<button\b/i.test(html));
 const g=new scope.Hop.Game();const ui=bind(g);assert.deepEqual(Object.keys(element('stage').listeners),['pointerdown']);
 for(const state of ['AIM_ANGLE','AIM_POWER','FLYING']){tap();assert.equal(g.state,state);}
 g.finish();tap();assert.equal(g.state,'AIM_ANGLE');ui.draw();
});
test('one tap ascending DOWN, descending UP, cooldown/no charges are no-ops',()=>{
 const g=isolated();bind(g);Object.assign(g.body,{y:100,vy:300});tap();assert.equal(g.upRemaining,3);near(g.downCooldown,1.5);assert(g.specialArmed.brake);
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
  tap();assert.equal(g.special,null);assert.equal(g.upRemaining,3);near(g.downCooldown,0);
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
console.log(JSON.stringify({controlsAndAudio:'PASS',cases}));
