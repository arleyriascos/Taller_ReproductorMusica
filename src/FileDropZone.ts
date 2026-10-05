import { hasDroppedFiles, readDroppedFiles } from "./droppedFiles";
import type { DropIndicator } from "./DropIndicator";
import type { Node } from "./Node";
import type { Song } from "./Song";

export interface FileDropHandlers {
  isEnabled: () => boolean;
  positionBefore: (before: Node<Song> | null) => number;
  onDrop: (files: File[], position: number) => void;
}

const OVERLAY_TEXT = "Suelta para agregar";

export class FileDropZone {
  readonly #root: HTMLElement;
  readonly #indicator: DropIndicator;
  readonly #handlers: FileDropHandlers;
  readonly #overlay = Object.assign(document.createElement("div"), { className: "drop-overlay", hidden: true });
  #depth = 0;

  constructor(root: HTMLElement, indicator: DropIndicator, handlers: FileDropHandlers) {
    this.#root = root;
    this.#indicator = indicator;
    this.#handlers = handlers;
    this.#overlay.append(Object.assign(document.createElement("p"), { className: "drop-overlay-text", textContent: OVERLAY_TEXT }));
    this.#overlay.setAttribute("aria-hidden", "true");
    document.body.append(this.#overlay);
    this.registerEvents();
  }

  private registerEvents(): void {
    document.addEventListener("dragover", (event) => FileDropZone.keepBrowserFromOpening(event));
    document.addEventListener("drop", (event) => FileDropZone.keepBrowserFromOpening(event));
    this.#root.addEventListener("dragenter", (event) => this.handleEnter(event));
    this.#root.addEventListener("dragover", (event) => this.handleOver(event));
    this.#root.addEventListener("dragleave", (event) => this.handleLeave(event));
    this.#root.addEventListener("drop", (event) => this.handleDrop(event));
  }

  private accepts(event: DragEvent): boolean {
    return hasDroppedFiles(event.dataTransfer) && this.#handlers.isEnabled();
  }

  private handleEnter(event: DragEvent): void {
    if (this.accepts(event)) {
      this.#depth++;
      this.showOverlay();
    }
  }

  private handleOver(event: DragEvent): void {
    if (!this.accepts(event)) {
      return;
    }
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = "copy";
    }
    this.#indicator.locate(event.clientY);
  }

  private handleLeave(event: DragEvent): void {
    if (this.accepts(event)) {
      this.#depth = Math.max(this.#depth - 1, 0);
      if (this.#depth === 0) {
        this.reset();
      }
    }
  }

  private handleDrop(event: DragEvent): void {
    const transfer = event.dataTransfer;
    if (transfer === null || !this.accepts(event)) {
      this.reset();
      return;
    }
    const position = this.#handlers.positionBefore(this.#indicator.locate(event.clientY));
    const files = readDroppedFiles(transfer);
    this.reset();
    void files.then((list) => this.#handlers.onDrop(list, position));
  }

  private showOverlay(): void {
    const box = this.#root.getBoundingClientRect();
    Object.assign(this.#overlay.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    this.#overlay.hidden = false;
  }

  private reset(): void {
    this.#depth = 0;
    this.#overlay.hidden = true;
    this.#indicator.hide();
  }

  private static keepBrowserFromOpening(event: DragEvent): void {
    if (hasDroppedFiles(event.dataTransfer)) {
      event.preventDefault();
    }
  }
}
