'use strict';

const vscode = require('vscode');
const path = require('path');
const crypto = require('crypto');
const core = require('./media/csv-core.js');

const VIEW_TYPE = 'prismCsv.table';

function activate(context) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new CsvTableProvider(context), {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    }),
    vscode.commands.registerCommand('prismCsv.openTable', (uri) => reopen(uri, VIEW_TYPE)),
    vscode.commands.registerCommand('prismCsv.openText', (uri) => reopen(uri, 'default')),
  );
}

function deactivate() {}

/** Aktif sekmenin dosyasını döndürür (metin ya da özel editör). */
function activeUri() {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom) return input.uri;
  return undefined;
}

/** Dosyayı aynı grupta başka bir editörle yeniden açar ve eski sekmeyi kapatır. */
async function reopen(uri, viewType) {
  uri = uri instanceof vscode.Uri ? uri : activeUri();
  if (!uri) return;
  const group = vscode.window.tabGroups.activeTabGroup;
  const key = uri.toString();
  const old = group.tabs.filter((tab) => {
    const input = tab.input;
    if (!input || !input.uri || input.uri.toString() !== key) return false;
    return viewType === 'default'
      ? input instanceof vscode.TabInputCustom && input.viewType === VIEW_TYPE
      : input instanceof vscode.TabInputText;
  });
  await vscode.commands.executeCommand('vscode.openWith', uri, viewType, group.viewColumn);
  if (old.length) {
    try {
      await vscode.window.tabGroups.close(old, true);
    } catch {
      // VS Code sekmeyi zaten değiştirmiş olabilir.
    }
  }
}

function readConfig() {
  const c = vscode.workspace.getConfiguration('prismCsv');
  return {
    colorMode: c.get('colorMode', 'text'),
    density: c.get('density', 'comfortable'),
    font: c.get('font', 'mono'),
  };
}

class CsvTableProvider {
  constructor(context) {
    this.context = context;
  }

  resolveCustomTextEditor(document, panel) {
    const webview = panel.webview;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    webview.options = { enableScripts: true, localResourceRoots: [media] };
    webview.html = getHtml(webview, media);

    const docKey = document.uri.toString();
    const writable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) !== false;

    // Dosya UTF-8 değilse kullanıcı başka bir kodlamayla okutabilir; çözme işi webview'da yapılır.
    // Bu durumda belge metniyle webview metni farklı olacağı için düzenleme kapatılır.
    let encoding = null;
    const state = () => ({ editable: writable && !encoding, dirty: document.isDirty });
    const payload = async () => {
      if (encoding && document.uri.scheme !== 'untitled') {
        const bytes = await vscode.workspace.fs.readFile(document.uri);
        return { bytes: new Uint8Array(bytes), encoding };
      }
      return { text: document.getText() };
    };
    const post = async (type, extra) => webview.postMessage({ type, ...(await payload()), ...state(), ...extra });
    const postState = () => webview.postMessage({ type: 'state', ...state() });

    // Webview'dan gelen düzenlemeler sırayla uygulanır. Kendi düzenlemelerimiz webview'a geri
    // gönderilmez (webview değişikliği zaten kendi tarafında yaptı); dışarıdan gelen değişiklikler
    // (metin editörü, geri al/yinele, diskten yeniden yükleme) gönderilir.
    let queue = Promise.resolve();
    let selfDepth = 0, selfVersion = -1;
    let index = null; // { version, delim, starts }

