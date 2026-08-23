import "server-only";

import { geminiApiKey } from "@/lib/env";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const TIMEOUT_MS = 25_000;

export type GenerationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

/**
 * Asks the model for a JSON document matching `schema`.
 *
 * The response schema is enforced by the API, so the reply parses or the call
 * fails; callers still validate the contents before anything is persisted.
 */
export async function generateJson<T>(
  prompt: string,
  schema: Record<string, unknown>,
): Promise<GenerationResult<T>> {
  const key = geminiApiKey();
  if (!key) return { ok: false, reason: "no_api_key" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("");

    if (!text) return { ok: false, reason: "empty_response" };

    try {
      return { ok: true, value: JSON.parse(text) as T };
    } catch {
      return { ok: false, reason: "unparsable_json" };
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}
