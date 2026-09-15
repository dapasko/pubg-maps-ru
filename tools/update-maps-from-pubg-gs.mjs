import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'maps');
const maps = {
  erangel: { tiles: 'https://cdn.wardo.gs/pubg/tiles/baltic', hash: '6ab4a113' },
  miramar: { tiles: 'https://cdn.wardo.gs/pubg/tiles/desert', hash: 'ecc67e93' },
  rondo: { tiles: 'https://cdn.wardo.gs/pubg/tiles/neon', hash: '674734d9' },
};

const requested = process.argv.slice(2);
const selected = requested.length ? requested : Object.keys(maps);
for (const slug of selected) {
  if (!maps[slug]) throw new Error(`Unknown map: ${slug}`);
}

async function fetchTile(baseUrl, hash, x, y) {
  const url = `${baseUrl}/5/${x}/${y}.webp?${hash}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  if (metadata.width !== 256 || metadata.height !== 256) {
    throw new Error(`${url}: expected 256 x 256, received ${metadata.width} x ${metadata.height}`);
  }
  return buffer;
}

async function buildFineTile(baseUrl, hash, x, y, destination) {
  const parts = await Promise.all([
    fetchTile(baseUrl, hash, x * 2, y * 2),
    fetchTile(baseUrl, hash, x * 2 + 1, y * 2),
    fetchTile(baseUrl, hash, x * 2, y * 2 + 1),
    fetchTile(baseUrl, hash, x * 2 + 1, y * 2 + 1),
  ]);
  await sharp({ create: { width: 512, height: 512, channels: 4, background: 'transparent' } })
    .composite([
      { input: parts[0], left: 0, top: 0 },
      { input: parts[1], left: 256, top: 0 },
      { input: parts[2], left: 0, top: 256 },
      { input: parts[3], left: 256, top: 256 },
    ])
    .webp({ quality: 100, effort: 6, smartSubsample: false })
    .toFile(destination);
}

async function buildMap(slug, source, stagingRoot) {
  const mapRoot = path.join(stagingRoot, slug);
  const fineRoot = path.join(mapRoot, '4');
  const coarseRoot = path.join(mapRoot, '3');
  await Promise.all([mkdir(fineRoot, { recursive: true }), mkdir(coarseRoot, { recursive: true })]);

  console.log(`Downloading ${slug} from PUBG build tiles`);
  const queue = [];
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) queue.push({ x, y });
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const { x, y } = queue.shift();
      const column = path.join(fineRoot, String(x));
      await mkdir(column, { recursive: true });
      await buildFineTile(source.tiles, source.hash, x, y, path.join(column, `${y}.webp`));
    }
  });
  await Promise.all(workers);

  const overview = path.join(mapRoot, `${slug}.webp`);
  const overviewParts = [];
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
    const input = await sharp(path.join(fineRoot, String(x), `${y}.webp`))
      .resize(256, 256, { kernel: sharp.kernel.lanczos3 })
      .toBuffer();
    overviewParts.push({ input, left: x * 256, top: y * 256 });
  }
  await sharp({ create: { width: 4096, height: 4096, channels: 4, background: 'transparent' } })
    .composite(overviewParts)
    .webp({ quality: 100, effort: 6, smartSubsample: false })
    .toFile(overview);

  const thumbnail = path.join(mapRoot, `${slug}-thumb.webp`);
  await sharp(overview)
    .resize(160, 160, { kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 90, effort: 6, smartSubsample: false })
    .toFile(thumbnail);

  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
    const column = path.join(coarseRoot, String(x));
    await mkdir(column, { recursive: true });
    await sharp(overview)
      .extract({ left: x * 512, top: y * 512, width: 512, height: 512 })
      .webp({ quality: 100, effort: 6, smartSubsample: false })
      .toFile(path.join(column, `${y}.webp`));
  }

  const metadata = await sharp(overview).metadata();
  if (metadata.width !== 4096 || metadata.height !== 4096) throw new Error(`${slug}: invalid overview dimensions`);
  return { overview, thumbnail, fineRoot, coarseRoot };
}

sharp.concurrency(2);
const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'pubg-map-update-'));
try {
  for (const slug of selected) {
    const built = await buildMap(slug, maps[slug], stagingRoot);
    await Promise.all([
      mkdir(path.join(output, 'full'), { recursive: true }),
      mkdir(path.join(output, 'thumb'), { recursive: true }),
    ]);
    await cp(built.overview, path.join(output, 'full', `${slug}.webp`), { force: true });
    await cp(built.thumbnail, path.join(output, 'thumb', `${slug}.webp`), { force: true });
    await cp(built.coarseRoot, path.join(output, 'tiles', slug, '3'), { recursive: true, force: true });
    await cp(built.fineRoot, path.join(output, 'tiles', slug, '4'), { recursive: true, force: true });
    console.log(`Updated ${slug}`);
  }
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
