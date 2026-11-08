// C120: authorized GUARD main-drone waveform/attack snapshot refresh only; all assertions retained.
// C119: authorized ANGLE pyon waveform/attack snapshot refresh only; every assertion retained.
// C118: one falling tone color/attack only; the swoop, whoosh and tick keep their identity.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const s={Hop:{},window:{localStorage:{getItem:()=>null}}};vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/audio.js'),'utf8'),s);const A=s.Hop.Audio,r=A.specialRecipes.SPECIAL_BRAKE,J=x=>JSON.parse(JSON.stringify(x));
assert.deepEqual(J(r.map(v=>[v[0],v[1],v[2],v[3]])),[['noise',0,.5,.07],['tone',0,.46,.05],['tone',.5,.06,.03]],'all three starts/durations/amplitudes exact');
assert.deepEqual(J(r[0]),['noise',0,.5,.07,'bandpass',2600,240,2.2],'whoosh tuple-exact');assert.deepEqual(J(r[2]),['tone',.5,.06,.03,'square',150,120,.002],'end tick tuple-exact');
assert.deepEqual(J([r[1][5],r[1][6]]),[720,105],'original falling pitch endpoints exact');assert(r.every(v=>Math.min(v[5],v[6])>=105),'no deeper floor');
assert.equal(r.length,3);assert(Math.abs(Math.max(...r.map(v=>v[1]+v[2]))-.56)<1e-9,'full tail .56, no extension');assert.equal(A.specialPeakCap,.16);assert(Math.abs(A.peakSum(r)-.12)<1e-9,'original overlap budget and master gain');assert(r[1][4]==='triangle'&&r[1][7]>0&&r[1][7]<=.02,'comic non-sine waveform and no slower attack');
const tables={specialRecipes:Object.fromEntries(Object.entries(A.specialRecipes).filter(([k])=>k!=='SPECIAL_BRAKE')),comboRecipes:A.comboRecipes,fxRecipes:A.fxRecipes,launchRecipes:A.launchRecipes};assert.equal(crypto.createHash('sha256').update(JSON.stringify(tables)).digest('hex'),'05942ccbe1c4e79f95e14783f55c7ab4b4be3a8daa42f076df41c1e8715f90b6','all other SPECIAL/combo/fx/launch recipes exact');
console.log('special-brake-se PASS: waveform/attack only, exact 720-to-105 swoop/whoosh/tick, three beats/tail/cap/budget');
