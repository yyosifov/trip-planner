import { Routes, Route } from "react-router-dom";
import { TripsPage } from "./routes/TripsPage";
import { IntakePage } from "./routes/IntakePage";
import { DiscoverPage } from "./routes/DiscoverPage";
import { ItineraryPage } from "./routes/ItineraryPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TripsPage />} />
      <Route path="/trips/:id" element={<IntakePage />} />
      <Route path="/trips/:id/discover" element={<DiscoverPage />} />
      <Route path="/trips/:id/itinerary" element={<ItineraryPage />} />
    </Routes>
  );
}
