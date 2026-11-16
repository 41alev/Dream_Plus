# engineering.md + ORTAK_AI.md yeniden denetimi — 10 Ekim 2026

> Bu belgedeki FAIL sonuçları eski kaynak sürümünün tarihsel kanıtıdır.
> 2.0.3 düzeltmeleri ve yeniden doğrulama durumu:
> [Düzeltmeler ve yeniden tarama](DUZELTMELER-VE-YENIDEN-TARAMA-2026-10-10.md).

## Sonuç ve kapsam

Kaynak: `8ff6e2a981600a03bb27306eceb49ed75d6615a8`, sürüm 2.0.2.
Koordinatör: Codex. Hedef: `C:\Projelerim\Dream\dream-plus`.
`engineering.md` v8.3 ve `ORTAK_AI.md` üzerinden merkezi
`C:\Projelerim\Ortak-AI-Proje-Sablonu\AGENTS.md` esas alındı.

**Sonuç: 9 yeniden üretilmiş açık hata; koşulsuz satış/teslim onayı yok.**
Mevcut testlerin başarılı olması aşağıdaki hata yollarını kapsamıyor.
Bu çalışma denetimdir; uygulama kodundaki hatalar henüz düzeltilmedi.
Önceki denetim ve temiz kurulum kayıtları tarihsel kanıttır; bu rapor yeni
açıkları ve güncel kabul durumunu kaydeder. Tüm dosyaların bütün olası
durumlarda hatasız olduğu veya her satırın bağımsız modellerce incelendiği
iddia edilmez.

Sunucu iş akışları, stok/maliyet/üretim/satış/kalite/planlama, lisans,
yetkilendirme, istemci hata ve oturum yolları, testler, tip/lint/build,
bağımlılıklar, paket bütünlüğü ve teslim belgeleri incelendi. Tek firmaya ayrı
müşteri kurulumu mevcut kapsamdır. SaaS/çok kiracılı sistem zorunluluğu
eklenmedi. Mobil kapsamın önceki ertelemesi korunur.

## Öncelikli, yeniden üretilmiş hatalar

P1: veri kaybı veya temel iş doğruluğu; P2: normal öncelikli işleyiş hatası.
Her satırın ham sonucu `.ai-team/evidence/reaudit-2026-10-10.json` içindedir.

