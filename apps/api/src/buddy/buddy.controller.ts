import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { BuddyService } from "./buddy.service";

@Controller("trips/:id/buddy")
export class BuddyController {
  constructor(private buddy: BuddyService) {}

  @Post("message")
  postMessage(@Param("id") id: string, @Body() body: { content: string }) {
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
