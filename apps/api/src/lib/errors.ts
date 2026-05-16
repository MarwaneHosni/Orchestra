import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super("NOT_FOUND", `${entity} with id '${id}' not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class RateLimitedError extends AppError {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
    public readonly limitName: string,
  ) {
    super("RATE_LIMITED", message, 429);
  }
}

export class OverBudgetError extends AppError {
  constructor(
    message: string,
    public readonly scope: string,
  ) {
    super("OVER_BUDGET", message, 403);
  }
}

export class CircuitOpenError extends AppError {
  constructor(
    message: string,
    public readonly circuitName: string,
  ) {
    super("CIRCUIT_OPEN", message, 503);
  }
}

export class AbuseBlockedError extends AppError {
  constructor(
    message: string,
    public readonly scope: string,
  ) {
    super("ABUSE_BLOCKED", message, 429);
  }
}

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    });
  }

  request.log.error(error, "Unhandled error");

  return reply.status(500).send({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
}
