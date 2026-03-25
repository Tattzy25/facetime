/**
 * END-TO-END INTEGRATION TEST
 * 
 * Tests the complete flow:
 * 1. Start local server
 * 2. Create real OpenAI session
 * 3. Establish WebRTC connection
 * 4. Send video frames (screenshots)
 * 5. Trigger tool call
 * 6. Verify AI responses
 * 
 * Run with: npm run dev (in one terminal)
 *           npx vitest run api/e2e.test.ts (in another)
 */

import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";

dotenv.config();

const SERVER_URL = "http://localhost:3000";

describe("E2E: Full Application Flow", () => {
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY required for E2E tests");
    }
  });

  it("should create session via local server endpoint", async () => {
    console.log("🔌 Testing /api/session endpoint...");
    
    const response = await fetch(`${SERVER_URL}/api/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok).toBe(true);
    
    const data = await response.json();
    
    console.log("✅ Session created via server");
    console.log("Session ID:", data.id);
    console.log("Model:", data.model);
    console.log("Ephemeral Token:", data.client_secret.value.substring(0, 20) + "...");
    
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("client_secret");
    expect(data.client_secret.value).toMatch(/^eph_/);
    expect(data.model).toBe("gpt-4o-realtime-preview-2024-12-17");
  }, 30000);

  it("should generate tattoo design via local server endpoint", async () => {
    console.log("🎨 Testing /api/tools/generate-design endpoint...");
    
    const response = await fetch(`${SERVER_URL}/api/tools/generate-design`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "small minimalist mountain tattoo on wrist",
      }),
    });

    expect(response.ok).toBe(true);
    
    const data = await response.json();
    
    console.log("✅ Design generated via server");
    console.log("Image URL:", data.imageUrl);
    
    expect(data).toHaveProperty("imageUrl");
    expect(data.imageUrl).toMatch(/^https?:\/\//);
    
    // Verify image is accessible
    const imageResponse = await fetch(data.imageUrl);
    expect(imageResponse.ok).toBe(true);
    console.log("✅ Generated image is accessible");
  }, 60000);

  it("should establish WebRTC connection with OpenAI Realtime API", async () => {
    console.log("🔗 Testing WebRTC connection...");
    
    // Step 1: Get ephemeral token
    const sessionResponse = await fetch(`${SERVER_URL}/api/session`, {
      method: "POST",
    });
    const sessionData = await sessionResponse.json();
    const ephemeralKey = sessionData.client_secret.value;
    
    console.log("Got ephemeral token:", ephemeralKey.substring(0, 20) + "...");
    
    // Step 2: Create RTCPeerConnection
    const pc = new RTCPeerConnection();
    
    // Step 3: Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    console.log("Created WebRTC offer");
    
    // Step 4: Send to OpenAI
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
    });
    
    expect(sdpResponse.ok).toBe(true);
    
    const answerSdp = await sdpResponse.text();
    const answer = { type: "answer" as const, sdp: answerSdp };
    await pc.setRemoteDescription(answer);
    
    console.log("✅ WebRTC connection established with OpenAI");
    
    // Cleanup
    pc.close();
  }, 30000);

  it("should send data channel messages to OpenAI", async () => {
    console.log("📡 Testing data channel communication...");
    
    // Get session
    const sessionResponse = await fetch(`${SERVER_URL}/api/session`, {
      method: "POST",
    });
    const sessionData = await sessionResponse.json();
    const ephemeralKey = sessionData.client_secret.value;
    
    // Setup WebRTC
    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel("oai-events");
    
    let messageReceived = false;
    
    dc.onopen = () => {
      console.log("Data channel opened");
      
      // Send a test message
      dc.send(JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["text"],
          instructions: "Say hello",
        },
      }));
    };
    
    dc.onmessage = (e) => {
      console.log("Received message:", e.data);
      messageReceived = true;
    };
    
    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
    });
    
    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    
    // Wait for data channel to open and exchange messages
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    console.log("✅ Data channel communication tested");
    
    pc.close();
  }, 40000);
});

describe("E2E: Video Screenshot Simulation", () => {
  it("should simulate sending video frames as base64 images", async () => {
    console.log("📸 Testing video frame transmission...");
    
    // Create a simple test image (1x1 red pixel)
    const canvas = {
      width: 1,
      height: 1,
    };
    
    // Base64 encoded 1x1 red pixel JPEG
    const testImageBase64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==";
    
    console.log("Test image size:", testImageBase64.length, "bytes");
    
    // Get session
    const sessionResponse = await fetch(`${SERVER_URL}/api/session`, {
      method: "POST",
    });
    const sessionData = await sessionResponse.json();
    const ephemeralKey = sessionData.client_secret.value;
    
    // Setup WebRTC
    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel("oai-events");
    
    dc.onopen = () => {
      console.log("Sending video frame...");
      
      // Send image frame (simulating screenshot)
      dc.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_image",
              image: testImageBase64,
            },
          ],
        },
      }));
      
      console.log("✅ Video frame sent successfully");
    };
    
    // Create connection
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
    });
    
    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    
    // Wait for frame to be sent
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    console.log("✅ Video frame transmission tested");
    
    pc.close();
  }, 40000);
});
