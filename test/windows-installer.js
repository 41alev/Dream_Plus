/**
 * Windows one-click installer helper (windows/installer-helper.js).
 *
 * Runs the helper against a throwaway copy of the app layout, so the real
 * .env and data/ are never touched. The PowerShell part (scheduled task,
 * firewall) needs an administrator on a real Windows machine and is not
 * exercised here; see docs/KURULUM.md for the manual acceptance step.
 *
 *   node test/windows-installer.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { setVar, readVar } = require('../windows/installer-helper');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-wininst-'));
fs.mkdirSync(path.join(tmp, 'windows'));
fs.copyFileSync(path.join(ROOT, 'windows', 'installer-helper.js'), path.join(tmp, 'windows', 'installer-helper.js'));
fs.copyFileSync(path.join(ROOT, '.env.example'), path.join(tmp, '.env.example'));
// The helper resolves dotenv/better-sqlite3 from the app; point it at ours.
const env = { ...process.env, NODE_PATH: path.join(ROOT, 'node_modules') };
const run = (...args) => spawnSync(process.execPath, [path.join(tmp, 'windows', 'installer-helper.js'), ...args],
  { env, encoding: 'utf8' });

console.log('=== setVar / readVar ===');
ok('var olan satır değiştiriliyor', setVar('A=1\nB=2\n', 'B', '3') === 'A=1\nB=3\n');
ok('olmayan satır sona ekleniyor', setVar('A=1', 'C', 'x') === 'A=1\nC=x\n');
ok('değer okunuyor', readVar('X=1\nJWT_SECRET= abc \n', 'JWT_SECRET') === 'abc');

console.log('=== env ===');
const r1 = run('env', '--port', '3555');
const envText = fs.existsSync(path.join(tmp, '.env')) ? fs.readFileSync(path.join(tmp, '.env'), 'utf8') : '';
ok('.env örnekten oluşturuldu', r1.status === 0 && envText.length > 0, r1.stderr);
ok('port çıktısı doğru', r1.stdout === '3555', JSON.stringify(r1.stdout));
const secret = readVar(envText, 'JWT_SECRET');
ok('JWT_SECRET yer tutucudan rastgele değere çevrildi', /^[0-9a-f]{96}$/.test(secret), secret.slice(0, 12));
ok('NODE_ENV=production', readVar(envText, 'NODE_ENV') === 'production');
ok('.env BOM içermiyor', !envText.startsWith('﻿'));
const r2 = run('env');
const envText2 = fs.readFileSync(path.join(tmp, '.env'), 'utf8');
ok('ikinci çalıştırmada mevcut JWT_SECRET korunuyor', readVar(envText2, 'JWT_SECRET') === secret);
ok('ikinci çalıştırmada port korunuyor', r2.stdout === '3555');
const r3 = run('env', '--port', '99999');
ok('geçersiz port reddediliyor', r3.status === 1 && /Geçersiz port/.test(r3.stderr));

console.log('=== needs-setup ===');
ok('veritabanı yokken kurulum gerekiyor (çıkış 0)', run('needs-setup').status === 0);
const Database = require('better-sqlite3');
const dataDir = path.join(tmp, 'data');
fs.mkdirSync(dataDir);
const db = new Database(path.join(dataDir, 'depo-takip.sqlite'));
db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY)');
ok('kullanıcı tablosu boşken kurulum gerekiyor', run('needs-setup').status === 0);
db.exec('INSERT INTO users DEFAULT VALUES');
db.close();
ok('kullanıcı varken kurulum yapılmış sayılıyor (çıkış 3)', run('needs-setup').status === 3);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nGEÇTİ / PASSED: ${pass}    KALDI / FAILED: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
