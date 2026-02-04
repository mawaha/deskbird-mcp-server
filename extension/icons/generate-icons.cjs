#!/usr/bin/env node

/**
 * Simple script to generate placeholder icons for the extension.
 * Run with: node generate-icons.js
 *
 * This creates simple colored squares as icons.
 * For production, replace these with proper designed icons.
 */

const fs = require('fs');
const path = require('path');

// Simple PNG generator for solid color icons
// This creates a minimal valid PNG file

function createPNG(size, r, g, b) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);         // bit depth
  ihdrData.writeUInt8(2, 9);         // color type (RGB)
  ihdrData.writeUInt8(0, 10);        // compression
  ihdrData.writeUInt8(0, 11);        // filter
  ihdrData.writeUInt8(0, 12);        // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk (image data)
  const zlib = require('zlib');

  // Create raw image data (filter byte + RGB for each pixel per row)
  const rawData = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowOffset = y * (1 + size * 3);
    rawData[rowOffset] = 0; // filter byte (none)
    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return crc ^ 0xFFFFFFFF;
}

function makeCRCTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

// Generate icons with a nice blue color (#3b82f6)
const sizes = [16, 48, 128];
const color = { r: 59, g: 130, b: 246 }; // Blue

sizes.forEach(size => {
  const png = createPNG(size, color.r, color.g, color.b);
  const filename = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
});

console.log('Done! Icons generated.');
