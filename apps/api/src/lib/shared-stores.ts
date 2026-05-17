import { createInMemoryGraphStore } from "./task-graph/generator.js";
import { createInMemoryPromptStore } from "./prompt/index.js";

export const graphStore = createInMemoryGraphStore();
export const promptStore = createInMemoryPromptStore();
