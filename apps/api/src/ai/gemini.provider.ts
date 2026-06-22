import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, GeminiPort } from "./ports";

const MODEL_CHAIN = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
const MAX_RETRIES = 3;

function is503(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  return msg.includes("503") || msg.includes("UNAVAILABLE");
}

@Injectable()
export class GeminiProvider implements GeminiPort {
  private readonly logger = new Logger(GeminiProvider.name);
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

  private async withRetry<T>(model: string, fn: (model: string) => Promise<T>): Promise<T> {
    let delay = 1000;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn(model);
      } catch (err) {
        if (is503(err) && attempt < MAX_RETRIES - 1) {
          this.logger.warn(`Gemini 503 on ${model}. Retry ${attempt + 1}/${MAX_RETRIES - 1} in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
    throw new Error("unreachable");
  }

  private async withFallback<T>(fn: (model: string) => Promise<T>): Promise<T> {
    for (let i = 0; i < MODEL_CHAIN.length; i++) {
      const model = MODEL_CHAIN[i];
      try {
        return await this.withRetry(model, fn);
      } catch (err) {
        if (is503(err) && i < MODEL_CHAIN.length - 1) {
          this.logger.warn(`${model} saturated after retries. Falling back to ${MODEL_CHAIN[i + 1]}`);
          continue;
        }
        throw err;
      }
    }
    throw new Error("All Gemini models unavailable");
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const res = await this.withFallback((model) =>
      this.ai.models.generateContent({
        model,
        contents,
        config: system ? { systemInstruction: system } : {},
      }),
    );
    return res.text ?? "";
  }

  async extractJson<T>(prompt: string, schema: object): Promise<T> {
    const res = await this.withFallback((model) =>
      this.ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json", responseSchema: schema as never },
      }),
    );
    return JSON.parse(res.text ?? "null") as T;
  }
}
