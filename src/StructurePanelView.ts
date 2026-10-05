import { countLabel } from "./format";
import { createIconButton } from "./icons";
import type { Node } from "./Node";
import type { Playlist } from "./Playlist";
import type { Song } from "./Song";
import type { ListOperation } from "./types";

type Operation = ListOperation<Song>;
type PlayNodeHandler = (playlist: Playlist, node: Node<Song>) => void;

interface NodeWindow {
  start: Node<Song> | null;
  startIndex: number;
  focus: Node<Song> | null;
  limit: number;
}

interface ChainMarks {
  current: Node<Song> | null;
  changed: ReadonlySet<Node<Song>>;
}

const WINDOW_RADIUS = 15;
const HISTORY_SIZE = 6;
const DESKTOP_QUERY = "(min-width: 1100px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const NO_CHANGES: ReadonlySet<Node<Song>> = new Set();

export class StructurePanelView {
  readonly #root: HTMLElement;
  readonly #backdrop: HTMLElement;
  readonly #close = createIconButton("close", "Ocultar estructura", "icon-button structure-close");
  readonly #subtitle = Object.assign(document.createElement("p"), { className: "structure-subtitle" });
  readonly #summary = Object.assign(document.createElement("p"), { className: "structure-summary" });
  readonly #operationCode = Object.assign(document.createElement("code"), { className: "structure-code" });
  readonly #operationText = Object.assign(document.createElement("p"), { className: "structure-sentence" });
  readonly #chain = Object.assign(document.createElement("div"), { className: "structure-chain", tabIndex: 0 });
  readonly #historyList = Object.assign(document.createElement("ol"), { className: "structure-history-list" });
  readonly #announcer = Object.assign(document.createElement("p"), { className: "visually-hidden" });
  readonly #cardNodes = new WeakMap<Element, Node<Song>>();
  readonly #desktop = window.matchMedia(DESKTOP_QUERY);
  #isOpen: boolean;
  #playlist: Playlist | null = null;
  #name = "";
  #current: Node<Song> | null = null;
  #operation: Operation | null = null;
  #focusCard: HTMLElement | null = null;
  #returnFocus: HTMLElement | null = null;
  #playHandler: PlayNodeHandler = () => {};
  #visibilityHandler: (isOpen: boolean) => void = () => {};

  constructor(root: HTMLElement, backdrop: HTMLElement) {
    this.#root = root;
    this.#backdrop = backdrop;
    this.#isOpen = this.#desktop.matches;
    this.#root.append(...this.createContent());
    this.applyOpen();
    this.registerEvents();
  }

  get isOpen(): boolean {
    return this.#isOpen;
  }

  onPlayNode(handler: PlayNodeHandler): void {
    this.#playHandler = handler;
  }

  onVisibilityChange(handler: (isOpen: boolean) => void): void {
    this.#visibilityHandler = handler;
  }

  toggle(): void {
    if (this.#isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this.#isOpen) {
      return;
    }
    this.#returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.setOpen(true);
    if (this.isOverlay()) {
      this.#close.focus();
    }
  }

  close(): void {
    if (!this.#isOpen) {
      return;
    }
    const hadFocus = this.#root.contains(document.activeElement);
    this.setOpen(false);
    if (hadFocus) {
      this.#returnFocus?.focus();
    }
    this.#returnFocus = null;
  }

