/**
 * OpenProxy is a proxy server for OpenAI and Anthropic compatible endpoints.
 * 
 * To configure the proxy, refer to the README.md file for instructions on how to
 * set up the environment variables. The server supports both OpenAI and Anthropic
 * compatible endpoints.
 * 
 * Once configured, the server will be accessible via the following URLs:
 * 
 * - http://localhost:3007/openai/* for OpenAI compatible endpoints
 * - http://localhost:3007/anthropic/* for Anthropic compatible endpoints
 * 
 * @example
 * ```bash
 * curl -X POST http://localhost:3007/openai/v1/chat/completions \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer your-api-key" \
 *   -d '{
 *     "model": "gpt-4o",
 *     "messages": [{"role": "user", "content": "Hello!"}]
 *   }'
 * ```
 * 
 * @example
 * ```bash
 * curl -X POST http://localhost:3007/anthropic/v1/messages \
 *   -H "Content-Type: application/json" \
 *   -H "x-api-key: your-api-key" \
 *   -H "anthropic-version: 2023-06-01" \
 *   -d '{
 *     "model": "claude-sonnet-4-20250514",
 *     "max_tokens": 1024,
 *     "messages": [{"role": "user", "content": "Hello!"}]
 *   }'
 * ```
 */

import "dotenv/config";

import http, { IncomingMessage, ServerResponse } from "http";
import { TextDecoder } from "util";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";

import { calculateCost, loadHeliconeCosts } from "./cost";

/**
 * Configuration Options
 * 
 * - PORT: The port number to listen on. Default is 3007.
 * - OPENAI_UPSTREAM_URL: The URL of the OpenAI compatible endpoint.
 * - ANTHROPIC_UPSTREAM_URL: The URL of the Anthropic compatible endpoint.
 * - DATABASE_URL: The URL of the PostgreSQL database to use for logging.
 */
const PORT = Number(process.env.PORT || 3007);
const OPENAI_UPSTREAM_URL = (process.env.OPENAI_UPSTREAM_URL || "").replace(/\/+$/, "");
const ANTHROPIC_UPSTREAM_URL = (process.env.ANTHROPIC_UPSTREAM_URL || "").replace(/\/+$/, "");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Types
 * 
 * - Provider: The provider of the API. Can be "openai" or "anthropic".
 * - ProviderConfig: The configuration for the provider.
 * - ParsedRoute: The parsed route from the request URL.
 */
type Provider = "openai" | "anthropic";

interface ProviderConfig {
  upstreamUrl: string;
}

interface ParsedRoute {
  provider: Provider;
  upstreamPath: string;
}

const PROVIDER_PREFIXES: { prefix: string; provider: Provider }[] = [
  { prefix: "/openai", provider: "openai" },
  { prefix: "/anthropic", provider: "anthropic" },
];

/**
 * Normalizes the IP address to remove IPv6-mapped IPv4 addresses.
 * 
 * @param ip: The IP address to normalize.
 * @returns The normalized IP address.
 */
function normalizeIP(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.startsWith('::ffff:') && ip.length > 7) {
    return ip.substring(7);
  }
  return ip;
}

/**
 * Sets the CORS headers for the response.
 * 
 * @param res: The response object.
 */
function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, x-api-key, anthropic-version, anthropic-beta");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

/**
 * Reads the body of the request.
 * 
 * @param req: The request object.
 * @returns The body of the request.
 */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Parses the route from the request URL.
 * 
 * @param path: The path of the request URL.
 * @returns The parsed route.
 */
function parseRoute(path: string): ParsedRoute | null {
  for (const { prefix, provider } of PROVIDER_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      const upstreamPath = path.slice(prefix.length) || "/";
      return { provider, upstreamPath };
    }
  }
  return null;
}

/**
 * Gets the provider configuration.
 * 
 * @param provider: The provider of the API.
 * @returns The provider configuration.
 */
function getProviderConfig(provider: Provider): ProviderConfig {
  switch (provider) {
    case "anthropic":
      return { upstreamUrl: ANTHROPIC_UPSTREAM_URL };
    case "openai":
    default:
      return { upstreamUrl: OPENAI_UPSTREAM_URL };
  }
}

/**
 * Gets the authentication token from the request headers.
 * 
 * @param req: The request object.
 * @param provider: The provider of the API.
 * @returns The authentication token.
 */
function getAuthToken(req: IncomingMessage, provider: Provider): string | null {
  if (provider === "anthropic") {
    const apiKey = req.headers["x-api-key"];
    if (apiKey) return String(apiKey);
    
    const auth = req.headers["authorization"];
    if (auth?.startsWith("Bearer ")) {
      return auth.slice(7);
    }

    return null;
  } else {
    const auth = req.headers["authorization"];
    if (auth?.startsWith("Bearer ")) {
      return auth.slice(7);
    }

    return null;
  }
}

