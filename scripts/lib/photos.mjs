// Finds photos on disk and (when the optional "sharp" package is installed)
// resizes them, so a 6 MB phone photo becomes a ~150 KB web image.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { natural, slugify, warn } from './util.mjs';

const IMG = /\.(jpe?g|png|webp|avif|gif)$/i;
const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

let sharp = null;
export async function loadSharp() {
  try {
    sharp = (await import('sharp')).default;
    sharp.cache(false);
  } catch {
    sharp = null;
  }
  return Boolean(sharp);
}

export async function listImages(dirAbs) {
  try {
    const names = await fs.readdir(dirAbs);
    return names.filter((n) => IMG.test(n) && !/^[._]/.test(n)).sort(natural);
  } catch {
    return [];
  }
}

/**
 * Returns an async function (absoluteFile, logicalPath) -> { src, srcset, w, h }.
 * logicalPath decides where the file lands in the site, e.g. photos/events/my-event/a.jpg
 */
export function createPhotoProcessor(outRoot) {
  const cache = new Map();
  return async function processPhoto(absSrc, logicalPath) {
    if (cache.has(absSrc)) return cache.get(absSrc);
    const parsed = path.posix.parse(logicalPath);
    const hash = crypto.createHash('md5').update(logicalPath).digest('hex').slice(0, 6);
    const stem = `${slugify(parsed.name) || 'photo'}-${hash}`;
    const outDir = path.join(outRoot, parsed.dir);
    await fs.mkdir(outDir, { recursive: true });
    const url = (file) => `/${parsed.dir}/${file}`;

    let result = null;
    if (sharp && parsed.ext.toLowerCase() !== '.gif') {
      try {
        const meta = await sharp(absSrc, { failOn: 'none' }).metadata();
        let w = meta.width;
        let h = meta.height;
        if (meta.orientation && meta.orientation >= 5) [w, h] = [h, w];
        const sizes = w <= 800 ? [w] : w <= 1600 ? [800, w] : [800, 1600];
        const outs = [];
        for (const size of sizes) {
          const file = `${stem}-${size}.webp`;
          await sharp(absSrc, { failOn: 'none' })
            .rotate()
            .resize({ width: size, withoutEnlargement: true })
            .webp({ quality: 78 })
            .toFile(path.join(outDir, file));
          outs.push({ size, file });
        }
        const big = outs[outs.length - 1];
        result = {
          src: url(big.file),
          srcset: outs.map((o) => `${url(o.file)} ${o.size}w`).join(', '),
          w: big.size,
          h: Math.round((h * big.size) / w),
        };
      } catch (err) {
        warn(`Could not resize ${logicalPath} (${err.message}); using the original file.`);
      }
    }
    if (!result) {
      const file = `${stem}${parsed.ext.toLowerCase()}`;
      await fs.copyFile(absSrc, path.join(outDir, file));
      result = { src: url(file), srcset: '', w: 0, h: 0 };
    }
    cache.set(absSrc, result);
    return result;
  };
}

/** Photos for one event: static/photos/events/<slug>/*  (cover.* is the card/hero image). */
export async function eventPhotos(ev, { staticRoot, processPhoto, dirOverride }) {
  const dir = dirOverride || path.join(staticRoot, 'photos', 'events', ev.slug);
  const names = await listImages(dir);
  const captions = ev.recap?.captions || {};
  let cover = null;
  const items = [];
  for (const name of names) {
    const p = await processPhoto(path.join(dir, name), `photos/events/${ev.slug}/${name}`);
    const isCover = /^cover\./i.test(name);
    const item = { ...p, name, caption: captions[name] || '' };
    if (isCover) cover = item;
    else items.push(item);
  }
  if (!cover && items.length) cover = items[0];
  const gallery = items.length ? items : cover ? [cover] : [];
  gallery.forEach((g, i) => {
    g.alt = g.caption || `${ev.title}: photograph ${i + 1} of ${gallery.length}`;
  });
  if (cover) cover.alt = cover.caption || `${ev.title}`;
  return { cover, gallery };
}

/** One photo for a named slot: static/photos/slots/<id>.<ext> */
export async function slotPhoto(id, { staticRoot, processPhoto }) {
  for (const ext of EXTS) {
    const file = path.join(staticRoot, 'photos', 'slots', `${id}.${ext}`);
    try {
      await fs.access(file);
      return await processPhoto(file, `photos/slots/${id}.${ext}`);
    } catch {
      /* try the next extension */
    }
  }
  return null;
}

/** General gallery photos: static/photos/gallery/* */
export async function galleryPhotos({ staticRoot, processPhoto, captions = {} }) {
  const dir = path.join(staticRoot, 'photos', 'gallery');
  const names = await listImages(dir);
  const out = [];
  for (const name of names) {
    const p = await processPhoto(path.join(dir, name), `photos/gallery/${name}`);
    out.push({ ...p, name, caption: captions[name] || '', alt: captions[name] || 'Photograph from a Shubhkant Foundation programme' });
  }
  return out;
}
