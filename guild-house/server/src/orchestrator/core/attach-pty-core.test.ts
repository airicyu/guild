import { describe, expect, test } from "bun:test";
import { pokeAttachLooksReady, POKE_SUBMIT_CHAR, writeTerminalPokeSubmit } from "./attach-pty-core";

describe("pokeAttachLooksReady", () => {
  test("accepts explicit attach banners", () => {
    expect(pokeAttachLooksReady("Connected to session abc", 0)).toBe(true);
    expect(pokeAttachLooksReady("Attached — esc to detach", 0)).toBe(true);
  });

  test("rejects bare bash prompt early", () => {
    expect(pokeAttachLooksReady("❯ ", 500)).toBe(false);
  });

  test("allows fallback after long wait", () => {
    expect(pokeAttachLooksReady("", 3000)).toBe(true);
  });
});

describe("writeTerminalPokeSubmit", () => {
  test("writes message then Enter separately", async () => {
    const writes: string[] = [];
    await writeTerminalPokeSubmit(
      {
        write(data: string) {
          writes.push(data);
        },
      },
      "hello poke",
    );
    expect(writes).toEqual(["hello poke", POKE_SUBMIT_CHAR]);
  });
});
