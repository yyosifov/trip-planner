import { Module } from "@nestjs/common";
import { BuddyService } from "./buddy.service";
import { BuddyController } from "./buddy.controller";
import { PlacesModule } from "../places/places.module";
import { ResearchModule } from "../research/research.module";

@Module({
  imports: [PlacesModule, ResearchModule],
  providers: [BuddyService],
  controllers: [BuddyController],
})
export class BuddyModule {}
