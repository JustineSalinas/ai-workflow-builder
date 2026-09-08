"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useWorkflowStore } from "@/lib/workflow-store";
import type { DecisionEdge as DecisionEdgeType } from "@/lib/types";

export function DecisionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<DecisionEdgeType>) {
  const setEdgeKind = useWorkflowStore((s) => s.setEdgeKind);
  const kind = data?.kind ?? "yes";
  const active = data?.active ?? false;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = kind === "yes" ? "#10b981" : "#f43f5e";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: active ? 3 : 2,
          filter: active ? `drop-shadow(0 0 4px ${color})` : undefined,
        }}
        className={active ? "animated-edge" : undefined}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            backgroundColor: color,
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEdgeKind(id, kind === "yes" ? "no" : "yes");
          }}
          className="nodrag nopan cursor-pointer select-none rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white shadow"
          title="Double-click to flip YES/NO"
        >
          {kind}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
