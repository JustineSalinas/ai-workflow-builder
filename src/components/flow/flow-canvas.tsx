"use client";

import { Background, Controls, MiniMap, ReactFlow, type EdgeTypes, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { useWorkflowStore } from "@/lib/workflow-store";
import { DecisionEdge } from "./decision-edge";
import { DecisionNode } from "./decision-node";

const nodeTypes: NodeTypes = { decision: DecisionNode };
const edgeTypes: EdgeTypes = { decision: DecisionEdge };

export function FlowCanvas() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);

  const defaultEdgeOptions = useMemo(() => ({ type: "decision" as const }), []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
      className="bg-muted/20"
    >
      <Background gap={20} />
      <Controls />
      <MiniMap pannable zoomable className="!bg-card" style={{ width: 120, height: 80 }} />
    </ReactFlow>
  );
}
