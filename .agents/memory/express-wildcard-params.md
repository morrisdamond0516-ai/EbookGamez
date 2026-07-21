---
name: Express wildcard param typing
description: req.params[0] for wildcard routes needs (req.params as any)[0] cast
---

## Rule
For Express wildcard routes (e.g. `app.get('/objstore/covers/*', ...)`), access the wildcard segment via `(req.params as any)[0] as string` not `req.params[0]`.

## Why
TypeScript doesn't allow numeric indexing on Express's Params type (`{ [key: string]: string }`). Even though Express runtime stores the wildcard at index 0, the TS type only allows string keys.

## How to apply
`const coverPath = (req.params as any)[0] as string;`
