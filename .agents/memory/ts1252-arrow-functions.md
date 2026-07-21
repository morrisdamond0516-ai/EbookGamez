---
name: TS1252 async function declarations inside blocks
description: TypeScript TS1252 — async function declarations inside Express route handler callbacks must be arrow functions
---

## Rule
Inside Express route handler callbacks (e.g. `app.get('/path', async (req, res) => { ... })`), declare inner async functions as `const` arrow functions, not as `async function` declarations.

## Why
TypeScript TS1252: "Function declarations are not allowed inside blocks in strict mode when targeting 'ES5'. Modules are automatically in strict mode." Even with ES2020 target, TypeScript still flags `async function` inside arrow function bodies in some configurations.

## How to apply
- WRONG: `async function gcsWithRetry<T>(...)` inside a route handler
- RIGHT: `const gcsWithRetry = async <T>(...)=>` 
- Affected files: server/index.ts (gcsWithRetry, colorWorker), server/routes.ts (edgeBrightness, colorWorker, worker)
