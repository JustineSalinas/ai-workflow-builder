import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { decide } from "@/lib/decide";
import { appendStep, markCompleted, markError, setRunning } from "@/lib/execution-store";
import type { DecisionEdge, DecisionNode, DecisionStepResult, WorkflowRunRequestedData } from "@/lib/types";

const MAX_STEPS = 50; // guards against a cyclic graph looping forever

export const runWorkflow = inngest.createFunction(
  { id: "run-workflow", triggers: [{ event: "workflow/run.requested" }], retries: 1 },
  async ({ event, step }) => {
    const { runId, startNodeId, nodes, edges } = event.data as WorkflowRunRequestedData;

    const nodeById = new Map<string, DecisionNode>(nodes.map((n) => [n.id, n]));
    if (!nodeById.has(startNodeId)) {
      throw new NonRetriableError(`Start node ${startNodeId} not found in graph`);
    }

    let currentId: string | null = startNodeId;
    let stepIndex = 0;
    const visitedEdgeIds = new Set<string>(); // cycle guard: same edge taken twice = loop

    while (currentId && stepIndex < MAX_STEPS) {
      const node: DecisionNode | undefined = nodeById.get(currentId);
      if (!node) break;

      const nodeId = currentId; // stable capture for the closure below
      const idx = stepIndex;

      setRunning(runId, nodeId);

      const result: DecisionStepResult = await step.run(`decide-${nodeId}`, async () => {
        const startedAt = Date.now();
        try {
          const { decision, raw } = await decide(node.data.prompt);
          return {
            nodeId,
            prompt: node.data.prompt,
            decision,
            raw,
            startedAt,
            finishedAt: Date.now(),
          };
        } catch (err) {
          return {
            nodeId,
            prompt: node.data.prompt,
            decision: "ERROR" as const,
            raw: "",
            error: err instanceof Error ? err.message : String(err),
            startedAt,
            finishedAt: Date.now(),
          };
        }
      });

      if (result.decision === "ERROR") {
        appendStep(runId, { ...result, index: idx });
        markError(runId, result.error ?? "Unknown error");
        return { runId, status: "error" as const, error: result.error };
      }

      const outgoing: DecisionEdge[] = edges.filter((e: DecisionEdge) => e.source === nodeId);
      const nextEdge = outgoing.find((e: DecisionEdge) => e.data?.kind === result.decision.toLowerCase());

      appendStep(runId, { ...result, index: idx }, nextEdge?.id);

      if (!nextEdge) {
        // Terminal: this node's decision has no matching outgoing edge.
        currentId = null;
        break;
      }

      if (visitedEdgeIds.has(nextEdge.id)) {
        markError(runId, `Cycle detected: edge ${nextEdge.id} would be traversed twice.`);
        return { runId, status: "error" as const, error: "cycle detected" };
      }
      visitedEdgeIds.add(nextEdge.id);

      currentId = nextEdge.target;
      stepIndex++;
    }

    if (stepIndex >= MAX_STEPS) {
      markError(runId, `Exceeded maximum of ${MAX_STEPS} steps -- possible unbounded graph.`);
      return { runId, status: "error" as const, error: "max steps exceeded" };
    }

    markCompleted(runId);
    return { runId, status: "completed" as const };
  }
);
