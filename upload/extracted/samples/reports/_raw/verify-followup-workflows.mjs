import fs from 'node:fs';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = 'D:/small_editor';
const RAW = `${ROOT}/reports/_raw`;
const out = {
  generatedAt: new Date().toISOString(),
  purpose: 'Independent checks of the 2026-10-25 split-by-bookmarks, alternate-mix and encrypt results.',
  files: {},
  rateLimits: []
};

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function readTrace(name) {
  const raw = JSON.parse(fs.readFileSync(`${RAW}/${name}-task-network.json`, 'utf8'));
  const post = raw.apiTransactions.find((t) =>
    t.method === 'POST' && /\/api\/tasks(?:\?|$)/.test(t.url)
  );
  let payload = null;
  try { payload = JSON.parse(post?.postData || 'null'); } catch {}
  return {
    taskId: raw.task.id,
    taskStatus: raw.task.status,
    changeStatus: raw.change.parsed?.status,
    resultFilename: raw.change.parsed?.resultFilename,
    resultFileSize: raw.change.parsed?.resultFileSize,
    resultItems: raw.change.parsed?.resultItems || [],
    warnings: raw.change.parsed?.warnings || [],
    payload,
    rateLimit: {
      remaining: raw.task.headers?.['x-ratelimit-remaining'] ?? null,
      wait: raw.task.headers?.['x-ratelimit-wait'] ?? null
    },
    result: raw.result
  };
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function redactPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = structuredClone(payload);
  for (const key of ['userPassword', 'ownerPassword', 'password']) {
    if (Object.hasOwn(copy, key)) copy[key] = '[redacted]';
  }
  return copy;
}

// --- splitByBookmarks ---
{
  const trace = readTrace('split-pdf-by-outline');
  const zipPath = `${RAW}/split-pdf-by-outline-result.zip`;
  const zip = fs.readFileSync(zipPath);
  const docs = [];
  for (const name of ['1_Chapter 1.pdf', '2_Chapter 2.pdf', '3_Chapter 3.pdf']) {
    const path = `${RAW}/split-outline-files/${name}`;
    const bytes = fs.readFileSync(path);
    const doc = await PDFDocument.load(bytes);
    docs.push({ name, bytes: bytes.length, pages: doc.getPageCount(), sha256: sha256(bytes) });
  }
  check(trace.payload?.type === 'splitByBookmarks', 'split type');
  check(trace.payload?.bookmarksLevel === '1', 'split level');
  check(trace.payload?.bookmarksExpression === 'Chapter', 'split filter');
  check(trace.changeStatus === 'Completed', 'split status');
  check(trace.resultItems.length === 3, 'split result item count');
  check(docs.map((d) => d.pages).join(',') === '1,2,1', 'split page counts');
  out.files.splitByBookmarks = {
    taskId: trace.taskId,
    taskStatus: trace.taskStatus,
    changeStatus: trace.changeStatus,
    payload: redactPayload(trace.payload),
    zip: {
      path: 'reports/_raw/split-pdf-by-outline-result.zip',
      bytes: zip.length,
      sha256: sha256(zip),
      metadataBytes: trace.resultFileSize,
      resultItems: trace.resultItems
    },
    documents: docs,
    totalPages: docs.reduce((n, d) => n + d.pages, 0),
    warnings: trace.warnings,
    rateLimit: trace.rateLimit
  };
  out.rateLimits.push({ task: 'splitByBookmarks', ...trace.rateLimit });
}

