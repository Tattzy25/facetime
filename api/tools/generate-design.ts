// Vercel Serverless Function: POST /aip / tools / generate - design;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  const prompt: string = req.body?.prompt || "";

  // Dify MCP server (no auth)
  const MCP_URL = "https://api.dify.ai/mcp/server/pr44VVol6dVCBNuZ/mcp";
  const TOOL_NAME = "TaTTTy-MCP";

  const facetime_mcp = prompt.startsWith(
    " a TA-TTT-OO-ME style high resolution",
  )
    ? prompt
    : ` a TA-TTT-OO-ME style high resolution ${prompt}`.trimEnd();

  try {
    const initResp = await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "InkSight", version: "1.0.0" },
        },
      }),
    });

    if (!initResp.ok) {
      const text = await initResp.text();
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "MCP initialize failed",
          status: initResp.status,
          details: text,
        }),
      );
      return;
    }

    const callResp = await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: TOOL_NAME,
          arguments: {
            facetime_mcp,
          },
        },
      }),
    });

    const callJson = await callResp
      .json()
      .catch(async () => ({ raw: await callResp.text() }));
    if (!callResp.ok) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "MCP tools/call failed",
          status: callResp.status,
          details: callJson,
        }),
      );
      return;
    }

    const text = callJson?.result?.content?.[0]?.text;
    if (typeof text !== "string") {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Unexpected MCP response shape",
          details: callJson,
        }),
      );
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Failed to parse MCP tool text as JSON",
          rawText: text,
        }),
      );
      return;
    }

    let body: any = parsed?.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // keep as string
      }
    }

    const outputs: string[] | undefined = body?.output;
    const imageUrl = Array.isArray(outputs) ? outputs[0] : undefined;

    if (!imageUrl) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "No image URL found in MCP output",
          details: { parsed, body },
        }),
      );
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ imageUrl, outputs, raw: callJson }));
  } catch (error: any) {
    console.error("Error calling Dify MCP:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Failed to generate design via MCP" }));
  }
}
