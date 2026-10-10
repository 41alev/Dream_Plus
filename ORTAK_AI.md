# Bu Windows bilgisayarında ortak AI başlangıcı

Bu dosyayı çalışacağın projenin kök klasörüne kopyala. Projeyi yerel komut
çalıştırabilen Codex, Claude Code veya Gemini aracında aç ve şu isteği ver:

> ORTAK_AI.md dosyasını oku ve kurallarına göre çalış. Yapılacak iş: …

Dosyayı kopyalamak tek başına süreç başlatmaz. Bu dosya yalnızca bu PC'deki
merkezi sisteme yönlendirir; merkezi klasörü taşırsan aşağıdaki yolları güncelle.

## Okuyan koordinatör için

1. Hedef proje, bu dosyanın kopyalandığı ve kullanıcının üzerinde çalışmanı
   istediği proje köküdür. Mutlak yolunu doğrula. Merkezi araç klasörünü hedef
   proje sanma; `C:\Projelerim` altındaki diğer projeleri topluca tarama.
2. Hedef projenin mevcut talimatlarını ve varsa `PROJECT_STATUS.md` dosyasını
   oku. Ardından ortak kuralların tek kaynağını gerçekten açıp oku:
   `C:\Projelerim\Ortak-AI-Proje-Sablonu\AGENTS.md`.
   Platform kuralları ve açık kullanıcı isteği önceliklidir; hedef projenin
   özel kuralları merkezi genel kurallardan önce gelir. Mevcut talimat
   dosyalarının üzerine yazma, merkezi proje durumunu hedefe kopyalama.
3. Bu kullanımda `ai_team.py` hedef kökte bulunmasa da ortak görüşme için
   merkezi betiği kullan. Merkezi kurallardaki yerel betik örneklerini aşağıdaki
   mutlak betik yolu ve doğruladığın hedef proje köküyle uygula.
   Hedefin özel kuralları kendi yerel runtime'ını zorunlu tutuyorsa o kurala
   uy; mevcut yerel runtime'ı silme veya merkezi sürümle üzerine yazma.
4. Mevcut koordinatörün kimliğini `--host codex`, `--host claude` veya
   `--host gemini` olarak seç. Kullanıcı hedefini `--task` ile, yalnız ilgili
   ve paylaşılabilir dosyaları hedef köke göreli `--file` yollarıyla aktar.
   Bu başlangıç dosyasını da bağlama ekle. Sırları veya paylaşımı yasak içeriği
   gönderme; hedef projenin aktarım politikasını kontrol et.

## Merkezi komutlar

Aşağıdaki `<...>` alanlarını gerçek değerlerle değiştir; örnekleri olduğu gibi
çalıştırma. PowerShell değişkenlerine proje metnini komut olarak çalıştıracak
biçimde ekleme; yolları ayrı, doğru alıntılanmış argümanlar olarak geçir.
Proje klasörü yolunu sonunda ters eğik çizgi olmadan yaz (örneğin
`C:\Projelerim\Proje-A`).

Kurulum kontrolü (model çağrısı yapmaz):

```powershell
python "C:\Projelerim\Ortak-AI-Proje-Sablonu\ai_team.py" --project "<hedef proje kökünün mutlak yolu>" --doctor
```

Plan görüşmesi:

```powershell
python "C:\Projelerim\Ortak-AI-Proje-Sablonu\ai_team.py" --project "<hedef proje kökünün mutlak yolu>" --host <mevcut ajan> --phase plan --task "<gerçek kullanıcı hedefi>" --file "ORTAK_AI.md" --file "<ilgili dosyanın göreli yolu>" --save
```

Değişiklik sonrası aynı betik ve hedefle `--phase review` kullan; görev ve
dosyaları yapılan değişikliğe göre seç. Gerektiğinde `--phase consult`, ciddi
anlaşmazlık veya yüksek riskte `--rounds 2` kullan. Diğer ajanlar görüş verir;
uygulama, karar ve test koordinatöre aittir.

`included_files`, `notices`, her ajanın `status` ve `message` alanlarını ve tur
kayıtlarını incele. Eksik araç, oturum, model veya başarısız çağrıyı başarılı
görüşme sayma. `--doctor` model erişimini kanıtlamaz. Merkezi kurallar veya
runtime okunamıyorsa engeli açıkça kaydet; görüşme gerçekleşmiş gibi davranma.
Python PATH üzerinde yoksa bu PC'deki gerçek kurulumu bulup doğrula; tahmini
bir yorumlayıcı yolunu kullanma. Hedefte kurulum manifesti olmayabilir;
manifest ipucunu var sayma veya merkezi manifesti hedefin kaydı sanma.

`--save` kayıtları hedef projenin politikasındaki kayıt dizinine (varsayılan
`.ai-team/records`) yazar. Gerekli durum güncellemesini hedef projenin
`PROJECT_STATUS.md` dosyasında yap; yeni dosyayı yalnız gerçek proje bilgileriyle
doldur. Merkezi şablonun durum dosyasını hedef iş için güncelleme.

Bu dosya modelleri sabitlemez; merkezi runtime'ın güncel model tercihleri
kullanılır. Ana sohbet modelini değiştirmez. Yerel terminal erişimi, CLI
oturumları, internet ve kota gerekir; sürekli çalışan bir Windows hizmeti
veya üç aracın bu dosyayı otomatik yüklediği iddiası değildir.
