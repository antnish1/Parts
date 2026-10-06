const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets', 'native');
fs.mkdirSync(OUT, { recursive: true });

const NAVY = [11, 42, 82, 255];
const RED = [216, 37, 40, 255];
const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

function canvas(w, h, bg = CLEAR) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    data[o] = bg[0]; data[o + 1] = bg[1]; data[o + 2] = bg[2]; data[o + 3] = bg[3];
  }
  return { w, h, data };
}

function px(c, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const o = (y * c.w + x) * 4;
  c.data[o] = color[0]; c.data[o + 1] = color[1]; c.data[o + 2] = color[2]; c.data[o + 3] = color[3];
}

function disk(c, cx, cy, r, color) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(c.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(c.h - 1, Math.ceil(cy + r));
  const rr = r * r;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= rr) px(c, x, y, color);
  }
}

function line(c, x0, y0, x1, y1, width, color) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) disk(c, x0 + dx * i / steps, y0 + dy * i / steps, width / 2, color);
}

function ellipseOutline(c, cx, cy, rx, ry, width, color) {
  const n = 720;
  let px0 = cx + rx, py0 = cy;
  for (let i = 1; i <= n; i++) {
    const a = Math.PI * 2 * i / n;
    const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
    line(c, px0, py0, x, y, width, color);
    px0 = x; py0 = y;
  }
}

const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],
  C:['01111','10000','10000','10000','10000','10000','01111'],
  E:['11111','10000','10000','11110','10000','10000','11111'],
  F:['11111','10000','10000','11110','10000','10000','10000'],
  I:['11111','00100','00100','00100','00100','00100','11111'],
  N:['10001','11001','11001','10101','10011','10011','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  ' ':['00000','00000','00000','00000','00000','00000','00000']
};

function text(c, str, cx, y, scale, color) {
  str = str.toUpperCase();
  const cw = 5 * scale, gap = scale * 2;
  const total = str.length * cw + Math.max(0, str.length - 1) * gap;
  let x = Math.round(cx - total / 2);
  for (const ch of str) {
    const glyph = FONT[ch] || FONT[' '];
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) if (glyph[gy][gx] === '1') {
      for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) px(c, x + gx * scale + xx, y + gy * scale + yy, color);
    }
    x += cw + gap;
  }
}

function drawFrontier(c, cx, cy, r, lineColor = BLACK, fill = RED, withWord = true) {
  disk(c, cx, cy, r, fill);
  ellipseOutline(c, cx, cy, r, r, Math.max(5, r * 0.025), lineColor);
  ellipseOutline(c, cx, cy, r * 0.55, r, Math.max(4, r * 0.018), lineColor);
  ellipseOutline(c, cx, cy, r * 0.25, r, Math.max(4, r * 0.018), lineColor);
  ellipseOutline(c, cx, cy, r, r * 0.58, Math.max(4, r * 0.018), lineColor);
  ellipseOutline(c, cx, cy, r, r * 0.28, Math.max(4, r * 0.018), lineColor);
  line(c, cx - r * 0.9, cy, cx + r * 0.9, cy, r * 0.14, lineColor);
  // Stylized Frontier mark in the upper hemisphere.
  line(c, cx - r * 0.15, cy - r * 0.48, cx + r * 0.28, cy - r * 0.48, r * 0.08, lineColor);
  line(c, cx - r * 0.15, cy - r * 0.48, cx - r * 0.15, cy - r * 0.15, r * 0.08, lineColor);
  line(c, cx - r * 0.15, cy - r * 0.31, cx + r * 0.12, cy - r * 0.31, r * 0.07, lineColor);
  line(c, cx + r * 0.22, cy - r * 0.5, cx - r * 0.02, cy - r * 0.08, r * 0.065, lineColor);
  if (withWord) text(c, 'FRONTIER', cx, Math.round(cy - r * 0.065), Math.max(4, Math.round(r / 30)), lineColor);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); t.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length);
  return out;
}

function writePng(file, c) {
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h);
  for (let y = 0; y < c.h; y++) {
    const ro = y * (c.w * 4 + 1); raw[ro] = 0;
    c.data.copy(raw, ro + 1, y * c.w * 4, (y + 1) * c.w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0); ihdr.writeUInt32BE(c.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(path.join(OUT, file), png);
}

const icon = canvas(1024, 1024, NAVY);
drawFrontier(icon, 512, 465, 335);
text(icon, 'PARTS CONNECT', 512, 845, 11, WHITE);
writePng('icon.png', icon);

const adaptive = canvas(1024, 1024, CLEAR);
drawFrontier(adaptive, 512, 512, 330);
writePng('adaptive-foreground.png', adaptive);

const mono = canvas(432, 432, CLEAR);
drawFrontier(mono, 216, 216, 155, WHITE, WHITE, false);
writePng('adaptive-monochrome.png', mono);

const notification = canvas(96, 96, CLEAR);
drawFrontier(notification, 48, 48, 34, WHITE, WHITE, false);
writePng('notification-icon.png', notification);

const splash = canvas(1024, 1024, CLEAR);
drawFrontier(splash, 512, 430, 250);
text(splash, 'PARTS CONNECT', 512, 740, 10, WHITE);
writePng('splash.png', splash);

console.log('Generated Frontier native assets in', OUT);
