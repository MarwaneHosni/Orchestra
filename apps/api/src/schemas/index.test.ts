import { describe, expect, it } from "vitest";
import { paginatedResponse, paginationSchema } from "./index.js";

describe("paginatedResponse", () => {
  it("returns data and meta", () => {
    const result = paginatedResponse(["a", "b"], 10, 1, 20);
    expect(result.data).toEqual(["a", "b"]);
    expect(result.meta.total).toBe(10);
    expect(result.meta.page).toBe(1);
    expect(result.meta.pageSize).toBe(20);
    expect(result.meta.totalPages).toBe(1);
  });

  it("computes totalPages correctly", () => {
    const result = paginatedResponse([], 25, 1, 10);
    expect(result.meta.totalPages).toBe(3);
  });

  it("handles empty results", () => {
    const result = paginatedResponse([], 0, 1, 20);
    expect(result.meta.totalPages).toBe(0);
  });
});

describe("paginationSchema", () => {
  it("parses with defaults", () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it("parses with custom values", () => {
    const result = paginationSchema.parse({ page: "2", pageSize: "10" });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });
});
