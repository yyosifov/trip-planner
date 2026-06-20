import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TimeSlot } from "@trip/shared";
import { rankBackups } from "./backup";

@Injectable()
export class ItineraryService {
  constructor(private prisma: PrismaService) {}

  createDay(tripId: string, dayIndex: number, baseCity: string) {
    return this.prisma.itineraryDay.create({ data: { tripId, dayIndex, baseCity } });
  }

  getBoard(tripId: string) {
    return this.prisma.itineraryDay.findMany({
      where: { tripId },
      orderBy: { dayIndex: "asc" },
      include: {
        items: {
          include: { place: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  async addItem(dayId: string, placeId: string, timeSlot: TimeSlot | null) {
    const count = await this.prisma.itineraryItem.count({ where: { dayId } });
    return this.prisma.itineraryItem.create({
      data: { dayId, placeId, timeSlot: timeSlot ?? null, sortOrder: count },
    });
  }

  async removeItem(itemId: string) {
    await this.prisma.itineraryItem.delete({ where: { id: itemId } });
  }

  async suggestBackups(tripId: string, dayId: string) {
    const day = await this.prisma.itineraryDay.findUnique({
      where: { id: dayId },
      include: { items: { include: { place: true } } },
    });
    const weatherItems = (day?.items ?? [])
      .map((i) => i.place)
      .filter((p) => p.weatherDependent);
    const liked = await this.prisma.place.findMany({ where: { tripId, status: "liked" } });
    return rankBackups(weatherItems, liked);
  }
}
