import { AddSongsDialogView } from "./AddSongsDialogView";
import { AddToPlaylistDialogView } from "./AddToPlaylistDialogView";
import { DialogView } from "./DialogView";
import { DropIndicator } from "./DropIndicator";
import { createFileInput } from "./fileInput";
import { FileDropZone } from "./FileDropZone";
import { comparableText, countLabel, formatTotal } from "./format";
import { createIcon, createLabeledButton } from "./icons";
import type { Node } from "./Node";
import type { Playlist } from "./Playlist";
import { PlaylistHeaderView } from "./PlaylistHeaderView";
import { RowDragController } from "./RowDragController";
import type { Song } from "./Song";
import { createTrackColumns, createTrackRow } from "./trackRow";
import type { AddSongRequest, AddSongsRequest, LoadKind, MoveDirection, PlaylistNameIssue } from "./types";

export interface TrackListData {
  playlist: Playlist;
  library: Playlist;
  playlists: readonly Playlist[];
  isLoading: boolean;
}

interface FocusMemory {
  nodes: Node<Song>[];
  action: string;
}

type NodeHandler = (playlistId: string, node: Node<Song>) => void;
type MoveHandler = (playlistId: string, node: Node<Song>, direction: MoveDirection) => void;
type PlaylistHandler = (playlistId: string) => void;
type RenameHandler = (playlistId: string, name: string) => PlaylistNameIssue | null;
type PositionHandler = (playlistId: string, node: Node<Song>, position: number) => void;
type PlaylistDropHandler = (targetPlaylistId: string, node: Node<Song>) => void;
type FilesHandler = (playlistId: string, files: File[], position: number) => void;

export class TrackListView {
  readonly #root: HTMLElement;
  readonly #search = TrackListView.createSearchInput();
  readonly #searchField = Object.assign(document.createElement("label"), { className: "search-field" });
  readonly #header = new PlaylistHeaderView(this.#searchField);
  readonly #noResults = Object.assign(document.createElement("section"), { className: "search-empty" });
  readonly #noResultsText = Object.assign(document.createElement("p"), { className: "search-empty-text" });
  readonly #content = Object.assign(document.createElement("div"), { className: "list-content" });
  readonly #importInput = createFileInput("files");
  readonly #rowNodes = new WeakMap<Element, Node<Song>>();
  readonly #rowsByNode = new Map<Node<Song>, HTMLLIElement>();
  readonly #renameDialog = new DialogView(document.body, "Renombrar playlist", "Guardar");
  readonly #renameInput = this.#renameDialog.addNameField();
  readonly #deleteDialog = new DialogView(document.body, "¿Eliminar playlist?", "Eliminar", "danger");
  readonly #deleteMessage = Object.assign(document.createElement("p"), { className: "dialog-text" });
  readonly #removeDialog = new DialogView(document.body, "¿Quitar de la biblioteca?", "Quitar", "danger");
  readonly #removeMessage = Object.assign(document.createElement("p"), { className: "dialog-text" });
  readonly #addSongDialog = new AddToPlaylistDialogView();
  readonly #addSongsDialog = new AddSongsDialogView();
  readonly #indicator: DropIndicator;
  readonly #dragController: RowDragController;
  #data: TrackListData | null = null;
  #source: Playlist | null = null;
  #isPlaying = false;
  #query = "";
  #pendingSong: Song | null = null;
  #pendingFocus: FocusMemory | null = null;
  #playHandler: NodeHandler = () => {};
  #playPlaylistHandler: PlaylistHandler = () => {};
  #shuffleHandler: () => void = () => {};
  #removeNodeHandler: NodeHandler = () => {};
  #moveHandler: MoveHandler = () => {};
  #moveToHandler: PositionHandler = () => {};
  #dropOnPlaylistHandler: PlaylistDropHandler = () => {};
  #filesHandler: FilesHandler = () => {};
  #removeSongHandler: (song: Song) => void = () => {};
  #renameHandler: RenameHandler = () => null;
  #deleteHandler: PlaylistHandler = () => {};
  #duplicateHandler: PlaylistHandler = () => {};
  #loadHandler: (kind: LoadKind) => void = () => {};

