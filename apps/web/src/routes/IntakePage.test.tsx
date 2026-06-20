import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { IntakePage } from "./IntakePage";

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/trips/t1"]}>
        <Routes>
          <Route path="/trips/:id" element={<IntakePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("IntakePage", () => {
  it("sends a message and shows assistant reply", async () => {
    wrap();
    const input = await screen.findByLabelText("message");
    fireEvent.change(input, { target: { value: "family of 3" } });
    fireEvent.click(screen.getByText("Send"));
    expect(await screen.findByText("How old are your kids?")).toBeInTheDocument();
  });
});
