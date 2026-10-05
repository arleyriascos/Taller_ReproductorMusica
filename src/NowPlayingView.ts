import { artistLabel } from "./format";
import { createIconButton, createLabeledButton, setCover } from "./icons";
import { activeLineIndex } from "./lyrics";
import type { Node } from "./Node";
import type { Playlist } from "./Playlist";
import type { Song } from "./Song";
import { createQueueItem, queueNote } from "./queueItem";
import type { Lyrics, LyricsResult, LyricsSource, PlayerState, RepeatMode } from "./types";

export type TabName = "queue" | "lyrics";
type Step = (node: Node<Song>) => Node<Song> | null;

const QUEUE_LIMIT = 25;
const HISTORY_LIMIT = 10;
const AUTO_SCROLL_PAUSE_MS = 4000;
const TAB_ORDER: readonly TabName[] = ["queue", "lyrics"];
const TAB_LABELS: Record<TabName, string> = { queue: "A continuación", lyrics: "Letra" };
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
const SOURCE_NOTES: Record<LyricsSource, string> = {
  file: "Letra del archivo .lrc",
  embedded: "Letra incluida en el archivo",
  lrclib: "Letra de LRCLIB · solo se consultó el título y el artista",
};

export class NowPlayingView {
  readonly #root: HTMLElement;
  readonly #shell: HTMLElement;
  readonly #covered: readonly HTMLElement[];
  readonly #close = createIconButton("chevronDown", "Cerrar reproduciendo ahora", "icon-button now-close");
  readonly #origin = Object.assign(document.createElement("p"), { className: "now-origin" });
  readonly #cover = Object.assign(document.createElement("div"), { className: "cover now-cover" });
  readonly #title = Object.assign(document.createElement("h2"), { className: "now-title" });
  readonly #artist = Object.assign(document.createElement("p"), { className: "now-artist" });
  readonly #album = Object.assign(document.createElement("p"), { className: "now-album" });
  readonly #controlsSlot = Object.assign(document.createElement("div"), { className: "now-controls" });
  readonly #tabs = new Map<TabName, HTMLButtonElement>();
  readonly #panels = new Map<TabName, HTMLElement>();
  readonly #queueList = Object.assign(document.createElement("ol"), { className: "queue-list" });
  readonly #queueNote = Object.assign(document.createElement("p"), { className: "queue-note" });
  readonly #history = Object.assign(document.createElement("details"), { className: "queue-history" });
  readonly #historySummary = document.createElement("summary");
  readonly #historyList = Object.assign(document.createElement("ol"), { className: "queue-list" });
  readonly #lyricsBox = Object.assign(document.createElement("div"), { className: "lyrics-box" });
  readonly #lyricsNote = Object.assign(document.createElement("p"), { className: "lyrics-source" });
  readonly #itemNodes = new WeakMap<Element, Node<Song>>();
  #lyricElements: HTMLElement[] = [];
  #lyrics: Lyrics | null = null;
  #activeLine = -1;
  #currentTime = 0;
  #autoScrollPausedUntil = 0;
  #song: Song | null = null;
  #coverUrl: string | null | undefined;
  #context: Playlist | null = null;
  #currentNode: Node<Song> | null = null;
  #repeatMode: RepeatMode = "off";
  #isQueueStale = true;
  #lyricsSong: Song | null = null;
  #tab: TabName = "queue";
  #returnFocus: HTMLElement | null = null;
  #playHandler: (node: Node<Song>) => void = () => {};
  #seekHandler: (seconds: number) => void = () => {};
  #lyricsHandler: (song: Song) => void = () => {};
  #visibilityHandler: (isOpen: boolean) => void = () => {};

  constructor(root: HTMLElement, shell: HTMLElement, covered: readonly HTMLElement[]) {
    this.#root = root;
    this.#shell = shell;
    this.#covered = covered;
    this.#root.hidden = true;
    this.#root.append(this.createHeader(), this.createBody());
    this.selectTab("queue");
    this.registerEvents();
  }

  get controlsSlot(): HTMLElement {
    return this.#controlsSlot;
  }

  get isOpen(): boolean {
    return !this.#root.hidden;
  }

  onPlayNode(handler: (node: Node<Song>) => void): void {
    this.#playHandler = handler;
  }

  onSeek(handler: (seconds: number) => void): void {
    this.#seekHandler = handler;
  }

