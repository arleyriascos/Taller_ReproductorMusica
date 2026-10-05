import { artistLabel } from "./format";
import { createIconButton, createLabeledButton, setCover } from "./icons";
import type { Node } from "./Node";
import type { Playlist } from "./Playlist";
import type { Song } from "./Song";
import { createQueueItem, queueNote } from "./queueItem";
import type { PlayerState, RepeatMode } from "./types";

type Side = "previous" | "next";

interface SideTarget {
  node: Node<Song> | null;
  title: string;
  note: string;
}

interface SideCard {
  button: HTMLButtonElement;
  title: HTMLSpanElement;
  note: HTMLSpanElement;
}

const UPCOMING_LIMIT = 8;

const SIDE_LABELS: Record<Side, string> = { previous: "◀ prev", next: "next ▶" };
const SIDE_EDGE_TITLES: Record<Side, string> = { previous: "Inicio de la lista", next: "Fin de la lista" };
const SIDE_WRAP_NOTES: Record<Side, string> = { previous: "(vuelve al final)", next: "(vuelve al inicio)" };

export class NowPlayingPanelView {
  readonly #root: HTMLElement;
  readonly #origin = Object.assign(document.createElement("p"), { className: "sounding-origin" });
  readonly #shuffleNote = Object.assign(document.createElement("p"), { className: "sounding-shuffle", textContent: "Orden aleatorio", hidden: true });
  readonly #nodeLine = Object.assign(document.createElement("p"), { className: "sounding-node" });
  readonly #expand = createIconButton("expand", "Abrir reproduciendo ahora", "icon-button sounding-expand");
  readonly #cover = Object.assign(document.createElement("div"), { className: "cover sounding-cover" });
  readonly #title = Object.assign(document.createElement("h3"), { className: "sounding-title" });
  readonly #artist = Object.assign(document.createElement("p"), { className: "sounding-artist" });
  readonly #cards: Record<Side, SideCard> = { previous: NowPlayingPanelView.createCard("previous"), next: NowPlayingPanelView.createCard("next") };
  readonly #upcomingList = Object.assign(document.createElement("ol"), { className: "queue-list" });
  readonly #upcomingNote = Object.assign(document.createElement("p"), { className: "queue-note" });
  readonly #viewAll = createLabeledButton("playlist", "Ver todo", "button button-ghost sounding-view-all");
  readonly #content = Object.assign(document.createElement("div"), { className: "sounding-content" });
  readonly #empty = Object.assign(document.createElement("div"), { className: "sounding-empty" });
  readonly #itemNodes = new WeakMap<Element, Node<Song>>();
  readonly #targets: Record<Side, Node<Song> | null> = { previous: null, next: null };
  #context: Playlist | null = null;
  #currentNode: Node<Song> | null = null;
  #repeatMode: RepeatMode = "off";
  #isShuffled = false;
  #coverUrl: string | null | undefined;
  #isStale = true;
  #playHandler: (node: Node<Song>) => void = () => {};
  #expandHandler: () => void = () => {};
  #viewAllHandler: () => void = () => {};

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#root.append(this.#empty, this.#content);
    this.#content.append(this.createHeader(), this.#cover, this.createMeta(), this.createCards(), this.createUpcoming());
    this.buildEmptyState();
    this.registerEvents();
  }

  onPlayNode(handler: (node: Node<Song>) => void): void {
    this.#playHandler = handler;
  }

  onExpand(handler: () => void): void {
    this.#expandHandler = handler;
  }

  onViewAll(handler: () => void): void {
    this.#viewAllHandler = handler;
  }

  invalidate(): void {
    this.#isStale = true;
  }

  render(state: PlayerState, context: Playlist | null): void {
    const current = context?.current ?? null;
    if (!this.#isStale && current === this.#currentNode && context === this.#context && state.repeatMode === this.#repeatMode && state.isShuffled === this.#isShuffled) {
      return;
    }
    this.#isStale = false;
    this.#context = context;
    this.#currentNode = current;
    this.#repeatMode = state.repeatMode;
    this.#isShuffled = state.isShuffled;
    const isEmpty = context === null || current === null;
    this.#empty.hidden = !isEmpty;
    this.#content.hidden = isEmpty;
    if (!isEmpty) {
      this.renderCurrent(context, current);
    }
  }

  private renderCurrent(context: Playlist, current: Node<Song>): void {
    const song = current.value;
    this.#origin.textContent = `Sonando desde «${context.name}»`;
    this.#origin.title = context.name;
    this.#shuffleNote.hidden = !this.#isShuffled;
    this.#nodeLine.textContent = `nodo [${context.positionOf(current) - 1}] · length ${context.length}`;
    this.#title.textContent = song.title;
    this.#title.title = song.title;
    this.#artist.textContent = artistLabel(song.artist);
    this.renderCover(song.coverUrl);
    this.renderCard("previous", this.sideTarget("previous", context, current));
    this.renderCard("next", this.sideTarget("next", context, current));
    this.renderUpcoming(current);
  }

  private renderCover(url: string | null): void {
    if (url !== this.#coverUrl) {
      this.#coverUrl = url;
      setCover(this.#cover, url);
    }
  }

  private sideTarget(side: Side, context: Playlist, current: Node<Song>): SideTarget {
    const neighbor = side === "previous" ? current.prev : current.next;
    if (neighbor !== null) {
      return { node: neighbor, title: neighbor.value.title, note: "" };
    }
    const wrapTarget = this.#repeatMode === "all" ? (side === "previous" ? context.tail : context.head) : null;
    if (wrapTarget === null) {
      return { node: null, title: SIDE_EDGE_TITLES[side], note: "" };
    }
    return { node: wrapTarget, title: wrapTarget.value.title, note: SIDE_WRAP_NOTES[side] };
  }

  private renderCard(side: Side, target: SideTarget): void {
    const card = this.#cards[side];
    this.#targets[side] = target.node;
    card.title.textContent = target.title;
    card.note.textContent = target.note;
    card.note.hidden = target.note === "";
    card.button.disabled = target.node === null;
    card.button.classList.toggle("is-edge", target.node === null);
  }

  private renderUpcoming(current: Node<Song>): void {
    this.#upcomingList.replaceChildren();
    let shown = 0;
    for (let node = current.next; node !== null && shown < UPCOMING_LIMIT; node = node.next) {
      this.#upcomingList.append(createQueueItem(node, this.#itemNodes));
      shown++;
    }
    this.#upcomingNote.textContent = queueNote(this.#repeatMode, shown);
    this.#upcomingNote.hidden = this.#upcomingNote.textContent === "";
  }

  private registerEvents(): void {
    this.#expand.addEventListener("click", () => this.#expandHandler());
    this.#viewAll.addEventListener("click", () => this.#viewAllHandler());
    this.#root.addEventListener("click", (event) => this.handleClick(event));
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest(".queue-item");
    const node = item === null || item === undefined ? undefined : this.#itemNodes.get(item);
    if (node !== undefined) {
      this.#playHandler(node);
      return;
    }
    const side = target?.closest<HTMLElement>("[data-side]")?.dataset.side;
    const neighbor = side === "previous" || side === "next" ? this.#targets[side] : null;
    if (neighbor !== null) {
      this.#playHandler(neighbor);
    }
  }

  private createHeader(): HTMLElement {
    const header = Object.assign(document.createElement("header"), { className: "sounding-header" });
    const origin = Object.assign(document.createElement("div"), { className: "sounding-origin-box" });
    origin.append(this.#origin, this.#shuffleNote);
    header.append(origin, this.#expand);
    return header;
  }

  private createMeta(): HTMLElement {
    const meta = Object.assign(document.createElement("div"), { className: "sounding-meta" });
    meta.append(this.#title, this.#artist, this.#nodeLine);
    return meta;
  }

  private createCards(): HTMLElement {
    const cards = Object.assign(document.createElement("div"), { className: "sounding-cards" });
    cards.append(this.#cards.previous.button, this.#cards.next.button);
    return cards;
  }

  private createUpcoming(): HTMLElement {
    const section = Object.assign(document.createElement("section"), { className: "sounding-upcoming" });
    const header = Object.assign(document.createElement("div"), { className: "sounding-upcoming-header" });
    header.append(Object.assign(document.createElement("h3"), { className: "structure-label", textContent: "A continuación" }), this.#viewAll);
    this.#upcomingList.setAttribute("aria-label", "Canciones siguientes");
    section.append(header, this.#upcomingList, this.#upcomingNote);
    return section;
  }

  private buildEmptyState(): void {
    this.#empty.append(
      Object.assign(document.createElement("p"), { className: "structure-empty-title", textContent: "Nada sonando" }),
      Object.assign(document.createElement("p"), {
        className: "structure-muted",
        textContent: "Elige una canción de tu biblioteca o de una playlist y aparecerá aquí.",
      }),
    );
    this.#empty.hidden = false;
    this.#content.hidden = true;
  }

  private static createCard(side: Side): SideCard {
    const button = Object.assign(document.createElement("button"), { type: "button", className: "sounding-card" });
    button.dataset.side = side;
    const title = Object.assign(document.createElement("span"), { className: "sounding-card-title" });
    const note = Object.assign(document.createElement("span"), { className: "sounding-card-note" });
    button.append(Object.assign(document.createElement("span"), { className: "sounding-card-label", textContent: SIDE_LABELS[side] }), title, note);
    return { button, title, note };
  }
}
