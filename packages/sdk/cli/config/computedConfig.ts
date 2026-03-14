import { loadActiveProfile } from "../auth/authUtils";
import { getConfig } from "./configUtils";

export function getWebSocketUrl(): string {
  const profile = loadActiveProfile();

  // Use stored websocket_url from backend config if available
  if (profile?.config?.websocket_url) {
    return profile.config.websocket_url;
  }

  function replaceHttpWithWs(url: string): string {
    return url.replace("http://", "ws://").replace("https://", "wss://");
  }

  if (profile) {
    return replaceHttpWithWs(profile.backendUrl) + "/ws/connection/websocket";
  } else {
    const config = getConfig();
    return replaceHttpWithWs(config.backendUrl) + "/ws/connection/websocket";
  }
}
