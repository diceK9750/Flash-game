// GUARD's existing light and hex shards fade in on the scene clock, without changing gameplay.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG;
const saved = { glow: G.grandGlow, spark: G.spark, slots: S.castAssets.GUARD, smooth: G.smooth };
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const near = (a, b, eps = 1e-7) => assert(Math.abs(a - b) <= eps, `${a} != ${b}`);
const cl = u => Math.max(0, Math.min(1, u)), smooth = u => { u = cl(u); return u * u * (3 - 2 * u); };
const make = (t, extra = {}) => ({ type:'GUARD', t, end:2.43, climax:C.grandClimax.GUARD, grand:true,
  heroWX:1200, heroY:50, source:{x:1230}, after:null, afterTotal:.6, short:false, skipped:false, ...extra });
function asset(name) {
  const def = S.definitions.CAST.GUARD[name], data = JSON.parse(fs.readFileSync(def.metadata, 'utf8')); assert(S.normalizeCell(data));
  return { ready:true, image:{ complete:true, naturalWidth:data.frameWidth, naturalHeight:data.frameHeight }, data };
}
function context() {
  const stack = [], strokes = [], o = { globalAlpha:1, globalCompositeOperation:'source-over', strokes, path:[],
    save() { stack.push({ globalAlpha:this.globalAlpha, strokeStyle:this.strokeStyle, fillStyle:this.fillStyle, lineWidth:this.lineWidth, globalCompositeOperation:this.globalCompositeOperation }); },
    restore() { Object.assign(this, stack.pop()); }, beginPath() { this.path=[]; }, moveTo(x,y) { this.path.push([x,y]); }, lineTo(x,y) { this.path.push([x,y]); },
    stroke() { strokes.push({ color:this.strokeStyle, width:this.lineWidth, alpha:this.globalAlpha, path:this.path.slice() }); },
    createLinearGradient() { return { addColorStop() {} }; }, createRadialGradient() { return { addColorStop() {} }; }
  }; return new Proxy(o, { get:(v,k) => k in v ? v[k] : () => {}, set:(v,k,x) => (v[k]=x,true) });
}
try {
  let glows = [], sparks = [];
  G.grandGlow = (ctx,x,y,r,color,alpha) => glows.push({x,y,r,color,alpha});
  G.spark = (ctx,x,y,r,color,rot) => sparks.push({x,y,r,color,rot,alpha:ctx.globalAlpha});
  function draw(st, { reduced=false, back=false, alpha=1, map=sx } = {}) {
    const c=context(), before=JSON.stringify(st), actor=G.grandActor(st,map,sy,ground); glows=[]; sparks=[];
    G.grandPoseFx(c,st,actor,map,sy,ground,alpha,back,reduced);
    assert.equal(JSON.stringify(st),before,'draw leaves the scene untouched'); near(c.globalAlpha,1);
    return { actor, strokes:c.strokes, glows:glows.slice(), sparks:sparks.slice() };
  }
  for (const assetsReady of [false,true]) {
    S.castAssets.GUARD = assetsReady ? { ...saved.slots, CHANT:asset('CHANT'), BARRIER:asset('BARRIER') } : {};
    for (const screen of [110,640,1100]) for (const climax of [.85,1,1.25]) {
      const map=x => screen + x - 1200, start=.55+.15*(climax-.55);
      for (const dt of [1e-7,.025,.05,.075,.10,.11]) {
        const st=make(start+dt,{climax}), result=draw(st,{map}), tip=G.grandTip(st,result.actor,map,ground), g=result.glows.find(x=>x.color==='110,220,255');
        assert.equal(result.actor.pose,'CHANT'); assert(g,'CHANT glow is present');
        near(g.x,tip.x); near(g.y,tip.y); near(g.r,22+10*Math.abs(Math.sin((start+dt)*9))+12*cl((start+dt-.6)/.3));
        near(g.alpha,(.45+.4*cl((start+dt-.6)/.3))*smooth(dt/.1));
        assert.deepEqual(draw(st,{map,reduced:true}),result,'live reduced toggle leaves this light unchanged');
      }
      for (const dt of [0,.01,.03,.06,.09,.12,.15]) {
        const st=make(climax+G.GRAND_HITSTOP+dt,{climax}), result=draw(st,{map}), hex=result.strokes.filter(x=>x.color==='#e8fdff');
        assert.equal(result.actor.pose,'BARRIER'); assert.equal(hex.length,12);
        const b=G.grandT(st)-climax, hero=G.grandHero(st,map,sy), radius=40+230*G.ease(cl(b/.7));
        for (let i=0;i<12;i++) {
          const an=i*Math.PI/6+G.grandRand(i,31), x=hero.x+Math.cos(an)*radius, y=hero.y+Math.sin(an)*radius*.8, q=b*6+i;
          assert.equal(hex[i].width,2); assert.equal(hex[i].path.length,7);
          near(hex[i].path[0][0],x+Math.cos(q)*9); near(hex[i].path[0][1],y+Math.sin(q)*9);
          near(hex[i].alpha,(1-cl(b/.8))*smooth(b/.12));
        }
        assert.deepEqual(draw(st,{map,reduced:true}),result,'live reduced toggle leaves shards unchanged');
      }
      // The hit-stop is frozen at b=0. Fade begins only after it ends, at any tested climax.
      for (const dt of [0,.01,.04,G.GRAND_HITSTOP-1e-6]) {
        const result=draw(make(climax+dt,{climax}),{map});
        assert(result.strokes.filter(x=>x.color==='#e8fdff').every(x=>x.alpha===0));
      }
      // Actual paused time produces identical draw operations, independently of frame sampling.
      for (const fps of [30,60,120,144]) for (let i=0;i<fps;i++) {
        const st=make(.55+i*.7/fps,{climax}); assert.deepEqual(draw(st,{map}),draw(st,{map}));
      }
    }
  }
  // Scan each fade at actual 30–144 Hz sample times and phase offsets. The recovered
  // opacity factor must be continuous and monotonic even if no sample hits a boundary.
  const start=.55+.15*(C.grandClimax.GUARD-.55);
  for (const fps of [30,60,120,144]) for (let phase=0;phase<5;phase++) {
    let previous=0;
    for (let dt=(phase+1)/(5*fps);dt<.1;dt+=1/fps) {
      const t=start+dt, g=draw(make(t)).glows.find(x=>x.color==='110,220,255'); assert(g);
      const factor=g.alpha/(.45+.4*cl((t-.6)/.3)); near(factor,smooth(dt/.1));
      assert(factor>=previous-1e-9 && factor<=1); previous=factor;
    }
    previous=0;
    for (let b=(phase+1)/(5*fps);b<.12;b+=1/fps) {
      const st=make(C.grandClimax.GUARD+G.GRAND_HITSTOP+b), hex=draw(st).strokes.filter(x=>x.color==='#e8fdff'); assert.equal(hex.length,12);
      const factor=hex[0].alpha/(1-cl(b/.8)); near(factor,smooth(b/.12));
      assert(factor>=previous-1e-9 && factor<=1); previous=factor;
    }
  }
  // Real short scenes show the b=.45 tableau: the reveal is already 1. Skip and afterglow
  // jump to the end, where CHANT and BARRIER are no longer active.
  const game=launch(), ui=new H.UI(game,element('canvas')); ui.ctx=context(); game.objects=[]; game.trail=[];
  game.grandSpecialEnabled=true; game.launchCutin=null; game.specialCutin=null; game.debugUsed=true; G.smooth=false;
  S.castAssets.GUARD = { ...saved.slots, CHANT:asset('CHANT'), BARRIER:asset('BARRIER') };
  for (const mode of ['short','skip','after']) {
    game.comboShort=mode==='short'; game.startCombo({type:'GUARD',source:{x:game.body.x-250}},true);
    if (mode==='skip') game.endCombo(true); else if (mode==='after') game.endCombo(false);
    const st=G.grandState(game), result=draw(st);
    if (mode==='short') {
      assert.equal(result.actor.pose,'BARRIER'); const b=G.grandT(st)-st.climax; assert(b>.12);
      for (const hex of result.strokes.filter(x=>x.color==='#e8fdff')) near(hex.alpha,1-cl(b/.8));
    } else assert.equal(result.actor.pose,'IDLE');
    for (const reduced of [false,true]) { ui.visual.reducedMotion=reduced; ui.update(); const before=JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game),before,mode+' draw does not change game state'); }
    game.combo=null; game.comboAfter=null;
  }
  game.comboShort=false; game.startCombo({type:'GUARD',source:{x:game.body.x-250}},true);
  for (const t of [.6176,.65,.72,1,1.08,1.14,1.20]) {
    game.combo.elapsed=G.comboSceneStart(false)+t;
    for (const reduced of [false,true,false]) { ui.visual.reducedMotion=reduced; ui.update(); const before=JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game),before,'live toggle draw does not change game state'); }
  }
  // Invalid synthetic metadata does not throw; real game scenes always carry a climax.
  assert.doesNotThrow(()=>draw(make(.7,{climax:undefined})));
  for (const type of ['DASH','STOPPER','BRAKE','ANGLE']) {
    const st=make(.78,{type,climax:C.grandClimax[type]}), a=draw(st), b=draw(st);
    assert.deepEqual(a,b,type+' deterministic and unaffected by GUARD-only reveal');
  }
  console.log('GUARD special reveal PASS: actual geometry, times, loaded/fallback, sides, climax variants, hit-stop, live reduced, short/skip/after, 30–144Hz, game purity.');
} finally {
  G.grandGlow=saved.glow; G.spark=saved.spark; G.smooth=saved.smooth;
  if (saved.slots) S.castAssets.GUARD=saved.slots; else delete S.castAssets.GUARD;
}
