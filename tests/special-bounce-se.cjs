// C120: authorized GUARD main-drone waveform/attack snapshot refresh only; all assertions retained.
// C119: authorized ANGLE pyon waveform/attack snapshot refresh only; every assertion retained.
// C118: authorized BRAKE waveform/attack snapshot refresh only; every existing assertion retained.
// C117: authorized STOPPER waveform/attack snapshot refresh only; every existing assertion retained.
// C116: only the authorized DASH impact snapshot changes; every existing assertion is retained.
// C115: three identical comic strikes, original two hops, no scene retiming.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const s={Hop:{},window:{localStorage:{getItem:()=>null}}};vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/audio.js'),'utf8'),s);const A=s.Hop.Audio,r=A.specialRecipes.SPECIAL_BOUNCE,J=x=>JSON.parse(JSON.stringify(x));
assert.deepEqual(J(r.map(v=>[v[0],v[1],v[2],v[3]])),[...[0,.09,.18].flatMap(t=>[['noise',t,.06,.07],['tone',t,.09,.06]]),['tone',.3,.26,.035],['tone',.46,.3,.035]],'all eight starts/durations/amplitudes exact');
assert(Math.abs(Math.max(...r.map(v=>v[1]+v[2]))-.76)<1e-9,'full tail .76, no extension');assert.equal(A.specialPeakCap,.16);assert(Math.abs(A.peakSum(r)-.13)<1e-9,'original .13 overlap budget');
assert(r.every(v=>Math.min(v[5],v[6])>=60),'no lower bass floor');
for(const i of [2,4])for(const n of [0,1])assert.deepEqual(J(r[i+n].slice(2)),J(r[n].slice(2)),'three strikes identical except onset');
assert(r[0][4]==='bandpass'&&r[0][6]>=800&&r[1][4]==='triangle'&&r[1][5]>r[1][6]&&r[1][6]>=300,'light midrange paper/wood strikes, not sine thuds');
assert.deepEqual(J(r.slice(6)),[['tone',.3,.26,.035,'square',300,900,.01],['tone',.46,.3,.035,'square',450,1350,.01]],'two rising hops tuple-exact');
const tables={specialRecipes:Object.fromEntries(Object.entries(A.specialRecipes).filter(([k])=>k!=='SPECIAL_BOUNCE')),comboRecipes:A.comboRecipes,fxRecipes:A.fxRecipes,launchRecipes:A.launchRecipes};
assert.equal(crypto.createHash('sha256').update(JSON.stringify(tables)).digest('hex'),'f731c79da5042083c223475cd8263677bfef5748c875d08e6e9ee34a7313eb8d','all other SPECIAL/combo/fx/launch recipes exact');
console.log('special-bounce-se PASS: three identical comic strikes, eight original beats, tail/cap/budget, exact hops and other recipes');