  constructor(root: HTMLElement) {
    this.#root = root;
    this.buildSearch();
    this.#root.append(this.#header.element, this.#content, this.#importInput);
    this.buildDialogs();
    this.registerEvents();
    this.#indicator = new DropIndicator(root, (row) => this.#rowNodes.get(row));
    this.#dragController = this.createDragController();
    this.createDropZone();
  }

  onPlay(handler: NodeHandler): void {
    this.#playHandler = handler;
  }

  onPlayPlaylist(handler: PlaylistHandler): void {
    this.#playPlaylistHandler = handler;
  }

  onToggleShuffle(handler: () => void): void {
    this.#shuffleHandler = handler;
  }

  onRemoveNode(handler: NodeHandler): void {
    this.#removeNodeHandler = handler;
  }

  onMoveNode(handler: MoveHandler): void {
    this.#moveHandler = handler;
  }

  onMoveToPosition(handler: PositionHandler): void {
    this.#moveToHandler = handler;
  }

  onDropOnPlaylist(handler: PlaylistDropHandler): void {
    this.#dropOnPlaylistHandler = handler;
  }

  onFilesAdded(handler: FilesHandler): void {
    this.#filesHandler = handler;
  }

  onRemoveFromLibrary(handler: (song: Song) => void): void {
    this.#removeSongHandler = handler;
  }

  onAddSong(handler: (request: AddSongRequest) => void): void {
    this.#addSongDialog.onConfirm(handler);
  }

  onAddSongs(handler: (request: AddSongsRequest) => void): void {
    this.#addSongsDialog.onConfirm(handler);
  }

  onRenamePlaylist(handler: RenameHandler): void {
    this.#renameHandler = handler;
  }

  onDeletePlaylist(handler: PlaylistHandler): void {
    this.#deleteHandler = handler;
  }

  onDuplicatePlaylist(handler: PlaylistHandler): void {
    this.#duplicateHandler = handler;
  }

  onLoadRequested(handler: (kind: LoadKind) => void): void {
    this.#loadHandler = handler;
  }

  render(data: TrackListData): void {
    this.#dragController.cancel();
    const focus = this.captureFocus();
    const switched = this.#data?.playlist !== data.playlist;
    this.#data = data;
    if (switched) {
      this.resetSearch();
    }
    this.#header.render(data.playlist);
    this.#searchField.hidden = data.playlist.length === 0;
    this.renderContent(data);
    this.applyFilter();
    this.applyPlayback();
    if (focus !== null && TrackListView.isFocusLost()) {
      this.restoreFocus(focus);
    }
    if (switched) {
      this.#root.scrollTop = 0;
    }
  }

  focusSearch(): void {
    if (!this.#searchField.hidden) {
      this.#search.focus();
      this.#search.select();
    }
  }

  setPlayback(source: Playlist | null, isPlaying: boolean, isShuffled: boolean): void {
    this.#source = source;
    this.#isPlaying = isPlaying;
    this.#header.setShuffle(isShuffled);
    this.applyPlayback();
  }