  render(playlist: Playlist, context: Playlist | null): void {
    const current = context === playlist ? playlist.current : null;
    const operation = playlist.lastOperation;
    if (playlist === this.#playlist && playlist.name === this.#name && current === this.#current && operation === this.#operation) {
      return;
    }
    const isNewOperation = playlist === this.#playlist && operation !== this.#operation && operation !== null;
    this.#playlist = playlist;
    this.#name = playlist.name;
    this.#current = current;
    this.#operation = operation;
    this.renderHeader(playlist);
    this.renderOperation(playlist, isNewOperation);
    this.renderChain(playlist, { current, changed: isNewOperation && this.#isOpen ? StructurePanelView.changedNodes(operation) : NO_CHANGES });
    this.scrollToFocus();
  }

  private setOpen(isOpen: boolean): void {
    this.#isOpen = isOpen;
    this.applyOpen();
    this.#visibilityHandler(isOpen);
    if (isOpen) {
      this.scrollToFocus();
    }
  }

  private applyOpen(): void {
    this.#root.classList.toggle("is-open", this.#isOpen);
    this.#backdrop.classList.toggle("is-visible", this.#isOpen);
  }

  private isOverlay(): boolean {
    return !this.#desktop.matches;
  }

  private renderHeader(playlist: Playlist): void {
    this.#subtitle.textContent = `Lista doble de «${playlist.name}»`;
    this.#subtitle.title = playlist.name;
    this.#summary.hidden = playlist.length === 0;
    const head = StructurePanelView.headOf(playlist);
    this.#summary.textContent = `length = ${playlist.length} · head = ${StructurePanelView.titleOf(head)} · tail = ${StructurePanelView.titleOf(StructurePanelView.tailOf(head))}`;
  }

  private renderOperation(playlist: Playlist, isNewOperation: boolean): void {
    const operation = playlist.lastOperation;
    this.#operationCode.hidden = operation === null;
    this.#operationCode.textContent = operation === null ? "" : StructurePanelView.codeOf(operation);
    this.#operationText.textContent = operation === null ? "Todavía no hay operaciones en esta lista" : StructurePanelView.sentenceOf(operation);
    if (isNewOperation) {
      this.#announcer.textContent = this.#operationText.textContent;
    }
    this.renderHistory(playlist.history);
  }

  private renderHistory(history: readonly Operation[]): void {
    this.#historyList.replaceChildren();
    const oldest = Math.max(history.length - HISTORY_SIZE, 0);
    for (let index = history.length - 1; index >= oldest; index--) {
      this.#historyList.append(StructurePanelView.createHistoryItem(history[index]));
    }
    if (history.length === 0) {
      this.#historyList.append(Object.assign(document.createElement("li"), { className: "structure-muted", textContent: "Sin operaciones" }));
    }
  }

  private renderChain(playlist: Playlist, marks: ChainMarks): void {
    this.#focusCard = null;
    if (playlist.length === 0) {
      this.#chain.replaceChildren(StructurePanelView.createEmptyState());
      return;
    }
    const range = StructurePanelView.windowAround(playlist, marks.current ?? StructurePanelView.headOf(playlist));
    const list = Object.assign(document.createElement("ol"), { className: "structure-nodes" });
    list.setAttribute("aria-label", "Nodos de la lista");
    const shown = this.fillChain(list, range, marks);
    const after = playlist.length - range.startIndex - shown;
    this.#chain.replaceChildren(
      ...StructurePanelView.indicator(range.startIndex, "antes"),
      list,
      ...StructurePanelView.indicator(after, "después"),
    );
  }

  private fillChain(list: HTMLOListElement, range: NodeWindow, marks: ChainMarks): number {
    let shown = 0;
    for (let node = range.start; node !== null && shown < range.limit; node = node.next) {
      const card = this.createCard(node, range.startIndex + shown, marks);
      if (node === range.focus) {
        this.#focusCard = card;
      }
      list.append(StructurePanelView.wrap(card));
      shown++;
      if (node.next !== null && shown < range.limit) {
        list.append(StructurePanelView.createConnector(marks.changed.has(node) && marks.changed.has(node.next)));
      }
    }
    return shown;
  }

  private createCard(node: Node<Song>, index: number, marks: ChainMarks): HTMLButtonElement {
    const title = node.value.title;
    const card = Object.assign(document.createElement("button"), { type: "button", className: "structure-node" });
    const current = marks.current;
    card.classList.toggle("is-current", node === current);
    card.classList.toggle("is-neighbor", current !== null && (node === current.prev || node === current.next));
    card.classList.toggle("is-changed", marks.changed.has(node));
    card.setAttribute("aria-label", `Reproducir «${title}», nodo ${index}`);
    card.append(
      StructurePanelView.createCardTitle(index, title),
      StructurePanelView.createTags(node, current),
      StructurePanelView.createLink("prev", node.prev),
      StructurePanelView.createLink("next", node.next),
    );
    this.#cardNodes.set(card, node);
    return card;
  }

  private scrollToFocus(): void {
    const card = this.#focusCard;
    const box = this.#chain;
    if (card === null || !this.#isOpen || box.clientHeight === 0) {
      return;
    }
    const isVisible = card.offsetTop >= box.scrollTop && card.offsetTop + card.offsetHeight <= box.scrollTop + box.clientHeight;
    if (isVisible) {
      return;
    }
    const top = card.offsetTop - (box.clientHeight - card.offsetHeight) / 2;
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    box.scrollTo({ top: Math.max(top, 0), behavior: reduceMotion ? "auto" : "smooth" });
  }

  private registerEvents(): void {
    this.#close.addEventListener("click", () => this.close());
    this.#backdrop.addEventListener("click", () => this.close());
    this.#chain.addEventListener("click", (event) => this.handleCardClick(event));
    document.addEventListener("keydown", (event) => this.handleEscape(event));
    this.#desktop.addEventListener("change", () => this.setOpen(this.#desktop.matches));
  }

  private handleCardClick(event: MouseEvent): void {
    const card = event.target instanceof Element ? event.target.closest(".structure-node") : null;
    const node = card === null ? undefined : this.#cardNodes.get(card);
    if (node !== undefined && this.#playlist !== null) {
      this.#playHandler(this.#playlist, node);
    }
  }

  private handleEscape(event: KeyboardEvent): void {
    const isInDialog = event.target instanceof Element && event.target.closest("dialog") !== null;
    if (event.key === "Escape" && this.#isOpen && this.isOverlay() && !event.defaultPrevented && !isInDialog) {
      event.preventDefault();
      this.close();
    }
  }

  private createContent(): HTMLElement[] {
    const handle = Object.assign(document.createElement("div"), { className: "structure-handle" });
    handle.setAttribute("aria-hidden", "true");
    this.#announcer.setAttribute("aria-live", "polite");
    this.#chain.setAttribute("aria-label", "Cadena de nodos");
    return [handle, this.createHeader(), this.#summary, this.createOperationBox(), this.#chain, this.createHistory(), this.#announcer];
  }

  private createHeader(): HTMLElement {
    const header = Object.assign(document.createElement("header"), { className: "structure-header" });
    const text = Object.assign(document.createElement("div"), { className: "structure-header-text" });
    text.append(Object.assign(document.createElement("h2"), { className: "structure-title", textContent: "Estructura" }), this.#subtitle);
    header.append(text, this.#close);
    return header;
  }

  private createOperationBox(): HTMLElement {
    const box = Object.assign(document.createElement("section"), { className: "structure-operation" });
    box.setAttribute("aria-label", "Última operación");
    box.append(StructurePanelView.createLabel("Última operación"), this.#operationCode, this.#operationText);
    return box;
  }

  private createHistory(): HTMLElement {
    const details = Object.assign(document.createElement("details"), { className: "structure-history" });
    const summary = Object.assign(document.createElement("summary"), { textContent: `Historial (últimas ${HISTORY_SIZE})` });
    details.append(summary, this.#historyList);
    return details;
  }

  private static windowAround(playlist: Playlist, focus: Node<Song> | null): NodeWindow {
    if (focus === null) {
      return { start: null, startIndex: 0, focus, limit: 0 };
    }
    let start = focus;
    let steps = 0;
    while (start.prev !== null && steps < WINDOW_RADIUS) {
      start = start.prev;
      steps++;
    }
    const focusIndex = playlist.positionOf(focus) - 1;
    return { start, startIndex: focusIndex - steps, focus, limit: steps + 1 + WINDOW_RADIUS };
  }

  private static headOf(playlist: Playlist): Node<Song> | null {
    for (const node of playlist.nodes()) {
      return node;
    }
    return null;
  }

  private static tailOf(head: Node<Song> | null): Node<Song> | null {
    let node = head;
    while (node !== null && node.next !== null) {
      node = node.next;
    }
    return node;
  }

  private static changedNodes(operation: Operation | null): ReadonlySet<Node<Song>> {
    const nodes = [operation?.previousNode, operation?.node, operation?.nextNode];
    return new Set(nodes.filter((node): node is Node<Song> => node !== null && node !== undefined));
  }

  private static codeOf(operation: Operation): string {
    const takesIndex = operation.type === "insert" || operation.type === "remove";
    return takesIndex ? `${operation.type}(${operation.index ?? ""})` : `${operation.type}()`;
  }

  private static sentenceOf(operation: Operation): string {
    if (operation.type === "clear") {
      return "Se vaciaron todos los nodos: head y tail ahora son null";
    }
    if (operation.type === "remove" || operation.type === "removeNode") {
      return StructurePanelView.removalSentence(operation);
    }
    return StructurePanelView.insertionSentence(operation);
  }

  private static insertionSentence(operation: Operation): string {
    const verb = operation.type === "insert" ? "Se insertó" : "Se agregó";
    const value = `«${operation.valueLabel ?? ""}»`;
    if (operation.previousLabel === null && operation.nextLabel === null) {
      return `${verb} ${value} en la lista vacía: ahora es head y tail`;
    }
    if (operation.previousLabel === null) {
      return `${verb} ${value} al inicio (head)`;
    }
    if (operation.nextLabel === null) {
      return `${verb} ${value} al final (tail)`;
    }
    return `${verb} ${value} entre «${operation.previousLabel}» y «${operation.nextLabel}»`;
  }

  private static removalSentence(operation: Operation): string {
    const value = `«${operation.valueLabel ?? ""}»`;
    if (operation.previousLabel === null && operation.nextLabel === null) {
      return `Se quitó ${value}, el único nodo: la lista quedó vacía`;
    }
    if (operation.previousLabel === null) {
      return `Se quitó ${value} del inicio: «${operation.nextLabel}» es el nuevo head`;
    }
    if (operation.nextLabel === null) {
      return `Se quitó ${value} del final: «${operation.previousLabel}» es el nuevo tail`;
    }
    return `Se quitó un nodo: «${operation.previousLabel}» y «${operation.nextLabel}» ahora se enlazan`;
  }

  private static titleOf(node: Node<Song> | null): string {
    return node === null ? "null" : node.value.title;
  }

  private static createCardTitle(index: number, title: string): HTMLSpanElement {
    const line = Object.assign(document.createElement("span"), { className: "structure-node-head" });
    line.append(
      Object.assign(document.createElement("span"), { className: "structure-index", textContent: `[${index}]` }),
      Object.assign(document.createElement("span"), { className: "structure-node-title", textContent: title, title }),
    );
    return line;
  }

  private static createTags(node: Node<Song>, current: Node<Song> | null): HTMLSpanElement {
    const tags = Object.assign(document.createElement("span"), { className: "structure-tags" });
    const names = [node.prev === null ? "head" : "", node.next === null ? "tail" : "", node === current ? "current" : ""];
    for (const name of names.filter((tag) => tag !== "")) {
      tags.append(Object.assign(document.createElement("span"), { className: `structure-tag structure-tag-${name}`, textContent: name }));
    }
    tags.hidden = tags.childElementCount === 0;
    return tags;
  }

  private static createLink(name: "prev" | "next", target: Node<Song> | null): HTMLSpanElement {
    const line = Object.assign(document.createElement("span"), { className: "structure-link" });
    const value = Object.assign(document.createElement("span"), { className: "structure-link-value", textContent: StructurePanelView.titleOf(target) });
    value.classList.toggle("is-null", target === null);
    line.append(`${name}: `, value);
    return line;
  }

  private static createConnector(isChanged: boolean): HTMLLIElement {
    const connector = Object.assign(document.createElement("li"), { className: "structure-connector" });
    connector.classList.toggle("is-changed", isChanged);
    connector.setAttribute("aria-hidden", "true");
    connector.append(
      Object.assign(document.createElement("span"), { className: "structure-arrow", textContent: "next ↓" }),
      Object.assign(document.createElement("span"), { className: "structure-arrow", textContent: "↑ prev" }),
    );
    return connector;
  }

  private static indicator(count: number, side: "antes" | "después"): HTMLElement[] {
    if (count <= 0) {
      return [];
    }
    return [Object.assign(document.createElement("p"), { className: "structure-more", textContent: `… ${countLabel(count, "nodo", "nodos")} ${side}` })];
  }

  private static createEmptyState(): HTMLElement {
    const empty = Object.assign(document.createElement("div"), { className: "structure-empty" });
    empty.append(
      Object.assign(document.createElement("p"), { className: "structure-empty-title", textContent: "Lista vacía · head = null · tail = null" }),
      Object.assign(document.createElement("p"), {
        className: "structure-muted",
        textContent: "Cuando agregues canciones, cada una aparecerá aquí como un nodo enlazado con next y prev.",
      }),
    );
    return empty;
  }

  private static createHistoryItem(operation: Operation): HTMLLIElement {
    const item = Object.assign(document.createElement("li"), { className: "structure-history-item" });
    const code = Object.assign(document.createElement("code"), { textContent: StructurePanelView.codeOf(operation) });
    item.append(code);
    if (operation.valueLabel !== null) {
      item.append(Object.assign(document.createElement("span"), { className: "structure-muted", textContent: operation.valueLabel }));
    }
    return item;
  }

  private static createLabel(text: string): HTMLParagraphElement {
    return Object.assign(document.createElement("p"), { className: "structure-label", textContent: text });
  }

  private static wrap(card: HTMLElement): HTMLLIElement {
    const item = Object.assign(document.createElement("li"), { className: "structure-item" });
    item.append(card);
    return item;
  }
}
