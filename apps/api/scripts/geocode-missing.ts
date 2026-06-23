import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate limit: 1 req/s
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "User-Agent": "trip-planner-app/1.0" } });
  const body = (await res.json()) as { lat: string; lon: string }[];
  if (!body.length) return null;
  return { lat: parseFloat(body[0].lat), lng: parseFloat(body[0].lon) };
}

async function main() {
  const places = await prisma.place.findMany({ where: { lat: null } });
  console.log(`Geocoding ${places.length} places via Nominatim…`);

  for (const p of places) {
    const trip = await prisma.trip.findUnique({ where: { id: p.tripId }, select: { destination: true } });
    const destination = trip?.destination ?? "";

    const geo = await geocode(`${p.name}, ${destination}`) ?? await geocode(p.name);

    await prisma.place.update({
      where: { id: p.id },
      data: { lat: geo?.lat ?? null, lng: geo?.lng ?? null },
    });

    console.log(`  ${p.name}: ${geo ? `${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}` : "no result"}`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
