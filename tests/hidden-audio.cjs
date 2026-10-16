// Hidden-tab SE pause (2026-10-17 auto cycle 24): hiding the tab suspends the SE AudioContext (the game clock is
// frozen while hidden), showing it resumes; mute / not-started / already-suspended contexts are left alone.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.resolve(__dirname,'..');
let vis=null;const doc={hidden:false,getElementById:()=>null,addEventListener:(t,f)=>{if(t==='visibilitychange'&&!vis)vis=f;}};
const sc={document:doc,localStorage:{getItem:()=>null,setItem(){}}};sc.window=sc;vm.createContext(sc);
vm.runInContext('var Hop={};',sc);vm.runInContext(fs.readFileSync(path.join(root,'js','audio.js'),'utf8'),sc,{filename:'audio'});
const A=sc.Hop.Audio;assert.equal(typeof vis,'function','audio.js listens for visibilitychange');
const log=[];const mk=state=>({state,suspend(){log.push('suspend');this.state='suspended';return Promise.resolve();},resume(){log.push('resume');this.state='running';return Promise.resolve();}});
const flip=h=>{doc.hidden=h;vis();};const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
flip(true);flip(false);await settle();assert.deepEqual(log,[],'no context yet: nothing to do');
A.context=mk('running');flip(true);await settle();assert.deepEqual(log,['suspend']);assert.equal(A.context.state,'suspended');
flip(false);await settle();assert.deepEqual(log,['suspend','resume']);assert.equal(A.context.state,'running');
log.length=0;A.context=mk('suspended');A.pausedByHide=false;flip(true);flip(false);await settle();assert.deepEqual(log,[],'never resume a context it did not suspend (no gesture yet)');
log.length=0;A.context=mk('running');flip(true);A.muted=true;flip(false);await settle();assert.deepEqual(log,['suspend'],'muted while hidden: stay suspended');
A.muted=false;
// quick hide/show with a slow suspend: the resume must land last (ends running).
log.length=0;A.pausedByHide=false;{const c=mk('running');let done;c.suspend=function(){log.push('suspend');return new Promise(r=>done=()=>{this.state='suspended';r();});};A.context=c;flip(true);flip(false);await settle();done();await settle();await settle();assert.deepEqual(log,['suspend','resume']);assert.equal(c.state,'running','quick switch ends running');}
// resume refused (e.g. iOS): no throw; the next tap's unlock() resumes it.
log.length=0;A.context=mk('running');A.context.resume=()=>Promise.reject(new Error('NotAllowed'));flip(true);assert.doesNotThrow(()=>flip(false));
// game files untouched by this change: the SE pause never touches game state (audio.js has no Game access).
assert.ok(!/Hop\.Game|game\./.test(A.onVisibility.toString()),'display/audio only');
await settle();console.log('hidden-audio OK');})().catch(e=>{console.error(e);process.exit(1);});
