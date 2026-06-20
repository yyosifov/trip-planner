import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { AiModule } from "../src/ai/ai.module";
import { StubAiModule } from "./utils/stub-ai.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { resetTestDb } from "./utils/test-db";

describe("Places (e2e)", () => {
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

  it("lists liked places after status update", async () => {
    const trip = await prisma.trip.create({
      data: { name: "x", destination: "x", daysMin: 1, daysMax: 1, routeType: "open" },
    });
    const place = await prisma.place.create({
      data: { tripId: trip.id, name: "Beach", category: "beach" },
    });
    await request(app.getHttpServer())
      .patch(`/places/${place.id}`)
      .send({ status: "liked" })
      .expect(200);
    const res = await request(app.getHttpServer())
      .get(`/trips/${trip.id}/places?status=liked`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("liked");
  });
});
