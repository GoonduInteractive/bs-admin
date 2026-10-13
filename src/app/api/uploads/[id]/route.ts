import { getUpload } from "@/lib/upload-store";

export async function GET(_request: Request, { params }: RouteContext<"/api/uploads/[id]">) {
  const { id } = await params;
  const file = getUpload(id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.bytes, {
    headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
