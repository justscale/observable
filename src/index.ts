// Types

// Model creation
export { createModel, getModelInternals, isModel } from "./model.js";
// Observable creation
export { createObservable, getObservableInternals, isObservable } from "./observable.js";
// Proxy utilities (for advanced use/testing)
export { createTrackedProxy, getProxyMeta, isTrackedProxy } from "./proxy.js";
export type {
  Model,
  ModelInternals,
  Observable,
  ObservableInternals,
  ParentRef,
  ProxyMeta,
} from "./types.js";
export { MODEL_INTERNALS, OBSERVABLE_META } from "./types.js";
// Watch functionality
export { type WatchAsyncIteratorOptions, type Watcher, type WatchHandle, watch } from "./watch.js";
