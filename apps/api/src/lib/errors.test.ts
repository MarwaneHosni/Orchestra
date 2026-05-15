import { describe, expect, it } from "vitest";
import { AppError, NotFoundError, ValidationError } from "./errors.js";

describe("AppError", () => {
  it("sets code, message, and default status 400", () => {
    const err = new AppError("TEST_CODE", "test message");
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("AppError");
  });

  it("accepts a custom status code", () => {
    const err = new AppError("NOT_FOUND", "not found", 404);
    expect(err.statusCode).toBe(404);
  });

  it("is an instance of Error", () => {
    const err = new AppError("ERR", "msg");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("NotFoundError", () => {
  it("formats the message with entity name and id", () => {
    const err = new NotFoundError("Project", "abc-123");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Project with id 'abc-123' not found");
    expect(err.statusCode).toBe(404);
  });
});

describe("ValidationError", () => {
  it("sets code and defaults to 400", () => {
    const err = new ValidationError("Invalid input");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Invalid input");
    expect(err.statusCode).toBe(400);
  });
});
