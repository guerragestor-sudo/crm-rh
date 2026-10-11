// Troca o e-mail de login de um usuário existente (mantém senha, organização e papel).
//
//   npm run change-email:prod -- --from atual@exemplo.com --to novo@exemplo.com
//
// Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no arquivo de ambiente.
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

const { values } = parseArgs({ options: { from: { type: "string" }, to: { type: "string" } } });
const from = values.from?.trim().toLowerCase();
const to = values.to?.trim().toLowerCase();
if (!from || !to) fail("Uso: npm run change-email:prod -- --from <e-mail atual> --to <e-mail novo>");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) fail(`E-mail novo inválido: ${to}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) fail("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");

const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Não foi possível listar usuários: ${error.message}`);
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user || data.users.length < 200) return user ?? null;
  }
}

const user = await findUser(from);
if (!user) fail(`Usuário ${from} não encontrado.`);
if (await findUser(to)) fail(`Já existe um usuário com o e-mail ${to}.`);

// email_confirm: o novo e-mail já nasce confirmado (sem depender de envio de e-mail).
const { error: authError } = await supabase.auth.admin.updateUserById(user.id, { email: to, email_confirm: true });
if (authError) fail(`Não foi possível trocar o e-mail no Auth: ${authError.message}`);

const { error: profileError } = await supabase.from("profiles").update({ email: to }).eq("id", user.id);
if (profileError) fail(`E-mail trocado no Auth, mas o perfil não foi atualizado: ${profileError.message}`);

console.log(`\n✔ E-mail alterado: ${from} → ${to} (senha, organização e papel mantidos).`);
