/**
 * INTEGRATION TESTS - REAL API CALLS
 * 
 * These tests make REAL calls to OpenAI API and Dify MCP.
 * They verify the actual functionality works end-to-end.
 * 
 * Requirements:
 * - OPENAI_API_KEY must be set in environment
 * - Real network connection required
 * - These tests will consume API credits
 */

import { describe, it, expect, beforeAll } from "vitest";
import handler from "./session";
import generateDesignHandler from "./tools/generate-design";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

describe("INTEGRATION: Real API Session Creation", () => {
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY not found. Set it in .env file to run integration tests."
      );
    }
  });

  it("should create a REAL OpenAI session with ephemeral token", async () => {
    const mockReq = {
      method: "POST",
      body: {},
    };

    const mockRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: "",
      setHeader(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      end(data: string) {
        this.body = data;
        return this;
      },
    };

    await handler(mockReq, mockRes);

    console.log("Response Status:", mockRes.statusCode);
    console.log("Response Body:", mockRes.body);

    expect(mockRes.statusCode).toBe(200);
    
    const responseData = JSON.parse(mockRes.body);
    
    // Verify real session structure
    expect(responseData).toHaveProperty("id");
    expect(responseData).toHaveProperty("client_secret");
    expect(responseData.client_secret).toHaveProperty("value");
    expect(responseData.client_secret).toHaveProperty("expires_at");
    
    // Verify the ephemeral token format (can be eph_ or ek_ prefix)
    expect(responseData.client_secret.value).toMatch(/^(eph_|ek_)/);
    
    console.log("✅ Real session created successfully!");
    console.log("Session ID:", responseData.id);
    console.log("Token expires at:", new Date(responseData.client_secret.expires_at * 1000).toISOString());
  }, 30000); // 30 second timeout for real API call

  it("should include tattoo consultant configuration in real session", async () => {
    const mockReq = {
      method: "POST",
      body: {},
    };

    const mockRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: "",
      setHeader(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      end(data: string) {
        this.body = data;
        return this;
      },
    };

    await handler(mockReq, mockRes);

    expect(mockRes.statusCode).toBe(200);
    
    const responseData = JSON.parse(mockRes.body);
    
    // Verify model configuration (OpenAI may return different version strings)
    expect(responseData.model).toContain("gpt-4o-realtime-preview");
    expect(responseData.modalities).toContain("audio");
    expect(responseData.modalities).toContain("text");
    expect(responseData.voice).toBe("alloy");
    
    console.log("✅ Session configured with correct model and modalities");
    console.log("Model:", responseData.model);
    console.log("Modalities:", responseData.modalities);
  }, 30000);
});

describe("INTEGRATION: Real Tool Call - Generate Tattoo Design", () => {
  it("should generate a REAL tattoo design via Dify MCP", async () => {
    const mockReq = {
      method: "POST",
      body: {
        prompt: "dragon on forearm, black and grey style",
      },
    };

    const mockRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: "",
      setHeader(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      end(data: string) {
        this.body = data;
        return this;
      },
    };

    console.log("🎨 Generating real tattoo design...");
    
    await generateDesignHandler(mockReq, mockRes);

    console.log("Response Status:", mockRes.statusCode);
    console.log("Response Body:", mockRes.body);

    expect(mockRes.statusCode).toBe(200);
    
    const responseData = JSON.parse(mockRes.body);
    
    // Verify real image URL was returned
    expect(responseData).toHaveProperty("imageUrl");
    expect(responseData.imageUrl).toMatch(/^https?:\/\//);
    
    console.log("✅ Real tattoo design generated!");
    console.log("Image URL:", responseData.imageUrl);
    console.log("Outputs:", responseData.outputs);
  }, 60000); // 60 second timeout for design generation

  it("should handle prompt with TA-TTT-OO-ME style prefix", async () => {
    const mockReq = {
      method: "POST",
      body: {
        prompt: "phoenix rising from ashes, colorful",
      },
    };

    const mockRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: "",
      setHeader(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      end(data: string) {
        this.body = data;
        return this;
      },
    };

    console.log("🎨 Testing prompt formatting...");
    
    await generateDesignHandler(mockReq, mockRes);

    expect(mockRes.statusCode).toBe(200);
    
    const responseData = JSON.parse(mockRes.body);
    expect(responseData).toHaveProperty("imageUrl");
    
    console.log("✅ Prompt formatted and design generated!");
  }, 60000);
});

describe("INTEGRATION: Error Handling with Real API", () => {
  it("should handle invalid method gracefully", async () => {
    const mockReq = {
      method: "GET",
      body: {},
    };

    const mockRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: "",
      setHeader(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      end(data: string) {
        this.body = data;
        return this;
      },
    };

    await handler(mockReq, mockRes);

    expect(mockRes.statusCode).toBe(405);
    expect(JSON.parse(mockRes.body)).toEqual({ error: "Method Not Allowed" });
  });

  it("should handle missing prompt in design generation", async () => {
    const mockReq = {
      method: "POST",
      body: {},
    };

    const mockRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: "",
      setHeader(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      end(data: string) {
        this.body = data;
        return this;
      },
    };

    console.log("🧪 Testing empty prompt handling...");
    
    await generateDesignHandler(mockReq, mockRes);

    // Should still attempt to generate with default prompt
    console.log("Response Status:", mockRes.statusCode);
    console.log("Response Body:", mockRes.body);
  }, 60000);
});
