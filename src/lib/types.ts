import type { Edge, Node } from "@xyflow/react";

/** Every workflow node is an AI decision step: a prompt that must resolve to YES or NO. */
export type DecisionStatus = "idle" | "running" | "yes" | "no" | "error";

export interface DecisionNodeData extends Record<string, unknown> {
  prompt: string;
  status: DecisionStatus;
  lastRaw?: string;
  isStart?: boolean;
}

export type DecisionNode = Node<DecisionNodeData, "decision">;

/** Edges are typed YES or NO — the only two paths a decision can take. */
export type EdgeKind = "yes" | "no";

export interface DecisionEdgeData extends Record<string, unknown> {
  kind: EdgeKind;
  active?: boolean;
}

export type DecisionEdge = Edge<DecisionEdgeData, "decision">;

export interface WorkflowDocument {
  name: string;
  nodes: DecisionNode[];
  edges: DecisionEdge[];
  startNodeId: string | null;
  savedAt: string;
}

/** What a single decide() step produces, before it's assigned its position in the run. */
export interface DecisionStepResult {
  nodeId: string;
  prompt: string;
  decision: "YES" | "NO" | "ERROR";
  raw: string;
  error?: string;
  startedAt: number;
  finishedAt: number;
}

export interface ExecutionStepLog extends DecisionStepResult {
  index: number;
  usedEdgeId?: string;
}

/** Payload for the "workflow/run.requested" event (see inngest/client.ts for why this is asserted, not inferred). */
export interface WorkflowRunRequestedData {
  runId: string;
  startNodeId: string;
  nodes: DecisionNode[];
  edges: DecisionEdge[];
}

export type ExecutionStatus = "running" | "completed" | "error" | "not_found";

export interface ExecutionState {
  runId: string;
  status: ExecutionStatus;
  startedAt: number;
  finishedAt?: number;
  currentNodeId: string | null;
  runningNodeId: string | null;
  activeEdgeId: string | null;
  steps: ExecutionStepLog[];
  error?: string;
}
