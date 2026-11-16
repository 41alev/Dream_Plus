# PROJECT_STATUS.md

## 16 Kasım 2026 — bakım turu: CI, bağımlılıklar, tip borcu, tek tık Windows kurulumu (Claude)

**Kapsam:** Uzak CI 10 Ekim'den beri kırmızıydı. Nedeni: Firefox ve WebKit tek
Playwright komutunda aynı sunucu/sandbox veritabanını paylaşıyordu; WebKit,
Firefox'un oluşturduğu kayıtları görüyordu (yinelenen fixture adları, UNIQUE
ihlalleri). Motorlar artık ayrı komutla, ayrı temiz sandbox'ta koşar
(`npm run test:cross-browser`). Aynı neden 14 Dependabot PR'ını da kırmızı
tutuyordu; güncellemeler tek dalda uygulandı (dotenv 18, jsdom 31 dahil) ve
Actions v7/v6'ya çıkarıldı. Dependabot artık minor/patch güncellemeleri gruplar.

**Lisans anahtarı:** `license-signing-key.pem` proje klasöründen
`~/.dream-plus/` altına taşındı (özet doğrulamalı). Üretici artık anahtarı
gömülü genel anahtarla eşleştirir, eşleşmezse durur; anahtar yoksa sessizce
yeni çift üretmez (`--init-key` gerekir). 4 yeni regresyon testi.

**Tip borcu:** Ön yüzdeki 34 `@ts-nocheck` kaldırıldı; typecheck 0 hata.
`moduleDetection: "auto"` paylaşılan `Api/UI/App` globallerini görünür yaptı;
`frontend-react/types/browser-globals.d.ts` tarayıcı globallerini ve "seçiciler
HTMLElement döndürür" proje varsayımını açıkça tanımlar; form alanlarında
açık JSDoc dönüşümleri var. `strict` hâlâ kapalı.

**Tek tık Windows kurulumu:** `Kurulum.cmd` → `windows/kurulum.ps1`: Node 22+
kontrolü, `npm ci --omit=dev`, rastgele `JWT_SECRET` ile `.env`, ilk kurulum,
açılışta başlayan `DreamPlus` görevi (LOCAL SERVICE, yeniden başlatma döngüsü,
`data\logs\server.log`), isteğe bağlı güvenlik duvarı, sağlık kontrolü.
`Kaldir.cmd` veriye dokunmadan kaldırır. Kullanıcı/OneDrive klasöründen
servis kurulumu reddedilir. Release paketine girer.

**Doğrulama:** Paket içinden gerçek kurulum (`-NoService`): bağımlılık kurulumu,
`.env`, parametreli ilk kurulum, sağlık 200, giriş 200 / yanlış şifre 401,
süreç öldürülünce otomatik yeniden başlama, ikinci çalıştırmada veri korunması.
`-DryRun` görev tanımını gösterdi. **Doğrulanmadı:** yönetici yetkisiyle gerçek
görev kaydı, yeniden başlatma sonrası açılış ve güvenlik duvarı kuralı — bunlar
temiz bir Windows makinede `Kurulum.cmd` ile bir kez denenmeli.

**Belgeler:** Tarihli denetim raporları `docs/arsiv/` altına taşındı, bağlantılar
güncellendi; `docs/README.md` hangi belgenin kimin için olduğunu gösterir.
23 Eylül – 10 Ekim günlüğü `docs/arsiv/PROJECT_STATUS-ARSIV-2026-10.md`'de.

**Not:** Bazı dosyalar (ör. `tsconfig.json`, `playwright.config.js`, bazı
belgeler/testler) Windows'ta salt okunur işaretli; nedeni belgelenmemiş
(muhtemelen 19 Eylül analiz turundan kalma). Düzenlenen dosyalarda işaret
korunarak geri kondu.

## 10 Ekim 2026 — 2.0.3, yeniden denetimde bulunan hatalar düzeltildi

**Tamamlanan kapsam:** Önceki denetimde yeniden üretilen 9 hata kapatıldı.
Rota kaybı ve sürüm çakışması, kısmi sevk iptali, kalite maliyeti, tarihi
geçmiş stok, tam fire, lisans bitişi, çift durum ilerletme, yükleme hatası
ve oturum modalı için kalıcı regresyonlar var. Ürün/parti sunucu araması,
bileşene sınırlı eylemler, gecikmiş parti/planlama yanıtı, yazma kilidi ve
fiziksel/kullanılabilir stok ayrımı da düzeltildi. Müşteri verisi değiştirilmedi.

**Doğrulama:** build/typecheck/lint PASS; 42/42 takım, son ilgili tekrarlar
PASS; Chromium/WebKit 65/65 PASS; dependency audit 0 bilinen açık. Ayrı
2.0.3 paketinde temiz production kurulum, setup/giriş/health, ürün yazımı,
tam DB+dosya yedek/restore ve tekrar giriş/okuma PASS. Plan ve review gerçek
çağrılardı; Gemini review zaman aşımı ve bağlam sınırları tam model onayı
olarak gösterilmedi. Ayrıntı:
[`DUZELTMELER-VE-YENIDEN-TARAMA-2026-10-10.md`](docs/arsiv/DUZELTMELER-VE-YENIDEN-TARAMA-2026-10-10.md).

**Kalan sınırlar:** frontend tip borcu, Firefox yerel başlatma, Docker/Linux/
Node 22, uzak CI ve gerçek müşteri saha/TLS/tesis dışı kurtarma kabulü
doğrulanmadı. Eski kayıtlar aşağıda tarihsel olarak korunur. Yeni API'de
boş rota silme clear:true ister; güncel istemci sürüm/durum kontrolü gönderir.

**Sonraki tek somut dış kabul adımı:** Gerçek müşteri test kurulumunda saha
kabul kartını proxy/TLS ve tesis dışı kurtarma provasıyla tamamlamak.

## Daha eski kayıtlar

23 Eylül – 10 Ekim 2026: [`docs/arsiv/PROJECT_STATUS-ARSIV-2026-10.md`](docs/arsiv/PROJECT_STATUS-ARSIV-2026-10.md).
12–20 Eylül 2026: [`docs/arsiv/PROJECT_STATUS-ARSIV-2026-09.md`](docs/arsiv/PROJECT_STATUS-ARSIV-2026-09.md).
