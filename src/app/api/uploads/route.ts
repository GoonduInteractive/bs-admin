import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/api/auth";
import { UPLOAD_MAX_BYTES, UPLOAD_TYPES, putUpload } from "@/lib/upload-store";

/** POST a single `file` as multipart form data; get back `{ url }`. */
export async function POST(request: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Use a PNG, JPG or WebP image" }, { status: 415 });
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "Images must be 15 MB or smaller" }, { status: 413 });
  }

  const id = putUpload({ bytes: await file.arrayBuffer(), type: file.type, name: file.name });
  return NextResponse.json({ url: `/api/uploads/${id}` }, { status: 201 });
}
