// Merchant presentation only: each coin wave fades in without changing its path or game state.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const scope = {}; scope.window = scope; vm.createContext(scope);
for (const name of ['config', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), scope, { filename: name });
const { CONFIG: c, Graphics: G } = scope.Hop;

function sample(type, time, reducedMotion = false, allFills = false) {
  const fills = [], stack = [];
  let shape = null;
  const ctx = new Proxy({ globalAlpha: 1, fillStyle: '',
    save() { stack.push({ alpha: this.globalAlpha, fill: this.fillStyle }); },
    restore() { const s = stack.pop(); this.globalAlpha = s.alpha; this.fillStyle = s.fill; },
    arc(x, y, r) { shape = { x, y, r }; },
    fill() { if (shape && ['#b8860b', '#ffd447', '#fff6c0'].includes(this.fillStyle)) fills.push({ ...shape, alpha: this.globalAlpha, color: this.fillStyle }); shape = null; },
    measureText() { return { width: 100 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; }
  }, { get(o, k) { return k in o ? o[k] : () => {}; } });
  const cut = { merchantType: type, name: c.merchantNames[type] };
  const game = { state: 'FLYING', realTime: 0, specialCutin: cut, body: { x: 123, vx: 456 } };
  const visual = { reducedMotion }, before = JSON.stringify(game);
  G.merchantFlourish(ctx, game, visual); fills.length = 0;
  game.realTime = time;
  G.merchantFlourish(ctx, game, visual);
  assert.equal(JSON.stringify({ ...game, realTime: 0 }), before, 'draw does not mutate game');
  return allFills ? fills : fills.filter(f => f.color === '#b8860b');
}

const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
for (const type of ['A', 'B', 'C', 'D']) {
  const first = sample(type, 0), midway = sample(type, 0.05), settled = sample(type, 0.1);
  assert.equal(first.length, c.merchantCoinCount / 2);
  assert(first.every(coin => coin.alpha === 0));
  assert(midway.every(coin => coin.alpha > 0 && coin.alpha < 0.5));
  near(settled[0].alpha, 1 - 0.1 / (c.merchantFlourishDuration * 0.9));
  assert.equal(sample(type, 0.179).length, c.merchantCoinCount / 2);
  const boundary = sample(type, 0.18);
  assert.equal(boundary.length, c.merchantCoinCount);
  assert.equal(boundary[1].alpha, 0, 'second wave starts transparent');
  assert(sample(type, 0.23)[1].alpha > 0 && sample(type, 0.23)[1].alpha < 0.5);
  near(sample(type, 0.28)[1].alpha, 1 - 0.1 / (c.merchantFlourishDuration * 0.9));
  assert.equal(sample(type, 0.3, true).length, 0, 'reduced motion omits coins');
  const coins = sample(type, 0.3);
  assert.equal(coins.length, c.merchantCoinCount);
  const all = sample(type, 0.3, false, true);
  assert.equal(all.length, c.merchantCoinCount * 3);
  coins.forEach((coin, i) => {
    const t = 0.3 - (i % 2) * 0.18, ang = (i * 2.399963) % (Math.PI * 2), speed = 520 + (i * 97) % 380;
    near(coin.x, c.width * 0.5 + Math.cos(ang) * speed * t);
    near(coin.y, c.height * 0.48 + Math.sin(ang) * speed * t * 0.75 + 520 * t * t);
    near(coin.r, 16 + (i % 3) * 4);
    assert.deepEqual(all.slice(i * 3, i * 3 + 3).map(f => f.color), ['#b8860b', '#ffd447', '#fff6c0']);
    near(all[i * 3 + 1].r, coin.r - 3);
    near(all[i * 3 + 2].r, (coin.r - 3) * 0.32);
  });
}
console.log('Merchant coin fade PASS: A-D, both wave boundaries, colours, trajectory, reduced motion, state purity.');
