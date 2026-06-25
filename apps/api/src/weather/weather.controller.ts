import { Controller, Get, Param, Query } from "@nestjs/common";
import { WeatherService } from "./weather.service";

@Controller("trips/:id")
export class WeatherController {
  constructor(private weather: WeatherService) {}

  @Get("weather")
  getWeather(@Param("id") id: string, @Query("city") city?: string) {
    return this.weather.getWeather(id, city);
  }
}
