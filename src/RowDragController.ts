import type { DropIndicator } from "./DropIndicator";
import type { Node } from "./Node";
import type { Song } from "./Song";

export interface RowDragHandlers {
  isEnabled: () => boolean;
  nodeOf: (row: Element) => Node<Song> | undefined;
  onReorder: (node: Node<Song>, before: Node<Song> | null) => void;
  onDropOnPlaylist: (playlistId: string, node: Node<Song>) => void;
}

interface PendingDrag {
  pointerId: number;
  handle: HTMLElement;
  row: HTMLElement;
  node: Node<Song>;
  startX: number;
  startY: number;
  timer: number | null;
}

interface ActiveDrag {
  pointerId: number;
  handle: HTMLElement;
  row: HTMLElement;
  node: Node<Song>;
  preview: HTMLElement;
  offsetY: number;
  x: number;
  y: number;
  before: Node<Song> | null;
  hasTarget: boolean;
  playlistId: string | null;
  scrollFrame: number | null;
}

const LONG_PRESS_MILLISECONDS = 300;
const MOUSE_THRESHOLD = 4;
const TOUCH_TOLERANCE = 10;
const EDGE_SIZE = 64;
const MAX_SCROLL_SPEED = 18;

export class RowDragController {
  readonly #root: HTMLElement;
  readonly #indicator: DropIndicator;
  readonly #handlers: RowDragHandlers;
  readonly #escapeListener = (event: KeyboardEvent): void => this.handleEscape(event);
  #pending: PendingDrag | null = null;
  #active: ActiveDrag | null = null;

  constructor(root: HTMLElement, indicator: DropIndicator, handlers: RowDragHandlers) {
    this.#root = root;
    this.#indicator = indicator;
    this.#handlers = handlers;
    root.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    root.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    root.addEventListener("pointerup", () => this.handlePointerUp());
    root.addEventListener("pointercancel", () => this.cancel());
    root.addEventListener("lostpointercapture", () => this.cancel());
  }

  cancel(): void {
    this.cancelPending();
    const drag = this.#active;
    if (drag !== null) {
      this.end(drag);
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-drag-handle]") : null;
    const isPrimary = event.pointerType !== "mouse" || event.button === 0;
    if (handle === null || !isPrimary || this.#pending !== null || this.#active !== null || !this.#handlers.isEnabled()) {
      return;
    }
    const row = handle.closest<HTMLElement>(".track-row");
    const node = row === null ? undefined : this.#handlers.nodeOf(row);
    if (row === null || node === undefined) {
      return;
    }
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const pending: PendingDrag = { pointerId: event.pointerId, handle, row, node, startX: event.clientX, startY: event.clientY, timer: null };
    if (event.pointerType !== "mouse") {
      pending.timer = window.setTimeout(() => this.begin(), LONG_PRESS_MILLISECONDS);
    }
    this.#pending = pending;
  }

  private handlePointerMove(event: PointerEvent): void {
    const active = this.#active;
    if (active !== null && event.pointerId === active.pointerId) {
      this.update(active, event.clientX, event.clientY);
      return;
    }
    const pending = this.#pending;
    if (pending === null || event.pointerId !== pending.pointerId) {
      return;
    }
    const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
    if (pending.timer === null && distance > MOUSE_THRESHOLD) {
      this.begin(event.clientX, event.clientY);
    } else if (pending.timer !== null && distance > TOUCH_TOLERANCE) {
      this.cancelPending();
    }
  }

  private handlePointerUp(): void {
    const drag = this.#active;
    if (drag === null) {
      this.cancelPending();
      return;
    }
    this.end(drag);
    if (drag.playlistId !== null) {
      this.#handlers.onDropOnPlaylist(drag.playlistId, drag.node);
    } else if (drag.hasTarget) {
      this.#handlers.onReorder(drag.node, drag.before);
    }
  }

