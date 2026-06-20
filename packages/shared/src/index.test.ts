import { describe, it, expect } from "vitest";
import { SHARED_OK } from "./index";

describe("shared", () => {
  it("loads", () => {
    expect(SHARED_OK).toBe(true);
  });
});
