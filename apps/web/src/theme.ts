import type { CSSProperties } from "react";

// Reusable style objects that reference CSS design tokens.
// All values use var(--token) so they automatically adapt to light/dark mode.

export const page: CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--fg)",
};

export const card: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-sm)",
};

export const cardPadded: CSSProperties = {
  ...card,
  padding: "16px 20px",
};

export const surface2: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
};

export const btn = {
  primary: {
    background: "var(--primary)",
    color: "var(--primary-fg)",
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "5px 16px",
    fontWeight: 500,
    cursor: "pointer",
  } as CSSProperties,

  secondary: {
    background: "var(--surface-3)",
    color: "var(--fg)",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "5px 14px",
    fontWeight: 400,
    cursor: "pointer",
  } as CSSProperties,

  ghost: {
    background: "transparent",
    color: "var(--fg-muted)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "5px 14px",
    fontWeight: 400,
    cursor: "pointer",
  } as CSSProperties,
};

export const text = {
  heading: { color: "var(--fg)", fontWeight: 600, letterSpacing: "-0.02em" } as CSSProperties,
  muted:   { color: "var(--fg-muted)" } as CSSProperties,
  subtle:  { color: "var(--fg-subtle)" } as CSSProperties,
  primary: { color: "var(--primary)" } as CSSProperties,
  danger:  { color: "var(--danger)" } as CSSProperties,
  success: { color: "var(--success)" } as CSSProperties,
};

export const input: CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: "var(--r-sm)",
  color: "var(--fg)",
  fontSize: 13,
  padding: "5px 10px",
};

export const divider: CSSProperties = {
  borderTop: "1px solid var(--border)",
};

export const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--fg-subtle)",
};

export const chip = {
  base: {
    padding: "4px 12px",
    borderRadius: "var(--r-pill)",
    fontSize: 13,
    cursor: "pointer",
    border: "1px solid var(--border-strong)",
    background: "var(--surface-3)",
    color: "var(--fg)",
    fontWeight: 400,
  } as CSSProperties,
  active: {
    padding: "4px 12px",
    borderRadius: "var(--r-pill)",
    fontSize: 13,
    cursor: "pointer",
    border: "2px solid var(--primary)",
    background: "var(--primary-soft)",
    color: "var(--primary)",
    fontWeight: 600,
  } as CSSProperties,
};

export const nav: CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "6px 8px",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-xl)",
  width: "fit-content",
};

export const navLink = {
  base: {
    padding: "5px 14px",
    borderRadius: "var(--r-md)",
    textDecoration: "none",
    fontWeight: 400,
    fontSize: 14,
    color: "var(--fg-muted)",
    background: "transparent",
  } as CSSProperties,
  active: {
    padding: "5px 14px",
    borderRadius: "var(--r-md)",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 14,
    color: "var(--primary)",
    background: "var(--primary-soft)",
  } as CSSProperties,
};
