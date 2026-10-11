import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getClientSession } from "@/lib/auth/session";
import { queryOne } from "@/lib/db/client";
import { isRecordId } from "@/lib/db/ids";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getClientSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!isRecordId(id)) return new NextResponse("Not found", { status: 404 });

  // Scoped to this client and only client-visible files, so a guessed id
  // cannot fetch another client's internal document.
  const file = await queryOne<{ name: string; mime_type: string | null; storage_key: string }>(
    "SELECT name, mime_type, storage_key FROM files WHERE id = $1 AND client_id = $2 AND client_visible = true",
    [id, session.clientId],
  );
  if (!file) return new NextResponse("Not found", { status: 404 });

  try {
    const data = await readFile(`${process.cwd()}/uploads/${file.storage_key}`);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mime_type ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.name.replace(/"/g, "")}"`,
      },
    });
  } catch {
    return new NextResponse("File missing on disk", { status: 404 });
  }
}
