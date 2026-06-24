import { Global, Module } from "@nestjs/common";
import { GEMINI, SEARCH, MAPS, WEATHER } from "./ports";
import { GeminiProvider } from "./gemini.provider";
import { BraveProvider } from "./brave.provider";
import { MapsProvider } from "./maps.provider";
import { OpenMeteoProvider } from "./weather.provider";

@Global()
@Module({
  providers: [
    { provide: GEMINI, useClass: GeminiProvider },
    { provide: SEARCH, useFactory: () => new BraveProvider() },
    { provide: MAPS, useFactory: () => new MapsProvider() },
    { provide: WEATHER, useFactory: () => new OpenMeteoProvider() },
  ],
  exports: [GEMINI, SEARCH, MAPS, WEATHER],
})
export class AiModule {}