/**
 * Builds the headers for the upstream request.
 * 
 * @param req: The request object.
 * @param provider: The provider of the API.
 * @param authToken: The authentication token.
 * @returns The headers for the upstream request.
 */
function buildUpstreamHeaders(req: IncomingMessage, provider: Provider, authToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": (req.headers["content-type"] as string) || "application/json",
  };

  if (provider === "anthropic") {
    headers["x-api-key"] = authToken;
    if (req.headers["anthropic-version"]) {
      headers["anthropic-version"] = String(req.headers["anthropic-version"]);
    } else {
      headers["anthropic-version"] = "2023-06-01";
    }
    if (req.headers["anthropic-beta"]) {
      headers["anthropic-beta"] = String(req.headers["anthropic-beta"]);
    }
  } else {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return headers;
}

/**
 * Normalizes the usage from different providers.
 * 
 * @param usage: The usage object.
 * @param provider: The provider of the API.
 * @returns The normalized usage.
 */
interface NormalizedUsage {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cached_tokens: number | null;
}

/**
 * Normalizes the usage from different providers.
 * 
 * @param usage: The usage object.
 * @param provider: The provider of the API.
 * @returns The normalized usage.
 */
function normalizeUsage(usage: any, provider: Provider): NormalizedUsage {
  if (!usage) {
    return { prompt_tokens: null, completion_tokens: null, total_tokens: null, cached_tokens: null };
  }

  if (provider === "anthropic") {
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cachedTokens = usage.cache_read_input_tokens || usage.cache_creation_input_tokens || 0;
    return {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cached_tokens: cachedTokens || null,
    };
  } else {
    return {
      prompt_tokens: usage.prompt_tokens || null,
      completion_tokens: usage.completion_tokens || null,
      total_tokens: usage.total_tokens || null,
      cached_tokens: usage.prompt_tokens_details?.cached_tokens || null,
    };
  }
}

/**
 * Logs the data to the PostgreSQL database.
 * 
 * @param data: The data to log.
 */
async function persistDatabaseRecord(data: Record<string, any>) {
  const keys = Object.keys(data);
  const cols = keys.map(k => `"${k}"`).join(",");
  const vals = keys.map((_, i) => `$${i + 1}`).join(",");
  const values = Object.values(data);

  const TABLE_NAME = "llm_proxy";
  await pool.query(`INSERT INTO ${TABLE_NAME} (${cols}) VALUES (${vals})`, values);
}

/**
 * Creates the proxy server.
 * 
 * @param req: The request object.
 * @param res: The response object.
 */