| Sıra | Öncelik / kanıt kimliği | Kaynak | Yeniden üretim ve etki | Düzeltme / kabul testi |
| --- | --- | --- | --- | --- |
| 1 | P1 / ROUTING_OUTAGE_DELETE | `frontend-react/PlanningView.jsx:450`, `server/routes/planning.js:239` | Bir operasyonlu rotanın GET isteği 503 olduğunda hata boş listeye çevriliyor. Kaydet mevcut operasyon sayısını 1'den 0'a indiriyor. | Başarısız yüklemede düzenleme/kaydetmeyi kilitle, hata ve tekrar deneme göster; açık silme niyetini normal kayıttan ayır. 503 sonrası eski rota korunmalı. |
| 2 | P1 / PARTIAL_SHIPMENT_CANCEL | `server/routes/sales.js:166`, `server/services/invoice-allocation.js:16` | 10 adet siparişten 1 adet sevkten sonra sipariş iptali kabul ediliyor; sevk edilen miktarın faturası 409 alıyor. | Aktif sevkiyat varken iptali engelle veya yalnız kalan miktarı kapatan ayrı kural uygula. Sevk edilmiş miktar faturalanabilir kalmalı. |
| 3 | P1 / QUALITY_AVERAGE_COST | `server/services/stock.js:17`, `:167`, `:200`, `server/routes/quality.js:224` | Kullanılabilir 10 adet × 10 maliyet ve karantinada 10 adet × 100 maliyet. Serbest bırakınca kullanılabilir miktar 20, ortalama maliyet 10 kalıyor; beklenen 55. `reports.js:196` önbelleği değerlemede kullanıyor. | Statü değişiminin kullanılabilir stok değerine etkisini aynı transaction içinde güncelle. Tam/kısmi kabul ve redden sonra miktar ile değer birlikte doğrulanmalı. |
| 4 | P1 / EXPIRED_STOCK_CONSUMED | `server/services/stock.js:108`, `:287` | 2020-01-01'de süresi dolmuş kullanılabilir partiden 1 adet tüketilebiliyor; miktar 3'ten 2'ye düşüyor. FEFO seçiminde tarih filtresi ve açık lot tüketiminde son kullanım kontrolü yok. | Seçim ve açık lot tüketimi yollarına aynı tarih kuralını uygula. Dün dolan parti çıkmamalı; bugün ve tarihsiz parti mevcut domain kuralına uygun ele alınmalı. |
| 5 | P2 / FULL_SCRAP_COST | `server/services/costing.js:101` | Planlanan 5, sağlam üretilen 0, fire 5, toplam maliyet 100: rapor sağlam miktarı 5 ve birim maliyeti 20 sayıyor. `produced_qty || qty` sıfırı kaybediyor. | Sıfır ile bilinmeyen miktarı ayır. Sağlam miktar 0 korunmalı; toplam maliyet 100 kaybolmamalı, sıfıra bölme olmamalı. |
| 6 | P2 / LICENSE_EXPIRY | `server/lib/license.js:73` | Mevcut imzalı, 2020-06-30 bitişli test lisansı; süreç saati 2020-07-01 öğle: `valid:true`, `daysRemaining:0`. Yuvarlama yaklaşık 24 saatlik fazla geçerlilik sağlıyor. | Geçerliliği mutlak zaman karşılaştırmasıyla belirle; kalan gün yalnız gösterim olsun. Bitiş öncesi/sonrası, saat dilimi ve süresiz lisans testleri gerekli. |
| 7 | P2 / SHIPMENT_DOUBLE_ADVANCE | `frontend-react/SalesView.jsx:259`, `server/routes/sales.js:308` | Durum ilerletme düğmesine hemen iki kez basınca iki PATCH gönderiliyor ve sevkiyat iki durum atlayarak Teslim Edildi oluyor. | İstek sürerken ilgili eylemi kilitle; sunucuda beklenen mevcut durum/sürümle tek geçiş doğrula. Çift etkinleştirme yalnız bir geçiş yapmalı. |
| 8 | P2 / COUNTS_LOADING_ERROR | `frontend-react/CountsView.jsx:36` | İlk sayım GET isteği 503: ekranda Yükleniyor kalıyor, tekrar deneme düğmesi 0. Null konteynere hata bildirmek yükleme durumunu değiştirmiyor. | Görünür hata durumuna geç ve tekrar denemeyi bağla. 503 → yeniden dene → başarılı liste akışı test edilmeli. Benzer Items/Lots/Production kalıpları da düzeltilirken taranmalı; bu denemede yalnız Counts çalıştırıldı. |
| 9 | P2 / SESSION_MODAL_REMAINS | `public/js/app.js:151`, `:430` | Yeni ürün formu açıkken gerçek çıkış ve ardından 401 ile giriş ekranı geliyor; modal görünür ve metni dolu kalıyor. | Oturum bitişinde tüm diyalogları kapat, geçici form durumunu temizle. Açık form + 401 sonrası eski modal görünmemeli. Bu denemede gerçek müşteri verisi veya yetkisiz başarılı kayıt gösterilmedi. |

Son kullanım kontrolü yalnız sektörel varsayım değildir:
`test/planning-integrity.js:125` süresi geçmiş stoğu kullanılabilir arz saymaz;
MRP tarih filtresi ve veri sağlığı kontrolü aynı beklentiyi taşır. Hizmetin
stok çıkışı bu mevcut kuralla tutarsızdır.

Maliyet bulgusunun nedeni düz ortalama almak değildir. `recalcItemQty`
yalnız miktarı günceller; `recalcAverageCost` ayrı fonksiyondur ve statü
değişimi sonunda çağrılmaz. Bağımsız modelin eksik kesitten çıkardığı
"düz ortalama" yorumu bu nedenle kabul edilmedi.

