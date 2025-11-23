// proxy.ts
// Minimal OpenAI-compatible proxy with streaming & PostgreSQL logging.
// Node 18+ required.

import "dotenv/config";
import http, { IncomingMessage, ServerResponse } from "http";
import { TextDecoder } from "util";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";

import { calculateCost } from "./cost";

const PORT = Number(process.env.PORT || 3007);
const UPSTREAM_URL = (process.env.UPSTREAM_URL || "").replace(/\/+$/, "");

// Validate UPSTREAM_URL is configured
if (!UPSTREAM_URL) {
  console.error("❌ UPSTREAM_URL environment variable is required");
  process.exit(1);
}

// --- PostgreSQL connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- Helper functions ---
function generateRequestId(): string {
  return uuidv4();
}

// Function to convert IPv6-mapped IPv4 addresses to IPv4 format
function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  // Handle IPv6-mapped IPv4 addresses (::ffff:x.x.x.x)
  if (ip.startsWith('::ffff:') && ip.length > 7) {
    return ip.substring(7);
  }
  return ip;
}

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function okPath(path: string) {
  return path.startsWith("/chat/completions") ||
         path.startsWith("/completions") ||
         path.startsWith("/models");
}

// --- Logging to Postgres ---
async function logToPG(data: Record<string, any>) {
  const keys = Object.keys(data);
  const cols = keys.map(k => `"${k}"`).join(",");
  const vals = keys.map((_, i) => `$${i + 1}`).join(",");
  const values = Object.values(data);

  await pool.query(`INSERT INTO ${process.env.DATABASE_TABLE || "llm_proxy"} (${cols}) VALUES (${vals})`, values);
}

// --- Main proxy server ---
const server = http.createServer(async (req, res) => {
  const start = Date.now();
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method || "GET";

    if (!okPath(path)) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const auth = req.headers["authorization"];
    if (!auth?.startsWith("Bearer ")) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Missing or invalid Authorization header" }));
      return;
    }

    const bodyBuf = method === "POST" ? await readBody(req) : Buffer.from("");
    const requestJson = bodyBuf.length ? JSON.parse(bodyBuf.toString()) : null;

    const targetUrl = UPSTREAM_URL + path + url.search;
    
    let upstreamRes;
    try {
      upstreamRes = await fetch(targetUrl, {
        method,
        headers: {
          "Content-Type": (req.headers["content-type"] as string) || "application/json",
          Authorization: auth,
        },
        // @ts-ignore
        duplex: "half",
        body: method === "POST" ? bodyBuf.toString() : undefined,
      });
    } catch (fetchError: any) {
      console.error("Fetch error:", fetchError.message, "URL:", targetUrl);
      res.statusCode = 502;
      res.end(JSON.stringify({ error: "Failed to connect to upstream", message: fetchError.message }));
      return;
    }

    const contentType = upstreamRes.headers.get("content-type") || "application/json";
    res.statusCode = upstreamRes.status;
    res.setHeader("Content-Type", contentType);

    // --- Streaming or non-streaming response handling ---
    let responseBody: any = null;
    if (contentType.includes("text/event-stream")) {
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
              } catch {
                /* ignore partial lines */
              }
            }
          }
        }
      }
      res.end();
    
      // Use whatever we captured from the stream
      responseBody = {
        streamed: true,
        preview: rawText.slice(0, 5000),
        usage: usageFromStream,
      };
    }
     else {
      const text = await upstreamRes.text();
      res.end(text);
      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = text;
      }
    }

    // --- Token usage and metadata ---
    const usage = responseBody?.usage || {};
    const totalCost = calculateCost(requestJson?.model || "default", usage);

    const logData = {
      timestamp: new Date(),
      request_method: method,
      request_path: path,
      model: (requestJson?.model || "default").toLowerCase(),
      completion_tokens: usage.completion_tokens || null,
      prompt_tokens: usage.prompt_tokens || null,
      total_tokens: usage.total_tokens || null,
      cached_tokens: usage.cached_tokens || null,
      total_cost: totalCost,
      response_time: Date.now() - start,
      request_body: requestJson,
      response_body: responseBody,
      response_status: upstreamRes.status,
      provider_url: UPSTREAM_URL,
      client_ip: normalizeIp(req.socket?.remoteAddress),
      user_agent: req.headers["user-agent"] || null,
      request_size: bodyBuf.length,
      response_size: Buffer.from(JSON.stringify(responseBody)).length,
      stream: contentType.includes("text/event-stream"),
      temperature: requestJson?.temperature || null,
      max_tokens: requestJson?.max_tokens || null,
      request_id: generateRequestId(),
    };

    logToPG(logData).catch(err => console.error("PG log error:", err));

  } catch (err: any) {
    console.error("Proxy error:", err);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "Proxy error", message: err?.message }));
  }
});

server.listen(PORT, () => {
  console.log(`✅ Proxy running at http://localhost:${PORT}`);
});
