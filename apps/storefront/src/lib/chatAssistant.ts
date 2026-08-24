export const CHAT_ASSISTANT_REST_NAMESPACE = "/wp-json/funkycommerce-ai-assistant/v1";

export function chatAssistantEndpoints(backendOrigin: string) {
  const origin = backendOrigin.replace(/\/+$/, "");
  return {
    config: `${origin}${CHAT_ASSISTANT_REST_NAMESPACE}/config`,
    chat: `${origin}${CHAT_ASSISTANT_REST_NAMESPACE}/chat`,
  };
}

export type FlatAssistantIcon = "message-circle" | "bot" | "sparkles";

export function resolveFlatAssistantIcon(value: unknown): FlatAssistantIcon {
  return value === "bot" || value === "sparkles" ? value : "message-circle";
}
