import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = 'D:/small_editor';
const RAW = `${ROOT}/reports/_raw`;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function check(condition, message) {
  if (!condition) throw new Error(message);
}

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

function readZipEntries(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  check(eocd >= 0, 'ZIP end-of-central-directory not found');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    check(buffer.readUInt32LE(offset) === 0x02014b50, 'bad ZIP central directory signature');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    check(buffer.readUInt32LE(localOffset) === 0x04034b50, 'bad ZIP local header signature');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? compressed : zlib.inflateRawSync(compressed);
    check(data.length === uncompressedSize, `ZIP size mismatch for ${name}`);
    entries.push({ name, data, method, compressedBytes: compressedSize, uncompressedBytes: uncompressedSize });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function pdfSummary(bytes) {
  const doc = await PDFDocument.load(bytes);
  const js = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const pageText = [];
  for (let i = 1; i <= js.numPages; i++) {
    const page = await js.getPage(i);
    const content = await page.getTextContent();
    pageText.push(content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim());
  }
  await js.destroy();
  const rotations = doc.getPages().map((page) => page.getRotation().angle);
  return {
    pages: doc.getPageCount(),
    rotations,
    pageText,
    pageMarkers: pageText.map((text) => {
      const match = text.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
      return match ? Number(match[1]) : null;
    })
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  purpose: 'Independent checks of the 2026-10-25 splitBySize, extractPages and rotatePages public results.',
  files: {},
  rateLimits: []
};

// --- splitBySize ---
{
  const trace = readTrace('split-pdf-by-size');
  const zipPath = `${RAW}/split-pdf-by-size-result.zip`;
  const zip = fs.readFileSync(zipPath);
  const entries = readZipEntries(zip);
  const docs = [];
  for (const entry of entries) {
    const summary = await pdfSummary(entry.data);
    docs.push({
      name: entry.name,
      bytes: entry.data.length,
      compressedBytes: entry.compressedBytes,
      method: entry.method,
      sha256: sha256(entry.data),
      ...summary
    });
  }
  const zipEntryOrder = entries.map((entry) => entry.name);
  docs.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  check(trace.payload?.type === 'splitBySize', 'splitBySize type');
  check(trace.payload?.size === 1, 'splitBySize size');
  check(trace.payload?.sizeUnit === 'KB', 'splitBySize unit');
  check(trace.payload?.files?.length === 1, 'splitBySize input file count');
  check(trace.changeStatus === 'Completed', 'splitBySize status');
  check(entries.length === 4, `splitBySize zip entry count: ${entries.length}`);
  check(trace.resultItems.length === 4, 'splitBySize result item count');
  check([...zipEntryOrder].sort().join(',') === '1_sample.pdf,2_sample.pdf,3_sample.pdf,4_sample.pdf', 'splitBySize entry names');
  check(docs.every((doc) => doc.pages === 1), 'splitBySize output page counts');
  check(docs.every((doc) => {
    const fromName = Number(doc.name.match(/^(\d+)_/)?.[1]);
    return fromName === doc.pageMarkers[0];
  }), 'splitBySize filename/page mapping');
  check(docs.reduce((total, doc) => total + doc.pages, 0) === 4, 'splitBySize total pages');
  out.files.splitBySize = {
    taskId: trace.taskId,
    taskStatus: trace.taskStatus,
    changeStatus: trace.changeStatus,
    payload: trace.payload,
    zip: {
      path: 'reports/_raw/split-pdf-by-size-result.zip',
      bytes: zip.length,
      sha256: sha256(zip),
      metadataBytes: trace.resultFileSize,
      metadataDelta: trace.resultFileSize - zip.length,
      resultItems: trace.resultItems,
      zipEntryOrder,
      entries: entries.map((entry) => ({
        name: entry.name,
        method: entry.method,
        compressedBytes: entry.compressedBytes,
        uncompressedBytes: entry.uncompressedBytes
      }))
    },
    documents: docs,
    totalPages: docs.reduce((total, doc) => total + doc.pages, 0),
    warnings: trace.warnings,
    rateLimit: trace.rateLimit
  };
  out.rateLimits.push({ task: 'splitBySize', ...trace.rateLimit });
}

// --- extractPages ---
{
  const trace = readTrace('extract-pdf-pages');
  const path = `${RAW}/extract-pdf-pages-result.pdf`;
  const bytes = fs.readFileSync(path);
  const summary = await pdfSummary(bytes);
  check(trace.payload?.type === 'extractPages', 'extractPages type');
  check(trace.payload?.pages === '1,3-4', 'extractPages range');
  check(trace.payload?.outputFilenamePattern === '[BASENAME]', 'extractPages filename pattern');
  check(trace.changeStatus === 'Completed', 'extractPages status');
  check(trace.resultItems.length === 1, 'extractPages result item count');
  check(summary.pages === 3, `extractPages page count: ${summary.pages}`);
  check(summary.pageMarkers.join(',') === '1,3,4', 'extractPages source page order');
  out.files.extractPages = {
    taskId: trace.taskId,
    taskStatus: trace.taskStatus,
    changeStatus: trace.changeStatus,
    payload: trace.payload,
    pdf: {
      path: 'reports/_raw/extract-pdf-pages-result.pdf',
      bytes: bytes.length,
      sha256: sha256(bytes),
      metadataBytes: trace.resultFileSize,
      metadataDelta: trace.resultFileSize - bytes.length,
      resultItems: trace.resultItems
    },
    pages: summary.pages,
    rotations: summary.rotations,
    pageMarkers: summary.pageMarkers,
    pageText: summary.pageText,
    warnings: trace.warnings,
    rateLimit: trace.rateLimit
  };
  out.rateLimits.push({ task: 'extractPages', ...trace.rateLimit });
}

// --- rotatePages ---
{
  const trace = readTrace('rotate-pdf-pages');
  const path = `${RAW}/rotate-pdf-pages-result.pdf`;
  const bytes = fs.readFileSync(path);
  const summary = await pdfSummary(bytes);
  check(trace.payload?.type === 'rotatePages', 'rotatePages type');
  check(trace.payload?.pageRotationsPerSource?.join(',') === '0:1:90,0:3:180,0:4:270', 'rotatePages payload');
  check(trace.changeStatus === 'Completed', 'rotatePages status');
  check(trace.resultItems.length === 1, 'rotatePages result item count');
  check(summary.pages === 4, `rotatePages page count: ${summary.pages}`);
  check(summary.rotations.join(',') === '90,0,180,270', `rotatePages output rotations: ${summary.rotations.join(',')}`);
  check(summary.pageMarkers.join(',') === '1,2,3,4', 'rotatePages page order');
  out.files.rotatePages = {
    taskId: trace.taskId,
    taskStatus: trace.taskStatus,
    changeStatus: trace.changeStatus,
    payload: trace.payload,
    pdf: {
      path: 'reports/_raw/rotate-pdf-pages-result.pdf',
      bytes: bytes.length,
      sha256: sha256(bytes),
      metadataBytes: trace.resultFileSize,
      metadataDelta: trace.resultFileSize - bytes.length,
      resultItems: trace.resultItems
    },
    pages: summary.pages,
    rotations: summary.rotations,
    pageMarkers: summary.pageMarkers,
    pageText: summary.pageText,
    warnings: trace.warnings,
    rateLimit: trace.rateLimit
  };
  out.rateLimits.push({ task: 'rotatePages', ...trace.rateLimit });
}

check(out.rateLimits.map((entry) => entry.remaining).join(',') === '2,1,0', 'rate-limit sequence');
out.rateLimitNote = 'Three submissions consumed the remaining free-tier allowance; no bypass was used.';
out.metadataDeltaNote = 'The task metadata resultFileSize is larger than the bytes downloaded from the signed result URL. The cause remains UNKNOWN.';

fs.writeFileSync(`${RAW}/phase4c-workflow-verification.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  verification: 'reports/_raw/phase4c-workflow-verification.json',
  summary: {
    splitBySize: {
      taskId: out.files.splitBySize.taskId,
      zipBytes: out.files.splitBySize.zip.bytes,
      zipSha256: out.files.splitBySize.zip.sha256,
      metadataBytes: out.files.splitBySize.zip.metadataBytes,
      metadataDelta: out.files.splitBySize.zip.metadataDelta,
      entries: out.files.splitBySize.documents.map((doc) => ({ name: doc.name, pages: doc.pages, bytes: doc.bytes, marker: doc.pageMarkers[0] })),
      totalPages: out.files.splitBySize.totalPages,
      rateLimit: out.files.splitBySize.rateLimit
    },
    extractPages: {
      taskId: out.files.extractPages.taskId,
      bytes: out.files.extractPages.pdf.bytes,
      sha256: out.files.extractPages.pdf.sha256,
      metadataBytes: out.files.extractPages.pdf.metadataBytes,
      metadataDelta: out.files.extractPages.pdf.metadataDelta,
      pages: out.files.extractPages.pages,
      pageMarkers: out.files.extractPages.pageMarkers,
      rateLimit: out.files.extractPages.rateLimit
    },
    rotatePages: {
      taskId: out.files.rotatePages.taskId,
      bytes: out.files.rotatePages.pdf.bytes,
      sha256: out.files.rotatePages.pdf.sha256,
      metadataBytes: out.files.rotatePages.pdf.metadataBytes,
      metadataDelta: out.files.rotatePages.pdf.metadataDelta,
      pages: out.files.rotatePages.pages,
      rotations: out.files.rotatePages.rotations,
      rateLimit: out.files.rotatePages.rateLimit
    }
  }
}, null, 2));
