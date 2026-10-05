import { DialogView } from "./DialogView";
import { SHORTCUT_HELP } from "./KeyboardShortcuts";

export class ShortcutsDialogView {
  readonly #dialog = new DialogView(document.body, "Atajos de teclado", "Cerrar", "default", false);

  constructor() {
    const list = Object.assign(document.createElement("ul"), { className: "shortcut-list" });
    for (const shortcut of SHORTCUT_HELP) {
      const item = document.createElement("li");
      item.className = "shortcut-item";
      item.append(
        Object.assign(document.createElement("kbd"), { className: "shortcut-keys", textContent: shortcut.keys }),
        Object.assign(document.createElement("span"), { textContent: shortcut.description }),
      );
      list.append(item);
    }
    this.#dialog.body.append(list);
    this.#dialog.onConfirm(() => null);
  }

  open(): void {
    this.#dialog.open();
  }
}
