import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { AiModule } from "../src/ai/ai.module";
import { StubAiModule } from "./utils/stub-ai.module";
import { resetTestDb } from "./utils/test-db";

describe("Trips (e2e)", () => {
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

  it("POST /trips then GET /trips/:id", async () => {
    const created = await request(app.getHttpServer())
      .post("/trips")
      .send({
        name: "Norway", destination: "Norway", dateWindowStart: null,
        dateWindowEnd: null, daysMin: 7, daysMax: 10, routeType: "open", notes: "",
      })
      .expect(201);
    const id = created.body.id;
    await request(app.getHttpServer())
      .get(`/trips/${id}`)
      .expect(200)
      .expect((r) => expect(r.body.destination).toBe("Norway"));
  });

  it("GET /trips returns array", async () => {
    await request(app.getHttpServer()).get("/trips").expect(200)
      .expect((r) => expect(Array.isArray(r.body)).toBe(true));
  });

  it("rejects invalid trip body", async () => {
    await request(app.getHttpServer()).post("/trips").send({ name: "" }).expect(400);
  });
});
