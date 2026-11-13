// Candidate test, runnable here or after moving to tests/. It expects the 0.07s PRAY fade.
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const testDir=fs.existsSync(path.join(__dirname,'phase2.cjs'))?__dirname:path.resolve(__dirname,'../../../../tests');
const {scope,launch,element}=require(path.join(testDir,'phase2.cjs'));
const H=scope.Hop,G=H.Graphics,S=H.Sprites,C=H.CONFIG;
const saved={cast:G.comboCast,glow:G.grandGlow,change:G.grandPoseChange,slots:S.castAssets.STOPPER,smooth:G.smooth};
const sx=x=>C.launchX+x-1000,sy=y=>C.groundY-C.playerRadius-y,ground=C.groundY;
const state=(t,extra={})=>({type:'STOPPER',t,end:2.43,after:null,afterTotal:.6,short:false,skipped:false,grand:true,climax:C.grandClimax.STOPPER,heroWX:1200,heroY:50,source:{x:1000},...extra});
const clamp=x=>Math.max(0,Math.min(1,x)), smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
function context(){const stack=[],o={globalAlpha:1,filter:'none',save(){stack.push({globalAlpha:this.globalAlpha,filter:this.filter});},restore(){Object.assign(this,stack.pop());},createRadialGradient(){return{addColorStop(){}};},createLinearGradient(){return{addColorStop(){}};}};return new Proxy(o,{get:(v,k)=>k in v?v[k]:()=>{},set:(v,k,x)=>(v[k]=x,true)});}
const near=(a,b,eps=1e-6)=>assert(Math.abs(a-b)<=eps,`${a} != ${b}`);
try {
 const draws=[];G.comboCast=(ctx,id,a,x,y,alpha=1)=>{draws.push({id,pose:a.pose,alpha,face:a.face,x:a.x,dy:a.dy,rotate:a.rotate});return true;};
 function blend(st,rm=false,id='STOPPER',actor=G.grandActor(st,sx,sy,ground),gate=null){draws.length=0;const ctx=context(),before=JSON.stringify(st),a0=JSON.stringify(actor);G.grandCastBlend(ctx,id,st,actor,sx,sy,ground,1,rm,gate);assert.equal(JSON.stringify(st),before);assert.equal(JSON.stringify(actor),a0);near(ctx.globalAlpha,1);return draws.slice();}
 for(const dt of [.0001,.01,.025,.04,.055,.069,.071,.085]){const st=state(.5+dt),a=G.grandActor(st,sx,sy,ground),ch=G.grandPoseChange(st,a,sx,sy,ground),out=blend(st,false,'STOPPER',a),prev=out.find(x=>x.pose==='IDLE');assert.equal(a.pose,'PRAY');assert(ch&&ch.pose==='IDLE');assert(prev);near(prev.alpha,.85*(1-smooth(ch.back/.07)),.001);}
 for(const fps of [30,60,120,144])for(let phase=0;phase<10;phase++){let last=.85;for(let t=.500001+phase/(10*fps);t<.58;t+=1/fps){const st=state(t),out=blend(st),old=out.find(x=>x.pose==='IDLE')?.alpha??0;assert(old<=last+1e-8 && old>=0,`${fps}Hz old pose is monotone`);assert(last-old<.65*30/fps,`${fps}Hz old-pose opacity step`);last=old;}}
 assert.equal(G.grandActor(state(.49999),sx,sy,ground).pose,'IDLE');
 for(const flags of [{short:true},{skipped:true},{after:0}]) {const st=state(.52,flags);assert.equal(blend(st).filter(x=>x.pose==='IDLE').length,0);}
 assert.equal(blend(state(.52),true).filter(x=>x.pose==='IDLE').length,0,'live reduced motion uses old single-pose behavior');
 // The new opacity is local to IDLE->PRAY; other STOPPER transitions and other IDs keep their original coefficient.
 G.grandPoseChange=()=>({back:.03,pose:'IDLE',face:'left'});
 for(const [id,pose,expected] of [['STOPPER','RELEASE',.85],['DASH','PRAY',.22],['GUARD','PRAY',.85],['BRAKE','PRAY',.85],['ANGLE','PRAY',.85]]) {
  const st=state(.8,{type:id}),a={x:1200,dy:0,pose,face:'left',scale:1,alpha:1},out=blend(st,false,id,a),p=out.find(x=>x.pose==='IDLE');assert(p);near(p.alpha,expected*(1-smooth(.03/G.POSE_FADE)));
 }
 // DASH failure propagation still reaches its existing identity gate.
 let gate={allowed:true},st=state(.8,{type:'DASH'}),actor={x:1200,dy:0,pose:'THRUST',face:'left',scale:1,alpha:1};
 G.comboCast=()=>false;G.grandCastBlend(context(),'DASH',st,actor,sx,sy,ground,1,false,gate);assert.equal(gate.allowed,false);
 G.grandPoseChange=saved.change;G.comboCast=saved.cast;
 // Either or both optional images missing must leave a usable sprite/Canvas fallback.
 function imageAsset(name){const def=S.definitions.CAST.STOPPER[name],data=JSON.parse(fs.readFileSync(def.metadata,'utf8'));assert(S.normalizeCell(data));return {ready:true,image:{complete:true,naturalWidth:data.frameWidth,naturalHeight:data.frameHeight},data};}
 for(const slots of [{},{IDLE:imageAsset('IDLE')},{PRAY:imageAsset('PRAY')},{IDLE:imageAsset('IDLE'),PRAY:imageAsset('PRAY')}]){
  S.castAssets.STOPPER=slots;const st=state(.52),before=JSON.stringify(st);assert.doesNotThrow(()=>G.grandCastBlend(context(),'STOPPER',st,G.grandActor(st,sx,sy,ground),sx,sy,ground,1));assert.equal(JSON.stringify(st),before);
 }
 // Glow follows the real PRAY hotspot (or its existing body fallback) and starts from zero.
 const emitted=[];G.grandGlow=(ctx,x,y,r,col,alpha)=>emitted.push({x,y,r,col,alpha});
 for(const loaded of [false,true]) {
  if(loaded){const slots={};for(const name of ['IDLE','PRAY']){const def=S.definitions.CAST.STOPPER[name],data=JSON.parse(fs.readFileSync(def.metadata,'utf8'));assert(S.normalizeCell(data));slots[name]={ready:true,image:{complete:true,naturalWidth:data.frameWidth,naturalHeight:data.frameHeight},data};}S.castAssets.STOPPER=slots;}else S.castAssets.STOPPER={};
  for(const t of [.500001,.51,.55,.60,.68,.78,.85,.95]){const st=state(t),a=G.grandActor(st,sx,sy,ground),ctx=context(),before=JSON.stringify(st);emitted.length=0;G.grandPoseFx(ctx,st,a,sx,sy,ground,1,false,false);assert.equal(JSON.stringify(st),before);const out=emitted.find(x=>x.col==='255,236,150');assert(out);const u=clamp((t-.5)/.35),tip=G.grandTip(st,a,sx,ground);near(out.x,tip.x);near(out.y,tip.y);near(out.alpha,(.4+.6*u)*u);}
 }
 // Repeat elapsed-time sampling across frame rates and fractional frame offsets.
 S.castAssets.STOPPER={};
 for(const fps of [30,60,120,144])for(let phase=0;phase<10;phase++){let last=0;for(let t=.5+phase/(10*fps)+1e-6;t<.85;t+=1/fps){const st=state(t),a=G.grandActor(st,sx,sy,ground);emitted.length=0;G.grandPoseFx(context(),st,a,sx,sy,ground,1,false,false);const p=emitted.find(x=>x.col==='255,236,150');assert(p);assert(p.alpha>=last-1e-8);last=p.alpha;}}
 // In real short/skip/after, PRAY is not selected; drawing never changes game state.
 const game=launch(),ui=new H.UI(game,element('canvas'));ui.ctx=context();game.objects=[];game.trail=[];game.debugUsed=true;game.grandSpecialEnabled=true;game.launchCutin=null;game.specialCutin=null;G.smooth=false;
 for(const mode of ['short','skip','after']){game.comboShort=mode==='short';game.startCombo({type:'STOPPER',source:{x:game.body.x-250}},true);if(mode==='skip')game.endCombo(true);else if(mode==='after')game.endCombo(false);const st=G.grandState(game);assert.notEqual(G.grandActor(st,sx,sy,ground).pose,'PRAY');ui.update();const before=JSON.stringify(game);ui.draw();assert.equal(JSON.stringify(game),before);game.combo=null;game.comboAfter=null;}
 game.comboShort=false;game.startCombo({type:'STOPPER',source:{x:game.body.x-250}},true);for(const t of [.51,.52,.55,.57,.6,.8])for(const rm of [false,true,false]){game.combo.elapsed=G.comboSceneStart(false)+t;ui.visual.reducedMotion=rm;ui.update();const before=JSON.stringify(game);ui.draw();assert.equal(JSON.stringify(game),before);}
 console.log('STOPPER prayer candidate PASS: 0.07 fade, glow, reduced/skip/after, other IDs/gate, fallback, 30–144Hz and game purity.');
} finally {G.comboCast=saved.cast;G.grandGlow=saved.glow;G.grandPoseChange=saved.change;G.smooth=saved.smooth;if(saved.slots)S.castAssets.STOPPER=saved.slots;else delete S.castAssets.STOPPER;}
