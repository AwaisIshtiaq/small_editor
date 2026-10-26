// External-binary runner (poppler/ghostscript/libreoffice/qpdf/tesseract).
// All subprocess artifacts must live inside the task workdir.

import { spawn } from 'child_process'
import { readFile, readdir, rename, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { PDFDocument } from '@cantoo/pdf-lib'
import sharp from 'sharp'
import { TaskError } from './errors'

const DEFAULT_TIMEOUT_MS = 120_000

export function runBin(
  cmd: string,
  args: string[],
  opts?: { timeoutMs?: number; cwd?: string; okExitCodes?: number[] },
): Promise<{ stdout: string; stderr: string }> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const okExit = opts?.okExitCodes ?? []
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts?.cwd })
    let stdout = ''
    let stderr = ''
    let done = false
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    const timer = setTimeout(() => {
      if (done) return
      done = true
      child.kill('SIGKILL')
      reject(new TaskError('FAILED', `${cmd} timed out after ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)
    child.on('error', (err) => {
      if (done) return
      done = true
      clearTimeout(timer)
      reject(new TaskError('FAILED', `${cmd} failed: ${err.message}`))
    })
    child.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      // e.g. qpdf exits 3 for "succeeded with warnings" — normal for repair jobs
      if (code === 0 || okExit.includes(code ?? -1)) resolve({ stdout, stderr })
      else {
        const reason = stderr.trim() || stdout.trim() || `exit code ${code ?? 'signal'}`
        reject(new TaskError('FAILED', `${cmd} failed: ${reason}`))
      }
    })
  })
}

// LibreOffice needs a private profile per invocation or concurrent runs clash.
export async function sofficeConvert(inputPath: string, outDir: string, targetExt = 'pdf'): Promise<string> {
  await runBin('soffice', [
    '--headless',
    `-env:UserInstallation=file://${outDir}/lo-profile`,
    '--convert-to',
    targetExt,
    '--outdir',
    outDir,
    inputPath,
  ])
  const base = inputPath.split('/').pop() ?? 'output'
  const stem = base.replace(/\.[^.]+$/, '')
  const outPath = join(outDir, `${stem}.${targetExt}`)
  try {
    await stat(outPath)
  } catch {
    throw new TaskError('FAILED', `soffice produced no ${targetExt} for ${base}`)
  }
  return outPath
}

const IMAGE_FLAG = { png: '-png', jpeg: '-jpeg', tiff: '-tiff' } as const
const IMAGE_EXT = { png: 'png', jpeg: 'jpg', tiff: 'tiff' } as const

export async function pdfToImages(
  inputPath: string,
  outDir: string,
  opts: { dpi: number; format: 'png' | 'jpeg' | 'tiff'; gray?: boolean },
): Promise<string[]> {
  const prefix = join(outDir, 'page')
  const args = [IMAGE_FLAG[opts.format], '-r', String(opts.dpi)]
  if (opts.gray) args.push('-gray')
  args.push(inputPath, prefix)
  await runBin('pdftoppm', args)
  const ext = IMAGE_EXT[opts.format]
  const names = (await readdir(outDir)).filter((n) => n.startsWith('page-') && n.endsWith(`.${ext}`))
  // pdftoppm zero-pads page numbers to the width of the max page number
  names.sort((a, b) => pageNum(a, ext) - pageNum(b, ext))
  if (names.length === 0) throw new TaskError('FAILED', 'pdftoppm produced no images')
  return names.map((n) => join(outDir, n))
}

function pageNum(name: string, ext: string): number {
  return parseInt(name.slice('page-'.length, name.length - ext.length - 1), 10)
}

export async function gsPdfWrite(
  inputs: string[],
  outPath: string,
  opts?: { gray?: boolean; settings?: 'screen' | 'ebook' | 'printer' | 'prepress' },
): Promise<string> {
  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.5',
    '-dNOPAUSE',
    '-dBATCH',
    '-dQUIET',
    `-o${outPath}`,
  ]
  if (opts?.settings) args.push(`-dPDFSETTINGS=/${opts.settings}`)
  if (opts?.gray) args.push('-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray')
  args.push(...inputs)
  await runBin('gs', args)
  try {
    await stat(outPath)
  } catch {
    throw new TaskError('FAILED', 'ghostscript produced no output')
  }
  return outPath
}

// gs reads gif/bmp/tiff/webp images directly; pdf-lib can only embed jpg/png.
// NOTE: this sandbox's gs (10.05.1 dfsg) has NO raster input delegates — it
// fails on raw images. So images are embedded via pdf-lib (jpg/png) or
// re-encoded to PNG via sharp (gif/tiff/webp); bmp falls back to soffice.
export async function gsImageToPdf(inputPath: string, outPath: string): Promise<string> {
  const buf = await readFile(inputPath)
  const isPng = buf.subarray(1, 4).toString('ascii') === 'PNG'
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8
  if (!isPng && !isJpg) {
    try {
      const png = await sharp(buf).png().toBuffer()
      return await imageToPdf(png, outPath)
    } catch {
      // sharp cannot read bmp — LibreOffice Draw can
      const converted = await sofficeConvert(inputPath, dirname(outPath), 'pdf')
      if (converted !== outPath) await rename(converted, outPath).catch(() => {})
      return outPath
    }
  }
  return imageToPdf(buf, outPath)
}

async function imageToPdf(img: Buffer, outPath: string): Promise<string> {
  const doc = await PDFDocument.create()
  const embedded = img.subarray(1, 4).toString('ascii') === 'PNG' ? await doc.embedPng(img) : await doc.embedJpg(img)
  const page = doc.addPage([embedded.width, embedded.height])
  page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
  await writeFile(outPath, Buffer.from(await doc.save()))
  return outPath
}

export async function qpdfRepair(inPath: string, outPath: string): Promise<string> {
  // exit 3 = "succeeded with warnings" — the normal outcome on damaged files
  await runBin('qpdf', ['--decrypt', inPath, outPath], { okExitCodes: [3] })
  try {
    await stat(outPath)
  } catch {
    throw new TaskError('FAILED', 'qpdf produced no output')
  }
  return outPath
}

export async function tesseractRun(pngPath: string, outBase: string, fmt: 'pdf' | 'txt'): Promise<string> {
  await runBin('tesseract', [pngPath, outBase, '-l', 'eng', fmt])
  const outPath = `${outBase}.${fmt}`
  try {
    await stat(outPath)
  } catch {
    throw new TaskError('FAILED', `tesseract produced no ${fmt} output`)
  }
  return outPath
}
