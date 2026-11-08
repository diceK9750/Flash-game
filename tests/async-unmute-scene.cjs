// A muted scene may outlive a hidden-tab suspend. Unmute must wait for async resume without losing the cue.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function harness() {
  const els = new Map();
  const element = id => {
    if (!els.has(id)) els.set(id, { listeners: {}, setAttribute() {}, textContent: '', innerHTML: '', hidden: false,
      value: 0, style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      addEventListener(t, f) { this.listeners[t] = f; }, width: 1280, height: 720,
      getBoundingClientRect: () => ({ width: 1280, height: 720 }),
      getContext: () => new Proxy({}, { get: (o,k) => k === 'measureText' ? () => ({width:10}) : () => {} }) });
    return els.get(id);
  };
  const sc = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {},
    localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 1 };
  sc.window = sc; vm.createContext(sc);
  for (const name of ['config','physics','game','sprites','graphics','ui','audio','voice','input'])
    vm.runInContext(fs.readFileSync(path.join(root, 'js', name+'.js'), 'utf8'), sc);
  const H = sc.Hop, A = H.Audio; A.setMuted(true);
  let seed = 1;
  const g = new H.Game(() => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
  g.tempoEnabled = true; g.launchCutinEnabled = true; g.setDebugKind('boost');
  const ui = new H.UI(g, element('canvas'));
  const step = () => { g.update(1/60); ui.update(); };
  g.act(); for(let i=0;i<30;i++)step(); g.act(); for(let i=0;i<20;i++)step(); g.act();
  let cur = null;
  for(let i=0;i<60*120 && !(g.combo && g.combo.elapsed>1.2);i++) {
    if(g.special && g.special!==cur) { cur=g.special; g.act(); } step();
  }
  assert(g.combo && g.combo.elapsed>1.2, 'real combo scene reached');
  H.bindInput(g, ui);
  let finishResume;
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), Q: param() });
  const ctx = { state: 'running', currentTime: 10, sampleRate: 8000, destination: {}, starts: [], resumes: 0,
    suspend() { this.state='suspended'; return Promise.resolve(); },
    resume() { this.resumes++; return new Promise(resolve => { finishResume=()=>{this.state='running';resolve();}; }); },
    createGain: node, createBiquadFilter: node,
    createOscillator() { return this.createBufferSource(); },
    createBufferSource() { return {...node(), start: at=>ctx.starts.push(at), stop() {} }; },
    createBuffer: (n,length,rate) => ({length,sampleRate:rate,getChannelData:()=>new Float32Array(length)}) };
  A.context=ctx; sc.AudioContext=function(){return ctx;};
  return {A,g,ui,ctx,click:()=>element('se-toggle').listeners.click(),finish:()=>finishResume()};
}
const settle = () => new Promise(resolve=>setImmediate(resolve));
(async () => {
  for (const action of ['resume','remute','skip','retry','replace']) {
    const h=harness(), {A,g,ui,ctx}=h;
    A.onVisibility(true); await settle(); assert.equal(ctx.state,'suspended');
    A.onVisibility(false); await settle(); assert.equal(ctx.resumes,0,'show while muted does not resume');
    h.click(); assert.equal(ctx.resumes,1); assert.equal(ctx.starts.length,0,'resume is still pending');
    const scene=g.combo;
    scene.elapsed=1.8;
    if(action==='remute') h.click();
    if(action==='skip') {g.skipCombo();ui.update();}
    if(action==='retry') {g.finish();g.act();ui.update();}
    if(action==='replace') {g.combo={...scene,solo:true,type:'DASH'};ui.update();}
    const snapshot=JSON.stringify(g);
    h.finish(); await settle(); ui.update();
    assert.equal(JSON.stringify(g),snapshot,'audio readiness never changes game state');
    if(action==='resume' || action==='replace') {
      assert(ctx.starts.length>0,'remaining scene voices are scheduled after async resume');
      assert(ctx.starts.every(t=>t>=ctx.currentTime-1e-9),'past cues are not replayed');
      const recipe=A.comboRecipes[action==='replace'?'GRAND_DASH':'COMBO_WITCH'];
      assert.equal(ctx.starts.length,recipe.filter(v=>v[1]>=1.8-1e-9).length,'uses latest elapsed time');
      const count=ctx.starts.length; ui.update(); assert.equal(ctx.starts.length,count,'resumes only once');
    } else assert.equal(ctx.starts.length,0,action+' cancels stale resume');
  }
  {
    const h=harness(), {A,ui,ctx}=h;
    h.click(); const count=ctx.starts.length; assert(count>0,'running context unmute is immediate');
    A.onVisibility(true); await settle();
    A.onVisibility(false); await settle();
    h.finish(); await settle(); ui.update();
    assert.equal(ctx.starts.length,count,'ordinary hide/show preserves track without restarting it');
  }
  console.log('async-unmute-scene PASS: async recovery, current offset, once-only, cancellation, ordinary visibility track preservation');
})().catch(error=>{console.error(error);process.exitCode=1;});
