// SPDX-License-Identifier: Apache-2.0
// Generate the RPC test's PNG fixture from source; no binary is committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name, data) {
  const type = Buffer.from(name), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}

const width = 32, height = 32, header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;
const pixels = Buffer.alloc(height * (1 + width * 4));
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const offset = y * (1 + width * 4) + 1 + x * 4;
    pixels.set([0x16, 0x72, 0xee, 0xff], offset);
  }
}
const directory = new URL('./fixtures/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('icon.png', directory), Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
  chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))
]));
