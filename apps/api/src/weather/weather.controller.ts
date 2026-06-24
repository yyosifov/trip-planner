import { Controller, Get, Param } from "@nestjs/common";
import { WeatherService } from "./weather.service";

@Controller("trips/:id")
export class WeatherController {
  constructor(private weather: WeatherService) {}

  @Get("weather")
  getWeather(@Param("id") id: string) {
    return this.weather.getWeather(id);
  }
}
