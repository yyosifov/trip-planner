import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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

  it("has a generate button", async () => {
    wrap();
    const btn = await screen.findByRole("button", { name: /generate|regenerate/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByText(/White-tailed eagle/)).toBeTruthy();
  });
});
