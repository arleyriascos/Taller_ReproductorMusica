export interface ShortcutActions {
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seekBy: (seconds: number) => void;
  changeVolume: (delta: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleNowPlaying: () => void;
  toggleRightColumn: () => void;
  focusSearch: () => void;
  showHelp: () => void;
}

export interface ShortcutHelp {
  keys: string;
  description: string;
}

export type FocusKind = "typing" | "button" | "arrows" | "other";

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  repeat: boolean;
  hasModifier: boolean;
  isDialogOpen: boolean;
  focus: FocusKind;
}

interface ShortcutDefinition extends ShortcutHelp {
  matches: (input: KeyInput) => boolean;
  run: (actions: ShortcutActions) => void;
  repeats?: boolean;
}

const SEEK_SECONDS = 5;
const VOLUME_STEP = 0.1;
const ARROW_KEYS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
const TYPING_TARGETS = "input, textarea, select, [contenteditable]";
const BUTTON_TARGETS = "button, a[href], summary, [role='button']";
const ARROW_TARGETS = "[role='separator'], [role='tab'], [role='slider']";

function letter(key: string): (input: KeyInput) => boolean {
  return (input) => input.key.toLowerCase() === key;
}

function arrow(key: string, withShift: boolean): (input: KeyInput) => boolean {
  return (input) => input.key === key && input.shiftKey === withShift;
}

const DEFINITIONS: readonly ShortcutDefinition[] = [
  { keys: "Espacio", description: "Reproducir o pausar", matches: (input) => input.key === " ", run: (actions) => actions.togglePlay() },
  { keys: "Mayús + →", description: "Canción siguiente", matches: arrow("ArrowRight", true), run: (actions) => actions.next() },
  { keys: "Mayús + ←", description: "Canción anterior", matches: arrow("ArrowLeft", true), run: (actions) => actions.previous() },
  { keys: "→", description: "Adelantar 5 segundos", matches: arrow("ArrowRight", false), run: (actions) => actions.seekBy(SEEK_SECONDS), repeats: true },
  { keys: "←", description: "Retroceder 5 segundos", matches: arrow("ArrowLeft", false), run: (actions) => actions.seekBy(-SEEK_SECONDS), repeats: true },
  { keys: "↑", description: "Subir el volumen", matches: arrow("ArrowUp", false), run: (actions) => actions.changeVolume(VOLUME_STEP), repeats: true },
  { keys: "↓", description: "Bajar el volumen", matches: arrow("ArrowDown", false), run: (actions) => actions.changeVolume(-VOLUME_STEP), repeats: true },
  { keys: "M", description: "Silenciar o activar el sonido", matches: letter("m"), run: (actions) => actions.toggleMute() },
  { keys: "S", description: "Activar o desactivar aleatorio", matches: letter("s"), run: (actions) => actions.toggleShuffle() },
  { keys: "R", description: "Cambiar el modo de repetición", matches: letter("r"), run: (actions) => actions.cycleRepeat() },
  { keys: "L", description: "Abrir o cerrar «Reproduciendo ahora»", matches: letter("l"), run: (actions) => actions.toggleNowPlaying() },
  { keys: "E", description: "Mostrar u ocultar el panel derecho", matches: letter("e"), run: (actions) => actions.toggleRightColumn() },
  { keys: "/", description: "Ir a la búsqueda", matches: (input) => input.key === "/", run: (actions) => actions.focusSearch() },
  { keys: "?", description: "Ver los atajos de teclado", matches: (input) => input.key === "?", run: (actions) => actions.showHelp() },
];

export const SHORTCUT_HELP: readonly ShortcutHelp[] = DEFINITIONS.map(({ keys, description }) => ({ keys, description }));

function isIgnored(input: KeyInput): boolean {
  if (input.hasModifier || input.isDialogOpen || input.focus === "typing") {
    return true;
  }
  return (input.focus === "button" && input.key === " ") || (input.focus === "arrows" && ARROW_KEYS.includes(input.key));
}

export function dispatchShortcut(input: KeyInput, actions: ShortcutActions): boolean {
  if (isIgnored(input)) {
    return false;
  }
  const definition = DEFINITIONS.find((candidate) => candidate.matches(input));
  if (definition === undefined || (input.repeat && definition.repeats !== true)) {
    return false;
  }
  definition.run(actions);
  return true;
}

export class KeyboardShortcuts {
  readonly #actions: ShortcutActions;

  constructor(actions: ShortcutActions, target: Document = document) {
    this.#actions = actions;
    target.addEventListener("keydown", (event) => this.handle(event));
  }

  private handle(event: KeyboardEvent): void {
    if (!event.defaultPrevented && !event.isComposing && dispatchShortcut(KeyboardShortcuts.inputOf(event), this.#actions)) {
      event.preventDefault();
    }
  }

  private static inputOf(event: KeyboardEvent): KeyInput {
    return {
      key: event.key,
      shiftKey: event.shiftKey,
      repeat: event.repeat,
      hasModifier: event.ctrlKey || event.metaKey || event.altKey,
      isDialogOpen: document.querySelector("dialog[open]") !== null,
      focus: KeyboardShortcuts.focusOf(event.target),
    };
  }

  private static focusOf(target: EventTarget | null): FocusKind {
    if (!(target instanceof Element)) {
      return "other";
    }
    if (target.closest(TYPING_TARGETS) !== null) {
      return "typing";
    }
    if (target.closest(ARROW_TARGETS) !== null) {
      return "arrows";
    }
    return target.closest(BUTTON_TARGETS) !== null ? "button" : "other";
  }
}
