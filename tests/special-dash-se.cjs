// C120: authorized GUARD main-drone waveform/attack snapshot refresh only; all assertions retained.
// C119: authorized ANGLE pyon waveform/attack snapshot refresh only; every assertion retained.
// C118: authorized BRAKE waveform/attack snapshot refresh only; every existing assertion retained.
// C117: authorized STOPPER waveform/attack snapshot refresh only; every existing assertion retained.
// C116: one comic impact; original clang triplet and wind, all scene timing retained.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const s={Hop:{},window:{localStorage:{getItem:()=>null}}};vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/audio.js'),'utf8'),s);const A=s.Hop.Audio,r=A.specialRecipes.SPECIAL_DASH,J=x=>JSON.parse(JSON.stringify(x));
assert.deepEqual(J(r.map(v=>[v[0],v[1],v[2],v[3]])),[['tone',0,.55,.03],['tone',0,.5,.025],['tone',0,.42,.02],['tone',0,.26,.08],['noise',.08,.62,.06]],'all five starts/durations/amplitudes exact');
assert(Math.abs(Math.max(...r.map(v=>v[1]+v[2]))-.70)<1e-9,'full tail .70, no extension');assert.equal(A.specialPeakCap,.16);assert(Math.abs(A.peakSum(r)-.215)<1e-9,'original overlap budget and shared-master scaling');
assert(r.every(v=>Math.min(v[5],v[6])>=38),'no deeper floor');assert(r[3][4]==='triangle'&&r[3][5]>r[3][6]&&r[3][6]>=300&&r[3][7]>0&&r[3][7]<=.003,'light midrange comic impact, not low sine bass');
assert.deepEqual(J(r.slice(0,3)),[['tone',0,.55,.03,'triangle',220,214,.002],['tone',0,.5,.025,'square',331,322,.002],['tone',0,.42,.02,'triangle',587,575,.002]],'three clang partials tuple-exact');
assert.deepEqual(J(r[4]),['noise',.08,.62,.06,'bandpass',380,3200,.8],'wind rush tuple-exact');
const tables={specialRecipes:Object.fromEntries(Object.entries(A.specialRecipes).filter(([k])=>k!=='SPECIAL_DASH')),comboRecipes:A.comboRecipes,fxRecipes:A.fxRecipes,launchRecipes:A.launchRecipes};
assert.equal(crypto.createHash('sha256').update(JSON.stringify(tables)).digest('hex'),'20f6ebbad05f2da636f40e3c854fe82bf4589fcde1638e2661a60d5071caf90a','all other SPECIAL/combo/fx/launch recipes exact');
console.log('special-dash-se PASS: one comic impact, original five beats/tail/cap/budget, exact clang/wind and other recipes');
