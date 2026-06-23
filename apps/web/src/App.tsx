import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { TripsPage } from "./routes/TripsPage";
import { IntakePage } from "./routes/IntakePage";
import { DiscoverPage } from "./routes/DiscoverPage";
import { ItineraryPage } from "./routes/ItineraryPage";
import { WildlifePage } from "./routes/WildlifePage";

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<TripsPage />} />
        <Route path="/trips/:id" element={<IntakePage />} />
        <Route path="/trips/:id/discover" element={<DiscoverPage />} />
        <Route path="/trips/:id/itinerary" element={<ItineraryPage />} />
        <Route path="/trips/:id/wildlife" element={<WildlifePage />} />
      </Routes>
    </>
  );
}
