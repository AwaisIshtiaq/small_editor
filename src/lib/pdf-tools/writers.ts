// Office writers built on fflate zips + hand-rolled OOXML (minimal but valid),
// plus a pure-TS PNG codec (CRC32 + fflate inflate/deflate) used by crop,
// deskew and extract-images. No extra dependencies.

import { zipSync, zlibSync, unzlibSync } from 'fflate'
import { TaskError } from './errors'

const enc = new TextEncoder()
const u8 = (s: string): Uint8Array => enc.encode(s)

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

// ---------------------------------------------------------------- DOCX

export type DocxBlock = { text: string; bold?: boolean; size?: number; heading?: boolean }

export async function writeDocx(blocks: DocxBlock[]): Promise<Buffer> {
  const paragraphs = (blocks.length > 0 ? blocks : [{ text: '' }])
    .map((b) => {
      const size = b.size ?? (b.heading ? 32 : 22) // half-points, heading 16pt / body 11pt
      const rPr = `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${b.bold || b.heading ? '<w:b/>' : ''}`
      const pPr = b.heading ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' : ''
      return `<w:p>${pPr}<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${esc(b.text)}</w:t></w:r></w:p>`
    })
    .join('')

  const zip: Record<string, Uint8Array> = {
    '[Content_Types].xml': u8(
      `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': u8(
      `${XML_DECL}<Relationships xmlns="${RELS_NS}">` +
        `<Relationship Id="rId1" Type="${OFFICE_REL}/officeDocument" Target="word/document.xml"/>` +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        `<Relationship Id="rId3" Type="${OFFICE_REL}/extended-properties" Target="docProps/app.xml"/>` +
        '</Relationships>',
    ),
    'word/document.xml': u8(
      `${XML_DECL}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        `<w:body>${paragraphs}` +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>' +
        '</w:body></w:document>',
    ),
    'word/_rels/document.xml.rels': u8(
      `${XML_DECL}<Relationships xmlns="${RELS_NS}">` +
        `<Relationship Id="rId1" Type="${OFFICE_REL}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'word/styles.xml': u8(
      `${XML_DECL}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>' +
        '<w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="240" w:after="120"/></w:pPr>' +
        '<w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>' +
        '</w:styles>',
    ),
    'docProps/core.xml': u8(
      `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
        '<dc:creator>Small Editor</dc:creator></cp:coreProperties>',
    ),
    'docProps/app.xml': u8(
      `${XML_DECL}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">` +
        '<Application>Small Editor</Application></Properties>',
    ),
  }
  return Buffer.from(zipSync(zip))
}

// ---------------------------------------------------------------- XLSX

