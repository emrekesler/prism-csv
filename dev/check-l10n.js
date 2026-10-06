// Çeviri denetimi: node dev/check-l10n.js
// - Koddaki t('…') / tn(n, '…', '…') / vscode.l10n.t('…') anahtarlarını toplar
// - Türkçe pakette eksik ya da artık anahtar var mı bakar
// - Yorum dışındaki satırlarda Türkçe karakterle yazılmış (çevrilmemiş) metin kalmış mı bakar
// - package.json içindeki %anahtar%'ların package.nls*.json dosyalarında olduğunu doğrular
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const STR = `'((?:[^'\\\\]|\\\\.)*)'`;
const unq = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');

const keys = new Set();
const collect = (src, patterns) => {
  for (const re of patterns) for (const m of src.matchAll(re)) m.slice(1).filter(Boolean).forEach((k) => keys.add(unq(k)));
};
collect(read('media/main.js'), [
  new RegExp(`\\bt\\(\\s*(?:[^'(),]+\\?\\s*)?${STR}(?:\\s*:\\s*${STR})?`, 'g'),
  new RegExp(`\\btn\\([^,]+,\\s*${STR}\\s*,\\s*${STR}`, 'g'),
]);
// ENCODINGS grup adları t(e[1]) ile çevrilir.
const encBlock = (read('media/main.js').match(/const ENCODINGS = \[([\s\S]*?)\];/) || [, ''])[1];
for (const m of encBlock.matchAll(/\['[\w-]+', '([^']+)'\]/g)) keys.add(m[1]);
collect(read('extension.js'), [new RegExp(`l10n\\.t\\(\\s*(?:[^'(),]+\\?\\s*)?${STR}(?:\\s*:\\s*${STR})?`, 'g')]);

let problems = 0;
const report = (title, list) => {
  if (!list.length) return;
  problems += list.length;
  console.log(`\n${title} (${list.length}):`);
  list.forEach((s) => console.log('  ' + s));
};

const bundle = JSON.parse(read('l10n/bundle.l10n.tr.json'));
report('Türkçe pakette eksik', [...keys].filter((k) => !(k in bundle)));
report('Türkçe pakette kullanılmayan', Object.keys(bundle).filter((k) => !keys.has(k)));
report('Yer tutucusu uyuşmayan', Object.entries(bundle)
  .filter(([k, v]) => (k.match(/\{\d+\}/g) || []).sort().join() !== (v.match(/\{\d+\}/g) || []).sort().join())
  .map(([k]) => k));

const leftovers = [];
for (const f of ['media/main.js', 'extension.js']) {
  read(f).split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (/^\s*(\*|\/\*)/.test(line) || !/[çğıöşüÇĞİÖŞÜ]/.test(code)) return;
    if (/RE_BOOL|fold =|\[İIı\]/.test(code)) return; // veri tarafı (Türkçe boolean / harf katlama)
    leftovers.push(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`);
  });
}
report('Koda gömülü Türkçe metin', leftovers);

const pkg = read('package.json');
const nlsKeys = [...pkg.matchAll(/"%([^%"]+)%"/g)].map((m) => m[1]);
for (const f of ['package.nls.json', 'package.nls.tr.json']) {
  const nls = JSON.parse(read(f));
  report(`${f} içinde eksik`, nlsKeys.filter((k) => !(k in nls)));
}

console.log(problems ? `\n${problems} sorun bulundu.` : `Çeviriler tamam: ${keys.size} anahtar, ${nlsKeys.length} manifest anahtarı.`);
process.exitCode = problems ? 1 : 0;
