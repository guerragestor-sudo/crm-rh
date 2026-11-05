"use client";

import { NativeSelect } from "@/components/shared/native-select";

import { FIELD_LABEL } from "../fields";
import type { RefOptions, UnknownValue, ValueChoice } from "../resolve";
import { clean } from "../sheet-rules.mjs";

function encode(choice: ValueChoice): string {
  return choice.kind === "existing" ? `id:${choice.id}` : choice.kind;
}

/**
 * De/para dos nomes que não existem no CRM: ligar a um cadastro existente
 * (ex.: "Lendro" → Leandro), criar o cadastro novo ou deixar em branco.
 * Vale para todas as linhas com o mesmo nome.
 */
export function ValueMapping({
  unknown,
  choices,
  options,
  canCreate,
  defaultStatusName,
  onChange,
}: {
  unknown: UnknownValue[];
  choices: Record<string, ValueChoice>;
  options: RefOptions;
  canCreate: boolean;
  defaultStatusName: string;
  onChange: (key: string, choice: ValueChoice) => void;
}) {
  if (unknown.length === 0) return null;

  return (
    <section aria-labelledby="unknown-values-title" className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <h2 id="unknown-values-title" className="text-sm font-medium">
          Nomes que não existem no CRM ({unknown.length})
        </h2>
        <p className="text-sm text-muted-foreground">
          Confira o que fazer com cada um. Vale para todas as linhas com esse nome; o texto original fica anotado na observação.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {unknown.map((item) => {
          const choice = choices[item.key] ?? item.suggestion;
          const createName = item.suggestion.kind === "create" ? item.suggestion.name : clean(item.raw);
          const id = `unknown-${item.key}`;
          const active = options[item.field].filter(
            (option) => option.is_active || (choice.kind === "existing" && choice.id === option.id),
          );
          return (
            <li key={item.key} className="space-y-1.5">
              <label htmlFor={id} className="block text-sm">
                <span className="text-muted-foreground">{FIELD_LABEL[item.field]} </span>
                <span className="font-medium">“{item.raw}”</span>
                <span className="text-muted-foreground"> · {item.count === 1 ? "1 linha" : `${item.count} linhas`}</span>
              </label>
              <NativeSelect
                id={id}
                value={encode(choice)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value.startsWith("id:")) onChange(item.key, { kind: "existing", id: value.slice(3) });
                  else if (value === "create") onChange(item.key, { kind: "create", name: createName });
                  else onChange(item.key, { kind: value as "blank" | "default" });
                }}
              >
                {item.field === "status" ? (
                  <option value="default">Usar o status padrão ({defaultStatusName})</option>
                ) : (
                  <>
                    {canCreate ? <option value="create">Criar “{createName}”</option> : null}
                    <option value="blank">Deixar em branco</option>
                  </>
                )}
                <optgroup label={`Ligar a ${item.field === "status" ? "um status" : "um cadastro"} existente`}>
                  {active.map((option) => (
                    <option key={option.id} value={`id:${option.id}`}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              </NativeSelect>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
