// Exercise the actual preview request handler without opening a socket.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const releaseFile = path.join(__dirname, 'release.cjs');
let handler;
let streamed;
const fakeFs = Object.create(fs);
fakeFs.createReadStream = file => ({
  pipe(res) {
    streamed = file;
    res.end(fs.readFileSync(file));
  }
});
const fakeHttp = {
  createServer(callback) {
    handler = callback;
    return { listen(port, host) {
      assert.equal(port, 8765);
      assert.equal(host, '127.0.0.1');
    } };
  }
};
vm.runInNewContext(fs.readFileSync(releaseFile, 'utf8'), {
  __dirname,
  __filename: releaseFile,
  process: { argv: ['node', releaseFile, '--serve'] },
  console,
  require(name) {
    if (name === 'node:http') return fakeHttp;
    if (name === 'node:fs') return fakeFs;
    return require(name);
  }
}, { filename: releaseFile });
assert.equal(typeof handler, 'function');

function request(url) {
  streamed = null;
  const result = { status: 200, headers: {}, body: null };
  handler({ url }, {
    writeHead(status) { result.status = status; },
    setHeader(name, value) { result.headers[name.toLowerCase()] = value; },
    end(body) { result.body = body === undefined ? Buffer.alloc(0) : Buffer.from(body); }
  });
  assert(result.body !== null, 'response ended: ' + url);
  result.streamed = streamed;
  return result;
}

const base = '/NANACACRASH/';
for (const [file, type] of [
  ['', 'text/html; charset=utf-8'],
  ['index.html', 'text/html; charset=utf-8'],
  ['qa.html', 'text/html; charset=utf-8'],
  ['js/main.js', 'text/javascript; charset=utf-8'],
  ['css/style.css', 'text/css; charset=utf-8']
]) {
  const plain = request(base + file);
  const withQuery = request(base + file + '?debug=boost&nonce=123');
  assert.equal(plain.status, 200, file);
  assert.equal(withQuery.status, 200, file + ' with query');
  assert.equal(withQuery.headers['content-type'], type, file);
  assert.deepEqual(withQuery.body, plain.body, file + ' unchanged by query');
  assert.equal(withQuery.streamed, plain.streamed, file + ' stream unchanged');
}
assert.deepEqual(request(base + '?').body, request(base).body);
assert(request(base + 'qa.html?nonce=1').body.toString().includes('<script>'));

for (const url of [
  '/', '/NANACACRASH', '/NANACACRASHOTHER/index.html?debug=boost',
  base + 'missing.js?x=1', base + 'picture/private.png?x=1',
  base + 'work/private.html?x=1', base + '.git/config?x=1',
  base + '../index.html?x=1', base + 'js/../index.html?x=1',
  base + '%2e%2e/index.html?x=1', base + '%2e%2e%2findex.html?x=1',
  base + 'js%2fmain.js?x=1', base + 'picture/private.png?file=index.html'
]) {
  const response = request(url);
  assert.equal(response.status, 404, url);
  assert.equal(response.streamed, null, 'no file access: ' + url);
}
console.log('Development server handler PASS: query URLs, MIME types, exact allowlist and traversal rejection (no network socket).');
