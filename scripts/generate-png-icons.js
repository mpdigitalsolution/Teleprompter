const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal PNG generator without external dependencies
function createPNG(width, height, drawPixel) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data with row filter byte 0
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      scanlines[offset++] = r;
      scanlines[offset++] = g;
      scanlines[offset++] = b;
      scanlines[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(scanlines);

  // Helper to build chunk [length (4), type (4), data (N), crc (4)]
  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table & calculator
let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}

function crc32(buf) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Icon generator logic: Sleek dark cyan / purple glowing badge with eye icon
function drawIconPixel(x, y, w, h) {
  // Normalize coords from -1 to 1
  const nx = (x / w) * 2 - 1;
  const ny = (y / h) * 2 - 1;
  const dist = Math.sqrt(nx * nx + ny * ny);

  // Rounded square border
  const cornerR = 0.25;
  const qx = Math.max(0, Math.abs(nx) - (1 - cornerR));
  const qy = Math.max(0, Math.abs(ny) - (1 - cornerR));
  const boxDist = Math.sqrt(qx * qx + qy * qy);

  if (boxDist > cornerR) {
    return [0, 0, 0, 0]; // outside rounded box
  }

  // Border highlight
  if (boxDist > cornerR - 0.08 || Math.abs(nx) > 0.9 || Math.abs(ny) > 0.9) {
    return [0, 240, 255, 220]; // neon cyan border
  }

  // Prompter text line at top
  if (ny >= -0.65 && ny <= -0.50 && Math.abs(nx) <= 0.65) {
    return [0, 240, 255, 240];
  }
  if (ny >= -0.40 && ny <= -0.28 && nx >= -0.65 && nx <= 0.35) {
    return [255, 255, 255, 200];
  }

  // Eye contour
  const eyeY = ny - 0.25;
  const eyeCurve = 0.22 * (1 - (nx * 1.5) * (nx * 1.5));
  if (Math.abs(nx) <= 0.65) {
    if (Math.abs(eyeY) <= eyeCurve) {
      // Inside eye
      const pupilDist = Math.sqrt(nx * nx * 2.5 + eyeY * eyeY * 6);
      if (pupilDist < 0.18) {
        // Pupil center highlight
        if (nx > 0.03 && eyeY < -0.02) return [255, 255, 255, 255];
        return [10, 11, 16, 255]; // black pupil
      } else if (pupilDist < 0.38) {
        return [0, 240, 255, 255]; // cyan iris
      }
      return [25, 30, 50, 255]; // eye white/interior
    }
  }

  // Background gradient: dark navy/violet
  const bgGrad = (ny + 1) / 2;
  const r = Math.round(10 + bgGrad * 20);
  const g = Math.round(12 + bgGrad * 10);
  const b = Math.round(25 + bgGrad * 35);
  return [r, g, b, 250];
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const pngBuf = createPNG(size, size, drawIconPixel);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, pngBuf);
  console.log(`Generated: ${filePath} (${pngBuf.length} bytes)`);
});
