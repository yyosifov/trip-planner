import { Controller, Get, Param, Post } from "@nestjs/common";
import { WildlifeService } from "./wildlife.service";

@Controller("trips/:id")
export class WildlifeController {
  constructor(private wildlife: WildlifeService) {}

  @Post("wildlife")
  generate(@Param("id") id: string) {
    return this.wildlife.generate(id);
  }

  @Get("wildlife")
  get(@Param("id") id: string) {
    return this.wildlife.get(id);
  }
}
