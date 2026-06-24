import { Body, Controller, Get, Param, Patch, Post, UsePipes } from "@nestjs/common";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CreateTripSchema, CreateTripInput } from "@trip/shared";
import { TripsService } from "./trips.service";

@Controller("trips")
export class TripsController {
  constructor(private trips: TripsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateTripSchema))
  create(@Body() body: CreateTripInput) { return this.trips.create(body); }

  @Get() findAll() { return this.trips.findAll(); }

  @Get(":id") findOne(@Param("id") id: string) { return this.trips.findOne(id); }

  @Patch(":id")
  updateDates(
    @Param("id") id: string,
    @Body() body: { dateWindowStart: string | null; dateWindowEnd: string | null },
  ) { return this.trips.updateDates(id, body); }
}
