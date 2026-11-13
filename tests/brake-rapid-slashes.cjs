// Rapid BRAKE slashes preserve geometry while remaining behind characters.
const assert=require('node:assert/strict');
const {scope,launch}=require('./phase2.cjs'),H=scope.Hop,G=H.Graphics,C=H.CONFIG;
const old={line:G.line,cast:G.comboCast};let log=[];
const no=()=>{};
function context(){const stack=[];const o={globalAlpha:1,save(){stack.push({globalAlpha:this.globalAlpha,fillStyle:this.fillStyle})},restore(){Object.assign(this,stack.pop()||{})},fillRect(x,y){if(x===-2000&&y===-2000)log.push({kind:'tint'})},createRadialGradient(){return{addColorStop:no}},createLinearGradient(){return{addColorStop:no}}};return new Proxy(o,{get:(v,k)=>k in v?v[k]:no,set:(v,k,x)=>(v[k]=x,true)})}
const sxAt=screen=>x=>screen+x-1200,sy=y=>C.groundY-C.playerRadius-y;
const scene=(t,extra={})=>({type:'BRAKE',t,end:2.43,climax:C.grandClimax.BRAKE,grand:true,heroWX:1200,heroY:50,source:{x:1000},after:null,afterTotal:.6,short:false,skipped:false,...extra});
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
G.line=(ctx,p,color,width)=>{if(Array.isArray(p)&&p.length===2&&Math.abs(Math.abs(p[0][0]-p[1][0])-300)<1e-7&&Math.abs(Math.abs(p[0][1]-p[1][1])-80)<1e-7)log.push({kind:'slash',p,color,width,alpha:ctx.globalAlpha})};
G.comboCast=()=>{log.push({kind:'actor'});return true};
function draw(st,screen,rm){log=[];const sx=sxAt(screen),before=JSON.stringify(st);G.grandBack(context(),st,sx,sy,C.groundY,rm);log.push({kind:'between'});G.grandFront(context(),st,sx,sy,C.groundY,rm);assert.equal(JSON.stringify(st),before);return log.slice()}
try{
 let cases=0;for(const screen of [110,640,1100])for(const fps of [30,60,120,144])for(let phase=0;phase<3;phase++)for(let frame=0;frame<Math.ceil(2.3*fps);frame++){
   const st=scene((frame+phase/3)/fps),a=draw(st,screen,false),b=draw(st,screen,true),x=a.filter(x=>x.kind==='slash'),y=b.filter(x=>x.kind==='slash'),t=G.grandT(st),h=G.grandHero(st,sxAt(screen),sy),expected=[];
   for(let k=0;k<6;k++){const u=(t-(.18+k*.15+.1))/.4;if(u<0||u>1)continue;const dir=k%2?-1:1,yy=h.y+[-30,20,-5,35,-20,10][k];expected.push({p:[[h.x-150*dir,yy-40*dir],[h.x+150*dir,yy+40*dir]],color:k%2?'#ffffff':G.GRAND.BRAKE.color,width:7*(1-u)+2,alpha:1-u})}
   assert.equal(x.length,expected.length);assert.equal(y.length,expected.length);
   for(const got of [x,y])for(let i=0;i<got.length;i++){assert.equal(got[i].color,expected[i].color);near(got[i].width,expected[i].width);near(got[i].alpha,expected[i].alpha);for(let q=0;q<2;q++)for(let z=0;z<2;z++)near(got[i].p[q][z],expected[i].p[q][z])}
   if(x.length){const ti=a.findIndex(x=>x.kind==='tint'),sl=a.findIndex(x=>x.kind==='slash'),ac=a.findIndex(x=>x.kind==='actor');assert(ti>=0&&ti<sl);if(ac>=0)assert(sl<ac);assert(sl<a.findIndex(x=>x.kind==='between'),'normal slashes stay behind hero');const sr=b.findIndex(x=>x.kind==='slash');assert(sr<b.findIndex(x=>x.kind==='between'),'reduced slashes stay behind hero')}
   cases++;
 }
 for(const st of [scene(.6,{short:true}),scene(.6,{skipped:true}),scene(.6,{after:0})]){const before=JSON.stringify(st);draw(st,640,false);draw(st,640,true);assert.equal(JSON.stringify(st),before)}
 const game=launch();game.grandSpecialEnabled=true;game.comboShort=false;game.startCombo({type:'BRAKE',source:{x:0}},true);game.combo.elapsed=G.comboSceneStart(false)+.7;
 // The same live scene can toggle reduced motion without moving the slashes to the front.
 const live=G.grandState(game), liveBefore=JSON.stringify(game), off=draw(live,640,false), on=draw(live,640,true), offAgain=draw(live,640,false);
 for(const result of [off,on,offAgain]){const line=result.findIndex(x=>x.kind==='slash');assert(line>=0 && line<result.findIndex(x=>x.kind==='between'),'live toggle leaves line behind hero');}
 assert.deepEqual(off.filter(x=>x.kind==='slash'),on.filter(x=>x.kind==='slash'));assert.deepEqual(off.filter(x=>x.kind==='slash'),offAgain.filter(x=>x.kind==='slash'));assert.equal(JSON.stringify(game),liveBefore);
 for(const op of ['skip','after','short']){if(op==='skip')game.endCombo(true);else if(op==='after'){game.comboAfter=null;game.comboShort=false;game.startCombo({type:'BRAKE',source:{x:0}},true);game.endCombo(false)}else{game.comboAfter=null;game.comboShort=true;game.startCombo({type:'BRAKE',source:{x:0}},true)}const before=JSON.stringify(game),st=G.grandState(game);assert.equal(draw(st,640,false).filter(x=>x.kind==='slash').length,0);assert.equal(draw(st,640,true).filter(x=>x.kind==='slash').length,0);assert.equal(JSON.stringify(game),before)}
 for(const type of ['ANGLE','DASH','GUARD','STOPPER']){const st=scene(.6,{type,climax:C.grandClimax[type]});assert.equal(draw(st,640,false).filter(x=>x.kind==='slash').length,0,type)}
 console.log(`Rapid BRAKE lines PASS: ${cases} fps/phase/position samples, same geometry+alpha, tint/slash/actor order, reduced and real short/skip/after, purity.`);
}finally{G.line=old.line;G.comboCast=old.cast}
