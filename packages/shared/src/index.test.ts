import { describe, expect, it } from "vitest";
import { notEmpty } from "./index.js";

describe("notEmpty", () => {
  it("returns false for null", () => {
    expect(notEmpty(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(notEmpty(undefined)).toBe(false);
  });

  it("returns true for a string", () => {
    expect(notEmpty("hello")).toBe(true);
  });

  it("returns true for zero", () => {
    expect(notEmpty(0)).toBe(true);
  });

  it("filters nullish values from an array", () => {
    const input = [1, null, 2, undefined, 3];
    const result = input.filter(notEmpty);
    expect(result).toEqual([1, 2, 3]);
  });
});
