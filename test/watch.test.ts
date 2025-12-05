import { describe, it } from "node:test";
import assert from "node:assert";
import { z } from "zod";
import { createModel, getModelInternals, createObservable, getObservableInternals, watch } from "@justscale/observable";
import { assertExactPaths } from "./helpers.js";

describe("watch", () => {
  describe("callback-based watching", () => {
    it("should call callback when model changes", () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const calls: string[][] = [];
      watch(model, (paths) => {
        calls.push(paths);
      });

      model.count = 5;

      assert.strictEqual(calls.length, 1);
      assert.ok(calls[0].includes("count"));
    });

    it("should call callback when observable changes", () => {
      const obs = createObservable({ value: 1 });

      const calls: string[][] = [];
      watch(obs, (paths) => {
        calls.push(paths);
      });

      obs.value = 2;

      assert.strictEqual(calls.length, 1);
      assert.ok(calls[0].includes("value"));
    });

    it("should call callback multiple times for multiple changes", () => {
      const schema = z.object({ a: z.number().default(0), b: z.number().default(0) });
      const model = createModel(schema, {});

      const calls: string[][] = [];
      watch(model, (paths) => {
        calls.push(paths);
      });

      model.a = 1;
      model.b = 2;

      assert.strictEqual(calls.length, 2);
    });

    it("should allow unsubscribe", () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const calls: string[][] = [];
      const handle = watch(model, (paths) => {
        calls.push(paths);
      });

      model.count = 1;
      assert.strictEqual(calls.length, 1);

      handle.unsubscribe();

      model.count = 2;
      assert.strictEqual(calls.length, 1); // No new call after unsubscribe
    });

    it("should support multiple watchers", () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const calls1: string[][] = [];
      const calls2: string[][] = [];

      watch(model, (paths) => calls1.push(paths));
      watch(model, (paths) => calls2.push(paths));

      model.count = 5;

      assert.strictEqual(calls1.length, 1);
      assert.strictEqual(calls2.length, 1);
    });

    it("should watch nested changes", () => {
      const schema = z.object({
        user: z.object({
          name: z.string().default(""),
        }).default(() => ({ name: "" })),
      });
      const model = createModel(schema, {});

      const calls: string[][] = [];
      watch(model, (paths) => {
        calls.push(paths);
      });

      model.user.name = "Alice";

      assert.strictEqual(calls.length, 1);
      assert.ok(calls[0].some(p => p.includes("user")));
    });
  });

  describe("async generator watching", () => {
    it("should yield paths on changes", async () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const watcher = watch(model);

      // Make a change before waiting
      model.count = 1;

      // Should get the pending change immediately
      const result = await watcher.next();
      assert.strictEqual(result.done, false);
      assert.ok(result.value.includes("count"));

      watcher.unsubscribe();
    });

    it("should wait for changes when none pending", async () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const watcher = watch(model);

      // Start waiting for next change
      const promise = watcher.next();

      // Make a change after a short delay
      setTimeout(() => {
        model.count = 42;
      }, 10);

      const result = await promise;
      assert.strictEqual(result.done, false);
      assert.ok(result.value.includes("count"));

      watcher.unsubscribe();
    });

    it("should coalesce changes when consumer is slow (default)", async () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const watcher = watch(model);

      // Make multiple changes without consuming
      model.count = 1;
      model.count = 2;
      model.count = 3;

      // Should only get the latest state
      const result = await watcher.next();
      assert.strictEqual(result.done, false);
      // The paths array should contain "count" but we only get one yield
      assert.ok(result.value.includes("count"));

      // No more pending
      model.count = 4;
      const result2 = await watcher.next();
      assert.strictEqual(result2.done, false);
      assert.ok(result2.value.includes("count"));

      watcher.unsubscribe();
    });

    it("should unsubscribe cleanly", async () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const watcher = watch(model);

      watcher.unsubscribe();

      const result = await watcher.next();
      assert.strictEqual(result.done, true);
    });

    it("should return done when unsubscribed while waiting", async () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const watcher = watch(model);

      // Start waiting
      const promise = watcher.next();

      // Unsubscribe while waiting
      setTimeout(() => watcher.unsubscribe(), 10);

      const result = await promise;
      assert.strictEqual(result.done, true);
    });

    it("should work with for-await-of", async () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const watcher = watch(model);
      const received: string[][] = [];

      // Set up async iteration
      const iterPromise = (async () => {
        for await (const paths of watcher) {
          received.push(paths);
          if (received.length >= 2) {
            watcher.unsubscribe();
          }
        }
      })();

      // Make changes
      model.count = 1;
      await new Promise(r => setTimeout(r, 5));
      model.count = 2;

      await iterPromise;

      assert.strictEqual(received.length, 2);
    });

    it("should only yield once per change - second next() stays pending", async () => {
      const schema = z.object({ count: z.number().default(0) });
      const model = createModel(schema, {});

      const watcher = watch(model);

      // Make one change
      model.count = 1;

      // First next() should resolve immediately with the pending change
      const result1 = await watcher.next();
      assert.strictEqual(result1.done, false);
      assert.ok(result1.value.includes("count"));

      // Second next() should stay pending (no more changes)
      let secondResolved = false;
      const promise2 = watcher.next().then((r) => {
        secondResolved = true;
        return r;
      });

      // Give it some time to potentially resolve (it shouldn't)
      await new Promise(r => setTimeout(r, 50));

      assert.strictEqual(secondResolved, false, "Second next() should not resolve without a change");

      // Now make another change - it should resolve
      model.count = 2;

      const result2 = await promise2;
      assert.strictEqual(secondResolved, true);
      assert.strictEqual(result2.done, false);
      assert.ok(result2.value.includes("count"));

      watcher.unsubscribe();
    });
  });

  describe("watching shared observables", () => {
    it("should notify watchers on both models when shared observable changes", () => {
      const shared = createObservable({ value: 1 });

      const schema1 = z.object({ foo: z.any() });
      const schema2 = z.object({ bar: z.any() });

      const model1 = createModel(schema1, { foo: shared });
      const model2 = createModel(schema2, { bar: shared });

      const calls1: string[][] = [];
      const calls2: string[][] = [];

      watch(model1, (paths) => calls1.push(paths));
      watch(model2, (paths) => calls2.push(paths));

      // Modify through model1
      (model1.foo as { value: number }).value = 99;

      // Both watchers should be notified
      assert.strictEqual(calls1.length, 1);
      assert.strictEqual(calls2.length, 1);

      // With their respective paths
      assert.ok(calls1[0].some(p => p.startsWith("foo")));
      assert.ok(calls2[0].some(p => p.startsWith("bar")));
    });
  });
});
