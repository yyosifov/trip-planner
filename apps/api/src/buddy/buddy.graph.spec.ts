import { buildSystemPrompt, extractActions } from "./buddy.graph";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

const tripCtx = {
  destination: "Norway",
  dateWindowStart: new Date("2026-08-01"),
  dateWindowEnd: new Date("2026-08-14"),
  waypoints: [{ city: "Bergen", order: 0 }, { city: "Oslo", order: 1 }],
};

const profileCtx = {
  partyAdults: 2,
  partyKids: 2,
  kidsAges: [8, 11],
  maxHikeKm: 10,
  maxHikeElevationM: 500,
  pace: "moderate",
  interests: ["hiking", "nature"],
  dislikes: ["crowds"],
  extra: { prefersMorning: true },
};

describe("buildSystemPrompt", () => {
  it("includes destination", () => {
    const s = buildSystemPrompt(tripCtx, profileCtx, []);
    expect(s).toContain("Norway");
  });

  it("includes waypoints in order", () => {
    const s = buildSystemPrompt(tripCtx, profileCtx, []);
    expect(s).toContain("Bergen → Oslo");
  });

  it("includes date range", () => {
    const s = buildSystemPrompt(tripCtx, profileCtx, []);
    expect(s).toContain("2026-08-01 → 2026-08-14");
  });

  it("counts liked places by category", () => {
    const places = [
      { status: "liked", category: "hike" },
      { status: "liked", category: "hike" },
      { status: "liked", category: "hike" },
      { status: "maybe", category: "food" },
    ];
    const s = buildSystemPrompt(tripCtx, profileCtx, places);
    expect(s).toContain("hike(3)");
    expect(s).toContain("3 liked");
  });

  it("handles null profile", () => {
    const s = buildSystemPrompt(tripCtx, null, []);
    expect(s).toContain("No profile yet");
  });
});

describe("extractActions", () => {
  function makeToolPair(toolName: string, args: Record<string, unknown>, content: string) {
    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [{ id: "call1", name: toolName, args }],
    });
    const toolMsg = new ToolMessage({ tool_call_id: "call1", content });
    return [aiMsg, toolMsg];
  }

  it("extracts web_search action", () => {
    const msgs = makeToolPair("searchWeb", { query: "norway august weather" }, "Results...");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "web_search", query: "norway august weather" }]);
  });

  it("extracts research_run and parses placesAdded", () => {
    const msgs = makeToolPair("runResearch", {}, "Research complete. Added 7 new places.");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "research_run", placesAdded: 7 }]);
  });

  it("extracts place_status_changed", () => {
    const msgs = makeToolPair("setPlaceStatus", { placeId: "p1", status: "liked" }, "ok");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "place_status_changed", placeId: "p1", status: "liked" }]);
  });

  it("extracts dates_updated", () => {
    const msgs = makeToolPair("setTripDates", { start: "2026-08-01", end: "2026-08-14" }, "ok");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "dates_updated", start: "2026-08-01", end: "2026-08-14" }]);
  });

  it("extracts profile_updated", () => {
    const msgs = makeToolPair("updateProfile", { changes: { pace: "relaxed" } }, "ok");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "profile_updated", changes: { pace: "relaxed" } }]);
  });

  it("ignores messages that are not tool messages", () => {
    const actions = extractActions([new HumanMessage("hello")]);
    expect(actions).toEqual([]);
  });
});
