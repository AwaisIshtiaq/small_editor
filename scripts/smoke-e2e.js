const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const BASE = 'http://127.0.0.1:' + (process.env.PORT || 3005);

async function makePdf(n) {
  const d = await PDFDocument.create();
  const p = d.addPage([400, 400]);
  p.drawText('smoke test doc ' + n, { x: 50, y: 300, size: 24 });
  return Buffer.from(await d.save());
}

(async () => {
  const health = await (await fetch(BASE + '/api/health')).json();
  console.log('health:', JSON.stringify(health).slice(0, 120));

  const results = [];
  for (const [name, bytes] of [['a.pdf', await makePdf(1)], ['b.pdf', await makePdf(2)]]) {
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type: 'application/pdf' }), name);
    const up = await (await fetch(BASE + '/api/upload', { method: 'POST', body: fd })).json();
    results.push((up.file || up.files?.[0])?.id);
  }
  console.log('uploaded:', results.length);

  const task = await (await fetch(BASE + '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'merge', fileIds: results, params: { normalizePageSizes: false, blankPageIfOdd: false } })
  })).json();
  console.log('task:', JSON.stringify(task).slice(0, 150));

  let tid = task.taskId || task.id;
  let done, tries = 0;
  while (tries++ < 20) {
    await new Promise(r => setTimeout(r, 500));
    done = await (await fetch(BASE + '/api/tasks/' + tid)).json();
    if (['done', 'completed', 'error', 'failed'].includes(done.status)) break;
  }
  console.log('final status:', done.status);

  const outId = done.outputs?.[0]?.id;
  const dl = await fetch(BASE + '/api/files/' + outId);
  const buf = Buffer.from(await dl.arrayBuffer());
  const out = await PDFDocument.load(buf);
  console.log('SMOKE TEST:', done.status === 'done' || done.status === 'completed' ? 'PASS' : 'FAIL', '| merged pages:', out.getPageCount());
  process.exit(done.status === 'done' || done.status === 'completed' ? 0 : 1);
})().catch(e => { console.error('SMOKE TEST: FAIL |', e.message); process.exit(1); });
