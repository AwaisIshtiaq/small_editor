// Server-side E2E test for pdf-editor: upload PDF, run task with whiteout +
// link + text ops, download output, verify rect was drawn and link annot exists.
const BASE = 'http://localhost:3000'

async function main() {
  const pdf = await import('fs/promises').then((fs) => fs.readFile('/home/z/my-project/scripts/qa-sample.pdf'))

  // 1. upload
  const fd = new FormData()
  fd.append('files', new Blob([pdf], { type: 'application/pdf' }), 'qa-sample.pdf')
  const up = await fetch(`${BASE}/api/upload`, { method: 'POST', body: fd })
  const upJson = await up.json()
  console.log('upload:', up.status, JSON.stringify(upJson))
  if (!up.ok) process.exit(1)
  const fileId = upJson.files[0].id

  // 2. run pdf-editor task: whiteout over Line A + link on Line B + text
  const ops = {
    // display-space coords (top-left origin, A4 595.28x841.89 pt, zoom-independent)
    // Line A sits at y≈690-710pt from top (drawn at y=700 baseline from bottom)
    ops: [
      { kind: 'rect', page: 1, x: 50, y: 128, width: 300, height: 20, color: '#ffffff', opacity: 1, rotate: 0 }, // whiteout over Line A (baseline 700 from bottom ≈ 130 from top)
      { kind: 'link', page: 1, x: 50, y: 150, width: 300, height: 18, url: 'https://example.com/docs', rotate: 0 }, // link over Line B zone (baseline 680 ≈ 150 from top)
      { kind: 'text', page: 1, x: 60, y: 620, text: 'Added by QA', fontSize: 14, color: '#111827', rotate: 0 },
    ],
  }
  const tr = await fetch(`${BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'pdf-editor', fileIds: [fileId], params: ops }),
  })
  const trJson = await tr.json()
  console.log('task:', tr.status, JSON.stringify(trJson))
  if (!tr.ok) process.exit(1)
  const taskId = trJson.id ?? trJson.taskId

  // 3. poll
  let status = null
  let task = null
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const pr = await fetch(`${BASE}/api/tasks/${taskId}`)
    task = await pr.json()
    status = task.status
    if (status === 'done' || status === 'error') break
  }
  console.log('task status:', status, JSON.stringify(task).slice(0, 400))
  if (status !== 'done') process.exit(1)

  // 4. download
  const out = task.result?.outputs?.[0] ?? task.outputs?.[0]
  const outId = out?.id
  const dl = await fetch(`${BASE}/api/files/${outId}`)
  const buf = Buffer.from(await dl.arrayBuffer())
  console.log('download:', dl.status, buf.length, 'bytes')
  await import('fs/promises').then((fs) => fs.writeFile('/home/z/my-project/scripts/qa-edited.pdf', buf))

  // 5. verify output
  const { PDFDocument, PDFName } = await import('@cantoo/pdf-lib')
  const doc = await PDFDocument.load(buf)
  const page = doc.getPages()[0]
  const annots = page.node.Annots()
  console.log('page1 annots:', annots ? annots.size() : 0)
  if (annots) {
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i)
      const a = doc.context.lookup(ref)
      const subtype = a?.get(PDFName.of('Subtype'))?.toString()
      const rect = a?.get(PDFName.of('Rect'))?.toString()
      const action = a?.get(PDFName.of('A'))?.toString()
      const uri = a?.get(PDFName.of('A'))?.get?.(PDFName.of('URI'))?.toString?.() ?? a?.context?.lookup?.(a.get(PDFName.of('A')))?.get?.(PDFName.of('URI'))?.toString?.()
      console.log('annot', i, { subtype, rect, action, uri })
    }
  }
  const raw = buf.toString('latin1')
  console.log('has /URI:', raw.includes('/URI'))
  console.log('has example.com:', raw.includes('example.com'))
  console.log('has /Link:', raw.includes('/Link'))
  // whiteout = white-filled rect in content stream
  console.log('content has re+f fill op:', /\bre\b[\s\S]{0,40}\bf\b/.test(raw))
}
main().catch((e) => { console.error(e); process.exit(1) })
