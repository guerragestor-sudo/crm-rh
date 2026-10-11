// Define uma nova senha para um usuário existente (não há tela de "esqueci a senha" no MVP).
//
//   npm run set-password:prod -- --email usuario@exemplo.com
//
// A senha é digitada no terminal e não aparece na tela.
// Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no arquivo de ambiente.
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

import { askHidden, validatePassword } from "./lib/prompt.mjs";

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

const { values } = parseArgs({ options: { email: { type: "string" } } });
if (!values.email) fail("Uso: npm run set-password:prod -- --email <e-mail>");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) fail("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");

const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const email = values.email.trim().toLowerCase();

let user = null;
for (let page = 1; !user; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) fail(`Não foi possível listar usuários: ${error.message}`);
  user = data.users.find((item) => item.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 200) break;
}
if (!user) fail(`Usuário ${email} não encontrado.`);

const password = await askHidden("Nova senha (mín. 8, letras e números): ");
const weak = validatePassword(password);
if (weak) fail(weak);
const confirmation = await askHidden("Confirme a nova senha: ");
if (confirmation !== password) fail("As senhas não conferem.");

const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
if (error) fail(`Não foi possível alterar a senha: ${error.message}`);
console.log(`\n✔ Senha de ${email} alterada.`);
