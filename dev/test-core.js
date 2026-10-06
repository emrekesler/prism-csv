// Çekirdek testleri: node dev/test-core.js
const assert = require('assert');
const core = require('../media/csv-core.js');

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; }
};
const edit = (text, delim, edits) => core.applyChanges(text, core.cellEditChanges(text, delim, edits));

test('temel ayrıştırma', () => {
  assert.deepStrictEqual(core.parseCSV('a,b\n1,2\n', ','), [['a', 'b'], ['1', '2']]);
  assert.deepStrictEqual(core.parseCSV('a,b\r\n1,2', ','), [['a', 'b'], ['1', '2']]);
  assert.deepStrictEqual(core.parseCSV('a,\n,b,', ','), [['a', ''], ['', 'b', '']]);
});
test('tırnak, kaçış ve çok satırlı alan', () => {
  assert.deepStrictEqual(core.parseCSV('"a,b","say ""hi""","x\ny"\n', ','), [['a,b', 'say "hi"', 'x\ny']]);
  assert.deepStrictEqual(core.parseCSV('"ab"c,d', ','), [['abc', 'd']]);
  assert.deepStrictEqual(core.parseCSV('"",x', ','), [['', 'x']]);
});
test('boş satırlar atlanır ama tırnaklı boş alan satır sayılır', () => {
  assert.deepStrictEqual(core.parseCSV('a\n\n\nb\n""\n', ','), [['a'], ['b'], ['']]);
  assert.strictEqual(core.recordIndex('a\n\n\nb\n""\n', ',').length, 3);
});
test('BOM atlanır', () => {
  assert.deepStrictEqual(core.parseCSV('﻿a;b\n1;2', ';'), [['a', 'b'], ['1', '2']]);
});
test('recordIndex parseCSV ile hizalı', () => {
  const t = '﻿h1,h2\n\n"x\n\ny",1\r\n\r\nz,2\n,\n';
  const rows = core.parseCSV(t, ','), starts = core.recordIndex(t, ',');
  assert.strictEqual(rows.length, starts.length);
  starts.forEach((s, r) => assert.deepStrictEqual(core.parseCSV(t.slice(s), ',')[0], rows[r]));
});
test('hücre düzenleme yalnızca o alanı değiştirir', () => {
  assert.strictEqual(edit('a,b,c\r\n1,2,3\r\n', ',', [{ record: 1, col: 1, value: 'X' }]), 'a,b,c\r\n1,X,3\r\n');
});
test('gerekirse tırnaklar, tırnaklı alan tırnaklı kalır', () => {
  assert.strictEqual(edit('a;b\n1;2\n', ';', [{ record: 1, col: 0, value: 'x;y' }]), 'a;b\n"x;y";2\n');
  assert.strictEqual(edit('"a","b"\n', ',', [{ record: 0, col: 1, value: 'c' }]), '"a","c"\n');
  assert.strictEqual(edit('a,b\n', ',', [{ record: 0, col: 0, value: 'he said "hi"\nok' }]), '"he said ""hi""\nok",b\n');
});
test('eksik sütun kayıt sonuna eklenir', () => {
  assert.strictEqual(edit('a,b,c\n1\n', ',', [{ record: 1, col: 2, value: 'z' }]), 'a,b,c\n1,,z\n');
  assert.strictEqual(edit('a,b,c\n1', ',', [{ record: 1, col: 2, value: 'z' }, { record: 1, col: 0, value: 'q' }]), 'a,b,c\nq,,z');
});
test('boş satırlardan sonra doğru kayıt düzenlenir', () => {
  const t = 'h\n\n"m\nl"\n\nlast\n';
  assert.strictEqual(edit(t, ',', [{ record: 2, col: 0, value: 'L' }]), 'h\n\n"m\nl"\n\nL\n');
  assert.strictEqual(edit(t, ',', [{ record: 1, col: 0, value: 'one' }]), 'h\n\n"one"\n\nlast\n');
});
test('çoklu düzenleme ve shiftIndex', () => {
  const t = 'a,b\nlong,x\nc,d\ne,f\n';
  const starts = core.recordIndex(t, ',');
  const changes = core.cellEditChanges(t, ',', [{ record: 1, col: 0, value: 'L' }, { record: 3, col: 1, value: 'FFF' }], starts);
  const next = core.applyChanges(t, changes);
  assert.strictEqual(next, 'a,b\nL,x\nc,d\ne,FFF\n');
  assert.deepStrictEqual(core.shiftIndex(starts.slice(), changes), core.recordIndex(next, ','));
});
test('sütun sıralama ham alanları taşır, satır sonlarını korur', () => {
  const t = '﻿a,"b,1",c\r\n\r\n1,2,3\r\nx\r\n';
  assert.strictEqual(core.reorderColumns(t, ',', [2, 0, 1]), '﻿c,a,"b,1"\r\n\r\n3,1,2\r\n,x,\r\n');
});
test('sıralama sonrası ayrıştırma, yerel permütasyonla aynı', () => {
  const t = 'h1;h2;h3\n1;"a;b";3\n4;5\n';
  const order = [1, 2, 0];
  const local = core.parseCSV(t, ';').map((row) => order.map((o) => row[o] ?? ''));
  assert.deepStrictEqual(core.parseCSV(core.reorderColumns(t, ';', order), ';'), local);
});
test('rastgele: düzenleme sonrası ayrıştırma beklenen değeri verir', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pieces = ['a', 'b c', '', '"q"', 'x,y', 'l1\nl2', 'ş', ' sp '];
  for (let iter = 0; iter < 300; iter++) {
    const rows = [];
    const nr = 1 + Math.floor(rnd() * 6);
    for (let r = 0; r < nr; r++) {
      const nc = 1 + Math.floor(rnd() * 4);
      rows.push(Array.from({ length: nc }, () => pieces[Math.floor(rnd() * pieces.length)]));
    }
    const eol = rnd() < 0.5 ? '\n' : '\r\n';
    const text = rows.map((r) => r.map((v) => core.quoteField(v, ',', rnd() < 0.2)).join(',')).join(eol) + (rnd() < 0.5 ? eol : '');
    const parsed = core.parseCSV(text, ',');
    if (!parsed.length) continue;
    const rec = Math.floor(rnd() * parsed.length), col = Math.floor(rnd() * 5);
    const value = pieces[Math.floor(rnd() * pieces.length)] + 'Z';
    const after = core.parseCSV(edit(text, ',', [{ record: rec, col, value }]), ',');
    const expected = parsed.map((r) => r.slice());
    while (expected[rec].length <= col) expected[rec].push('');
    expected[rec][col] = value;
    assert.deepStrictEqual(after, expected, JSON.stringify({ text, rec, col, value }));
  }
});

console.log(`${passed} test geçti${process.exitCode ? ', hatalar var' : ''}`);
