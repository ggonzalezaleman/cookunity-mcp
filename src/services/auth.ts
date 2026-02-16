import axios, { AxiosError } from "axios";
import { AuthTokens } from "../types.js";
import { AUTH_BASE_URL, AUTH_CLIENT_ID, AUTH_REALM } from "../constants.js";

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
      const loginTicket = await this.getLoginTicket();
      const authCode = await this.authorize(loginTicket);
      const tokenData = await this.exchangeCodeForTokens(authCode);
      this.tokens = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + (tokenData.expires_in as number) * 1000,
      };
    } catch (error) {
      throw new Error(`Authentication failed: ${this.getErrorMessage(error)}`);
    }
  }

  private async getLoginTicket(): Promise<string> {
    const response = await axios.post(
      `${AUTH_BASE_URL}/co/authenticate`,
      {
        client_id: AUTH_CLIENT_ID,
        credential_type: "password",
        username: this.email,
        password: this.password,
        realm: AUTH_REALM,
      },
      { headers: { "Content-Type": "application/json", "User-Agent": "CookUnity-MCP/1.0.0" } }
    );
    if (!response.data.login_ticket) throw new Error("Failed to get login ticket");
    return response.data.login_ticket as string;
  }

  private async authorize(loginTicket: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: AUTH_CLIENT_ID,
      response_type: "code",
      redirect_uri: "https://app.cookunity.com/auth/callback",
      scope: "openid profile email",
      state: "cookunity_mcp",
      realm: AUTH_REALM,
      login_ticket: loginTicket,
    });
    const response = await axios.get(`${AUTH_BASE_URL}/authorize?${params}`, {
      maxRedirects: 0,
      validateStatus: (status) => status === 302,
      headers: { "User-Agent": "CookUnity-MCP/1.0.0" },
    });
    const location = response.headers.location as string | undefined;
    if (!location) throw new Error("No redirect location in authorize response");
    const url = new URL(location);
    const code = url.searchParams.get("code");
    if (!code) throw new Error("No authorization code in callback URL");
    return code;
  }

  private async exchangeCodeForTokens(
    code: string
  ): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
    const response = await axios.post(
      `${AUTH_BASE_URL}/oauth/token`,
      {
        grant_type: "authorization_code",
        client_id: AUTH_CLIENT_ID,
        code,
        redirect_uri: "https://app.cookunity.com/auth/callback",
      },
      { headers: { "Content-Type": "application/json", "User-Agent": "CookUnity-MCP/1.0.0" } }
    );
    if (!response.data.access_token) throw new Error("Failed to get access token");
    return response.data as { access_token: string; refresh_token?: string; expires_in: number };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      const data = error.response?.data as Record<string, unknown> | undefined;
      if (data?.error_description) return String(data.error_description);
      if (data?.message) return String(data.message);
      if (error.response?.status) return `HTTP ${error.response.status}: ${error.response.statusText}`;
    }
    return error instanceof Error ? error.message : "Unknown error";
  }
}
