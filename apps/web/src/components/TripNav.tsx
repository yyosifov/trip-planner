import { Link, useLocation } from "react-router-dom";
import * as T from "../theme";

const LINKS = [
  { key: "", label: "Intake" },
  { key: "/discover", label: "Discover" },
  { key: "/itinerary", label: "Itinerary" },
  { key: "/wildlife", label: "Wildlife" },
  { key: "/weather", label: "Weather" },
];

export function TripNav({ id, mb = 24 }: { id: string; mb?: number }) {
  const { pathname } = useLocation();
  const base = `/trips/${id}`;

  return (
    <nav style={{ ...T.nav, marginBottom: mb }}>
      {LINKS.map(({ key, label }) => {
        const to = `${base}${key}`;
        const active = pathname === to;
        return (
          <Link key={to} to={to} style={active ? T.navLink.active : T.navLink.base}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
