import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function encodePNG(width, height, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // deflate
  ihdrData.writeUInt8(0, 11); // no filter
  ihdrData.writeUInt8(0, 12); // no interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image scanlines: filter byte (0) + RGBA for each pixel
  const rowSize = 1 + width * 4;
  const rawBuffer = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawBuffer[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawBuffer[pxOffset] = r;
      rawBuffer[pxOffset + 1] = g;
      rawBuffer[pxOffset + 2] = b;
      rawBuffer[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawBuffer);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Drawing function for Le P'tit Buro icon
// Colors:
// Background: #0d0f11 -> (13, 15, 17)
// Dark Plate: #1e2327 -> (30, 35, 39)
// Signal Orange: #ff8a1f -> (255, 138, 31)
// Orange Light: #ff9c40 -> (255, 156, 64)
// Seam / Border: #454f56 -> (69, 79, 86)
// White text: #e7e4dd -> (231, 228, 221)

function renderIconPixel(x, y, width, height, isMaskable = false) {
  const nx = x / width;
  const ny = y / height;
  const cx = 0.5;
  const cy = 0.5;
  const dx = nx - cx;
  const dy = ny - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Maskable icons have full bleed background
  const scale = isMaskable ? 0.72 : 0.88;
  const localX = (nx - 0.5) / scale + 0.5;
  const localY = (ny - 0.5) / scale + 0.5;

  // Background gradient: hull dark
  let r = 13 + Math.floor(ny * 12);
  let g = 15 + Math.floor(ny * 14);
  let b = 17 + Math.floor(ny * 16);
  let a = 255;

  // Outer rounded container
  if (!isMaskable) {
    const rx = 0.18;
    const qx = Math.max(0, Math.abs(dx) - (0.5 - rx));
    const qy = Math.max(0, Math.abs(dy) - (0.5 - rx));
    const cornerDist = Math.sqrt(qx * qx + qy * qy);
    if (cornerDist > rx) {
      return [0, 0, 0, 0]; // Transparent outside icon corner
    }
  }

  // Inside plate (Octagon shape in local coords)
  const px = Math.abs(localX - 0.5);
  const py = Math.abs(localY - 0.5);
  // Octagon condition: max(px, py) <= 0.44 && px + py <= 0.62
  const inOctagon = (px <= 0.42 && py <= 0.42 && (px + py) <= 0.60);
  const isOctagonBorder = inOctagon && (px >= 0.38 || py >= 0.38 || (px + py) >= 0.56);

  if (inOctagon) {
    if (isOctagonBorder) {
      // Signal Orange Border
      return [255, 138, 31, 255];
    }
    // Inner plate: metallic dark bevel
    const plateGrad = Math.floor((1 - (localY)) * 25);
    r = 30 + plateGrad;
    g = 35 + plateGrad;
    b = 39 + plateGrad;

    // Rugby ball stitch watermark
    const angle = -0.52; // -30 deg
    const rxBall = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ryBall = dx * Math.sin(angle) + dy * Math.cos(angle);
    const ballEq = (rxBall * rxBall) / (0.24 * 0.24) + (ryBall * ryBall) / (0.13 * 0.13);
    if (ballEq >= 0.94 && ballEq <= 1.04) {
      // Subtle dashed ellipse
      const stitchAngle = Math.atan2(ryBall, rxBall);
      if (Math.sin(stitchAngle * 14) > 0) {
        return [255, 138, 31, 200];
      }
    }

    // Monogram 'P' and 'B' raster representation in central area
    // Center is localX: 0.5, localY: 0.5
    // 'P' on left [0.28 .. 0.45], 'B' on right [0.55 .. 0.72], Y [0.34 .. 0.62]
    const cyCenter = localY;

    // Letter 'P' (left: 0.27 to 0.45, top: 0.35 to 0.63)
    const inPStem = (localX >= 0.29 && localX <= 0.34 && cyCenter >= 0.36 && cyCenter <= 0.62);
    const inPBarTop = (localX >= 0.34 && localX <= 0.44 && cyCenter >= 0.36 && cyCenter <= 0.41);
    const inPBarMid = (localX >= 0.34 && localX <= 0.44 && cyCenter >= 0.47 && cyCenter <= 0.52);
    const inPRight = (localX >= 0.41 && localX <= 0.46 && cyCenter >= 0.36 && cyCenter <= 0.52);
    const inP = inPStem || inPBarTop || inPBarMid || inPRight;

    // Letter 'B' (left: 0.54 to 0.71, top: 0.35 to 0.63)
    const inBStem = (localX >= 0.54 && localX <= 0.59 && cyCenter >= 0.36 && cyCenter <= 0.62);
    const inBTop = (localX >= 0.59 && localX <= 0.69 && cyCenter >= 0.36 && cyCenter <= 0.41);
    const inBMid = (localX >= 0.59 && localX <= 0.68 && cyCenter >= 0.47 && cyCenter <= 0.51);
    const inBBot = (localX >= 0.59 && localX <= 0.69 && cyCenter >= 0.57 && cyCenter <= 0.62);
    const inBLoopTop = (localX >= 0.66 && localX <= 0.71 && cyCenter >= 0.38 && cyCenter <= 0.49);
    const inBLoopBot = (localX >= 0.67 && localX <= 0.72 && cyCenter >= 0.49 && cyCenter <= 0.60);
    const inB = inBStem || inBTop || inBMid || inBBot || inBLoopTop || inBLoopBot;

    if (inP || inB) {
      // Vibrant signal orange lettering with bevel highlight
      const highlight = cyCenter < 0.48 ? 25 : 0;
      return [255, 138 + highlight, 31, 255];
    }

    // TOP 14 badge at bottom (localY: 0.66 to 0.73, localX: 0.34 to 0.66)
    if (localY >= 0.66 && localY <= 0.73 && localX >= 0.34 && localX <= 0.66) {
      if (localY <= 0.67 || localY >= 0.72 || localX <= 0.35 || localX >= 0.65) {
        return [69, 79, 86, 255]; // Badge border
      }
      return [13, 15, 17, 255]; // Badge dark fill
    }
  }

  return [r, g, b, a];
}

const ICONS_DIR = path.join(process.cwd(), 'icons');
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

const masterIconPath = path.join(ICONS_DIR, 'master-icon.jpg');

console.log('Generating PWA icons based on reference image...');

if (fs.existsSync(masterIconPath)) {
  import('child_process').then(({ execSync }) => {
    try {
      execSync(`convert "${masterIconPath}" -resize 512x512 "${path.join(ICONS_DIR, 'icon-512.png')}"`);
      console.log('✓ icon-512.png generated (512x512)');

      execSync(`convert "${masterIconPath}" -resize 192x192 "${path.join(ICONS_DIR, 'icon-192.png')}"`);
      console.log('✓ icon-192.png generated (192x192)');

      execSync(`convert "${masterIconPath}" -resize 180x180 "${path.join(ICONS_DIR, 'apple-touch-icon.png')}"`);
      console.log('✓ apple-touch-icon.png generated (180x180)');

      execSync(`convert -size 512x512 xc:"#000302" \\( "${masterIconPath}" -resize 410x410 \\) -gravity center -composite "${path.join(ICONS_DIR, 'icon-maskable-512.png')}"`);
      console.log('✓ icon-maskable-512.png generated (512x512 maskable)');

      console.log('All icons generated successfully from master-icon.jpg!');
      return;
    } catch (err) {
      console.warn('convert failed, using fallback generator:', err.message);
      generateFallback();
    }
  });
} else {
  generateFallback();
}

function generateFallback() {
  // 1. icon-192.png
  const png192 = encodePNG(192, 192, (x, y, w, h) => renderIconPixel(x, y, w, h, false));
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), png192);
  console.log('✓ icon-192.png generated (192x192)');

  // 2. icon-512.png
  const png512 = encodePNG(512, 512, (x, y, w, h) => renderIconPixel(x, y, w, h, false));
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), png512);
  console.log('✓ icon-512.png generated (512x512)');

  // 3. icon-maskable-512.png
  const pngMaskable = encodePNG(512, 512, (x, y, w, h) => renderIconPixel(x, y, w, h, true));
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable-512.png'), pngMaskable);
  console.log('✓ icon-maskable-512.png generated (512x512 maskable with safe-zone margin)');

  // 4. apple-touch-icon.png (180x180)
  const pngApple = encodePNG(180, 180, (x, y, w, h) => renderIconPixel(x, y, w, h, false));
  fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), pngApple);
  console.log('✓ apple-touch-icon.png generated (180x180)');

  console.log('All icons generated successfully!');
}
