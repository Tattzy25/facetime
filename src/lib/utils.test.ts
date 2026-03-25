import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("should return empty string when given no inputs", () => {
    expect(cn()).toBe("");
  });

  it("should join multiple class strings with spaces", () => {
    expect(cn("text-sm", "font-bold")).toBe("text-sm font-bold");
  });

  it("should handle null and undefined inputs gracefully", () => {
    expect(cn(undefined, null, "p-2")).toBe("p-2");
  });

  it("should deduplicate identical classes", () => {
    expect(cn("p-2 p-2")).toBe("p-2");
  });

  it("should merge conflicting Tailwind classes using tailwind-merge semantics", () => {
    // px-2 and px-4 conflict; tailwind-merge keeps the last (px-4)
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("should handle clsx objects and arrays", () => {
    expect(cn(["text-center", { hidden: false, block: true }])).toBe("text-center block");
  });

  // New tests added below

  it("should return empty string when all inputs are falsy", () => {
    expect(cn(undefined, null, false, "")).toBe("");
  });

  it("should preserve non-conflicting order and prefer last for conflicting classes across inputs", () => {
    // "text-sm" and "font-bold" are non-conflicting and should appear in order;
    // px-2 and px-6 conflict and last one should win
    expect(cn("text-sm", ["font-bold"], "px-2", { "px-6": true })).toBe("text-sm font-bold px-6");
  });

  it("should handle nested arrays and boolean flags from clsx", () => {
    // nested arrays and objects with truthy/falsey values should be flattened
    expect(cn(["p-2", ["m-1", { "hidden": false, "inline-block": true }]])).toBe("p-2 m-1 inline-block");
  });

  it("should collapse extra whitespace and deduplicate across inputs", () => {
    expect(cn("  p-2   p-2 ", "p-2", "  px-4 ")).toBe("p-2 px-4");
  });

  it("should handle Tailwind variants and apply merge rules only to conflicting utility classes", () => {
    // hover:bg-red-500 and bg-red-500 are distinct; sm:text-sm vs text-lg should prefer last for same utility
    expect(cn("hover:bg-red-500", "bg-red-500", "text-lg", "sm:text-sm", "text-sm")).toBe("hover:bg-red-500 bg-red-500 sm:text-sm text-sm");
  });
});
