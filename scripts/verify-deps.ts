// Verifies the risky APIs before the engine relies on them (RULES.md §5).
// 1) @cantoo/pdf-lib AES-256 encrypt → load-with-password → decrypt round-trip
// 2) fflate zip round-trip
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'
import { zipSync, unzipSync } from 'fflate'
import { writeFileSync, mkdirSync } from 'fs'

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failed++
}

async function main() {
  // -- build a small 2-page PDF
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= 2; i++) {
    const p = doc.addPage([595, 842])
    p.drawText(`verify page ${i}`, { x: 50, y: 800, size: 14, font })
  }
  const plain = await doc.save()

  // -- encrypt (AES-256) — exact @cantoo/pdf-lib API surface
  const enc = await PDFDocument.load(plain)
  try {
    ;(enc as any).encrypt({
      userPassword: 'user123',
      ownerPassword: 'owner456',
      permissions: { printing: 'highResolution', copying: false },
    })
    const cipher = await enc.save()
    check('encrypt() + save()', cipher.length > 0 && cipher !== plain)

    // -- load with password decrypts
    const dec = await PDFDocument.load(cipher, { password: 'user123' })
    check('load(cipher, { password })', dec.getPageCount() === 2)

    // -- UNLOCK path: copy pages into a fresh doc (save() alone keeps /Encrypt)
    const unlocked = await PDFDocument.create()
    const copied = await unlocked.copyPages(dec, dec.getPageIndices())
    copied.forEach((p) => unlocked.addPage(p))
    const plainOut = await unlocked.save()
    const re = await PDFDocument.load(plainOut)
    check('unlock via copy-pages is truly decrypted', re.getPageCount() === 2 && !re.isEncrypted)

    // -- wrong password must throw
    let wrongThrew = false
    try {
      await PDFDocument.load(cipher, { password: 'nope' })
    } catch {
      wrongThrew = true
    }
    check('wrong password rejected', wrongThrew)
  } catch (e) {
    check('encrypt() API shape', false, String(e))
  }

  // -- fflate zip
  const zipped = zipSync({ 'a.txt': new TextEncoder().encode('hello') })
  const unzipped = unzipSync(zipped)
  check('fflate zip round-trip', new TextDecoder().decode(unzipped['a.txt']) === 'hello')

  mkdirSync('scripts/fixtures', { recursive: true })
  writeFileSync('scripts/fixtures/plain.pdf', plain)
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll dependency checks passed')
  process.exit(failed ? 1 : 0)
}
main()
