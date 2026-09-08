"use client";

import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkflowStore } from "@/lib/workflow-store";
import type { ExecutionState, ExecutionStepLog } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LogPanel() {
  const execution = useWorkflowStore((s) => s.execution);
  const history = useWorkflowStore((s) => s.executionHistory);
  const nodes = useWorkflowStore((s) => s.nodes);

  const nodePrompt = (nodeId: string) => nodes.find((n) => n.id === nodeId)?.data.prompt ?? nodeId;

  return (
    <div className="flex h-full w-96 flex-col border-l bg-card">
      <Tabs defaultValue="live" className="flex h-full flex-col">
        <TabsList className="mx-3 mt-3 w-fit">
          <TabsTrigger value="live">Live run</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="min-h-0 flex-1">
          <LiveRun execution={execution} nodePrompt={nodePrompt} />
        </TabsContent>

        <TabsContent value="history" className="min-h-0 flex-1">
          <History history={history} nodePrompt={nodePrompt} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Ticks once a second while `active` -- keeps the in-progress run's elapsed-time display live without calling Date.now() during render. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function LiveRun({
  execution,
  nodePrompt,
}: {
  execution: ExecutionState | null;
  nodePrompt: (id: string) => string;
}) {
  const now = useNow(execution?.status === "running");

  if (!execution) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No run yet. Set a start node and hit Run.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full px-3 pb-3">
      <div className="mb-2 flex items-center justify-between">
        <RunStatusBadge status={execution.status} />
        <span className="text-[11px] text-muted-foreground">
          {execution.finishedAt
            ? `${((execution.finishedAt - execution.startedAt) / 1000).toFixed(1)}s`
            : `${((now - execution.startedAt) / 1000).toFixed(1)}s…`}
        </span>
      </div>
      {execution.error && (
        <div className="mb-2 flex items-start gap-1.5 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{execution.error}</span>
        </div>
      )}
      <ol className="space-y-2">
        {execution.steps.map((step) => (
          <StepCard key={`${step.index}-${step.nodeId}`} step={step} nodePrompt={nodePrompt} />
        ))}
        {execution.status === "running" && execution.runningNodeId && (
          <li className="flex items-center gap-2 rounded border border-dashed border-blue-400 bg-blue-50 px-2.5 py-2 text-xs text-blue-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Evaluating: {nodePrompt(execution.runningNodeId)}
          </li>
        )}
      </ol>
    </ScrollArea>
  );
}

function History({
  history,
  nodePrompt,
}: {
  history: ExecutionState[];
  nodePrompt: (id: string) => string;
}) {
  if (history.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No completed runs yet.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full px-3 pb-3">
      <div className="space-y-3">
        {history.map((run) => (
          <div key={run.runId} className="rounded border p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <RunStatusBadge status={run.status} />
              <span className="text-[10px] text-muted-foreground">
                {new Date(run.startedAt).toLocaleTimeString()} ·{" "}
                {run.finishedAt ? `${((run.finishedAt - run.startedAt) / 1000).toFixed(1)}s` : "—"}
              </span>
            </div>
            <ol className="space-y-1.5">
              {run.steps.map((step) => (
                <StepCard key={`${run.runId}-${step.index}`} step={step} nodePrompt={nodePrompt} compact />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function StepCard({
  step,
  nodePrompt,
  compact,
}: {
  step: ExecutionStepLog;
  nodePrompt: (id: string) => string;
  compact?: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded border px-2.5 py-1.5 text-xs",
        step.decision === "YES" && "border-emerald-200 bg-emerald-50",
        step.decision === "NO" && "border-rose-200 bg-rose-50",
        step.decision === "ERROR" && "border-red-300 bg-red-50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-medium">
          <DecisionIcon decision={step.decision} />
          {step.decision}
        </span>
        {!compact && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {step.finishedAt - step.startedAt}ms
          </span>
        )}
      </div>
      <p className="mt-0.5 line-clamp-2 text-muted-foreground">{nodePrompt(step.nodeId)}</p>
      {step.error && <p className="mt-0.5 text-red-600">{step.error}</p>}
    </li>
  );
}

function DecisionIcon({ decision }: { decision: ExecutionStepLog["decision"] }) {
  if (decision === "YES") return <CheckCircle2 className="h-3 w-3 text-emerald-600" />;
  if (decision === "NO") return <XCircle className="h-3 w-3 text-rose-600" />;
  return <AlertCircle className="h-3 w-3 text-red-600" />;
}

function RunStatusBadge({ status }: { status: ExecutionState["status"] }) {
  const map: Record<string, { label: string; className: string }> = {
    running: { label: "Running", className: "border-blue-400 text-blue-700 bg-blue-50" },
    completed: { label: "Completed", className: "border-emerald-400 text-emerald-700 bg-emerald-50" },
    error: { label: "Error", className: "border-red-400 text-red-700 bg-red-50" },
    not_found: { label: "Not found", className: "border-muted text-muted-foreground" },
  };
  const cfg = map[status] ?? map.not_found;
  return (
    <Badge variant="outline" className={cn("text-[10px]", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
