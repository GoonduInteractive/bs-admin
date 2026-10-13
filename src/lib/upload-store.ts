import "server-only";

/**
 * MOCK file storage: uploads live in server memory until it restarts.
 *
 * Forms never send file bytes through a server action. They POST the file to
 * `/api/uploads`, get a URL back, and save that URL - the same flow a real
 * storage service (S3, Cloudinary, the game team's CDN) uses. Swapping this
 * out means changing the upload route, not the forms.
 */

type Stored = { bytes: ArrayBuffer; type: string; name: string };

// Kept on globalThis so dev hot-reloads don't drop uploaded files.
const g = globalThis as unknown as { __bsUploads?: Map<string, Stored> };
const store = (g.__bsUploads ??= new Map());

export const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

export function putUpload(file: Stored): string {
  const id = crypto.randomUUID();
  store.set(id, file);
  return id;
}

export function getUpload(id: string): Stored | undefined {
  return store.get(id);
}
