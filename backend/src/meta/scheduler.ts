import type { MetaClient } from "./client";
import { getMetaConfig } from "./config";
import { syncHierarchy, syncInsights } from "./syncService";

// Agendamento em processo: roda a sincronização periodicamente enquanto
// ESTE servidor Node estiver de pé (Seção 11/19). Isso não equivale a
// hospedagem permanente — se o processo parar (deploy, reinício,
// encerramento da sessão), o agendamento para junto. VPS/hospedagem
// contínua foi adiada pelo usuário (Seção 4) e fica fora desta etapa.

const RECENT_DAYS_BACK = 7;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function isSchedulerRunning(): boolean {
  return intervalHandle !== null;
}

export function startMetaScheduler(client?: MetaClient): { started: boolean; intervalMinutes?: number } {
  if (intervalHandle) {
    return { started: false };
  }

  const { configured } = getMetaConfig();
  const intervalMinutesRaw = process.env.META_SYNC_INTERVAL_MINUTES;

  if (!configured || !intervalMinutesRaw) {
    return { started: false };
  }

  const intervalMinutes = Number(intervalMinutesRaw);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return { started: false };
  }

  intervalHandle = setInterval(async () => {
    try {
      await syncHierarchy(undefined, client);
      await syncInsights(undefined, RECENT_DAYS_BACK, client);
    } catch {
      // Erros já ficam registrados em SyncLog/MetaConnection pelos
      // próprios syncHierarchy/syncInsights; o agendador apenas segue
      // para a próxima execução, sem derrubar o processo.
    }
  }, intervalMinutes * 60 * 1000);

  return { started: true, intervalMinutes };
}

export function stopMetaScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
