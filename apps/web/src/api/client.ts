const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => fetch(`${BASE}${path}`).then((r) => handle<T>(r)),
  post: <T>(path: string, body?: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then((r) => handle<T>(r)),
  patch: <T>(path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  del: (path: string) =>
    fetch(`${BASE}${path}`, { method: "DELETE" }).then((r) => handle<void>(r)),
};
