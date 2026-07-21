---
name: callAIProvider missing definition
description: repair code paths in contentStudio.ts called undefined callAIProvider; how it was fixed
---

## Rule
Any code in contentStudio.ts that needs a simple `(prompt, temperature, maxTokens) → string` AI call must use the module-level `callAIProvider` helper, which now exists at line ~1352.

## Why
Three spots in the "intro-repair" and "chapter repair" paths called `callAIProvider(prompt, 0.7, 16000)` but the function was never defined anywhere in the file. Would throw `ReferenceError: callAIProvider is not defined` at runtime if those repair paths were triggered.

## How to apply
If adding new repair code in contentStudio.ts that needs a single-turn AI call, use `callAIProvider(prompt, temperature, maxTokens)` — it calls `getContentClient().chat.completions.create()` with gpt-4o-mini.