// --- alternateMix ---
{
  const trace = readTrace('alternate-mix-pdf');
  const path = `${RAW}/alternate-mix-pdf-result.pdf`;
  const bytes = fs.readFileSync(path);
  const pdf = await PDFDocument.load(bytes);
  const pdata = new Uint8Array(bytes);
  const js = await getDocument({ data: pdata, verbosity: 0 }).promise;
  const parts = [];
  for (let i = 1; i <= js.numPages; i++) {
    const page = await js.getPage(i);
    const text = await page.getTextContent();
    const line = text.items.map((x) => x.str).join(' ');
    const m = line.match(/Page (\d) of 4/);
    parts.push(m ? Number(m[1]) : null);
  }
  await js.destroy();
  check(trace.payload?.type === 'alternateMix', 'mix type');
  check(Array.isArray(trace.payload?.files), 'mix files');
  check(trace.payload.files.length >= 2, 'mix files count');
  check(trace.payload?.step?.length === 3, 'mix step array');
  check(trace.payload?.reverse?.length === 3, 'mix reverse array');
  check(trace.payload?.repeat?.length === 3, 'mix repeat array');
  check(trace.changeStatus === 'Completed', 'mix status');
  check(pdf.getPageCount() === 8, 'mix page count');
  check(parts.join(',') === '1,1,2,2,3,3,4,4', 'mix order');
  out.files.alternateMix = {
    taskId: trace.taskId,
    taskStatus: trace.taskStatus,
    changeStatus: trace.changeStatus,
    payload: redactPayload(trace.payload),
    result: {
      path: 'reports/_raw/alternate-mix-pdf-result.pdf',
      bytes: bytes.length,
      sha256: sha256(bytes),
      metadataBytes: trace.resultFileSize,
      pages: pdf.getPageCount(),
      pageMarkers: parts
    },
    warnings: trace.warnings,
    rateLimit: trace.rateLimit
  };
  out.rateLimits.push({ task: 'alternateMix', ...trace.rateLimit });
}

// --- encrypt ---
{
  const trace = readTrace('encrypt-pdf');
  const path = `${RAW}/encrypt-pdf-result.pdf`;
  const bytes = fs.readFileSync(path);
  const latin = bytes.toString('latin1');
  let withoutPassword = null;
  try {
    const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
    await doc.destroy();
    withoutPassword = 'opened';
  } catch (e) {
    withoutPassword = e.name || 'error';
  }
  let withPassword = null;
  let pages = null;
  try {
    const doc = await getDocument({
      data: new Uint8Array(bytes),
      password: 'open-sejda-2026',
      verbosity: 0
    }).promise;
    pages = doc.numPages;
    withPassword = 'opened';
    await doc.destroy();
  } catch (e) {
    withPassword = e.name || 'error';
  }
  let wrongPassword = null;
  try {
    const doc = await getDocument({
      data: new Uint8Array(bytes),
      password: 'not-the-password',
      verbosity: 0
    }).promise;
    await doc.destroy();
    wrongPassword = 'opened';
  } catch (e) {
    wrongPassword = e.name || 'error';
  }
  check(trace.payload?.type === 'encrypt', 'encrypt type');
  check(trace.payload?.encryptionAlgorithm === 'aes_256', 'encrypt algorithm');
  check(trace.changeStatus === 'Completed', 'encrypt status');
  check(withoutPassword === 'PasswordException', 'encrypt without password');
  check(withPassword === 'opened' && pages === 4, 'encrypt with password');
  check(wrongPassword === 'PasswordException', 'encrypt wrong password');
  check(latin.includes('/V 5'), 'encrypt /V');
  check(latin.includes('/R 6'), 'encrypt /R');
  check(latin.includes('/Length 256'), 'encrypt length');
  check(latin.includes('/AESV3'), 'encrypt AESV3');
  out.files.encrypt = {
    taskId: trace.taskId,
    taskStatus: trace.taskStatus,
    changeStatus: trace.changeStatus,
    payload: redactPayload(trace.payload),
    result: {
      path: 'reports/_raw/encrypt-pdf-result.pdf',
      bytes: bytes.length,
      sha256: sha256(bytes),
      metadataBytes: trace.resultFileSize,
      pages,
      encryption: {
        v: 5,
        r: 6,
        lengthBits: 256,
        aesV3: true
      },
      withoutPassword,
      withUserPassword: withPassword,
      withWrongPassword: wrongPassword
    },
    warnings: trace.warnings,
    rateLimit: trace.rateLimit
  };
  out.rateLimits.push({ task: 'encrypt', ...trace.rateLimit });
}

check(out.rateLimits.map((r) => r.remaining).join(',') === '2,1,0', 'rate-limit sequence');
out.rateLimitNote = 'Three submissions consumed the remaining free-tier allowance; no bypass was used.';
fs.writeFileSync(`${RAW}/followup-workflow-verification.json`, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({
  out: `${RAW}/followup-workflow-verification.json`,
  split: out.files.splitByBookmarks?.documents,
  mix: out.files.alternateMix?.result,
  encrypt: out.files.encrypt?.result,
  rateLimits: out.rateLimits
}, null, 2));