  private handleEscape(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    }
  }

  private begin(x?: number, y?: number): void {
    const pending = this.#pending;
    if (pending === null) {
      return;
    }
    this.clearTimer(pending);
    this.#pending = null;
    const box = pending.row.getBoundingClientRect();
    const startX = x ?? pending.startX;
    const startY = y ?? pending.startY;
    const drag: ActiveDrag = {
      pointerId: pending.pointerId,
      handle: pending.handle,
      row: pending.row,
      node: pending.node,
      preview: RowDragController.createPreview(pending.row, box),
      offsetY: startY - box.top,
      x: startX,
      y: startY,
      before: null,
      hasTarget: false,
      playlistId: null,
      scrollFrame: null,
    };
    this.#active = drag;
    drag.row.classList.add("is-dragging");
    document.body.classList.add("is-row-dragging");
    document.body.append(drag.preview);
    document.addEventListener("keydown", this.#escapeListener, true);
    this.update(drag, startX, startY);
  }

  private update(drag: ActiveDrag, x: number, y: number): void {
    drag.x = x;
    drag.y = y;
    drag.preview.style.transform = `translateY(${y - drag.offsetY}px)`;
    this.refreshTarget(drag);
    this.scheduleScroll(drag);
  }

  private refreshTarget(drag: ActiveDrag): void {
    RowDragController.clearHighlight();
    const zone = document.elementFromPoint(drag.x, drag.y)?.closest<HTMLElement>("[data-drop-playlist]") ?? null;
    drag.playlistId = zone?.dataset.dropPlaylist ?? null;
    zone?.classList.add("is-drop-target");
    drag.hasTarget = zone === null && this.isInsideRoot(drag.x, drag.y);
    if (drag.hasTarget) {
      drag.before = this.#indicator.locate(drag.y);
    } else {
      this.#indicator.hide();
    }
  }

  private isInsideRoot(x: number, y: number): boolean {
    const box = this.#root.getBoundingClientRect();
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }

  private scrollSpeed(drag: ActiveDrag): number {
    const box = this.#root.getBoundingClientRect();
    if (drag.y < box.top + EDGE_SIZE) {
      return -RowDragController.speedFor(box.top + EDGE_SIZE - drag.y);
    }
    return drag.y > box.bottom - EDGE_SIZE ? RowDragController.speedFor(drag.y - (box.bottom - EDGE_SIZE)) : 0;
  }

  private scheduleScroll(drag: ActiveDrag): void {
    if (drag.scrollFrame !== null || this.scrollSpeed(drag) === 0) {
      return;
    }
    drag.scrollFrame = requestAnimationFrame(() => {
      drag.scrollFrame = null;
      this.#root.scrollTop += this.scrollSpeed(drag);
      this.refreshTarget(drag);
      this.scheduleScroll(drag);
    });
  }

  private end(drag: ActiveDrag): void {
    if (drag.scrollFrame !== null) {
      cancelAnimationFrame(drag.scrollFrame);
    }
    this.#active = null;
    drag.preview.remove();
    drag.row.classList.remove("is-dragging");
    document.body.classList.remove("is-row-dragging");
    document.removeEventListener("keydown", this.#escapeListener, true);
    this.#indicator.hide();
    RowDragController.clearHighlight();
    RowDragController.release(drag.handle, drag.pointerId);
  }

  private cancelPending(): void {
    const pending = this.#pending;
    if (pending !== null) {
      this.clearTimer(pending);
      this.#pending = null;
      RowDragController.release(pending.handle, pending.pointerId);
    }
  }

  private clearTimer(pending: PendingDrag): void {
    if (pending.timer !== null) {
      window.clearTimeout(pending.timer);
      pending.timer = null;
    }
  }

  private static release(handle: HTMLElement, pointerId: number): void {
    if (handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
  }

  private static speedFor(depth: number): number {
    return Math.min(depth / EDGE_SIZE, 1) * MAX_SCROLL_SPEED;
  }

  private static clearHighlight(): void {
    for (const zone of document.querySelectorAll(".is-drop-target")) {
      zone.classList.remove("is-drop-target");
    }
  }

  private static createPreview(row: HTMLElement, box: DOMRect): HTMLElement {
    const preview = Object.assign(document.createElement("div"), { className: "track-row drag-preview" });
    preview.append(...Array.from(row.children, (child) => child.cloneNode(true)));
    preview.style.left = `${box.left}px`;
    preview.style.width = `${box.width}px`;
    preview.setAttribute("aria-hidden", "true");
    preview.inert = true;
    return preview;
  }
}
