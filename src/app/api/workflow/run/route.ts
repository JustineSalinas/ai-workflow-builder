import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { createRun } from "@/lib/execution-store";
import type { DecisionEdge, DecisionNode } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.nodes) || !Array.isArray(body.edges) || !body.startNodeId) {
    return NextResponse.json({ error: "Request body must include nodes[], edges[], and startNodeId." }, { status: 400 });
  }

  const nodes: DecisionNode[] = body.nodes;
  const edges: DecisionEdge[] = body.edges;
  const startNodeId: string = body.startNodeId;

  if (!nodes.some((n) => n.id === startNodeId)) {
    return NextResponse.json({ error: `startNodeId ${startNodeId} does not match any node.` }, { status: 400 });
  }
  const emptyPrompt = nodes.find((n) => !n.data?.prompt?.trim());
  if (emptyPrompt) {
    return NextResponse.json({ error: `Node ${emptyPrompt.id} has an empty prompt.` }, { status: 400 });
  }

  const runId = nanoid(10);
  createRun(runId);

  await inngest.send({
    name: "workflow/run.requested",
    data: { runId, startNodeId, nodes, edges },
  });

  return NextResponse.json({ runId });
}
