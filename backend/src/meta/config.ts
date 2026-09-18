// Configuração da integração Meta — exclusivamente por variável de
// ambiente (Seção 11 da especificação). Nunca exposta/editável pela
// interface.

// Versão fixa e documentada (Seção 11: "fixar uma versão suportada").
// Consultar https://developers.facebook.com/docs/graph-api/changelog
// antes de atualizar.
export const META_API_VERSION = "v21.0";
export const META_GRAPH_HOST = "graph.facebook.com";

export function getMetaConfig() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  const configured = Boolean(accessToken && adAccountId);

  return { accessToken, adAccountId, configured };
}
