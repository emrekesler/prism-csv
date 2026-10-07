# Prism CSV

[![CI](https://github.com/emrekesler/prism-csv/actions/workflows/ci.yml/badge.svg)](https://github.com/emrekesler/prism-csv/actions/workflows/ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue.svg)](LICENSE)

CSV/TSV dosyalarını VS Code içinde modern, renkli bir tabloda açar ve düzenler. Bağımlılığı yok, büyük dosyalarda akıcı çalışır (yüz binlerce satır).

Arayüz varsayılan olarak İngilizcedir; VS Code'un görüntüleme dili Türkçe ise Türkçe görünür. · [English](README.md)

![Prism CSV: renkli sütunlar, filtreler, sıralama, değer sayımlı sütun menüsü ve seçim istatistikleri](docs/screenshot.png)

## Özellikler

- **Hücre içi düzenleme:** Çift tık, `Enter`, `F2` ya da doğrudan yazmaya başlamak düzenlemeyi açar. `Enter` kaydedip aşağı, `Tab` sağa geçer, `Shift/Alt+Enter` hücre içinde yeni satır ekler, `Esc` iptal eder.
- **Biçim korunur:** Belgede yalnızca değişen alanın metni değişir. Tırnaklar, satır sonları ve diğer hücreler olduğu gibi kalır.
- **Toplu işlemler:** `Delete` seçili hücreleri temizler. `Ctrl+V` ile Excel'den kopyalanan blok seçili hücreden başlayarak yapıştırılır; tek bir değer yapıştırılırsa seçimin tamamına yazılır.
- **Sütun taşıma:** Başlık sürüklenerek sütun yeri değiştirilir; dosyadaki tüm satırlar yeniden sıralanır.
- **Yeniden adlandırma:** Sütun menüsündeki **Yeniden adlandır** seçeneği başlık satırını değiştirir.
- **Sağ tık menüleri:** Hücre, satır numarası ve başlıkta: kes/kopyala/yapıştır, satır ve sütun ekleme/silme (birden fazla da olur), bir değere göre filtreleme, satır detayı. Silmeler `Ctrl+Z` ile geri alınır.
- **Kaydet:** Değişiklik olduğunda araç çubuğundaki **Kaydet** düğmesi belirginleşir (`Ctrl+S` de olur). Geri al ve yinele düğmeleri ile `Ctrl+Z`/`Ctrl+Y` VS Code'un geçmişini kullanır. Kaydedilmemiş hücreler sol kenardaki sarı çizgiyle işaretlenir.
- **Renkli sütunlar:** Her sütun kendi rengini alır, açık ve koyu temaya uyar. Görünüm menüsünden *Metin*, *Arka plan* ya da *Kapalı* seçilebilir.
- **Sıralama:** Başlığa tıklayınca artan, tekrar tıklayınca azalan sıralar, üçüncü tıklama sıralamayı kaldırır. **Shift+tık** ile birden fazla sütuna göre sıralanabilir. Sayılar, tarihler ve metinler dile duyarlı sıralanır.
- **Sütun filtresi:** Her başlığın altındaki kutuya ifade yazılır (aşağıdaki tabloya bakın).
- **Değer listesi:** Sütun menüsünde (⌄) Excel benzeri işaretlenebilir değerler, sayımları ve "yalnız" düğmesi bulunur.
- **Genel arama:** `Ctrl+F`. Türkçe I/İ/ı/i farkını yok sayar. Büyük/küçük harf ve RegEx seçenekleri var, eşleşmeler vurgulanır.
- **İstatistik:** Sütun menüsünde dolu, boş ve farklı değer sayıları gösterilir. Sayı sütunlarında toplam, min, maks, ortalama ve histogram, tarih sütunlarında aralık da vardır.
- **Seçim:** Hücre seçimi, Shift ile alan seçimi ve sürükleme desteklenir. Durum çubuğunda toplam, ortalama, min ve maks görünür. `Ctrl+C` seçimi TSV olarak kopyalar, Excel'e yapıştırılabilir.
- **Satır detayı:** `Space` tuşu veya satır numarasına çift tıklama ile açılır. Tüm alanları alt alta gösterir, JSON değerleri biçimlendirir.
- **Otomatik algılama:** Ayırıcı (`,` `;` sekme `|`), sayı biçimi (`1.234,56` veya `1,234.56`) ve tarih biçimi (`gg.aa.yyyy`, ISO) algılanır. Sütun tipi menüden elle de değiştirilebilir.
- **Dışa aktarma:** Filtrelenmiş görünüm dosyaya kaydedilebilir ya da panoya CSV, TSV, Markdown veya JSON olarak kopyalanabilir.
- **Canlı güncelleme:** Dosya metin editöründe değişince tablo da güncellenir.
- **Kodlama:** UTF-8 olmayan dosyalarda VS Code diline uygun kodlama önerilir (Türkçede Windows-1254). Diğer kodlamalar menüden seçilir.

## Filtre sözdizimi

| Yazılan | Anlamı |
|---|---|
| `ankara` | içerir |
| `=Ankara` / `!=Ankara` | tam eşit / eşit değil |
| `!iptal` | içermez |
| `>100`, `>=100`, `<5`, `<=5` | karşılaştırma (sayı, tarih veya metin) |
| `10..50`, `01.01.2024..31.03.2024` | aralık |
| `^SP-1` / `com$` | ile başlar / ile biter |
| `/^\d{3}$/i` | düzenli ifade |
| `=` / `!=` | boş / dolu |
| `a \| b`, `>10 & <20` | veya / ve |

## Kısayollar

| Tuş | İşlev |
|---|---|
| `Ctrl+F` | ara |
| Ok tuşları, `PageUp/Down`, `Home/End` | gezinme (`Ctrl` ile en başa veya sona) |
| `Shift` + ok | seçimi genişlet |
| `Ctrl+A` / `Ctrl+C` / `Ctrl+V` | tümünü seç / kopyala / yapıştır |
| `Enter`, `F2`, çift tık, yazmaya başlamak | hücreyi düzenle |
| `Delete` / `Backspace` | seçili hücreleri temizle |
| `Ctrl+S` / `Ctrl+Z` / `Ctrl+Y` | kaydet / geri al / yinele |
| `Space` | satır detayını aç veya kapat |
| `Esc` | düzenlemeyi iptal et, menü, panel ya da seçimi kapat |

## Kurulum

VSIX paketini üretin (ya da son [CI çalışmasının](https://github.com/emrekesler/prism-csv/actions/workflows/ci.yml) çıktılarından indirin) ve kurun:

```bash
npm run package
code --install-extension prism-csv-1.1.0.vsix
```

CSV dosyaları bundan sonra otomatik olarak tabloda açılır. Metin editörüne dönmek için araç çubuğundaki **Metin olarak aç** düğmesini (ya da *Reopen Editor With…*) kullanın.

## Geliştirme

Kurulacak bağımlılık yok; Node.js 20+ yeterli.

- **Örnek veri:** `npm run sample` 5.000 satırlık İngilizce `dev/sample.csv` dosyasını üretir (git'e girmez). `npm run sample -- --tr` Türkçe biçimli `dev/sample-tr.csv` üretir (`;`, `1.234,56`, `gg.aa.yyyy`); önizlemede `?file=/dev/sample-tr.csv&lang=tr` ile açılır. `node dev/make-sample.js 300000 dev/big.csv` ile büyük dosya da üretilebilir.
- **Hata ayıklama:** Klasörü VS Code'da açıp `F5`'e basın. *Extension Development Host* penceresi `dev/` ile açılır.
- **Tarayıcıda önizleme:** `npm run preview` komutundan sonra http://localhost:5178 adresini açın (`dev/sample.csv` gösterilir). Türkçe için `?lang=tr`, açık tema için `?light`, başka bir dosya için `?file=/dev/big.csv` ekleyin.
- **Testler:** `npm test` (ayrıştırma, hücre düzenleme, sütun taşıma) ve `npm run check-l10n` (çeviri denetimi). CI her push ve pull request'te ikisini de çalıştırır.
- **Ekran görüntüsü:** Önizleme açıkken `npm run screenshot`, `docs/screenshot.png` dosyasını görünmez Chrome/Edge ile yeniden üretir.

## Çeviri

Kodda metinler İngilizce yazılır. Türkçe karşılıklar `l10n/bundle.l10n.tr.json` (arayüz ve eklenti mesajları) ile `package.nls.tr.json` (komut adları, ayarlar) dosyalarındadır. Yeni bir dil eklemek için bu iki dosyanın `<dil>` kopyasını oluşturmak yeterlidir. `npm run check-l10n` eksik ya da gereksiz çevirileri ve koda gömülü kalmış metinleri bulur.

Ayrıştırıcı ve düzenleme mantığı `media/csv-core.js` dosyasındadır; webview ve eklenti aynı kodu kullanır. Düzenleme, salt okunur dosya sistemlerinde (ör. git karşılaştırmaları) ve kodlama elle değiştirildiğinde kapalıdır.

## Katkı

Issue ve pull request'ler memnuniyetle karşılanır. Pull request açmadan önce `npm test` ve `npm run check-l10n` çalıştırın.

## Lisans

[MIT](LICENSE) © Emre Kesler
