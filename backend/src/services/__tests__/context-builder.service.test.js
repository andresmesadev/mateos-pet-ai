const {
  buildConversationHistory,
  MAX_HISTORY_CHARS,
  MAX_HISTORY_MESSAGES,
} = require("../context-builder.service");

describe("buildConversationHistory", () => {
  test("retorna [] si messages no es un array", () => {
    expect(buildConversationHistory(null)).toEqual([]);
    expect(buildConversationHistory(undefined)).toEqual([]);
    expect(buildConversationHistory("no-array")).toEqual([]);
  });

  test("retorna [] si messages está vacío", () => {
    expect(buildConversationHistory([])).toEqual([]);
  });

  test("preserva el orden oldest → newest", () => {
    const messages = [
      { role: "user", content: "primero" },
      { role: "assistant", content: "segundo" },
      { role: "user", content: "tercero" },
    ];
    expect(buildConversationHistory(messages)).toEqual([
      { role: "user", content: "primero" },
      { role: "assistant", content: "segundo" },
      { role: "user", content: "tercero" },
    ]);
  });

  test("normaliza cualquier role distinto de 'assistant' a 'user'", () => {
    const messages = [
      { role: "system", content: "hola" },
      { role: "assistant", content: "respuesta" },
    ];
    const result = buildConversationHistory(messages);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });

  test("descarta mensajes con content vacío o no-string", () => {
    const messages = [
      { role: "user", content: "  " },
      { role: "user", content: null },
      { role: "user", content: 123 },
      { role: "user", content: "válido" },
    ];
    expect(buildConversationHistory(messages)).toEqual([{ role: "user", content: "válido" }]);
  });

  test("recorta el contenido con espacios al inicio/fin", () => {
    const result = buildConversationHistory([{ role: "user", content: "  hola  " }]);
    expect(result).toEqual([{ role: "user", content: "hola" }]);
  });

  test("respeta maxMessages, quedándose con los más recientes", () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      role: "user",
      content: `msg-${i}`,
    }));
    const result = buildConversationHistory(messages, { maxMessages: 2 });
    expect(result).toEqual([{ role: "user", content: "msg-3" }, { role: "user", content: "msg-4" }]);
  });

  test("respeta maxChars, deteniéndose antes de exceder el presupuesto", () => {
    const messages = [
      { role: "user", content: "a".repeat(10) },
      { role: "user", content: "b".repeat(10) },
      { role: "user", content: "c".repeat(10) },
    ];
    const result = buildConversationHistory(messages, { maxChars: 15 });
    expect(result).toEqual([{ role: "user", content: "c".repeat(10) }]);
  });

  test("usa los límites por defecto exportados cuando no se pasan opciones", () => {
    const longMessages = Array.from({ length: MAX_HISTORY_MESSAGES + 5 }, (_, i) => ({
      role: "user",
      content: `m${i}`,
    }));
    const result = buildConversationHistory(longMessages);
    expect(result.length).toBe(MAX_HISTORY_MESSAGES);
    expect(MAX_HISTORY_CHARS).toBeGreaterThan(0);
  });

  test("ignora un límite no finito y cae al default", () => {
    const messages = [{ role: "user", content: "hola" }];
    const result = buildConversationHistory(messages, { maxChars: NaN, maxMessages: Infinity });
    expect(result).toEqual([{ role: "user", content: "hola" }]);
  });
});
