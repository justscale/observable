# @justscale/observable

[![npm version](https://img.shields.io/npm/v/@justscale/observable.svg)](https://www.npmjs.com/package/@justscale/observable)
[![CI](https://github.com/justscale/observable/actions/workflows/ci.yml/badge.svg)](https://github.com/justscale/observable/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Proxy-based observable system with dirty tracking for TypeScript.

## Installation

```bash
npm install @justscale/observable zod
```

## Quick Start

```typescript
import { z } from "zod";
import { createModel, getModelInternals, watch } from "@justscale/observable";

// Define a schema
const schema = z.object({
  user: z.object({
    name: z.string().default(""),
    score: z.number().default(0),
  }),
});

// Create a model
const model = createModel(schema, { user: { name: "Alice" } });

// Watch for changes
watch(model, (paths) => console.log("Changed:", paths));

// Mutate - watchers are notified automatically
model.user.score = 100;
// logs: Changed: ["user.score", "user"]

// Check dirty state
const internals = getModelInternals(model);
internals.getDirtyPaths(); // ["user.score", "user"]
internals.markClean();
```

## Requirements

| Environment | Minimum Version |
|-------------|-----------------|
| Node.js     | 14.6+           |
| Chrome      | 84+             |
| Firefox     | 79+             |
| Safari      | 14.1+           |
| Edge        | 84+             |

Uses `WeakRef` for parent tracking. `structuredClone` is used when available (Node 17+) with automatic fallback.

## Features

- **Dirty tracking** - Know exactly which paths changed
- **Deep nesting** - Track changes at any depth with full parent paths
- **Shared references** - Same object in multiple locations tracks all paths
- **Watch API** - Callback or async generator (`for await`) for change notifications
- **Built-in support** - Map, Set, Date, TypedArray, DataView all work
- **Zod integration** - Schema validation with full type inference

## API

### Models (with Zod schema)

```typescript
import { z } from "zod";
import { createModel, getModelInternals } from "@justscale/observable";

const schema = z.object({
  tags: z.array(z.string()).default([]),
});

const model = createModel(schema, {});
const internals = getModelInternals(model);

model.tags.push("active");

internals.getDirtyPaths(); // ["tags.0", "tags"]
internals.isDirty();       // true
internals.markClean();
```

### Observables (without schema)

```typescript
import { createObservable, getObservableInternals } from "@justscale/observable";

const obs = createObservable({ count: 0, items: [] });
const internals = getObservableInternals(obs);

obs.count++;
obs.items.push("item");

internals.getDirtyPaths(); // ["count", "items.0", "items"]
```

### Watch API

```typescript
import { watch } from "@justscale/observable";

// Callback mode
const handle = watch(model, (paths) => {
  console.log("Changed:", paths);
});
handle.unsubscribe();

// Async generator - for await
const watcher1 = watch(model);
for await (const paths of watcher1) {
  console.log("Changed:", paths);
  if (shouldStop) watcher1.unsubscribe();
}

// Async generator - manual .next()
const watcher2 = watch(model);
const { value, done } = await watcher2.next();
if (!done) {
  console.log("Changed:", value);
}
watcher2.unsubscribe();
```

### Shared References

```typescript
const shared = createObservable({ value: 1 });

const model1 = createModel(schema1, { foo: shared });
const model2 = createModel(schema2, { bar: shared });

// Modify through either path
model1.foo.value = 99;

// Both track dirty with their respective paths
getModelInternals(model1).getDirtyPaths(); // ["foo.value", "foo"]
getModelInternals(model2).getDirtyPaths(); // ["bar.value", "bar"]
```

### Built-in Objects

```typescript
const obs = createObservable({
  cache: new Map(),
  tags: new Set(),
  updated: new Date(),
});

obs.cache.set("key", "value");  // Tracks: ["cache"]
obs.tags.add("new");            // Tracks: ["tags"]
obs.updated.setFullYear(2025);  // Tracks: ["updated"]
```

## Dirty Path Reference

| Operation | Dirty Paths |
|-----------|-------------|
| `obj.foo = 1` | `["foo"]` |
| `obj.a.b.c = 1` | `["a.b.c", "a.b", "a"]` |
| `arr.push(x)` | `["arr.0", "arr"]` |
| `arr.pop()` | `["arr.N", "arr.length", "arr"]` |
| `arr[0] = x` | `["arr.0", "arr"]` |
| `map.set(k, v)` | `["map"]` |
| `set.add(x)` | `["set"]` |
| `date.setFullYear(x)` | `["date"]` |

## Limitations

### Private Fields

Classes with private fields (`#field`) throw TypeError - methods are bound to the proxy which breaks private field access.

### Frozen/Sealed Objects

Cannot observe frozen or sealed objects - we need to attach a symbol property for internals.

### Built-in Granularity

Built-in mutations (Map, Set, Date) track the container, not individual keys - we can't intercept internal slot mutations granularly.

## License

MIT
