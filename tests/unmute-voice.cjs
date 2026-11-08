// Starting muted must not leave reviewed RESULT voice unavailable after using only the mute toggle.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const registry = JSON.parse(fs.readFileSync(path.join(root,'assets/audio/voices/voice-registry.json'),'utf8'));
function harness({delayed=false, brokenVoice=false, noVoice=false, cached=false}={}) {
  const elements=new Map(), requests=[], decoded=[], started=[];
  const element=id=>{
    if(!elements.has(id)) elements.set(id,{listeners:{},setAttribute(){},textContent:'',innerHTML:'',hidden:false,
      value:0,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},
      addEventListener(t,f){this.listeners[t]=f;},width:1280,height:720,getBoundingClientRect:()=>({width:1280,height:720}),
      getContext:()=>new Proxy({},{get:(o,k)=>k==='measureText'?()=>({width:10}):()=>{}})});
    return elements.get(id);
  };
  const finishDecodes=[];
  const ctx={state:'running',destination:{},
    decodeAudioData(data){decoded.push(data.id);return delayed?new Promise(r=>{finishDecodes.push(()=>r(data));}):Promise.resolve(data);},
    createBufferSource(){return{connect(){},disconnect(){},stop(){},start(){started.push(this.buffer.id);}};}};
  const scope={document:{getElementById:element,addEventListener(){}},requestAnimationFrame(){},devicePixelRatio:1,
    localStorage:{getItem:()=> 'true',setItem(){}},AudioContext:function(){return ctx;},
    fetch:async url=>{
      if(!url.startsWith('assets/audio/voices/'))return{ok:false};
      requests.push(url);
      if(url==='assets/audio/voices/voice-registry.json')return{ok:true,json:async()=>registry};
      const id=Object.keys(registry.assets).find(id=>registry.assets[id].file===url);
      assert(['hero_launch','hero_stop'].includes(id),'never request unreviewed voice content');
      return{ok:true,arrayBuffer:async()=>({id})};
    }};
  scope.window=scope;vm.createContext(scope);
  for(const name of ['config','physics','game','sprites','graphics','ui','audio','voice','input'])
    vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),scope);
  const H=scope.Hop,g=new H.Game(),ui=new H.UI(g,element('canvas'));
  H.bindInput(g,ui);
  for(let i=0;i<3;i++)element('stage').listeners.pointerdown({button:0,isPrimary:true,preventDefault(){}});
  assert.equal(g.state,'FLYING');assert.equal(requests.length,0,'initial mute performs no voice requests');
  if(cached){H.Voice.registry=registry;H.Voice.context=ctx;H.Voice.buffers.set('hero_launch',{id:'hero_launch'});H.Voice.buffers.set('hero_stop',{id:'hero_stop'});}
  if(brokenVoice)H.Voice.unlock=()=>{throw Error('optional voice unavailable');};
  if(noVoice)delete H.Voice;
  return{H,g,ui,ctx,requests,decoded,started,click:()=>element('se-toggle').listeners.click(),finishDecode:()=>finishDecodes.forEach(f=>f())};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  {
    const h=harness(),before=JSON.stringify(h.g);h.click();await settle();
    assert.equal(JSON.stringify(h.g),before,'toggle loading never changes gameplay');
    assert.deepEqual([...h.H.Voice.buffers.keys()].sort(),['hero_launch','hero_stop'],'unmute preloads only reviewed voices');
    assert.deepEqual(h.decoded.sort(),['hero_launch','hero_stop']);
    assert.equal(h.requests.length,3,'one registry and two approved assets');
    assert.equal(h.started.length,0,'unmute only preloads, never replays old launch');
    h.g.finish();h.ui.update();h.ui.update();
    assert.deepEqual(h.started,['hero_stop'],'RESULT without another stage tap plays reviewed stop voice once');
  }
  {
    const h=harness({cached:true});h.click();await settle();assert.equal(h.requests.length,0,'cached voices need no refetch');
    assert.equal(h.started.length,0,'cached unmute does not autoplay');
  }
  {
    const h=harness({delayed:true});h.click();await settle();h.click();h.finishDecode();await settle();
    assert.equal(h.H.Voice.buffers.size,0,'remute invalidates in-flight decode');
    assert.equal(h.started.length,0,'late decode cannot autoplay after remute');
  }
  for(const options of [{noVoice:true},{brokenVoice:true}]){
    const h=harness(options),before=JSON.stringify(h.g);assert.doesNotThrow(()=>h.click());await settle();
    assert.equal(h.H.Audio.muted,false);assert.equal(JSON.stringify(h.g),before,'voice absence/failure cannot break mute control');
  }
  console.log('unmute-voice PASS: initial mute, reviewed-only preload, RESULT without stage tap, no autoplay/refetch, remute, optional failure');
})().catch(error=>{console.error(error);process.exitCode=1;});
