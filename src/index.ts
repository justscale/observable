// Types
export { MODEL_INTERNALS, OBSERVABLE_META } from "./types.js";
export type { Model, ModelInternals, ProxyMeta, ParentRef, Observable, ObservableInternals } from "./types.js";

// Model creation
export { createModel, getModelInternals, isModel } from "./model.js";

// Observable creation
export { createObservable, getObservableInternals, isObservable } from "./observable.js";

// Watch functionality
export { watch, type WatchHandle, type WatchAsyncIteratorOptions, type Watcher } from "./watch.js";

// Proxy utilities (for advanced use/testing)
export { createTrackedProxy, getProxyMeta, isTrackedProxy } from "./proxy.js";
