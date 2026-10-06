// README ekran görüntüsünü üretir: önizleme açıkken (npm run preview) → npm run screenshot
// Chrome ya da Edge'i görünmez modda çalıştırır; yol CHROME ortam değişkeniyle de verilebilir.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const candidates = [
  process.env.CHROME,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = candidates.find((p) => fs.existsSync(p));
if (!browser) {
  console.error('Chrome/Edge bulunamadı; CHROME ortam değişkeniyle yolunu verin.');
  process.exit(1);
}

const out = path.resolve(__dirname, '..', 'docs', 'screenshot.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-shot-'));
execFileSync(browser, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--user-data-dir=${profile}`, '--window-size=1440,900', '--force-device-scale-factor=2',
  '--virtual-time-budget=6000', `--screenshot=${out}`, 'http://localhost:5178/?demo',
], { stdio: 'inherit' });
fs.rmSync(profile, { recursive: true, force: true });
console.log(`→ ${out}`);
