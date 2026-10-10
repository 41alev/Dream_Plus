/* global process, console, __dirname, fetch, setTimeout, clearTimeout */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, fork } = require('node:child_process');
const { createSandbox } = require('../../test/helpers/sandbox');
const target = path.resolve(process.argv[2]);
const sandbox = createSandbox();
const password = 'A9!' + crypto.randomBytes(24).toString('hex');
const env = { ...sandbox.env, NODE_ENV: 'production', DEMO_DATA: '0', PORT: '0', ADMIN_PASSWORD: password };
let server, packageDb;
async function start() {
  server = fork(path.join(target, 'server/index.js'), [], { cwd: target, env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Delivery startup timeout')), 20000);
    server.once('message', message => { clearTimeout(timer); resolve(message.port); });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error('Delivery server exited: ' + code)); });
  });
  return 'http://127.0.0.1:' + port;
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
}
(async () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8')).version, '2.0.3');
  execFileSync(process.execPath, ['server/scripts/setup.js', '--company', 'Delivery Audit', '--admin-user', 'auditadmin', '--warehouse', 'Main'], { cwd: target, env, stdio: 'pipe' });
  let base = await start(), token;
  async function api(method, endpoint, body) {
    const response = await fetch(base + endpoint, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    assert(response.ok, endpoint + ': ' + response.status);
    return response.json();
  }
  const health = await api('GET', '/health');
  assert.equal(health.version, '2.0.3');
  assert.equal(health.pendingMigrations, 0);
  token = (await api('POST', '/api/auth/login', { username: 'auditadmin', password })).token;
  const item = await api('POST', '/api/items', { name: 'Delivery retained item', openingQty: 5, openingUnitCost: 10 });
  fs.mkdirSync(sandbox.env.UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(sandbox.env.UPLOAD_DIR, 'delivery-evidence.txt'), 'Owned delivery fixture');
  Object.assign(process.env, env);
  packageDb = require(path.join(target, 'server/db'));
  const backup = require(path.join(target, 'server/scripts/full-backup'));
  const saved = await backup.runFullBackup();
  assert.equal(backup.verifyFullBackup(saved.file).ok, true);
  await stop();
  packageDb.close();
  const restored = backup.restoreFullBackup(saved.file);
  assert(restored.restored);
  assert.equal(fs.readFileSync(path.join(sandbox.env.UPLOAD_DIR, 'delivery-evidence.txt'), 'utf8'), 'Owned delivery fixture');
  base = await start();
  token = (await api('POST', '/api/auth/login', { username: 'auditadmin', password })).token;
  assert.equal((await api('GET', '/api/items/' + item.id)).usableQty, 5);
  const result = { version: '2.0.3', status: 'PASS', checks: ['clean production setup', 'initial login', 'health migrations', 'item write', 'full backup verification', 'DB and uploaded document restoration', 'post-restore login and item read'], customerDataUsed: false };
  fs.writeFileSync(path.join(__dirname, '../evidence/delivery-2026-10-10.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  await stop();
  if (packageDb) packageDb.close();
  sandbox.cleanup();
});
