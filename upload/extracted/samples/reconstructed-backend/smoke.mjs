import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const sample = path.resolve(root, '..', 'samples', 'sample.pdf');
const bookmarked = path.resolve(root, '..', 'samples', 'sample-bookmarks.pdf');
const port = process.env.SMOKE_PORT || '18081';
const base = `http://127.0.0.1:${port}`;
const sep = process.platform === 'win32' ? ';' : ':';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
let stdout = '';
let stderr = '';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function upload(file = sample, name = path.basename(file)) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'application/pdf' }), name);
  const res = await fetch(`${base}/api/files/upload`, { method: 'POST', body: form });
  const body = await res.json();
  assert(res.ok, `upload failed: ${JSON.stringify(body)}`);
  assert(typeof body.id === 'string' && body.id.length > 0, 'upload returned no id');
  return body.id;
}

async function submit(payload) {
  const res = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const taskId = await res.json();
  assert(res.ok, `task submit failed: ${JSON.stringify(taskId)}`);
  assert(typeof taskId === 'string' && taskId.length > 0, 'task submit returned no task id');
  return taskId;
}

async function poll(taskId) {
  let change;
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`${base}/api/tasks/${encodeURIComponent(taskId)}/change?_=${Date.now()}`);
    change = await res.json();
    if (change.status === 'Completed' || change.status === 'Failed' || change.status === 'Canceled') break;
    await sleep(250);
  }
  assert(change, 'no task status returned');
  return change;
}

