import { createIcon, createIconButton, createLabeledButton, type IconName } from "./icons";

export type NotificationTone = "info" | "success" | "error";

const DISMISS_DELAY_MS = 4000;
const MAX_TOASTS = 3;

const TONE_ICONS: Record<NotificationTone, IconName> = {
  info: "info",
  success: "check",
  error: "alert",
};

export class NotificationView {
  readonly #root: HTMLElement;
  readonly #toasts = document.createElement("div");
  readonly #progress = document.createElement("p");
  readonly #banner = document.createElement("div");
  readonly #bannerAction = createLabeledButton("folder", "Cargar carpeta", "button button-secondary");

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#toasts.className = "toast-stack";
    this.#progress.className = "progress-notice";
    this.#progress.setAttribute("role", "status");
    this.#progress.hidden = true;
    this.#root.append(this.createBanner(), this.#progress, this.#toasts);
  }

  onReconnectRequested(handler: () => void): void {
    this.#bannerAction.addEventListener("click", handler);
  }

  setReconnectBannerVisible(isVisible: boolean): void {
    this.#banner.hidden = !isVisible;
  }

  show(message: string, tone: NotificationTone = "info"): void {
    const toast = this.createToast(message, tone);
    this.#toasts.append(toast);
    while (this.#toasts.childElementCount > MAX_TOASTS) {
      this.#toasts.firstElementChild?.remove();
    }
    window.setTimeout(() => toast.remove(), DISMISS_DELAY_MS);
  }

  showProgress(message: string): void {
    this.#progress.textContent = message;
    this.#progress.hidden = false;
  }

  hideProgress(): void {
    this.#progress.hidden = true;
    this.#progress.textContent = "";
  }

  private createBanner(): HTMLElement {
    const text = Object.assign(document.createElement("p"), {
      className: "banner-text",
      textContent: "Reconecta tus archivos para escucharlos",
    });
    this.#banner.className = "banner";
    this.#banner.setAttribute("role", "status");
    this.#banner.hidden = true;
    this.#banner.append(createIcon("alert"), text, this.#bannerAction);
    return this.#banner;
  }

  private createToast(message: string, tone: NotificationTone): HTMLDivElement {
    const toast = Object.assign(document.createElement("div"), { className: `toast toast-${tone}` });
    toast.setAttribute("role", tone === "error" ? "alert" : "status");
    const icon = createIcon(TONE_ICONS[tone]);
    const text = Object.assign(document.createElement("p"), { className: "toast-text", textContent: message });
    const close = createIconButton("close", "Cerrar aviso", "icon-button toast-close");
    close.addEventListener("click", () => toast.remove());
    toast.append(icon, text, close);
    return toast;
  }
}
