import { coverInitial, coverToneIndex } from "./format";
import { createIcon, createIconButton, createLabeledButton, setButtonIcon, type IconName } from "./icons";
import type { Playlist } from "./Playlist";

const TONE_CLASS_PREFIX = "cover-tone-";

export class PlaylistHeaderView {
  readonly element = Object.assign(document.createElement("header"), { className: "list-header" });
  readonly title = Object.assign(document.createElement("h1"), { className: "list-title", tabIndex: -1 });
  readonly meta = Object.assign(document.createElement("p"), { className: "list-meta" });
  readonly #cover = Object.assign(document.createElement("div"), { className: "list-cover" });
  readonly #eyebrow = Object.assign(document.createElement("p"), { className: "list-eyebrow" });
  readonly #actions = Object.assign(document.createElement("div"), { className: "list-actions" });
  readonly #play = createIconButton("play", "Reproducir playlist", "icon-button play-button list-play");
  readonly #shuffle = createLabeledButton("shuffle", "Aleatorio", "button button-secondary list-shuffle");

  constructor(searchField: HTMLElement) {
    this.#cover.setAttribute("aria-hidden", "true");
    this.#play.dataset.action = "play-playlist";
    this.#shuffle.dataset.action = "toggle-shuffle";
    this.#shuffle.setAttribute("aria-pressed", "false");
    this.meta.setAttribute("aria-live", "polite");
    const heading = Object.assign(document.createElement("div"), { className: "list-heading" });
    heading.append(this.#eyebrow, this.title, this.meta);
    const toolbar = Object.assign(document.createElement("div"), { className: "list-toolbar" });
    toolbar.append(this.#actions, searchField);
    this.element.append(this.#cover, heading, toolbar);
  }

  render(playlist: Playlist): void {
    this.#eyebrow.textContent = playlist.isLibrary ? "Tu música" : "Playlist";
    this.title.textContent = playlist.name;
    this.renderCover(playlist);
    this.#actions.replaceChildren(this.#play, this.#shuffle, ...PlaylistHeaderView.createButtons(playlist.isLibrary));
  }

  setPlayback(isPlayingThis: boolean, isEmpty: boolean): void {
    setButtonIcon(this.#play, isPlayingThis ? "pause" : "play", isPlayingThis ? "Pausar" : "Reproducir playlist");
    this.#play.disabled = isEmpty;
  }

  setShuffle(isOn: boolean): void {
    this.#shuffle.setAttribute("aria-pressed", String(isOn));
    this.#shuffle.classList.toggle("is-active", isOn);
  }

  private renderCover(playlist: Playlist): void {
    this.#cover.className = "list-cover";
    if (playlist.isLibrary) {
      this.#cover.classList.add("is-library");
      this.#cover.replaceChildren(createIcon("library"));
      return;
    }
    this.#cover.classList.add(`${TONE_CLASS_PREFIX}${coverToneIndex(playlist.id)}`);
    this.#cover.replaceChildren(Object.assign(document.createElement("span"), { className: "list-cover-letter", textContent: coverInitial(playlist.name) }));
  }

  private static createButtons(isLibrary: boolean): HTMLButtonElement[] {
    const duplicate = PlaylistHeaderView.createButton("copy", "Duplicar", "duplicate-playlist", "button button-secondary");
    if (isLibrary) {
      return [duplicate];
    }
    return [
      PlaylistHeaderView.createButton("plus", "Agregar canciones", "add-songs", "button button-primary"),
      PlaylistHeaderView.createButton("upload", "Importar aquí", "import-here", "button button-secondary"),
      duplicate,
      PlaylistHeaderView.createButton("edit", "Renombrar", "rename", "button button-secondary"),
      PlaylistHeaderView.createButton("trash", "Eliminar playlist", "delete-playlist", "button button-ghost button-ghost-danger"),
    ];
  }

  private static createButton(icon: IconName, label: string, action: string, className: string): HTMLButtonElement {
    const button = createLabeledButton(icon, label, className);
    button.dataset.action = action;
    return button;
  }
}
