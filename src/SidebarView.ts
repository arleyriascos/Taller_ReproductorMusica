import { DialogView } from "./DialogView";
import { createIcon, createIconButton, createLabeledButton, type IconName } from "./icons";
import type { Playlist } from "./Playlist";
import type { PlaylistNameIssue } from "./types";

export type LoadKind = "files" | "folder";

export interface SidebarData {
  library: Playlist;
  playlists: readonly Playlist[];
  visibleId: string;
}

type SelectHandler = (playlistId: string) => void;
type CreateHandler = (name: string) => PlaylistNameIssue | null;
type FilesHandler = (files: File[]) => void;

export class SidebarView {
  readonly #root: HTMLElement;
  readonly #backdrop: HTMLElement;
  readonly #menuButton = createIconButton("menu", "Abrir menú", "icon-button top-bar-menu");
  readonly #closeButton = createIconButton("close", "Cerrar menú", "icon-button sidebar-close");
  readonly #libraryList = Object.assign(document.createElement("ul"), { className: "nav-list" });
  readonly #playlistList = Object.assign(document.createElement("ul"), { className: "nav-list" });
  readonly #fileInputs: Record<LoadKind, HTMLInputElement>;
  readonly #loadButtons: HTMLButtonElement[] = [];
  readonly #createDialog = new DialogView(document.body, "Nueva playlist", "Crear");
  readonly #nameInput = this.#createDialog.addNameField();
  #selectHandler: SelectHandler = () => {};
  #createHandler: CreateHandler = () => null;
  #filesHandler: FilesHandler = () => {};

  constructor(root: HTMLElement, topBar: HTMLElement, backdrop: HTMLElement) {
    this.#root = root;
    this.#backdrop = backdrop;
    this.#fileInputs = { files: SidebarView.createFileInput("files"), folder: SidebarView.createFileInput("folder") };
    this.buildTopBar(topBar);
    this.#root.append(this.createHeader(), this.createNavigation(), this.createLoadSection());
    this.#createDialog.onConfirm(() => DialogView.nameIssueMessage(this.#createHandler(this.#nameInput.value)));
    this.registerEvents();
  }

  onPlaylistSelected(handler: SelectHandler): void {
    this.#selectHandler = handler;
  }

  onCreatePlaylist(handler: CreateHandler): void {
    this.#createHandler = handler;
  }

  onFilesChosen(handler: FilesHandler): void {
    this.#filesHandler = handler;
  }

