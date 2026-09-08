import { Inngest } from "inngest";

/**
 * Event typing note: this version of the inngest package doesn't expose the
 * EventSchemas builder used by older versions, so the payload shape for
 * "workflow/run.requested" is asserted at the point of use (functions.ts and
 * the /api/workflow/run route) via the WorkflowRunRequestedData type in
 * @/lib/types, instead of being inferred through client generics.
 */
export const inngest = new Inngest({ id: "ai-workflow-builder" });
