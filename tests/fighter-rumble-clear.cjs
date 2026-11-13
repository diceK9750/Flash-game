// Presentation-only: rumble text clears the fighter's face before her ascent.
const assert=require('node:assert/strict');
const {scope}=require('./phase2.cjs'),H=scope.Hop,G=H.Graphics,C=H.CONFIG,F=C.comboFighterTimes;
const mock=()=>new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:(k==='createRadialGradient'||k==='createLinearGradient')?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const state=(t,overrides={})=>({type:'BOUNCE',t,end:2.43,heroWX:1200,heroY:50,source:{x:1000},partner:{x:1650},after:null,afterTotal:.6,short:false,skipped:false,...overrides});
const pick=out=>Array.from(out).filter(x=>x.kind==='label'&&x.text==='ゴゴゴ…');
let cases=0;
for(const offset of [-1200,-300,900])for(const fps of [30,60,120,144]){
  const sx=x=>C.launchX+x+offset,sy=y=>C.groundY-C.playerRadius-y;
  for(let tick=Math.ceil(F.gone*fps);tick<=Math.ceil(F.upper*fps);tick++){
    const t=tick/fps,st=state(t),snapshot=JSON.stringify(st),out=G.comboFront(mock(),st,sx,sy,C.groundY,false),arr=pick(out);
    const reduced=pick(G.comboFront(mock(),st,sx,sy,C.groundY,true));
    assert.equal(JSON.stringify(reduced),JSON.stringify(arr),'toggling reduced motion cannot resurrect or brighten labels');
    assert.equal(JSON.stringify(st),snapshot,'scene stays unchanged');
    assert.equal(arr.length,t<F.rise?Math.min(3,1+Math.floor((t-F.gone)/.15)):0,'text ends before fighter rises');
    arr.forEach((it,i)=>{
      assert.equal(it.x,sx(st.heroWX)+[-150,140,-10][i]);assert.equal(it.y,C.groundY-20);assert.equal(it.size,40+4*i);
      assert.equal(it.dy,-30-60*i);assert.equal(it.color,'#ffe9b0');assert(it.alpha>=0&&it.alpha<=1);
      if(t<=F.rise-.12){const old=G.labelLife(t,F.gone+.15*i,F.upper+.06);assert(Math.abs(it.alpha-old.a)<1e-9,'pre-fade opacity unchanged');}
    });cases++;
  }
}
const sx=x=>x,sy=y=>y,justBefore=pick(G.comboFront(mock(),state(F.rise-1e-6),sx,sy,C.groundY));
assert(justBefore.length===3&&justBefore.every(x=>x.alpha<1e-8),'text disappears continuously before rise');
assert.equal(pick(G.comboFront(mock(),state(F.rise),sx,sy,C.groundY)).length,0);
assert.equal(pick(G.comboFront(mock(),state(1.84,{skipped:true}),sx,sy,C.groundY)).length,3,'skip preserves old labels');
assert.equal(pick(G.comboFront(mock(),state(1.84),sx,sy,C.groundY,true)).length,0,'live reduced motion preserves the same fade');
assert.equal(pick(G.comboFront(mock(),state(1.70,{short:true}),sx,sy,C.groundY)).length,0,'short remains without rumble');
assert.equal(pick(G.comboFront(mock(),state(1.70,{after:0}),sx,sy,C.groundY)).length,0,'afterglow remains without rumble');
console.log(JSON.stringify({fighterRumbleClear:'PASS',cases,fps:[30,60,120,144],positions:['left','center','right']}));