  render(data: SidebarData): void {
    this.#libraryList.replaceChildren(SidebarView.createItem(data.library, "library", data.visibleId));
    this.#playlistList.replaceChildren();
    for (const playlist of data.playlists) {
      this.#playlistList.append(SidebarView.createItem(playlist, "playlist", data.visibleId));
    }
    if (data.playlists.length === 0) {
      this.#playlistList.append(
        Object.assign(document.createElement("li"), { className: "nav-empty", textContent: "Aún no tienes playlists" }),
      );
    }
  }

  setPlayback(contextId: string | null, isPlaying: boolean): void {
    for (const item of this.#root.querySelectorAll<HTMLElement>("[data-playlist-id]")) {
      const isContext = item.dataset.playlistId === contextId;
      item.classList.toggle("is-context", isContext);
      item.classList.toggle("is-playing", isContext && isPlaying);
    }
  }

  setLoading(isLoading: boolean): void {
    this.#root.setAttribute("aria-busy", String(isLoading));
    for (const button of this.#loadButtons) {
      button.disabled = isLoading;
    }
  }

  openPicker(kind: LoadKind): void {
    this.#fileInputs[kind].click();
  }

  private buildTopBar(topBar: HTMLElement): void {
    this.#menuButton.setAttribute("aria-controls", this.#root.id);
    this.#menuButton.setAttribute("aria-expanded", "false");
    topBar.append(this.#menuButton, SidebarView.createBrand());
  }

  private createHeader(): HTMLDivElement {
    const header = Object.assign(document.createElement("div"), { className: "sidebar-header" });
    header.append(SidebarView.createBrand(), this.#closeButton);
    return header;
  }

  private createNavigation(): HTMLElement {
    const nav = Object.assign(document.createElement("nav"), { className: "sidebar-nav" });
    nav.setAttribute("aria-label", "Tu música y playlists");
    const newPlaylist = createLabeledButton("plus", "Nueva playlist", "button button-ghost sidebar-button new-playlist");
    newPlaylist.addEventListener("click", () => this.openCreateDialog());
    nav.append(
      SidebarView.createHeading("Tu música"),
      this.#libraryList,
      SidebarView.createHeading("Playlists"),
      this.#playlistList,
      newPlaylist,
    );
    return nav;
  }

  private createLoadSection(): HTMLDivElement {
    const section = Object.assign(document.createElement("div"), { className: "sidebar-load" });
    const files = createLabeledButton("upload", "Cargar canciones", "button button-primary sidebar-button");
    const folder = createLabeledButton("folder", "Cargar carpeta", "button button-secondary sidebar-button");
    files.addEventListener("click", () => this.openPicker("files"));
    folder.addEventListener("click", () => this.openPicker("folder"));
    this.#loadButtons.push(files, folder);
    section.append(files, folder, this.#fileInputs.files, this.#fileInputs.folder);
    return section;
  }

  private registerEvents(): void {
    this.#root.addEventListener("click", (event) => this.handleNavigationClick(event));
    this.#root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isDrawerOpen()) {
        this.closeDrawer();
      }
    });
    this.#menuButton.addEventListener("click", () => this.openDrawer());
    this.#closeButton.addEventListener("click", () => this.closeDrawer());
    this.#backdrop.addEventListener("click", () => this.closeDrawer());
    for (const input of Object.values(this.#fileInputs)) {
      input.addEventListener("change", () => this.handleFilesChosen(input));
    }
  }

  private handleNavigationClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) {
      return;
    }
    const item = event.target.closest<HTMLElement>("[data-playlist-id]");
    const playlistId = item?.dataset.playlistId;
    if (playlistId !== undefined) {
      this.closeDrawer();
      this.#selectHandler(playlistId);
    }
  }

  private handleFilesChosen(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length > 0) {
      this.closeDrawer();
      this.#filesHandler(files);
    }
  }

  private openCreateDialog(): void {
    this.#nameInput.value = "";
    this.#createDialog.open(this.#nameInput);
  }

  private isDrawerOpen(): boolean {
    return this.#root.classList.contains("is-open");
  }

  private openDrawer(): void {
    this.setDrawerOpen(true);
    this.#closeButton.focus();
  }

  private closeDrawer(): void {
    if (!this.isDrawerOpen()) {
      return;
    }
    const hadFocus = this.#root.contains(document.activeElement);
    this.setDrawerOpen(false);
    if (hadFocus) {
      this.#menuButton.focus();
    }
  }

  private setDrawerOpen(isOpen: boolean): void {
    this.#root.classList.toggle("is-open", isOpen);
    this.#backdrop.classList.toggle("is-visible", isOpen);
    this.#menuButton.setAttribute("aria-expanded", String(isOpen));
  }

  private static createItem(playlist: Playlist, icon: IconName, visibleId: string): HTMLLIElement {
    const item = document.createElement("li");
    const button = Object.assign(document.createElement("button"), { type: "button", className: "nav-item" });
    button.dataset.playlistId = playlist.id;
    if (playlist.id === visibleId) {
      button.setAttribute("aria-current", "page");
    }
    button.append(
      createIcon(icon),
      SidebarView.createName(playlist),
      Object.assign(document.createElement("span"), { className: "nav-playing", textContent: "En reproducción" }),
      Object.assign(document.createElement("span"), { className: "nav-count", textContent: String(playlist.length) }),
    );
    item.append(button);
    return item;
  }

  private static createName(playlist: Playlist): HTMLSpanElement {
    const name = Object.assign(document.createElement("span"), { className: "nav-name", textContent: playlist.name });
    if (playlist.isLibrary) {
      name.classList.add("nav-name-fixed");
    } else {
      name.title = playlist.name;
    }
    return name;
  }

  private static createBrand(): HTMLDivElement {
    const brand = Object.assign(document.createElement("div"), { className: "brand" });
    const mark = Object.assign(document.createElement("span"), { className: "brand-mark" });
    mark.append(createIcon("logo"));
    brand.append(mark, Object.assign(document.createElement("span"), { className: "brand-name", textContent: "Musongs" }));
    return brand;
  }

  private static createHeading(text: string): HTMLHeadingElement {
    return Object.assign(document.createElement("h2"), { className: "sidebar-heading", textContent: text });
  }

  private static createFileInput(kind: LoadKind): HTMLInputElement {
    const input = Object.assign(document.createElement("input"), { type: "file", hidden: true });
    input.setAttribute("aria-hidden", "true");
    input.tabIndex = -1;
    if (kind === "files") {
      input.multiple = true;
      input.accept = "audio/*";
    } else {
      input.webkitdirectory = true;
    }
    return input;
  }
}