export async function writeXlsx(sheets: { name: string; rows: string[][] }[]): Promise<Buffer> {
  const NUMERIC = /^-?\d+(\.\d+)?$/
  const colLetter = (i: number): string => {
    let s = ''
    let n = i + 1
    while (n > 0) {
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s
      n = Math.floor((n - 1) / 26)
    }
    return s
  }

  const sheetXmls = sheets.map(({ rows }) => {
    const body = rows
      .map((row, r) => {
        const cells = row
          .map((val, c) => {
            const ref = `${colLetter(c)}${r + 1}`
            if (val !== '' && NUMERIC.test(val)) return `<c r="${ref}" t="n"><v>${val}</v></c>`
            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(val)}</t></is></c>`
          })
          .join('')
        return `<row r="${r + 1}">${cells}</row>`
      })
      .join('')
    return `${XML_DECL}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
  })

  const list = sheets.map((s, i) => ({ name: s.name, i: i + 1 }))
  const zip: Record<string, Uint8Array> = {
    '[Content_Types].xml': u8(
      `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        list.map((s) => `<Override PartName="/xl/worksheets/sheet${s.i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    ),
    '_rels/.rels': u8(
      `${XML_DECL}<Relationships xmlns="${RELS_NS}">` +
        `<Relationship Id="rId1" Type="${OFFICE_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        '</Relationships>',
    ),
    'xl/workbook.xml': u8(
      `${XML_DECL}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${list.map((s) => `<sheet name="${esc(s.name)}" sheetId="${s.i}" r:id="rId${s.i}"/>`).join('')}</sheets>` +
        '</workbook>',
    ),
    'xl/_rels/workbook.xml.rels': u8(
      `${XML_DECL}<Relationships xmlns="${RELS_NS}">` +
        list.map((s) => `<Relationship Id="rId${s.i}" Type="${OFFICE_REL}/worksheet" Target="worksheets/sheet${s.i}.xml"/>`).join('') +
        '</Relationships>',
    ),
  }
  sheetXmls.forEach((xml, i) => {
    zip[`xl/worksheets/sheet${i + 1}.xml`] = u8(xml)
  })
  return Buffer.from(zipSync(zip))
}

// ---------------------------------------------------------------- CSV

export function writeCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (/[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(','),
    )
    .join('\r\n')
}

// ---------------------------------------------------------------- PPTX

export async function writePptx(slides: { image: Buffer; ext: 'png' | 'jpg' }[]): Promise<Buffer> {
  const SLIDE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'
  const zip: Record<string, Uint8Array> = {
    '[Content_Types].xml': u8(
      `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Default Extension="jpg" ContentType="image/jpeg"/>' +
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
        slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${SLIDE_CT}"/>`).join('') +
        '</Types>',
    ),
    '_rels/.rels': u8(
      `${XML_DECL}<Relationships xmlns="${RELS_NS}">` +
        `<Relationship Id="rId1" Type="${OFFICE_REL}/officeDocument" Target="ppt/presentation.xml"/>` +
        '</Relationships>',
    ),
    'ppt/presentation.xml': u8(
      `${XML_DECL}<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
        `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst>` +
        '<p:sldSz cx="12192000" cy="6858000"/>' +
        '<p:notesSz cx="6858000" cy="9144000"/>' +
        '</p:presentation>',
    ),
    'ppt/_rels/presentation.xml.rels': u8(
      `${XML_DECL}<Relationships xmlns="${RELS_NS}">` +
        slides
          .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${OFFICE_REL}/slide" Target="slides/slide${i + 1}.xml"/>`)
          .join('') +
        '</Relationships>',
    ),
  }

  slides.forEach((s, i) => {
    const n = i + 1
    zip[`ppt/slides/slide${n}.xml`] = u8(
      `${XML_DECL}<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
        '<p:cSld><p:spTree>' +
        '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
        '<p:pic><p:nvPicPr><p:cNvPr id="2" name="Page"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>' +
        '<p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
        '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm>' +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>' +
        '</p:spTree></p:cSld></p:sld>',
    )
    zip[`ppt/slides/_rels/slide${n}.xml.rels`] = u8(
      `${XML_DECL}<Relationships xmlns="${RELS_NS}">` +
        `<Relationship Id="rId1" Type="${OFFICE_REL}/image" Target="../media/image${n}.${s.ext}"/>` +
        '</Relationships>',
    )
    zip[`ppt/media/image${n}.${s.ext}`] = new Uint8Array(s.image)
  })

  return Buffer.from(zipSync(zip))
}

// ---------------------------------------------------------------- PNG codec

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function pngChunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(data.length + 12)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  out.set(data, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])), data.length + 8)
  return out
}

export function encodePng(rgba: Uint8Array, width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = width * 4
  const raw = new Uint8Array(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1) // filter 0 per scanline
  }
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlibSync(raw, { level: 6 })),
    pngChunk('IEND', new Uint8Array(0)),
  ])
}

export function decodePng(buf: Buffer): { rgba: Uint8Array; width: number; height: number } {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) throw new TaskError('FAILED', 'Not a PNG file')
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat: Buffer[] = []
  let pos = 8
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0
  if (interlace !== 0 || bitDepth !== 8 || channels === 0) throw new TaskError('FAILED', 'Unsupported PNG')

  const stride = width * channels
  const raw = unzlibSync(Buffer.concat(idat))
  if (raw.length < height * (stride + 1)) throw new TaskError('FAILED', 'Corrupt PNG data')

  // Unfilter (types 0-4) into flat channel-major rows.
  const flat = new Uint8Array(height * stride)
  const prev = new Uint8Array(stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const ft = raw[p++]
    const cur = flat.subarray(y * stride, (y + 1) * stride)
    cur.set(raw.subarray(p, p + stride))
    p += stride
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prev[x]
      const c = x >= channels ? prev[x - channels] : 0
      let v = cur[x]
      if (ft === 1) v += a
      else if (ft === 2) v += b
      else if (ft === 3) v += (a + b) >> 1
      else if (ft === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (ft !== 0) {
        throw new TaskError('FAILED', 'Unsupported PNG')
      }
      cur[x] = v & 255
    }
    prev.set(cur)
  }

  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    if (channels === 1) {
      const g = flat[i]
      rgba[i * 4] = g
      rgba[i * 4 + 1] = g
      rgba[i * 4 + 2] = g
      rgba[i * 4 + 3] = 255
    } else if (channels === 3) {
      rgba.set(flat.subarray(i * 3, i * 3 + 3), i * 4)
      rgba[i * 4 + 3] = 255
    } else {
      rgba.set(flat.subarray(i * 4, i * 4 + 4), i * 4)
    }
  }
  return { rgba, width, height }
}
