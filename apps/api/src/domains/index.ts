import type { FastifyInstance } from "fastify";
import { registerProjectRoutes } from "./projects.js";
import { registerUserRoutes } from "./users.js";
import { registerIdeaRoutes } from "./ideas.js";
import { registerPlanRoutes } from "./plans.js";
import { registerPhaseRoutes } from "./phases.js";
import { registerSubPhaseRoutes } from "./subphases.js";
import { registerQuestionRoutes } from "./questions.js";
import { registerAnswerRoutes } from "./answers.js";
import { registerGenerationRoutes } from "./generations.js";
import { registerInterviewSessionRoutes } from "./interview-sessions.js";
import { registerAssumptionRoutes } from "./assumptions.js";
import { registerConstraintRoutes } from "./constraints.js";
import { registerRiskRoutes } from "./risks.js";
import { registerBlueprintRoutes } from "./blueprints.js";
import { registerProviderCredentialRoutes } from "./provider-credentials.js";

export async function registerDomainRoutes(app: FastifyInstance) {
  await Promise.all([
    registerProjectRoutes(app),
    registerUserRoutes(app),
    registerIdeaRoutes(app),
    registerPlanRoutes(app),
    registerPhaseRoutes(app),
    registerSubPhaseRoutes(app),
    registerQuestionRoutes(app),
    registerAnswerRoutes(app),
    registerGenerationRoutes(app),
    registerInterviewSessionRoutes(app),
    registerAssumptionRoutes(app),
    registerConstraintRoutes(app),
    registerRiskRoutes(app),
    registerBlueprintRoutes(app),
    registerProviderCredentialRoutes(app),
  ]);
}