    const recordStarts = (delim) => {
      if (!index || index.version !== document.version || index.delim !== delim) {
        index = { version: document.version, delim, starts: core.recordIndex(document.getText(), delim) };
      }
      return index.starts;
    };
    // Sıradaki düzenleme ofsetleri belgenin güncel metninden hesaplar; bu yüzden bir düzenleme
    // belgeye yansımadan (sürüm artmadan) bir sonrakine geçilmez.
    const waitForVersion = (v0) => new Promise((resolve) => {
      if (document.version !== v0) { resolve(); return; }
      const sub = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === docKey) { sub.dispose(); clearTimeout(t); resolve(); }
      });
      const t = setTimeout(() => { sub.dispose(); resolve(); }, 1000);
    });
    const applySelf = async (build) => {
      const we = new vscode.WorkspaceEdit();
      const after = build(we);
      const v0 = document.version;
      selfDepth++;
      let ok = false;
      try {
        ok = await vscode.workspace.applyEdit(we);
        if (ok) await waitForVersion(v0);
      } finally {
        selfDepth--;
      }
      if (!ok) throw new Error(vscode.l10n.t('The change could not be applied to the document.'));
      selfVersion = document.version;
      if (after) after();
    };
    const enqueue = (fn) => {
      queue = queue.then(fn).catch((err) => {
        index = null;
        webview.postMessage({ type: 'editFailed', message: String((err && err.message) || err) });
        post('data', { reason: 'refresh' });
      });
    };

    /** Ofsetli metin değişikliklerini ({ start, end, text }) tek düzenleme olarak uygular. */
    const applyChanges = (changes, after) => {
      if (!changes.length) return;
      return applySelf((we) => {
        for (const ch of changes) {
          we.replace(document.uri, new vscode.Range(document.positionAt(ch.start), document.positionAt(ch.end)), ch.text);
        }
        return after;
      });
    };
    /** Belgenin tamamını yeni metinle değiştirir (sütun işlemleri her satırı etkiler). */
    const replaceAll = (text, next) => {
      if (next === text) return;
      return applySelf((we) => {
        we.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(text.length)), next);
        return () => { index = null; };
      });
    };
    const dropIndex = () => { index = null; };

    const editCells = (msg) => enqueue(() => {
      const starts = recordStarts(msg.delim);
      const changes = core.cellEditChanges(document.getText(), msg.delim, msg.edits, starts);
      return applyChanges(changes, () => {
        if (index && index.starts === starts) {
          core.shiftIndex(starts, changes);
          index.version = document.version;
        }
      });
    });
    const deleteRows = (msg) => enqueue(() =>
      applyChanges(core.deleteRecordsChanges(document.getText(), msg.delim, msg.records, recordStarts(msg.delim)), dropIndex));
    const insertRow = (msg) => enqueue(() =>
      applyChanges(core.insertRecordChanges(document.getText(), msg.delim, msg.at, msg.ncols, recordStarts(msg.delim)), dropIndex));
    const columnOp = (msg, op) => enqueue(() => {
      const text = document.getText();
      return replaceAll(text, op(text));
    });

    let timer;
    const subs = [
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() !== docKey || !e.contentChanges.length) return;
        postState();
        if (selfDepth > 0) return;
        index = null;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (document.version !== selfVersion) post('data');
        }, 200);
      }),
      vscode.workspace.onDidSaveTextDocument((d) => {
        if (d.uri.toString() === docKey) postState();
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('prismCsv')) webview.postMessage({ type: 'config', config: readConfig() });
      }),
      webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
          case 'ready':
            post('init', {
              fileName: path.posix.basename(document.uri.path),
              ext: path.posix.extname(document.uri.path).toLowerCase(),
              config: readConfig(),
            });
            break;
          case 'getText':
            post('data', { reason: 'refresh' });
            break;
          case 'edit':
            editCells(msg);
            break;
          case 'deleteRows':
            deleteRows(msg);
            break;
          case 'insertRow':
            insertRow(msg);
            break;
          case 'reorder':
            columnOp(msg, (text) => core.reorderColumns(text, msg.delim, msg.order));
            break;
          case 'deleteColumns':
            columnOp(msg, (text) => core.deleteColumns(text, msg.delim, msg.cols));
            break;
          case 'insertColumn':
            columnOp(msg, (text) => core.insertColumn(text, msg.delim, msg.at));
            break;
          case 'readClipboard':
            webview.postMessage({ type: 'clipboard', text: await vscode.env.clipboard.readText() });
            break;
          case 'save':
            queue = queue.then(async () => {
              const ok = await document.save();
              webview.postMessage({ type: 'saved', ok });
              postState();
            });
            break;
          case 'undo':
          case 'redo':
            panel.reveal(undefined, false);
            await vscode.commands.executeCommand(msg.type);
            break;
          case 'copy':
            await vscode.env.clipboard.writeText(msg.text);
            break;
          case 'openAsText':
            reopen(document.uri, 'default');
            break;
          case 'reload':
            encoding = msg.encoding || null;
            post('data', { reason: 'refresh' });
            break;
          case 'setConfig':
            await vscode.workspace
              .getConfiguration('prismCsv')
              .update(msg.key, msg.value, vscode.ConfigurationTarget.Global);
            break;
          case 'export':
            await exportFile(document, msg);
            break;
        }
      }),
    ];

    panel.onDidDispose(() => {
      clearTimeout(timer);
      subs.forEach((s) => s.dispose());
    });
  }
}

async function exportFile(document, msg) {
  const ext = path.posix.extname(document.uri.path) || '.csv';
  const name = vscode.l10n.t('{0}-filtered', path.posix.basename(document.uri.path, ext)) + ext;
  const defaultUri = document.uri.scheme === 'untitled'
    ? undefined
    : document.uri.with({ path: path.posix.join(path.posix.dirname(document.uri.path), name) });
  const target = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { 'CSV / TSV': ['csv', 'tsv', 'txt'] },
    saveLabel: vscode.l10n.t('Export'),
  });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, Buffer.from(msg.text, 'utf8'));
  const rows = Number(msg.rows);
  const open = vscode.l10n.t('Open');
  const choice = await vscode.window.showInformationMessage(
    vscode.l10n.t(rows === 1 ? '{0} row saved to {1}' : '{0} rows saved to {1}', rows.toLocaleString(vscode.env.language), path.posix.basename(target.path)),
    open,
  );
  if (choice === open) vscode.commands.executeCommand('vscode.open', target);
}

/** Webview'a gömülecek dil bilgisi; çeviriler l10n/bundle.l10n.<dil>.json'dan gelir (İngilizcede boş). */
function l10nPayload() {
  const json = JSON.stringify({ lang: vscode.env.language, bundle: vscode.l10n.bundle || {} });
  return json.replace(/</g, '\\u003c');
}

function getHtml(webview, media) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const uri = (file) => webview.asWebviewUri(vscode.Uri.joinPath(media, file));
  return `<!DOCTYPE html>
<html lang="${vscode.env.language}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${uri('main.css')}">
<title>Prism CSV</title>
</head>
<body>
<script id="l10n" type="application/json">${l10nPayload()}</script>
<script nonce="${nonce}" src="${uri('csv-core.js')}"></script>
<script nonce="${nonce}" src="${uri('main.js')}"></script>
</body>
</html>`;
}

module.exports = { activate, deactivate };
