import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PlaceStatus, PlaceStatusSchema } from "@trip/shared";

@Injectable()
export class PlacesService {
  constructor(private prisma: PrismaService) {}

  list(tripId: string, status?: PlaceStatus) {
    return this.prisma.place.findMany({
      where: status ? { tripId, status } : { tripId },
      orderBy: { createdAt: "desc" },
    });
  }

  setStatus(placeId: string, status: PlaceStatus) {
    const parsed = PlaceStatusSchema.safeParse(status);
    if (!parsed.success) throw new BadRequestException("invalid status");
    return this.prisma.place.update({ where: { id: placeId }, data: { status: parsed.data } });
  }
}
