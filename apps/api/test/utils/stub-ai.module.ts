import { Global, Module } from "@nestjs/common";
import { GEMINI, SEARCH, MAPS, GeminiPort, SearchPort, MapsPort } from "../../src/ai/ports";

export const stubGemini: GeminiPort = {
  chat: async () => "stub reply",
  extractJson: async () => ({}) as never,
};
export const stubSearch: SearchPort = { search: async () => [] };
export const stubMaps: MapsPort = {
  geocode: async () => ({ lat: 0, lng: 0 }),
  photoUrl: async () => null,
};

@Global()
@Module({
  providers: [
    { provide: GEMINI, useValue: stubGemini },
    { provide: SEARCH, useValue: stubSearch },
    { provide: MAPS, useValue: stubMaps },
  ],
  exports: [GEMINI, SEARCH, MAPS],
})
export class StubAiModule {}
