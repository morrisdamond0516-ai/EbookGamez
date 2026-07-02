---
name: Startup migrations must be deferred, not awaited
description: Pattern for one-time data-fixup/migration functions that run at server boot in this project
---

Any startup function that loops over DB rows and makes network calls (object storage checks/uploads, external API calls) must NOT be `await`ed in the critical path before `httpServer.listen()`. It must be scheduled via `setTimeout(...)` after the server starts, mirroring the existing `migrateIllustrationFiles`/`migrateColoringPageFiles` pattern in `server/index.ts`.

**Why:** An awaited full-table migration (e.g. `fixLocalCoverPaths` checking 637 `books` + drafts rows against object storage) blocks the port from binding. If the platform restarts the process before the migration finishes (health check timeout, deploy, crash), it restarts from scratch every time — a boot-crash loop that never serves traffic.

**How to apply:** When adding or reviewing any `server/index.ts` startup routine that touches many rows or does I/O:
1. Defer it with `setTimeout(fn, ms)` after `httpServer.listen()`/after other deferred migrations, never before.
2. Add a module-level boolean re-entrancy guard (set true at start, false in `finally`) so a second deferred invocation (fast restart, duplicate timer) can't run concurrently against the same rows.
3. Use a worker-pool/concurrency limiter (`Promise.all` over N workers pulling from a shared queue) instead of sequential awaits in a for-loop, when checking/uploading many rows.
