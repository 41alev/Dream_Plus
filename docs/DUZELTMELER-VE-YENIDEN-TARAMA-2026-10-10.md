# 2.0.3 — düzeltmeler ve yeniden tarama

10 Ekim 2026. engineering.md v8.3 ve ORTAK_AI.md/merkezi AGENTS.md uygulanmıştır.
Başlangıç kaynak sürümü `f5041ae`; önceki hata kanıtı `8ff6e2a` üzerindedir.
Bu rapor önceki denetimin açık hata durumunu aşağıdaki kapsamda günceller;
eski başarısız denemeler tarihsel kanıt olarak korunur.

## Kapanan hatalar

| Önceki kanıt kimliği | Düzeltme ve son kontrol |
| --- | --- |
| ROUTING_OUTAGE_DELETE | GET hatası boş rota sayılmıyor. Hata/tekrar deneme gösteriliyor; Kaydet bulunmuyor ve kayıtlı operasyonlar korunuyor. Sunucu boş kayıtta açık silme onayı istiyor. |
| PARTIAL_SHIPMENT_CANCEL | İptal transaction içinde; aktif sevkiyat/kısmi sevk varsa 409. Mevcut sevk faturalanabiliyor. Tamamen geri alınmış sevkiyat sonrası sipariş iptali çalışıyor. |
| QUALITY_AVERAGE_COST | Kullanılabilir duruma girişte ağırlıklı maliyet güncelleniyor; kullanılabilir durumdan çıkışta mevcut düzeltme hizmetiyle kalan lotların maliyeti hesaplanıyor. Tam/kısmi kabul ve blokaj: 40/55/40. Aynı duruma geçiş yeni bölünme/hareket yaratmıyor. |
| EXPIRED_STOCK_CONSUMED | FEFO, açık lot tüketimi ve üretim kullanılabilir miktarı aynı tarih kuralını uyguluyor. Dün dolan parti reddediliyor; bugün/tarihsiz parti kabul ediliyor. İkinci lot başarısızsa önceki tüketim geri alınıyor. NCR hurda ve tedarikçi iadesi açık istisna. |
| FULL_SCRAP_COST | Sıfır sağlam üretim korunuyor: sağlam 0, toplam maliyet 100, birim maliyet 0. Mevcut çağıran, gerçekleşen miktarı yazdıktan sonra hesaplıyor. |
| LICENSE_EXPIRY | Geçerlilik kalan gün yuvarlamasıyla değil gerçek bitiş anıyla kontrol ediliyor. İmzalı fixture ile bitişten 1 ms önce/sonra ve sonraki gün sınırları kontrol edildi. Yerel bitiş günü sözleşmesi korundu. |
| SHIPMENT_DOUBLE_ADVANCE | Arayüz istek sırasında düğmeyi kilitliyor. Güncel istemci beklenen durumu gönderiyor; aynı durumla tekrar sunucuya gönderim 409. Gerçek çift etkinleştirme tek PATCH ve tek durum geçişi yapıyor. |
| COUNTS_LOADING_ERROR | Counts, Items, Lots ve Production yükleme hataları görünür tekrar deneme durumuna geçiyor. Depo/önkoşul hataları boş liste olarak saklanmıyor; yeniden deneniyor. |
| SESSION_MODAL_REMAINS | Oturum bitişi açık modalı kapatıyor ve form DOM'unu temizliyor. Gerçek çıkış+401 sonrasında eski form görünmüyor. |

## Ek bulgular ve incelemenin sonucu

- Rota için sunucuda üretilebilir ürün araması, kalite için ürüne bağlı parti
  araması eklendi. İlk 300 ürün/100 parti ötesi gerçek veri kümesinde API
  araması doğrulandı; tarayıcıda ön yüklemede olmayan kayıtların seçimi doğrulandı.
- Gizli ekranın global `[data-open]` vb. bağlaması Counts/Items/Lots/Production
  bileşen köküne sınırlandı. Gecikmiş sayım yanıtı satış detay eylemini bozmuyor.
  Kalan Dashboard `[data-dash-go]` işaretçisi yalnız o ekrana özgüdür.
- Kalite parti yüklemesinde istek sırası/ürün kimliği ve DOM bağlantısı
  kontrol ediliyor. Eski ürün yanıtı yeni parti listesini doldurmuyor.
  Yükleme başarısızsa kaydetme engelleniyor ve tekrar deneme gösteriliyor.
- Rota değişimi hash revizyonuyla transaction içinde denetleniyor; eski
  revizyon 409 alıyor. `W/` ETag öneki normalize ediliyor. Planlama sekmelerinde
  gecikmiş yanıtlar ve hatalar geçersizleşmiş yüklemeyi güncellemiyor.
- Yazma kilidi JSON gövdesi okunana kadar tutuluyor; testte [1,0] sonucu var.
- Stok API'si eski fiziksel `qty` alanını koruyup `usableQty` ekliyor. Ürün
  listesi/kartında tarihi geçmiş miktar kullanılabilir miktardan ayrılıyor;
  fiziksel stok kaybolmuyor. Veri sağlığı açıklaması yeni kontrolle uyumlu.
- Önceki gecikmiş satış sekmesi hipotezi hata olarak kabul edilmedi.
  Transaction eksikliği iddiası çağıran endpoint'ler transaction açtığı için
  reddedildi. Sayaç/transfer diğer consume yolları değildir; tüketim çağıranları
  tarandı. Gerçek müşteri geçmişine otomatik toplu düzeltme yapılmadı.

## API uyumu ve dağıtım

