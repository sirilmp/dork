import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../../config/env';

// Resolved once at startup; relative UPLOAD_DIR is relative to the server
// process's cwd (packages/server when run via npm scripts / the Dockerfile).
export const uploadRoot = path.isAbsolute(env.uploadDir) ? env.uploadDir : path.resolve(process.cwd(), env.uploadDir);

export function ensureUploadRoot() {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

/** Only alphanumeric extensions up to 10 chars are kept from the client's
 * original filename — everything else about the on-disk name is generated,
 * so a crafted filename (e.g. "../../etc/passwd" or one with embedded
 * `..`) can never influence the storage path. */
function safeExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

export function generateStorageKey(originalName: string): string {
  return `${crypto.randomUUID()}${safeExtension(originalName)}`;
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadRoot();
      cb(null, uploadRoot);
    },
    filename: (_req, file, cb) => cb(null, generateStorageKey(file.originalname)),
  }),
  limits: { fileSize: env.maxAttachmentMb * 1024 * 1024 },
});

export function storagePath(storageKey: string): string {
  // storageKey is always our own generated uuid[.ext] (never client input),
  // but resolve-and-check anyway as defense in depth against a future bug
  // that might pass through an unexpected key.
  const resolved = path.resolve(uploadRoot, storageKey);
  if (!resolved.startsWith(uploadRoot + path.sep)) {
    throw new Error('Invalid storage key');
  }
  return resolved;
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}
