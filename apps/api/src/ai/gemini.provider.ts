import { Injectable } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, GeminiPort } from "./ports";

@Injectable()
export class GeminiProvider implements GeminiPort {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  private model = "gemini-2.0-flash";

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
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents,
      config: system ? { systemInstruction: system } : {},
    });
    return res.text ?? "";
  }

  async extractJson<T>(prompt: string, schema: object): Promise<T> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema: schema as never },
    });
    return JSON.parse(res.text ?? "null") as T;
  }
}
