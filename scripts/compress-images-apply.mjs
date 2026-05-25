import sharp from 'sharp';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const UPLOADS_DIR = 'public/images/uploads';
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
  const files = await getFiles(UPLOADS_DIR);
  let compressed = 0;

  for (const file of files) {
    const { size } = await stat(file);
    if (size <= MAX_BYTES) continue;

    console.log(`Compressing: ${basename(file)} (${Math.round(size/1024)}KB)`);
    await sharp(file)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, progressive: true })
      .toFile(file + '.tmp');

    await unlink(file);
    const { rename } = await import('node:fs/promises');
    await rename(file + '.tmp', file);

    const { size: newSize } = await stat(file);
    console.log(`  → ${Math.round(newSize/1024)}KB ✓`);
    compressed++;
  }

  console.log(`\nDone — ${compressed} file(s) compressed.`);
}

compress().catch(console.error);