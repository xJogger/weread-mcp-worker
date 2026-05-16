import { getGatewayUrl, getSkillVersion } from "../utils/env";
import { WeReadApiError } from "./errors";
import type { WeReadGatewayResponse } from "./types";

export interface WeReadClientOptions {
  apiKey: string;
  endpoint?: string;
  skillVersion?: string;
  fetcher?: typeof fetch;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

export class WeReadClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly skillVersion: string;
  private readonly fetcher: typeof fetch;

  constructor(options: WeReadClientOptions) {
    this.apiKey = options.apiKey.trim();
    this.endpoint = trimTrailingSlash(options.endpoint || "https://i.weread.qq.com/api/agent/gateway");
    this.skillVersion = options.skillVersion || "1.0.3";
    this.fetcher = options.fetcher || fetch;
    if (!this.apiKey) throw new WeReadApiError("WeRead API key is empty.");
  }

  static fromEnv(apiKey: string, env: Env): WeReadClient {
    return new WeReadClient({
      apiKey,
      endpoint: getGatewayUrl(env),
      skillVersion: getSkillVersion(env)
    });
  }

  async call<T extends WeReadGatewayResponse = WeReadGatewayResponse>(apiName: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!apiName.startsWith("/")) {
      throw new WeReadApiError("Invalid WeRead api_name.");
    }

    const body = {
      api_name: apiName,
      ...params,
      skill_version: this.skillVersion
    };

    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new WeReadApiError(`WeRead API returned non-JSON response (${response.status}).`, { status: response.status });
    }

    if (!response.ok) {
      const message = isObject(json) && typeof json.message === "string" ? json.message : `WeRead API HTTP ${response.status}.`;
      throw new WeReadApiError(message, { status: response.status });
    }

    if (!isObject(json)) {
      throw new WeReadApiError("Unexpected WeRead API response format.");
    }

    const upgradeInfo = json.upgrade_info;
    if (isObject(upgradeInfo)) {
      const message = typeof upgradeInfo.message === "string" ? upgradeInfo.message : "WeRead skill API requires upgrade.";
      throw new WeReadApiError(message);
    }

    const errcode = json.errcode;
    if (errcode !== undefined && errcode !== 0 && errcode !== "0") {
      const errmsg = typeof json.errmsg === "string" ? json.errmsg : typeof json.message === "string" ? json.message : `WeRead API error: ${String(errcode)}`;
      throw new WeReadApiError(errmsg, { errcode: errcode as number | string });
    }

    return json as T;
  }
}
