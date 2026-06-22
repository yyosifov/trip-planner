import { Global, Module } from "@nestjs/common";
import { GEMINI, SEARCH, MAPS } from "./ports";
import { GeminiProvider } from "./gemini.provider";
import { BraveProvider } from "./brave.provider";
import { MapsProvider } from "./maps.provider";

@Global()
@Module({
  providers: [
    { provide: GEMINI, useClass: GeminiProvider },
    { provide: SEARCH, useFactory: () => new BraveProvider() },
    { provide: MAPS, useFactory: () => new MapsProvider() },
  ],
  exports: [GEMINI, SEARCH, MAPS],
})
export class AiModule {}
