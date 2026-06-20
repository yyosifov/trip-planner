import { Module } from "@nestjs/common";
import { ResearchService } from "./research.service";
import { ResearchController } from "./research.controller";
import { IntakeModule } from "../intake/intake.module";

@Module({
  imports: [IntakeModule],
  providers: [ResearchService],
  controllers: [ResearchController],
})
export class ResearchModule {}