  onLyricsRequested(handler: (song: Song) => void): void {
    this.#lyricsHandler = handler;
  }

  onVisibilityChange(handler: (isOpen: boolean) => void): void {
    this.#visibilityHandler = handler;
  }

  open(tab?: TabName): void {
    if (this.isOpen || this.#song === null) {
      return;
    }
    this.#returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.setOpen(true);
    if (tab !== undefined) {
      this.selectTab(tab);
    }
    this.renderQueueIfStale();
    this.requestLyricsIfNeeded();
    this.highlightLine();
    this.#close.focus();
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.setOpen(false);
    this.#returnFocus?.focus();
    this.#returnFocus = null;
  }

  invalidateQueue(): void {
    this.#isQueueStale = true;
  }

  render(state: PlayerState, context: Playlist | null): void {
    const current = context?.current ?? null;
    if (current !== this.#currentNode || context !== this.#context || state.repeatMode !== this.#repeatMode) {
      this.#isQueueStale = true;
    }
    this.#context = context;
    this.#currentNode = current;
    this.#repeatMode = state.repeatMode;
    this.#origin.textContent = context === null ? "" : `Reproduciendo desde «${context.name}»`;
    this.renderSong(state.song);
    if (state.song === null) {
      this.close();
      return;
    }
    this.renderQueueIfStale();
    this.requestLyricsIfNeeded();
  }

  updateProgress(currentTime: number): void {
    this.#currentTime = currentTime;
    if (this.isOpen && this.#tab === "lyrics") {
      this.highlightLine();
    }
  }

  showLyrics(song: Song, result: LyricsResult): void {
    if (song !== this.#lyricsSong) {
      return;
    }
    this.#lyrics = result.status === "found" ? result.lyrics : null;
    this.#lyricElements = [];
    this.#activeLine = -1;
    this.#lyricsBox.scrollTop = 0;
    if (result.status === "found") {
      this.renderFoundLyrics(result.lyrics);
    } else {
      this.renderLyricsMessage(result.status === "error" ? "No se pudo cargar la letra" : "Letra no disponible para esta canción", result.status === "error");
    }
  }

  private setOpen(isOpen: boolean): void {
    this.#root.hidden = !isOpen;
    this.#shell.classList.toggle("is-now-playing-open", isOpen);
    for (const element of this.#covered) {
      element.inert = isOpen;
    }
    this.#visibilityHandler(isOpen);
  }

