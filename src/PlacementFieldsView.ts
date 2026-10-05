import type { SongPlacement } from "./types";

type ChangeHandler = () => void;

const OPTIONS: readonly (readonly [SongPlacement["kind"], string])[] = [
  ["start", "Inicio"],
  ["end", "Final"],
  ["position", "Posición"],
];

export class PlacementFieldsView {
  readonly element = Object.assign(document.createElement("div"), { className: "placement-fields" });
  readonly #group = PlacementFieldsView.createGroup();
  readonly #input = Object.assign(document.createElement("input"), {
    type: "number",
    className: "text-input",
    min: "1",
    step: "1",
    inputMode: "numeric",
  });
  readonly #hint = Object.assign(document.createElement("span"), { className: "field-hint" });
  readonly #field = Object.assign(document.createElement("label"), { className: "field" });
  #maxPosition = 1;
  #changeHandler: ChangeHandler = () => {};

  constructor() {
    this.#field.append(
      Object.assign(document.createElement("span"), { className: "field-label", textContent: "Número de posición" }),
      this.#input,
      this.#hint,
    );
    this.element.append(this.#group, this.#field);
    this.#group.addEventListener("change", () => this.refresh());
    this.#input.addEventListener("input", () => this.#changeHandler());
  }

  onChange(handler: ChangeHandler): void {
    this.#changeHandler = handler;
  }

  setMaxPosition(maxPosition: number): void {
    this.#maxPosition = maxPosition;
    this.#input.max = String(maxPosition);
    this.#hint.textContent = `Entre 1 y ${maxPosition}`;
  }

  reset(): void {
    this.#input.value = "";
    this.select("end");
  }

  read(): SongPlacement | string {
    const kind = this.checkedKind();
    if (kind !== "position") {
      return { kind };
    }
    const position = Number(this.#input.value);
    if (this.#input.value.trim() === "" || !Number.isInteger(position) || position < 1 || position > this.#maxPosition) {
      return `Escribe un número entre 1 y ${this.#maxPosition}`;
    }
    return { kind, position };
  }

  private select(kind: SongPlacement["kind"]): void {
    const radio = this.#group.querySelector<HTMLInputElement>(`input[value="${kind}"]`);
    if (radio !== null) {
      radio.checked = true;
    }
    this.refresh();
  }

  private refresh(): void {
    this.#field.hidden = this.checkedKind() !== "position";
    this.#changeHandler();
  }

  private checkedKind(): SongPlacement["kind"] {
    const value = this.#group.querySelector<HTMLInputElement>("input:checked")?.value;
    return value === "start" || value === "position" ? value : "end";
  }

  private static createGroup(): HTMLFieldSetElement {
    const group = Object.assign(document.createElement("fieldset"), { className: "placement-group" });
    group.append(Object.assign(document.createElement("legend"), { className: "field-label", textContent: "¿En qué posición?" }));
    for (const [value, text] of OPTIONS) {
      const label = Object.assign(document.createElement("label"), { className: "placement-option" });
      const radio = Object.assign(document.createElement("input"), { type: "radio", name: "placement", value });
      label.append(radio, Object.assign(document.createElement("span"), { textContent: text }));
      group.append(label);
    }
    return group;
  }
}
