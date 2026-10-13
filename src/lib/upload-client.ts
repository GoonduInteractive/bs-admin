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

/** Uploaded files are served by our own route; next/image need not optimise them. */
export function isUploaded(src: string) {
  return src.startsWith("/api/uploads/");
}
