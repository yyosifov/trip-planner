import { Controller, Param, Post } from "@nestjs/common";
import { ResearchService } from "./research.service";

@Controller("trips/:id")
export class ResearchController {
  constructor(private research: ResearchService) {}

  @Post("research")
  run(@Param("id") id: string) {
    return this.research.run(id);
  }
}
