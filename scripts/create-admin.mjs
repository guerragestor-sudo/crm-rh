// Cria a organização e o primeiro administrador (uso único por ambiente).
//
//   npm run create-admin -- --email voce@empresa.com --name "Seu Nome" --org "Minha Operação"
//
// A senha é digitada no terminal (não aparece na tela e não fica no histórico).
// Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no arquivo de ambiente.
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";
import { askHidden, validatePassword } from "./lib/prompt.mjs";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    org: { type: "string" },
  },
});

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

if (!values.email || !values.name || !values.org) {
  fail('Uso: npm run create-admin -- --email <e-mail> --name "<nome>" --org "<organização>"');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) fail("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const password = await askHidden("Senha do administrador (mín. 8, letras e números): ");
const weak = validatePassword(password);
if (weak) fail(weak);
const confirmation = await askHidden("Confirme a senha: ");
if (confirmation !== password) fail("As senhas não conferem.");

const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: created, error: userError } = await supabase.auth.admin.createUser({
  email: values.email.trim().toLowerCase(),
  password,
  email_confirm: true,
  user_metadata: { full_name: values.name.trim() },
});
if (userError) fail(`Não foi possível criar o usuário: ${userError.message}`);

const { data: organization, error: orgError } = await supabase
  .from("organizations")
  .insert({ name: values.org.trim(), slug: slugify(values.org) })
  .select("id")
  .single();
if (orgError) fail(`Não foi possível criar a organização: ${orgError.message}`);

const { error: memberError } = await supabase
  .from("organization_members")
  .insert({ organization_id: organization.id, user_id: created.user.id, role: "admin" });
if (memberError) fail(`Não foi possível vincular o administrador: ${memberError.message}`);

console.log(`\n✔ Organização "${values.org}" e administrador ${values.email} criados.`);
