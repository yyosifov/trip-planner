import { Module } from "@nestjs/common";
import { IntakeService } from "./intake.service";
import { IntakeController } from "./intake.controller";

@Module({ providers: [IntakeService], controllers: [IntakeController], exports: [IntakeService] })
export class IntakeModule {}
