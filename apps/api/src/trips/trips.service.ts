import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTripInput } from "@trip/shared";

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  create(input: CreateTripInput) {
    return this.prisma.trip.create({
      data: {
        name: input.name,
        destination: input.destination,
        dateWindowStart: input.dateWindowStart ? new Date(input.dateWindowStart) : null,
        dateWindowEnd: input.dateWindowEnd ? new Date(input.dateWindowEnd) : null,
        daysMin: input.daysMin,
        daysMax: input.daysMax,
        routeType: input.routeType,
        notes: input.notes,
      },
    });
  }

  findAll() {
    return this.prisma.trip.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id } });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    return trip;
  }
}
