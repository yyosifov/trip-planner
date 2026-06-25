import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { BuddyService } from "./buddy.service";

const MessageInputSchema = z.object({ content: z.string().min(1).max(10000) });

@Controller("trips/:id/buddy")
export class BuddyController {
  constructor(private buddy: BuddyService) {}

  @Post("message")
  postMessage(@Param("id") id: string, @Body(new ZodValidationPipe(MessageInputSchema)) body: { content: string }) {
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
