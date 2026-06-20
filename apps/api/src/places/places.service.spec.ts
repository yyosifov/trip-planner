import { BadRequestException } from "@nestjs/common";
import { PlacesService } from "./places.service";

const prismaMock = {
  place: {
    findMany: jest.fn().mockResolvedValue([{ id: "p1" }]),
    update: jest.fn().mockResolvedValue({ id: "p1", status: "liked" }),
  },
};

describe("PlacesService", () => {
  let svc: PlacesService;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new PlacesService(prismaMock as never);
  });

  it("filters by status when provided", async () => {
    await svc.list("t1", "liked");
    expect(prismaMock.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tripId: "t1", status: "liked" } }),
    );
  });

  it("sets a valid status", async () => {
    const r = await svc.setStatus("p1", "liked");
    expect(r.status).toBe("liked");
  });

  it("throws on invalid status", () => {
    expect(() => svc.setStatus("p1", "banana" as never)).toThrow(BadRequestException);
  });
});
