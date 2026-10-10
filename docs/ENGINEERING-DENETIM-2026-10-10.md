# Engineering denetimi ve düzeltmeler — 10 Ekim 2026

Uygulanan kaynak: proje kökündeki `engineering.md`, General Software Engineering
Standard v8.3. Başlangıç kaynak kimliği: `6efc9a17b0f20a6f06ddf1106aff38a03808104b`.
Son değişiklikler 2.0.2 sürümüne aittir. Son commit kimliği Git geçmişinden,
teslim edilen paket kimliği `RELEASE.json` ve `SHA256SUMS.txt` üzerinden doğrulanır.

Kabul kapsamı mevcut masaüstü ERP ve her müşteriye ayrı tek firma kurulumudur.
Finans/stok tutarlılığı, izinler, geçersiz girdiler, eşzamanlılık ve kurtarma
korunmalıdır. Çok şirketli SaaS, mobil uygulama ve ticari paket seviyeleri bu
düzeltmenin kabul edilmiş ürün kapsamı değildir. Müşteri verisi, gerçek `.env`,
imzalama anahtarı ve müşteri dış servisleri testlerde kullanılmadı.

Seçilen kontroller: 0–8; web uygulaması 10.02, backend 10.03, dağıtım 10.19,
güvenlik/kimlik 10.23 ve yönetim uygulaması 10.24; paket kimliği için 11.6.
Yeni şema, para yuvarlama kuralı veya erişim politikası getirilmedi.

## Bulguların durumu

| Bulgu | Yapılan düzeltme / sınır | Sonuç |
| --- | --- | --- |
| Bağımlılık güvenlik duyuruları | Kilit dosyası güncellendi: proxy-addr 2.0.8, ip-address 10.7.3, source-map-js 1.2.2 ve ilgili brace-expansion sürümleri. | PASS: geliştirme dahil ve yalnız üretim audit sonuçları 0 açık. |
| Lint: 4 hata ve 42 uyarı | Tarayıcı stil sorguları doğru pencere üzerinden çağrılıyor; kullanılmayan bağlar kaldırıldı, fixture kuran işlemler korundu. Tarihsel `docs/**/kanitlar/**` kanıtları yeniden yazılmadı ve aktif kod lint kapsamından ayrıldı. `--max-warnings=0` zorunlu. | PASS: 0 hata, 0 uyarı. |
| Cross-browser yanlış port | Test sunucusu, baseURL ve health aynı PLAYWRIGHT_PORT değerini, varsayılan 3301'i kullanıyor. İzole runner korunuyor. | PASS: WebKit 46/46. Firefox ortam engeli aşağıda. |
| Vite sunucu .env'sini okuyor | Frontend derleyicisi `envDir: false` kullanıyor; runtime ayarları build girdisi değil. | PASS: temiz build, önceki NODE_ENV uyarısı yok. |
| Build ve paketleme aynı çıktıda yarışıyor | Her iki süreç `.frontend-build` üzerinden aynı SQLite bakım kilidini alıyor, finally ile bırakıyor. | PASS: kilit tutulurken alt süreç paketlemeyi reddediyor ve boş çıktıyı koruyor; sonra normal paketleme geçiyor. |
| WebKit modal kapanışında odak kayboluyor | Modal dışındaki etkinleştirme hedefi kısa süreli kaydedilip kapanışta odak iade ediliyor. | PASS: gerçek WebKit ve Chromium klavye/odak testleri. |
| Grafik testi hazır olmadan okuyor | Grafik kaydı oluşana kadar koşul bekleniyor; mevcut grafik/font/yönlendirme iddiaları korunuyor. | PASS: her iki motorun tam test paketi. |
| Windows geliştirme komutu çalışmıyor | Kabuk bağımlı NODE_ENV ataması Node başlatıcısına taşındı. Geliştirme başlatıcısı müşteri paketinden çıkarıldı. | PASS: ayrı test verisiyle yeni geliştirme başlatıcısı health 200; lint/typecheck ve üretim paket başlangıcı ayrıca geçti. |
| Sunucuda yaygın tip kontrolü kapalı | Sunucu, servisler, CLI ve migration dosyalarının tamamındaki @ts-nocheck kaldırıldı. Para, lisans, stok ve ödeme sözleşmeleri JSDoc ile belirginleştirildi; rateLimit named export ve eşdeğer fiyat/tarih dönüşümleri düzeltildi. | PASS: sunucuda @ts-nocheck 0; typecheck geçti. Tam strict/SQL satır tipleri için aşağıdaki sınır geçerli. |
| Yanıltıcı şirket yardımcı açıklaması | Gerçekte webhook/muhasebede kullanılan kimliği ve bütün sorguların izole olmadığını açıkça belgeleyen açıklama yazıldı. | Desteklenen tek firma modelinde ürün kapsamı korundu. Çok şirket desteği doğrulanmış değildir. |
| Engineering standardı izlenmiyor | Kullanıcının sağladığı v8.3 dosyası bu değişikliklerle Git'e dahil ediliyor. | Standart ve denetim birlikte sürümleniyor. |

