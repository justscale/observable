# @justscale/observable

A proxy-based observable system with dirty tracking for TypeScript.

## Features

- **Dirty tracking** - Know exactly which paths changed
- **Deep nesting** - Track changes at any depth with full parent paths
- **Shared references** - Same object in multiple locations tracks all paths
- **Cross-model sharing** - Share observables between models with independent dirty sets
- **Watch API** - Callback or async generator for change notifications
- **Built-in support** - Map, Set, Date, TypedArray, DataView all work

## Usage

### Models (with Zod schema)

```typescript
import { z } from "zod";
import { createModel, getModelInternals } from "@justscale/observable";

const schema = z.object({
  user: z.object({
    name: z.string().default(""),
    score: z.number().default(0),
  }),
  tags: z.array(z.string()).default([]),
});

const model = createModel(schema, { user: { name: "Alice" } });
const internals = getModelInternals(model);

model.user.score = 100;
model.tags.push("active");

internals.getDirtyPaths();
// ["user.score", "user", "tags.0", "tags"]

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

### Watching for changes

```typescript
import { watch } from "@justscale/observable";

// Callback mode
const handle = watch(model, (paths) => {
  console.log("Changed:", paths);
});
handle.unsubscribe();

// Async generator mode
const watcher = watch(model);
for await (const paths of watcher) {
  console.log("Changed:", paths);
  if (done) watcher.unsubscribe();
}
```

### Shared references

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

### Built-in objects

```typescript
const obs = createObservable({
  cache: new Map(),
  tags: new Set(),
  updated: new Date(),
});

obs.cache.set("key", "value");  // Tracks dirty: ["cache"]
obs.tags.add("new");            // Tracks dirty: ["tags"]
obs.updated.setFullYear(2025);  // Tracks dirty: ["updated"]
```

## Dirty Path Behavior

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

## Known Limitations

### 1. Private Fields

Classes with private fields (`#field`) throw TypeError:

```typescript
class Secret {
  #hidden = "secret";
  getHidden() { return this.#hidden; }
}

const obs = createObservable(new Secret());
obs.getHidden(); // TypeError!
```

**Why:** Methods are bound to the proxy to enable dirty tracking on `this.foo = x`. Private fields require `this` to be the exact instance.

### 2. Frozen/Sealed Objects

Cannot observe frozen or sealed objects:

```typescript
const frozen = Object.freeze({ value: 1 });
createObservable(frozen); // TypeError!

const sealed = Object.seal({ value: 1 });
createObservable(sealed); // TypeError!
```

**Why:** We need to attach a symbol property for internals access.

**Workaround:** Create observable first, then freeze if needed (writes will fail as expected).

### 3. Circular References

Circular references are handled correctly - no infinite loops:

```typescript
const obj = { self: null };
obj.self = obj;

const obs = createObservable(obj); // Works fine
obs.self.self.self; // Works fine
```

### 4. Built-in Internal Mutations

Built-in mutations track the container, not individual keys:

```typescript
obs.map.set("key", "value");
// Dirty: ["map"] - not ["map.key"]
```

**Why:** We can't intercept internal slot mutations granularly.

## Architecture

```
createModel/createObservable
         │
         ▼
  createTrackedProxy (recursive)
         │
         ├── ProxyMeta (per object)
         │   ├── path: string[]
         │   ├── dirtySets: Set<Set<string>>
         │   ├── parents: Set<{ref: WeakRef, key}>
         │   └── children: Map<key, ProxyMeta>
         │
         └── Proxy handlers
             ├── get: wrap nested objects, bind methods
             └── set/delete: mark dirty with parents
```

## Installation

```bash
pnpm add @justscale/observable zod
```

## License

MIT
