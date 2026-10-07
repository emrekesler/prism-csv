/*
 * Prism CSV çekirdeği — hem webview'da (window.PrismCsv) hem eklentide (require) kullanılır.
 * Tüm işlemler aynı kayıt tarayıcısını (scanRecord) kullanır; böylece webview'daki satır numaraları
 * ile eklentinin belgeye uyguladığı düzenlemeler her zaman aynı kayda denk gelir.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PrismCsv = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const Q = 34, LF = 10, CR = 13;

  /**
   * i konumundan başlayan tek bir kaydı tarar. Alanların ham aralıklarını f dizisine
   * [başlangıç0, bitiş0, başlangıç1, bitiş1, …] olarak yazar (tırnaklar dahil).
   * Kaydın bitişi f[f.length - 1]'dir. Dönüş: satır sonundan sonraki konum.
   */
  function scanRecord(text, D, i, f) {
    const n = text.length;
    f.length = 0;
    for (;;) {
      const s = i;
      if (i < n && text.charCodeAt(i) === Q) {
        i++;
        for (;;) {
          const j = text.indexOf('"', i);
          if (j < 0) { i = n; break; }
          if (text.charCodeAt(j + 1) === Q) { i = j + 2; continue; }
          i = j + 1;
          break;
        }
      }
      while (i < n) {
        const ch = text.charCodeAt(i);
        if (ch === D || ch === LF || ch === CR) break;
        i++;
      }
      f.push(s, i);
      if (i >= n) return n;
      const ch = text.charCodeAt(i);
      if (ch === D) {
        i++;
        if (i >= n) { f.push(n, n); return n; }
        continue;
      }
      return ch === CR && text.charCodeAt(i + 1) === LF ? i + 2 : i + 1;
    }
  }

  const isBlank = (f) => f.length === 2 && f[0] === f[1];
  const startOf = (text) => (text.charCodeAt(0) === 0xfeff ? 1 : 0);

  /** Ham alan metnini değere çevirir ("" → ", dış tırnaklar kaldırılır). */
  function decode(text, s, e) {
    if (s === e || text.charCodeAt(s) !== Q) return text.slice(s, e);
    let i = s + 1, out = '';
    for (;;) {
      const j = text.indexOf('"', i);
      if (j < 0 || j >= e) return out + text.slice(i, e);
      if (j + 1 < e && text.charCodeAt(j + 1) === Q) { out += text.slice(i, j + 1); i = j + 2; continue; }
      return out + text.slice(i, j) + text.slice(j + 1, e);
    }
  }

  /** Metni satır dizilerine ayırır. Tamamen boş satırlar atlanır. */
  function parseCSV(text, delim) {
    const D = delim.charCodeAt(0), n = text.length, rows = [], f = [];
    let i = startOf(text);
    while (i < n) {
      i = scanRecord(text, D, i, f);
      if (isBlank(f)) continue;
      const row = new Array(f.length >> 1);
      for (let k = 0; k < f.length; k += 2) {
        const s = f[k], e = f[k + 1];
        row[k >> 1] = s === e ? '' : text.charCodeAt(s) === Q ? decode(text, s, e) : text.slice(s, e);
      }
      rows.push(row);
    }
    return rows;
  }

  /** Boş olmayan her kaydın başlangıç konumu (parseCSV satırlarıyla birebir aynı sırada). */
  function recordIndex(text, delim) {
    const D = delim.charCodeAt(0), n = text.length, starts = [], f = [];
    let i = startOf(text);
    while (i < n) {
      const s = i;
      i = scanRecord(text, D, i, f);
      if (!isBlank(f)) starts.push(s);
    }
    return starts;
  }

  function quoteField(v, delim, force) {
    return force || v.indexOf(delim) >= 0 || /["\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  /**
   * Hücre düzenlemelerini metin değişikliklerine çevirir.
   * edits: [{ record, col, value }] — record, recordIndex sırasındaki kayıt numarasıdır.
   * Dönüş: başlangıca göre sıralı, çakışmayan { start, end, text } listesi.
   * Yalnızca değişen alan yeniden yazılır; tırnaklı alanlar tırnaklı kalır.
   * Kaydın sonundaki eksik sütunlar boş alanlarla tamamlanır.
   */
  function cellEditChanges(text, delim, edits, starts) {
    starts = starts || recordIndex(text, delim);
    const D = delim.charCodeAt(0), f = [];
    const byRec = new Map();
    for (const e of edits) {
      if (e.record < 0 || e.record >= starts.length) continue;
      let m = byRec.get(e.record);
      if (!m) byRec.set(e.record, (m = new Map()));
      m.set(e.col, String(e.value));
    }
    const changes = [];
    for (const [rec, cols] of byRec) {
      const s = starts[rec];
      scanRecord(text, D, s, f);
      const nf = f.length >> 1, end = f[f.length - 1];
      let maxCol = -1;
      for (const c of cols.keys()) if (c > maxCol) maxCol = c;
      const wasQuoted = (k) => f[2 * k] < f[2 * k + 1] && text.charCodeAt(f[2 * k]) === Q;
      if (maxCol < nf) {
        for (const [c, v] of cols) changes.push({ start: f[2 * c], end: f[2 * c + 1], text: quoteField(v, delim, wasQuoted(c)) });
      } else {
        const parts = [];
        for (let k = 0; k <= maxCol; k++) {
          if (cols.has(k)) parts.push(quoteField(cols.get(k), delim, k < nf && wasQuoted(k)));
          else parts.push(k < nf ? text.slice(f[2 * k], f[2 * k + 1]) : '');
        }
        changes.push({ start: s, end, text: parts.join(delim) });
      }
    }
    return changes.sort((a, b) => a.start - b.start);
  }

  function applyChanges(text, changes) {
    let out = '', pos = 0;
    for (const ch of changes) { out += text.slice(pos, ch.start) + ch.text; pos = ch.end; }
    return out + text.slice(pos);
  }

  /** Değişikliklerden sonra kayıt başlangıçlarını kaydırır (yeniden taramadan). */
  function shiftIndex(starts, changes) {
    let ci = 0, acc = 0;
    for (let r = 0; r < starts.length; r++) {
      while (ci < changes.length && changes[ci].start < starts[r]) {
        acc += changes[ci].text.length - (changes[ci].end - changes[ci].start);
        ci++;
      }
      starts[r] += acc;
    }
    return starts;
  }

  /**
   * Her kaydın ham alanlarını fn(alanlar, kayıtNo) ile dönüştürür; satır sonları ve boş satırlar korunur.
   * Tamamen boş kalan kayıt "" olarak yazılır, yoksa boş satır sayılıp kaybolurdu.
   */
  function transformColumns(text, delim, fn) {
    const D = delim.charCodeAt(0), n = text.length, f = [], out = [];
    let i = startOf(text), pos = 0, rec = 0;
    while (i < n) {
      const s = i;
      i = scanRecord(text, D, i, f);
      if (isBlank(f)) continue;
      const raw = [];
      for (let k = 0; k < f.length; k += 2) raw.push(text.slice(f[k], f[k + 1]));
      const next = fn(raw, rec++);
      out.push(text.slice(pos, s), next.length > 1 || (next.length === 1 && next[0] !== '') ? next.join(delim) : '""');
      pos = f[f.length - 1];
    }
    out.push(text.slice(pos));
    return out.join('');
  }

  /** Sütunları yeniden sıralar. order[yeniKonum] = eskiSütun. Alanlar ham haliyle taşınır. */
  const reorderColumns = (text, delim, order) =>
    transformColumns(text, delim, (raw) => order.map((o) => raw[o] ?? ''));

  /** Verilen sütunları her kayıttan siler. */
  function deleteColumns(text, delim, cols) {
    const del = new Set(cols);
    return transformColumns(text, delim, (raw) => raw.filter((_, k) => !del.has(k)));
  }

  /** at konumuna boş bir sütun ekler; kısa kayıtlar o konuma kadar boş alanla tamamlanır. */
  function insertColumn(text, delim, at) {
    return transformColumns(text, delim, (raw) => {
      const r = raw.slice();
      while (r.length < at) r.push('');
      r.splice(at, 0, '');
      return r;
    });
  }

  /** Kayıtları satır sonlarıyla birlikte siler (aradaki boş satırlar korunur). */
  function deleteRecordsChanges(text, delim, records, starts) {
    starts = starts || recordIndex(text, delim);
    const D = delim.charCodeAt(0), f = [];
    return [...new Set(records)]
      .filter((r) => r >= 0 && r < starts.length)
      .sort((a, b) => a - b)
      .map((r) => ({ start: starts[r], end: scanRecord(text, D, starts[r], f), text: '' }));
  }

  /** at numaralı kaydın önüne (at = kayıt sayısıysa dosya sonuna) ncols sütunlu boş bir kayıt ekler. */
  function insertRecordChanges(text, delim, at, ncols, starts) {
    starts = starts || recordIndex(text, delim);
    const eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    const row = ncols > 1 ? delim.repeat(ncols - 1) : '""';
    if (at < starts.length) return [{ start: starts[at], end: starts[at], text: row + eol }];
    const n = text.length, last = text.charCodeAt(n - 1);
    const endsNl = n <= startOf(text) || last === LF || last === CR;
    return [{ start: n, end: n, text: endsNl ? row + eol : eol + row }];
  }

  const DELIMS = [',', ';', '\t', '|'];
  function detectDelimiter(text, ext) {
    if (ext === '.tsv' || ext === '.tab') return '\t';
    if (ext === '.psv') return '|';
    const LIMIT = 64 * 1024;
    const sample = text.slice(0, LIMIT);
    let best = ',', bestScore = -1;
    for (const d of DELIMS) {
      const rows = parseCSV(sample, d).slice(0, 60);
      if (text.length > LIMIT && rows.length > 1) rows.pop();
      if (!rows.length) continue;
      const freq = new Map();
      for (const r of rows) freq.set(r.length, (freq.get(r.length) || 0) + 1);
      let mode = 1, modeN = 0;
      for (const [len, k] of freq) if (k > modeN || (k === modeN && len > mode)) { mode = len; modeN = k; }
      if (mode < 2) continue;
      const score = (modeN / rows.length) * 100 + Math.min(mode, 40) * 0.25;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  return {
    parseCSV, recordIndex, cellEditChanges, applyChanges, shiftIndex, quoteField, detectDelimiter,
    transformColumns, reorderColumns, deleteColumns, insertColumn, deleteRecordsChanges, insertRecordChanges,
  };
});
