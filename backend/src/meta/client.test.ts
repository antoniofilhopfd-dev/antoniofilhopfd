import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectAllPages, createMetaClient, MetaApiError } from "./client";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.META_ACCESS_TOKEN = "fake-token";
  process.env.META_AD_ACCOUNT_ID = "123";
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
  vi.restoreAllMocks();
});

describe("createMetaClient", () => {
  it("não segue URL de paginação que não seja do domínio graph.facebook.com", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ id: "1" }],
          paging: { next: "https://evil.example.com/steal-data" },
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const client = createMetaClient();
    const page = await client.get<{ id: string }>("act_123/campaigns");

    expect(page.data).toHaveLength(1);
    expect(page.nextUrl).toBeNull();
  });

  it("segue paginação legítima do próprio domínio do Meta", async () => {
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            data: [{ id: "1" }],
            paging: { next: "https://graph.facebook.com/v21.0/act_123/campaigns?after=abc" },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ data: [{ id: "2" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = createMetaClient();
    const items = await collectAllPages<{ id: string }>(client, "act_123/campaigns");

    expect(items.map((i) => i.id)).toEqual(["1", "2"]);
    expect(calls).toBe(2);
  });

  it("mapeia erro de token inválido (código 190) para MetaApiError com kind invalid_token", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: 190, message: "Token inválido." } }), { status: 400 })
    ) as unknown as typeof fetch;

    const client = createMetaClient();
    await expect(client.get("act_123/campaigns")).rejects.toMatchObject(
      new MetaApiError("invalid_token", "Token inválido.")
    );
  });

  it("lança not_configured quando token/conta ausentes, sem tentar a requisição", async () => {
    delete process.env.META_ACCESS_TOKEN;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const client = createMetaClient();
    await expect(client.get("act_123/campaigns")).rejects.toMatchObject({ kind: "not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
