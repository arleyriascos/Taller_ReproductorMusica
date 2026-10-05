import { clampPanelWidths, DEFAULT_PANEL_WIDTHS, PANEL_LIMITS } from "./format";
import { PanelSplitterView } from "./PanelSplitterView";
import type { PanelName, PanelWidths } from "./types";

const DESKTOP_QUERY = "(min-width: 1100px)";
const WIDTH_PROPERTIES: Record<PanelName, string> = { sidebar: "--sidebar-width", right: "--structure-width" };
const OTHER_PANEL: Record<PanelName, PanelName> = { sidebar: "right", right: "sidebar" };

export class PanelLayoutView {
  readonly #shell: HTMLElement;
  readonly #desktop = window.matchMedia(DESKTOP_QUERY);
  readonly #splitters: Record<PanelName, PanelSplitterView>;
  #widths: PanelWidths = { ...DEFAULT_PANEL_WIDTHS };
  #commitHandler: () => void = () => {};

  constructor(shell: HTMLElement) {
    this.#shell = shell;
    this.#splitters = {
      sidebar: new PanelSplitterView(shell, { label: "Cambiar ancho de la barra lateral", side: "left" }),
      right: new PanelSplitterView(shell, { label: "Cambiar ancho del panel derecho", side: "right" }),
    };
    this.#splitters.right.setHidden(true);
    this.bindSplitter("sidebar");
    this.bindSplitter("right");
    shell.append(this.#splitters.sidebar.element, this.#splitters.right.element);
    window.addEventListener("resize", () => this.apply());
    this.#desktop.addEventListener("change", () => this.apply());
    this.apply();
  }

  get widths(): PanelWidths {
    return { ...this.#widths };
  }

  onCommit(handler: () => void): void {
    this.#commitHandler = handler;
  }

  restore(widths: PanelWidths): void {
    this.#widths = { ...widths };
    this.apply();
  }

  setRightOpen(isOpen: boolean): void {
    this.#splitters.right.setHidden(!isOpen);
  }

  private bindSplitter(panel: PanelName): void {
    const splitter = this.#splitters[panel];
    splitter.onResize((width) => this.resize(panel, width));
    splitter.onReset(() => this.resize(panel, DEFAULT_PANEL_WIDTHS[panel]));
    splitter.onCommit(() => this.#commitHandler());
  }

  private resize(panel: PanelName, width: number): void {
    this.#widths = clampPanelWidths({ ...this.#widths, [panel]: width }, this.availableWidth(), OTHER_PANEL[panel]);
    this.apply();
  }

  private apply(): void {
    const root = document.documentElement;
    if (!this.#desktop.matches) {
      Object.values(WIDTH_PROPERTIES).forEach((property) => root.style.removeProperty(property));
      return;
    }
    this.#widths = clampPanelWidths(this.#widths, this.availableWidth());
    for (const panel of ["sidebar", "right"] as const) {
      root.style.setProperty(WIDTH_PROPERTIES[panel], `${this.#widths[panel]}px`);
      this.#splitters[panel].setRange(this.#widths[panel], PANEL_LIMITS[panel].min, this.maxWidth(panel));
    }
  }

  private maxWidth(panel: PanelName): number {
    const widest = { ...this.#widths, [panel]: PANEL_LIMITS[panel].max };
    return clampPanelWidths(widest, this.availableWidth(), OTHER_PANEL[panel])[panel];
  }

  private availableWidth(): number {
    return this.#shell.clientWidth;
  }
}
