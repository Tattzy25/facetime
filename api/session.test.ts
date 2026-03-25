import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "./session";

describe("POST /api/session", () => {
  let mockReq: any;
  let mockRes: any;
  let originalEnv: NodeJS.ProcessEnv;
  let fetchMock: any;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Mock request object
    mockReq = {
      method: "POST",
      body: {},
    };

    // Mock response object with chainable methods
    mockRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: "",
      setHeader: vi.fn(function (this: any, key: string, value: string) {
        this.headers[key] = value;
        return this;
      }),
      end: vi.fn(function (this: any, data: string) {
        this.body = data;
        return this;
      }),
    };

    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // Test 1: Should return 405 Method Not Allowed when request method is not POST
  it("should return 405 Method Not Allowed when request method is not POST", async () => {
    mockReq.method = "GET";

    await handler(mockReq, mockRes);

    expect(mockRes.statusCode).toBe(405);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/json"
    );
    expect(mockRes.body).toBe(JSON.stringify({ error: "Method Not Allowed" }));
  });

  // Test 2: Should return 500 error when OPENAI_API_KEY environment variable is missing
  it("should return 500 error when OPENAI_API_KEY environment variable is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await handler(mockReq, mockRes);

    expect(mockRes.statusCode).toBe(500);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/json"
    );
    expect(mockRes.body).toBe(
      JSON.stringify({ error: "Missing OPENAI_API_KEY env var" })
    );
  });

  // Test 3: Should successfully create a session and return 200 with valid data when API call succeeds
  it("should successfully create a session and return 200 with valid data when API call succeeds", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";

    const mockSessionData = {
      id: "sess_123",
      client_secret: {
        value: "ephemeral_token_abc",
        expires_at: 1234567890,
      },
      model: "gpt-4o-realtime-preview",
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSessionData,
    });

    await handler(mockReq, mockRes);

    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/json"
    );
    expect(mockRes.body).toBe(JSON.stringify(mockSessionData));
  });

  // Test 4: Should return the correct OpenAI API response structure with client_secret
  it("should return the correct OpenAI API response structure with client_secret", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";

    const mockSessionData = {
      id: "sess_456",
      client_secret: {
        value: "ephemeral_xyz",
        expires_at: 9876543210,
      },
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSessionData,
    });

    await handler(mockReq, mockRes);

    const responseBody = JSON.parse(mockRes.body);
    expect(responseBody).toHaveProperty("client_secret");
    expect(responseBody.client_secret).toHaveProperty("value");
    expect(responseBody.client_secret).toHaveProperty("expires_at");
  });

  // Test 5: Should handle OpenAI API errors and return appropriate status codes
  it("should handle OpenAI API errors and return appropriate status codes", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";

    const mockErrorData = {
      error: {
        message: "Invalid API key",
        type: "invalid_request_error",
      },
    };

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => mockErrorData,
    });

    await handler(mockReq, mockRes);

    expect(mockRes.statusCode).toBe(401);
    expect(mockRes.body).toBe(JSON.stringify(mockErrorData));
  });

  // Test 6: Should include proper authorization header with Bearer token in OpenAI request
  it("should include proper authorization header with Bearer token in OpenAI request", async () => {
    process.env.OPENAI_API_KEY = "test-secret-key";

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "sess_789" }),
    });

    await handler(mockReq, mockRes);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret-key",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  // Test 7: Should send correct model configuration (gpt-4o-realtime-preview) in request body
  it("should send correct model configuration (gpt-4o-realtime-preview) in request body", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "sess_model" }),
    });

    await handler(mockReq, mockRes);

    const callArgs = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);

    expect(requestBody.model).toBe("gpt-4o-realtime-preview");
    expect(requestBody.voice).toBe("alloy");
    expect(requestBody.modalities).toEqual(["text", "audio"]);
  });

  // Test 8: Should include tattoo consultant instructions in the session configuration
  it("should include tattoo consultant instructions in the session configuration", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "sess_instructions" }),
    });

    await handler(mockReq, mockRes);

    const callArgs = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);

    expect(requestBody.instructions).toContain("professional tattoo consultant");
    expect(requestBody.instructions).toContain("visual eyes");
    expect(requestBody.instructions).toContain("screenshots");
  });

  // Test 9: Should configure the generate_tattoo_design tool correctly in the request
  it("should configure the generate_tattoo_design tool correctly in the request", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "sess_tools" }),
    });

    await handler(mockReq, mockRes);

    const callArgs = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);

    expect(requestBody.tools).toHaveLength(1);
    expect(requestBody.tools[0].type).toBe("function");
    expect(requestBody.tools[0].name).toBe("generate_tattoo_design");
    expect(requestBody.tools[0].parameters.required).toContain("prompt");
    expect(requestBody.tool_choice).toBe("auto");
  });

  // Test 10: Should return 500 with generic error message when fetch throws an exception
  it("should return 500 with generic error message when fetch throws an exception", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    fetchMock.mockRejectedValueOnce(new Error("Network failure"));

    await handler(mockReq, mockRes);

    expect(mockRes.statusCode).toBe(500);
    expect(mockRes.body).toBe(
      JSON.stringify({ error: "Failed to create session" })
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error creating session:",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
