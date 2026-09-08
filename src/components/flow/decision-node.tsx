"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CheckCircle2, Loader2, Star, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/workflow-store";
import type { DecisionNode as DecisionNodeType } from "@/lib/types";

const statusStyles: Record<string, string> = {
  idle: "border-border",
  running: "border-blue-500 ring-2 ring-blue-500/30 animate-pulse",
  yes: "border-emerald-500 ring-2 ring-emerald-500/30",
  no: "border-rose-500 ring-2 ring-rose-500/30",
  error: "border-red-600 ring-2 ring-red-600/40",
};

export function DecisionNode({ id, data, selected }: NodeProps<DecisionNodeType>) {
  const updatePrompt = useWorkflowStore((s) => s.updateNodePrompt);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const setStartNode = useWorkflowStore((s) => s.setStartNode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.prompt);

  const commit = () => {
    updatePrompt(id, draft.trim() || "Untitled question");
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "w-64 rounded-lg border-2 bg-card shadow-sm transition-colors nodrag-hover",
        statusStyles[data.status] ?? statusStyles.idle,
        selected && "outline outline-2 outline-primary/40"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />

      <div className="flex items-center justify-between gap-1 border-b bg-muted/40 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          {data.isStart && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>Start node</TooltipContent>
            </Tooltip>
          )}
          <StatusIcon status={data.status} />
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Decision
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!data.isStart && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setStartNode(id)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Set as start node</TooltipContent>
            </Tooltip>
          )}
          <button
            onClick={() => deleteNode(id)}
            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-2.5">
        {editing ? (
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
              if (e.key === "Escape") {
                setDraft(data.prompt);
                setEditing(false);
              }
            }}
            className="min-h-16 resize-none text-sm nodrag"
            placeholder="What question should the model answer with YES or NO?"
          />
        ) : (
          <p
            onClick={() => setEditing(true)}
            className="min-h-10 cursor-text text-sm leading-snug text-foreground"
            title="Click to edit"
          >
            {data.prompt || <span className="text-muted-foreground">Click to add a question…</span>}
          </p>
        )}
        {data.lastRaw && data.status === "error" && (
          <p className="mt-1.5 line-clamp-2 text-[11px] text-red-600">{data.lastRaw}</p>
        )}
      </div>

      <div className="flex items-center justify-between border-t px-2.5 py-1.5">
        <Badge variant="outline" className="border-emerald-500/50 text-[10px] text-emerald-600">
          YES →
        </Badge>
        <Badge variant="outline" className="border-rose-500/50 text-[10px] text-rose-600">
          NO →
        </Badge>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="yes"
        style={{ top: "35%" }}
        className="!bg-emerald-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="no"
        style={{ top: "70%" }}
        className="!bg-rose-500"
      />
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
  if (status === "yes") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "no") return <XCircle className="h-3.5 w-3.5 text-rose-500" />;
  if (status === "error") return <XCircle className="h-3.5 w-3.5 text-red-600" />;
  return <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />;
}
