import "dotenv/config";
import { createApp } from "./app";
import { startMetaScheduler } from "./meta/scheduler";

const port = Number(process.env.PORT ?? 3333);
const app = createApp();

app.listen(port, () => {
  console.log(`Evolução Tráfego backend rodando na porta ${port}`);

  const scheduler = startMetaScheduler();
  if (scheduler.started) {
    console.log(`Agendamento Meta ativo: a cada ${scheduler.intervalMinutes} minuto(s) (só enquanto este processo estiver rodando).`);
  }
});
