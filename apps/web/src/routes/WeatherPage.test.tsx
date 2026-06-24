import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../test/setup";
import { WeatherPage } from "./WeatherPage";

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/trips/t1/weather"]}>
        <Routes>
          <Route path="/trips/:id/weather" element={<WeatherPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WeatherPage", () => {
  it("renders location name", async () => {
    wrap();
    expect(await screen.findByText(/Bergen/)).toBeTruthy();
  });

  it("renders year columns in the history table", async () => {
    wrap();
    expect(await screen.findByText("2025")).toBeTruthy();
    expect(screen.getByText("2024")).toBeTruthy();
  });

  it("shows forecast-unavailable notice when forecast is null", async () => {
    wrap();
    expect(await screen.findByText(/Forecast available ~16 days/i)).toBeTruthy();
  });

  it("renders forecast strip when forecast data is present", async () => {
    server.use(
      http.get("http://localhost:3000/trips/:id/weather", () =>
        HttpResponse.json({
          available: true,
          location: { name: "Bergen", lat: 60.39, lng: 5.32 },
          window: { start: "2026-06-23", end: "2026-06-25" },
          forecast: [
            { date: "2026-06-23", tMaxC: 18, tMinC: 12, precipMm: 0, windMaxKmh: 10 },
          ],
          normals: { tMaxC: 18, tMinC: 12, precipMmAvg: 1.5, windMaxKmh: 11 },
          years: [],
        }),
      ),
    );
    wrap();
    expect(await screen.findByText(/Forecast/i)).toBeTruthy();
  });

  it("shows set-dates prompt when available is false", async () => {
    server.use(
      http.get("http://localhost:3000/trips/:id/weather", () =>
        HttpResponse.json({ available: false }),
      ),
    );
    wrap();
    expect(await screen.findByText(/Set a date window/i)).toBeTruthy();
  });
});
