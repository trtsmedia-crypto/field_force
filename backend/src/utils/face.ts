import { one } from '../db/pool.js';

export const EMBEDDING_LENGTH = 192;

export interface FaceSettings {
  threshold: number;
  maxAttempts: number;
  requireForDuty: boolean;
}

const DEFAULTS: FaceSettings = {
  threshold: 0.7,
  maxAttempts: 5,
  requireForDuty: true,
};

export async function faceSettings(): Promise<FaceSettings> {
  const row = await one<{ value: FaceSettings }>(
    `SELECT value FROM settings WHERE key = 'face'`,
  );
  return { ...DEFAULTS, ...(row?.value ?? {}) };
}

/**
 * Cosine similarity between two face embeddings, in 0..1.
 *
 * Both vectors come from the same MobileFaceNet model running on the
 * employee's own phone, which is why enrollment happens there too — an
 * embedding from a different model or a very different camera will not
 * compare meaningfully.
 */
export function similarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const cos = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  // Clamp: floating point can push a perfect match a hair past 1.
  return Math.max(0, Math.min(1, cos));
}

export function isValidEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === EMBEDDING_LENGTH &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}
