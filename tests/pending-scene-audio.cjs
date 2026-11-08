// Scene creation during an async AudioContext resume must not permanently lose its SE track.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function fixture(type,solo,short,rate){
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{setAttribute(){},textContent:'',innerHTML:'',hidden:false,value:0,style:{},dataset:{},
      classList:{toggle(){},add(){},remove(){}},addEventListener(){},width:1280,height:720,
      getBoundingClientRect:()=>({width:1280,height:720}),
      getContext:()=>new Proxy({},{get:(o,k)=>k==='measureText'?()=>({width:10}):()=>{}})});
    return elements.get(id);
  };
  const scope={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},devicePixelRatio:1,
    localStorage:{getItem:()=>null,setItem(){}}};scope.window=scope;vm.createContext(scope);
  for(const name of ['config','physics','game','sprites','graphics','ui','audio','voice'])
    vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),scope);
  const H=scope.Hop,A=H.Audio,g=new H.Game(),ui=new H.UI(g,element('canvas'));
  g.act();ui.update();g.act();ui.update();g.act();ui.update();
  assert.equal(g.state,'FLYING');
  let complete;
  const param=()=>({setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({connect(){},disconnect(){},gain:param(),frequency:param(),Q:param()});
  const ctx={state:'suspended',currentTime:10,sampleRate:8000,destination:{},starts:[],
    resume(){return new Promise(resolve=>{complete=()=>{this.state='running';resolve();};});},
    createGain:node,createBiquadFilter:node,createOscillator(){return this.createBufferSource();},
    createBufferSource(){return{...node(),start:at=>ctx.starts.push(at),stop(){}};},
    createBuffer:(n,length,rate)=>({length,sampleRate:rate,getChannelData:()=>new Float32Array(length)})};
  A.context=ctx;scope.AudioContext=function(){return ctx;};
  A.unlock(); // Same async unlock performed by input before it starts a SPECIAL scene.
  ui.visual.reducedMotion=short;g.comboShort=short;
  g.startCombo({type,partner:solo?null:{type:type==='BOOST'?'BOUNCE':'BOOST'}},solo);
  g.combo.rate=rate;ui.update();assert.equal(ctx.starts.length,0,'pending resume schedules no audio yet');
  return{A,g,ui,ctx,complete:()=>complete()};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  let cases=0;
  const scenes=[['BOOST',false,false,'COMBO_WITCH'],['BOUNCE',false,false,'COMBO_FIGHTER'],
    ...['DASH','STOPPER','BRAKE','ANGLE','GUARD'].map(type=>[type,true,false,'GRAND_'+type]),
    ['BOOST',false,true,'COMBO_WITCH_SHORT'],['BOUNCE',false,true,'COMBO_FIGHTER_SHORT'],['DASH',true,true,'GRAND_SHORT']];
  for(const[type,solo,short,kind]of scenes)for(const rate of [1,1.5]){
    const {A,g,ui,ctx,complete}=fixture(type,solo,short,rate);
    const offset=short?0.45:1.2;g.combo.elapsed=offset;ui.update();assert.equal(ctx.starts.length,0);
    const before=JSON.stringify(g);complete();await settle();ui.update();
    assert.equal(JSON.stringify(g),before,'readiness changes no game state');
    const expected=A.comboRecipes[kind].filter(v=>v[1]/rate>=offset/rate-1e-9).length;
    assert(expected>0);assert.equal(ctx.starts.length,expected,kind+' starts remaining track after async resume');
    assert(ctx.starts.every(t=>t>=ctx.currentTime-1e-9),'no past cues replayed');
    const count=ctx.starts.length;ui.update();assert.equal(ctx.starts.length,count,'one restart only');cases++;
  }
  for(const action of ['mute','skip','retry','end']){
    const {A,g,ui,ctx,complete}=fixture('BOOST',false,false,1);
    if(action==='mute')A.setMuted(true);
    if(action==='skip')g.skipCombo();
    if(action==='retry'){g.finish();g.act();}
    if(action==='end')g.endCombo();
    ui.update();complete();await settle();ui.update();
    assert.equal(ctx.starts.length,0,action+' cancels a stale start request');cases++;
  }
  console.log('pending-scene-audio PASS: '+cases+' cases; new scenes, current offset/rate, once-only, cancellation');
})().catch(error=>{console.error(error);process.exitCode=1;});
