import { Module } from "@nestjs/common";
import { WildlifeService } from "./wildlife.service";
import { WildlifeController } from "./wildlife.controller";

@Module({
  providers: [WildlifeService],
  controllers: [WildlifeController],
})
export class WildlifeModule {}
