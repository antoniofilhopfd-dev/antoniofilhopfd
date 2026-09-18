import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("GET /health", () => {
  it("retorna status ok com api e banco no ar", async () => {
    const app = createApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.api).toBe("up");
    expect(response.body.database).toBe("up");
  });
});
