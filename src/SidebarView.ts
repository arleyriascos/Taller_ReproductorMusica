import { DialogView } from "./DialogView";
import { countLabel, formatMegabytes } from "./format";
import { createFileInput } from "./fileInput";
import { createIcon, createIconButton, createLabeledButton, type IconName } from "./icons";
import type { Playlist } from "./Playlist";
import type { LoadKind, PlaylistNameIssue, StorageUsage } from "./types";

export interface SidebarData {
  library: Playlist;
  playlists: readonly Playlist[];
  visibleId: string;
  isExploring: boolean;
}

type SelectHandler = (playlistId: string) => void;
type CreateHandler = (name: string) => PlaylistNameIssue | null;
type FilesHandler = (files: File[]) => void;

export class SidebarView {
  readonly #root: HTMLElement;
  readonly #backdrop: HTMLElement;
  readonly #menuButton = createIconButton("menu", "Abrir menú", "icon-button top-bar-menu");
  readonly #closeButton = createIconButton("close", "Cerrar menú", "icon-button sidebar-close");
  readonly #exploreItem = SidebarView.createExploreItem();
  readonly #libraryList = Object.assign(document.createElement("ul"), { className: "nav-list" });
  readonly #playlistList = Object.assign(document.createElement("ul"), { className: "nav-list" });
  readonly #fileInputs: Record<LoadKind, HTMLInputElement>;
  readonly #loadButtons: HTMLButtonElement[] = [];
  readonly #createDialog = new DialogView(document.body, "Nueva playlist", "Crear");
  readonly #nameInput = this.#createDialog.addNameField();
  readonly #clearDialog = new DialogView(document.body, "¿Borrar datos guardados?", "Borrar", "danger");
  readonly #storageNote = Object.assign(document.createElement("p"), { className: "storage-note", hidden: true });
  #selectHandler: SelectHandler = () => {};
  #exploreHandler: () => void = () => {};
  #shortcutsHandler: () => void = () => {};
  #createHandler: CreateHandler = () => null;
  #filesHandler: FilesHandler = () => {};
  #clearHandler: () => void = () => {};

  constructor(root: HTMLElement, topBar: HTMLElement, backdrop: HTMLElement) {
    this.#root = root;
    this.#backdrop = backdrop;
    this.#fileInputs = { files: createFileInput("files"), folder: createFileInput("folder") };
    this.buildTopBar(topBar);
    this.#root.append(this.createHeader(), this.createNavigation(), this.createLoadSection(), this.createStorageSection());
    this.buildClearDialog();
    this.#createDialog.onConfirm(() => DialogView.nameIssueMessage(this.#createHandler(this.#nameInput.value)));
    this.registerEvents();
  }

  onPlaylistSelected(handler: SelectHandler): void {
    this.#selectHandler = handler;
  }

  onExploreSelected(handler: () => void): void {
    this.#exploreHandler = handler;
  }

  onShortcutsRequested(handler: () => void): void {
    this.#shortcutsHandler = handler;
  }

  onCreatePlaylist(handler: CreateHandler): void {
    this.#createHandler = handler;
  }

  onFilesChosen(handler: FilesHandler): void {
    this.#filesHandler = handler;
  }

  onClearData(handler: () => void): void {
    this.#clearHandler = handler;
  }

  setStorageUsage(usage: StorageUsage | null): void {
    this.#storageNote.hidden = usage === null;
    if (usage !== null) {
      this.#storageNote.textContent = `${countLabel(usage.songs, "canción", "canciones")} en este navegador · ${formatMegabytes(usage.bytes)} MB`;
    }
  }

  render(data: SidebarData): void {
    if (data.isExploring) {
      this.#exploreItem.setAttribute("aria-current", "page");
    } else {
      this.#exploreItem.removeAttribute("aria-current");
    }
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

  setPlayback(contextId: string | null, isPlaying: boolean, isExploreContext: boolean): void {
    this.#exploreItem.classList.toggle("is-context", isExploreContext);
    this.#exploreItem.classList.toggle("is-playing", isExploreContext && isPlaying);
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
    const discover = Object.assign(document.createElement("ul"), { className: "nav-list" });
    const discoverItem = document.createElement("li");
    discoverItem.append(this.#exploreItem);
    discover.append(discoverItem);
    nav.append(
      SidebarView.createHeading("Descubrir"),
      discover,
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

  private createStorageSection(): HTMLDivElement {
    const section = Object.assign(document.createElement("div"), { className: "sidebar-storage" });
    const clear = createLabeledButton("trash", "Borrar datos guardados", "button button-ghost button-ghost-danger sidebar-button storage-clear");
    clear.addEventListener("click", () => this.#clearDialog.open());
    const shortcuts = createLabeledButton("keyboard", "Atajos de teclado", "button button-ghost sidebar-button");
    shortcuts.addEventListener("click", () => this.#shortcutsHandler());
    section.append(this.#storageNote, shortcuts, clear);
    return section;
  }

  private buildClearDialog(): void {
    const message = Object.assign(document.createElement("p"), {
      className: "dialog-text",
      textContent: "Se borrarán las canciones guardadas en este navegador, tus playlists y tus preferencias. Los archivos originales de tu equipo no se tocan.",
    });
    this.#clearDialog.body.append(message);
    this.#clearDialog.onConfirm(() => {
      this.#clearHandler();
      return null;
    });
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
    if (event.target.closest("[data-explore]") !== null) {
      this.closeDrawer();
      this.#exploreHandler();
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
    if (!playlist.isLibrary) {
      button.dataset.dropPlaylist = playlist.id;
    }
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

  private static createExploreItem(): HTMLButtonElement {
    const button = Object.assign(document.createElement("button"), { type: "button", className: "nav-item" });
    button.dataset.explore = "";
    button.append(
      createIcon("compass"),
      Object.assign(document.createElement("span"), { className: "nav-name nav-name-fixed", textContent: "Explorar" }),
      Object.assign(document.createElement("span"), { className: "nav-playing", textContent: "En reproducción" }),
    );
    return button;
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
}
