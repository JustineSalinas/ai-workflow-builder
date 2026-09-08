"use client";

import {
  Download,
  FolderOpen,
  Play,
  Plus,
  RotateCcw,
  Save,
  Square,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkflowStore } from "@/lib/workflow-store";
import type { WorkflowDocument } from "@/lib/types";

interface ToolbarProps {
  onRun: () => void;
  isRunning: boolean;
  onStop: () => void;
}

export function Toolbar({ onRun, isRunning, onStop }: ToolbarProps) {
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName);
  const addNode = useWorkflowStore((s) => s.addNode);
  const resetToDefault = useWorkflowStore((s) => s.resetToDefault);
  const saveToLocalStorage = useWorkflowStore((s) => s.saveToLocalStorage);
  const loadFromLocalStorage = useWorkflowStore((s) => s.loadFromLocalStorage);
  const exportDocument = useWorkflowStore((s) => s.exportDocument);
  const loadDocument = useWorkflowStore((s) => s.loadDocument);
  const startNodeId = useWorkflowStore((s) => s.startNodeId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const flash = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 1800);
  };

  const handleExport = () => {
    const doc = exportDocument();
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.name.replace(/\s+/g, "-").toLowerCase() || "workflow"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const doc: WorkflowDocument = JSON.parse(text);
      if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
        throw new Error("Not a valid workflow file");
      }
      loadDocument(doc);
      flash("Imported");
    } catch {
      flash("Import failed: invalid JSON");
    }
  };

  return (
    <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
      <Input
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        className="h-8 w-48 text-sm font-medium"
      />

      <div className="mx-1 h-6 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="outline" onClick={addNode}>
            <Plus className="h-4 w-4" /> Node
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add a new decision node</TooltipContent>
      </Tooltip>

      <div className="mx-1 h-6 w-px bg-border" />

      {!isRunning ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" onClick={onRun} disabled={!startNodeId}>
              <Play className="h-4 w-4" /> Run
            </Button>
          </TooltipTrigger>
          <TooltipContent>{startNodeId ? "Run workflow via Inngest" : "Set a start node first (click the star on a node)"}</TooltipContent>
        </Tooltip>
      ) : (
        <Button size="sm" variant="destructive" onClick={onStop}>
          <Square className="h-4 w-4" /> Stop watching
        </Button>
      )}

      <div className="mx-1 h-6 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              saveToLocalStorage();
              flash("Saved");
            }}
          >
            <Save className="h-4 w-4" /> Save
          </Button>
        </TooltipTrigger>
        <TooltipContent>Save to browser localStorage</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const ok = loadFromLocalStorage();
              flash(ok ? "Loaded" : "Nothing saved yet");
            }}
          >
            <FolderOpen className="h-4 w-4" /> Load
          </Button>
        </TooltipTrigger>
        <TooltipContent>Load from browser localStorage</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </TooltipTrigger>
        <TooltipContent>Download as JSON</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" onClick={handleImportClick}>
            <Upload className="h-4 w-4" /> Import
          </Button>
        </TooltipTrigger>
        <TooltipContent>Load a workflow JSON file</TooltipContent>
      </Tooltip>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />

      <div className="mx-1 h-6 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" onClick={resetToDefault}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset to the example workflow</TooltipContent>
      </Tooltip>

      {savedMessage && <span className="ml-2 text-xs text-muted-foreground">{savedMessage}</span>}
    </div>
  );
}
