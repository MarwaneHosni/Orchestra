import { createInMemoryGraphStore } from "./task-graph/generator.js";
import { createInMemoryPromptStore } from "./prompt/index.js";
import type { PromptStore } from "./prompt/types.js";

let _graphStore = createInMemoryGraphStore();
let _promptStore: PromptStore = createInMemoryPromptStore();

export function getGraphStore() {
  return _graphStore;
}

export function getPromptStore(): PromptStore {
  return _promptStore;
}

export function replacePromptStore(store: PromptStore): void {
  _promptStore = store;
}

/** Expose store sizes for memory diagnostics */
export function getStoreSizes(): { graph_byKey: number; graph_byPlan: number; prompt_byTask: number; prompt_byPlan: number } {
  return {
    graph_byKey: (_graphStore as any).byKey?.size ?? 0,
    graph_byPlan: (_graphStore as any).byPlan?.size ?? 0,
    prompt_byTask: (_promptStore as any).byTask?.size ?? 0,
    prompt_byPlan: (_promptStore as any).byPlan?.size ?? 0,
  };
}
