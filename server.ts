import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Endpoint to get ephemeral token for OpenAI Realtime API
  app.post("/api/session", async (req, res) => {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/realtime/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-realtime-preview", // Using the requested S2S model base
            voice: "alloy",
            instructions: `You are a professional tattoo consultant. 
          CRITICAL: You have visual eyes. You will receive screenshots of the user's camera every 500ms.
          Use these images to see the user's skin, existing tattoos, or the area they want to get tattooed.
          Comment on what you see! If they show you their arm, say "I see your arm". 
          If they show you a drawing, comment on the drawing.
          Be encouraging, artistic, and professional.
          If the user asks for a sample or a design, use the 'generate_tattoo_design' tool.
          Do not mention that you are receiving screenshots unless asked. Just act like you can see them live.`,
            modalities: ["text", "audio"],
            tools: [
              {
                type: "function",
                name: "generate_tattoo_design",
                description:
                  "Generates a high-quality tattoo design based on a descriptive prompt.",
                parameters: {
                  type: "object",
                  properties: {
                    prompt: {
                      type: "string",
                      description:
                        "A detailed description of the tattoo design to generate.",
                    },
                  },
                  required: ["prompt"],
                },
              },
            ],
            tool_choice: "auto",
          }),
        },
      );

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.post("/api/tools/generate-design", async (req, res) => {
    const prompt: string = req.body?.prompt || "";

    // Dify MCP server (no auth as per your instructions)
    const MCP_URL = "https://api.dify.ai/mcp/server/pr44VVol6dVCBNuZ/mcp";
    const TOOL_NAME = "TaTTTy-MCP";

    // Per the Dify MCP tool schema: ONLY use facetime_mcp.
    // And start the prompt with: " a TA-TTT-OO-ME style high resolution... "
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
        res
          .status(502)
          .json({
            error: "MCP initialize failed",
            status: initResp.status,
            details: text,
          });
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
        res
          .status(502)
          .json({
            error: "MCP tools/call failed",
            status: callResp.status,
            details: callJson,
          });
        return;
      }

      const text = callJson?.result?.content?.[0]?.text;
      if (typeof text !== "string") {
        res
          .status(502)
          .json({ error: "Unexpected MCP response shape", details: callJson });
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        res
          .status(502)
          .json({
            error: "Failed to parse MCP tool text as JSON",
            rawText: text,
          });
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
        res
          .status(502)
          .json({
            error: "No image URL found in MCP output",
            details: { parsed, body },
          });
        return;
      }

      res.json({ imageUrl, outputs, raw: callJson });
    } catch (error) {
      console.error("Error calling Dify MCP:", error);
      res.status(500).json({ error: "Failed to generate design via MCP" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
