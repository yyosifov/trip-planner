import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { DiscoverPage } from "./DiscoverPage";

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/trips/t1/discover"]}>
        <Routes>
          <Route path="/trips/:id/discover" element={<DiscoverPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DiscoverPage", () => {
  it("shows place card and like button", async () => {
    wrap();
    expect(await screen.findAllByText(/Fløyen/)).toBeTruthy();
    fireEvent.click(screen.getAllByText("👍 Like")[0]);
    expect(screen.getAllByText(/Fløyen/).length).toBeGreaterThan(0);
  });
});
