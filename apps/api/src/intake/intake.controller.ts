import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IntakeService } from "./intake.service";

@Controller("trips/:id")
export class IntakeController {
  constructor(private intake: IntakeService) {}

  @Post("intake/messages")
  post(@Param("id") id: string, @Body("content") content: string) {
    return this.intake.postMessage(id, content);
  }

  @Get("intake/messages")
  messages(@Param("id") id: string) {
    return this.intake.getMessages(id);
  }

  @Get("profile")
  profile(@Param("id") id: string) {
    return this.intake.getProfile(id);
  }
}
