// Diagnostic: run the PDF engine directly (bypassing HTTP) to see if
// handlers work once a file is in the store. Tests 5 representative tools.
import { readFileSync } from 'node:fs'
import { putFile } from '../src/lib/pdf-tools/store'
import { handlers } from '../src/lib/pdf-tools/handlers'
import { buildContext } from '../src/lib/pdf-tools/runner'

async function runTool(type: string, fileIds: string[], params: Record<string, unknown>) {
  try {
    const metas = []
    for (const id of fileIds) {
      const { getMeta } = await import('../src/lib/pdf-tools/store')
      const m = getMeta(id)
      if (!m) throw new Error(`no meta for ${id}`)
      metas.push(m)
    }
    const ctx = await buildContext(`diag-${type}-${Date.now()}`, metas, params)
    const result = await handlers[type]({ ...ctx, params })
    console.log(`PASS ${type} -> ${result.outputs.length} output(s): ${result.outputs.map((o: { name: string }) => o.name).join(', ')}`)
  } catch (e) {
    console.log(`FAIL ${type} -> ${(e as Error).message}`)
  }
}

async function main() {
  const buf = readFileSync('scripts/fixtures/alpha.pdf')
  const up = await putFile(buf, 'alpha.pdf', 'application/pdf')
  console.log(`upload ok: ${up.id} (${up.name}, pages=${(up as { pages?: number }).pages ?? '?'})`)
  const id = [up.id]

  await runTool('rotate', id, { angle: 90, pages: '' })
  await runTool('merge', id, { normalizePageSizes: false, blankPageIfOdd: false })
  await runTool('page-numbers', id, { position: 'footer-center', startAt: 1, pattern: '{n}', font: 'helvetica', fontSize: 12, pages: '', margin: 30 })
  await runTool('watermark', id, { text: 'DIAG', fontSize: 40, opacity: 0.5, rotation: 45, color: '#888888', position: 'center', scale: 1 })
  await runTool('pdf-to-jpg', id, { pages: '', resolution: 100, imageFormat: 'jpg', grayscale: false })
}

main().then(() => process.exit(0))
