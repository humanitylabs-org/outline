// wizard-os issue 133 (browser boundary): Outline in a sandboxed Wizard window. The browser asks for the module script
// and its files with `Origin: null`; only those public files get a CORS answer, never the page, the API or a write.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import net from 'node:net';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
let child, port, data;

function call(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port, method, path, headers: {host: `127.0.0.1:${port}`, ...headers}}, res => {
      const parts = [];
      res.on('data', b => parts.push(b));
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(parts).toString()}));
    });
    req.on('error', reject);
    req.end(method === 'PUT' ? JSON.stringify({}) : undefined);
  });
}

before(async () => {
  const probe = net.createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  port = probe.address().port;
  await new Promise(r => probe.close(r));
  data = mkdtempSync(join(tmpdir(), 'outline-opaque-'));
  const env = {...process.env, OUTLINE_DATA: data, PORT: String(port), BIND: '127.0.0.1'};
  delete env.TINFOIL_API_KEY; delete env.WIZARD_TRUSTED_HOSTS; delete env.WIZARD_TRUSTED_ORIGINS;
  child = spawn(process.execPath, ['server.mjs'], {cwd: here, env, stdio: ['ignore', 'pipe', 'pipe']});
  await new Promise((resolve, reject) => {
    child.stdout.on('data', b => { if (b.toString().includes('listening')) resolve(); });
    child.once('exit', c => reject(Error('server exited ' + c)));
  });
});
after(() => { child?.kill('SIGTERM'); rmSync(data, {recursive: true, force: true}); });

const opaque = {origin: 'null', 'sec-fetch-site': 'cross-site'};

test('the module script, its import and the style load from an opaque page with a CORS answer and no credentials', async () => {
  for (const path of ['/app.js', '/model.js', '/styles.css', '/icon.svg']) {
    const r = await call('GET', path, opaque);
    assert.equal(r.status, 200, path);
    assert.equal(r.headers['access-control-allow-origin'], '*', path);
    assert.equal(r.headers['access-control-allow-credentials'], undefined);
  }
});

test('the page, the API, MCP, switches, writes and missing files still refuse an opaque page', async () => {
  for (const path of ['/', '/index.html', '/api/document', '/api/config', '/api/switches', '/healthz', '/openapi.json', '/wizard-os-home/core/app-client.js', '/nested/app.js']) {
    const r = await call('GET', path, opaque);
    assert.equal(r.status, 403, path);
    assert.equal(r.headers['access-control-allow-origin'], undefined, path);
  }
  assert.equal((await call('PUT', '/api/document', {...opaque, 'content-type': 'application/json'})).status, 403);
  assert.equal((await call('POST', '/mcp', {...opaque, 'content-type': 'application/json'})).status, 403);
  const gone = await call('GET', '/nothing-here.js', opaque);
  assert.equal(gone.status, 404);
  assert.equal(gone.headers['access-control-allow-origin'], undefined);
});

test('another site and an unknown host are refused as before; same-origin pages get no CORS header', async () => {
  assert.equal((await call('GET', '/app.js', {origin: 'https://evil.example'})).status, 403);
  assert.equal((await call('GET', '/app.js', {...opaque, host: 'evil.example'})).status, 403);
  const own = await call('GET', '/app.js', {origin: `http://127.0.0.1:${port}`});
  assert.equal(own.status, 200);
  assert.equal(own.headers['access-control-allow-origin'], undefined);
  assert.equal((await call('GET', '/app.js')).status, 200);
});
