import { useEffect, useState } from "react";
import { Routes, Route, useMatch } from "react-router-dom";
import { Toaster } from "sonner";
import { TripsPage } from "./routes/TripsPage";
import { IntakePage } from "./routes/IntakePage";
import { DiscoverPage } from "./routes/DiscoverPage";
import { ItineraryPage } from "./routes/ItineraryPage";
import { WildlifePage } from "./routes/WildlifePage";
import { WeatherPage } from "./routes/WeatherPage";
import BuddyBar from "./components/BuddyBar";

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, setDark] as const;
}

function BuddyRoute() {
  const matchSub = useMatch("/trips/:id/*");
  const matchBase = useMatch("/trips/:id");
  const match = matchSub ?? matchBase;
  if (!match?.params.id) return null;
  return <BuddyBar tripId={match.params.id} />;
}

export default function App() {
  const [dark, setDark] = useDarkMode();

  return (
    <>
      <Toaster position="top-right" richColors theme={dark ? "dark" : "light"} />
      <button
        onClick={() => setDark((d) => !d)}
        title="Toggle dark / light mode"
        style={{
          position: "fixed",
          bottom: 60,
          right: 20,
          zIndex: 9999,
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "var(--card)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {dark ? "☀️" : "🌙"}
      </button>
      <Routes>
        <Route path="/" element={<TripsPage />} />
        <Route path="/trips/:id" element={<IntakePage />} />
        <Route path="/trips/:id/discover" element={<DiscoverPage />} />
        <Route path="/trips/:id/itinerary" element={<ItineraryPage />} />
        <Route path="/trips/:id/wildlife" element={<WildlifePage />} />
        <Route path="/trips/:id/weather" element={<WeatherPage />} />
      </Routes>
      <BuddyRoute />
    </>
  );
}