const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const startTime = Date.now();
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method || "GET";

    const route = parseRoute(path);
    
    if (!route) {
      res.statusCode = 404;
      res.end(JSON.stringify({ 
        error: "INVALID_PROVIDER_PREFIX", 
        message: "Invalid provider prefix in request URL"
      }));
      return;
    }

    const { provider, upstreamPath } = route;
    const config = getProviderConfig(provider);
    
    if (!config.upstreamUrl) {
      res.statusCode = 503;
      res.end(JSON.stringify({ 
        error: "UPSTREAM_URL_NOT_CONFIGURED", 
        message: `${provider.toUpperCase()}_UPSTREAM_URL is not configured` 
      }));
      return;
    }

    const authToken = getAuthToken(req, provider);
    if (!authToken) {
      res.statusCode = 401;
      res.end(JSON.stringify({
        error: "MISSING_OR_INVALID_AUTHORIZATION_HEADER",
        message: "Missing or invalid Authorization header"
      }));
      return;
    }

    const bodyBuf = method === "POST" ? await readBody(req) : Buffer.from("");
    const requestJson = bodyBuf.length ? JSON.parse(bodyBuf.toString()) : null;

    const targetUrl = config.upstreamUrl + upstreamPath + url.search;
    const upstreamHeaders = buildUpstreamHeaders(req, provider, authToken);
    
    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(targetUrl, {
        // @ts-ignore
        duplex: "half",
        method,
        headers: upstreamHeaders,
        body: method === "POST" ? bodyBuf.toString() : undefined,
      });
    } catch (fetchError: any) {
      console.error(`[${provider}] Upstream connection failed:`, fetchError.message, "URL:", targetUrl);

      res.statusCode = 502;
      res.end(JSON.stringify({
        error: "UPSTREAM_CONNECTION_FAILED",
        message: fetchError.message
      }));
      return;
    }

    const contentType = upstreamRes.headers.get("content-type") || "application/json";
    res.statusCode = upstreamRes.status;
    res.setHeader("Content-Type", contentType);

    let responseBody: any = null;
    const isStreaming = contentType.includes("text/event-stream");
    
    if (isStreaming) {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Transfer-Encoding", "chunked");
    
      const reader = upstreamRes.body?.getReader();
      const decoder = new TextDecoder();
    
      let rawText = "";
      let usageFromStream: any = null;
    
      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const chunk = decoder.decode(value);
            res.write(value);
            rawText += chunk;
    
            buffer += chunk;
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || "";
    
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const jsonStr = line.slice(5).trim();
              if (jsonStr === "[DONE]" || jsonStr === "") continue;
              try {
                const obj = JSON.parse(jsonStr);
                if (obj.usage) usageFromStream = obj.usage;
                if (obj.type === "message_delta" && obj.usage) {
                  usageFromStream = obj.usage;
                }
                if (obj.type === "message_start" && obj.message?.usage) {
                  usageFromStream = { ...usageFromStream, ...obj.message.usage };
                }
              } catch {} // eslint-disable-line no-empty
            }
          }
        }
      }

      res.end();
    
      responseBody = {
        streamed: true,
        preview: rawText.slice(0, 5000),
        usage: usageFromStream,
      };
    } else {
      const text = await upstreamRes.text();
      res.end(text);
      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = text;
      }
    }

    /**
     * In an async manner, we calculate the usage and cost for logging.
     * Once the calculation is complete, we persist the data to the database.
     * 
     * These actions don't block the main thread and allows the proxy to continue
     * processing incoming requests and outgoing responses.
     */

    // Calculate usage and cost
    const rawUsage = responseBody?.usage || {};
    const normalizedUsage = normalizeUsage(rawUsage, provider);
    const model = requestJson?.model || "default";
    const totalCost = calculateCost(model, {
      prompt_tokens: normalizedUsage.prompt_tokens || 0,
      completion_tokens: normalizedUsage.completion_tokens || 0,
      prompt_tokens_details: normalizedUsage.cached_tokens ? { cached_tokens: normalizedUsage.cached_tokens } : undefined,
    });

    // Prepare data for database persistence
    const logData = {
      timestamp: new Date(),
      request_method: method,
      request_path: upstreamPath,
      provider: provider,
      model: model.toLowerCase(),
      completion_tokens: normalizedUsage.completion_tokens,
      prompt_tokens: normalizedUsage.prompt_tokens,
      total_tokens: normalizedUsage.total_tokens,
      cached_tokens: normalizedUsage.cached_tokens,
      total_cost: totalCost,
      response_time: Date.now() - startTime,
      request_body: requestJson,
      response_body: responseBody,
      response_status: upstreamRes.status,
      provider_url: config.upstreamUrl,
      client_ip: normalizeIP(req.socket?.remoteAddress),
      user_agent: req.headers["user-agent"] || null,
      request_size: bodyBuf.length,
      response_size: Buffer.from(JSON.stringify(responseBody)).length,
      stream: isStreaming,
      temperature: requestJson?.temperature || null,
      max_tokens: requestJson?.max_tokens || null,
      request_id: uuidv4(),
    };

    // Persist data to the database
    persistDatabaseRecord(logData).catch(err => console.error("Database persistence error:", err));
  } catch (err: any) {
    console.error("Internal server error:", err);

    res.statusCode = 502;
    res.end(JSON.stringify({ error: "INTERNAL_SERVER_ERROR", message: err?.message }));
  }
});

/**
 * Starts the proxy server.
 * 
 * Loads Helicone cost data before starting the server to ensure
 * accurate cost calculations are available for all requests.
 * 
 * @param port: The port number to listen on.
 * @returns The proxy server.
 */
async function startServer() {
  console.log(`\n\x1b[32mOpenProxy starting...\x1b[0m\n`);

  await loadHeliconeCosts();

  server.listen(PORT, () => {
    console.log(`\n\x1b[32mOpenProxy upstream connections activated ⟣⟢\x1b[0m\n`);

    if (OPENAI_UPSTREAM_URL) console.log(`\x1b[34m  📡 http://localhost:${PORT}/openai/* → ${OPENAI_UPSTREAM_URL}\x1b[0m`);
    if (ANTHROPIC_UPSTREAM_URL) console.log(`\x1b[34m  📡 http://localhost:${PORT}/anthropic/* → ${ANTHROPIC_UPSTREAM_URL}\x1b[0m\n`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
