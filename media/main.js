/* Prism CSV — webview arayüzü (bağımlılıksız) */
(function () {
  'use strict';

  const inVsCode = typeof acquireVsCodeApi === 'function';
  const vscode = inVsCode ? acquireVsCodeApi() : { postMessage() {}, getState: () => null, setState() {} };

  // ───────────────────────── Dil ─────────────────────────
  // Arayüz metinleri İngilizce yazılır. VS Code başka bir dildeyse eklenti, l10n/bundle.l10n.<dil>.json
  // çevirilerini sayfaya gömer (#l10n). Sayı/tarih biçimleri VS Code'un diline göre ayarlanır.
  const L10N = (() => {
    try { return JSON.parse(document.getElementById('l10n')?.textContent || '{}'); } catch { return {}; }
  })();
  const BUNDLE = L10N.bundle || {};
  const t = (msg, ...args) => {
    const s = BUNDLE[msg] ?? msg;
    return args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (args[+i] ?? m)) : s;
  };
  const LOCALE = (() => {
    try { return Intl.getCanonicalLocales(L10N.lang || navigator.language || 'en')[0]; } catch { return 'en'; }
  })();
  document.documentElement.lang = LOCALE;

  // ───────────────────────── Sabitler ─────────────────────────
  const HUES = [255, 55, 150, 335, 200, 95, 295, 25, 175, 125];
  const DELIMS = [
    { v: ',', label: t('Comma'), sym: ',' },
    { v: ';', label: t('Semicolon'), sym: ';' },
    { v: '\t', label: t('Tab'), sym: '⇥' },
    { v: '|', label: t('Pipe'), sym: '|' },
  ];
  const TYPES = { text: t('Text'), number: t('Number'), date: t('Date'), bool: t('Boolean') };
  const ENCODINGS = [
    ['windows-1252', 'Western'], ['iso-8859-1', 'Western'], ['windows-1254', 'Turkish'], ['iso-8859-9', 'Turkish'],
    ['windows-1250', 'Central European'], ['windows-1251', 'Cyrillic'], ['shift_jis', 'Japanese'],
    ['gbk', 'Chinese Simplified'], ['utf-16le', 'Unicode'],
  ];
  const CFG_VALUES = { colorMode: ['text', 'background', 'off'], density: ['comfortable', 'compact'], font: ['mono', 'ui'] };
  const OVER_R = 8;
  const OVER_C = 2;
  const MAX_LIST = 300;

  const nf = new Intl.NumberFormat(LOCALE);
  const nf2 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
  const nf4 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 4 });
  const dfDate = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', dateStyle: 'medium' });
  const dfTime = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
  const collator = new Intl.Collator(LOCALE, { numeric: true, sensitivity: 'base' });
  /** Sayıya göre tekil/çoğul anahtar seçer: tn(5, '{0} row', '{0} rows'). */
  const tn = (n, one, many) => t(n === 1 ? one : many, nf.format(n));

  const ICONS = {
    table: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M2.5 6.5h11M2.5 10h11M6.5 6.5v7"/>',
    search: '<circle cx="7" cy="7" r="4.25"/><path d="m10.25 10.25 3.25 3.25"/>',
    x: '<path d="m4.5 4.5 7 7m0-7-7 7"/>',
    filter: '<path d="M2.5 3.5h11L9.25 8.5v4l-2.5 1.25V8.5z"/>',
    chevron: '<path d="m4.5 6.25 3.5 3.5 3.5-3.5"/>',
    check: '<path d="m3.5 8.5 3 3 6-7"/>',
    columns: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M6.17 2.5v11M9.83 2.5v11"/>',
    sliders: '<path d="M2.5 5H8M11.5 5h2M2.5 11h2M8 11h5.5"/><circle cx="9.75" cy="5" r="1.75"/><circle cx="6.25" cy="11" r="1.75"/>',
    panel: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M9.5 2.5v11"/>',
    download: '<path d="M8 2.5V10M4.75 7 8 10.25 11.25 7M3 13.5h10"/>',
    code: '<path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/>',
    header: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M2.5 6.5h11M4.75 4.5h3"/>',
    copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.75"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/>',
    arrowUp: '<path d="M8 13V3.5M4.25 7.25 8 3.5l3.75 3.75"/>',
    arrowDown: '<path d="M8 3v9.5M4.25 8.75 8 12.5l3.75-3.75"/>',
    arrowRight: '<path d="M3 8h9.5M8.75 4.25 12.5 8l-3.75 3.75"/>',
    sortAsc: '<path d="M4.5 13V3M2 5.5 4.5 3 7 5.5M9.5 4h4.5M9.5 8h3.25M9.5 12h2"/>',
    sortDesc: '<path d="M4.5 3v10M2 10.5 4.5 13 7 10.5M9.5 4h2M9.5 8h3.25M9.5 12H14"/>',
    eyeOff: '<path d="m2.5 2.5 11 11M6.6 6.6a2 2 0 0 0 2.8 2.8M4.4 4.6C3.1 5.4 2.1 6.6 1.5 8c1.2 3 3.8 5 6.5 5 1.3 0 2.5-.4 3.5-1.1M6.8 3.1C7.2 3 7.6 3 8 3c2.7 0 5.3 2 6.5 5-.3.8-.8 1.6-1.3 2.2"/>',
    fit: '<path d="M2.5 8h11M5 5.5 2.5 8 5 10.5M11 5.5l2.5 2.5-2.5 2.5"/>',
    calendar: '<rect x="2.5" y="3.5" width="11" height="10" rx="1.75"/><path d="M2.5 6.75h11M5.5 2v3M10.5 2v3"/>',
    alert: '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.25v.01"/>',
    file: '<path d="M4 2.5h5l3.5 3.5v7.5H4z"/><path d="M9 2.5V6h3.5"/>',
    clipboard: '<rect x="3.5" y="3" width="9" height="11" rx="1.5"/><path d="M6 3v-.75h4V3"/>',
    wand: '<path d="m3 13 7-7M9 3.5v1.5M12.5 7H11M11.5 4.5l-1 1M4.5 3.5l.5 1M2.5 6l1 .25"/>',
    undo: '<path d="M5 3.5 2 6.5l3 3M2 6.5h7.5a3.5 3.5 0 0 1 0 7H7"/>',
    redo: '<path d="m11 3.5 3 3-3 3M14 6.5H6.5a3.5 3.5 0 0 0 0 7H9"/>',
    save: '<path d="M3.5 2.5h7l3 3v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path d="M5.5 2.5v3h4.5v-3M5 13.5v-4h6v4"/>',
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    pencil: '<path d="M10.5 3 13 5.5 6 12.5H3.5V10z"/><path d="m9 4.5 2.5 2.5"/>',
    refresh: '<path d="M13 8a5 5 0 1 1-1.46-3.54M13 2.5v3h-3"/>',
  };
  const icon = (n, cls) =>
    `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

  // ───────────────────────── Yardımcılar ─────────────────────────
  const ESC_TEST = /[&<>"]/;
  const ESC_RE = /[&<>"]/g;
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const esc = (s) => (ESC_TEST.test(s) ? s.replace(ESC_RE, (ch) => ESC_MAP[ch]) : s);
  // Türkçe I/İ/ı/i farkını yok sayan, uzunluğu koruyan küçük harfe çevirme.
  const fold = (s) => s.replace(/[İIı]/g, 'i').toLowerCase();
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const trunc = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
  const isEditable = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  function letter(c) {
    let s = '';
    for (c++; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
    return s;
  }
  function upper(a, x) {
    let lo = 0, hi = a.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (a[m] <= x) lo = m + 1; else hi = m;
    }
    return lo;
  }
  const fmtNum = (x) => (Math.abs(x) >= 1e15 ? x.toExponential(3) : Math.abs(x) < 1 ? nf4 : nf2).format(x);
  const fmtDate = (ms) => (ms % 86400000 ? dfTime : dfDate).format(new Date(ms));

  // Ayrıştırıcı eklentiyle ortak (csv-core.js); satır numaraları iki tarafta da birebir aynıdır.
  const { parseCSV, detectDelimiter } = window.PrismCsv;

  // ───────────────────────── Tip algılama ─────────────────────────
  const RE_INT = /^[-+]?\d+$/;
  const RE_DOTDEC = /^[-+]?(?:\d+)?\.\d+(?:[eE][-+]?\d+)?$|^[-+]?\d+[eE][-+]?\d+$/;
  const RE_COMMADEC = /^[-+]?\d*,\d+$/;
  const RE_US = /^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;
  const RE_TR = /^[-+]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;
  const RE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(?:Z|[+-]\d{2}:?\d{2})?$/;
  const RE_YMD = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const RE_DMY = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const RE_BOOL = /^(true|false|yes|no|evet|hayır|doğru|yanlış)$/i;

  const stripNum = (v) =>
    v.replace(/[\s  ']/g, '').replace(/^([-+]?)[₺$€£¥]/, '$1').replace(/(?:[₺$€£¥%]|TL|TRY|USD|EUR)$/i, '');

  /** 0: sayı değil · 1: sayı (ondalık ayırıcı belirsiz) · 2: nokta ondalık · 3: virgül ondalık */
  function classifyNum(s) {
    if (!s || !/\d/.test(s)) return 0;
    if (RE_INT.test(s)) return 1;
    if (RE_DOTDEC.test(s)) return /\.\d{3}$/.test(s) ? 1 : 2;
    if (RE_COMMADEC.test(s)) return /,\d{3}$/.test(s) ? 1 : 3;
    if (RE_US.test(s)) return 2;
    if (RE_TR.test(s)) return 3;
    return 0;
  }

  function toNumber(raw, dec) {
    const s = stripNum(raw);
    const k = classifyNum(s);
    if (!k) return NaN;
    if (k === 2) return +s.replace(/,/g, '');
    if (k === 3) return +s.replace(/\./g, '').replace(',', '.');
    if (RE_INT.test(s)) return +s;
    if (dec === ',') return s.includes(',') ? +s.replace(',', '.') : +s.replace(/\./g, '');
    return s.includes(',') ? +s.replace(/,/g, '') : +s;
  }

  function toDate(raw, dmy) {
    const v = raw.trim();
    let m, y, mo, d;
    if ((m = RE_ISO.exec(v) || RE_YMD.exec(v))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = RE_DMY.exec(v))) { y = +m[3]; mo = dmy ? +m[2] : +m[1]; d = dmy ? +m[1] : +m[2]; }
    else if ((m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(v))) return Date.UTC(+m[1], m[2] ? +m[2] - 1 : 0, 1);
    else return NaN;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
    return Date.UTC(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }

  function inferType(c) {
    const rows = S.rows, n = rows.length, step = Math.max(1, Math.floor(n / 4000));
    let ne = 0, num = 0, date = 0, bool = 0, dotEv = 0, commaEv = 0, dmyEv = 0, mdyEv = 0;
    for (let r = 0; r < n; r += step) {
      const raw = rows[r][c];
      if (!raw) continue;
      const v = raw.trim();
      if (!v) continue;
      ne++;
      const k = classifyNum(stripNum(v));
      if (k) {
        num++;
        if (k === 2) dotEv++; else if (k === 3) commaEv++;
        continue;
      }
      const m = RE_DMY.exec(v);
      if (m) {
        const a = +m[1], b = +m[2];
        if (a > 12) dmyEv++; else if (b > 12) mdyEv++;
        if (a <= 31 && b <= 31 && (a <= 12 || b <= 12)) date++;
        continue;
      }
      if (RE_ISO.test(v) || RE_YMD.test(v)) { date++; continue; }
      if (RE_BOOL.test(v)) bool++;
    }
    const type = !ne ? 'text' : num / ne >= 0.9 ? 'number' : date / ne >= 0.9 ? 'date' : bool / ne >= 0.95 ? 'bool' : 'text';
    return { type, dec: commaEv > dotEv ? ',' : '.', dmy: dmyEv >= mdyEv };
  }

  // ───────────────────────── Durum ─────────────────────────
  const saved = vscode.getState() || {};
  const S = {
    fileName: '', ext: '', text: '', encoding: null, bom: false, eol: '\n',
    delimMode: saved.delimMode || 'auto', delim: ',', detected: ',',
    hasHeader: saved.hasHeader ?? true,
    headerRow: [], rows: [], ncols: 0, cols: [],
    visCols: [], xs: [], dataW: 0, rnW: 52, rowH: 30, headH: 66,
    view: [],
    sort: saved.sort || [],
    quick: saved.quick || {},
    vf: reviveVf(saved.vf),
    search: saved.search || '', sCase: !!saved.sCase, sRegex: !!saved.sRegex,
    searchErr: false, quickErr: new Set(),
    hidden: new Set(saved.hidden || []),
    widths: saved.widths || {},
    types: saved.types || {},
    cfg: { colorMode: 'text', density: 'comfortable', font: 'mono' },
    sel: null,
    drawer: !!saved.drawer,
    bannerOff: false,
    // Düzenleme
    editable: false,      // eklenti belgenin yazılabilir olduğunu bildirir
    dirty: false,         // belgede kaydedilmemiş değişiklik var
    textStale: false,     // S.text son düzenlemelerden önceki metin (yeniden ayrıştırmadan önce eklentiden istenir)
    viewStale: false,     // düzenlemeden sonra filtre/sıralama yeniden uygulanmadı
    edit: null,           // açık hücre düzenleyicisi
    edited: new Set(),    // kaydedilmemiş düzenlenen hücreler ("satır,sütun")
    pendingReload: null,
  };
  let restoreScroll = saved.scroll || null;
  const cache = { keys: new Map(), ranks: new Map(), folded: new Map(), distinct: new Map(), joined: null, joinedSig: '' };

  function reviveVf(o) {
    const out = {};
    for (const k in o || {}) out[k] = { mode: o[k].mode, set: new Set(o[k].values) };
    return out;
  }
  function clearCaches() {
    cache.keys.clear(); cache.ranks.clear(); cache.folded.clear(); cache.distinct.clear();
    cache.joined = null; cache.joinedSig = '';
  }

  let saveT = 0;
  function saveState() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const vf = {};
      for (const k in S.vf) vf[k] = { mode: S.vf[k].mode, values: [...S.vf[k].set] };
      vscode.setState({
        delimMode: S.delimMode, hasHeader: S.hasHeader, sort: S.sort, quick: S.quick, vf,
        search: S.search, sCase: S.sCase, sRegex: S.sRegex, hidden: [...S.hidden],
        widths: S.widths, types: S.types, drawer: S.drawer,
        scroll: { top: $vp.scrollTop, left: $vp.scrollLeft },
      });
    }, 300);
  }

  // ───────────────────────── İskelet ─────────────────────────
  const app = document.createElement('div');
  app.className = 'app';
  app.innerHTML = `
    <header class="toolbar">
      <div class="file">
        <div class="file-icon" aria-hidden="true"></div>
        <div class="file-meta"><div class="file-name" id="fname">—</div><div class="file-sub" id="fsub"></div></div>
      </div>
      <div class="search" id="searchBox">
        ${icon('search')}
        <input id="search" type="text" placeholder="${t('Search table…')}" spellcheck="false" autocomplete="off">
        <span class="search-count" id="searchCount"></span>
        <button class="tg" id="searchClear" hidden>${icon('x')}</button>
        <button class="tg" id="tgCase" data-tip="${t('Match case')}">Aa</button>
        <button class="tg" id="tgRegex" data-tip="${t('Regular expression')}">.*</button>
      </div>
      <div class="spacer"></div>
      <div class="tools">
        <button class="pill" id="btnDelim"></button>
        <button class="ib" id="btnHeader" data-tip="${t('First row is header')}">${icon('header')}</button>
        <button class="ib" id="btnCols" data-tip="${t('Columns')}">${icon('columns')}<span class="badge" id="colsBadge" hidden></span></button>
        <button class="ib" id="btnView" data-tip="${t('View')}">${icon('sliders')}</button>
        <button class="ib" id="btnDetail" data-tip="${t('Row details (Space)')}">${icon('panel')}</button>
        <button class="ib" id="btnExport" data-tip="${t('Export')}">${icon('download')}</button>
        <button class="ib" id="btnText" data-tip="${t('Open as text')}">${icon('code')}</button>
        <span class="sep"></span>
        <div class="savegrp" id="saveGrp">
          <span class="ro-pill" id="roPill" hidden>${icon('lock')}${t('Read-only')}</span>
          <button class="ib tip-r" id="btnUndo" data-tip="${t('Undo (Ctrl+Z)')}">${icon('undo')}</button>
          <button class="ib tip-r" id="btnRedo" data-tip="${t('Redo (Ctrl+Y)')}">${icon('redo')}</button>
          <button class="save-btn tip-r" id="btnSave" data-tip="${t('Save (Ctrl+S)')}" disabled></button>
        </div>
      </div>
    </header>
    <div class="banner" id="banner"></div>
    <div class="chips" id="chips"></div>
    <main class="grid-wrap" id="gridWrap">
      <div class="viewport" id="vp" tabindex="0">
        <div class="canvas" id="canvas"><div class="thead" id="thead"></div><div class="tbody" id="tbody"></div></div>
      </div>
      <div class="empty-state" id="empty"></div>
      <aside class="drawer" id="drawer"></aside>
    </main>
    <footer class="status"><div id="stL"></div><div id="stR"></div></footer>
    <div class="loading show" id="loading"><div class="loading-inner"><div class="spinner"></div><span>${t('Preparing table…')}</span></div></div>`;
  document.body.appendChild(app);

  const $ = (id) => document.getElementById(id);
  const $vp = $('vp'), $canvas = $('canvas'), $thead = $('thead'), $tbody = $('tbody');
  const $search = $('search'), $searchBox = $('searchBox'), $chips = $('chips'), $empty = $('empty');
  const $drawer = $('drawer'), $gridWrap = $('gridWrap'), $banner = $('banner'), $loading = $('loading');
  const $stL = $('stL'), $stR = $('stR');
  const $colStyle = document.createElement('style');
  const $dragStyle = document.createElement('style');
  document.head.append($colStyle, $dragStyle);

  // ───────────────────────── Yükleme ─────────────────────────
  function load(text, isUpdate) {
    cancelEdit();
    const prevCols = S.cols, prevHeader = S.headerRow;
    S.text = text;
    S.bom = text.charCodeAt(0) === 0xfeff;
    S.eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    S.detected = detectDelimiter(text, S.ext);
    S.delim = S.delimMode === 'auto' ? S.detected : S.delimMode;
    const all = parseCSV(text, S.delim);
    let ncols = 0;
    for (let i = 0; i < all.length; i++) if (all[i].length > ncols) ncols = all[i].length;
    S.headerRow = S.hasHeader && all.length ? all.shift() : [];
    S.rows = all;
    // Sütunlar dışarıdan (ör. geri al ile) yer değiştirdiyse filtre/genişlik/renkler sütunu takip etsin.
    let prevOf = null;
    if (isUpdate && S.hasHeader && prevCols.length === ncols) {
      const inv = headerPermutation(prevHeader, S.headerRow, ncols);
      if (inv) {
        remapState(inv);
        prevOf = [];
        inv.forEach((nw, old) => { prevOf[nw] = old; });
      }
    }
    const sameShape = isUpdate && prevCols.length === ncols;
    S.ncols = ncols;
    S.textStale = false;
    S.viewStale = false;
    S.edited.clear();
    clearCaches();
    pruneState();
    S.cols = [];
    const prevFor = (c) => (sameShape ? prevCols[prevOf ? prevOf[c] : c] : null);
    for (let c = 0; c < ncols; c++) {
      const h = (S.headerRow[c] ?? '').trim();
      const info = inferType(c), pc = prevFor(c);
      S.cols.push({
        name: h || (S.hasHeader ? t('Column {0}', c + 1) : letter(c)),
        auto: info.type, type: S.types[c] || info.type, dec: info.dec, dmy: info.dmy, w: 0,
        ci: pc ? pc.ci : c,
      });
    }
    for (let c = 0; c < ncols; c++) S.cols[c].w = S.widths[c] || (prevFor(c) ? prevFor(c).w : fitWidth(c));
    updateColorStyles();
    computeLayout();
    buildHeader();
    apply();
    renderChips();
    renderChrome();
    checkEncoding();
  }

  /** Mevcut ayarlarla yeniden ayrıştırır; düzenlemelerden sonra güncel metni önce eklentiden ister. */
  function reloadText(isUpdate) {
    commitEdit();
    if (S.textStale) {
      S.pendingReload = { isUpdate };
      vscode.postMessage({ type: 'getText' });
    } else load(S.text, isUpdate);
  }

  function pruneState() {
    const n = S.ncols;
    S.sort = S.sort.filter((s) => s.col < n);
    for (const o of [S.quick, S.vf, S.widths, S.types]) for (const k in o) if (+k >= n) delete o[k];
    for (const c of [...S.hidden]) if (c >= n) S.hidden.delete(c);
  }

  function resetColumnState() {
    S.sort = []; S.quick = {}; S.vf = {}; S.widths = {}; S.types = {};
    S.hidden.clear(); S.sel = null;
  }

  /** Sütun durumunu yeni konumlara taşır. inv[eskiSütun] = yeniSütun. */
  function remapState(inv) {
    const move = (o) => {
      const out = {};
      for (const k in o) if (inv[+k] !== undefined) out[inv[+k]] = o[k];
      return out;
    };
    S.quick = move(S.quick);
    S.vf = move(S.vf);
    S.widths = move(S.widths);
    S.types = move(S.types);
    S.hidden = new Set([...S.hidden].map((c) => inv[c]).filter((c) => c !== undefined));
    S.sort = S.sort.map((s) => ({ col: inv[s.col], dir: s.dir })).filter((s) => s.col !== undefined);
    S.edited = new Set([...S.edited].map((key) => { const [r, c] = key.split(','); return r + ',' + inv[+c]; }));
  }

  /** Başlıklar benzersiz ve yalnızca yer değiştirmişse inv[eski] = yeni döndürür. */
  function headerPermutation(a, b, n) {
    if (a.length !== n || b.length !== n || a.every((h, i) => h === b[i])) return null;
    const pos = new Map();
    b.forEach((h, i) => pos.set(h, i));
    if (pos.size !== n) return null;
    const inv = new Array(n), seen = new Set();
    for (let i = 0; i < n; i++) {
      const j = pos.get(a[i]);
      if (j === undefined || seen.has(j)) return null;
      seen.add(j);
      inv[i] = j;
    }
    return inv;
  }

  // ───────────────────────── Ölçüler ─────────────────────────
  let mctx = null;
  function fontFamily(kind) {
    const cs = getComputedStyle(document.documentElement);
    const fam = cs.getPropertyValue(kind === 'ui' ? '--vscode-font-family' : '--vscode-editor-font-family').trim();
    return fam || (kind === 'ui' ? 'system-ui, sans-serif' : 'Consolas, monospace');
  }
  function fitWidth(c) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    const rows = S.rows, n = rows.length;
    mctx.font = `${S.cfg.font === 'ui' ? 13 : 12.5}px ${fontFamily(S.cfg.font)}`;
    let max = 0;
    const check = (r) => {
      const v = rows[r][c];
      if (v) { const w = mctx.measureText(v.length > 120 ? v.slice(0, 120) : v).width; if (w > max) max = w; }
    };
    const head = Math.min(n, 250);
    for (let r = 0; r < head; r++) check(r);
    if (n > 500) for (let r = 250, step = Math.floor(n / 250); r < n; r += step) check(r);
    mctx.font = `600 12.5px ${fontFamily('ui')}`;
    const hw = mctx.measureText(S.cols[c].name).width + 84;
    return Math.round(Math.min(440, Math.max(84, max + 24, Math.min(hw, 300))));
  }

  function computeLayout() {
    S.visCols = [];
    for (let c = 0; c < S.ncols; c++) if (!S.hidden.has(c)) S.visCols.push(c);
    S.xs = [];
    let x = 0;
    for (const c of S.visCols) { S.xs.push(x); x += S.cols[c].w; }
    S.dataW = x;
    const compact = S.cfg.density === 'compact';
    S.rowH = compact ? 24 : 30;
    S.headH = compact ? 58 : 66;
    S.rnW = Math.max(46, Math.round(String(S.rows.length || 1).length * 7.5 + 26));
    const rs = document.documentElement.style;
    rs.setProperty('--rowh', S.rowH + 'px');
    rs.setProperty('--headh', S.headH + 'px');
    rs.setProperty('--rnw', S.rnW + 'px');
    $canvas.style.width = S.rnW + S.dataW + 'px';
    sizeCanvas();
  }
  function sizeCanvas() {
    $canvas.style.height = S.headH + S.view.length * S.rowH + 'px';
    $tbody.style.height = S.view.length * S.rowH + 'px';
  }

  function updateColorStyles() {
    const b = document.body.classList;
    const light = b.contains('vscode-light') || b.contains('vscode-high-contrast-light');
    const lc = light ? '0.52 0.15' : '0.80 0.12';
    let css = '';
    // Renk sütunun kendisine bağlı (ci); sütun taşındığında rengi de onunla gider.
    for (let c = 0; c < S.ncols; c++) {
      const ci = S.cols[c] ? S.cols[c].ci : c;
      const h = (HUES[ci % HUES.length] + Math.floor(ci / HUES.length) * 17) % 360;
      css += `.c${c}{--cc:oklch(${lc} ${h})}`;
    }
    $colStyle.textContent = css;
  }

  // ───────────────────────── Önbellekli anahtarlar ─────────────────────────
  function keys(c) {
    let K = cache.keys.get(c);
    if (K) return K;
    const col = S.cols[c], rows = S.rows, n = rows.length;
    K = new Float64Array(n);
    const isDate = col.type === 'date';
    for (let r = 0; r < n; r++) {
      const v = rows[r][c];
      K[r] = !v ? NaN : isDate ? toDate(v, col.dmy) : toNumber(v, col.dec);
    }
    cache.keys.set(c, K);
    return K;
  }

  /** Metin sütunları için sıralama sırası (her farklı değer bir kez karşılaştırılır). */
  function ranks(c) {
    let R = cache.ranks.get(c);
    if (R) return R;
    const rows = S.rows, n = rows.length, uniq = new Map();
    for (let r = 0; r < n; r++) { const v = rows[r][c]; if (v && !uniq.has(v)) uniq.set(v, 0); }
    const vals = [...uniq.keys()];
    let cmp = collator.compare;
    if (vals.length > 150000) {
      const F = new Map(vals.map((v) => [v, fold(v)]));
      cmp = (a, b) => { const x = F.get(a), y = F.get(b); return x < y ? -1 : x > y ? 1 : 0; };
    }
    vals.sort(cmp);
    let rank = 0;
    for (let i = 0; i < vals.length; i++) {
      if (i && cmp(vals[i - 1], vals[i])) rank++;
      uniq.set(vals[i], rank);
    }
    R = new Float64Array(n);
    for (let r = 0; r < n; r++) { const v = rows[r][c]; R[r] = v && v.trim() ? uniq.get(v) : NaN; }
    cache.ranks.set(c, R);
    return R;
  }

  function folded(c) {
    let F = cache.folded.get(c);
    if (F) return F;
    const rows = S.rows, n = rows.length;
    F = new Array(n);
    for (let r = 0; r < n; r++) { const v = rows[r][c]; F[r] = v ? fold(v) : ''; }
    cache.folded.set(c, F);
    return F;
  }

  function joined() {
    const sig = (S.sCase ? '1:' : '0:') + S.visCols.join(',');
    if (cache.joined && cache.joinedSig === sig) return cache.joined;
    const rows = S.rows, cols = S.visCols, n = rows.length, J = new Array(n);
    for (let r = 0; r < n; r++) {
      const row = rows[r];
      let s = '';
      for (let k = 0; k < cols.length; k++) { const v = row[cols[k]]; if (v) s += v + '\u0001'; }
      J[r] = S.sCase ? s : fold(s);
    }
    cache.joined = J;
    cache.joinedSig = sig;
    return J;
  }

  function distinct(c) {
    let d = cache.distinct.get(c);
    if (d) return d;
    const m = new Map(), rows = S.rows;
    for (let r = 0; r < rows.length; r++) { const v = rows[r][c] ?? ''; m.set(v, (m.get(v) || 0) + 1); }
    d = [...m.entries()];
    if (d.length <= 50000) d.sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]));
    else d.sort((a, b) => b[1] - a[1]);
    cache.distinct.set(c, d);
    return d;
  }

  // ───────────────────────── Filtreler ─────────────────────────
  function compileSearch() {
    const q = S.search;
    if (!q) return null;
    if (S.sRegex) {
      let re;
      try { re = new RegExp(q, S.sCase ? '' : 'i'); } catch { S.searchErr = true; return null; }
      const rows = S.rows, cols = S.visCols;
      return (r) => {
        const row = rows[r];
        for (let k = 0; k < cols.length; k++) { const v = row[cols[k]]; if (v && re.test(v)) return true; }
        return false;
      };
    }
    const J = joined(), needle = S.sCase ? q : fold(q);
    return (r) => J[r].includes(needle);
  }

  /**
   * Hızlı filtre sözdizimi (sütun başlığındaki kutu):
   *   metin   içerir         =metin  tam eşit      !metin  içermez     !=metin  eşit değil
   *   >10 >=10 <10 <=10      10..50  aralık        ^baş    ile başlar  son$     ile biter
   *   =       boş            !=      dolu          /regex/i            a | b    veya,  a & b  ve
   */
  function compileQuick(expr, c) {
    expr = expr.trim();
    if (!expr) return null;
    const rows = S.rows;
    const m = /^\/(.+)\/([imsu]*)$/.exec(expr);
    if (m) {
      let re;
      try { re = new RegExp(m[1], m[2]); } catch { S.quickErr.add(c); return null; }
      return (r) => re.test(rows[r][c] || '');
    }
    const ors = expr
      .split('|')
      .map((part) => part.split('&').map((t) => compileTerm(t.trim(), c)).filter(Boolean))
      .filter((a) => a.length);
    if (!ors.length) return null;
    if (ors.length === 1 && ors[0].length === 1) return ors[0][0];
    return (r) => ors.some((ands) => ands.every((f) => f(r)));
  }

  function numCmp(c, rhs) {
    const col = S.cols[c];
    if (col.type !== 'number' && col.type !== 'date') return null;
    const x = col.type === 'number' ? toNumber(rhs, col.dec) : toDate(rhs, col.dmy);
    if (x !== x) return null;
    const K = keys(c);
    return (r) => (K[r] !== K[r] ? null : K[r] < x ? -1 : K[r] > x ? 1 : 0);
  }
  function anyCmp(c, rhs) {
    const nc = numCmp(c, rhs);
    if (nc) return nc;
    const F = folded(c), q = fold(rhs);
    return (r) => (F[r] === '' ? null : collator.compare(F[r], q));
  }

  function compileTerm(t, c) {
    if (!t) return null;
    const rows = S.rows;
    const F = () => folded(c);
    let m;
    if ((m = /^(!?)=(.*)$/.exec(t))) {
      const neg = !!m[1], rhs = m[2].trim();
      if (!rhs) return neg ? (r) => !!(rows[r][c] || '').trim() : (r) => !(rows[r][c] || '').trim();
      const nc = numCmp(c, rhs);
      if (nc) return (r) => (nc(r) === 0) !== neg;
      const q = fold(rhs), f = F();
      return (r) => (f[r].trim() === q) !== neg;
    }
    if ((m = /^(>=|<=|>|<)\s*(.+)$/.exec(t))) {
      const op = m[1], cmp = anyCmp(c, m[2].trim());
      return (r) => {
        const d = cmp(r);
        if (d === null) return false;
        return op === '>' ? d > 0 : op === '>=' ? d >= 0 : op === '<' ? d < 0 : d <= 0;
      };
    }
    if ((m = /^(.+?)\s*\.\.\s*(.+)$/.exec(t))) {
      const lo = anyCmp(c, m[1].trim()), hi = anyCmp(c, m[2].trim());
      return (r) => { const a = lo(r), b = hi(r); return a !== null && b !== null && a >= 0 && b <= 0; };
    }
    if ((m = /^!(.*)$/.exec(t))) {
      const q = fold(m[1].trim());
      if (!q) return (r) => !!(rows[r][c] || '').trim();
      const f = F();
      return (r) => !f[r].includes(q);
    }
    if (t.length > 1 && t[0] === '^') { const q = fold(t.slice(1)), f = F(); return (r) => f[r].trimStart().startsWith(q); }
    if (t.length > 1 && t.endsWith('$')) { const q = fold(t.slice(0, -1)), f = F(); return (r) => f[r].trimEnd().endsWith(q); }
    const q = fold(t), f = F();
    return (r) => f[r].includes(q);
  }

  function sortView(view) {
    const specs = S.sort.filter((s) => s.col < S.ncols);
    if (!specs.length) return view.sort((a, b) => a - b);
    const K = specs.map((s) => {
      const t = S.cols[s.col].type;
      return t === 'number' || t === 'date' ? keys(s.col) : ranks(s.col);
    });
    const D = specs.map((s) => s.dir), m = specs.length;
    return view.sort((a, b) => {
      for (let i = 0; i < m; i++) {
        const x = K[i][a], y = K[i][b];
        const xn = x !== x, yn = y !== y;
        if (xn || yn) { if (xn && yn) continue; return xn ? 1 : -1; } // boşlar her zaman sonda
        if (x !== y) return (x - y) * D[i];
      }
      return a - b;
    });
  }

  function apply(opt = {}) {
    commitEdit();
    const rows = S.rows, n = rows.length;
    const focusRow = S.sel ? S.view[S.sel.fr] : undefined;
    let view;
    if (opt.sortOnly) {
      view = sortView(S.view.slice());
      S.viewStale = S.viewStale && hasFilters();
    } else {
      S.viewStale = false;
      S.searchErr = false;
      S.quickErr = new Set();
      const preds = [];
      for (const k in S.vf) {
        const c = +k, f = S.vf[k], set = f.set;
        preds.push(f.mode === 'in' ? (r) => set.has(rows[r][c] ?? '') : (r) => !set.has(rows[r][c] ?? ''));
      }
      for (const k in S.quick) { const p = compileQuick(S.quick[k], +k); if (p) preds.push(p); }
      const sp = compileSearch();
      if (sp) preds.push(sp);
      if (!preds.length) {
        view = new Array(n);
        for (let i = 0; i < n; i++) view[i] = i;
      } else {
        view = [];
        const np = preds.length;
        outer: for (let r = 0; r < n; r++) {
          for (let k = 0; k < np; k++) if (!preds[k](r)) continue outer;
          view.push(r);
        }
      }
      sortView(view);
    }
    S.view = view;
    if (S.sel) {
      const idx = focusRow === undefined ? -1 : view.indexOf(focusRow);
      if (idx >= 0) S.sel = { ar: idx, ak: S.sel.fk, fr: idx, fk: S.sel.fk };
      else S.sel = null;
      clampSel();
    }
    sizeCanvas();
    if (opt.resetScroll) {
      if (S.sel) ensureVisible(S.sel.fr, S.sel.fk);
      else $vp.scrollTop = 0;
    }
    scheduleRender();
    renderEmpty();
    renderStatus();
    renderSearchMeta();
    if (S.drawer) renderDrawer();
  }

  const hasFilters = () => !!S.search || Object.keys(S.quick).length > 0 || Object.keys(S.vf).length > 0;

  let filterT = 0;
  function filterNow() {
    clearTimeout(filterT);
    apply({ resetScroll: true });
    renderChips();
    renderChrome();
    saveState();
  }
  function filterSoon() {
    clearTimeout(filterT);
    const n = S.rows.length;
    filterT = setTimeout(filterNow, n > 200000 ? 300 : n > 30000 ? 150 : 40);
  }
  function sortChanged() {
    buildHeader();
    apply({ sortOnly: true, resetScroll: true });
    renderChips();
    saveState();
  }
  function toggleSort(c, multi) {
    const idx = S.sort.findIndex((s) => s.col === c);
    if (!multi) {
      if (idx >= 0 && S.sort.length === 1) S.sort = S.sort[0].dir === 1 ? [{ col: c, dir: -1 }] : [];
      else S.sort = [{ col: c, dir: 1 }];
    } else if (idx < 0) S.sort.push({ col: c, dir: 1 });
    else if (S.sort[idx].dir === 1) S.sort[idx].dir = -1;
    else S.sort.splice(idx, 1);
    sortChanged();
  }
  function clearAll(includeSort) {
    S.search = '';
    $search.value = '';
    S.quick = {};
    S.vf = {};
    if (includeSort) S.sort = [];
    buildHeader();
    filterNow();
  }
  function setValue(c, v, on, total) {
    let f = S.vf[c];
    if (!f) {
      if (on) return;
      f = S.vf[c] = { mode: 'out', set: new Set() };
    }
    if (f.mode === 'out') {
      if (on) f.set.delete(v); else f.set.add(v);
      if (!f.set.size) delete S.vf[c];
    } else {
      if (on) f.set.add(v); else f.set.delete(v);
      if (f.set.size === total) delete S.vf[c];
    }
  }
  function vfLabel(c, short) {
    const f = S.vf[c], n = f.set.size;
    if (short) return f.mode === 'in' ? t('{0} selected', n) : t('{0} excluded', n);
    const first = n === 1 ? [...f.set][0] : '';
    const shown = first === '' ? t('(empty)') : esc(trunc(first, 24));
    if (f.mode === 'in') return n === 0 ? t('none') : n === 1 ? `= ${shown}` : t('{0} values', nf.format(n));
    return n === 1 ? `≠ ${shown}` : t('{0} values excluded', nf.format(n));
  }

  // ───────────────────────── Başlık ─────────────────────────
  const typeGlyph = (t) => (t === 'number' ? '#' : t === 'date' ? icon('calendar') : t === 'bool' ? '✓' : 'Aa');

  function buildHeader() {
    const active = document.activeElement;
    const focusC = active && active.classList && active.classList.contains('qf') ? active.dataset.c : null;
    const selStart = focusC !== null ? active.selectionStart : 0;
    let h = `<div class="hc-corner" data-act="selall" title="${t('Select all')}">#</div>`;
    const tipHead = t('click: sort · Shift+click: multi-sort · drag: move');
    const tipMenu = t('Column menu');
    const tipFilter = t('Examples: london · =exact · !exclude · >100 · 10..50 · ^starts · ends$ · /regex/ · a|b · = (empty) · != (not empty)');
    const phFilter = t('Filter');
    for (const c of S.visCols) {
      const col = S.cols[c];
      const si = S.sort.findIndex((s) => s.col === c);
      const qv = S.quick[c] || '';
      const hasVf = !!S.vf[c];
      const sortHtml = si < 0 ? '' :
        `<span class="sort-ind">${icon(S.sort[si].dir > 0 ? 'arrowUp' : 'arrowDown')}${S.sort.length > 1 ? si + 1 : ''}</span>`;
      h += `<div class="hc c${c}${qv || hasVf ? ' filtered' : ''}" style="width:${col.w}px" data-c="${c}">
        <div class="hc-top" data-act="sort" title="${esc(col.name)} — ${tipHead}">
          <span class="tbadge">${typeGlyph(col.type)}</span>
          <span class="hc-name">${esc(col.name)}</span>${sortHtml}
          <button class="hc-btn" data-act="menu" title="${tipMenu}">${icon('chevron')}</button>
        </div>
        <div class="hc-filter${hasVf ? ' has-vf' : ''}">
          <span class="qf-icon">${icon('filter')}</span>
          <input class="qf${qv ? ' has' : ''}${S.quickErr.has(c) ? ' err' : ''}" data-c="${c}" value="${esc(qv)}" placeholder="${phFilter}" spellcheck="false" autocomplete="off"
            title="${tipFilter}">
          ${hasVf ? `<span class="vf-pill" data-act="menu">${vfLabel(c, true)}</span>` : ''}
        </div>
        <div class="rz"></div>
      </div>`;
    }
    $thead.innerHTML = h;
    if (focusC !== null) {
      const inp = $thead.querySelector(`.qf[data-c="${focusC}"]`);
      if (inp) { inp.focus({ preventScroll: true }); inp.setSelectionRange(selStart, selStart); }
    }
  }

  function markErrors() {
    $searchBox.classList.toggle('err', S.searchErr);
    for (const inp of $thead.querySelectorAll('.qf')) inp.classList.toggle('err', S.quickErr.has(+inp.dataset.c));
  }

  // ───────────────────────── Gövde (sanal) ─────────────────────────
  // rAF gizli/arka plandaki webview'da durabilir; zamanlayıcı yedeği çizimi garanti eder.
  let rafId = 0, rafT = 0;
  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(render);
    rafT = setTimeout(render, 80);
  }

  function makeHighlighter() {
    if (!S.search || S.searchErr) return null;
    if (S.sRegex) {
      let re;
      try { re = new RegExp(S.search, S.sCase ? 'g' : 'gi'); } catch { return null; }
      return (v) => {
        re.lastIndex = 0;
        let out = '', last = 0, m, guard = 0;
        while ((m = re.exec(v)) && guard++ < 100) {
          if (!m[0].length) { re.lastIndex++; continue; }
          out += esc(v.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
          last = m.index + m[0].length;
        }
        return last ? out + esc(v.slice(last)) : esc(v);
      };
    }
    const q = S.sCase ? S.search : fold(S.search), L = q.length;
    return (v) => {
      const hay = S.sCase ? v : fold(v);
      if (hay.length !== v.length) return esc(v);
      let i = hay.indexOf(q);
      if (i < 0) return esc(v);
      let out = '', last = 0;
      while (i >= 0) {
        out += esc(v.slice(last, i)) + '<mark>' + esc(v.slice(i, i + L)) + '</mark>';
        last = i + L;
        i = hay.indexOf(q, last);
      }
      return out + esc(v.slice(last));
    };
  }

  function render() {
    cancelAnimationFrame(rafId);
    clearTimeout(rafT);
    rafId = 0;
    const { view, xs, visCols, rowH, rnW, rows, cols } = S;
    const st = $vp.scrollTop, sl = $vp.scrollLeft, vh = $vp.clientHeight, vw = $vp.clientWidth;
    const r0 = Math.max(0, Math.floor(st / rowH) - OVER_R);
    const r1 = Math.min(view.length, Math.ceil((st + vh - S.headH) / rowH) + OVER_R);
    let k0 = 0, k1 = 0;
    if (visCols.length) {
      k0 = Math.max(0, upper(xs, sl) - 1 - OVER_C);
      k1 = Math.min(visCols.length, upper(xs, sl + vw - rnW) + OVER_C);
    }
    const padL = k1 > k0 ? xs[k0] : 0;
    const hl = makeHighlighter();
    const sel = selRect();
    const multi = sel && (sel.r0 !== sel.r1 || sel.k0 !== sel.k1);
    const parts = [];
    for (let i = r0; i < r1; i++) {
      const r = view[i], row = rows[r];
      const inRows = sel && i >= sel.r0 && i <= sel.r1;
      let h = `<div class="tr${i & 1 ? ' odd' : ''}${inRows ? ' rsel' : ''}" style="top:${i * rowH}px" data-i="${i}"><div class="rn" style="width:${rnW}px">${r + 1}</div><div class="pad" style="width:${padL}px"></div>`;
      for (let k = k0; k < k1; k++) {
        const c = visCols[k], col = cols[c];
        const v = row[c] ?? '';
        let cls = 'td c' + c;
        if (col.type === 'number') cls += ' num';
        if (inRows && k >= sel.k0 && k <= sel.k1) {
          if (multi) cls += ' sel';
          if (i === S.sel.fr && k === S.sel.fk) cls += ' focus';
        }
        if (S.edited.size && S.edited.has(r + ',' + c)) cls += ' edited';
        let content = '';
        if (v === '') cls += ' empty';
        else {
          const d = v.length > 400 ? v.slice(0, 400) + '…' : v;
          content = hl ? hl(d) : esc(d);
        }
        h += `<div class="${cls}" style="width:${col.w}px" data-k="${k}">${content}</div>`;
      }
      parts.push(h + '</div>');
    }
    $tbody.innerHTML = parts.join('');
  }

  // ───────────────────────── Seçim ─────────────────────────
  function selRect() {
    const s = S.sel;
    if (!s) return null;
    return { r0: Math.min(s.ar, s.fr), r1: Math.max(s.ar, s.fr), k0: Math.min(s.ak, s.fk), k1: Math.max(s.ak, s.fk) };
  }
  function clampSel() {
    const s = S.sel;
    if (!s) return;
    const R = S.view.length - 1, K = S.visCols.length - 1;
    if (R < 0 || K < 0) { S.sel = null; return; }
    s.ar = clamp(s.ar, 0, R); s.fr = clamp(s.fr, 0, R);
    s.ak = clamp(s.ak, 0, K); s.fk = clamp(s.fk, 0, K);
  }
  function setSel(ar, ak, fr, fk, scroll) {
    const s = S.sel;
    if (s && s.ar === ar && s.ak === ak && s.fr === fr && s.fk === fk) return;
    S.sel = { ar, ak, fr, fk };
    clampSel();
    if (!S.sel) return;
    if (scroll) ensureVisible(S.sel.fr, S.sel.fk);
    scheduleRender();
    renderStatus();
    if (S.drawer) renderDrawer();
  }
  function ensureVisible(i, k) {
    const top = i * S.rowH, bottom = top + S.rowH, vh = $vp.clientHeight - S.headH;
    if (top < $vp.scrollTop) $vp.scrollTop = top;
    else if (bottom > $vp.scrollTop + vh) $vp.scrollTop = bottom - vh;
    if (k === undefined || !S.visCols.length) return;
    const x = S.xs[k], w = S.cols[S.visCols[k]].w, vw = $vp.clientWidth - S.rnW;
    if (x < $vp.scrollLeft) $vp.scrollLeft = x;
    else if (x + w > $vp.scrollLeft + vw) $vp.scrollLeft = Math.min(x, x + w - vw);
  }

  const tsvQuote = (v) => (/[\t\n\r"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  function selectionText() {
    const r = selRect();
    if (!r) return null;
    if (r.r0 === r.r1 && r.k0 === r.k1) return S.rows[S.view[r.r0]][S.visCols[r.k0]] ?? '';
    const lines = [];
    for (let i = r.r0; i <= r.r1; i++) {
      const row = S.rows[S.view[i]], cells = [];
      for (let k = r.k0; k <= r.k1; k++) cells.push(tsvQuote(row[S.visCols[k]] ?? ''));
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }
  function copySelection() {
    const text = selectionText();
    if (text === null) return;
    const r = selRect(), n = (r.r1 - r.r0 + 1) * (r.k1 - r.k0 + 1);
    copyText(text, n > 1 ? t('{0} cells copied', nf.format(n)) : t('Cell copied'));
  }
  function copyText(text, msg) {
    vscode.postMessage({ type: 'copy', text });
    if (!inVsCode && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    toast(msg || t('Copied'));
  }

  // ───────────────────────── Düzenleme ─────────────────────────
  // Değişiklik önce yerel veride yapılır (anında görünür), sonra eklentiye gönderilir.
  // Eklenti yalnızca ilgili alanın metnini belgede değiştirir; VS Code geri al/kaydet/kirli durumu yönetir.
  const canEdit = () => S.editable && !S.encoding;
  let denyAt = 0;
  function denyEdit() {
    if (Date.now() - denyAt < 2500) return;
    denyAt = Date.now();
    toast(S.encoding ? t('Editing is disabled while a custom encoding is used') : t('This file is read-only'), true);
  }

  function measure(str) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = `${S.cfg.font === 'ui' ? 13 : 12.5}px ${fontFamily(S.cfg.font)}`;
    return mctx.measureText(str).width;
  }

  function startEdit(i, k, initial) {
    if (!canEdit()) { denyEdit(); return; }
    if (i < 0 || i >= S.view.length || k < 0 || k >= S.visCols.length) return;
    cancelEdit();
    drag = null;
    ensureVisible(i, k);
    const r = S.view[i], c = S.visCols[k], original = S.rows[r][c] ?? '';
    const el = document.createElement('textarea');
    el.className = 'cell-editor c' + c + (S.cols[c].type === 'number' ? ' num' : '');
    el.rows = 1;
    el.spellcheck = false;
    el.value = initial ?? original;
    el.style.left = S.rnW + S.xs[k] + 'px';
    el.style.top = S.headH + i * S.rowH + 'px';
    $canvas.appendChild(el);
    S.edit = { i, k, r, c, el, original };
    sizeEditor();
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
    el.addEventListener('input', sizeEditor);
    el.addEventListener('keydown', onEditorKey);
    el.addEventListener('blur', () => { if (S.edit && S.edit.el === el) commitEdit(); });
  }

  function sizeEditor() {
    const ed = S.edit;
    if (!ed) return;
    const el = ed.el, w = S.cols[ed.c].w;
    let text = 0;
    for (const line of el.value.split('\n')) text = Math.max(text, measure(line));
    el.style.width = Math.round(Math.min(Math.max(w, text + 32), Math.max(w, 640))) + 'px';
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(S.rowH, el.scrollHeight), 280) + 'px';
  }

  function onEditorKey(e) {
    const ed = S.edit;
    if (!ed) return;
    e.stopPropagation();
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      $vp.focus({ preventScroll: true });
    } else if (e.key === 'Enter' && (e.altKey || e.shiftKey)) {
      e.preventDefault();
      ed.el.setRangeText('\n', ed.el.selectionStart, ed.el.selectionEnd, 'end');
      sizeEditor();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const { i, k } = ed;
      commitEdit();
      $vp.focus({ preventScroll: true });
      const ni = e.key === 'Enter' ? clamp(i + 1, 0, S.view.length - 1) : i;
      const nk = e.key === 'Tab' ? clamp(k + (e.shiftKey ? -1 : 1), 0, S.visCols.length - 1) : k;
      setSel(ni, nk, ni, nk, true);
    } else if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  }

  function commitEdit() {
    const ed = S.edit;
    if (!ed) return;
    S.edit = null;
    const value = ed.el.value;
    ed.el.remove();
    if (value !== ed.original) commitEdits([{ r: ed.r, c: ed.c, value }]);
  }
  function cancelEdit() {
    const ed = S.edit;
    if (!ed) return;
    S.edit = null;
    ed.el.remove();
  }

  /** list: [{ r: veri satırı, c: sütun, value }] */
  function commitEdits(list) {
    if (!canEdit()) { denyEdit(); return 0; }
    const edits = [], touched = new Set(), head = S.hasHeader ? 1 : 0;
    for (const { r, c, value } of list) {
      const row = S.rows[r];
      if (!row || (row[c] ?? '') === value) continue;
      while (row.length < c) row.push('');
      row[c] = value;
      edits.push({ record: r + head, col: c, value });
      touched.add(c);
      S.edited.add(r + ',' + c);
    }
    if (!edits.length) return 0;
    for (const c of touched) {
      cache.keys.delete(c); cache.ranks.delete(c); cache.folded.delete(c); cache.distinct.delete(c);
    }
    cache.joined = null;
    S.textStale = true;
    S.dirty = true;
    if (S.sort.length || hasFilters()) S.viewStale = true;
    vscode.postMessage({ type: 'edit', delim: S.delim, edits });
    scheduleRender();
    renderStatus();
    renderChips();
    renderChrome();
    if (S.drawer) renderDrawer();
    return edits.length;
  }

  function clearSelectionCells() {
    const r = selRect();
    if (!r) return;
    if ((r.r1 - r.r0 + 1) * (r.k1 - r.k0 + 1) > 200000) { toast(t('Selection too large (max {0} cells)', nf.format(200000)), true); return; }
    const list = [];
    for (let i = r.r0; i <= r.r1; i++) for (let k = r.k0; k <= r.k1; k++) list.push({ r: S.view[i], c: S.visCols[k], value: '' });
    const n = commitEdits(list);
    if (n > 1) toast(t('{0} cells cleared', nf.format(n)));
  }

  function pasteGrid(text) {
    const r = selRect();
    if (!r) return;
    if (!canEdit()) { denyEdit(); return; }
    const grid = parseCSV(text.replace(/\r?\n$/, ''), '\t');
    if (!grid.length) return;
    const list = [], lastR = S.view.length - 1, lastK = S.visCols.length - 1;
    let endR = r.r0, endK = r.k0;
    if (grid.length === 1 && grid[0].length === 1) {
      // Tek değer: seçili tüm hücrelere yaz.
      for (let i = r.r0; i <= r.r1; i++) for (let k = r.k0; k <= r.k1; k++) list.push({ r: S.view[i], c: S.visCols[k], value: grid[0][0] });
      endR = r.r1; endK = r.k1;
    } else {
      for (let a = 0; a < grid.length && r.r0 + a <= lastR; a++) {
        for (let b = 0; b < grid[a].length && r.k0 + b <= lastK; b++) {
          list.push({ r: S.view[r.r0 + a], c: S.visCols[r.k0 + b], value: grid[a][b] });
          endR = Math.max(endR, r.r0 + a);
          endK = Math.max(endK, r.k0 + b);
        }
      }
    }
    const n = commitEdits(list);
    setSel(r.r0, r.k0, endR, endK);
    if (n) toast(tn(n, '{0} cell pasted', '{0} cells pasted'));
  }

  function save() {
    commitEdit();
    if (canEdit()) vscode.postMessage({ type: 'save' });
  }

  function startRename(c) {
    if (!canEdit()) { denyEdit(); return; }
    const hc = $thead.querySelector(`.hc[data-c="${c}"]`);
    if (!hc) return;
    commitEdit();
    const inp = document.createElement('input');
    inp.className = 'hc-rename';
    inp.value = S.headerRow[c] ?? '';
    inp.spellcheck = false;
    hc.appendChild(inp);
    inp.focus();
    inp.select();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      const v = inp.value;
      inp.remove();
      if (ok && v !== (S.headerRow[c] ?? '')) renameColumn(c, v);
    };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    inp.addEventListener('mousedown', (e) => e.stopPropagation());
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('blur', () => finish(true));
  }

  function renameColumn(c, value) {
    while (S.headerRow.length < c) S.headerRow.push('');
    S.headerRow[c] = value;
    S.cols[c].name = value.trim() || t('Column {0}', c + 1);
    S.textStale = true;
    S.dirty = true;
    vscode.postMessage({ type: 'edit', delim: S.delim, edits: [{ record: 0, col: c, value }] });
    buildHeader();
    renderChips();
    renderChrome();
    renderStatus();
    if (S.drawer) renderDrawer();
  }

  /** Sütunları yeniden sıralar. order[yeniKonum] = eskiSütun. */
  function moveColumns(order) {
    commitEdit();
    const n = S.ncols, inv = new Array(n);
    order.forEach((o, k) => { inv[o] = k; });
    const focusC = S.sel ? S.visCols[S.sel.fk] : -1;
    const rows = S.rows;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r], out = new Array(n);
      for (let k = 0; k < n; k++) out[k] = row[order[k]] ?? '';
      rows[r] = out;
    }
    if (S.hasHeader) S.headerRow = order.map((o) => S.headerRow[o] ?? '');
    S.cols = order.map((o) => S.cols[o]);
    remapState(inv);
    clearCaches();
    updateColorStyles();
    computeLayout();
    buildHeader();
    if (S.sel && focusC >= 0) {
      const k = S.visCols.indexOf(inv[focusC]);
      S.sel = { ar: S.sel.fr, ak: k, fr: S.sel.fr, fk: k };
      clampSel();
    }
    scheduleRender();
    renderChips();
    renderStatus();
    if (S.drawer) renderDrawer();
    saveState();
    if (canEdit()) {
      S.textStale = true;
      S.dirty = true;
      vscode.postMessage({ type: 'reorder', delim: S.delim, order });
      renderChrome();
    } else {
      toast(t('Read-only: column order changed in this view only'));
    }
  }

  // Sütun sürükle-bırak
  let colDrag = null, suppressClick = false;
  function onColDragMove(e) {
    const d = colDrag;
    if (!d.active) {
      if (Math.abs(e.clientX - d.x0) < 5 && Math.abs(e.clientY - d.y0) < 5) return;
      d.active = true;
      closePop();
      commitEdit();
      const rect = d.hc.getBoundingClientRect();
      d.dx = d.x0 - rect.left;
      d.ghost = d.hc.cloneNode(true);
      d.ghost.classList.add('hc-ghost');
      Object.assign(d.ghost.style, { width: rect.width + 'px', height: rect.height + 'px', top: rect.top + 'px' });
      d.ind = document.createElement('div');
      d.ind.className = 'drop-ind';
      document.body.append(d.ghost, d.ind);
      $dragStyle.textContent = `.td.c${d.c},.thead .hc.c${d.c}{opacity:.3}`;
      document.body.classList.add('col-dragging');
      d.timer = setInterval(autoScrollDrag, 16);
    }
    d.lastX = e.clientX;
    d.ghost.style.left = e.clientX - d.dx + 'px';
    updateDrop();
  }
  function updateDrop() {
    const d = colDrag, vr = $vp.getBoundingClientRect();
    const x = d.lastX - vr.left + $vp.scrollLeft - S.rnW;
    let slot = S.visCols.length;
    for (let k = 0; k < S.visCols.length; k++) {
      if (x < S.xs[k] + S.cols[S.visCols[k]].w / 2) { slot = k; break; }
    }
    d.slot = slot;
    const from = S.visCols.indexOf(d.c);
    const lineX = vr.left + S.rnW - $vp.scrollLeft + (slot < S.visCols.length ? S.xs[slot] : S.dataW);
    d.ind.style.left = clamp(lineX, vr.left + S.rnW, vr.right - 3) - 1.5 + 'px';
    d.ind.style.top = vr.top + 'px';
    d.ind.style.height = Math.min(vr.height, S.headH + S.view.length * S.rowH) + 'px';
    d.ind.classList.toggle('noop', slot === from || slot === from + 1);
  }
  function autoScrollDrag() {
    const d = colDrag;
    if (!d || !d.active) return;
    const vr = $vp.getBoundingClientRect(), edge = 56, left = vr.left + S.rnW;
    let dx = 0;
    if (d.lastX < left + edge) dx = -Math.ceil((left + edge - d.lastX) / 3);
    else if (d.lastX > vr.right - edge) dx = Math.ceil((d.lastX - (vr.right - edge)) / 3);
    if (dx) {
      $vp.scrollLeft += dx;
      updateDrop();
    }
  }
  function endColDrag() {
    const d = colDrag;
    colDrag = null;
    if (!d.active) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    clearInterval(d.timer);
    d.ghost.remove();
    d.ind.remove();
    $dragStyle.textContent = '';
    document.body.classList.remove('col-dragging');
    const from = S.visCols.indexOf(d.c);
    if (d.slot === from || d.slot === from + 1) return;
    const order = [];
    for (let c = 0; c < S.ncols; c++) if (c !== d.c) order.push(c);
    const at = d.slot < S.visCols.length
      ? order.indexOf(S.visCols[d.slot])
      : order.indexOf(S.visCols[S.visCols.length - 1]) + 1;
    order.splice(at, 0, d.c);
    moveColumns(order);
  }

  // ───────────────────────── Durum çubuğu, çipler, boş durum ─────────────────────────
  const DOT = '<span class="ds">•</span>';
  function aggregate(r) {
    if ((r.r1 - r.r0 + 1) * (r.k1 - r.k0 + 1) > 500000) return null;
    let filled = 0, cnt = 0, sum = 0, min = Infinity, max = -Infinity;
    for (let k = r.k0; k <= r.k1; k++) {
      const c = S.visCols[k], K = S.cols[c].type === 'number' ? keys(c) : null;
      for (let i = r.r0; i <= r.r1; i++) {
        const row = S.view[i], v = S.rows[row][c];
        if (!v || !v.trim()) continue;
        filled++;
        if (K) {
          const x = K[row];
          if (x === x) { cnt++; sum += x; if (x < min) min = x; if (x > max) max = x; }
        }
      }
    }
    return { filled, cnt, sum, min, max };
  }

  function renderStatus() {
    const total = S.rows.length, shown = S.view.length;
    const dl = DELIMS.find((d) => d.v === S.delim);
    const b = (v) => `<b>${v}</b>`;
    let l = shown !== total
      ? `<span>${t(total === 1 ? '{0} / {1} row' : '{0} / {1} rows', b(nf.format(shown)), nf.format(total))}</span>`
      : `<span>${t(total === 1 ? '{0} row' : '{0} rows', b(nf.format(total)))}</span>`;
    const nv = S.visCols.length;
    l += DOT + `<span>${nv !== S.ncols
      ? t('{0} / {1} columns', b(nv), S.ncols)
      : t(nv === 1 ? '{0} column' : '{0} columns', b(nv))}</span>`;
    l += DOT + `<span>${dl ? dl.label : t('Custom delimiter')}</span>`;
    l += DOT + (S.encoding
      ? `<span class="enc" data-act="enc-reset" title="${t('Reload as UTF-8')}">${esc(S.encoding)}</span>`
      : '<span>UTF-8</span>');
    $stL.innerHTML = l;

    const r = selRect();
    let rr;
    if (!r) {
      rr = `<span class="hint">${canEdit()
        ? t('Double-click / Enter: edit · Drag header: move · Space: row details · Shift+click: multi-sort')
        : t('Shift+click: multi-sort · Space: row details · Ctrl+F: search')}</span>`;
    } else if (r.r0 === r.r1 && r.k0 === r.k1) {
      const c = S.visCols[r.k0];
      rr = `<span>${t('Row {0}', b(nf.format(S.view[r.r0] + 1)))}</span>${DOT}<span class="st-col c${c}"><i class="dot"></i>${esc(S.cols[c].name)}</span>`;
    } else {
      rr = `<span>${t('{0} × {1} cells', b(nf.format(r.r1 - r.r0 + 1)), b(nf.format(r.k1 - r.k0 + 1)))}</span>`;
      const a = aggregate(r);
      if (a) {
        rr += DOT + `<span>${t('Filled {0}', b(nf.format(a.filled)))}</span>`;
        if (a.cnt) {
          rr += DOT + `<span>${t('Sum {0}', b(fmtNum(a.sum)))}</span>` + DOT + `<span>${t('Avg {0}', b(fmtNum(a.sum / a.cnt)))}</span>`;
          rr += DOT + `<span>${t('Min {0}', b(fmtNum(a.min)))}</span>` + DOT + `<span>${t('Max {0}', b(fmtNum(a.max)))}</span>`;
        }
      }
    }
    $stR.innerHTML = rr;
  }

  function renderChips() {
    const chip = (c, label, act, arg) =>
      `<span class="chip${c !== null ? ' c' + c : ''}"><i class="dot"></i><span class="lbl">${label}</span><button data-act="${act}" data-c="${arg ?? ''}" title="${t('Remove')}">${icon('x')}</button></span>`;
    let h = '';
    if (S.viewStale) {
      h += `<button class="chip stale" data-act="reapply" title="${t('Re-sort and re-filter the edited rows')}">${icon('refresh')}${t('Reapply filters and sorting')}</button>`;
    }
    if (S.search) h += chip(null, `<b>${t('Search:')}</b> ${esc(trunc(S.search, 40))}`, 'x-search');
    for (const k in S.quick) h += chip(+k, `<b>${esc(S.cols[k].name)}:</b> ${esc(trunc(S.quick[k], 40))}`, 'x-quick', k);
    for (const k in S.vf) h += chip(+k, `<b>${esc(S.cols[k].name)}:</b> ${vfLabel(+k)}`, 'x-vf', k);
    if (S.sort.length) {
      const list = S.sort.map((s) => esc(S.cols[s.col].name) + (s.dir > 0 ? ' ↑' : ' ↓')).join(', ');
      h += chip(null, `<b>${t('Sort:')}</b> ${list}`, 'x-sort');
    }
    if (hasFilters() || S.sort.length) h += `<button class="link" data-act="x-all">${t('Clear all')}</button>`;
    $chips.innerHTML = h;
    $chips.classList.toggle('show', !!h);
    scheduleRender();
  }

  function renderEmpty() {
    let h = '';
    if (!S.rows.length) {
      h = `<div class="empty-card"><div class="empty-ico">${icon('table')}</div><div class="big">${t('No data to show')}</div><div>${t('The file is empty or contains only a header row.')}</div></div>`;
    } else if (!S.view.length) {
      h = `<div class="empty-card"><div class="empty-ico">${icon('filter')}</div><div class="big">${t('No matching rows')}</div><div>${t('Try loosening the filters or changing the search.')}</div><button class="btn" data-act="x-filters">${t('Clear filters')}</button></div>`;
    }
    $empty.innerHTML = h;
    $empty.classList.toggle('show', !!h);
  }

  function renderSearchMeta() {
    $('searchCount').textContent = S.search && !S.searchErr ? tn(S.view.length, '{0} row', '{0} rows') : '';
    $('searchClear').hidden = !S.search;
    markErrors();
  }

  function renderChrome() {
    $('fname').textContent = S.fileName || 'CSV';
    $('fname').title = S.fileName + (S.dirty ? ' — ' + t('unsaved changes') : '');
    $('fname').classList.toggle('dirty', S.dirty);
    const ro = !canEdit();
    $('roPill').hidden = !ro;
    $('btnUndo').hidden = $('btnRedo').hidden = $('btnSave').hidden = ro;
    const sb = $('btnSave');
    sb.disabled = !S.dirty;
    sb.classList.toggle('dirty', S.dirty);
    sb.innerHTML = S.dirty ? `${icon('save')}<span>${t('Save')}</span>` : `${icon('check')}<span>${t('Saved')}</span>`;
    $('fsub').textContent = `${tn(S.rows.length, '{0} row', '{0} rows')} · ${tn(S.ncols, '{0} column', '{0} columns')}`;
    const dl = DELIMS.find((d) => d.v === S.delim);
    $('btnDelim').innerHTML = `<kbd>${dl ? esc(dl.sym) : esc(S.delim)}</kbd><span>${dl ? dl.label : t('Custom')}</span>${S.delimMode === 'auto' ? `<span class="muted">· ${t('auto')}</span>` : ''}${icon('chevron')}`;
    $('btnHeader').classList.toggle('on', S.hasHeader);
    const badge = $('colsBadge');
    badge.hidden = !S.hidden.size;
    badge.textContent = S.hidden.size;
    $('btnDetail').classList.toggle('on', S.drawer);
    $('tgCase').classList.toggle('on', S.sCase);
    $('tgRegex').classList.toggle('on', S.sRegex);
    $gridWrap.classList.toggle('drawer-open', S.drawer);
    renderSearchMeta();
  }

  function checkEncoding() {
    const bad = !S.encoding && !S.bannerOff && S.text.indexOf('�') >= 0;
    $banner.classList.toggle('show', bad);
    if (bad) {
      // Dile göre en olası kodlama öne çıkar; diğerleri menüden seçilir.
      const guess = LOCALE.startsWith('tr') ? 'windows-1254' : 'windows-1252';
      $banner.innerHTML = `${icon('alert')}<span>${t('Some characters look broken. The file may not be UTF-8.')}</span>
        <button class="btn sm" data-act="enc" data-enc="${guess}">${t('Read as {0}', encLabel(guess))}</button>
        <button class="btn sm secondary" data-act="enc-menu">${t('Other encoding…')}</button>
        <span class="grow"></span><button class="ib sm" data-act="banner-x" title="${t('Close')}">${icon('x')}</button>`;
    }
  }
  function encLabel(enc) {
    const e = ENCODINGS.find(([v]) => v === enc);
    return e ? `${t(e[1])} (${enc.toUpperCase()})` : enc;
  }
  function openEncodingMenu(btn) {
    if (popAnchor === btn) { closePop(); return; }
    const items = ENCODINGS.map(([v]) => `<button class="mi" data-enc="${v}">${encLabel(v)}</button>`).join('');
    const el = openPop(btn, `<div class="pm-head"><span class="pm-title">${t('Read with encoding')}</span></div>${items}`, 'wide', 'left');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-enc]');
      if (!b) return;
      closePop();
      vscode.postMessage({ type: 'reload', encoding: b.dataset.enc });
    });
  }

  // ───────────────────────── Satır detayı ─────────────────────────
  function fmtValue(v) {
    const t = v.trim();
    if ((t[0] === '{' && t.endsWith('}')) || (t[0] === '[' && t.endsWith(']'))) {
      try { return `<pre>${esc(JSON.stringify(JSON.parse(t), null, 2))}</pre>`; } catch { /* JSON değil */ }
    }
    return esc(v);
  }
  function toggleDrawer(force) {
    S.drawer = force ?? !S.drawer;
    if (S.drawer && !S.sel && S.view.length && S.visCols.length) S.sel = { ar: 0, ak: 0, fr: 0, fk: 0 };
    renderDrawer();
    renderChrome();
    scheduleRender();
    saveState();
    if (S.drawer && S.sel) setTimeout(() => ensureVisible(S.sel.fr, S.sel.fk), 240);
  }
  function renderDrawer() {
    $drawer.classList.toggle('open', S.drawer);
    if (!S.drawer) return;
    const i = S.sel ? S.sel.fr : -1, r = S.view[i];
    const close = `<button class="ib sm" data-act="dr-close" title="${t('Close (Esc)')}">${icon('x')}</button>`;
    if (r === undefined) {
      $drawer.innerHTML = `<div class="dr-head"><div class="dr-title">${t('Row details')}</div>${close}</div><div class="dr-empty">${t('Select a row')}</div>`;
      return;
    }
    const body = $drawer.querySelector('.dr-body');
    const scroll = body ? body.scrollTop : 0;
    const row = S.rows[r], curC = S.visCols[S.sel.fk];
    const tipCopy = t('Copy value'), emptyLabel = t('empty');
    let h = `<div class="dr-head"><div class="dr-title">${t('Row {0}', nf.format(r + 1))}<span class="muted">${nf.format(i + 1)} / ${nf.format(S.view.length)}</span></div>
      <button class="ib sm" data-act="dr-prev" title="${t('Previous row (↑)')}">${icon('arrowUp')}</button>
      <button class="ib sm" data-act="dr-next" title="${t('Next row (↓)')}">${icon('arrowDown')}</button>
      <button class="ib sm" data-act="dr-json" title="${t('Copy row as JSON')}">${icon('copy')}</button>${close}</div><div class="dr-body">`;
    for (let c = 0; c < S.ncols; c++) {
      const col = S.cols[c], v = row[c] ?? '';
      h += `<div class="kv c${c}${S.hidden.has(c) ? ' hid' : ''}${c === curC ? ' cur' : ''}" data-c="${c}">
        <div class="kv-k"><i class="dot"></i><span class="name">${esc(col.name)}</span><span class="tbadge">${typeGlyph(col.type)}</span>
        <button class="ib xs cp" data-act="dr-copy" data-c="${c}" title="${tipCopy}">${icon('copy')}</button></div>
        <div class="kv-v${v === '' ? ' empty' : ''}">${v === '' ? emptyLabel : fmtValue(v)}</div></div>`;
    }
    $drawer.innerHTML = h + '</div>';
    $drawer.querySelector('.dr-body').scrollTop = scroll;
  }

  // ───────────────────────── Açılır menüler ─────────────────────────
  let pop = null, popAnchor = null;
  function openPop(anchor, html, cls, align) {
    closePop();
    const el = document.createElement('div');
    el.className = 'pop ' + (cls || '');
    el.innerHTML = html;
    document.body.appendChild(el);
    const ar = anchor.getBoundingClientRect(), pr = el.getBoundingClientRect();
    let left = align === 'right' ? ar.right - pr.width : ar.left;
    left = clamp(left, 8, window.innerWidth - pr.width - 8);
    let top = ar.bottom + 6;
    if (top + pr.height > window.innerHeight - 8) top = Math.max(8, Math.min(ar.top - pr.height - 6, window.innerHeight - pr.height - 8));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    pop = el;
    popAnchor = anchor;
    anchor.classList.add('open');
    return el;
  }
  function closePop() {
    if (!pop) return false;
    pop.remove();
    if (popAnchor) popAnchor.classList.remove('open');
    pop = popAnchor = null;
    return true;
  }
  document.addEventListener('mousedown', (e) => {
    if (pop && !pop.contains(e.target) && !(popAnchor && popAnchor.contains(e.target))) closePop();
  }, true);

  function colStats(c) {
    const col = S.cols[c], rows = S.rows, view = S.view;
    const K = col.type === 'number' || col.type === 'date' ? keys(c) : null;
    let filled = 0, cnt = 0, sum = 0, min = Infinity, max = -Infinity, capped = false;
    const uniq = new Set();
    for (let i = 0; i < view.length; i++) {
      const r = view[i], v = rows[r][c];
      if (!v || !v.trim()) continue;
      filled++;
      if (!capped) { uniq.add(v); if (uniq.size >= 200000) capped = true; }
      if (K) {
        const x = K[r];
        if (x === x) { cnt++; sum += x; if (x < min) min = x; if (x > max) max = x; }
      }
    }
    return { filled, empty: view.length - filled, uniq: uniq.size, capped, cnt, sum, min, max };
  }

  function statsHtml(c) {
    const col = S.cols[c], st = colStats(c);
    const items = [[t('Filled'), nf.format(st.filled)], [t('Empty'), nf.format(st.empty)], [t('Distinct'), (st.capped ? '≥' : '') + nf.format(st.uniq)]];
    if (col.type === 'number' && st.cnt) {
      items.push([t('Sum'), fmtNum(st.sum)], [t('Min'), fmtNum(st.min)], [t('Max'), fmtNum(st.max)], [t('Average'), fmtNum(st.sum / st.cnt)]);
    }
    if (col.type === 'date' && st.cnt) items.push([t('Earliest'), fmtDate(st.min)], [t('Latest'), fmtDate(st.max)]);
    let h = `<div class="pm-label">${t('Statistics')}<span class="muted">${S.view.length === S.rows.length ? t('all rows') : t('filtered rows')}</span></div>`;
    h += `<div class="stat-grid">${items.map(([k, v]) => `<div class="sk">${k}</div><div class="sv" title="${v}">${v}</div>`).join('')}</div>`;
    if ((col.type === 'number' || col.type === 'date') && st.cnt > 1 && st.max > st.min) {
      const K = keys(c), B = 36, bins = new Array(B).fill(0), span = st.max - st.min;
      for (const r of S.view) { const x = K[r]; if (x === x) bins[Math.min(B - 1, Math.floor(((x - st.min) / span) * B))]++; }
      const top = Math.max(...bins), bw = 288 / B;
      let rects = '';
      bins.forEach((b, i) => {
        if (!b) return;
        const hh = Math.max(2, (b / top) * 38);
        rects += `<rect x="${(i * bw + 0.8).toFixed(2)}" y="${(40 - hh).toFixed(2)}" width="${(bw - 1.6).toFixed(2)}" height="${hh.toFixed(2)}" rx="1.5"/>`;
      });
      const f = col.type === 'date' ? fmtDate : fmtNum;
      h += `<svg class="hist" viewBox="0 0 288 40" preserveAspectRatio="none">${rects}</svg><div class="hist-axis"><span>${f(st.min)}</span><span>${f(st.max)}</span></div>`;
    }
    return h;
  }

  function openColMenu(c, anchor) {
    if (popAnchor === anchor) { closePop(); return; }
    const col = S.cols[c];
    const cur = S.sort.find((s) => s.col === c);
    const dir = cur ? cur.dir : 0;
    const D = distinct(c), maxN = D.length ? D[0][1] : 1;
    const typeBtn = (ty) => {
      const on = ty === 'auto' ? !S.types[c] : S.types[c] === ty;
      return `<button data-act="type" data-t="${ty}" class="${on ? 'on' : ''}">${ty === 'auto' ? t('Auto · {0}', TYPES[col.auto]) : TYPES[ty]}</button>`;
    };
    const el = openPop(anchor, `
      <div class="pm-head c${c}"><i class="dot"></i><span class="pm-title" title="${esc(col.name)}">${esc(col.name)}</span><span class="pm-sub">${t('Column {0}', letter(c))}</span></div>
      <div class="pm-sec"><div class="seg">
        <button data-act="sort" data-d="1" class="${dir === 1 ? 'on' : ''}">${icon('sortAsc')}${t('Ascending')}</button>
        <button data-act="sort" data-d="-1" class="${dir === -1 ? 'on' : ''}">${icon('sortDesc')}${t('Descending')}</button>
        <button data-act="sort" data-d="0" class="narrow" title="${t('Remove sort')}"${dir ? '' : ' disabled'}>${icon('x')}</button>
      </div></div>
      <div class="pm-sec"><div class="pm-label">${t('Data type')}</div><div class="seg sm">${['auto', 'text', 'number', 'date'].map(typeBtn).join('')}</div></div>
      <div class="pm-sec c${c}">
        <div class="pm-label">${t('Values')}<span class="muted">${t('{0} distinct', nf.format(D.length))}</span><span class="grow"></span>
          <button class="link" data-act="vf-all">${t('All')}</button><button class="link" data-act="vf-none">${t('None')}</button></div>
        <div class="vf-search">${icon('search')}<input placeholder="${t('Search values…')}" spellcheck="false"></div>
        <div class="vf-list"></div>
      </div>
      <div class="pm-sec c${c} stats">${statsHtml(c)}</div>
      <div class="pm-sec">
        ${S.hasHeader && canEdit() ? `<button class="mi" data-act="rename">${icon('pencil')}${t('Rename')}</button>` : ''}
        <button class="mi" data-act="hide">${icon('eyeOff')}${t('Hide column')}</button>
        <button class="mi" data-act="copycol">${icon('copy')}${t('Copy values')}<span class="hint">${tn(S.view.length, '{0} row', '{0} rows')}</span></button>
        <button class="mi" data-act="fit">${icon('fit')}${t('Fit width to content')}</button>
      </div>`, 'colmenu', 'left');

    const list = el.querySelector('.vf-list'), inp = el.querySelector('.vf-search input');
    const emptyLabel = t('(empty)'), onlyLabel = t('only');
    let matched = [];
    const draw = () => {
      const q = fold(inp.value.trim()), f = S.vf[c];
      matched = [];
      let out = '';
      for (let i = 0; i < D.length; i++) {
        const v = D[i][0];
        if (q && !fold(v).includes(q)) continue;
        matched.push(i);
        if (matched.length > MAX_LIST) continue;
        const on = !f || (f.mode === 'in' ? f.set.has(v) : !f.set.has(v));
        out += `<label class="vf-item" data-i="${i}"><span class="vf-bar" style="width:${((D[i][1] / maxN) * 100).toFixed(1)}%"></span>
          <input type="checkbox"${on ? ' checked' : ''}><span class="vf-text${v === '' ? ' empty' : ''}">${v === '' ? emptyLabel : esc(trunc(v, 120))}</span>
          <span class="vf-n">${nf.format(D[i][1])}</span><button class="vf-only" data-act="only">${onlyLabel}</button></label>`;
      }
      if (matched.length > MAX_LIST) out += `<div class="vf-more">${t('+{0} more values · narrow down with search', nf.format(matched.length - MAX_LIST))}</div>`;
      list.innerHTML = out || `<div class="vf-more">${t('No matching values')}</div>`;
    };
    const commit = () => {
      draw();
      buildHeader();
      filterNow();
      el.querySelector('.stats').innerHTML = statsHtml(c);
    };
    draw();
    inp.addEventListener('input', draw);
    list.addEventListener('change', (e) => {
      const item = e.target.closest('.vf-item');
      if (!item) return;
      setValue(c, D[+item.dataset.i][0], e.target.checked, D.length);
      commit();
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'only') {
        e.preventDefault();
        S.vf[c] = { mode: 'in', set: new Set([D[+b.closest('.vf-item').dataset.i][0]]) };
        commit();
      } else if (act === 'vf-all' || act === 'vf-none') {
        const want = act === 'vf-all';
        if (!inp.value.trim()) {
          if (want) delete S.vf[c]; else S.vf[c] = { mode: 'in', set: new Set() };
        } else for (const i of matched) setValue(c, D[i][0], want, D.length);
        commit();
      } else if (act === 'sort') {
        const d = +b.dataset.d;
        S.sort = d ? [{ col: c, dir: d }] : S.sort.filter((s) => s.col !== c);
        closePop();
        sortChanged();
      } else if (act === 'type') {
        const t = b.dataset.t;
        if (t === 'auto') delete S.types[c]; else S.types[c] = t;
        col.type = S.types[c] || col.auto;
        cache.keys.delete(c);
        cache.ranks.delete(c);
        closePop();
        buildHeader();
        filterNow();
      } else if (act === 'rename') {
        closePop();
        startRename(c);
      } else if (act === 'hide') {
        S.hidden.add(c);
        closePop();
        columnsChanged();
      } else if (act === 'copycol') {
        const vals = S.view.map((r) => S.rows[r][c] ?? '');
        copyText(vals.join('\n'), tn(vals.length, '{0} value copied', '{0} values copied'));
        closePop();
      } else if (act === 'fit') {
        delete S.widths[c];
        col.w = fitWidth(c);
        closePop();
        columnsChanged();
      }
    });
  }

  function columnsChanged() {
    computeLayout();
    buildHeader();
    clampSel();
    if (S.search) apply(); else { scheduleRender(); renderStatus(); }
    renderChrome();
    if (S.drawer) renderDrawer();
    saveState();
  }

  function openColsMenu(btn) {
    if (popAnchor === btn) { closePop(); return; }
    const el = openPop(btn, `
      <div class="pm-head"><span class="pm-title">${t('Columns')}</span><span class="pm-sub"></span></div>
      <div class="vf-search">${icon('search')}<input placeholder="${t('Search columns…')}" spellcheck="false"></div>
      <div class="col-list"></div>
      <div class="pm-foot"><button class="link" data-act="showall">${t('Show all')}</button><button class="link" data-act="resetw">${t('Reset widths')}</button></div>`,
      'wide', 'right');
    const list = el.querySelector('.col-list'), inp = el.querySelector('input'), sub = el.querySelector('.pm-sub');
    const tipGo = t('Go to column');
    const draw = () => {
      const q = fold(inp.value.trim());
      let out = '';
      for (let c = 0; c < S.ncols; c++) {
        const col = S.cols[c], off = S.hidden.has(c);
        if (q && !fold(col.name).includes(q)) continue;
        out += `<label class="col-item c${c}${off ? ' off' : ''}"><input type="checkbox" data-c="${c}"${off ? '' : ' checked'}><i class="dot"></i>
          <span class="ci-name">${esc(col.name)}</span><span class="tbadge">${typeGlyph(col.type)}</span>
          <button class="ib xs ci-go" data-act="goto" data-c="${c}" title="${tipGo}">${icon('arrowRight')}</button></label>`;
      }
      list.innerHTML = out || `<div class="vf-more">${t('No matching columns')}</div>`;
      sub.textContent = t('{0} / {1} visible', S.visCols.length, S.ncols);
    };
    draw();
    setTimeout(() => inp.focus(), 0);
    inp.addEventListener('input', draw);
    list.addEventListener('change', (e) => {
      const c = +e.target.dataset.c;
      if (e.target.checked) S.hidden.delete(c); else S.hidden.add(c);
      columnsChanged();
      draw();
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.act === 'goto') {
        const c = +b.dataset.c;
        S.hidden.delete(c);
        columnsChanged();
        closePop();
        const k = S.visCols.indexOf(c);
        $vp.scrollLeft = Math.max(0, S.xs[k] - 24);
        if (S.view.length) setSel(S.sel ? S.sel.fr : 0, k, S.sel ? S.sel.fr : 0, k, true);
      } else if (b.dataset.act === 'showall') {
        S.hidden.clear();
        columnsChanged();
        draw();
      } else if (b.dataset.act === 'resetw') {
        S.widths = {};
        for (let c = 0; c < S.ncols; c++) S.cols[c].w = fitWidth(c);
        columnsChanged();
      }
    });
  }

  function openDelimMenu(btn) {
    if (popAnchor === btn) { closePop(); return; }
    const det = DELIMS.find((d) => d.v === S.detected);
    const check = (on) => (on ? icon('check', 'check') : '');
    let h = `<div class="pm-head"><span class="pm-title">${t('Delimiter')}</span></div>`;
    h += `<button class="mi" data-v="auto">${icon('wand')}${t('Auto-detect')}<span class="hint">${det ? det.label : ''}</span>${check(S.delimMode === 'auto')}</button><div class="pm-sep"></div>`;
    for (const d of DELIMS) {
      h += `<button class="mi" data-v="${d.v === '\t' ? 'tab' : esc(d.v)}"><kbd>${esc(d.sym)}</kbd>${d.label}${check(S.delimMode === d.v)}</button>`;
    }
    const el = openPop(btn, h, 'wide', 'right');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      const v = b.dataset.v === 'tab' ? '\t' : b.dataset.v;
      closePop();
      if (v === S.delimMode) return;
      S.delimMode = v;
      resetColumnState();
      reloadText(false);
      saveState();
    });
  }

  function openViewMenu(btn) {
    if (popAnchor === btn) { closePop(); return; }
    const seg = (key, opts) =>
      `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${S.cfg[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const el = openPop(btn, `
      <div class="pm-head"><span class="pm-title">${t('View')}</span></div>
      <div class="pm-sec"><div class="pm-label">${t('Column colors')}</div>${seg('colorMode', [['text', t('Text')], ['background', t('Background')], ['off', t('Off')]])}</div>
      <div class="pm-sec"><div class="pm-label">${t('Row height')}</div>${seg('density', [['comfortable', t('Comfortable')], ['compact', t('Compact')]])}</div>
      <div class="pm-sec"><div class="pm-label">${t('Cell font')}</div>${seg('font', [['mono', t('Editor (mono)')], ['ui', t('Interface')]])}</div>`,
      'wide', 'right');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      const key = b.parentNode.dataset.key, value = b.dataset.v;
      for (const x of b.parentNode.children) x.classList.toggle('on', x === b);
      setCfg({ [key]: value });
      vscode.postMessage({ type: 'setConfig', key, value });
    });
  }

  function serialize(fmt) {
    const cols = S.visCols, rows = S.rows, view = S.view;
    if (fmt === 'json') {
      const names = cols.map((c) => S.cols[c].name);
      return JSON.stringify(view.map((r) => {
        const o = {};
        for (let k = 0; k < cols.length; k++) o[names[k]] = rows[r][cols[k]] ?? '';
        return o;
      }), null, 2);
    }
    if (fmt === 'md') {
      const cell = (v) => v.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
      const lines = [
        '| ' + cols.map((c) => cell(S.cols[c].name)).join(' | ') + ' |',
        '| ' + cols.map((c) => (S.cols[c].type === 'number' ? '---:' : '---')).join(' | ') + ' |',
      ];
      for (const r of view) lines.push('| ' + cols.map((c) => cell(rows[r][c] ?? '')).join(' | ') + ' |');
      return lines.join('\n');
    }
    const d = fmt === 'tsv' ? '\t' : fmt === 'csv' ? ',' : S.delim;
    const eol = fmt === 'file' ? S.eol : '\n';
    const q = (v) => (v.indexOf(d) >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0 || v.indexOf('\r') >= 0 ? '"' + v.replace(/"/g, '""') + '"' : v);
    const out = [];
    if (S.hasHeader) out.push(cols.map((c) => q(S.headerRow[c] ?? '')).join(d));
    for (const r of view) {
      const row = rows[r];
      let line = '';
      for (let k = 0; k < cols.length; k++) { if (k) line += d; line += q(row[cols[k]] ?? ''); }
      out.push(line);
    }
    return out.join(eol) + (fmt === 'file' ? eol : '');
  }

  function openExportMenu(btn) {
    if (popAnchor === btn) { closePop(); return; }
    const dl = DELIMS.find((d) => d.v === S.delim);
    const el = openPop(btn, `
      <div class="pm-head"><span class="pm-title">${t('Export')}</span><span class="pm-sub">${tn(S.view.length, '{0} row', '{0} rows')} × ${tn(S.visCols.length, '{0} column', '{0} columns')}</span></div>
      <button class="mi" data-f="file">${icon('file')}${t('Save to file…')}<span class="hint">${dl ? dl.label : ''}</span></button>
      <div class="pm-sep"></div>
      <div class="pm-label" style="margin:6px 8px">${t('Copy to clipboard')}</div>
      <button class="mi" data-f="tsv">${icon('clipboard')}TSV<span class="hint">${t('paste into Excel / Sheets')}</span></button>
      <button class="mi" data-f="csv">${icon('clipboard')}CSV</button>
      <button class="mi" data-f="md">${icon('clipboard')}${t('Markdown table')}</button>
      <button class="mi" data-f="json">${icon('clipboard')}JSON</button>
      <div class="pm-note">${t('Only filtered rows and visible columns are exported, in the current sort order.')}</div>`,
      'wide', 'right');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      const f = b.dataset.f;
      closePop();
      if (f === 'file') {
        vscode.postMessage({ type: 'export', text: (S.bom ? '﻿' : '') + serialize('file'), rows: S.view.length });
      } else {
        const label = { tsv: 'TSV', csv: 'CSV', md: 'Markdown', json: 'JSON' }[f];
        copyText(serialize(f), t(S.view.length === 1 ? '{0} row copied as {1}' : '{0} rows copied as {1}', nf.format(S.view.length), label));
      }
    });
  }

  // ───────────────────────── Ayarlar ─────────────────────────
  function setCfg(partial, initial) {
    const prevFont = S.cfg.font;
    for (const k in partial || {}) if (CFG_VALUES[k] && CFG_VALUES[k].includes(partial[k])) S.cfg[k] = partial[k];
    const root = document.documentElement;
    root.dataset.color = S.cfg.colorMode;
    root.dataset.density = S.cfg.density;
    root.dataset.font = S.cfg.font;
    if (initial || !S.ncols) return;
    if (prevFont !== S.cfg.font) for (let c = 0; c < S.ncols; c++) if (!S.widths[c]) S.cols[c].w = fitWidth(c);
    computeLayout();
    buildHeader();
    scheduleRender();
  }

  function toast(msg, isErr) {
    const t = document.createElement('div');
    t.className = 'toast' + (isErr ? ' err' : '');
    t.innerHTML = icon(isErr ? 'alert' : 'check') + esc(msg);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 1800);
  }

  // ───────────────────────── Olaylar ─────────────────────────
  $vp.addEventListener('scroll', () => { scheduleRender(); closePop(); saveState(); }, { passive: true });
  new ResizeObserver(() => scheduleRender()).observe($vp);
  new MutationObserver(updateColorStyles).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  $thead.addEventListener('click', (e) => {
    if (suppressClick) return;
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'selall') {
      if (S.view.length && S.visCols.length) setSel(0, 0, S.view.length - 1, S.visCols.length - 1);
      return;
    }
    const hc = el.closest('.hc');
    if (!hc) return;
    const c = +hc.dataset.c;
    if (el.dataset.act === 'menu') openColMenu(c, hc.querySelector('.hc-btn'));
    else if (el.dataset.act === 'sort') toggleSort(c, e.shiftKey);
  });
  $thead.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.classList.contains('qf')) return;
    const c = +t.dataset.c, has = !!t.value.trim();
    if (has) S.quick[c] = t.value; else delete S.quick[c];
    t.classList.toggle('has', has);
    t.closest('.hc').classList.toggle('filtered', has || !!S.vf[c]);
    filterSoon();
  });
  $thead.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!t.classList.contains('qf')) return;
    if (e.key === 'Enter') filterNow();
    else if (e.key === 'Escape') {
      e.stopPropagation();
      if (t.value) { t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); filterNow(); }
      else $vp.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      filterNow();
      $vp.focus();
      const k = S.visCols.indexOf(+t.dataset.c);
      if (S.view.length) setSel(0, k, 0, k, true);
    }
  });
  $thead.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const top = e.target.closest('.hc-top');
    if (top && !e.target.closest('.hc-btn')) {
      e.preventDefault();
      const hc = top.closest('.hc');
      colDrag = { c: +hc.dataset.c, hc, x0: e.clientX, y0: e.clientY, active: false };
      return;
    }
    const rz = e.target.closest('.rz');
    if (!rz) return;
    e.preventDefault();
    e.stopPropagation();
    const hc = rz.closest('.hc'), c = +hc.dataset.c, startX = e.clientX, startW = S.cols[c].w;
    rz.classList.add('active');
    document.body.classList.add('resizing');
    const move = (ev) => {
      const w = Math.max(48, Math.round(startW + ev.clientX - startX));
      if (w === S.cols[c].w) return;
      S.cols[c].w = w;
      hc.style.width = w + 'px';
      computeLayout();
      scheduleRender();
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      rz.classList.remove('active');
      document.body.classList.remove('resizing');
      if (S.cols[c].w !== startW) S.widths[c] = S.cols[c].w;
      saveState();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
  $thead.addEventListener('dblclick', (e) => {
    const rz = e.target.closest('.rz');
    if (!rz) return;
    const c = +rz.closest('.hc').dataset.c;
    delete S.widths[c];
    S.cols[c].w = fitWidth(c);
    columnsChanged();
  });

  let drag = null;
  $tbody.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const tr = e.target.closest('.tr');
    if (!tr) return;
    e.preventDefault();
    $vp.focus({ preventScroll: true });
    const i = +tr.dataset.i, lastK = S.visCols.length - 1;
    if (e.target.closest('.rn')) {
      if (e.shiftKey && S.sel) setSel(S.sel.ar, 0, i, lastK);
      else setSel(i, 0, i, lastK);
      drag = 'row';
      if (e.detail === 2) toggleDrawer(true);
      return;
    }
    const td = e.target.closest('.td');
    if (!td) return;
    const k = +td.dataset.k;
    if (e.shiftKey && S.sel) setSel(S.sel.ar, S.sel.ak, i, k);
    else setSel(i, k, i, k);
    drag = 'cell';
    if (e.detail === 2 && !e.shiftKey) startEdit(i, k);
  });
  document.addEventListener('mousemove', (e) => {
    if (colDrag) { onColDragMove(e); return; }
    if (!drag || !S.sel) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tr = el && el.closest && el.closest('.tr');
    if (!tr) return;
    const i = +tr.dataset.i;
    if (drag === 'row') { setSel(S.sel.ar, S.sel.ak, i, S.sel.fk); return; }
    const td = el.closest('.td');
    if (td) setSel(S.sel.ar, S.sel.ak, i, +td.dataset.k);
  });
  document.addEventListener('mouseup', () => {
    drag = null;
    if (colDrag) endColDrag();
  });
  $tbody.addEventListener('mouseover', (e) => {
    const td = e.target.closest('.td');
    if (!td || td.title || td.scrollWidth <= td.clientWidth) return;
    const v = S.rows[S.view[+td.parentNode.dataset.i]][S.visCols[+td.dataset.k]] || '';
    td.title = trunc(v, 2000);
  });

  $search.addEventListener('input', () => { S.search = $search.value; filterSoon(); });
  $search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') filterNow();
    else if (e.key === 'ArrowDown') { e.preventDefault(); filterNow(); $vp.focus(); if (S.view.length) setSel(0, 0, 0, 0, true); }
  });
  $searchBox.addEventListener('mousedown', (e) => { if (e.target === $searchBox) { e.preventDefault(); $search.focus(); } });
  $('searchClear').onclick = () => { $search.value = ''; S.search = ''; filterNow(); $search.focus(); };
  $('tgCase').onclick = () => { S.sCase = !S.sCase; filterNow(); };
  $('tgRegex').onclick = () => { S.sRegex = !S.sRegex; filterNow(); };
  $('btnDelim').onclick = (e) => openDelimMenu(e.currentTarget);
  $('btnHeader').onclick = () => { S.hasHeader = !S.hasHeader; S.sel = null; reloadText(false); saveState(); };
  $('btnSave').onclick = save;
  $('btnUndo').onclick = () => { commitEdit(); vscode.postMessage({ type: 'undo' }); };
  $('btnRedo').onclick = () => { commitEdit(); vscode.postMessage({ type: 'redo' }); };
  $('btnCols').onclick = (e) => openColsMenu(e.currentTarget);
  $('btnView').onclick = (e) => openViewMenu(e.currentTarget);
  $('btnDetail').onclick = () => toggleDrawer();
  $('btnExport').onclick = (e) => openExportMenu(e.currentTarget);
  $('btnText').onclick = () => vscode.postMessage({ type: 'openAsText' });

  $chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, c = b.dataset.c;
    if (act === 'reapply') { apply(); renderChips(); return; }
    if (act === 'x-all') { clearAll(true); return; }
    if (act === 'x-search') { S.search = ''; $search.value = ''; }
    else if (act === 'x-quick') delete S.quick[c];
    else if (act === 'x-vf') delete S.vf[c];
    else if (act === 'x-sort') { S.sort = []; sortChanged(); return; }
    buildHeader();
    filterNow();
  });
  $empty.addEventListener('click', (e) => { if (e.target.closest('[data-act="x-filters"]')) clearAll(false); });
  $banner.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'enc') vscode.postMessage({ type: 'reload', encoding: b.dataset.enc });
    else if (b.dataset.act === 'enc-menu') openEncodingMenu(b);
    else { S.bannerOff = true; checkEncoding(); }
  });
  $stL.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="enc-reset"]')) vscode.postMessage({ type: 'reload', encoding: null });
  });
  $drawer.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) {
      const kv = e.target.closest('.kv');
      const k = kv ? S.visCols.indexOf(+kv.dataset.c) : -1;
      if (k >= 0 && S.sel && !window.getSelection().toString()) setSel(S.sel.fr, k, S.sel.fr, k, true);
      return;
    }
    const act = b.dataset.act;
    if (act === 'dr-close') { toggleDrawer(false); return; }
    if (!S.sel) return;
    const r = S.view[S.sel.fr];
    if (act === 'dr-prev' || act === 'dr-next') {
      const fr = clamp(S.sel.fr + (act === 'dr-next' ? 1 : -1), 0, S.view.length - 1);
      setSel(fr, S.sel.fk, fr, S.sel.fk, true);
    } else if (act === 'dr-copy') {
      copyText(S.rows[r][+b.dataset.c] ?? '', t('Value copied'));
    } else if (act === 'dr-json') {
      const o = {};
      S.cols.forEach((col, c) => { o[col.name] = S.rows[r][c] ?? ''; });
      copyText(JSON.stringify(o, null, 2), t('Row copied as JSON'));
    }
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey, key = e.key;
    if (mod && !e.shiftKey && key.toLowerCase() === 'f') { e.preventDefault(); $search.focus(); $search.select(); return; }
    if (mod && !e.shiftKey && key.toLowerCase() === 's' && canEdit()) { e.preventDefault(); save(); return; }
    if (key === 'Escape') {
      if (closePop()) return;
      if (e.target === $search) { if (S.search) { $search.value = ''; S.search = ''; filterNow(); } else $vp.focus(); return; }
      if (S.drawer) { toggleDrawer(false); return; }
      if (S.sel) { S.sel = null; scheduleRender(); renderStatus(); }
      return;
    }
    if (isEditable(e.target) || (pop && pop.contains(e.target))) return;
    if (mod && key.toLowerCase() === 'c') {
      if (window.getSelection().toString()) return;
      e.preventDefault();
      copySelection();
      return;
    }
    if (mod && key.toLowerCase() === 'a') {
      e.preventDefault();
      if (S.view.length && S.visCols.length) setSel(0, 0, S.view.length - 1, S.visCols.length - 1);
      return;
    }
    if (!S.view.length || !S.visCols.length) return;
    if (key === ' ') { e.preventDefault(); toggleDrawer(); return; }
    if (S.sel && !mod) {
      if (key === 'Enter' || key === 'F2') { e.preventDefault(); startEdit(S.sel.fr, S.sel.fk); return; }
      if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); clearSelectionCells(); return; }
    }
    // Yazmaya başlamak düzenlemeyi açar (Türkçe klavyede AltGr ile yazılan karakterler dahil).
    const altGr = e.getModifierState && e.getModifierState('AltGraph');
    if (S.sel && key.length === 1 && (altGr || !(mod || e.altKey))) {
      e.preventDefault();
      startEdit(S.sel.fr, S.sel.fk, key);
      return;
    }
    const s = S.sel || { ar: 0, ak: 0, fr: 0, fk: 0 };
    const page = Math.max(1, Math.floor(($vp.clientHeight - S.headH) / S.rowH) - 1);
    const lastR = S.view.length - 1, lastK = S.visCols.length - 1;
    let fr = s.fr, fk = s.fk;
    switch (key) {
      case 'ArrowDown': fr = mod ? lastR : fr + 1; break;
      case 'ArrowUp': fr = mod ? 0 : fr - 1; break;
      case 'ArrowRight': fk = mod ? lastK : fk + 1; break;
      case 'ArrowLeft': fk = mod ? 0 : fk - 1; break;
      case 'PageDown': fr += page; break;
      case 'PageUp': fr -= page; break;
      case 'Home': if (mod) fr = 0; fk = 0; break;
      case 'End': if (mod) fr = lastR; fk = lastK; break;
      case 'Tab': fk += e.shiftKey ? -1 : 1; break;
      default: return;
    }
    e.preventDefault();
    if (!S.sel) { setSel(0, 0, 0, 0, true); return; }
    fr = clamp(fr, 0, lastR);
    fk = clamp(fk, 0, lastK);
    if (e.shiftKey && key !== 'Tab') setSel(s.ar, s.ak, fr, fk, true);
    else setSel(fr, fk, fr, fk, true);
  });
  // Bazı platformlarda VS Code kopyalamayı "copy" olayıyla tetikler.
  document.addEventListener('copy', (e) => {
    if (isEditable(e.target) || window.getSelection().toString()) return;
    const t = selectionText();
    if (t === null) return;
    e.clipboardData.setData('text/plain', t);
    e.preventDefault();
  });
  // Excel/Sheets'ten kopyalanan blok seçili hücreden itibaren yapıştırılır.
  document.addEventListener('paste', (e) => {
    if (isEditable(e.target) || S.edit || !S.sel) return;
    const t = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!t) return;
    e.preventDefault();
    pasteGrid(t);
  });

  // ───────────────────────── Eklenti mesajları ─────────────────────────
  function setDocState(m) {
    if ('editable' in m) S.editable = !!m.editable;
    if ('dirty' in m) {
      S.dirty = !!m.dirty;
      if (!S.dirty && S.edited.size) { S.edited.clear(); scheduleRender(); }
    }
    renderChrome();
    renderStatus();
  }

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || typeof m.type !== 'string') return;
    if (m.type === 'config') { setCfg(m.config); return; }
    if (m.type === 'state') { setDocState(m); return; }
    if (m.type === 'saved') {
      if (m.ok) toast(t('Saved'));
      else toast(t('Save failed'), true);
      return;
    }
    if (m.type === 'editFailed') { toast(t('Could not apply the change: {0}', m.message || ''), true); return; }
    if (m.type !== 'init' && m.type !== 'data') return;
    const first = m.type === 'init';
    if (first) {
      S.fileName = m.fileName || '';
      S.ext = (m.ext || '').toLowerCase();
      setCfg(m.config, true);
    }
    setDocState(m);
    let isUpdate = !first;
    if (m.reason === 'refresh' && S.pendingReload) {
      isUpdate = S.pendingReload.isUpdate;
      S.pendingReload = null;
    }
    let text = m.text || '';
    S.encoding = null;
    if (m.bytes) {
      try {
        text = new TextDecoder(m.encoding).decode(m.bytes instanceof Uint8Array ? m.bytes : new Uint8Array(m.bytes));
        S.encoding = m.encoding;
      } catch {
        toast(t('Could not decode {0}', m.encoding), true);
      }
    }
    const big = text.length > 3e6;
    if (big || first) $loading.classList.add('show');
    setTimeout(() => {
      load(text, isUpdate);
      $loading.classList.remove('show');
      if (first && restoreScroll) {
        $vp.scrollTop = restoreScroll.top;
        $vp.scrollLeft = restoreScroll.left;
        restoreScroll = null;
      }
    }, big || first ? 30 : 0);
  });

  $search.value = S.search;
  vscode.postMessage({ type: 'ready' });
})();
