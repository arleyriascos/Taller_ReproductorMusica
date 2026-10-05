import type { Node } from "./Node";
import type { Song } from "./Song";

type NodeResolver = (row: Element) => Node<Song> | undefined;

export class DropIndicator {
  readonly #root: HTMLElement;
  readonly #nodeOf: NodeResolver;
  readonly #line = Object.assign(document.createElement("li"), { className: "drop-indicator", hidden: true });

  constructor(root: HTMLElement, nodeOf: NodeResolver) {
    this.#root = root;
    this.#nodeOf = nodeOf;
    this.#line.setAttribute("aria-hidden", "true");
  }

  locate(clientY: number): Node<Song> | null {
    const list = this.#root.querySelector<HTMLElement>(".track-list");
    if (list === null) {
      this.hide();
      return null;
    }
    const rows = DropIndicator.visibleRows(list);
    const following = rows.find((row) => clientY < DropIndicator.middleOf(row)) ?? null;
    this.place(list, following, rows[rows.length - 1] ?? null);
    return following === null ? null : (this.#nodeOf(following) ?? null);
  }

  hide(): void {
    this.#line.hidden = true;
    this.#line.remove();
  }

  private place(list: HTMLElement, following: HTMLElement | null, last: HTMLElement | null): void {
    if (last === null) {
      this.hide();
      return;
    }
    const top = following === null ? last.offsetTop + last.offsetHeight : following.offsetTop;
    this.#line.style.top = `${top - 1}px`;
    this.#line.hidden = false;
    list.append(this.#line);
  }

  private static visibleRows(list: HTMLElement): HTMLElement[] {
    return Array.from(list.querySelectorAll<HTMLElement>(":scope > .track-row")).filter((row) => !row.hidden);
  }

  private static middleOf(row: HTMLElement): number {
    const box = row.getBoundingClientRect();
    return box.top + box.height / 2;
  }
}