## Kaynak incelemesinde görülen ek eksikler ve araştırma kuyruğu

| Durum | Konu | Kanıt / sonraki doğrulama |
| --- | --- | --- |
| P2, kaynakta doğrulandı; büyük veri tarayıcı testi henüz yok | Rota ürün seçici ilk 300 ürünle sınırlı | `PlanningView.jsx:38`, `:50`, `:447`, `:457`: ilk sayfa içinden üretilebilir ürünler seçiliyor, devam sayfası/arama yok. 300 üzeri ürünle sonraki ürün için rota düzenleyebilme kabul testi gerekli. |
| P2, kaynakta doğrulandı; büyük veri tarayıcı testi henüz yok | Kalite parti seçicileri ilk 100 partiyle sınırlı | `QualityView.jsx:120`, `:359`; ürün listesi ayrıca ilk 300. Sonraki uygun partiyi sunucu araması/sayfalama ile bulma ve mevcut seçimi koruma testi gerekli. NCR/CAPA benzer seçicileri de kapsama alınmalı. |
| Hipotez, kapanmadı | Gizli ekranın gecikmiş yanıtından global olay bağlama | `CountsView.jsx:46`, Items/Production benzer `document.querySelectorAll('[data-open]')` kullanımı başka ekran düğmesini etkileyebilir. Gecikmiş yanıt + ekran değiştirme + doğru detay API isteği ile doğrulanmalı. |
| Hipotez, kapanmadı | Kalite ürün değişiminde gecikmiş parti yanıtı | `QualityView.jsx:118`: önceki ürün yanıtının yeni seçime eklenmesi koşulu kontrollü gecikmeli tarayıcı testi gerektirir. |
| Kaynakta koruma yok; etkisi ayrıca doğrulanmalı | Rota eşzamanlı düzenleme | `server/routes/planning.js:238`: sürüm/ETag denetimi görünmüyor. İki istemcinin aynı rotayı düzenlemesi ve önceki sürümün yeni kaydı ezmesi ayrı testtir; satış sekmesi yarış testiyle aynı konu değildir. |
| Hipotez, kapanmadı | Yazma kilidinin JSON gövdesinden önce bırakılması | API pendingWriteCount, fetch yanıt başlıklarından sonra azalıyor; geciken gövde/çift gönderim kontrollü test gerektirir. |
| Yeniden üretilemedi; doğrulanmış hata listesine alınmadı | Gecikmiş satış siparişi yanıtının Faturalar sekmesini ezmesi | STALE_SALES_RESPONSE: Faturalar seçili kaldı, fatura başlığı 1, sipariş eylemi 0. React eski içerik düğümünü değiştirdiği için bu denemede gecikmiş yanıt görünür sekmeyi bozmadı. Diğer yarışların imkânsız olduğu sonucu çıkarılmaz. |
| Modelin transaction iddiası reddedildi | changeLotStatus transaction dışı çalışıyor | Servis sözleşmesi `stock.js:9` transaction sorumluluğunu çağırana verir. `routes/stock.js:142`, `routes/quality.js:182`, `:329` çağrıları transaction içindedir. Kesitte transaction görünmemesi gerçek endpoint'te atomiklik açığını kanıtlamaz. Aynı statüye gereksiz bölme konusu ayrı iş kuralı incelemesidir. |

## Bu koşuda çalıştırılan kontroller

Windows; Node 24.19.0, npm 11.17.0, Python 3.12.10.

