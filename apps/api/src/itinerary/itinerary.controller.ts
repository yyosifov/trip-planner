import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ItineraryService } from "./itinerary.service";
import { TimeSlot } from "@trip/shared";

@Controller()
export class ItineraryController {
  constructor(private itinerary: ItineraryService) {}

  @Post("trips/:id/days")
  createDay(@Param("id") id: string, @Body() body: { dayIndex: number; baseCity?: string }) {
    return this.itinerary.createDay(id, body.dayIndex, body.baseCity ?? "");
  }

  @Get("trips/:id/board")
  board(@Param("id") id: string) {
    return this.itinerary.getBoard(id);
  }

  @Post("days/:dayId/items")
  addItem(@Param("dayId") dayId: string, @Body() body: { placeId: string; timeSlot?: TimeSlot }) {
    return this.itinerary.addItem(dayId, body.placeId, body.timeSlot ?? null);
  }

  @Delete("items/:itemId")
  remove(@Param("itemId") itemId: string) {
    return this.itinerary.removeItem(itemId);
  }

  @Post("trips/:id/days/:dayId/backups")
  backups(@Param("id") id: string, @Param("dayId") dayId: string) {
    return this.itinerary.suggestBackups(id, dayId);
  }
}
