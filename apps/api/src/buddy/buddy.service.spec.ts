import { BuddyService } from "./buddy.service";

// Mock the LangGraph module so we never actually call the LLM in tests
jest.mock("./buddy.graph", () => ({
  buildBuddyAgent: jest.fn().mockReturnValue({
    invoke: jest.fn().mockResolvedValue({
      messages: [
        {
          _getType: () => "ai",
          content: "Great question! Bergen is stunning in August.",
          tool_calls: [],
        },
      ],
    }),
  }),
  buildSystemPrompt: jest.fn().mockReturnValue("system prompt"),
  extractActions: jest.fn().mockReturnValue([]),
}));

const now = new Date();

const prismaMock = {
  trip: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({
      id: "t1",
      destination: "Norway",
      dateWindowStart: null,
      dateWindowEnd: null,
      waypoints: [],
    }),
  },
  travelerProfile: {
    findUnique: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  place: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  buddyMessage: {
    create: jest.fn().mockImplementation((args) =>
      Promise.resolve({ id: "m1", ...args.data }),
    ),
    findMany: jest.fn().mockResolvedValue([
      { role: "user", content: "hello", actions: null },
      { role: "assistant", content: "hi", actions: null },
    ]),
  },
  researchRun: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
};

const researchMock = { run: jest.fn().mockResolvedValue({ created: 3, places: [] }) };
const placesMock = { setStatus: jest.fn().mockResolvedValue({ id: "p1" }) };
const searchMock = { search: jest.fn().mockResolvedValue([]) };

describe("BuddyService", () => {
  let svc: BuddyService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new BuddyService(
      prismaMock as never,
      researchMock as never,
      placesMock as never,
      searchMock as never,
    );
  });

  describe("getMessages", () => {
    it("returns messages ordered asc", async () => {
      const msgs = await svc.getMessages("t1");
      expect(prismaMock.buddyMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: "t1" },
          orderBy: { createdAt: "asc" },
        }),
      );
      expect(msgs).toHaveLength(2);
    });
  });

  describe("getSuggestion", () => {
    it("returns false when recent ResearchRun exists", async () => {
      prismaMock.researchRun.findFirst.mockResolvedValueOnce({ id: "r1", createdAt: now });
      const s = await svc.getSuggestion("t1");
      expect(s.hasSuggestion).toBe(false);
    });

    it("returns false when fewer than 3 liked places share a category", async () => {
      prismaMock.place.findMany.mockResolvedValueOnce([
        { status: "liked", category: "hike" },
        { status: "liked", category: "hike" },
        { status: "liked", category: "food" },
      ]);
      const s = await svc.getSuggestion("t1");
      expect(s.hasSuggestion).toBe(false);
    });

    it("returns suggestion when ≥3 liked places same category and no recent run", async () => {
      prismaMock.researchRun.findFirst.mockResolvedValueOnce(null);
      prismaMock.place.findMany.mockResolvedValueOnce([
        { status: "liked", category: "hike" },
        { status: "liked", category: "hike" },
        { status: "liked", category: "hike" },
      ]);
      const s = await svc.getSuggestion("t1");
      expect(s.hasSuggestion).toBe(true);
      expect(s.preview).toContain("3 hike");
    });
  });

  describe("postMessage", () => {
    it("persists user message then assistant message", async () => {
      await svc.postMessage("t1", "Is August good for Norway?");
      expect(prismaMock.buddyMessage.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ data: expect.objectContaining({ role: "user" }) }),
      );
      expect(prismaMock.buddyMessage.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ data: expect.objectContaining({ role: "assistant" }) }),
      );
    });

    it("returns reply string", async () => {
      const { reply } = await svc.postMessage("t1", "hello");
      expect(typeof reply).toBe("string");
      expect(reply.length).toBeGreaterThan(0);
    });
  });
});
