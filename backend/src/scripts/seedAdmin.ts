import "dotenv/config";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { UserRole } from "@prisma/client";
import { prisma } from "../prisma";
import { hashPassword } from "../auth/password";

// Cria o primeiro usuário Administrador de forma interativa.
// Não há credenciais padrão fixas no código: nome, e-mail e senha
// são informados neste momento pelo operador (Seção 5 da especificação).
async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  const existingAdmin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
  if (existingAdmin) {
    console.log(`Já existe um administrador (${existingAdmin.email}). Nada a fazer.`);
    rl.close();
    return;
  }

  const name = await rl.question("Nome do administrador: ");
  const email = await rl.question("E-mail do administrador: ");
  const password = await rl.question("Senha (mín. 8 caracteres): ");

  rl.close();

  if (!name || !email || password.length < 8) {
    console.error("Dados insuficientes. Abortando.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log(`Administrador criado: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
