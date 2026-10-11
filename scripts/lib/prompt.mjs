// Leitura de senha sem eco: lê tecla por tecla em modo raw e não escreve nada
// do que é digitado (nem asteriscos). Ctrl+C cancela.
export function askHidden(question) {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return Promise.reject(new Error("Execute este comando em um terminal interativo."));
  }
  return new Promise((resolve) => {
    let value = "";
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
        if (char === "\r" || char === "\n" || char === "\u0004") return finish();
        if (char === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\nCancelado.\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
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
