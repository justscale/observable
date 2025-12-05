import type { z } from "zod";

// Symbol for accessing model internals (exported for use across files)
export const MODEL_INTERNALS = Symbol("model_internals");
export const OBSERVABLE_META = Symbol("observable_meta");

export interface ModelInternals<T, S extends z.ZodTypeAny = z.ZodTypeAny> {
  schema: S;
  dirty: Set<string>;
  original: T;
  markClean(): void;
  isDirty(): boolean;
  getDirtyPaths(): string[];
  getDirtyData(): Partial<T>;
}

export type Model<T> = T & {
  [MODEL_INTERNALS]: ModelInternals<T>;
};

export interface ObservableInternals {
  dirty: Set<string>;
  markClean(): void;
  isDirty(): boolean;
  getDirtyPaths(): string[];
}

export type Observable<T> = T & {
  [OBSERVABLE_META]: ObservableInternals;
};

export interface ParentRef {
  ref: WeakRef<ProxyMeta>;
  key: string;
}

export interface ProxyMeta {
  path: string[];
  dirtySets: Set<Set<string>>; // Multiple dirty sets for cross-model sharing
  parents: Set<ParentRef>;
  children: Map<string | symbol, ProxyMeta>;
  target: object;
  proxy: object;
}
