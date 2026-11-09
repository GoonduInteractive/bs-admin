import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/api/auth";
import { ApiError, apiUpload, apiUploadMany } from "@/lib/api/client";
import { checkImage } from "@/lib/upload-client";

/**
 * POST multipart form data: one `file`, and get back `{ url }`; or several
 * `files`, and get back `{ urls }` in the same order.
 *
 * The files go on to the API's public storage - `POST /v1/files/upload` for
 * one, `POST /v1/files/multi-uploads` for several - and the URLs are theirs,
 * which is what product, volume and chapter records need.
 */
export async function POST(request: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData();
  const many = form.getAll("files").filter((f): f is File => f instanceof File);
  const one = form.get("file");
  const files = many.length ? many : one instanceof File ? [one] : [];
  if (!files.length) return NextResponse.json({ error: "No file" }, { status: 400 });

  for (const file of files) {
    const problem = checkImage(file);
    if (problem) return NextResponse.json({ error: problem }, { status: 422 });
  }

  try {
    return many.length
      ? NextResponse.json({ urls: await apiUploadMany(files) }, { status: 201 })
      : NextResponse.json({ url: await apiUpload(files[0]) }, { status: 201 });
  } catch (e) {
    const status = e instanceof ApiError && e.status >= 400 ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status });
  }
}
