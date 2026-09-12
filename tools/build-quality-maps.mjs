/*
 * Creates display assets from the locally stored 8192×8192 PNG originals.
 * The originals stay outside the repository; the browser receives WebP
 * overviews and the detailed fragments it needs when zoomed in.
 */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const originals = path.resolve(root, '..', '..');
const output = path.join(root, 'public', 'maps');
const maps = {
  erangel: 'Erangel_Main_High_Res.png',
  miramar: 'Miramar_Main_High_Res.png',
  vikendi: 'Vikendi_Main_High_Res.png',
  taego: 'Taego_Main_High_Res.png',
  deston: 'Deston_Main_High_Res.png',
  rondo: 'Rondo_Main_High_Res.png',
};
const tileSize = 512;

async function writeTiles(slug, source, level) {
  const count = 2 ** level;
  const levelDir = path.join(output, 'tiles', slug, String(level));
  await mkdir(levelDir, { recursive: true });
  const image = level === 4 ? sharp(source) : sharp(source).resize(tileSize * count, tileSize * count, { kernel: sharp.kernel.lanczos3 });
  for (let x = 0; x < count; x += 1) {
    const column = path.join(levelDir, String(x));
    await mkdir(column, { recursive: true });
    const jobs = [];
    for (let y = 0; y < count; y += 1) {
      jobs.push(image.clone().extract({ left: x * tileSize, top: y * tileSize, width: tileSize, height: tileSize })
        .webp({ quality: 100, effort: 6, smartSubsample: false })
        .toFile(path.join(column, `${y}.webp`)));
    }
    await Promise.all(jobs);
  }
}

sharp.concurrency(2);
await mkdir(path.join(output, 'full'), { recursive: true });
for (const [slug, filename] of Object.entries(maps)) {
  const source = path.join(originals, filename);
  const metadata = await sharp(source).metadata();
  if (metadata.width !== 8192 || metadata.height !== 8192) throw new Error(`${filename} must be 8192 × 8192`);
  await stat(source);
  console.log(`Building ${slug} from ${filename}`);
  await sharp(source).resize(4096, 4096, { kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 100, effort: 6, smartSubsample: false })
    .toFile(path.join(output, 'full', `${slug}.webp`));
  await writeTiles(slug, source, 3);
  await writeTiles(slug, source, 4);
}
