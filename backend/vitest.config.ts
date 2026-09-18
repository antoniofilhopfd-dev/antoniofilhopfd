import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Os testes compartilham um único banco PostgreSQL de desenvolvimento
    // e cada beforeEach limpa tabelas; arquivos precisam rodar em série
    // para não interferirem uns nos outros.
    fileParallelism: false,
    testTimeout: 10000,
  },
});
