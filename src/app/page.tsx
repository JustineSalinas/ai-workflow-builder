"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { LogPanel } from "@/components/panels/log-panel";
import { Toolbar } from "@/components/panels/toolbar";
import { useWorkflowStore } from "@/lib/workflow-store";
import type { ExecutionState } from "@/lib/types";

const POLL_INTERVAL_MS = 600;

export default function Home() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const startNodeId = useWorkflowStore((s) => s.startNodeId);
  const applyExecutionState = useWorkflowStore((s) => s.applyExecutionState);
  const resetExecutionVisuals = useWorkflowStore((s) => s.resetExecutionVisuals);

  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const startRun = useCallback(async () => {
    if (!startNodeId) return;
    setRunError(null);
    resetExecutionVisuals();

    const res = await fetch("/api/workflow/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes, edges, startNodeId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setRunError(body.error ?? `Failed to start run (HTTP ${res.status})`);
      return;
    }

    const { runId } = (await res.json()) as { runId: string };
    setIsRunning(true);

    pollRef.current = setInterval(async () => {
      try {
        const pollRes = await fetch(`/api/workflow/run/${runId}`);
        const state: ExecutionState = await pollRes.json();
        applyExecutionState(state);
        if (state.status === "completed" || state.status === "error" || state.status === "not_found") {
          stopPolling();
        }
      } catch {
        // transient network hiccup while polling -- keep trying until the interval is cleared
      }
    }, POLL_INTERVAL_MS);
  }, [nodes, edges, startNodeId, applyExecutionState, resetExecutionVisuals, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar onRun={startRun} isRunning={isRunning} onStop={stopPolling} />
      {runError && (
        <div className="border-b bg-red-50 px-3 py-1.5 text-xs text-red-700">{runError}</div>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="h-full min-w-0 flex-1">
          <FlowCanvas />
        </div>
        <LogPanel />
      </div>
    </div>
  );
}
