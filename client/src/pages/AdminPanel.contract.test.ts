import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AdminPanel.tsx", import.meta.url), "utf8");

describe("AdminPanel UI contract", () => {
  it("contains protected group administration flows", () => {
    expect(source).toContain("trpc.botAdmin.listGroups.useQuery");
    expect(source).toContain("trpc.botAdmin.updateGroup.useMutation");
    expect(source).toContain("Salvar tudo");
    expect(source).toContain("Regras do grupo");
    expect(source).toContain("Auto-respostas");
    expect(source).toContain("Pausar");
    expect(source).toContain("Ativar");
    expect(source).toContain("Controles de moderação");
    expect(source).toContain("Anti-flood");
    expect(source).toContain("Bloquear links");
    expect(source).toContain("Slowmode (seg.)");
    expect(source).toContain("Fotos dos menus");
    expect(source).toContain("ggzn-menu-principal-v2");
  });
});
