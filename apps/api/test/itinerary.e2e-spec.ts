import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { AiModule } from "../src/ai/ai.module";
import { StubAiModule } from "./utils/stub-ai.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { resetTestDb } from "./utils/test-db";

describe("Itinerary (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    resetTestDb();
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(AiModule)
      .useModule(StubAiModule)
      .compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => { await app.close(); });

  it("builds a day, adds an item, board returns it, backup suggests indoor place", async () => {
    const trip = await prisma.trip.create({
      data: { name: "x", destination: "x", daysMin: 1, daysMax: 1, routeType: "open" },
    });
    const hike = await prisma.place.create({
      data: {
        tripId: trip.id, name: "Hike", category: "hike",
        weatherDependent: true, kidSuitability: 4, status: "liked",
      },
    });
    await prisma.place.create({
      data: {
        tripId: trip.id, name: "Museum", category: "museum",
        weatherDependent: false, kidSuitability: 5, status: "liked",
      },
    });

    const day = await request(app.getHttpServer())
      .post(`/trips/${trip.id}/days`)
      .send({ dayIndex: 1, baseCity: "Bergen" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/days/${day.body.id}/items`)
      .send({ placeId: hike.id })
      .expect(201);

    const backups = await request(app.getHttpServer())
      .post(`/trips/${trip.id}/days/${day.body.id}/backups`)
      .expect(201);
    expect(backups.body[0].name).toBe("Museum");

    const board = await request(app.getHttpServer())
      .get(`/trips/${trip.id}/board`)
      .expect(200);
    expect(board.body[0].items[0].place.name).toBe("Hike");
  });
});
