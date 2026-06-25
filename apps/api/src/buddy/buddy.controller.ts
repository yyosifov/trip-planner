import { Controller, Post, Get, Body, Param, Logger } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { BuddyService } from "./buddy.service";

const MessageInputSchema = z.object({ content: z.string().min(1).max(10000) });

@Controller("trips/:id/buddy")
export class BuddyController {
  private readonly logger = new Logger(BuddyController.name);

  constructor(private buddy: BuddyService) {}

  @Post("message")
  postMessage(@Param("id") id: string, @Body(new ZodValidationPipe(MessageInputSchema)) body: { content: string }) {
    this.logger.log(`postMessage tripId=${id} contentLength=${body.content.length}`);
    return this.buddy.postMessage(id, body.content);
  }

  @Get("messages")
  getMessages(@Param("id") id: string) {
    return this.buddy.getMessages(id);
  }

  @Get("suggestions")
  getSuggestion(@Param("id") id: string) {
    return this.buddy.getSuggestion(id);
  }
}
