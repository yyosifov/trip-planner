import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ItineraryPage } from "./ItineraryPage";

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/trips/t1/itinerary"]}>
        <Routes>
          <Route path="/trips/:id/itinerary" element={<ItineraryPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ItineraryPage", () => {
  it("shows day with weather item and suggests backup", async () => {
    wrap();
    expect((await screen.findAllByText(/Fløyen/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Suggest backup"));
    expect(await screen.findByText(/Museum/)).toBeInTheDocument();
  });
});
