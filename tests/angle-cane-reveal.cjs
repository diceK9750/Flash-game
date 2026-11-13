// ANGLE's HANDSTAND glow and sparks ease in without changing their geometry or the trail.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { scope, launch } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG;
const saved = { spark:G.spark, glow:G.grandGlow, trail:G.grandTrail, slots:S.castAssets.ANGLE };
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const near = (a,b) => assert(Math.abs(a-b)<1e-7, `${a} != ${b}`);
const cl = u => Math.max(0,Math.min(1,u)), smooth = u => { u=cl(u); return u*u*(3-2*u); };
const scene = (t,flags={}) => ({ type:'ANGLE',t,end:2.43,climax:C.grandClimax.ANGLE,grand:true,
  heroWX:1200,heroY:50,source:{x:1230},after:null,afterTotal:.6,short:false,skipped:false,...flags });
function context() {
  const stack=[],o={globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();}};
  return new Proxy(o,{get:(v,k)=>k in v?v[k]:()=>{},set:(v,k,x)=>(v[k]=x,true)});
}
let calls=[];
G.spark=(ctx,x,y,r,color,rotation)=>calls.push({kind:'spark',x,y,r,color,rotation,alpha:ctx.globalAlpha});
G.grandGlow=(ctx,x,y,r,color,alpha)=>calls.push({kind:'glow',x,y,r,color,alpha});
G.grandTrail=(ctx,st,tx,ty,floor,poses,n,dt,colors,width,alpha)=>calls.push({kind:'trail',poses:[...poses],n,dt,colors:[...colors],width,alpha});
function draw(st,reduced=false,back=false) {
  calls=[]; const ctx=context(), before=JSON.stringify(st), a=G.grandActor(st,sx,sy,ground);
  G.grandPoseFx(ctx,st,a,sx,sy,ground,1,back,reduced);
  assert.equal(JSON.stringify(st),before);near(ctx.globalAlpha,1);
  return { a, calls:calls.slice() };
}
function asset() {
  const d=S.definitions.CAST.ANGLE.HANDSTAND, data=JSON.parse(fs.readFileSync(d.metadata,'utf8')); assert(S.normalizeCell(data));
  return {ready:true,image:{complete:true,naturalWidth:data.frameWidth,naturalHeight:data.frameHeight},data};
}
try {
  const hues=['#ff4d6d','#ffb340','#ffe066','#5fd35f','#4dc3ff','#a46bff'];
  for (const assets of [{...saved.slots,HANDSTAND:asset()},{}]) {
    S.castAssets.ANGLE=assets;
    for (const heroWX of [1200,1800]) for (const reduced of [false,true]) for (const dt of [0,.01,.025,.05,.075,.1,.15]) {
      const st=scene(.35+dt,{heroWX,source:{x:heroWX+30}}), result=draw(st,reduced), tip=G.grandTip(st,result.a,sx,ground), t=G.grandT(st), f=smooth((t-.35)/.1);
      assert.equal(result.a.pose,'HANDSTAND');const sparks=result.calls.filter(x=>x.kind==='spark'),glow=result.calls.find(x=>x.kind==='glow');
      assert.equal(sparks.length,8); assert(glow);near(glow.x,tip.x);near(glow.y,tip.y);near(glow.r,30);near(glow.alpha,.9*f);assert.equal(glow.color,'255,230,120');
      for(let i=0;i<8;i++){
        const life=(t*3+G.grandRand(i,29))%1,an=G.grandRand(i,30)*Math.PI*2,s=sparks[i];
        near(s.alpha,(1-life)*f);near(s.x,tip.x+Math.cos(an)*60*life);near(s.y,tip.y+Math.sin(an)*60*life+40*life*life);
        near(s.r,7*(1-life)+3);near(s.rotation,t*8+i);assert.equal(s.color,hues[i%6]);
      }
      const trail=draw(st,reduced,true).calls.find(x=>x.kind==='trail');assert(trail);assert.equal(trail.alpha,1);assert.equal(trail.n,16);near(trail.dt,.014);assert.equal(trail.width,22);assert.deepEqual(trail.colors,hues);
    }
  }
  // Live reduced-motion switches must not cause light changes.
  for(const t of [.35,.37,.40,.43,.45]){
    const a=draw(scene(t),false).calls.filter(x=>x.kind!=='trail'),b=draw(scene(t),true).calls.filter(x=>x.kind!=='trail');assert.deepEqual(a,b);
  }
  // Short, skip, and after keep the original full-strength effect wherever HANDSTAND is present.
  for(const flags of [{short:true},{skipped:true},{after:0}]){
    const st=scene(.4,flags), r=draw(st), tip=G.grandTip(st,r.a,sx,ground), glow=r.calls.find(x=>x.kind==='glow');
    if(r.a.pose==='HANDSTAND'){assert(glow);near(glow.alpha,.9);near(glow.x,tip.x);}
  }
  const game=launch();game.grandSpecialEnabled=true;game.objects=[];game.trail=[];
  for(const mode of ['short','skip','after']){
    game.comboShort=mode==='short';game.startCombo({type:'ANGLE',source:{x:game.body.x-250}},true);
    if(mode==='skip')game.endCombo(true);else if(mode==='after')game.endCombo(false);
    const st=G.grandState(game);assert(st);draw(st);game.combo=null;game.comboAfter=null;
  }
  for(const fps of [30,60,120,144])for(let phase=0;phase<5;phase++){
    let prev=0;for(let dt=(phase+1)/(5*fps);dt<.1;dt+=1/fps){
      const glow=draw(scene(.35+dt)).calls.find(x=>x.kind==='glow');assert(glow);const f=glow.alpha/.9;near(f,smooth(dt/.1));assert(f>=prev-1e-9);prev=f;
    }
  }
  console.log('ANGLE cane reveal PASS: both sides, loaded/fallback, spark/glow geometry, trail, live reduced, short/skip/after, 30–144Hz and state purity.');
} finally { G.spark=saved.spark;G.grandGlow=saved.glow;G.grandTrail=saved.trail;S.castAssets.ANGLE=saved.slots; }
