import sharp from 'sharp';
import { readdir, stat, mkdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const UPLOADS_DIR = 'public/images/uploads';
const PREVIEW_DIR = 'public/images/uploads/_compressed';
const MAX_BYTES = 300 * 1024;
const MAX_WIDTH = 1200;
const QUALITY = 80;

async function getFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && ['.jpg','.jpeg','.png','.webp'].includes(extname(e.name).toLowerCase()))
    .map(e => join(dir, e.name));
}

async function compress() {
  await mkdir(PREVIEW_DIR, { recursive: true });
  const files = await getFiles(UPLOADS_DIR);
  let compressed = 0;

  for (const file of files) {
    const { size } = await stat(file);
    if (size <= MAX_BYTES) {
      console.log(`OK:   ${basename(file)} (${Math.round(size/1024)}KB) — skipped`);
      continue;
    }

    const outFile = join(PREVIEW_DIR, basename(file));
    await sharp(file)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, progressive: true })
      .toFile(outFile);

    const { size: newSize } = await stat(outFile);
    console.log(`COMPRESSED: ${basename(file)} ${Math.round(size/1024)}KB → ${Math.round(newSize/1024)}KB`);
    compressed++;
  }

  console.log(`\nDone — ${compressed} file(s) compressed to ${PREVIEW_DIR}`);
  console.log('Check the _compressed folder, then run compress-images-apply.mjs to replace originals.');
}

compress().catch(console.error);