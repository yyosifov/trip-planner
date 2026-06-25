import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTripInput } from "@trip/shared";

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  create(input: CreateTripInput) {
    const { waypoints, maxDrivingHoursPerDay, ...rest } = input;
    return this.prisma.trip.create({
      data: {
        name: rest.name,
        destination: rest.destination,
        dateWindowStart: rest.dateWindowStart ? new Date(rest.dateWindowStart) : null,
        dateWindowEnd: rest.dateWindowEnd ? new Date(rest.dateWindowEnd) : null,
        daysMin: rest.daysMin,
        daysMax: rest.daysMax,
        routeType: rest.routeType,
        notes: rest.notes,
        maxDrivingHoursPerDay: maxDrivingHoursPerDay ?? null,
        ...(waypoints.length > 0 && {
          waypoints: { create: waypoints.map((w) => ({ city: w.city, order: w.order })) },
        }),
      },
      include: { waypoints: { orderBy: { order: "asc" } } },
    });
  }

  findAll() {
    return this.prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      include: { waypoints: { orderBy: { order: "asc" } } },
    });
  }

  async findOne(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: { waypoints: { orderBy: { order: "asc" } } },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    return trip;
  }

  updateDates(id: string, data: { dateWindowStart: string | null; dateWindowEnd: string | null }) {
    return this.prisma.trip.update({
      where: { id },
      data: {
        dateWindowStart: data.dateWindowStart ? new Date(data.dateWindowStart) : null,
        dateWindowEnd: data.dateWindowEnd ? new Date(data.dateWindowEnd) : null,
      },
      include: { waypoints: { orderBy: { order: "asc" } } },
    });
  }
}
