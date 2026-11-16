#!/usr/bin/env node
/**
 * Müşteri için lisans dosyası üretir. YALNIZCA SATICI (bu depoyu işleten kişi)
 * çalıştırır — özel anahtar müşteriye asla verilmez, yalnızca üretilen
 * lisans dosyası (imzalı, genel anahtarla doğrulanabilir) verilir.
 *
 * Özel anahtar şu sırayla aranır:
 *   1. LICENSE_PRIVATE_KEY ortam değişkeni (PEM içeriği)
 *   2. LICENSE_KEY_FILE ortam değişkeni (dosya yolu)
 *   3. Kullanıcı klasörü: ~/.dream-plus/license-signing-key.pem (önerilen yer)
 *   4. Eski yer: depo kökündeki license-signing-key.pem (uyarı verir)
 * Anahtar proje klasöründe tutulmamalı: klasör ZIP'lenir, buluta yedeklenir
 * veya kopyalanırsa anahtar da gider ve herkes geçerli lisans üretebilir.
 *
 * Bulunan anahtar server/lib/license.js içindeki genel anahtarla eşleşmezse
 * script durur (yanlış anahtarla üretilen lisans müşteride açılmaz).
 * Hiç anahtar yoksa yeni çift YALNIZCA açık --init-key bayrağıyla üretilir;
 * eskiden bu sessizce oluyordu ve taşınmış bir anahtar "yok" sanılıp mevcut
 * bütün müşteri lisanslarını geçersiz kılacak yeni bir çift doğabiliyordu.
 *
 * Kullanım:
 *   npm run license:generate -- --licensee "Örnek Metal A.Ş."
 *   npm run license:generate -- --licensee "Örnek Metal A.Ş." --expires 2027-12-31
 *   npm run license:generate -- --licensee "Örnek Metal A.Ş." --out musteri-lisans.json
 *
 * --expires verilmezse süresiz (ömür boyu) lisans üretilir — bugünkü
 * varsayılan satış modeli budur.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { sign, PUBLIC_KEY_PEM } = require('../lib/license');

const LEGACY_KEY_PATH = path.join(__dirname, '..', '..', 'license-signing-key.pem');
const HOME_KEY_PATH = path.join(os.homedir(), '.dream-plus', 'license-signing-key.pem');

function keyCandidates() {
  return [process.env.LICENSE_KEY_FILE, HOME_KEY_PATH, LEGACY_KEY_PATH].filter(Boolean);
}

/** Fails loudly when the private key does not belong to the shipped public key. */
function assertMatchesPublicKey(privateKeyPem) {
  const derived = crypto.createPublicKey(crypto.createPrivateKey(privateKeyPem))
    .export({ type: 'spki', format: 'der' });
  const shipped = crypto.createPublicKey(PUBLIC_KEY_PEM).export({ type: 'spki', format: 'der' });
  // Public keys are not secret, so a plain comparison is fine here.
  if (!derived.equals(shipped)) {
    throw new Error('Özel anahtar server/lib/license.js içindeki genel anahtarla eşleşmiyor; bu anahtarla üretilen lisans doğrulanamaz.');
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; }
    else out[key] = true;
  }
  return out;
}

function loadOrCreatePrivateKey({ initKey = false } = {}) {
  if (process.env.LICENSE_PRIVATE_KEY) {
    assertMatchesPublicKey(process.env.LICENSE_PRIVATE_KEY);
    return process.env.LICENSE_PRIVATE_KEY;
  }
  const found = keyCandidates().find(p => fs.existsSync(p));
  if (found) {
    if (path.resolve(found) === path.resolve(LEGACY_KEY_PATH)) {
      console.warn(`⚠ Özel anahtar proje klasöründe: ${found}`);
      console.warn(`  Güvenli yere taşıyın: ${HOME_KEY_PATH} (veya LICENSE_KEY_FILE ile başka bir yol)`);
    }
    const pem = fs.readFileSync(found, 'utf8');
    assertMatchesPublicKey(pem);
    return pem;
  }
  if (!initKey) {
    throw new Error(`Özel anahtar bulunamadı. Aranan yerler: ${keyCandidates().join(', ')}. ` +
      'Mevcut anahtarınızı bu yerlerden birine koyun. Bilerek YENİ bir anahtar çifti üretmek için --init-key kullanın ' +
      '(mevcut bütün müşteri lisansları geçersiz olur).');
  }

  console.log('⚠ --init-key: yeni bir Ed25519 anahtar çifti üretiliyor…');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const target = process.env.LICENSE_KEY_FILE || HOME_KEY_PATH;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, privPem, { mode: 0o600, flag: 'wx' });
  console.log(`✓ Özel anahtar kaydedildi: ${target} (bu dosyayı YEDEKLEYİN ve ASLA paylaşmayın)`);
  console.log('\n⚠ ÖNEMLİ: server/lib/license.js içindeki PUBLIC_KEY_PEM sabitini');
  console.log('  aşağıdaki YENİ genel anahtarla değiştirin, yoksa üretilen lisanslar');
  console.log('  eski anahtarla doğrulanamaz:\n');
  console.log(pubPem);
  return privPem;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.licensee) {
    console.error('Kullanım: npm run license:generate -- --licensee "Firma Adı" [--expires YYYY-MM-DD] [--out dosya.json]');
    process.exit(1);
  }
  if (args.expires && !/^\d{4}-\d{2}-\d{2}$/.test(args.expires)) {
    console.error('✗ --expires biçimi YYYY-MM-DD olmalı');
    process.exit(1);
  }

  let privateKeyPem;
  try { privateKeyPem = loadOrCreatePrivateKey({ initKey: args['init-key'] === true }); }
  catch (err) { console.error(`✗ ${err.message}`); process.exit(1); }
  const payload = {
    licenseId: `DPL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    licensee: args.licensee,
    product: 'Dream Plus',
    issuedAt: new Date().toISOString().slice(0, 10),
    expiresAt: args.expires || null
  };

  const licenseFile = sign(payload, privateKeyPem);
  const outPath = args.out || `lisans-${payload.licenseId}.json`;
  fs.writeFileSync(outPath, JSON.stringify(licenseFile, null, 2));

  console.log(`\n✓ Lisans üretildi: ${outPath}`);
  console.log(`  Lisans no:  ${payload.licenseId}`);
  console.log(`  Müşteri:    ${payload.licensee}`);
  console.log(`  Süre:       ${payload.expiresAt ? payload.expiresAt + ' tarihine kadar' : 'süresiz (ömür boyu)'}`);
  console.log('\nMüşteriye teslim:');
  console.log(`  1. ${path.basename(outPath)} dosyasını müşterinin sunucusuna kopyalayın (ör. data/license.json)`);
  console.log('  2. .env dosyasına şu satırı ekleyin: LICENSE_FILE=data/license.json');
  console.log('  3. Sunucuyu yeniden başlatın\n');
}

if (require.main === module) main();

module.exports = { parseArgs, loadOrCreatePrivateKey, assertMatchesPublicKey, keyCandidates };
