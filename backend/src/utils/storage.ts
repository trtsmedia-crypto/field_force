import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? 'uploads';

/**
 * Saves a base64 JPEG and returns the public path.
 *
 * This writes to local disk, which is fine on a normal VPS but NOT on
 * platforms with ephemeral filesystems (Render/Railway free tiers wipe it on
 * every deploy). Point UPLOAD_DIR at a mounted volume, or swap this one
 * function for an S3 upload — nothing else needs to change.
 */
export function saveSelfie(
  base64: string,
  folder: 'faces' | 'attendance' | 'visits',
): string {
  const clean = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(clean, 'base64');

  if (buffer.length > 3 * 1024 * 1024) {
    throw new Error('Image is too large. Keep selfies under 3 MB.');
  }
  // A JPEG always starts FF D8 FF. Rejecting anything else stops arbitrary
  // files being written through this endpoint.
  if (!(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) {
    throw new Error('Only JPEG images are accepted.');
  }

  const dir = join(UPLOAD_DIR, folder);
  mkdirSync(dir, { recursive: true });

  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.jpg`;
  writeFileSync(join(dir, name), buffer);
  return `/uploads/${folder}/${name}`;
}
