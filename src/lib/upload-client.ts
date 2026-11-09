/** Browser side of uploads: validate, POST to /api/uploads, return the file's URL. */

export const ACCEPT_IMAGES = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 15 * 1024 * 1024;

export function checkImage(file: File): string | null {
  if (!ACCEPT_IMAGES.split(",").includes(file.type)) return `${file.name}: use a PNG, JPG or WebP image`;
  if (file.size > MAX_BYTES) return `${file.name}: images must be 15 MB or smaller`;
  return null;
}

export async function uploadImage(file: File): Promise<string> {
  const problem = checkImage(file);
  if (problem) throw new Error(problem);
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
  return json.url;
}

/**
 * A request's worth of files: up to ~4 MB together, so a batch stays under a
 * host's request cap (Vercel's is 4.5 MB). A bigger file goes on its own.
 */
const BATCH_BYTES = 4 * 1024 * 1024;

/** Splits files into batches for `uploadImages`, keeping their order. */
export function batchesOf(files: File[]): File[][] {
  const batches: File[][] = [];
  let current: File[] = [];
  let bytes = 0;
  for (const file of files) {
    if (current.length && bytes + file.size > BATCH_BYTES) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(file);
    bytes += file.size;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** Uploads one batch of images in a single request (`/v1/files/multi-uploads`); their URLs, in order. */
export async function uploadImages(files: File[]): Promise<string[]> {
  const problem = files.map(checkImage).find(Boolean);
  if (problem) throw new Error(problem);
  const body = new FormData();
  for (const file of files) body.append("files", file);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const json = (await res.json()) as { urls?: string[]; error?: string };
  if (!res.ok || json.urls?.length !== files.length) throw new Error(json.error ?? "Upload failed");
  return json.urls;
}

/**
 * Uploaded files are full URLs on the API's storage. next/image skips its
 * optimiser for them: the storage host isn't one next.config knows.
 */
export function isUploaded(src: string) {
  return /^https?:\/\//.test(src);
}
