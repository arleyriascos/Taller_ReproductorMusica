export type SplitterSide = "left" | "right";

export interface SplitterConfig {
  label: string;
  side: SplitterSide;
}

const STEP = 16;
const LARGE_STEP = 64;

export class PanelSplitterView {
  readonly element = Object.assign(document.createElement("div"), { className: "splitter", tabIndex: 0 });
  readonly #host: HTMLElement;
  readonly #side: SplitterSide;
  #width = 0;
  #pointerId: number | null = null;
  #resizeHandler: (width: number) => void = () => {};
  #commitHandler: () => void = () => {};
  #resetHandler: () => void = () => {};

  constructor(host: HTMLElement, config: SplitterConfig) {
    this.#host = host;
    this.#side = config.side;
    this.element.classList.add(`splitter-${config.side}`);
    this.element.setAttribute("role", "separator");
    this.element.setAttribute("aria-orientation", "vertical");
    this.element.setAttribute("aria-label", config.label);
    this.registerEvents();
  }

  onResize(handler: (width: number) => void): void {
    this.#resizeHandler = handler;
  }

  onCommit(handler: () => void): void {
    this.#commitHandler = handler;
  }

  onReset(handler: () => void): void {
    this.#resetHandler = handler;
  }

  setHidden(isHidden: boolean): void {
    this.element.hidden = isHidden;
  }

  setRange(width: number, min: number, max: number): void {
    this.#width = width;
    this.element.setAttribute("aria-valuenow", String(width));
    this.element.setAttribute("aria-valuemin", String(min));
    this.element.setAttribute("aria-valuemax", String(max));
  }

  private registerEvents(): void {
    this.element.addEventListener("pointerdown", (event) => this.startDrag(event));
    this.element.addEventListener("pointermove", (event) => this.drag(event));
    this.element.addEventListener("pointerup", () => this.endDrag(true));
    this.element.addEventListener("pointercancel", () => this.endDrag(false));
    this.element.addEventListener("lostpointercapture", () => this.endDrag(false));
    this.element.addEventListener("keydown", (event) => this.handleKey(event));
    this.element.addEventListener("dblclick", () => this.reset());
  }

  private startDrag(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.#pointerId = event.pointerId;
    this.element.setPointerCapture(event.pointerId);
    this.element.classList.add("is-dragging");
    document.body.classList.add("is-panel-resizing");
  }

  private drag(event: PointerEvent): void {
    if (this.#pointerId === event.pointerId) {
      this.#resizeHandler(this.widthAt(event.clientX));
    }
  }

  private endDrag(shouldCommit: boolean): void {
    const pointerId = this.#pointerId;
    if (pointerId === null) {
      return;
    }
    this.#pointerId = null;
    this.element.classList.remove("is-dragging");
    document.body.classList.remove("is-panel-resizing");
    if (this.element.hasPointerCapture(pointerId)) {
      this.element.releasePointerCapture(pointerId);
    }
    if (shouldCommit) {
      this.#commitHandler();
    }
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === "Home") {
      event.preventDefault();
      this.reset();
      return;
    }
    const direction = PanelSplitterView.directionOf(event.key);
    if (direction !== 0) {
      event.preventDefault();
      const growth = this.#side === "left" ? direction : -direction;
      this.#resizeHandler(this.#width + growth * (event.shiftKey ? LARGE_STEP : STEP));
      this.#commitHandler();
    }
  }

  private reset(): void {
    this.#resetHandler();
    this.#commitHandler();
  }

  private widthAt(clientX: number): number {
    const box = this.#host.getBoundingClientRect();
    return this.#side === "left" ? clientX - box.left : box.right - clientX;
  }

  private static directionOf(key: string): number {
    if (key === "ArrowRight") {
      return 1;
    }
    return key === "ArrowLeft" ? -1 : 0;
  }
}
