import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AiModule } from '../src/ai/ai.module';
import { StubAiModule } from './utils/stub-ai.module';
import { resetTestDb } from './utils/test-db';

describe('App (e2e)', () => {
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

  it('/trips (GET) returns array', () => {
    return request(app.getHttpServer()).get('/trips').expect(200);
  });
});
