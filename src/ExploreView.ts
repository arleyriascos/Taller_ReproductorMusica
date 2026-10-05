import { AddToPlaylistDialogView } from "./AddToPlaylistDialogView";
import { AUDIUS_GENRES, AUDIUS_SITE } from "./audius";
import { countLabel } from "./format";
import { createIcon, createLabeledButton } from "./icons";
import type { Node } from "./Node";
import type { Playlist } from "./Playlist";
import type { Song } from "./Song";
import { createTrackColumns, createTrackRow } from "./trackRow";
import type { AddSongRequest, ExploreStatus } from "./types";

export interface ExploreData {
  status: ExploreStatus;
  playlist: Playlist;
  query: string;
  genre: string | null;
  destinations: readonly Playlist[];
}

type TextHandler = (query: string) => void;

const DEBOUNCE_MILLISECONDS = 400;
const SKELETON_ROWS = 8;
const ALL_GENRES_LABEL = "Todos";
const PRIVACY_NOTE = "Explorar consulta Audius por internet; tus archivos locales nunca se envían.";

export class ExploreView {
  readonly #root: HTMLElement;
  readonly #search = ExploreView.createSearchInput();
  readonly #chips = new Map<string | null, HTMLButtonElement>();
  readonly #meta = Object.assign(document.createElement("p"), { className: "list-meta" });
  readonly #body = Object.assign(document.createElement("div"), { className: "list-content is-fixed-order" });
  readonly #rowNodes = new WeakMap<Element, Node<Song>>();
  readonly #rowsByNode = new Map<Node<Song>, HTMLLIElement>();
  readonly #addDialog = new AddToPlaylistDialogView();
  #genre: string | null = null;
  #shown = "";
  #destinations: readonly Playlist[] = [];
  #source: Playlist | null = null;
  #current: Playlist | null = null;
  #isPlaying = false;
  #timer: number | null = null;
  #searchHandler: TextHandler = () => {};
  #genreHandler: (genre: string | null) => void = () => {};
  #retryHandler: () => void = () => {};
  #playHandler: (node: Node<Song>) => void = () => {};

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#root.append(this.createHeader(), this.createControls(), this.#body, ExploreView.createFooter());
    this.registerEvents();
  }

  onSearch(handler: TextHandler): void {
    this.#searchHandler = handler;
  }

  onGenre(handler: (genre: string | null) => void): void {
    this.#genreHandler = handler;
  }

  onRetry(handler: () => void): void {
    this.#retryHandler = handler;
  }

  onPlay(handler: (node: Node<Song>) => void): void {
    this.#playHandler = handler;
  }

  onAddSong(handler: (request: AddSongRequest) => void): void {
    this.#addDialog.onConfirm(handler);
  }

  setVisible(isVisible: boolean): void {
    this.#root.hidden = !isVisible;
  }

  focusSearch(): void {
    this.#search.focus();
    this.#search.select();
  }

  render(data: ExploreData): void {
    this.#destinations = data.destinations;
    const signature = `${data.status}|${data.query}|${data.genre ?? ""}`;
    if (data.playlist === this.#current && signature === this.#shown) {
      return;
    }
    this.#current = data.playlist;
    this.#shown = signature;
    this.#rowsByNode.clear();
    this.renderChips();
    if (data.status === "loading") {
      this.#meta.textContent = "Buscando en Audius…";
      this.#body.replaceChildren(ExploreView.createSkeleton());
    } else if (data.status === "error") {
      this.#meta.textContent = "";
      this.#body.replaceChildren(this.createError());
    } else {
      this.renderResults(data);
    }
    this.applyPlayback();
  }

  setPlayback(source: Playlist | null, isPlaying: boolean): void {
    this.#source = source;
    this.#isPlaying = isPlaying;
    this.applyPlayback();
  }

  private renderResults(data: ExploreData): void {
    if (data.playlist.length === 0) {
      this.#meta.textContent = "";
      this.#body.replaceChildren(ExploreView.createEmpty(data.query === "" ? (data.genre ?? "") : data.query));
      return;
    }
    this.#meta.textContent = countLabel(data.playlist.length, "canción", "canciones");
    const list = Object.assign(document.createElement("ol"), { className: "track-list" });
    list.setAttribute("aria-label", "Resultados de Audius");
    let position = 1;
    for (const node of data.playlist.nodes()) {
      const row = createTrackRow(node, { position, kind: "explore" });
      this.#rowNodes.set(row, node);
      this.#rowsByNode.set(node, row);
      list.append(row);
      position++;
    }
    this.#body.replaceChildren(createTrackColumns(), list);
  }

  private applyPlayback(): void {
    const isSourceShown = this.#source !== null && this.#source === this.#current;
    const currentNode = isSourceShown ? (this.#source?.current ?? null) : null;
    for (const [node, row] of this.#rowsByNode) {
      const isCurrent = node === currentNode;
      row.classList.toggle("is-current", isCurrent);
      row.classList.toggle("is-playing", isCurrent && this.#isPlaying);
      row.toggleAttribute("aria-current", isCurrent);
    }
  }

  private renderChips(): void {
    const hasQuery = this.#search.value.trim() !== "";
    for (const [genre, chip] of this.#chips) {
      chip.setAttribute("aria-pressed", String(!hasQuery && genre === this.#genre));
    }
  }

  private createHeader(): HTMLElement {
    const header = Object.assign(document.createElement("header"), { className: "explore-header" });
    const title = Object.assign(document.createElement("h1"), { className: "list-title", textContent: "Explorar", tabIndex: -1 });
    const subtitle = Object.assign(document.createElement("p"), { className: "list-eyebrow", textContent: "Música libre de Audius" });
    header.append(subtitle, title, this.#meta);
    return header;
  }

  private createControls(): HTMLElement {
    const controls = Object.assign(document.createElement("div"), { className: "explore-controls" });
    const field = Object.assign(document.createElement("label"), { className: "search-field explore-search" });
    field.append(createIcon("search"), this.#search);
    const chips = Object.assign(document.createElement("div"), { className: "genre-chips" });
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Géneros");
    for (const genre of [null, ...AUDIUS_GENRES]) {
      const chip = Object.assign(document.createElement("button"), { type: "button", className: "chip", textContent: genre ?? ALL_GENRES_LABEL });
      this.#chips.set(genre, chip);
      chips.append(chip);
    }
    controls.append(field, chips);
    return controls;
  }

  private createError(): HTMLElement {
    const card = Object.assign(document.createElement("section"), { className: "empty-state" });
    const icon = Object.assign(document.createElement("span"), { className: "empty-icon" });
    icon.append(createIcon("alert"));
    const retry = createLabeledButton("refresh", "Reintentar", "button button-primary");
    retry.dataset.action = "retry";
    card.append(icon, Object.assign(document.createElement("h2"), { className: "empty-title", textContent: "No se pudo conectar con Audius" }), retry);
    return card;
  }

  private registerEvents(): void {
    this.#search.addEventListener("input", () => this.scheduleSearch());
    this.#search.addEventListener("keydown", (event) => this.handleSearchKey(event));
    for (const [genre, chip] of this.#chips) {
      chip.addEventListener("click", () => this.chooseGenre(genre));
    }
    this.#root.addEventListener("click", (event) => this.handleClick(event));
  }

  private scheduleSearch(): void {
    this.cancelTimer();
    this.#timer = window.setTimeout(() => this.emitSearch(), DEBOUNCE_MILLISECONDS);
  }

  private handleSearchKey(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      this.emitSearch();
    }
  }

  private emitSearch(): void {
    this.cancelTimer();
    this.#genre = null;
    this.renderChips();
    this.#searchHandler(this.#search.value.trim());
  }

  private chooseGenre(genre: string | null): void {
    this.cancelTimer();
    this.#search.value = "";
    this.#genre = genre;
    this.renderChips();
    this.#genreHandler(genre);
  }

  private cancelTimer(): void {
    if (this.#timer !== null) {
      window.clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action]") : null;
    const action = target?.dataset.action;
    if (target === null || action === undefined) {
      return;
    }
    if (action === "retry") {
      this.#retryHandler();
      return;
    }
    const row = target.closest(".track-row");
    const node = row === null ? undefined : this.#rowNodes.get(row);
    if (node === undefined) {
      return;
    }
    if (action === "play") {
      this.#playHandler(node);
    } else if (action === "add") {
      this.#addDialog.open(node.value, this.#destinations, null);
    }
  }

  private static createSkeleton(): HTMLElement {
    const list = Object.assign(document.createElement("ul"), { className: "skeleton-list" });
    list.setAttribute("aria-hidden", "true");
    for (let index = 0; index < SKELETON_ROWS; index++) {
      list.append(Object.assign(document.createElement("li"), { className: "skeleton-row" }));
    }
    return list;
  }

  private static createEmpty(subject: string): HTMLElement {
    const message = subject === "" ? "Sin resultados en Audius" : `Sin resultados en Audius para «${subject}»`;
    const section = Object.assign(document.createElement("section"), { className: "search-empty" });
    section.append(Object.assign(document.createElement("p"), { className: "search-empty-text", textContent: message }));
    return section;
  }

  private static createFooter(): HTMLElement {
    const footer = Object.assign(document.createElement("footer"), { className: "explore-footer" });
    const attribution = Object.assign(document.createElement("p"), { className: "explore-attribution" });
    const link = Object.assign(document.createElement("a"), { href: AUDIUS_SITE, target: "_blank", rel: "noopener noreferrer", textContent: "Ver en Audius" });
    attribution.append("Música de Audius · ", link);
    footer.append(attribution, Object.assign(document.createElement("p"), { className: "explore-privacy", textContent: PRIVACY_NOTE }));
    return footer;
  }

  private static createSearchInput(): HTMLInputElement {
    const input = Object.assign(document.createElement("input"), {
      type: "search",
      className: "text-input search-input",
      placeholder: "Buscar en Audius",
      autocomplete: "off",
      spellcheck: false,
    });
    input.setAttribute("aria-label", "Buscar en Audius");
    return input;
  }
}
