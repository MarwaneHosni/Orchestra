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
  ]);
}
