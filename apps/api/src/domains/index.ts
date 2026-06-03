import type { FastifyInstance } from "fastify";
import { registerProjectRoutes } from "./projects.js";
import { registerInterviewSessionRoutes } from "./interview-sessions.js";
import { registerProviderCredentialRoutes } from "./provider-credentials.js";
import { registerExecutionTaskRoutes } from "./execution-tasks.js";
import { registerPhaseResolutionRoutes } from "./phase-resolution.js";

export async function registerDomainRoutes(app: FastifyInstance) {
  await Promise.all([
    registerProjectRoutes(app),
    registerInterviewSessionRoutes(app),
    registerProviderCredentialRoutes(app),
    registerExecutionTaskRoutes(app),
    registerPhaseResolutionRoutes(app),
  ]);
}
