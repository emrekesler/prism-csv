// README ekran görüntüsü için örnek bir durum hazırlar: http://localhost:5178/?demo
// Ekran görüntüsü: npm run screenshot (önizleme sunucusu açıkken)
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const mousedown = (el, opts = {}) => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, detail: 1, ...opts }));
    document.dispatchEvent(new MouseEvent('mouseup'));
  };
  while (!q('.td')) await sleep(50);

  // Tutar'a göre azalan sırala
  q('.hc[data-c="8"] .hc-top').click();
  await sleep(50);
  q('.hc[data-c="8"] .hc-top').click();
  await sleep(50);

  // Kategori filtresi (İngilizce ya da Türkçe örnek veriye göre)
  const qf = q('.qf[data-c="4"]');
  qf.value = q('.hc[data-c="4"] .hc-name').textContent === 'Category' ? 'electronics|sports' : 'elektronik|spor';
  qf.dispatchEvent(new Event('input', { bubbles: true }));
  qf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(150);

  // Birim Fiyat ve Tutar sütunlarında bir alan seç (durum çubuğunda toplam görünür)
  mousedown(q('.tr[data-i="1"] .td.c7'));
  await sleep(50);
  mousedown(q('.tr[data-i="5"] .td.c8'), { shiftKey: true });
  await sleep(50);

  // Şehir sütun menüsü (değer listesi + istatistik)
  q('.hc[data-c="3"] .hc-btn').click();
})();