Güvenlik duyuruları:
[proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h),
[brace-expansion](https://github.com/advisories/GHSA-qhr7-859c-m2p7),
[ip-address](https://github.com/advisories/GHSA-h3mg-xc3c-68pw),
[source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
Audit bilinen duyuruları tarar; sıfır sonuç bütün olası güvenlik kusurlarının
olmadığını kanıtlamaz.

## Son kaynak üzerinde doğrulama

Yerel hedef: Windows, Node 24.19.0, npm 11.17.0, Playwright 1.63.0.
CI hedefi Node 22 Windows/Linux; yeni Linux Firefox/WebKit işi eklendi.
Yerel sonuçlar CI'ın veya Docker hedefinin geçtiğini kanıtlamaz.

| Kontrol | Sonuç |
| --- | --- |
| npm run build | PASS: vendor + 13 ekran, müşteri .env'si yüklenmiyor. |
| npm run typecheck | PASS: sunucu @ts-nocheck kullanmıyor; aşağıdaki kısmi frontend/SQL sınırı var. |
| npm run lint | PASS: 0 hata, 0 uyarı; uyarı eşiği 0. |
| npm audit / npm audit --omit=dev | PASS: her ikisi 0 bilinen açık. |
| npm run test:all | PASS: 41/41 takım; yetki/fuzz, stok/finans, setup/upgrade, lisans, backup/restore ve bakım kilidi dahil. |
| Playwright Chromium | PASS: 46/46; ayrı test portu ve geçici veri. |
| Playwright WebKit | PASS: 46/46; ayrı test portu ve geçici veri. |
| node test/release-package.js | PASS: 135 dosya; paralel işlem engeli, sır/dış dosya reddi, checksum ve var olan paketi koruma. |
| Temiz müşteri paketi | PASS: ayrı geçici klasörde npm ci --omit=dev; ilk setup; production /health 200, yönetici giriş 200, arayüz 200. Demo yüklenmedi. |
| Aynı temiz pakette tam yedek | PASS: manifest doğrulandı ve ayrı hedef veri dizinine geri yüklendi. Bu temiz paketin uploads listesi boştu; dosyalı geri yükleme otomatik backup/restore takımında kapsanıyor. |
| git diff --check | PASS. |

İlk başarısız koşular da açıklanmıştır: toplu tip kontrolünü açma denemesinde
1651 hata görüldü; sunucu kapsamı doğru sözleşmelerle açıldı, frontend borcu
gizlenmedi. İlk WebKit koşusunda odak hatası, sonraki koşuda grafik hazır olma
yarışı vardı; final koşu ikisini de geçiyor. Bu hatalar yeniden denemeyle
gizlenmedi; ilgili kaynak veya test senkronizasyonu düzeltildi.

## Açık sınırlar ve doğrulanmamış hedefler

1. **OPEN — Frontend tip denetimi borcu:** önceki 104 kaynak dosyasından
   69'unda @ts-nocheck kaldırıldı; frontend/public JS tarafında 35 dosyada
   devam ediyor. `strict: false` ve mevcut gevşek SQLite shim'i de sürüyor.
   Typecheck PASS, bütün projenin strict denetlendiği anlamına gelmez.
   Bu kalan iş kullanıcı tarafından ertelenmiş olarak kaydedilmemiştir.
2. **NOT VERIFIED — Firefox:** motor indirilip zorla yeniden kuruldu,
   Windows launch yine spawn UNKNOWN verdi. Doğrudan çalıştırmada SideBySide
   mozglue assembly hatası görüldü. Firefox ürün testleri çalıştırılamadı.
   Linux CI işi eklendi fakat burada uzak CI sonucu doğrulanamadı.
3. **NOT VERIFIED — Docker/Linux/Node 22 final hedefi:** yerel Docker yok;
   temiz kurulum kanıtı Windows/Node 24 içindir. CI yapılandırması tek başına
   başarılı uzak koşu kanıtı değildir.
4. **NOT VERIFIED — Müşteri sahası:** gerçek TLS/proxy kurulumu, harici
   yedek hedefiyle geri dönüş provası, müşterinin donanımı, eğitimi, pilotu ve
   imzalı kabulü bu yerel testlerle kapanmaz. Mevcut teslim kapıları
   `SATISA-HAZIRLIK-SON-DURUM-2026-09-26.md` içinde geçerliliğini korur.

Sonuç: bu denetimde doğrulanan güvenlik bağımlılıkları, lint hataları,
paket yarışması, port/build sorunları ve WebKit odak kusuru giderilmiştir.
Yukarıdaki OPEN ve NOT VERIFIED durumları nedeniyle "hiç eksik yok" veya
"bütün hedeflerde koşulsuz satış onayı" iddiası yapılmaz.
