import { describe, it, expect } from "vitest";
import { activeLineIndex, cleanSearchTitle, instrumentalLyrics, parseLrc, toLyrics } from "./lyrics";

describe("parseLrc timestamps", () => {
  it("reads [mm:ss], [mm:ss.xx] and [mm:ss.xxx]", () => {
    const lines = parseLrc("[00:05]Linea uno\n[00:10.50]Linea dos\n[01:02.250]Linea tres");
    expect(lines).toEqual([
      { time: 5, text: "Linea uno" },
      { time: 10.5, text: "Linea dos" },
      { time: 62.25, text: "Linea tres" },
    ]);
  });

  it("repeats a line that has several timestamps and sorts by time", () => {
    const lines = parseLrc("[00:30.00][00:10.00]Coro inventado\n[00:20.00]Verso inventado");
    expect(lines).toEqual([
      { time: 10, text: "Coro inventado" },
      { time: 20, text: "Verso inventado" },
      { time: 30, text: "Coro inventado" },
    ]);
  });

  it("ignores metadata tags and trims text", () => {
    const lines = parseLrc("[ar:Grupo Ficticio]\n[ti:Tema de prueba]\n[length:03:00]\n[00:01.00]   Hola   mundo   ");
    expect(lines).toEqual([{ time: 1, text: "Hola mundo" }]);
  });

  it("applies a positive offset earlier and never below zero", () => {
    expect(parseLrc("[offset:+500]\n[00:00.20]Inicio\n[00:02.00]Despues")).toEqual([
      { time: 0, text: "Inicio" },
      { time: 1.5, text: "Despues" },
    ]);
  });

  it("applies a negative offset later", () => {
    expect(parseLrc("[offset:-1000]\n[00:02.00]Tarde")).toEqual([{ time: 3, text: "Tarde" }]);
  });

  it("keeps empty timed lines as spacers and drops untimed lines in synced text", () => {
    const lines = parseLrc("[00:01.00]Antes\n[00:03.00]\nsin tiempo\n[00:05.00]Despues");
    expect(lines).toEqual([
      { time: 1, text: "Antes" },
      { time: 3, text: "" },
      { time: 5, text: "Despues" },
    ]);
  });

  it("removes word timestamps of enhanced LRC", () => {
    expect(parseLrc("[00:01.00]<00:01.00>Uno <00:01.50>dos")).toEqual([{ time: 1, text: "Uno dos" }]);
  });

  it("accepts Windows line endings", () => {
    expect(parseLrc("[00:01]A\r\n[00:02]B\r\n")).toEqual([
      { time: 1, text: "A" },
      { time: 2, text: "B" },
    ]);
  });
});

describe("parseLrc plain text", () => {
  it("turns text without timestamps into unsynced lines with spacers", () => {
    expect(parseLrc("\n\nPrimera linea\n\nSegunda linea\n\n")).toEqual([
      { time: null, text: "Primera linea" },
      { time: null, text: "" },
      { time: null, text: "Segunda linea" },
    ]);
  });

  it("returns no lines for blank text", () => {
    expect(parseLrc("  \n \n")).toEqual([]);
    expect(parseLrc("")).toEqual([]);
  });
});

describe("toLyrics", () => {
  it("marks timed lines as synced", () => {
    expect(toLyrics(parseLrc("[00:01]Hola"), "file")).toEqual({
      synced: true,
      instrumental: false,
      lines: [{ time: 1, text: "Hola" }],
      source: "file",
    });
  });

  it("marks plain lines as unsynced", () => {
    expect(toLyrics(parseLrc("Hola"), "embedded")?.synced).toBe(false);
  });

  it("returns null when every line is empty", () => {
    expect(toLyrics([], "file")).toBeNull();
    expect(toLyrics(parseLrc("[00:01]\n[00:02]"), "file")).toBeNull();
  });

  it("builds instrumental lyrics without lines", () => {
    expect(instrumentalLyrics("lrclib")).toEqual({ synced: false, instrumental: true, lines: [], source: "lrclib" });
  });
});

describe("activeLineIndex", () => {
  const lines = parseLrc("[00:02]A\n[00:05]B\n[00:05]C\n[00:09]D");

  it("is -1 before the first line", () => {
    expect(activeLineIndex(lines, 0)).toBe(-1);
    expect(activeLineIndex(lines, 1.99)).toBe(-1);
  });

  it("chooses the last line whose time is not after the position", () => {
    expect(activeLineIndex(lines, 2)).toBe(0);
    expect(activeLineIndex(lines, 4.9)).toBe(0);
    expect(activeLineIndex(lines, 5)).toBe(2);
    expect(activeLineIndex(lines, 100)).toBe(3);
  });

  it("is -1 for unsynced or empty lines", () => {
    expect(activeLineIndex(parseLrc("Sin tiempo"), 10)).toBe(-1);
    expect(activeLineIndex([], 10)).toBe(-1);
  });
});

describe("cleanSearchTitle", () => {
  it.each([
    ["Cancion Ficticia (Official Video)", "Cancion Ficticia"],
    ["Cancion Ficticia [Official Music Video]", "Cancion Ficticia"],
    ["Cancion Ficticia - Official Video", "Cancion Ficticia"],
    ["Cancion Ficticia Official Video", "Cancion Ficticia"],
    ["Cancion Ficticia (Lyric Video)", "Cancion Ficticia"],
    ["Cancion Ficticia (Lyrics)", "Cancion Ficticia"],
    ["Cancion Ficticia [Audio]", "Cancion Ficticia"],
    ["Cancion Ficticia (HD)", "Cancion Ficticia"],
    ["Cancion Ficticia 4K", "Cancion Ficticia"],
    ["Cancion Ficticia - Remastered 2011", "Cancion Ficticia"],
    ["Cancion Ficticia (2009 Remaster)", "Cancion Ficticia"],
    ["Cancion Ficticia (Official Video) [HD]", "Cancion Ficticia"],
    ["Cancion   Ficticia", "Cancion Ficticia"],
  ])("cleans %j", (title, expected) => {
    expect(cleanSearchTitle(title, "Grupo")).toEqual({ artist: "Grupo", title: expected });
  });

  it("keeps the title when cleaning would leave nothing", () => {
    expect(cleanSearchTitle("Audio", "Grupo").title).toBe("Audio");
  });

  it("keeps parentheses that are not noise", () => {
    expect(cleanSearchTitle("Tema (en vivo)", "Grupo").title).toBe("Tema (en vivo)");
  });

  it("removes a leading artist that matches ignoring case and accents", () => {
    expect(cleanSearchTitle("GRUPO ÁNGEL - Tema Inventado (Official Video)", "Grupo Angel")).toEqual({
      artist: "Grupo Angel",
      title: "Tema Inventado",
    });
  });

  it("keeps a leading part that is not the artist", () => {
    expect(cleanSearchTitle("Otro - Tema", "Grupo")).toEqual({ artist: "Grupo", title: "Otro - Tema" });
  });

  it("splits artist and title when the artist is empty", () => {
    expect(cleanSearchTitle("Grupo Ficticio - Tema Inventado [Official Video]", "")).toEqual({
      artist: "Grupo Ficticio",
      title: "Tema Inventado",
    });
  });

  it("does not split a noise suffix as if it were the title", () => {
    expect(cleanSearchTitle("Tema Inventado - Official Video", "")).toEqual({ artist: "", title: "Tema Inventado" });
  });

  it("leaves a title without separator and an empty artist unchanged", () => {
    expect(cleanSearchTitle("Tema", "  ")).toEqual({ artist: "", title: "Tema" });
  });
});
