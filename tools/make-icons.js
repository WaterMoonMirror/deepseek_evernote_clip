/* 生成扩展图标：无依赖，直接写 PNG 字节 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function roundRect(x, y, w, h, r, px, py) {
  const dx = Math.max(x - px, 0, px - (x + w));
  const dy = Math.max(y - py, 0, py - (y + h));
  return Math.hypot(dx, dy) <= r;
}

function draw(size) {
  const px = new Uint8Array(size * size * 4);
  const S = size;
  const green = [45, 190, 96];
  const greenDark = [29, 160, 78];
  const white = [255, 255, 255];

  const m = Math.round(S * 0.06);
  const radius = Math.round(S * 0.24);
  const pageX = Math.round(S * 0.28);
  const pageY = Math.round(S * 0.20);
  const pageW = Math.round(S * 0.44);
  const pageH = Math.round(S * 0.58);
  const lineH = Math.max(1, Math.round(S * 0.055));
  const lineGap = Math.round(S * 0.10);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let color = null;

      if (roundRect(m, m, S - 2 * m, S - 2 * m, radius, x + 0.5, y + 0.5)) {
        const t = y / S;
        color = [
          Math.round(green[0] + (greenDark[0] - green[0]) * t),
          Math.round(green[1] + (greenDark[1] - green[1]) * t),
          Math.round(green[2] + (greenDark[2] - green[2]) * t)
        ];

        if (roundRect(pageX, pageY, pageW, pageH, Math.round(S * 0.05), x + 0.5, y + 0.5)) {
          color = white;
          const lx = pageX + Math.round(S * 0.09);
          const lw = pageW - 2 * Math.round(S * 0.09);
          for (let k = 0; k < 3; k++) {
            const ly = pageY + Math.round(S * 0.13) + k * lineGap;
            if (y >= ly && y < ly + lineH && x >= lx && x < lx + (k === 2 ? lw * 0.55 : lw)) {
              color = [45, 190, 96];
            }
          }
        }
      }

      if (color) {
        px[i] = color[0];
        px[i + 1] = color[1];
        px[i + 2] = color[2];
        px[i + 3] = 255;
      }
    }
  }

  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0;
    px.subarray(y * S * 4, (y + 1) * S * 4).forEach((v, k) => {
      raw[y * (S * 4 + 1) + 1 + k] = v;
    });
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
[16, 32, 48, 128].forEach((size) => {
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), draw(size));
  console.log('icons/icon' + size + '.png');
});
