// Security E2E for the fixes from the vulnerability scan:
//  1. https link op        -> task done, real /URI (https://example.com) in output PDF
//  2. javascript: link op  -> rejected 400 INVALID_PARAMS
//  3. file: link op        -> rejected 400 INVALID_PARAMS
//  4. 6001 ops             -> rejected 400 (MAX_OPS)
//  5. rotate regression    -> task still done (engine path untouched)

import { readFileSync } from 'node:fs'
import { PDFDocument } from '@cantoo/pdf-lib'

async function linkUrisInPdf(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const out = []
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const subtype = obj?.get?.('Subtype')
    const st = subtype?.decodeText?.() ?? subtype?.toString?.() ?? ''
    if (!/Link/i.test(st)) continue
    const action = obj.lookup?.('A')
    const uri = action?.lookup?.('URI')
    if (uri) out.push(typeof uri.decodeText === 'function' ? uri.decodeText() : String(uri))
  }
  return out
}

const BASE = 'http://localhost:3000'
const PDF = readFileSync(new URL('./fixtures/editor-e2e.pdf', import.meta.url))

async function upload() {
  const fd = new FormData()
  fd.append('files', new Blob([PDF], { type: 'application/pdf' }), 'sec-test.pdf')
  const r = await fetch(`${BASE}/api/upload`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(`upload failed: ${r.status} ${await r.text()}`)
  const j = await r.json()
  return j.files[0].id
}

async function runTask(type, params, fileIds) {
  const r = await fetch(`${BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, fileIds, params }),
  })
  const j = await r.json().catch(() => ({}))
  if (r.status === 400) return { rejected: true, code: j.code, error: j.error }
  if (!r.ok) return { rejected: true, status: r.status, error: j.error ?? j }
  const id = j.taskId
  for (let i = 0; i < 120; i++) {
    const p = await fetch(`${BASE}/api/tasks?id=${id}`).then((x) => x.json())
    if (p.status === 'done') {
      const dl = await fetch(`${BASE}/api/files/${p.outputs[0].id}`)
      return { done: true, bytes: await dl.bytes(), disposition: dl.headers.get('content-disposition') }
    }
    if (p.status === 'failed') return { failed: true, error: p.error }
    await new Promise((res) => setTimeout(res, 500))
  }
  return { failed: true, error: { message: 'timeout polling task' } }
}

const file = await upload()
console.log('uploaded:', file)
let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', name, extra)
  ok ? pass++ : fail++
}

// 1 — legit https link works and lands in the PDF as a real URI action
const t1 = await runTask('pdf-editor', {
  ops: [{ kind: 'link', page: 1, x: 60, y: 60, width: 140, height: 24, url: 'https://example.com' }],
}, [file])
// Object streams hide dicts from naive greps — flatten first, then search.
async function flatBytes(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return Buffer.from(await doc.save({ useObjectStreams: false }))
}

const s1 = t1.done ? await flatBytes(Buffer.from(t1.bytes)) : Buffer.alloc(0)
const s1raw = s1.toString('latin1')
check('https link -> task done', !!t1.done)
check('output PDF link annotation URI = https://example.com', s1raw.includes('/URI (https://example.com)') && s1raw.includes('/Subtype /Link'))

// 2/3 — dangerous schemes rejected before a task is even created
const t2 = await runTask('pdf-editor', {
  ops: [{ kind: 'link', page: 1, x: 60, y: 60, width: 140, height: 24, url: 'javascript:alert(1)' }],
}, [file])
check('javascript: URL rejected', t2.rejected === true && /INVALID_PARAMS|must start/i.test(JSON.stringify(t2)), JSON.stringify(t2).slice(0, 120))

const t3 = await runTask('pdf-editor', {
  ops: [{ kind: 'link', page: 1, x: 60, y: 60, width: 140, height: 24, url: 'file:///etc/passwd' }],
}, [file])
check('file: URL rejected', t3.rejected === true && /INVALID_PARAMS|must start/i.test(JSON.stringify(t3)))

// 4 — ops array hard cap
const bigOps = Array.from({ length: 6001 }, () => ({ kind: 'rect', page: 1, x: 10, y: 10, width: 20, height: 20, color: '#ff0000' }))
const t4 = await runTask('pdf-editor', { ops: bigOps }, [file])
check('6001 ops rejected (max 5000)', t4.rejected === true && /too large/i.test(JSON.stringify(t4)))

// 5 — regression: a plain non-editor task still runs
const t5 = await runTask('rotate', { angle: 90 }, [file])
check('rotate regression: task done', !!t5.done)

// 6 — download headers: hostile filename must not carry CRLF through
const fd6 = new FormData()
fd6.append('files', new Blob([PDF], { type: 'application/pdf' }), 'bad\r\nname<x>.pdf')
const r6 = await fetch(`${BASE}/api/upload`, { method: 'POST', body: fd6 })
const j6 = await r6.json()
const up6 = j6.files[0]
const out6 = await runTask('rotate', { angle: 90 }, [up6.id])
const disp = out6.disposition ?? ''
const fnameVal = (disp.match(/filename="([^"]*)"/) ?? [])[1] ?? ''
check('CRLF and specials stripped from download filename', !/[\r\n<>;"\\]/.test(fnameVal) && /filename\*=UTF-8/.test(disp), disp.slice(0, 110))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
