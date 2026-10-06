// Örnek veri üretir: node dev/make-sample.js [satır] [çıktı] [--tr]
//   Varsayılan: İngilizce, 5000 satır → dev/sample.csv (virgül ayırıcı, 1,234.56, ISO tarih)
//   --tr:       Türkçe → dev/sample-tr.csv (noktalı virgül, 1.234,56, gg.aa.yyyy, BOM + CRLF; Excel TR çıktısı gibi)
// İki set de aynı sütun sırasına ve tırnaklı / çok satırlı / JSON notlara sahiptir. Dosyalar git'e girmez.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const lang = args.includes('--tr') ? 'tr' : 'en';
const [rowsArg, outArg] = args.filter((a) => !a.startsWith('--'));
const N = Number(rowsArg) || 5000;
const out = outArg || path.join(__dirname, lang === 'tr' ? 'sample-tr.csv' : 'sample.csv');

const pad = (n) => String(n).padStart(2, '0');
const DATA = {
  en: {
    delim: ',', eol: '\n', bom: false, idPrefix: 'ORD-',
    header: ['Order ID', 'Customer', 'Email', 'City', 'Category', 'Date', 'Qty', 'Unit Price', 'Total', 'Status', 'Rating', 'Note'],
    names: ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Mia', 'Lucas', 'Amelia', 'James', 'Harper', 'Benjamin', 'Evelyn', 'Henry', 'Chloe', 'Jack'],
    surnames: ['Smith', 'Johnson', 'Brown', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas', 'Moore', 'Martin', 'Lee', 'Walker', 'Hall', 'Young', 'King', 'Wright'],
    cities: ['New York', 'London', 'Toronto', 'Sydney', 'Berlin', 'Amsterdam', 'Chicago', 'Seattle', 'Dublin', 'Austin', 'Boston', 'San Francisco'],
    categories: ['Electronics', 'Books', 'Clothing', 'Home & Living', 'Beauty', 'Sports', 'Toys'],
    statuses: ['Delivered', 'Delivered', 'Delivered', 'Shipped', 'Pending', 'Cancelled', 'Returned'],
    cancelled: 'Cancelled',
    notes: ['', '', '', '', '', 'Gift wrap requested', 'Leave at the door, do not ring', 'Invoice to "company"', 'Deliver\non weekdays', 'Urgent', '{"coupon":"SUMMER25","discount":25}'],
    date: (d) => d.toISOString().slice(0, 10),
    money: (x) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  tr: {
    delim: ';', eol: '\r\n', bom: true, idPrefix: 'SP-',
    header: ['Sipariş No', 'Müşteri', 'E-posta', 'Şehir', 'Kategori', 'Tarih', 'Adet', 'Birim Fiyat', 'Tutar', 'Durum', 'Puan', 'Not'],
    names: ['Ayşe', 'Mehmet', 'Elif', 'Can', 'Zeynep', 'Emre', 'Deniz', 'Burak', 'Selin', 'Mert', 'İrem', 'Oğuz', 'Şule', 'Gökhan', 'Ece', 'Çağla', 'Ömer', 'Ilgın'],
    surnames: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Öztürk', 'Aydın', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özdemir', 'Polat'],
    cities: ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Eskişehir', 'Trabzon', 'Gaziantep', 'Konya', 'Muğla', 'Çanakkale', 'Diyarbakır'],
    categories: ['Elektronik', 'Kitap', 'Giyim', 'Ev & Yaşam', 'Kozmetik', 'Spor', 'Oyuncak'],
    statuses: ['Tamamlandı', 'Tamamlandı', 'Tamamlandı', 'Kargoda', 'Beklemede', 'İptal', 'İade'],
    cancelled: 'İptal',
    notes: ['', '', '', '', '', 'Hediye paketi istendi', 'Kapıya bırakılsın; zile basmayın', 'Fatura "kurumsal" kesilsin', 'Teslimat\nhafta içi olsun', 'Acil', '{"kupon":"YAZ25","indirim":25}'],
    date: (d) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`,
    money: (x) => {
      const [i, dec] = x.toFixed(2).split('.');
      return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
    },
  },
};
const L = DATA[lang];

let seed = 42;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const TR_ASCII = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
const ascii = (s) => s.replace(/İ/g, 'I').toLowerCase().replace(/[çğıöşü]/g, (ch) => TR_ASCII[ch]);
const quote = (v) => (v.includes(L.delim) || /["\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);

const lines = [L.header.join(L.delim)];
const start = Date.UTC(2024, 0, 1);
for (let i = 0; i < N; i++) {
  const first = pick(L.names), last = pick(L.surnames);
  const date = new Date(start + Math.floor(rnd() * 640) * 86400000);
  const qty = 1 + Math.floor(rnd() * rnd() * 12);
  const price = Math.round((20 + rnd() * rnd() * 4800) * 100) / 100;
  const status = pick(L.statuses);
  const row = [
    L.idPrefix + String(100000 + i),
    `${first} ${last}`,
    `${ascii(first)}.${ascii(last)}${Math.floor(rnd() * 90 + 10)}@example.com`,
    pick(L.cities),
    pick(L.categories),
    L.date(date),
    String(qty),
    L.money(price),
    L.money(price * qty),
    status,
    status === L.cancelled || rnd() < 0.15 ? '' : String(1 + Math.floor(rnd() * 5)),
    pick(L.notes),
  ];
  lines.push(row.map(quote).join(L.delim));
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, (L.bom ? '﻿' : '') + lines.join(L.eol) + L.eol, 'utf8');
console.log(`${N} rows (${lang}) → ${out}`);
