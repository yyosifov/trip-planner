export const GEMINI = "GeminiPort";
export const SEARCH = "SearchPort";
export const MAPS = "MapsPort";

export interface ChatMessage { role: "user" | "assistant" | "system"; content: string; }

export interface GeminiPort {
  chat(messages: ChatMessage[]): Promise<string>;
  extractJson<T>(prompt: string, schema: object): Promise<T>;
}
export interface SearchResult { title: string; url: string; description: string; }
export interface SearchPort { search(query: string, count: number): Promise<SearchResult[]>; }
export interface MapsPort {
  geocode(query: string): Promise<{ lat: number; lng: number } | null>;
  photoUrl(query: string): Promise<string | null>;
}
