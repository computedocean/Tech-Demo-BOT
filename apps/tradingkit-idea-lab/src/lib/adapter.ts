export const TRADINGKIT_MCP_URL = "https://app.tradingkit.com/mcp"
export const TRADINGKIT_INSTALL_URL = "https://app.tradingkit.com/install"

export type AdapterConfig = {
  enabled: boolean
  oauthConnected: boolean
}

/** The hosted adapter stays off until the user turns it on. OAuth is never stored here. */
export const defaultAdapterConfig: AdapterConfig = {
  enabled: false,
  oauthConnected: false,
}

export type SendResult = {
  sent: false
  reason: "disabled" | "needs_oauth" | "not_forwarded"
  message: string
}

/**
 * This demo never transmits a script and never places an order.
 * The official TradingKit connector uses the user's own OAuth, not an API key.
 */
export function sendToTradingKit(config: AdapterConfig): SendResult {
  if (!config.enabled) {
    return {
      sent: false,
      reason: "disabled",
      message:
        "Send to TradingKit is off. The local lab does not need it. Connect your own account at tradingkit.com or app.tradingkit.com/install if you want the hosted workspace. The official connector uses OAuth, not an API key. This demo never places orders.",
    }
  }
  if (!config.oauthConnected) {
    return {
      sent: false,
      reason: "needs_oauth",
      message: `The switch is on, but this browser has not completed your TradingKit OAuth. No request was sent to ${TRADINGKIT_MCP_URL}.`,
    }
  }
  return {
    sent: false,
    reason: "not_forwarded",
    message:
      "This demo build does not forward scripts to TradingKit, even after OAuth. Use your own client for the hosted workspace. No order was placed.",
  }
}