async function download(taskId, change, filename) {
  const url = `${base}/api/tasks/${encodeURIComponent(taskId)}/download/${encodeURIComponent(change.resultFilename)}`;
  const res = await fetch(url);
  assert(res.ok, `download failed: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert(bytes.length === change.resultFileSize, 'downloaded size does not match metadata');
  const target = path.join(root, 'out', filename);
  fs.writeFileSync(target, bytes);
  return { bytes, target };
}

async function runOne(payload, outName, expectedItems, file = sample) {
  const fileId = await upload(file);
  const taskId = await submit({ ...payload, files: [fileId] });
  const change = await poll(taskId);
  assert(change.status === 'Completed', `task failed: ${JSON.stringify(change)}`);
  assert(Array.isArray(change.resultItems) && change.resultItems.length === expectedItems,
    `expected ${expectedItems} outputs, got ${JSON.stringify(change.resultItems)}`);
  const result = await download(taskId, change, outName);
  return { taskId, change, ...result };
}

async function pdfPageCount(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return doc.getPageCount();
}

async function pdfText(bytes) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    verbosity: 0
  }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str).join(' ');
  await doc.destroy();
  return text;
}

async function pdfTextItems(bytes, pageNumber = 1) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    verbosity: 0
  }).promise;
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const items = content.items.map((item) => ({
    text: item.str,
    x: item.transform?.[4] ?? null,
    y: item.transform?.[5] ?? null
  }));
  await doc.destroy();
  return items;
}

function readZipEntries(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  assert(eocd >= 0, 'ZIP end-of-central-directory not found');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    assert(buffer.readUInt32LE(offset) === 0x02014b50, 'bad ZIP central directory signature');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    assert(buffer.readUInt32LE(localOffset) === 0x04034b50, 'bad ZIP local header signature');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? compressed : zlib.inflateRawSync(compressed);
    entries.push({ name, data, method });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function jpegSize(bytes) {
  assert(bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8, 'not a JPEG');
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const length = bytes.readUInt16BE(i + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
    }
    i += 2 + length;
  }
  throw new Error('JPEG dimensions not found');
}

async function main() {
  assert(fs.existsSync(sample), `missing fixture: ${sample}`);
  assert(fs.existsSync(bookmarked), `missing fixture: ${bookmarked}`);

  const outputs = [
    'smoke-split.zip', 'smoke-merge.pdf', 'smoke-extract.zip', 'smoke-rotate.pdf',
    'smoke-bookmarks.zip', 'smoke-by-size.zip', 'smoke-mix.pdf',
    'smoke-header-footer.pdf', 'smoke-images.zip'
  ];
  for (const name of outputs) {
    fs.rmSync(path.join(root, 'out', name), { force: true });
  }

  server = spawn('java', [
    '-Djava.awt.headless=true',
    '--add-modules', 'jdk.httpserver',
    '-cp', `out${sep}lib/*`,
    'com.example.pdfpoc.Main'
  ], {
    cwd: root,
    env: { ...process.env, PORT: port },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (d) => { stdout += d.toString(); });
  server.stderr.on('data', (d) => { stderr += d.toString(); });

  let healthy = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) break;
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) {
        const body = await res.json();
        assert(body.status === 'ok', 'health status is not ok');
        healthy = true;
        break;
      }
    } catch {
      // wait
    }
    await sleep(250);
  }
  if (!healthy) {
    throw new Error(`server did not become healthy\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }

  // 1. splitByPages: four one-page PDFs in a ZIP.
  const splitFile = await upload();
  const splitTask = await submit({
    type: 'splitByPages',
    step: '1',
    pages: 'all',
    outputFilenamePattern: '[BASENAME]-[CURRENTPAGE]',
    files: [splitFile],
    uri: '/split-pdf'
  });
  const splitChange = await poll(splitTask);
  assert(splitChange.status === 'Completed', `split failed: ${JSON.stringify(splitChange)}`);
  assert(splitChange.resultItems.length === 4, `expected 4 split outputs, got ${JSON.stringify(splitChange.resultItems)}`);
  const split = await download(splitTask, splitChange, 'smoke-split.zip');
  assert(split.bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])), 'split output is not a ZIP');
  const splitEntries = readZipEntries(split.bytes);
  assert(splitEntries.length === 4, `expected 4 ZIP entries, got ${splitEntries.length}`);
  assert((await Promise.all(splitEntries.map((e) => pdfPageCount(e.data)))).reduce((a, b) => a + b, 0) === 4,
    'split outputs do not total 4 pages');

  // 2. merge: two fixtures, one 8-page PDF.
  const mergeA = await upload();
  const mergeB = await upload();
  const mergeTask = await submit({ type: 'merge', files: [mergeA, mergeB] });
  const mergeChange = await poll(mergeTask);
  assert(mergeChange.status === 'Completed', `merge failed: ${JSON.stringify(mergeChange)}`);
  assert(mergeChange.resultItems.length === 1, `expected 1 merge output, got ${JSON.stringify(mergeChange.resultItems)}`);
  const merge = await download(mergeTask, mergeChange, 'smoke-merge.pdf');
  assert(merge.bytes.subarray(0, 5).equals(Buffer.from('%PDF-')), 'merge output is not a PDF');
  assert(await pdfPageCount(merge.bytes) === 8, 'merge output should have 8 pages');

  // 3. extractPages: observed public default -> one PDF with source pages 1, 3 and 4.
  const extract = await runOne({
    type: 'extractPages',
    pages: '1,3-4',
    outputFilenamePattern: '[BASENAME]'
  }, 'smoke-extract.pdf', 1);
  assert(extract.bytes.subarray(0, 5).equals(Buffer.from('%PDF-')), 'extract output is not a PDF');
  assert(await pdfPageCount(extract.bytes) === 3, 'extract output should have 3 pages');

  // 4. rotatePages: observed per-page payload -> absolute rotations 90/0/180/270.
  const rotate = await runOne({
    type: 'rotatePages',
    outputFilenamePattern: '',
    pageRotationsPerSource: ['0:1:90', '0:3:180', '0:4:270']
  }, 'smoke-rotate.pdf', 1);
  assert(rotate.bytes.subarray(0, 5).equals(Buffer.from('%PDF-')), 'rotate output is not a PDF');
  assert(await pdfPageCount(rotate.bytes) === 4, 'rotate output should have 4 pages');
  const rotateDoc = await PDFDocument.load(rotate.bytes, { updateMetadata: false });
  assert(rotateDoc.getPages().map((page) => page.getRotation().angle).join(',') === '90,0,180,270',
    'rotate output should carry page rotations 90/0/180/270');

  // 5. splitByBookmarks: level 1 yields Chapter 1, 2, 3.
  const bookmarks = await runOne({
    type: 'splitByBookmarks',
    bookmarksLevel: '1',
    bookmarksExpression: 'Chapter',
    includePageAfter: false,
    outputFilenamePattern: '[FILENUMBER]_[BOOKMARK_NAME]'
  }, 'smoke-bookmarks.zip', 3, bookmarked);
  const bookmarkEntries = readZipEntries(bookmarks.bytes);
  assert(bookmarkEntries.length === 3, `expected 3 bookmark entries, got ${bookmarkEntries.length}`);
  assert((await Promise.all(bookmarkEntries.map((e) => pdfPageCount(e.data)))).reduce((a, b) => a + b, 0) === 4,
    'bookmark outputs do not total 4 pages');

  // 6. splitBySize: observed 1 KB target forces one chunk per page on this fixture.
  const bySize = await runOne({
    type: 'splitBySize',
    size: 1,
    sizeUnit: 'KB'
  }, 'smoke-by-size.zip', 4);
  const sizeEntries = readZipEntries(bySize.bytes);
  assert(sizeEntries.length === 4, `expected 4 size chunks, got ${sizeEntries.length}`);
  assert((await Promise.all(sizeEntries.map((e) => pdfPageCount(e.data)))).every((count) => count === 1),
    'size outputs should be one page each');
  assert((await Promise.all(sizeEntries.map((e) => pdfPageCount(e.data)))).reduce((a, b) => a + b, 0) === 4,
    'size outputs do not total 4 pages');

  // 7. alternateMix: A1, B1, A2, B2, ... -> 8 pages.
  const mixA = await upload();
  const mixB = await upload();
  const mixTask = await submit({
    type: 'alternateMix',
    files: [mixA, mixB],
    reverse: [false, false],
    step: [1, 1],
    repeat: [false, false]
  });
  const mixChange = await poll(mixTask);
  assert(mixChange.status === 'Completed', `alternateMix failed: ${JSON.stringify(mixChange)}`);
  const mix = await download(mixTask, mixChange, 'smoke-mix.pdf');
  assert(await pdfPageCount(mix.bytes) === 8, 'alternateMix output should have 8 pages');

  // 8. headerFooter: default page text, 4 pages, text extractable.
  const header = await runOne({
    type: 'headerFooter',
    outputFilenamePattern: '',
    pattern: 'Page [PAGE_ARABIC]',
    'hf-format-customize': ['Page', '[PAGE_ARABIC]', 'Page', '[PAGE_ROMAN]', 'Page', '[PAGE_ARABIC]', 'of', '[TOTAL_PAGES_ARABIC]', '[BASE_NAME]', 'Draft version'],
    pageLocation: 'top-center',
    font: 'times_roman',
    fontSize: 10,
    color: '#000000',
    addMargins: false,
    pages: '',
    pageCountStartFrom: ''
  }, 'smoke-header-footer.pdf', 1);
  assert(await pdfPageCount(header.bytes) === 4, 'header/footer output should have 4 pages');
  const headerText = await pdfText(header.bytes);
  const headerItems = await pdfTextItems(header.bytes, 1);
  assert(headerItems.some((item) => item.text === 'Page 1' && item.y > 780),
    `expected a Page 1 header above the body: ${JSON.stringify(headerItems)}`);

  // 9. pdfToImage: 4 JPGs at 150 dpi in a ZIP.
  const images = await runOne({
    type: 'pdfToImage',
    pages: '',
    allPages: true,
    resolution: 150,
    imageFormat: 'jpg',
    outputFilenamePattern: '[BASENAME]-[CURRENTPAGE]'
  }, 'smoke-images.zip', 4);
  const imageEntries = readZipEntries(images.bytes);
  assert(imageEntries.length === 4, `expected 4 image entries, got ${imageEntries.length}`);
  for (const entry of imageEntries) {
    assert(entry.name.toLowerCase().endsWith('.jpg'), `unexpected image name: ${entry.name}`);
    const size = jpegSize(entry.data);
    assert(size.width === 1240 && size.height === 1753,
      `unexpected JPEG dimensions for ${entry.name}: ${size.width}x${size.height}`);
  }

  // 10. Unsupported type still fails cleanly.
  const unsupportedFile = await upload();
  const unsupportedTask = await submit({ type: 'ocr', files: [unsupportedFile] });
  const unsupported = await poll(unsupportedTask);
  assert(unsupported.status === 'Failed', `unsupported task should fail, got ${JSON.stringify(unsupported)}`);

  const badUpload = await fetch(`${base}/api/files/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: 'not a pdf'
  });
  assert(badUpload.status === 400, `non-PDF upload should be 400, got ${badUpload.status}`);

  const badTask = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'splitByPages', files: ['missing-file-id'] })
  });
  assert(badTask.status === 400, `unknown file should be 400, got ${badTask.status}`);

  const badDownload = await fetch(`${base}/api/tasks/does-not-exist/download/x.pdf`);
  assert(badDownload.status === 404, `unknown task download should be 404, got ${badDownload.status}`);

  const deleteRes = await fetch(`${base}/api/tasks/${encodeURIComponent(splitTask)}`, { method: 'DELETE' });
  assert(deleteRes.ok, `delete failed: ${deleteRes.status}`);

  console.log(JSON.stringify({
    ok: true,
    base,
    sample,
    bookmarked,
    split: {
      taskId: splitTask,
      resultFilename: splitChange.resultFilename,
      resultFileSize: splitChange.resultFileSize,
      resultItems: splitChange.resultItems,
      downloaded: split.target,
      downloadedBytes: split.bytes.length
    },
    merge: {
      taskId: mergeTask,
      resultFilename: mergeChange.resultFilename,
      resultFileSize: mergeChange.resultFileSize,
      downloaded: merge.target,
      downloadedBytes: merge.bytes.length,
      pages: await pdfPageCount(merge.bytes)
    },
    extract: {
      taskId: extract.taskId,
      resultFilename: extract.change.resultFilename,
      resultItems: extract.change.resultItems,
      downloaded: extract.target,
      downloadedBytes: extract.bytes.length,
      pages: await pdfPageCount(extract.bytes)
    },
    rotate: {
      taskId: rotate.taskId,
      resultFilename: rotate.change.resultFilename,
      downloaded: rotate.target,
      downloadedBytes: rotate.bytes.length,
      rotations: rotateDoc.getPages().map((page) => page.getRotation().angle)
    },
    bookmarks: {
      taskId: bookmarks.taskId,
      resultFilename: bookmarks.change.resultFilename,
      resultItems: bookmarks.change.resultItems,
      downloaded: bookmarks.target,
      downloadedBytes: bookmarks.bytes.length
    },
    bySize: {
      taskId: bySize.taskId,
      resultFilename: bySize.change.resultFilename,
      resultItems: bySize.change.resultItems,
      downloaded: bySize.target,
      downloadedBytes: bySize.bytes.length
    },
    mix: {
      taskId: mixTask,
      resultFilename: mixChange.resultFilename,
      downloaded: mix.target,
      downloadedBytes: mix.bytes.length,
      pages: await pdfPageCount(mix.bytes)
    },
    headerFooter: {
      taskId: header.taskId,
      resultFilename: header.change.resultFilename,
      downloaded: header.target,
      downloadedBytes: header.bytes.length,
      page1Text: headerText.slice(0, 200)
    },
    pdfToImage: {
      taskId: images.taskId,
      resultFilename: images.change.resultFilename,
      resultItems: images.change.resultItems,
      downloaded: images.target,
      downloadedBytes: images.bytes.length,
      entries: imageEntries.map((e) => ({
        name: e.name,
        bytes: e.data.length,
        ...jpegSize(e.data)
      }))
    },
    unsupported: {
      taskId: unsupportedTask,
      status: unsupported.status,
      error: unsupported.error
    },
    serverLog: stdout.trim().split('\n').slice(0, 8)
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
    stdout: stdout.trim(),
    stderr: stderr.trim()
  }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  if (server && server.exitCode === null) {
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/F', '/T', '/PID', String(server.pid)], { stdio: 'ignore' });
      } catch {
        // already gone
      }
    } else {
      try { server.kill('SIGTERM'); } catch { /* ignore */ }
    }
    await sleep(300);
  }
  process.exit(process.exitCode ?? 0);
});
