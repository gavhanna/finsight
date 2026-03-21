/**
 * Generates PNG icons for the PWA manifest using only Node.js built-ins.
 * Creates a simple teal-on-dark icon for FinSight.
 */
import { deflateSync } from "node:zlib"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join, dirname } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

function crc32(buf) {
  let c = 0xffffffff
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let v = n
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1
    table[n] = v
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii")
  const body = Buffer.concat([typeBuf, data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function createPng(size) {
  // Parse hex colors
  const bg = [15, 23, 42]       // #0f172a  dark slate
  const accent = [20, 184, 166] // #14b8a6  teal

  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3) // filter byte + RGB per pixel
    row[0] = 0 // filter type None
    for (let x = 0; x < size; x++) {
      // Determine if pixel is in the inner accent square (50% centered)
      const pad = size * 0.25
      const inAccent =
        x >= pad && x < size - pad && y >= pad && y < size - pad
      const [r, g, b] = inAccent ? accent : bg
      row[1 + x * 3] = r
      row[2 + x * 3] = g
      row[3 + x * 3] = b
    }
    rows.push(row)
  }

  const raw = Buffer.concat(rows)
  const compressed = deflateSync(raw)

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type RGB
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

// Icons
for (const size of [192, 512]) {
  const png = createPng(size)
  const out = join(__dirname, `../public/icon-${size}.png`)
  writeFileSync(out, png)
  console.log(`Written ${out} (${png.length} bytes)`)
}

// Screenshots — solid dark-slate fill, browser will show them in the install UI
function createSolid(w, h, r, g, b) {
  const rows = []
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3)
    row[0] = 0
    for (let x = 0; x < w; x++) {
      row[1 + x * 3] = r
      row[2 + x * 3] = g
      row[3 + x * 3] = b
    }
    rows.push(row)
  }
  const raw = Buffer.concat(rows)
  const compressed = deflateSync(raw)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))])
}

// Mobile screenshot: 390×844 (portrait)
writeFileSync(join(__dirname, "../public/screenshot-mobile.png"), createSolid(390, 844, 15, 23, 42))
console.log("Written public/screenshot-mobile.png")

// Desktop screenshot: 1280×800 (landscape)
writeFileSync(join(__dirname, "../public/screenshot-desktop.png"), createSolid(1280, 800, 15, 23, 42))
console.log("Written public/screenshot-desktop.png")
