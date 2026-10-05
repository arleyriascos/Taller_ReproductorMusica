import type { PlaylistNameIssue } from "./types";

export type DialogTone = "default" | "danger";

type ConfirmHandler = () => string | null;

const NAME_ISSUE_MESSAGES: Record<PlaylistNameIssue, string> = {
  empty: "Escribe un nombre",
  "too-long": "Máximo 40 caracteres",
  duplicate: "Ya tienes una playlist con ese nombre",
};

export class DialogView {
  readonly #dialog = document.createElement("dialog");
  readonly #form = document.createElement("form");
  readonly #body = document.createElement("div");
  readonly #error = document.createElement("p");
  #confirmHandler: ConfirmHandler = () => null;

  constructor(host: HTMLElement, title: string, confirmLabel: string, tone: DialogTone = "default") {
    this.#dialog.className = "dialog";
    this.#form.className = "dialog-form";
    this.#form.noValidate = true;
    this.#body.className = "dialog-body";
    this.#error.className = "dialog-error";
    this.#error.setAttribute("role", "alert");
    const heading = Object.assign(document.createElement("h2"), { className: "dialog-title", textContent: title });
    this.#form.append(heading, this.#body, this.#error, this.createActions(confirmLabel, tone));
    this.#dialog.append(this.#form);
    this.#dialog.setAttribute("aria-label", title);
    host.append(this.#dialog);
    this.registerEvents();
  }

  static nameIssueMessage(issue: PlaylistNameIssue | null): string | null {
    return issue === null ? null : NAME_ISSUE_MESSAGES[issue];
  }

  get body(): HTMLDivElement {
    return this.#body;
  }

  onConfirm(handler: ConfirmHandler): void {
    this.#confirmHandler = handler;
  }

  onClose(handler: () => void): void {
    this.#dialog.addEventListener("close", handler);
  }

  addField(labelText: string, control: HTMLElement): HTMLLabelElement {
    const label = Object.assign(document.createElement("label"), { className: "field" });
    const caption = Object.assign(document.createElement("span"), { className: "field-label", textContent: labelText });
    label.append(caption, control);
    this.#body.append(label);
    return label;
  }

  addNameField(): HTMLInputElement {
    const input = Object.assign(document.createElement("input"), {
      type: "text",
      className: "text-input",
      autocomplete: "off",
      spellcheck: false,
    });
    this.addField("Nombre", input);
    return input;
  }

  open(focusTarget?: HTMLElement): void {
    this.clearError();
    this.#dialog.showModal();
    focusTarget?.focus();
  }

  close(): void {
    this.#dialog.close();
  }

  showError(message: string): void {
    this.#error.textContent = message;
  }

  clearError(): void {
    this.#error.textContent = "";
  }

  private createActions(confirmLabel: string, tone: DialogTone): HTMLDivElement {
    const actions = Object.assign(document.createElement("div"), { className: "dialog-actions" });
    const cancel = Object.assign(document.createElement("button"), {
      type: "button",
      className: "button button-ghost",
      textContent: "Cancelar",
    });
    const confirm = Object.assign(document.createElement("button"), {
      type: "submit",
      className: tone === "danger" ? "button button-danger" : "button button-primary",
      textContent: confirmLabel,
    });
    cancel.addEventListener("click", () => this.close());
    actions.append(cancel, confirm);
    return actions;
  }

  private registerEvents(): void {
    this.#form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submit();
    });
    this.#dialog.addEventListener("click", (event) => {
      if (event.target === this.#dialog) {
        this.close();
      }
    });
  }

  private submit(): void {
    const error = this.#confirmHandler();
    if (error === null) {
      this.close();
    } else {
      this.showError(error);
    }
  }
}
