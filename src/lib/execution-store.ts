import type { ExecutionState, ExecutionStepLog } from "@/lib/types";

/**
 * In-memory run registry, shared in-process between the API route that
 * starts a run, the Inngest function that executes it, and the API route
 * the frontend polls for live status. This works because `next dev` (and
 * the Inngest handler it serves at /api/inngest) run as one Node process --
 * no external store needed for a local dev demo. A real deployment would
 * swap this for Redis/a DB and keep the same interface.
 */

declare global {
  var __workflowRuns: Map<string, ExecutionState> | undefined;
}

const runs: Map<string, ExecutionState> = globalThis.__workflowRuns ?? new Map();
globalThis.__workflowRuns = runs;

const MAX_RUNS = 100;

function pruneIfNeeded() {
  if (runs.size <= MAX_RUNS) return;
  const oldestKey = runs.keys().next().value;
  if (oldestKey) runs.delete(oldestKey);
}

export function createRun(runId: string): ExecutionState {
  const state: ExecutionState = {
    runId,
    status: "running",
    startedAt: Date.now(),
    currentNodeId: null,
    runningNodeId: null,
    activeEdgeId: null,
    steps: [],
  };
  runs.set(runId, state);
  pruneIfNeeded();
  return state;
}

export function getRun(runId: string): ExecutionState | undefined {
  return runs.get(runId);
}

/** Call before invoking the model, so pollers can show this node as "running". */
export function setRunning(runId: string, nodeId: string) {
  const state = runs.get(runId);
  if (!state) return;
  state.runningNodeId = nodeId;
}

export function appendStep(runId: string, step: ExecutionStepLog, usedEdgeId?: string) {
  const state = runs.get(runId);
  if (!state) return;
  state.steps.push(step);
  state.currentNodeId = step.nodeId;
  state.runningNodeId = null;
  state.activeEdgeId = usedEdgeId ?? null;
}

export function markCompleted(runId: string) {
  const state = runs.get(runId);
  if (!state) return;
  state.status = "completed";
  state.finishedAt = Date.now();
  state.runningNodeId = null;
  state.activeEdgeId = null;
}

export function markError(runId: string, error: string) {
  const state = runs.get(runId);
  if (!state) return;
  state.status = "error";
  state.finishedAt = Date.now();
  state.error = error;
  state.runningNodeId = null;
  state.activeEdgeId = null;
}