| Kontrol | Sonuç | Sınır |
| --- | --- | --- |
| `npm run build` | PASS | Vendor ve 13 ekran derlendi. İş kuralı kanıtı değildir. |
| `npm run typecheck` | PASS | Strict değil; frontend/public JS'de 35 `@ts-nocheck`, gevşek SQL satır tipleri var. |
| `npm run lint` | PASS | Denetim betiğinin globals açıklaması düzeltildikten sonra tekrar çalıştırıldı; 0 hata/uyarı. |
| `npm audit --json` | PASS | 407 bağımlılık, 0 bilinen güvenlik açığı; mantık/yetki açıklığını ölçmez. |
| `npm run test:all` | PASS | 41/41 test takımı. Yeni hata senaryolarını yakalamadı. |
| Chromium | PASS | 46/46 mevcut tarayıcı testi. İzole port 3314. |
| WebKit | PASS | 46/46 mevcut tarayıcı testi. İzole port 3315. |
| Mevcut 2.0.2 teslim paketi manifest karşılaştırması | PASS | 0 dosya uyuşmazlığı. Bu koşuda yeni müşteri kurulumu yapılmadı. |
| Yeni hedefli hata denemeleri | FAIL | 10 senaryo: 9 hata yeniden üretildi; 1 hipotez yeniden üretilemedi. |
| Firefox | NOT_VERIFIED | Önceki yerel SideBySide/mozglue başlatma engeli var; bu koşuda yeniden kurulmadı. |
| Docker / Linux / Node 22 / uzak CI | NOT_VERIFIED | Docker mevcut değil; uzak CI koşu sonucu bu denetimde doğrulanmadı. |

Tekrar çalıştırma: proje kökünde `node .ai-team/checks/reaudit-2026-10-10.cjs`.
Betik yalnız kendine ait geçici DB ile çalışır; veri ve tarayıcı kaynaklarını
sonlandırır. Bu bir teşhis betiğidir: işlem çıkışının 0 olması doğruluk PASS'i
değildir; sonuçlar JSON içindeki her senaryonun `status` alanından okunur.
Kalıcı regresyon testlerine henüz eklenmedi. Son sürümde ayrıca lint için
global açıklaması ve beklenen 401 catch açıklaması eklendi; davranış değişmedi.

Gerçek `data/` kullanılmadı. Kullanıcının 3310 demo süreci korunuyor.
Production setup/ilk giriş/health/tam yedek geri yükleme önceki 2.0.2
denetiminde yapılmıştı; aynı paketin bütünlüğü bu koşuda tekrar doğrulandı.

## ORTAK_AI ortak görüş ve koordinatör kararları

`--doctor` yalnız araç kontrolüdür. Gerçek `--phase plan` ve iki turlu
`--phase review` merkezi betikle çalıştırıldı. Claude ve Gemini yanıtları
`status:ok`, `model_verified:true`; review 4/4 çağrı yanıtlandı.

- Plan kaydı: `7bbb9b4f-6fd8-4f78-93cb-5eb033a8217b`.
- Review kaydı: `fa083eca-5f82-46b8-b5dc-b9f521667204`.
- Kayıtlar `.ai-team/records/`, paylaşılan seçili kaynak bağlamı
  `.ai-team/review-context-2026-10-10.md` içindedir.
- `transport_complete:true`, **`complete:false`**: plan standardı ve durum
  metni kısaltıldı; package.json sır filtresi nedeniyle atlandı. Review'da
  seçili kaynak bağlamı aktarıldı, PROJECT_STATUS kısaltıldı; hedefte olmayan
  AGENTS.md otomatik eklenemedi. Koordinatör merkezi AGENTS.md'yi doğrudan okudu.
  Bu nedenle modellerin bütün proje/standardı eksiksiz gördüğü söylenemez.

Model kayıtları ham, doğrulanmamış görüşler olarak korunur. 39 review iddiası
tek tek aşağıdaki karar gruplarına bağlandı; aynı bulgu farklı tur/ajanlarda
tekrarlandığı için 39 ayrı hata sayılmaz.

