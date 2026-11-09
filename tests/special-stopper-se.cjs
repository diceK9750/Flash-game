// C120: authorized GUARD main-drone waveform/attack snapshot refresh only; all assertions retained.
// C119: authorized ANGLE pyon waveform/attack snapshot refresh only; every assertion retained.
// C118: authorized BRAKE waveform/attack snapshot refresh only; every existing assertion retained.
// C117: C3 pad waveform/attack only; exact twelve beats, chord, sparkles and shimmer.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const s={Hop:{},window:{localStorage:{getItem:()=>null}}};vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/audio.js'),'utf8'),s);const A=s.Hop.Audio,r=A.specialRecipes.SPECIAL_STOPPER,J=x=>JSON.parse(JSON.stringify(x));
const signature=[523.25,659.25,783.99,1046.5].map((f,i)=>['tone',i*.05,.9-i*.05,.028,'triangle',f,f,.04]).concat([2093,2637,3136,2349,3520,4186].map((f,i)=>['tone',.18+i*.1,.16,.018,'sine',f,f*1.01,.005])).concat([['noise',.15,.7,.012,'highpass',6000,9000,.7]]);
assert.deepEqual(J(r.slice(1)),signature,'all four chord tones, six sparkles and highpass tuple-exact');
assert.deepEqual(J(r.map(v=>[v[0],v[1],v[2],v[3]])),[['tone',0,.95,.035],...signature.map(v=>[v[0],v[1],v[2],v[3]])],'all twelve starts/durations/amplitudes exact with original floating point construction');
assert.equal(r.length,12);assert(Math.abs(Math.max(...r.map(v=>v[1]+v[2]))-.95)<1e-9,'full tail .95, no extension');assert.equal(A.specialPeakCap,.16);assert(Math.abs(A.peakSum(r)-.195)<1e-9,'original overlap budget and shared-master gain');
assert.deepEqual(J([r[0][5],r[0][6]]),[130.81,130.81],'C3 fixed at both endpoints');assert(r.every(v=>Math.min(v[5],v[6])>=130.81),'no deeper floor');assert(r[0][4]==='triangle'&&r[0][7]>0&&r[0][7]<=.015,'comic harmonic pad and quicker attack, no pitch gesture');
const tables={specialRecipes:Object.fromEntries(Object.entries(A.specialRecipes).filter(([k])=>k!=='SPECIAL_STOPPER')),comboRecipes:A.comboRecipes,fxRecipes:A.fxRecipes,launchRecipes:A.launchRecipes};
assert.equal(crypto.createHash('sha256').update(JSON.stringify(tables)).digest('hex'),'a820e6fabb5707f35233985bd2830b358260cd8c3810bbe4ce50e493f1c3c829','all other SPECIAL/combo/fx/launch recipes exact');
console.log('special-stopper-se PASS: C3 waveform/attack only, original twelve beats/tail/cap/budget, exact chord/sparkles/highpass');
