import { IntakeService } from "./intake.service";

const prismaMock = {
  intakeMessage: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  travelerProfile: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
};

const geminiMock = {
  chat: jest.fn().mockResolvedValue("How old are your kids?"),
  extractJson: jest.fn().mockResolvedValue({
    partyAdults: 2, partyKids: 2, kidsAges: [5, 8], maxHikeKm: 6, maxHikeElevationM: 300,
    pace: "moderate", interests: ["hikes"], dislikes: [], completed: false,
  }),
};

describe("IntakeService", () => {
  let svc: IntakeService;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new IntakeService(prismaMock as never, geminiMock as never);
    prismaMock.travelerProfile.upsert.mockImplementation(
      async ({ create }: { create: unknown }) => create,
    );
  });

  it("persists user + assistant messages, extracts profile", async () => {
    const res = await svc.postMessage("t1", "We are a family of 4");
    expect(res.reply).toBe("How old are your kids?");
    expect(res.profile.kidsAges).toEqual([5, 8]);
    expect(prismaMock.intakeMessage.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.travelerProfile.upsert).toHaveBeenCalled();
  });
});