  private renderSong(song: Song | null): void {
    if (song === this.#song) {
      return;
    }
    this.#song = song;
    this.#title.textContent = song?.title ?? "";
    this.#artist.textContent = song === null ? "" : artistLabel(song.artist);
    this.#album.textContent = song?.album ?? "";
    this.#album.hidden = this.#album.textContent === "";
    const url = song?.coverUrl ?? null;
    if (url !== this.#coverUrl) {
      this.#coverUrl = url;
      setCover(this.#cover, url);
    }
  }

  private selectTab(name: TabName): void {
    this.#tab = name;
    for (const tabName of TAB_ORDER) {
      const isSelected = tabName === name;
      this.#tabs.get(tabName)?.setAttribute("aria-selected", String(isSelected));
      this.#tabs.get(tabName)?.setAttribute("tabindex", isSelected ? "0" : "-1");
      this.#panels.get(tabName)?.toggleAttribute("hidden", !isSelected);
    }
    this.requestLyricsIfNeeded();
    this.highlightLine();
  }

  private handleTabKey(event: KeyboardEvent): void {
    const index = TAB_ORDER.indexOf(this.#tab);
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TAB_ORDER.length - 1 };
    const target = moves[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    const name = TAB_ORDER[(target + TAB_ORDER.length) % TAB_ORDER.length];
    this.selectTab(name);
    this.#tabs.get(name)?.focus();
  }

  private renderQueueIfStale(): void {
    if (!this.#isQueueStale || !this.isOpen) {
      return;
    }
    this.#isQueueStale = false;
    const panel = this.#panels.get("queue");
    const hadFocus = panel?.contains(document.activeElement) ?? false;
    const current = this.#currentNode;
    const upcoming = this.fillQueue(this.#queueList, current?.next ?? null, (node) => node.next, QUEUE_LIMIT);
    const previous = this.fillQueue(this.#historyList, current?.prev ?? null, (node) => node.prev, HISTORY_LIMIT);
    this.#history.hidden = previous === 0;
    this.#historySummary.textContent = `Anteriores (${previous})`;
    this.#queueNote.textContent = queueNote(this.#repeatMode, upcoming);
    this.#queueNote.hidden = this.#queueNote.textContent === "";
    if (hadFocus && NowPlayingView.isFocusLost()) {
      panel?.focus();
    }
  }

  private fillQueue(list: HTMLOListElement, start: Node<Song> | null, step: Step, limit: number): number {
    list.replaceChildren();
    let count = 0;
    for (let node = start; node !== null; node = step(node)) {
      if (count < limit) {
        list.append(createQueueItem(node, this.#itemNodes));
      }
      count++;
    }
    if (count > limit) {
      list.append(Object.assign(document.createElement("li"), { className: "queue-more", textContent: `y ${count - limit} más` }));
    }
    return count;
  }

  private requestLyricsIfNeeded(): void {
    const song = this.#song;
    if (!this.isOpen || this.#tab !== "lyrics" || song === null || song === this.#lyricsSong) {
      return;
    }
    this.#lyricsSong = song;
    this.#lyrics = null;
    this.#lyricElements = [];
    this.renderLyricsMessage("Cargando letra…", false);
    this.#lyricsHandler(song);
  }

  private retryLyrics(): void {
    this.#lyricsSong = null;
    this.requestLyricsIfNeeded();
  }

  private renderLyricsMessage(text: string, canRetry: boolean): void {
    const message = Object.assign(document.createElement("div"), { className: "lyrics-message" });
    message.append(Object.assign(document.createElement("p"), { textContent: text }));
    if (canRetry) {
      const retry = createLabeledButton("repeat", "Reintentar", "button button-secondary");
      retry.dataset.action = "retry-lyrics";
      message.append(retry);
    }
    this.#lyricsBox.replaceChildren(message);
    this.#lyricsNote.hidden = true;
  }

  private renderFoundLyrics(lyrics: Lyrics): void {
    this.#lyricsNote.textContent = SOURCE_NOTES[lyrics.source];
    this.#lyricsNote.hidden = false;
    if (lyrics.instrumental) {
      this.#lyricsBox.replaceChildren(Object.assign(document.createElement("p"), { className: "lyrics-message", textContent: "Instrumental" }));
      return;
    }
    const list = Object.assign(document.createElement("ol"), { className: lyrics.synced ? "lyrics-lines is-synced" : "lyrics-lines" });
    for (const [index, line] of lyrics.lines.entries()) {
      const element = NowPlayingView.createLyricLine(line.text, lyrics.synced, index);
      list.append(element);
      this.#lyricElements.push(element);
    }
    this.#lyricsBox.replaceChildren(list);
    this.highlightLine();
  }

  private highlightLine(): void {
    const lyrics = this.#lyrics;
    if (lyrics === null || !lyrics.synced || this.#tab !== "lyrics") {
      return;
    }
    const index = activeLineIndex(lyrics.lines, this.#currentTime);
    if (index === this.#activeLine) {
      return;
    }
    this.#lyricElements[this.#activeLine]?.classList.remove("is-active");
    this.#lyricElements[index]?.classList.add("is-active");
    this.#activeLine = index;
    this.scrollToActiveLine();
  }

  private scrollToActiveLine(): void {
    const line = this.#lyricElements[this.#activeLine];
    if (line === undefined || Date.now() < this.#autoScrollPausedUntil || this.#lyricsBox.clientHeight === 0) {
      return;
    }
    const top = line.offsetTop - (this.#lyricsBox.clientHeight - line.offsetHeight) / 2;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#lyricsBox.scrollTo({ top: Math.max(top, 0), behavior: reduceMotion ? "auto" : "smooth" });
  }

  private pauseAutoScroll(): void {
    this.#autoScrollPausedUntil = Date.now() + AUTO_SCROLL_PAUSE_MS;
  }

  private seekToLine(element: Element): void {
    const time = this.#lyrics?.lines[Number(element.getAttribute("data-index"))]?.time ?? null;
    if (time !== null) {
      this.#autoScrollPausedUntil = 0;
      this.#seekHandler(time);
    }
  }

  private registerEvents(): void {
    this.#close.addEventListener("click", () => this.close());
    this.#root.addEventListener("click", (event) => this.handleClick(event));
    document.addEventListener("keydown", (event) => this.handleEscape(event));
    this.registerManualScroll();
  }

  private registerManualScroll(): void {
    const box = this.#lyricsBox;
    const pause = (): void => this.pauseAutoScroll();
    box.addEventListener("wheel", pause, { passive: true });
    box.addEventListener("touchmove", pause, { passive: true });
    box.addEventListener("pointerdown", (event) => {
      if (event.target === box) {
        pause();
      }
    });
    box.addEventListener("keydown", (event) => {
      if (SCROLL_KEYS.has(event.key)) {
        pause();
      }
    });
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest(".queue-item");
    const node = item === null || item === undefined ? undefined : this.#itemNodes.get(item);
    if (node !== undefined) {
      this.#playHandler(node);
      return;
    }
    const line = target?.closest(".lyric-line");
    if (line !== null && line !== undefined) {
      this.seekToLine(line);
    } else if (target?.closest("[data-action='retry-lyrics']")) {
      this.retryLyrics();
    }
  }

  private handleEscape(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.isOpen && !event.defaultPrevented) {
      event.preventDefault();
      this.close();
    }
  }

  private createHeader(): HTMLElement {
    const header = Object.assign(document.createElement("header"), { className: "now-header" });
    const heading = Object.assign(document.createElement("p"), { className: "now-heading", textContent: "Reproduciendo ahora" });
    const text = Object.assign(document.createElement("div"), { className: "now-header-text" });
    text.append(heading, this.#origin);
    header.append(this.#close, text);
    return header;
  }

  private createBody(): HTMLElement {
    const body = Object.assign(document.createElement("div"), { className: "now-body" });
    const art = Object.assign(document.createElement("div"), { className: "now-art" });
    const meta = Object.assign(document.createElement("div"), { className: "now-meta" });
    meta.append(this.#title, this.#artist, this.#album);
    art.append(this.#cover, meta, this.#controlsSlot);
    body.append(art, this.createTabs());
    return body;
  }

  private createTabs(): HTMLElement {
    const section = Object.assign(document.createElement("div"), { className: "now-panel" });
    const tablist = Object.assign(document.createElement("div"), { className: "now-tabs" });
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Reproduciendo ahora");
    tablist.addEventListener("keydown", (event) => this.handleTabKey(event));
    section.append(tablist);
    for (const name of TAB_ORDER) {
      const [tab, panel] = this.createTab(name);
      tablist.append(tab);
      section.append(panel);
    }
    return section;
  }

  private createTab(name: TabName): [HTMLButtonElement, HTMLElement] {
    const tab = Object.assign(document.createElement("button"), { type: "button", className: "now-tab", id: `now-tab-${name}`, textContent: TAB_LABELS[name] });
    const panel = Object.assign(document.createElement("div"), { className: `now-tabpanel now-tabpanel-${name}`, id: `now-panel-${name}`, tabIndex: 0 });
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    tab.addEventListener("click", () => this.selectTab(name));
    panel.append(...(name === "queue" ? this.createQueueContent() : [this.#lyricsBox, this.#lyricsNote]));
    this.#tabs.set(name, tab);
    this.#panels.set(name, panel);
    return [tab, panel];
  }

  private createQueueContent(): HTMLElement[] {
    this.#queueList.setAttribute("aria-label", "Canciones siguientes");
    this.#historyList.setAttribute("aria-label", "Canciones anteriores");
    this.#history.append(this.#historySummary, this.#historyList);
    return [this.#queueList, this.#queueNote, this.#history];
  }

  private static createLyricLine(text: string, isSynced: boolean, index: number): HTMLLIElement {
    const item = Object.assign(document.createElement("li"), { className: "lyric-item" });
    if (text === "") {
      item.classList.add("lyric-spacer");
      item.setAttribute("aria-hidden", "true");
      return item;
    }
    if (!isSynced) {
      item.textContent = text;
      return item;
    }
    const button = Object.assign(document.createElement("button"), { type: "button", className: "lyric-line", textContent: text });
    button.setAttribute("data-index", String(index));
    item.append(button);
    return item;
  }

  private static isFocusLost(): boolean {
    const active = document.activeElement;
    return active === null || active === document.body;
  }
}
