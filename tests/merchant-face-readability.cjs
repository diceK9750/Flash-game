// Merchant cut-in readability is display only; verify the production renderer against its unmasked baseline.
const assert=require('node:assert/strict');
const {scope}=require('./phase2.cjs'), H=scope.Hop, C=H.CONFIG, G=H.Graphics;
const baseline=Object.create(G); baseline.merchantCoinMask=()=>null;
const no=()=>{}, gradient=()=>({addColorStop:no});
function context(){let shape=null;const fills=[],stack=[];const ctx=new Proxy({globalAlpha:1,fillStyle:'',strokeStyle:'',
  save(){stack.push({globalAlpha:this.globalAlpha,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle});},
  restore(){Object.assign(this,stack.pop()||{});},arc(x,y,r){shape={x,y,r};},
  fill(){if(shape&&['#b8860b','#ffd447','#fff6c0'].includes(this.fillStyle))fills.push({...shape,color:this.fillStyle,alpha:this.globalAlpha});shape=null;},
  measureText(){return {width:100};},createLinearGradient:gradient,createRadialGradient:gradient},
  {get:(o,k)=>k in o?o[k]:no,set:(o,k,v)=>(o[k]=v,true)});return {ctx,fills};}
function render(engine,type,time,rm=false,cutPresent=true){
  const cut={merchantType:type,name:C.merchantNames[type],total:C.specialCutinDuration,remaining:C.specialCutinDuration};
  const game={state:'FLYING',realTime:0,specialCutin:cut,body:{x:800}}, visual={reducedMotion:rm};
  const {ctx,fills}=context(); engine.merchantFlourish(ctx,game,visual);fills.length=0;
  game.realTime=time;cut.remaining=cut.total-time;if(!cutPresent||time>=cut.total)game.specialCutin=null;
  const before=JSON.stringify(game);engine.merchantFlourish(ctx,game,visual);assert.equal(JSON.stringify(game),before);assert.equal(ctx.globalAlpha,1);
  return fills;
}
function near(a,b,eps=1e-8){assert(Math.abs(a-b)<=eps,`${a} != ${b}`);}
try {
  let changed=0;
  for(const type of ['A','B','C','D'])for(const time of [0,.001,.06999,.07001,.15,.2,.30999,.31001,.5,.76999,.77001,.9,.99999,1,1.3,1.89]){
    const old=render(baseline,type,time),next=render(G,type,time);assert.equal(next.length,old.length);
    next.forEach((p,i)=>{const q=old[i];near(p.x,q.x);near(p.y,q.y);near(p.r,q.r);assert.equal(p.color,q.color);assert(p.alpha>=0&&p.alpha<=q.alpha+1e-9);if(p.alpha<q.alpha-1e-6)changed++;});
    assert.deepEqual(render(G,type,time,true),render(baseline,type,time,true),'reduced mode unchanged');
    if(time>=1)assert.deepEqual(next,old,'after cutin unchanged');
    assert.deepEqual(render(G,type,time,false,false),render(baseline,type,time,false,false),'removed cutin unchanged');
  }
  assert(changed>0,'some coin light is attenuated');
  for(const fps of [30,60,120,144])for(const type of ['A','B','C','D'])for(let phase=0;phase<4;phase++){
    let prev=null;for(let t=phase/(4*fps);t<1.1;t+=1/fps){const cur=render(G,type,t).filter(p=>p.color==='#b8860b');
      if(prev&&prev.length===cur.length)for(let i=0;i<cur.length;i++)assert(Math.abs(cur[i].alpha-prev[i].alpha)<.65,`${fps}Hz ${type}`);prev=cur;}
  }
  // Verify the mask tracks the real band's shake, slide and rotation in logical Canvas space.
  for(const age of [.001,.07,.15,.31,.5,.77,.9,.99999]){
    const cut={merchantType:'A',total:1,remaining:1-age},g={specialCutin:cut};const m=G.merchantCoinMask(g,{reducedMotion:false});
    const point=(x,y)=>({x:m.x+x*m.cs+y*m.sn,y:m.y-x*m.sn+y*m.cs});
    const face=point(C.width*(C.specialCutinFaceCenterX-.5),0),fallback=point(0,-27),outside=point(300,250);
    near(G.merchantCoinAlpha(m,face.x,face.y,16),1-m.strength);near(G.merchantCoinAlpha(m,fallback.x,fallback.y,16),1-m.strength);
    near(G.merchantCoinAlpha(m,outside.x,outside.y,16),1);
    const edge=point(70+16,0),a=G.merchantCoinAlpha(m,edge.x,edge.y,16),b=G.merchantCoinAlpha(m,edge.x+.000001*m.cs,edge.y-.000001*m.sn,16);near(a,b,1e-7);
  }
  // The real portrait drawing falls back if drawImage throws. The coin mask must be identical
  // before the failure, during it and after recovery, without consulting portrait readiness.
  const sprites=H.Sprites, oldFace=sprites.cutinFaceLayer, oldCharacter=G.character;
  const face={ready:true,image:{complete:true,naturalWidth:640,naturalHeight:320},data:{frameWidth:640,frameHeight:320,frames:1,fps:1,loop:false,unit:320/96,pivot:{x:320,y:160}}};
  let fallback=0, fail=false; sprites.cutinFaceLayer=()=>({asset:face,scale:1}); G.character=()=>{fallback++;};
  const band=context().ctx; band.drawImage=()=>{if(fail)throw Error('injected face draw failure');};
  const cut={castId:'SPECIAL_ONLY',merchantType:'A',strong:false};
  try {
    const before=render(G,'A',.3);G.specialCutinBand(band,cut,'#a3369a',1472,340,1,1,1);assert.equal(fallback,0);
    fail=true;G.specialCutinBand(band,cut,'#a3369a',1472,340,1,1,1);assert.equal(fallback,1,'real band draws Canvas fallback after failed image');
    assert.deepEqual(render(G,'A',.3),before,'failed image does not change coin alpha');
    fail=false;G.specialCutinBand(band,cut,'#a3369a',1472,340,1,1,1);assert.equal(fallback,1);
    assert.deepEqual(render(G,'A',.3),before,'recovery does not change coin alpha');
    sprites.cutinFaceLayer=()=>{throw Error('coin renderer must not consult portrait');};
    assert.deepEqual(render(G,'A',.3),before);
  } finally {sprites.cutinFaceLayer=oldFace;G.character=oldCharacter;}
  // Merchant cut-ins do not have a combo skip of their own. If a scene removes the cut-in,
  // or RESULT / RETRY clears it, no coin mask may remain attached to the next play.
  const game=new H.Game(()=>.5);game.state=H.STATES.FLYING;
  game.specialCutin={merchantType:'A',total:1,remaining:.7};
  assert(G.merchantCoinMask(game,{reducedMotion:false}));game.specialCutin=null;
  assert.equal(G.merchantCoinMask(game,{reducedMotion:false}),null,'removed cut-in has no mask');
  game.state=H.STATES.RESULT;const resultVisual={reducedMotion:false,merchantFx:{at:0,type:'A',name:'A'}};
  const resultCtx=context();G.merchantFlourish(resultCtx.ctx,game,resultVisual);assert.equal(resultCtx.fills.length,0,'RESULT draws no coins');
  game.reset();assert.equal(G.merchantCoinMask(game,{reducedMotion:false}),null,'RETRY resets cut-in');
  console.log('Merchant coin readability PASS: renderer purity, A-D, 30–144Hz, bounds, reduced/after, band geometry, face and Canvas anchor; portrait lookup independent.');
} finally { /* No production state is changed by this test. */ }
