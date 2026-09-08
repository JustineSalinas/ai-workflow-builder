"use client";

import {
  addEdge as rfAddEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { create } from "zustand";
import type {
  DecisionEdge,
  DecisionNode,
  DecisionStatus,
  EdgeKind,
  ExecutionState,
  WorkflowDocument,
} from "@/lib/types";

const STORAGE_KEY = "ai-workflow-builder:workflow";

function withStatus(node: DecisionNode, status: DecisionStatus): DecisionNode {
  return { ...node, data: { ...node.data, status } };
}

// Fixed (not nanoid-generated) IDs for the built-in demo graph: this object
// is constructed once at module scope and used as the store's initial
// state, which runs during both server render and client hydration. Random
// IDs there would differ between the two passes and break hydration --
// every *new* node/edge the user adds still gets a real nanoid(), just not
// this static seed data.
function defaultGraph(): { nodes: DecisionNode[]; edges: DecisionEdge[] } {
  const start: DecisionNode = {
    id: "seed-start",
    type: "decision",
    position: { x: 80, y: 160 },
    data: { prompt: "Is this a support request?", status: "idle", isStart: true },
  };
  const support: DecisionNode = {
    id: "seed-support",
    type: "decision",
    position: { x: 420, y: 40 },
    data: { prompt: "Does it mention a billing issue?", status: "idle" },
  };
  const sales: DecisionNode = {
    id: "seed-sales",
    type: "decision",
    position: { x: 420, y: 300 },
    data: { prompt: "Does the message ask about pricing?", status: "idle" },
  };
  const edges: DecisionEdge[] = [
    {
      id: "seed-edge-support",
      source: start.id,
      sourceHandle: "yes",
      target: support.id,
      type: "decision",
      data: { kind: "yes" },
    },
    {
      id: "seed-edge-sales",
      source: start.id,
      sourceHandle: "no",
      target: sales.id,
      type: "decision",
      data: { kind: "no" },
    },
  ];
  return { nodes: [start, support, sales], edges };
}

interface WorkflowStore {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
  startNodeId: string | null;
  workflowName: string;
  execution: ExecutionState | null;
  executionHistory: ExecutionState[];

  onNodesChange: (changes: NodeChange<DecisionNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<DecisionEdge>[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: () => void;
  updateNodePrompt: (id: string, prompt: string) => void;
  deleteNode: (id: string) => void;
  setStartNode: (id: string) => void;
  setEdgeKind: (id: string, kind: EdgeKind) => void;
  deleteEdge: (id: string) => void;

  setWorkflowName: (name: string) => void;
  resetToDefault: () => void;
  loadDocument: (doc: WorkflowDocument) => void;
  exportDocument: () => WorkflowDocument;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;

  applyExecutionState: (state: ExecutionState | null) => void;
  resetExecutionVisuals: () => void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  ...defaultGraph(),
  startNodeId: "seed-start",
  workflowName: "Untitled workflow",
  execution: null,
  executionHistory: [],

  onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
  onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
  onConnect: (connection) =>
    set((s) => {
      // The node has two source handles, "yes" and "no" -- which one the
      // user dragged from decides the edge's kind. Falls back to "yes" for
      // any connection that somehow arrives without a handle id.
      const kind: EdgeKind = connection.sourceHandle === "no" ? "no" : "yes";
      return {
        edges: rfAddEdge({ ...connection, type: "decision", data: { kind } } as DecisionEdge, s.edges),
      };
    }),

  addNode: () =>
    set((s) => {
      const id = nanoid(8);
      const node: DecisionNode = {
        id,
        type: "decision",
        position: { x: 120 + ((s.nodes.length * 60) % 480), y: 120 + ((s.nodes.length * 90) % 360) },
        data: { prompt: "New question...", status: "idle" },
      };
      return { nodes: [...s.nodes, node] };
    }),

  updateNodePrompt: (id, prompt) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, prompt } } : n)),
    })),

  deleteNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      startNodeId: s.startNodeId === id ? null : s.startNodeId,
    })),

  setStartNode: (id) =>
    set((s) => ({
      startNodeId: id,
      nodes: s.nodes.map((n) => ({ ...n, data: { ...n.data, isStart: n.id === id } })),
    })),

  setEdgeKind: (id, kind) =>
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, kind } } : e)),
    })),

  deleteEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  setWorkflowName: (name) => set({ workflowName: name }),

  resetToDefault: () => set({ ...defaultGraph(), startNodeId: "seed-start", execution: null }),

  loadDocument: (doc) =>
    set({
      nodes: doc.nodes,
      edges: doc.edges,
      startNodeId: doc.startNodeId,
      workflowName: doc.name,
      execution: null,
    }),

  exportDocument: () => {
    const s = get();
    return {
      name: s.workflowName,
      // Execution status/active-edge highlighting is run-time state, not
      // part of the workflow's definition -- strip it so a saved/exported
      // file always reopens looking idle, never mid-run.
      nodes: s.nodes.map((n) => withStatus(n, "idle")),
      edges: s.edges.map((e) => ({ ...e, data: { kind: e.data?.kind ?? "yes", active: false } })),
      startNodeId: s.startNodeId,
      savedAt: new Date().toISOString(),
    };
  },

  saveToLocalStorage: () => {
    if (typeof window === "undefined") return;
    const doc = get().exportDocument();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  },

  loadFromLocalStorage: () => {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const doc: WorkflowDocument = JSON.parse(raw);
      get().loadDocument(doc);
      return true;
    } catch {
      return false;
    }
  },

  applyExecutionState: (state) =>
    set((s) => {
      if (!state) return { execution: null };
      const statusByNode = new Map<string, "yes" | "no" | "error">();
      for (const step of state.steps) {
        if (step.decision === "YES") statusByNode.set(step.nodeId, "yes");
        else if (step.decision === "NO") statusByNode.set(step.nodeId, "no");
        else statusByNode.set(step.nodeId, "error");
      }
      const runningNodeId = state.status === "running" ? state.runningNodeId : null;

      const finished = state.status === "completed" || state.status === "error";
      const alreadyRecorded = s.executionHistory.some((h) => h.runId === state.runId);
      const executionHistory =
        finished && !alreadyRecorded ? [state, ...s.executionHistory].slice(0, 20) : s.executionHistory;

      return {
        execution: state,
        executionHistory,
        nodes: s.nodes.map((n) => {
          const found = statusByNode.get(n.id);
          if (found) return withStatus(n, found);
          if (n.id === runningNodeId) return withStatus(n, "running");
          return n.data.status === "idle" ? n : withStatus(n, "idle");
        }),
        edges: s.edges.map((e) => ({
          ...e,
          data: {
            kind: e.data?.kind ?? "yes",
            active: state.activeEdgeId === e.id && state.status === "running",
          },
        })),
      };
    }),

  resetExecutionVisuals: () =>
    set((s) => ({
      execution: null,
      nodes: s.nodes.map((n) => withStatus(n, "idle")),
      edges: s.edges.map((e) => ({ ...e, data: { kind: e.data?.kind ?? "yes", active: false } })),
    })),
}));
