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
      const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
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
              description: "Generates a high-quality tattoo design based on a descriptive prompt.",
              parameters: {
                type: "object",
                properties: {
                  prompt: {
                    type: "string",
                    description: "A detailed description of the tattoo design to generate."
                  }
                },
                required: ["prompt"]
              }
            }
          ],
          tool_choice: "auto",
        }),
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Mock Tattoo Design Generator Tool
  app.post("/api/tools/generate-design", async (req, res) => {
    const { prompt } = req.body;
    // In a real scenario, this would call an image generation API (DALL-E 3 or similar)
    // For now, we'll return a high-quality placeholder from Picsum with a descriptive seed
    const seed = encodeURIComponent(prompt || "tattoo");
    const imageUrl = `https://picsum.photos/seed/${seed}/800/1200`;
    res.json({ imageUrl });
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
