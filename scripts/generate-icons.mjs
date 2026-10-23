// Reuse the existing Lucide Radar brand geometry for browser and home-screen icons.
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/favicon.svg',import.meta.url));
const sizes=[16,32,48,180,192,512],images=new Map();
for(const size of sizes){const png=await sharp(source).resize(size,size).png().toBuffer();images.set(size,png);await writeFile(new URL(`../public/icons/radar-${size}.png`,import.meta.url),png)}
const entries=[16,32,48],header=Buffer.alloc(6+16*entries.length);header.writeUInt16LE(1,2);header.writeUInt16LE(entries.length,4);let offset=header.length;
for(const [index,size] of entries.entries()){const at=6+16*index,png=images.get(size);header[at]=size;header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(png.length,at+8);header.writeUInt32LE(offset,at+12);offset+=png.length}
await writeFile(new URL('../app/favicon.ico',import.meta.url),Buffer.concat([header,...entries.map(size=>images.get(size))]));
const mask=source.toString().replace('rx="112"','rx="0"');await writeFile(new URL('../public/icons/radar-maskable-512.png',import.meta.url),await sharp(Buffer.from(mask)).png().toBuffer());
console.log('Radar SVG, PNG sizes, multi-size ICO and maskable icon generated.');