  private createDragController(): RowDragController {
    return new RowDragController(this.#root, this.#indicator, {
      isEnabled: () => this.#query === "",
      nodeOf: (row) => this.#rowNodes.get(row),
      onReorder: (node, before) => this.reorder(node, before),
      onDropOnPlaylist: (targetId, node) => this.#dropOnPlaylistHandler(targetId, node),
    });
  }

  private createDropZone(): void {
    new FileDropZone(this.#root, this.#indicator, {
      isEnabled: () => this.#data !== null,
      positionBefore: (before) => this.insertionPosition(before),
      onDrop: (files, position) => this.dropFiles(files, position),
    });
  }

  private reorder(node: Node<Song>, before: Node<Song> | null): void {
    const playlist = this.#data?.playlist;
    if (playlist === undefined) {
      return;
    }
    const target = before === null ? playlist.length : playlist.positionOf(before);
    const position = before !== null && target > playlist.positionOf(node) ? target - 1 : target;
    this.#moveToHandler(playlist.id, node, position);
  }

  private insertionPosition(before: Node<Song> | null): number {
    const playlist = this.#data?.playlist;
    if (playlist === undefined) {
      return 1;
    }
    return before === null ? playlist.length + 1 : playlist.positionOf(before);
  }

  private dropFiles(files: File[], position: number): void {
    const playlist = this.#data?.playlist;
    if (playlist !== undefined && files.length > 0) {
      this.#filesHandler(playlist.id, files, position);
    }
  }

  private importFiles(): void {
    const playlist = this.#data?.playlist;
    const files = Array.from(this.#importInput.files ?? []);
    this.#importInput.value = "";
    if (playlist !== undefined && files.length > 0) {
      this.#filesHandler(playlist.id, files, playlist.length + 1);
    }
  }

  private applyPlayback(): void {
    const currentNode = this.#source?.current ?? null;
    for (const [node, row] of this.#rowsByNode) {
      const isCurrent = node === currentNode;
      row.classList.toggle("is-current", isCurrent);
      row.classList.toggle("is-playing", isCurrent && this.#isPlaying);
      row.toggleAttribute("aria-current", isCurrent);
    }
    const playlist = this.#data?.playlist ?? null;
    this.#header.setPlayback(playlist !== null && playlist === this.#source && this.#isPlaying, playlist === null || playlist.length === 0);
  }

  private buildSearch(): void {
    const clear = createLabeledButton("close", "Limpiar búsqueda", "button button-secondary");
    clear.dataset.action = "clear-search";
    this.#searchField.append(createIcon("search"), this.#search);
    this.#noResults.append(this.#noResultsText, clear);
  }

  private renderContent(data: TrackListData): void {
    this.#rowsByNode.clear();
    if (data.playlist.length === 0) {
      this.#content.replaceChildren(TrackListView.createEmptyState(data));
      return;
    }
    const list = Object.assign(document.createElement("ol"), { className: "track-list" });
    list.setAttribute("aria-label", `Canciones de ${data.playlist.name}`);
    let position = 1;
    for (const node of data.playlist.nodes()) {
      list.append(this.createRow(node, position, data.playlist.isLibrary));
      position++;
    }
    this.#content.replaceChildren(createTrackColumns(), list, this.#noResults);
  }

  private applyFilter(): void {
    const playlist = this.#data?.playlist;
    if (playlist === undefined) {
      return;
    }
    let matches = 0;
    for (const node of playlist.nodes()) {
      const isMatch = this.matchesQuery(node.value);
      const row = this.#rowsByNode.get(node);
      if (row !== undefined) {
        row.hidden = !isMatch;
      }
      matches += isMatch ? 1 : 0;
    }
    this.showFilterResult(playlist, matches);
  }

  private matchesQuery(song: Song): boolean {
    const query = this.#query;
    return query === "" || [song.title, song.artist, song.album].some((field) => comparableText(field).includes(query));
  }

  private showFilterResult(playlist: Playlist, matches: number): void {
    const isFiltering = this.#query !== "";
    const total = countLabel(playlist.length, "canción", "canciones");
    const hasNoResults = isFiltering && matches === 0 && playlist.length > 0;
    this.#header.meta.textContent = isFiltering ? `${matches} de ${total}` : TrackListView.describe(playlist);
    this.#noResultsText.textContent = `Sin resultados para «${this.#search.value.trim()}»`;
    this.#noResults.hidden = !hasNoResults;
    this.#content.classList.toggle("has-no-results", hasNoResults);
    this.#content.classList.toggle("is-filtering", isFiltering);
  }

  private updateSearch(): void {
    this.#query = comparableText(this.#search.value);
    this.applyFilter();
  }

  private resetSearch(): void {
    this.#search.value = "";
    this.#query = "";
  }

  private clearSearch(): void {
    this.resetSearch();
    this.applyFilter();
    this.#search.focus();
  }

  private handleSearchKey(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.#search.value !== "") {
      event.preventDefault();
      this.clearSearch();
    }
  }

  private createRow(node: Node<Song>, position: number, isLibrary: boolean): HTMLLIElement {
    const row = createTrackRow(node, { position, kind: isLibrary ? "library" : "playlist" });
    this.#rowNodes.set(row, node);
    this.#rowsByNode.set(node, row);
    return row;
  }

  private registerEvents(): void {
    this.#root.addEventListener("click", (event) => this.handleClick(event));
    this.#search.addEventListener("input", () => this.updateSearch());
    this.#search.addEventListener("keydown", (event) => this.handleSearchKey(event));
    this.#importInput.addEventListener("change", () => this.importFiles());
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action]") : null;
    const action = target?.dataset.action;
    const playlist = this.#data?.playlist;
    if (target === null || action === undefined || playlist === undefined) {
      return;
    }
    const row = target.closest(".track-row");
    const node = row === null ? undefined : this.#rowNodes.get(row);
    if (node === undefined) {
      this.handleViewAction(action, playlist);
    } else {
      this.handleRowAction(action, playlist, node);
    }
  }

  private handleRowAction(action: string, playlist: Playlist, node: Node<Song>): void {
    if (action === "play") {
      this.#playHandler(playlist.id, node);
    } else if (action === "move-up" || action === "move-down") {
      this.#moveHandler(playlist.id, node, action === "move-up" ? "up" : "down");
    } else if (action === "add") {
      this.openAddFromSong(node.value);
    } else if (action === "remove" && playlist.isLibrary) {
      this.openRemoveFromLibrary(node.value);
    } else if (action === "remove") {
      this.#removeNodeHandler(playlist.id, node);
    }
  }

  private handleViewAction(action: string, playlist: Playlist): void {
    if (action === "load-files" || action === "load-folder") {
      this.#loadHandler(action === "load-files" ? "files" : "folder");
      return;
    }
    if (this.handlePlaylistAction(action, playlist)) {
      return;
    }
    if (action === "clear-search") {
      this.clearSearch();
    } else if (action === "add-songs") {
      this.openAddSongs(playlist);
    } else if (action === "import-here") {
      this.#importInput.click();
    } else if (action === "rename") {
      this.openRename(playlist);
    } else if (action === "delete-playlist") {
      this.openDelete(playlist);
    }
  }

  private handlePlaylistAction(action: string, playlist: Playlist): boolean {
    if (action === "play-playlist") {
      this.#playPlaylistHandler(playlist.id);
    } else if (action === "toggle-shuffle") {
      this.#shuffleHandler();
    } else if (action === "duplicate-playlist") {
      this.#duplicateHandler(playlist.id);
    } else {
      return false;
    }
    return true;
  }

  private buildDialogs(): void {
    this.#renameDialog.onConfirm(() => this.confirmRename());
    this.#deleteDialog.body.append(this.#deleteMessage);
    this.#deleteDialog.onConfirm(() => this.confirmDelete());
    this.#removeDialog.body.append(this.#removeMessage);
    this.#removeDialog.onConfirm(() => this.confirmRemoveFromLibrary());
    for (const dialog of [this.#renameDialog, this.#deleteDialog, this.#removeDialog]) {
      dialog.onClose(() => this.restorePendingFocus());
    }
    this.#addSongDialog.onClose(() => this.restorePendingFocus());
    this.#addSongsDialog.onClose(() => this.restorePendingFocus());
  }

  private openDialog(dialog: DialogView, focusTarget?: HTMLElement): void {
    this.#pendingFocus = this.captureFocus();
    dialog.open(focusTarget);
  }

  private openRename(playlist: Playlist): void {
    this.#renameInput.value = playlist.name;
    this.openDialog(this.#renameDialog, this.#renameInput);
    this.#renameInput.select();
  }

  private confirmRename(): string | null {
    const playlist = this.#data?.playlist;
    if (playlist === undefined) {
      return null;
    }
    return DialogView.nameIssueMessage(this.#renameHandler(playlist.id, this.#renameInput.value));
  }

  private openDelete(playlist: Playlist): void {
    this.#deleteMessage.textContent = `Se eliminará «${playlist.name}». Las canciones seguirán en tu biblioteca.`;
    this.openDialog(this.#deleteDialog);
  }

  private confirmDelete(): null {
    const playlist = this.#data?.playlist;
    if (playlist !== undefined) {
      this.#deleteHandler(playlist.id);
    }
    return null;
  }

  private openRemoveFromLibrary(song: Song): void {
    this.#pendingSong = song;
    this.#removeMessage.textContent = `«${song.title}». Se quitará de la biblioteca y de todas tus playlists.`;
    this.openDialog(this.#removeDialog);
  }

  private confirmRemoveFromLibrary(): null {
    if (this.#pendingSong !== null) {
      this.#removeSongHandler(this.#pendingSong);
      this.#pendingSong = null;
    }
    return null;
  }

  private openAddFromSong(song: Song): void {
    this.#pendingFocus = this.captureFocus();
    this.#addSongDialog.open(song, this.#data?.playlists ?? [], this.#data?.playlist ?? null);
  }

  private openAddSongs(playlist: Playlist): void {
    const library = this.#data?.library;
    if (library !== undefined) {
      this.#pendingFocus = this.captureFocus();
      this.#addSongsDialog.open(playlist, library);
    }
  }

  private captureFocus(): FocusMemory | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.#root.contains(active)) {
      return null;
    }
    const action = active.dataset.action ?? "";
    const row = active.closest(".track-row");
    const nodes: Node<Song>[] = [];
    for (const candidate of [row, row?.nextElementSibling, row?.previousElementSibling]) {
      const node = candidate === null || candidate === undefined ? undefined : this.#rowNodes.get(candidate);
      if (node !== undefined) {
        nodes.push(node);
      }
    }
    return { nodes, action };
  }

  private restoreFocus(memory: FocusMemory): void {
    for (const node of memory.nodes) {
      const row = this.#rowsByNode.get(node);
      if (row !== undefined && !row.hidden) {
        (row.querySelector<HTMLElement>(`[data-action="${memory.action}"]:not(:disabled)`) ?? row.querySelector<HTMLElement>("button:not(:disabled)"))?.focus();
        return;
      }
    }
    const control = memory.action === "" ? null : this.#root.querySelector<HTMLElement>(`[data-action="${memory.action}"]`);
    (control ?? this.#header.title).focus();
  }

  private restorePendingFocus(): void {
    const memory = this.#pendingFocus;
    this.#pendingFocus = null;
    if (memory !== null && TrackListView.isFocusLost()) {
      this.restoreFocus(memory);
    }
  }

  private static isFocusLost(): boolean {
    const active = document.activeElement;
    return active === null || active === document.body;
  }

  private static describe(playlist: Playlist): string {
    const count = countLabel(playlist.length, "canción", "canciones");
    return playlist.length === 0 ? count : `${count} · ${formatTotal(playlist.totalDuration())}`;
  }

  private static createEmptyState(data: TrackListData): HTMLElement {
    const card = Object.assign(document.createElement("section"), { className: "empty-state" });
    const icon = Object.assign(document.createElement("span"), { className: "empty-icon" });
    icon.append(createIcon(data.playlist.isLibrary ? "music" : "playlist"));
    const title = Object.assign(document.createElement("h2"), { className: "empty-title" });
    const text = Object.assign(document.createElement("p"), { className: "empty-text" });
    card.append(icon, title, text);
    if (data.playlist.isLibrary) {
      title.textContent = "Carga tu primera canción";
      text.textContent = "Elige archivos de audio o una carpeta de tu computador, o suéltalos aquí. Se reproducen aquí mismo y nunca se suben a internet.";
      card.append(TrackListView.createLoadActions(data.isLoading));
    } else {
      title.textContent = "Esta playlist está vacía";
      text.textContent = "Usa «Agregar canciones» para elegir de tu biblioteca, o suelta archivos aquí.";
    }
    return card;
  }

  private static createLoadActions(isLoading: boolean): HTMLDivElement {
    const actions = Object.assign(document.createElement("div"), { className: "empty-actions" });
    const files = createLabeledButton("upload", "Cargar canciones", "button button-primary");
    const folder = createLabeledButton("folder", "Cargar carpeta", "button button-secondary");
    files.dataset.action = "load-files";
    folder.dataset.action = "load-folder";
    files.disabled = isLoading;
    folder.disabled = isLoading;
    actions.append(files, folder);
    return actions;
  }

  private static createSearchInput(): HTMLInputElement {
    const input = Object.assign(document.createElement("input"), {
      type: "search",
      className: "text-input search-input",
      placeholder: "Buscar en esta lista",
      autocomplete: "off",
      spellcheck: false,
    });
    input.setAttribute("aria-label", "Buscar en esta lista");
    return input;
  }
}
