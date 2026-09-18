import { META_API_VERSION, META_GRAPH_HOST, getMetaConfig } from "./config";

export type MetaErrorKind =
  | "invalid_token"
  | "permission"
  | "rate_limit"
  | "not_configured"
  | "unknown"
  // Resposta indeterminada (ex.: falha de rede durante uma criação) — não
  // se sabe se a Meta processou o pedido. Nunca reenviar automaticamente
  // nesse caso (Seção 12).
  | "ambiguous";

export class MetaApiError extends Error {
  kind: MetaErrorKind;

  constructor(kind: MetaErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "MetaApiError";
  }
}

export type GraphPage<T> = {
  data: T[];
  nextUrl: string | null;
};

// Interface para permitir injeção de um cliente falso nos testes, sem
// depender de rede real nem de credenciais.
export interface MetaClient {
  get<T>(path: string, params?: Record<string, string>): Promise<GraphPage<T>>;
  getPage<T>(url: string): Promise<GraphPage<T>>;
  // Criação (POST). Diferente de get/getPage: NUNCA tenta de novo sozinho
  // (nem em 429) — uma falha de rede aqui vira MetaApiError("ambiguous",…)
  // porque não há como saber se o objeto foi criado do lado da Meta.
  post<T>(path: string, body: Record<string, unknown>): Promise<T>;
}

function mapErrorResponse(body: unknown): MetaApiError {
  const error = (body as { error?: { code?: number; type?: string; message?: string } })?.error;
  const message = error?.message ?? "Erro desconhecido na API do Meta.";

  if (error?.code === 190) return new MetaApiError("invalid_token", message);
  if (error?.code === 10 || error?.type === "OAuthException") return new MetaApiError("permission", message);
  if (error?.code === 4 || error?.code === 17 || error?.code === 32) {
    return new MetaApiError("rate_limit", message);
  }

  return new MetaApiError("unknown", message);
}

async function requestWithRetry(url: string, attemptsLeft = 2): Promise<Response> {
  const response = await fetch(url);

  if (response.status === 429 && attemptsLeft > 0) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return requestWithRetry(url, attemptsLeft - 1);
  }

  return response;
}

function parsePage<T>(body: { data: T[]; paging?: { next?: string } }): GraphPage<T> {
  const nextUrl = body.paging?.next ?? null;

  // Nunca seguir URLs externas arbitrárias retornadas em paginação
  // (Seção 11) — só aceitamos continuar se o host for o próprio Meta.
  if (nextUrl) {
    try {
      const parsed = new URL(nextUrl);
      if (parsed.hostname !== META_GRAPH_HOST) {
        return { data: body.data, nextUrl: null };
      }
    } catch {
      return { data: body.data, nextUrl: null };
    }
  }

  return { data: body.data, nextUrl };
}

export function createMetaClient(): MetaClient {
  const { accessToken, configured } = getMetaConfig();

  async function fetchAndParse<T>(url: string): Promise<GraphPage<T>> {
    if (!configured) {
      throw new MetaApiError("not_configured", "Integração Meta não configurada (token/conta ausentes).");
    }

    const response = await requestWithRetry(url);
    const body = (await response.json()) as { data: T[]; paging?: { next?: string } };

    if (!response.ok) {
      throw mapErrorResponse(body);
    }

    return parsePage<T>(body);
  }

  return {
    async get<T>(path: string, params: Record<string, string> = {}) {
      const url = new URL(`https://${META_GRAPH_HOST}/${META_API_VERSION}/${path}`);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
      url.searchParams.set("access_token", accessToken ?? "");
      return fetchAndParse<T>(url.toString());
    },
    async getPage<T>(url: string) {
      return fetchAndParse<T>(url);
    },
    async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
      if (!configured) {
        throw new MetaApiError("not_configured", "Integração Meta não configurada (token/conta ausentes).");
      }

      const url = new URL(`https://${META_GRAPH_HOST}/${META_API_VERSION}/${path}`);
      url.searchParams.set("access_token", accessToken ?? "");

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // Falha de rede: não sabemos se a Meta recebeu/processou o
        // pedido de criação. Tratar como ambíguo, nunca como "falhou
        // com certeza" (que permitiria reenviar).
        throw new MetaApiError("ambiguous", "Falha de rede ao criar objeto na Meta; resultado indeterminado.");
      }

      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch {
        throw new MetaApiError(
          "ambiguous",
          "Resposta da Meta não pôde ser interpretada; resultado indeterminado."
        );
      }

      if (!response.ok) {
        const hasErrorShape =
          typeof parsed === "object" && parsed !== null && "error" in (parsed as Record<string, unknown>);
        if (hasErrorShape) {
          throw mapErrorResponse(parsed);
        }
        throw new MetaApiError("ambiguous", "Resposta de erro da Meta em formato inesperado.");
      }

      return parsed as T;
    },
  };
}

export async function collectAllPages<T>(client: MetaClient, path: string, params?: Record<string, string>): Promise<T[]> {
  const items: T[] = [];
  let page = await client.get<T>(path, params);
  items.push(...page.data);

  while (page.nextUrl) {
    page = await client.getPage<T>(page.nextUrl);
    items.push(...page.data);
  }

  return items;
}
