#!/usr/bin/env node
/**
 * Small, dependency-light helpers for windows/kurulum.ps1. Kept in Node so the
 * .env file is written as plain UTF-8 (Windows PowerShell 5.1 would add a BOM)
 * and so the checks use the same paths/config as the server itself.
 *
 *   node windows/installer-helper.js env [--port 3000]   prepare .env, print port
 *   node windows/installer-helper.js needs-setup         exit 0 = setup needed, 3 = already set up
 *   node windows/installer-helper.js wait-health [--port N] [--timeout 90]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(APP_DIR, '.env');
const EXAMPLE_PATH = path.join(APP_DIR, '.env.example');
const PLACEHOLDER_SECRET = /^CHANGE-ME/i;

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Sets KEY=value in .env text, replacing an existing line or appending one. */
function setVar(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(text) ? text.replace(re, line) : text.replace(/\s*$/, '\n') + line + '\n';
}

function readVar(text, key) {
  const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

function prepareEnv() {
  const created = !fs.existsSync(ENV_PATH);
  let text = created ? fs.readFileSync(EXAMPLE_PATH, 'utf8') : fs.readFileSync(ENV_PATH, 'utf8');
  const secret = readVar(text, 'JWT_SECRET');
  if (!secret || PLACEHOLDER_SECRET.test(secret) || secret.length < 32) {
    text = setVar(text, 'JWT_SECRET', crypto.randomBytes(48).toString('hex'));
    console.error('JWT_SECRET üretildi / generated');
  }
  text = setVar(text, 'NODE_ENV', 'production');
  const port = arg('port') || readVar(text, 'PORT') || '3000';
  if (!/^\d{2,5}$/.test(port) || Number(port) > 65535) throw new Error(`Geçersiz port: ${port}`);
  text = setVar(text, 'PORT', port);
  fs.writeFileSync(ENV_PATH, text, { encoding: 'utf8', mode: 0o600 });
  console.error(created ? '.env oluşturuldu / created' : '.env güncellendi / updated');
  process.stdout.write(port);
}

function loadEnv() {
  require('dotenv').config({ path: ENV_PATH, quiet: true });
}

function dbPath() {
  loadEnv();
  const dataDir = path.resolve(APP_DIR, process.env.DATA_DIR || 'data');
  return process.env.DB_PATH ? path.resolve(APP_DIR, process.env.DB_PATH) : path.join(dataDir, 'depo-takip.sqlite');
}

function needsSetup() {
  const file = dbPath();
  if (!fs.existsSync(file)) process.exit(0);
  const Database = require('better-sqlite3');
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const hasUsers = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
    const count = hasUsers ? db.prepare('SELECT COUNT(*) c FROM users').get().c : 0;
    process.exit(count === 0 ? 0 : 3);
  } finally { db.close(); }
}

async function waitHealth() {
  loadEnv();
  const port = arg('port', process.env.PORT || '3000');
  const deadline = Date.now() + Number(arg('timeout', '90')) * 1000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) { console.log(`ok http://localhost:${port}`); return; }
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error(`Sunucu ${port} portunda yanıt vermedi / server did not respond`);
  process.exit(1);
}

if (require.main === module) {
  const commands = { env: prepareEnv, 'needs-setup': needsSetup, 'wait-health': waitHealth };
  const cmd = commands[process.argv[2]];
  if (!cmd) { console.error('Kullanım: env | needs-setup | wait-health'); process.exit(2); }
  Promise.resolve().then(cmd).catch(err => { console.error('HATA:', err.message); process.exit(1); });
}

module.exports = { setVar, readVar };
