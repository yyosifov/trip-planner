import { NotFoundException } from "@nestjs/common";
import { TripsService } from "./trips.service";

const prismaMock = {
  trip: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe("TripsService", () => {
  let svc: TripsService;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new TripsService(prismaMock as never);
  });

  it("creates a trip from input", async () => {
    prismaMock.trip.create.mockResolvedValue({ id: "t1", destination: "Norway" });
    const r = await svc.create({
      name: "Norway", destination: "Norway", dateWindowStart: null, dateWindowEnd: null,
      daysMin: 7, daysMax: 10, routeType: "open", notes: "",
    });
    expect(r.id).toBe("t1");
    expect(prismaMock.trip.create).toHaveBeenCalled();
  });

  it("throws NotFound when trip missing", async () => {
    prismaMock.trip.findUnique.mockResolvedValue(null);
    await expect(svc.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