| Koordinatör kararı | Review iddiaları | Gerekçe |
| --- | --- | --- |
| Kabul, P1 rota | claude:1:1, claude:2:1, gemini:1:2, gemini:2:1 | Gerçek 503+Kaydet veri kaybı; koşullu akış olduğu için P0 yerine P1. |
| Kısmen kabul / eşzamanlılık doğrulama bekliyor | claude:1:2, claude:2:2 | Boş rota, birinci bulgunun parçası. Eşzamanlı kayıt ayrı kontrollü test gerektirir. |
| Kabul, P2 lisans | claude:1:3, claude:2:3, gemini:1:1, gemini:2:2 | İmzalı fixture+sahte saatle kanıtlı; yaklaşık bir günlük sınır hatası. |
| Kabul, P1 kısmi sevk | claude:1:4, claude:2:4, gemini:1:3, gemini:2:4 | Gerçek kısmi sevk statüsü ve fatura 409 ile doğrulandı. |
| Kabul, P1 tarihi geçmiş stok | claude:1:5, claude:2:6, gemini:1:5, gemini:2:5 | Gerçek tüketim; mevcut MRP/test domain kuralıyla tutarsız. |
| Kabul, P2 tam fire | claude:1:6, claude:2:5, gemini:1:4, gemini:2:3 | Maliyet 100 korunuyor, sağlam miktar/birim maliyet yanlış; toplam kayboluyor iddiası kabul edilmedi. |
| Kabul, P1 kalite maliyet; modelin neden açıklaması düzeltildi | claude:1:7, claude:2:7, gemini:2:9 | Tam kaynakta recalcItemQty yalnız miktar; gerçek denemede ortalama güncellenmiyor. |
| Transaction iddiası reddedildi; aynı statü bölme inceleme bekliyor | claude:1:8, gemini:2:6 | Çağıran endpoint transaction açıyor. |
| Kabul, P2 sayım hata durumu | claude:1:9, claude:2:8, gemini:1:6, gemini:2:7 | Tarayıcıda 503 ile sonsuz yükleme ve 0 tekrar dene doğrulandı. |
| Kabul, P2 modal | claude:1:10, claude:2:9, gemini:2:8 | Gerçek logout+401 sonrasında modal kaldı; yetkisiz kayıt başarısı kanıtlanmadı. |
| Liste sınırı kaynakta kabul; hızlı değişim yarışı doğrulama bekliyor | claude:1:11, claude:2:10 | 100 sınırı var; yarış kontrollü test gerektiriyor. |
| Kabul, test kapsamı boşluğu | claude:1:12, claude:2:11, gemini:2:10 | Aynı uygulama kaynağında mevcut testler PASS, hedefli denemeler FAIL. |

Yerel yardımcı incelemeler salt okunurdu. Koordinatör dokuz hatayı kendi
izole denemeleriyle doğruladı. Modellerin önerdiği her değişiklik otomatik
olarak uygulanmadı; kaynak ve çalıştırma kanıtı önceliklidir.

## Teknik borç ve ticari teslim kapıları

Frontend `@ts-nocheck`, strict olmayan tip denetimi ve SQL satır tipleri
kapanmadı. Her yeni doğrulanmış hata için başarısızdan başarılıya geçen
kalıcı regresyon testi ve CI entegrasyonu gerekiyor. Sıradan smoke testi bu
iş kuralı testlerinin yerine geçmez.

TLS/proxy hedef kurulumu, tesis dışı yedek ve kurtarma provası, gerçek müşteri
donanımı/pilot, eğitim ve imzalı kabul bu çalışma ile kapanmadı. KVKK/hukuki
metinlerin profesyonel değerlendirmesi ayrı teslim kapısıdır; bu rapor hukuki
uygunluk görüşü içermez. Destek/bakım ve lisans paket sınırları ürün kararı
gerektirir. Dream/Plus/Pro adları, fiyatları ve edition/user/warehouse feature
gating henüz kesinleşmiş veya bu denetimde uygulanmış sayılmaz.

**Sonraki tek somut adım:** Rota yükleme hatasının veri kaybına dönüşmesini
kalıcı regresyon testiyle kapat; ardından P1 faturalama, maliyet ve son kullanım
kurallarını sırayla düzelt. Bu denetim kendi başına bu düzeltmelerin tamamlandığı
anlamına gelmez.
