import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

export const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function getOpenAIClient() {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nije definisan u env fajlu.");
  }

  return new OpenAI({ apiKey });
}
