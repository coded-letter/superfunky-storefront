export const CHAT_ASSISTANT_REST_NAMESPACE = "wp-json/funkycommerce-ai-assistant/v1";

export function chatAssistantEndpoints(backendBaseUrl: string | undefined) {
  if (!backendBaseUrl) return null;
  const baseUrl = backendBaseUrl.replace(/\/+$/, "") + "/";
  return {
    config: `${baseUrl}${CHAT_ASSISTANT_REST_NAMESPACE}/config`,
    chat: `${baseUrl}${CHAT_ASSISTANT_REST_NAMESPACE}/chat`,
  };
}

export type FlatAssistantIcon = "message-circle" | "bot" | "sparkles";

export function resolveFlatAssistantIcon(value: unknown): FlatAssistantIcon {
  return value === "bot" || value === "sparkles" ? value : "message-circle";
}
