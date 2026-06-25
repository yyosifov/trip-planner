import { describe, it, expect } from "vitest";
import { BuddyActionSchema, BuddyMessageSchema, BuddySuggestionSchema } from "./buddy";

describe("BuddyActionSchema", () => {
  it("parses research_run", () => {
    const r = BuddyActionSchema.parse({ type: "research_run", placesAdded: 5 });
    expect(r.type).toBe("research_run");
  });
  it("parses place_status_changed", () => {
    const r = BuddyActionSchema.parse({ type: "place_status_changed", placeId: "p1", status: "liked" });
    expect(r.placeId).toBe("p1");
  });
  it("rejects unknown type", () => {
    expect(() => BuddyActionSchema.parse({ type: "unknown" })).toThrow();
  });
});

describe("BuddyMessageSchema", () => {
  it("parses user message", () => {
    const m = BuddyMessageSchema.parse({ role: "user", content: "hello" });
    expect(m.role).toBe("user");
  });
  it("parses assistant message with actions", () => {
    const m = BuddyMessageSchema.parse({
      role: "assistant",
      content: "Done",
      actions: [{ type: "web_search", query: "norway" }],
    });
    expect(m.actions?.[0].type).toBe("web_search");
  });
});

describe("BuddySuggestionSchema", () => {
  it("parses hasSuggestion true with preview", () => {
    const s = BuddySuggestionSchema.parse({ hasSuggestion: true, preview: "3 hikes liked" });
    expect(s.preview).toBe("3 hikes liked");
  });
  it("parses hasSuggestion false without preview", () => {
    const s = BuddySuggestionSchema.parse({ hasSuggestion: false });
    expect(s.hasSuggestion).toBe(false);
  });
});
