import fs from "node:fs";
import path from "node:path";
import axios, { AxiosInstance } from "axios";
import { SystemPath } from "./system-path";
import { logger } from "./logger";

/**
 * Self-hosted cloud saves (fork feature).
 *
 * When configured, every "/profile/games/artifacts..." request that would go
 * to Hydra's API is sent to your own server instead (see hydra-saves-server),
 * and the Hydra Cloud subscription requirement is lifted for those saves.
 *
 * Configuration, first match wins:
 *   1. env HYDRA_SAVES_URL + HYDRA_SAVES_TOKEN
 *   2. <userData>/self-hosted-saves.json  { "url": "...", "token": "..." }
 */

interface SelfHostedSavesConfig {
  url: string;
  token: string;
}

const ROUTED_PREFIX = "/profile/games/artifacts";
const CONFIG_FILE_NAME = "self-hosted-saves.json";

export class SelfHostedSaves {
  private static config: SelfHostedSavesConfig | null | undefined;
  private static instance: AxiosInstance | null = null;

  public static getConfigFilePath() {
    return path.join(SystemPath.getPath("userData"), CONFIG_FILE_NAME);
  }

  private static loadConfig(): SelfHostedSavesConfig | null {
    const envUrl = process.env.HYDRA_SAVES_URL;
    const envToken = process.env.HYDRA_SAVES_TOKEN;
    if (envUrl && envToken) return { url: envUrl, token: envToken };

    const file = this.getConfigFilePath();
    try {
      if (!fs.existsSync(file)) return null;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        typeof parsed?.url === "string" &&
        typeof parsed?.token === "string"
      ) {
        if (parsed.enabled === false) return null;
        return { url: parsed.url, token: parsed.token };
      }
      logger.error(`[SelfHostedSaves] ${file} needs "url" and "token"`);
    } catch (err) {
      logger.error("[SelfHostedSaves] Failed to read config", err);
    }
    return null;
  }

  private static getConfig() {
    if (this.config === undefined) {
      this.config = this.loadConfig();
      if (this.config) {
        logger.log(`[SelfHostedSaves] Using ${this.config.url}`);
      }
    }
    return this.config;
  }

  public static isEnabled() {
    return this.getConfig() !== null;
  }

  public static handles(url: string) {
    if (!this.isEnabled()) return false;
    const pathname = url.split("?")[0];
    return (
      pathname === ROUTED_PREFIX || pathname.startsWith(ROUTED_PREFIX + "/")
    );
  }

  private static getInstance() {
    const config = this.getConfig();
    if (!config) throw new Error("Self-hosted saves are not configured");
    if (!this.instance) {
      this.instance = axios.create({
        baseURL: config.url.replace(/\/+$/, ""),
        timeout: 60_000,
        headers: { Authorization: `Bearer ${config.token}` },
      });
    }
    return this.instance;
  }

  public static async request<T>(
    method: "get" | "post" | "put" | "patch" | "delete",
    url: string,
    data?: unknown,
    params?: unknown
  ): Promise<T> {
    try {
      const response = await this.getInstance().request<T>({
        method,
        url,
        data,
        params,
      });
      return response.data;
    } catch (err) {
      logger.error(`[SelfHostedSaves] ${method.toUpperCase()} ${url} failed`, {
        status: axios.isAxiosError(err) ? err.response?.status : undefined,
        message: axios.isAxiosError(err)
          ? (err.response?.data?.message ?? err.message)
          : String(err),
      });
      throw err;
    }
  }
}
