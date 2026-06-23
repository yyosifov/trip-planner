import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../test/setup";
import { WildlifePage } from "./WildlifePage";

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/trips/t1/wildlife"]}>
        <Routes>
          <Route path="/trips/:id/wildlife" element={<WildlifePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WildlifePage", () => {
  it("renders the trip-level report from the API", async () => {
    wrap();
    expect(await screen.findByText(/White-tailed eagle/)).toBeTruthy();
    expect(screen.getByText(/Puffins nest/)).toBeTruthy();
    expect(screen.getByText(/Tick/)).toBeTruthy();
  });

  it("renders per-place sections", async () => {
    wrap();
    expect(await screen.findByText(/Red squirrel/)).toBeTruthy();
    expect(screen.getByText(/Fløyen/)).toBeTruthy();
  });

  it("has a generate button and fires the POST on click", async () => {
    wrap();
    const btn = await screen.findByRole("button", { name: /generate|regenerate/i });
    expect(btn).toBeTruthy();

    let posted = false;
    server.use(
      http.post("http://localhost:3000/trips/:id/wildlife", () => {
        posted = true;
        return HttpResponse.json(
          { id: "w1", tripId: "t1", generatedAt: "2026-06-22T10:00:00.000Z", data: { summary: "Generated.", species: [], seasonal: [], safety: [], perPlace: [] } },
          { status: 201 },
        );
      }),
    );
    fireEvent.click(btn);
    await waitFor(() => expect(posted).toBe(true));
  });

  it("shows the empty state when there is no report", async () => {
    server.use(
      http.get("http://localhost:3000/trips/:id/wildlife", () => new HttpResponse(null, { status: 200 })),
    );
    wrap();
    expect(await screen.findByText(/No wildlife info yet/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /generate wildlife info/i })).toBeTruthy();
  });
});
