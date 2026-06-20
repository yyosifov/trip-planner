import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { PlacesService } from "./places.service";
import { PlaceStatus } from "@trip/shared";

@Controller()
export class PlacesController {
  constructor(private places: PlacesService) {}

  @Get("trips/:id/places")
  list(@Param("id") id: string, @Query("status") status?: PlaceStatus) {
    return this.places.list(id, status);
  }

  @Patch("places/:placeId")
  setStatus(@Param("placeId") placeId: string, @Body("status") status: PlaceStatus) {
    return this.places.setStatus(placeId, status);
  }
}
