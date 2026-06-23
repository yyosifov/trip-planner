import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { AiModule } from "../src/ai/ai.module";
import { StubAiModule } from "./utils/stub-ai.module";
import { resetTestDb } from "./utils/test-db";

describe("Wildlife (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    resetTestDb();
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(AiModule)
      .useModule(StubAiModule)
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it("POST then GET /trips/:id/wildlife round-trips an (empty) report", async () => {
    const trip = await request(app.getHttpServer())
      .post("/trips")
      .send({
        name: "Norway", destination: "Norway", dateWindowStart: null,
        dateWindowEnd: null, daysMin: 7, daysMax: 10, routeType: "open", notes: "",
      })
      .expect(201);
    const id = trip.body.id;

    await request(app.getHttpServer())
      .post(`/trips/${id}/wildlife`)
      .expect(201)
      .expect((r) => {
        expect(r.body.tripId).toBe(id);
        expect(r.body.data.summary).toBe("");
        expect(r.body.data.species).toEqual([]);
      });

    await request(app.getHttpServer())
      .get(`/trips/${id}/wildlife`)
      .expect(200)
      .expect((r) => expect(r.body.tripId).toBe(id));
  });

  it("GET returns null for a trip with no report", async () => {
    const trip = await request(app.getHttpServer())
      .post("/trips")
      .send({
        name: "Empty", destination: "Empty", dateWindowStart: null,
        dateWindowEnd: null, daysMin: 1, daysMax: 2, routeType: "open", notes: "",
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/trips/${trip.body.id}/wildlife`)
      .expect(200)
      .expect((r) => expect(r.body).toEqual({}));
  });
});
