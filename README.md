# AI Workflow Builder

A visual editor for AI decision workflows. Each node is a question; the
model answers with exactly **YES** or **NO**; the answer picks which edge
to follow next. Build the graph with [React Flow](https://reactflow.dev),
run it through [Inngest](https://www.inngest.com) (one durable step per
node), and watch the active path animate live.

```
Is this a support request?
  YES → Does it mention a billing issue?
  NO  → Does the message ask about pricing?
```

## Quickstart

Two servers, both required:

```bash
npm install
cp .env.example .env.local        # OPENAI_API_KEY optional -- see "Running without a key" below
npm run dev            # Next.js app        -> http://localhost:3000
npm run inngest:dev    # Inngest Dev Server -> http://localhost:8288
```

Open [http://localhost:3000](http://localhost:3000). A demo workflow loads
by default (star icon = start node). Click **Run**.

### Running without an OpenAI key

If `OPENAI_API_KEY` is unset, `src/lib/decide.ts` falls back to a
**deterministic stub**: the same prompt always resolves to the same
YES/NO (hashed from the prompt text), tagged `[stub, no OPENAI_API_KEY set]`
in the raw output. This means the whole app — graph editing, Inngest
execution, branching, live status, history — is fully testable with zero
API cost. Add a real key any time to switch to live model calls; nothing
else changes.

## Project structure

```
src/
  app/
    page.tsx                 the editor + toolbar + log panel
    api/inngest/route.ts       Inngest's serve() handler
    api/workflow/run/route.ts   POST: validates input, sends the run event
    api/workflow/run/[runId]/route.ts  GET: polled for live run status
  components/
    flow/decision-node.tsx    the node: inline-editable prompt, status styling, YES/NO handles
    flow/decision-edge.tsx     the edge: YES(green)/NO(red), animated while active
    flow/flow-canvas.tsx        React Flow wrapper
    panels/toolbar.tsx          add node, run, save/load, export/import, reset
    panels/log-panel.tsx         live run steps + execution history
  inngest/
    client.ts                  the Inngest client
    functions.ts                 run-workflow: one step.run() per node, traverses by decision
  lib/
    types.ts                    shared types (nodes, edges, execution state)
    decide.ts                    the actual OpenAI call: schema-constrained, retried once, stubbable
    execution-store.ts            in-memory run registry, shared by the trigger + poll + Inngest function
    workflow-store.ts              client graph state (Zustand): editing, localStorage, JSON export/import
```

## How execution works

1. **Run** in the toolbar `POST`s `/api/workflow/run` with the current
   graph and start node. The route validates every node has a non-empty
   prompt (reject before spending a call), creates a run record, and
   sends a `workflow/run.requested` event to Inngest.
2. Inngest's `run-workflow` function picks it up. For each node it visits,
   `step.run("decide-<nodeId>", ...)` calls the model and returns a typed
   `YES`/`NO`/`ERROR` — **one Inngest step per node**, durable and retried
   independently by Inngest's own infrastructure.
3. The function follows whichever outgoing edge matches the decision
   (`data.kind === "yes" | "no"`). No matching edge = terminal node, run
   ends there. A cycle guard (each edge can only be traversed once) and a
   50-step cap stop a malformed graph from looping forever.
4. The frontend polls `GET /api/workflow/run/[runId]` every 600ms and
   updates node border colors, the active-edge animation, and the log
   panel from the same state Inngest is writing to.

`execution-store.ts` is a plain in-memory `Map`, intentionally — the
Inngest function and the two API routes all run in the same `next dev`
Node process, so no external store (Redis, a DB) is needed for local dev.
A production deploy on serverless infra would swap this for a real store
behind the same three functions (`createRun`, `appendStep`, `getRun`)
without touching anything else.

## Phase 4 (polish) — what's built

At least 3 required; this has 7:

- **Visual execution state** — node borders/icons shift idle → running
  (spinner) → yes (green) / no (red) / error, live during the run.
- **Execution logs panel** — every step (prompt, decision, duration) as it
  happens, plus a `error` banner if the run fails.
- **Execution history** — last 20 completed/errored runs, each with its
  full step list, in the History tab.
- **Save/load workflows** — `localStorage`, one click each.
- **JSON export/import** — download the graph as a `.json` file, or load
  one back in (validated: must have `nodes[]`/`edges[]`).
- **Better node styling** — color-coded status, YES/NO badges, a start-node
  star, inline click-to-edit prompts.
- **Animated active edges** — the edge the run is currently traversing
  gets a marching-ants dash animation and a glow.
- **Error handling** — 400 on bad input (before any model call), 502 on a
  non-retryable provider error, 504 on timeout, 422-equivalent via the
  run's `error` field when the model can't be coerced into YES/NO after a
  repair attempt; the kill switch pattern is available via `LLM_ENABLED`
  in `decide.ts` (unset by default — the stub fallback already gives every
  environment a zero-cost mode).

Not built: a "retry this one failed node" button (a full rerun via Run
covers most of the same need, but doesn't resume mid-graph).

## Notes on the LLM call itself

`decide()` in `src/lib/decide.ts` treats the model exactly like any other
untrusted external API: a strict system prompt demanding exactly one word,
`temperature: 0` for repeatable answers, a 20s timeout, zero SDK-level
retries (a `run-workflow` step already gets Inngest's own retry), and one
repair attempt — if the first answer isn't a clean YES/NO, it's sent back
with an explicit correction request before the step gives up and returns
`ERROR`.

## Environment variables

See `.env.example`. `OPENAI_API_KEY` is the only one you might actually
set for local dev (optional — see stub mode above). `OPENAI_BASE_URL` and
`OPENAI_MODEL` let you point at any OpenAI-compatible provider (OpenRouter,
etc.) instead of OpenAI directly. `INNGEST_DEV=1` tells the Inngest SDK to
talk to the local Dev Server instead of expecting cloud signing keys.
