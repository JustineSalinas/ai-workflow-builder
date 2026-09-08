import { NextResponse } from "next/server";
import { getRun } from "@/lib/execution-store";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const state = getRun(runId);

  if (!state) {
    return NextResponse.json({ runId, status: "not_found" }, { status: 404 });
  }

  return NextResponse.json(state);
}
