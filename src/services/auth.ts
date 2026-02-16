import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { AuthTokens } from "../types.js";
import { AUTH_BASE_URL, AUTH_CLIENT_ID, AUTH_REALM } from "../constants.js";

const REDIRECT_URI = "https://www.cookunity.com";

export class CookUnityAuth {
  private email: string;
  private password: string;
  private tokens: AuthTokens | null = null;

  constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
  }

  async getAccessToken(): Promise<string> {
    if (this.tokens && this.isTokenValid(this.tokens)) {
      return this.tokens.access_token;
    }
    await this.authenticate();
    return this.tokens!.access_token;
  }

  private isTokenValid(tokens: AuthTokens): boolean {
    return Date.now() < tokens.expires_at - 60000;
  }

  private async authenticate(): Promise<void> {
    try {
      // Create a session with cookie jar (Auth0 requires cookies across requests)
      const jar = new CookieJar();
      const client = wrapper(axios.create({ jar, timeout: 30000 }));

      // Step 1: Get login ticket
      const r1 = await client.post(`${AUTH_BASE_URL}/co/authenticate`, {
        client_id: AUTH_CLIENT_ID,
        credential_type: "http://auth0.com/oauth/grant-type/password-realm",
        username: this.email,
        password: this.password,
        realm: AUTH_REALM,
      }, {
        headers: { "Content-Type": "application/json", "Origin": "https://www.cookunity.com" },
      });

      const loginTicket = r1.data?.login_ticket as string | undefined;
      if (!loginTicket) throw new Error("Failed to get login ticket");

      // Step 2: Authorize — follow redirects to get the auth code
      const params = new URLSearchParams({
        client_id: AUTH_CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: "openid profile email",
        realm: AUTH_REALM,
        login_ticket: loginTicket,
      });

      // Follow redirects until we get a code in the callback URL
      let currentUrl = `${AUTH_BASE_URL}/authorize?${params}`;
      let code: string | null = null;
      for (let i = 0; i < 5; i++) {
        const r = await client.get(currentUrl, {
          maxRedirects: 0,
          validateStatus: (status) => status === 302,
        });
        const loc = r.headers.location as string | undefined;
        if (!loc) throw new Error("No redirect location in authorize flow");
        const resolved = loc.startsWith("http") ? loc : `${AUTH_BASE_URL}${loc}`;
        const parsed = new URL(resolved);
        code = parsed.searchParams.get("code");
        if (code) break;
        currentUrl = resolved;
      }
      if (!code) throw new Error("Failed to obtain authorization code");

      // Step 3: Exchange code for tokens
      const r4 = await client.post(`${AUTH_BASE_URL}/oauth/token`, {
        client_id: AUTH_CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }, {
        headers: { "Content-Type": "application/json" },
      });

      const tokenData = r4.data as { access_token?: string; refresh_token?: string; expires_in?: number };
      if (!tokenData.access_token) throw new Error("Failed to get access token");

      this.tokens = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + (tokenData.expires_in ?? 86400) * 1000,
      };
    } catch (error) {
      throw new Error(`Authentication failed: ${this.getErrorMessage(error)}`);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as Record<string, unknown> | undefined;
      if (data?.error_description) return String(data.error_description);
      if (data?.message) return String(data.message);
      if (error.response?.status) return `HTTP ${error.response.status}: ${error.response.statusText}`;
    }
    return error instanceof Error ? error.message : "Unknown error";
  }
}
