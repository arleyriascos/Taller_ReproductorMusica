import { describe, it, expect } from "vitest";
import { dispatchShortcut, SHORTCUT_HELP, type KeyInput, type ShortcutActions } from "./KeyboardShortcuts";

interface Call {
  name: string;
  args: unknown[];
}

function recorder(): { actions: ShortcutActions; calls: Call[] } {
  const calls: Call[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push({ name, args });
    };
  const actions: ShortcutActions = {
    togglePlay: record("togglePlay"),
    next: record("next"),
    previous: record("previous"),
    seekBy: record("seekBy"),
    changeVolume: record("changeVolume"),
    toggleMute: record("toggleMute"),
    toggleShuffle: record("toggleShuffle"),
    cycleRepeat: record("cycleRepeat"),
    toggleNowPlaying: record("toggleNowPlaying"),
    toggleRightColumn: record("toggleRightColumn"),
    focusSearch: record("focusSearch"),
    showHelp: record("showHelp"),
  };
  return { actions, calls };
}

function names(calls: readonly Call[]): string[] {
  return calls.map((call) => call.name);
}

function press(key: string, overrides: Partial<KeyInput> = {}): KeyInput {
  return { key, shiftKey: false, repeat: false, hasModifier: false, isDialogOpen: false, focus: "other", ...overrides };
}

describe("dispatchShortcut mapping", () => {
  it("maps every documented key to its action", () => {
    const cases: [KeyInput, string, unknown[]][] = [
      [press(" "), "togglePlay", []],
      [press("ArrowRight", { shiftKey: true }), "next", []],
      [press("ArrowLeft", { shiftKey: true }), "previous", []],
      [press("ArrowRight"), "seekBy", [5]],
      [press("ArrowLeft"), "seekBy", [-5]],
      [press("ArrowUp"), "changeVolume", [0.1]],
      [press("ArrowDown"), "changeVolume", [-0.1]],
      [press("m"), "toggleMute", []],
      [press("s"), "toggleShuffle", []],
      [press("r"), "cycleRepeat", []],
      [press("l"), "toggleNowPlaying", []],
      [press("e"), "toggleRightColumn", []],
      [press("/"), "focusSearch", []],
      [press("?", { shiftKey: true }), "showHelp", []],
    ];
    for (const [input, name, args] of cases) {
      const { actions, calls } = recorder();
      expect(dispatchShortcut(input, actions)).toBe(true);
      expect(calls).toEqual([{ name, args }]);
    }
  });

  it("accepts uppercase letters such as with caps lock", () => {
    const { actions, calls } = recorder();
    expect(dispatchShortcut(press("M"), actions)).toBe(true);
    expect(dispatchShortcut(press("S", { shiftKey: true }), actions)).toBe(true);
    expect(names(calls)).toEqual(["toggleMute", "toggleShuffle"]);
  });

  it("does nothing for unknown keys", () => {
    const { actions, calls } = recorder();
    for (const key of ["a", "Enter", "Escape", "Tab", "1", "F5"]) {
      expect(dispatchShortcut(press(key), actions)).toBe(false);
    }
    expect(calls).toEqual([]);
  });

  it("does not mix plain and shifted arrows", () => {
    const { actions, calls } = recorder();
    dispatchShortcut(press("ArrowRight", { shiftKey: true }), actions);
    dispatchShortcut(press("ArrowRight"), actions);
    expect(names(calls)).toEqual(["next", "seekBy"]);
    expect(dispatchShortcut(press("ArrowUp", { shiftKey: true }), actions)).toBe(false);
  });
});

describe("dispatchShortcut ignoring", () => {
  it("ignores everything while typing", () => {
    const { actions, calls } = recorder();
    for (const key of [" ", "m", "s", "/", "?", "ArrowLeft", "ArrowUp"]) {
      expect(dispatchShortcut(press(key, { focus: "typing" }), actions)).toBe(false);
    }
    expect(calls).toEqual([]);
  });

  it("ignores everything while a dialog is open", () => {
    const { actions, calls } = recorder();
    for (const key of [" ", "m", "?", "ArrowRight"]) {
      expect(dispatchShortcut(press(key, { isDialogOpen: true }), actions)).toBe(false);
    }
    expect(calls).toEqual([]);
  });

  it("ignores keys combined with Ctrl, Meta or Alt", () => {
    const { actions, calls } = recorder();
    expect(dispatchShortcut(press("s", { hasModifier: true }), actions)).toBe(false);
    expect(dispatchShortcut(press("ArrowLeft", { hasModifier: true }), actions)).toBe(false);
    expect(calls).toEqual([]);
  });

  it("leaves Space to focused buttons but keeps other keys", () => {
    const { actions, calls } = recorder();
    expect(dispatchShortcut(press(" ", { focus: "button" }), actions)).toBe(false);
    expect(dispatchShortcut(press("m", { focus: "button" }), actions)).toBe(true);
    expect(names(calls)).toEqual(["toggleMute"]);
  });

  it("leaves arrows to separators, tabs and sliders but keeps other keys", () => {
    const { actions, calls } = recorder();
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      expect(dispatchShortcut(press(key, { focus: "arrows" }), actions)).toBe(false);
    }
    expect(dispatchShortcut(press(" ", { focus: "arrows" }), actions)).toBe(true);
    expect(names(calls)).toEqual(["togglePlay"]);
  });

  it("repeats only seek and volume while a key is held", () => {
    const { actions, calls } = recorder();
    expect(dispatchShortcut(press("ArrowRight", { repeat: true }), actions)).toBe(true);
    expect(dispatchShortcut(press("ArrowDown", { repeat: true }), actions)).toBe(true);
    expect(dispatchShortcut(press(" ", { repeat: true }), actions)).toBe(false);
    expect(dispatchShortcut(press("m", { repeat: true }), actions)).toBe(false);
    expect(dispatchShortcut(press("ArrowRight", { shiftKey: true, repeat: true }), actions)).toBe(false);
    expect(names(calls)).toEqual(["seekBy", "changeVolume"]);
  });
});

describe("SHORTCUT_HELP", () => {
  it("lists every shortcut once with Spanish text", () => {
    expect(SHORTCUT_HELP.map((help) => help.keys)).toEqual(["Espacio", "Mayús + →", "Mayús + ←", "→", "←", "↑", "↓", "M", "S", "R", "L", "E", "/", "?"]);
    expect(new Set(SHORTCUT_HELP.map((help) => help.keys)).size).toBe(SHORTCUT_HELP.length);
    expect(SHORTCUT_HELP.every((help) => help.description.length > 0)).toBe(true);
  });
});
