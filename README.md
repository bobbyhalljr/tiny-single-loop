# tiny-single-loop

A tiny TypeScript single agent loop with progressive disclosure.

- Skills and tools start as one-line descriptions.
- `load_skill` and `tool_search` load full bodies and schemas only when the task needs them.
- The harness enforces limits: tools must be loaded before they run, writes need approval, and a turn budget stops the loop.

Small model of the pattern in Anthropic's [When to fold subagents into your main agent loop](https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop), not Claude's implementation. Fake model, rough token estimate. No API key. No network.

```bash
npm install
npx tsx loop.ts
```

MIT, by Bobby Hall Jr.

Read the write-up on Dev.to: https://dev.to/bobbyhalljr/anthropic-says-fold-your-subagents-lets-build-a-tiny-single-agent-loop-in-typescript-1ba8
