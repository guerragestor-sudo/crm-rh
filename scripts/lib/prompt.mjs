// Leitura de senha sem eco do texto: lê tecla por tecla em modo raw e mostra
// apenas um "*" por caractere. Ignora sequências de escape do terminal (setas,
// marcadores de "colar" \e[200~ … \e[201~). Ctrl+C cancela.
export function askHidden(question) {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return Promise.reject(new Error("Execute este comando em um terminal interativo."));
  }
  return new Promise((resolve) => {
    let value = "";
    let escape = false;
    // Desliga o eco ANTES de exibir a pergunta: nada digitado chega a aparecer.
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    process.stdout.write(question);

    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolve(value);
    };

    function onData(chunk) {
      for (const char of chunk) {
        if (escape) {
          // Fim de uma sequência CSI: letra ou "~".
          if (/[A-Za-z~]/.test(char)) escape = false;
          continue;
        }
        if (char === "\u001b") {
          escape = true;
          continue;
        }
        if (char === "\r" || char === "\n" || char === "\u0004") return finish();
        if (char === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\nCancelado.\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (char >= " ") {
          value += char;
          process.stdout.write("*");
        }
      }
    }

    stdin.on("data", onData);
  });
}

export function validatePassword(password) {
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "Senha fraca: use ao menos 8 caracteres com letras e números.";
  }
  return null;
}
