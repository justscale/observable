import assert from "node:assert";
import { describe, it } from "node:test";
import {
  createModel,
  createObservable,
  getModelInternals,
  getObservableInternals,
} from "@justscale/observable";
import { z } from "zod";
import { assertExactPaths } from "./helpers.js";

describe("shared observable across models (README example)", () => {
  it("should track dirty paths independently per model with createObservable", () => {
    // Shared data
    const sharedProfile = createObservable({ name: "Alice", score: 100 });

    // Two different models, different schemas, same shared data
    const schema1 = z.object({ user: z.any() });
    const schema2 = z.object({ player: z.any() });

    const model1 = createModel(schema1, { user: sharedProfile });
    const model2 = createModel(schema2, { player: sharedProfile });

    // Modify through model1
    model1.user.score = 200;

    // Both models are dirty with their own paths
    assertExactPaths(getModelInternals(model1).getDirtyPaths(), ["user.score", "user"]);
    assertExactPaths(getModelInternals(model2).getDirtyPaths(), ["player.score", "player"]);

    // Both see the same value
    assert.strictEqual(model1.user.score, 200);
    assert.strictEqual(model2.player.score, 200);

    // Clean model1, model2 stays dirty
    getModelInternals(model1).markClean();
    assert.strictEqual(getModelInternals(model1).isDirty(), false);
    assert.strictEqual(getModelInternals(model2).isDirty(), true);
  });

  it("should also track dirty on the observable itself", () => {
    // Shared data
    const sharedProfile = createObservable({ name: "Alice", score: 100 });
    const sharedInternals = getObservableInternals(sharedProfile);

    // Two different models
    const schema1 = z.object({ user: z.any() });
    const schema2 = z.object({ player: z.any() });

    const model1 = createModel(schema1, { user: sharedProfile });
    const model2 = createModel(schema2, { player: sharedProfile });

    // Modify through model1
    model1.user.score = 200;

    // The observable itself should track dirty at its own root level
    assertExactPaths(sharedInternals.getDirtyPaths(), ["score"]);

    // Models track at their own paths
    assertExactPaths(getModelInternals(model1).getDirtyPaths(), ["user.score", "user"]);
    assertExactPaths(getModelInternals(model2).getDirtyPaths(), ["player.score", "player"]);

    // Cleaning the observable doesn't clean the models
    sharedInternals.markClean();
    assert.strictEqual(sharedInternals.isDirty(), false);
    assert.strictEqual(getModelInternals(model1).isDirty(), true);
    assert.strictEqual(getModelInternals(model2).isDirty(), true);

    // Cleaning model1 doesn't clean model2
    getModelInternals(model1).markClean();
    assert.strictEqual(getModelInternals(model1).isDirty(), false);
    assert.strictEqual(getModelInternals(model2).isDirty(), true);
  });

  it("should handle modification through model2 (via player path)", () => {
    const sharedProfile = createObservable({ name: "Alice", score: 100 });

    const schema1 = z.object({ user: z.any() });
    const schema2 = z.object({ player: z.any() });

    const model1 = createModel(schema1, { user: sharedProfile });
    const model2 = createModel(schema2, { player: sharedProfile });

    // Modify through model2 this time
    model2.player.name = "Bob";

    // Both models should be dirty with their respective paths
    assertExactPaths(getModelInternals(model1).getDirtyPaths(), ["user.name", "user"]);
    assertExactPaths(getModelInternals(model2).getDirtyPaths(), ["player.name", "player"]);

    // Both see the same value
    assert.strictEqual(model1.user.name, "Bob");
    assert.strictEqual(model2.player.name, "Bob");
  });

  it("should handle modification directly on the observable", () => {
    const sharedProfile = createObservable({ name: "Alice", score: 100 });
    const sharedInternals = getObservableInternals(sharedProfile);

    const schema1 = z.object({ user: z.any() });
    const schema2 = z.object({ player: z.any() });

    const model1 = createModel(schema1, { user: sharedProfile });
    const model2 = createModel(schema2, { player: sharedProfile });

    // Modify directly on the observable
    sharedProfile.score = 300;

    // All three should be dirty
    assertExactPaths(sharedInternals.getDirtyPaths(), ["score"]);
    assertExactPaths(getModelInternals(model1).getDirtyPaths(), ["user.score", "user"]);
    assertExactPaths(getModelInternals(model2).getDirtyPaths(), ["player.score", "player"]);

    // All see the same value
    assert.strictEqual(sharedProfile.score, 300);
    assert.strictEqual(model1.user.score, 300);
    assert.strictEqual(model2.player.score, 300);
  });

  it("should handle multiple properties changed", () => {
    const sharedProfile = createObservable({ name: "Alice", score: 100 });

    const schema1 = z.object({ user: z.any() });
    const schema2 = z.object({ player: z.any() });

    const model1 = createModel(schema1, { user: sharedProfile });
    const model2 = createModel(schema2, { player: sharedProfile });

    // Modify multiple properties
    model1.user.score = 200;
    model2.player.name = "Bob";

    // Both models should have both paths dirty
    assertExactPaths(getModelInternals(model1).getDirtyPaths(), [
      "user.score",
      "user.name",
      "user",
    ]);
    assertExactPaths(getModelInternals(model2).getDirtyPaths(), [
      "player.score",
      "player.name",
      "player",
    ]);
  });

  it("should handle nested shared observable", () => {
    const sharedProfile = createObservable({
      info: {
        name: "Alice",
        stats: { score: 100 },
      },
    });

    const schema1 = z.object({ user: z.any() });
    const schema2 = z.object({ player: z.any() });

    const model1 = createModel(schema1, { user: sharedProfile });
    const model2 = createModel(schema2, { player: sharedProfile });

    // Modify deeply nested property
    model1.user.info.stats.score = 200;

    // Both models should track the full path
    assertExactPaths(getModelInternals(model1).getDirtyPaths(), [
      "user.info.stats.score",
      "user.info.stats",
      "user.info",
      "user",
    ]);
    assertExactPaths(getModelInternals(model2).getDirtyPaths(), [
      "player.info.stats.score",
      "player.info.stats",
      "player.info",
      "player",
    ]);

    // Both see the same value
    assert.strictEqual(model1.user.info.stats.score, 200);
    assert.strictEqual(model2.player.info.stats.score, 200);
  });
});