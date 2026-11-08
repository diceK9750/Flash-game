// C120: authorized GUARD main-drone waveform/attack snapshot refresh only; all assertions retained.
// C119: authorized ANGLE pyon waveform/attack snapshot refresh only; every assertion retained.
// C118: authorized BRAKE waveform/attack snapshot refresh only; every existing assertion retained.
// C117: authorized STOPPER waveform/attack snapshot refresh only; every existing assertion retained.
// C116: only the authorized DASH impact snapshot changes; every existing assertion is retained.
// C115 refreshes only the authorized BOUNCE snapshot; all original BOOST assertions remain.
// C114: change only the BOOST opening color; retain every scene beat and signature.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const s={Hop:{},window:{localStorage:{getItem:()=>null}}};vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/audio.js'),'utf8'),s);const A=s.Hop.Audio,r=A.specialRecipes.SPECIAL_BOOST,J=x=>JSON.parse(JSON.stringify(x));
assert.deepEqual(J(r.map(v=>[v[0],v[1],v[2],v[3]])),[['noise',0,.45,.09],['tone',0,.16,.06],['tone',.06,.55,.045],['tone',.46,.30,.03]],'all four starts/durations/amplitudes retained');
assert(Math.abs(Math.max(...r.map(v=>v[1]+v[2]))-.76)<1e-9,'full tail .76, no extension');
assert.equal(A.specialPeakCap,.16);assert(Math.abs(A.peakSum(r)-.195)<1e-9,'original budget and signature master scaling retained');
assert(r.every(v=>Math.min(v[5],v[6])>=45),'no deeper floor');
assert(r[0][4]==='bandpass'&&r[0][6]>=500&&r[1][4]==='triangle'&&r[1][5]>r[1][6]&&r[1][6]>=300,'light comic burst, not low sine explosion');
assert.deepEqual(J(r.slice(2)),[['tone',.06,.55,.045,'sawtooth',180,1500,.03],['tone',.46,.30,.03,'sine',1760,2350,.01]],'rising sweep and sparkle tuple-exact');
const protectedTables={specialRecipes:Object.fromEntries(Object.entries(A.specialRecipes).filter(([k])=>k!=='SPECIAL_BOOST')),comboRecipes:A.comboRecipes,fxRecipes:A.fxRecipes,launchRecipes:A.launchRecipes};
assert.equal(crypto.createHash('sha256').update(JSON.stringify(protectedTables)).digest('hex'),'942660a7feaa15f4423d371582af39e123d86264acfbf607de2a0e2fd6a476af','every other SPECIAL/combo/fx/launch recipe exact');
console.log('special-boost-se PASS: comic opening, original four beats/tail/cap/budget, exact sweep/sparkle and all other recipes');