`expectedRevision` ve `expectedStatus` eski istemciler için isteğe bağlıdır;
güncel arayüz bunları gönderir. Eski istemcilerin sürüm/durum kontrolünü
göndermemesi halinde bu eşzamanlılık korumasından yararlanmayacağı açıktır.
**Boş rota kaydı artık `clear:true` gerektirir**; önceki boş-dizi-silme
davranışı veri kaybını önlemek amacıyla değiştirilmiştir. Entegrasyonlar bu
silme niyetini açık göndermelidir. OpenAPI bu sözleşmeleri açıklar.
Şema migration'ı veya müşteri verisi üzerinde toplu backfill yoktur.

## Gerçek doğrulama

- Build, typecheck, lint: PASS; lint 0 hata/uyarı.
- `npm run test:all`: 42/42 test takımı PASS. Sonraki ilgili kaynak eklemeleri
  için audit-regressions/openapi/data-health/contract/e2e/stock-integrity
  hedefli kontrolleri de tekrar PASS.
- Son kaynakta Chromium: **65/65 PASS**; WebKit: **65/65 PASS**.
  Bunların 19'u yeni tarayıcı regresyonudur. Önceki 11/12/18 ve 58/63
  aşama sonuçları final sayıları yerine kullanılmadı.
- Bağımlılık audit: 0 bilinen açık. Temiz production bağımlılık kurulumunda
  216 paket yüklendi; npm audit 0 açık döndürdü. Deprecated transitif paket
  uyarıları audit başarısızlığı olarak gizlenmedi; bağımlılıklar keyfi yükseltilmedi.
- Ayrı 2.0.3 müşteri paketinde temiz setup, ilk giriş, health/migration,
  gerçek ürün yazımı, tam yedek doğrulama, DB+yüklenmiş dosya geri yükleme ve
  tekrar giriş/ürün okuma: PASS.
- Test paketinin kurulum provası commit öncesi çalışma ağacını içerir;
  son commit sonrası müşteri paketi ayrıca temiz Git kaynak kimliğiyle
  üretilip manifest üzerinden kontrol edilir. Kanıt
  `.ai-team/evidence/delivery-2026-10-10.json` ve deneme betiği
  `.ai-team/checks/delivery-2026-10-10.cjs` içindedir.

Önceki hata denemeleri `.ai-team/evidence/reaudit-2026-10-10.json` içindedir.
Kalıcı regresyonlar `test/audit-regressions.js` üzerinden test:all'a dahil;
tarayıcı regresyonları `test/e2e-browser/audit-regressions.spec.js` üzerinden
mevcut Chromium/WebKit CI düzenine dahildir. Gerçek müşteri `data/`, uploads,
yedek veya dış bildirim hizmeti kullanılmadı.

## Ortak AI kayıtları ve sınırlar

Plan: `ca4ec777-8b6b-4191-ae05-5a8a939e0cda`; Claude/Gemini gerçek yanıt verdi.
İlk review `48528ff6-ad3f-400d-9d22-d7e1d42eb934`: sır filtresi kaynak/test
dosyalarını atladı; Gemini zaman aşımı. **Geçerli kod incelemesi sayılmadı.**
Kimlik/oturum satırları kaldırılmış üç küçük bağlamla ikinci review
`93110cea-f2d3-462e-b199-570754b30be5` çalıştırıldı. Kaynak/test kesitleri
aktarıldı; Claude incelemesi değerlendirildi, Gemini yine 120 saniyede zaman
aşımına uğradı. Dolayısıyla **iki modelin eksiksiz final onayı yoktur**;
`transport_complete:false`, `complete:false` durumları korunur.

Claude kararlarının karşılığı: açık silme değişikliği belgelenmiş; ETag öneki
normalize edilmiş; planlama sekme koruması genişletilmiş; kullanılabilir ve
fiziksel stok ayrımı gösterilmiş; ters sevkiyat sonrası iptal test edilmiş;
ortalama maliyet sırası yorumla açıklanmış. Üretilen miktarın açık emirlerde
yanlış tahmin oluşturduğu iddiası tek gerçek çağıran tamamlanma akışında
olduğu için kabul edilmedi. Diğer consume yolları, reload fonksiyonları ve
UI export'ları kaynak/testle doğrulandı. Lots önseçim çözücüsü hipotezi mevcut
formlarda önseçili lot sözleşmesi bulunmadığı için yeni özellik yapılmadı.
Final testlerinin bilinmediği inceleme notu final sonuçlarla güncellendi;
modellerin testleri kendilerinin çalıştırdığı iddia edilmez.

Deneme betiğinde iki harness hatası vardı: fetch `ok` alanını fonksiyon
sanmak ve yedek çıktısında `bundle` yerine `file` alanını kullanmak.
İkinci hatanın temizliğinde açık DB nedeniyle Windows EPERM oluştu. Betik
düzeltildi; son kurulum/restore provası PASS. Bunlar ürün hatası olarak
sayılmadı; başarısız loglar OS temp dizininde ayrı adlarla korundu.

Frontend/public JS'deki 35 `@ts-nocheck`, strict olmayan tip ayarları ve
gevşek SQL satır tipleri mevcut teknik borçtur; typecheck PASS bunları
kapattı anlamına gelmez. Firefox yerel başlatma, Docker/Linux/Node 22 hedefi,
uzak CI sonucu ve gerçek müşteri sahası/TLS/tesis dışı kurtarma/kabul
bu koşuda **NOT VERIFIED**. Hukuki uygunluk ve fiyat/paket kararları da bu
kod düzeltmesinin sonucu değildir. Bu rapor kusursuzluk sertifikası veya
koşulsuz ticari teslim onayı değildir.

Sonraki tek somut dış kabul adımı: ayrı müşteri test kurulumunda saha kabul
kartını gerçek donanım, proxy/TLS ve tesis dışı kurtarma provasıyla tamamlamak.
