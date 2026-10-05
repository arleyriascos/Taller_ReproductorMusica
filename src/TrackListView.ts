import { DialogView } from "./DialogView";
import { countLabel, formatTime, formatTotal } from "./format";
import { createIcon, createIconButton, createLabeledButton } from "./icons";
import type { Node } from "./Node";
import type { Playlist } from "./Playlist";
import type { LoadKind } from "./SidebarView";
import type { Song } from "./Song";
import type { PlaylistNameIssue } from "./types";

export type SongPlacement = { kind: "start" } | { kind: "end" } | { kind: "position"; position: number };

export interface AddSongRequest {
  song: Song;
  playlistId: string;
  placement: SongPlacement;
}

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
type RenameHandler = (playlistId: string, name: string) => PlaylistNameIssue | null;

const UNKNOWN_ARTIST = "Artista desconocido";
const NO_PLAYLISTS = "Primero crea una playlist con «Nueva playlist»";
const EMPTY_LIBRARY = "Tu biblioteca está vacía. Carga canciones primero.";

export class TrackListView {
  readonly #root: HTMLElement;
  readonly #header = Object.assign(document.createElement("header"), { className: "list-header" });
  readonly #title = Object.assign(document.createElement("h1"), { className: "list-title", tabIndex: -1 });
  readonly #content = Object.assign(document.createElement("div"), { className: "list-content" });
  readonly #rowNodes = new WeakMap<Element, Node<Song>>();
  readonly #rowsByNode = new Map<Node<Song>, HTMLLIElement>();
  readonly #renameDialog = new DialogView(document.body, "Renombrar playlist", "Guardar");
  readonly #renameInput = this.#renameDialog.addNameField();
  readonly #deleteDialog = new DialogView(document.body, "¿Eliminar playlist?", "Eliminar", "danger");
  readonly #deleteMessage = Object.assign(document.createElement("p"), { className: "dialog-text" });
  readonly #removeDialog = new DialogView(document.body, "¿Quitar de la biblioteca?", "Quitar", "danger");
  readonly #removeMessage = Object.assign(document.createElement("p"), { className: "dialog-text" });
  readonly #addDialog = new DialogView(document.body, "Agregar canción", "Agregar");
  readonly #addSummary = Object.assign(document.createElement("p"), { className: "dialog-text" });
  readonly #songSelect = Object.assign(document.createElement("select"), { className: "select-input" });
  readonly #destinationSelect = Object.assign(document.createElement("select"), { className: "select-input" });
  readonly #placementGroup = TrackListView.createPlacementGroup();
  readonly #positionInput = Object.assign(document.createElement("input"), {
    type: "number",
    className: "text-input",
    min: "1",
    step: "1",
    inputMode: "numeric",
  });
  readonly #positionHint = Object.assign(document.createElement("span"), { className: "field-hint" });
  readonly #songOptions = new Map<string, Song>();
  readonly #destinationOptions = new Map<string, Playlist>();
  readonly #songField: HTMLLabelElement;
  readonly #destinationField: HTMLLabelElement;
  readonly #positionField: HTMLLabelElement;
  #data: TrackListData | null = null;
  #currentNode: Node<Song> | null = null;
  #isPlaying = false;
  #pendingSong: Song | null = null;
  #addTarget: Playlist | null = null;
  #pendingFocus: FocusMemory | null = null;
  #playHandler: NodeHandler = () => {};
  #removeNodeHandler: NodeHandler = () => {};
  #removeSongHandler: (song: Song) => void = () => {};
  #addHandler: (request: AddSongRequest) => void = () => {};
  #renameHandler: RenameHandler = () => null;
  #deleteHandler: (playlistId: string) => void = () => {};
  #loadHandler: (kind: LoadKind) => void = () => {};

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#root.append(this.#header, this.#content);
    this.#songField = this.#addDialog.addField("Canción", this.#songSelect);
    this.#destinationField = this.#addDialog.addField("Playlist de destino", this.#destinationSelect);
    this.#positionField = this.#addDialog.addField("Número de posición", this.#positionInput);
    this.buildDialogs();
    this.registerEvents();
  }

  onPlay(handler: NodeHandler): void {
    this.#playHandler = handler;
  }

  onRemoveNode(handler: NodeHandler): void {
    this.#removeNodeHandler = handler;
  }

  onRemoveFromLibrary(handler: (song: Song) => void): void {
    this.#removeSongHandler = handler;
  }

  onAddSong(handler: (request: AddSongRequest) => void): void {
    this.#addHandler = handler;
  }

  onRenamePlaylist(handler: RenameHandler): void {
    this.#renameHandler = handler;
  }

  onDeletePlaylist(handler: (playlistId: string) => void): void {
    this.#deleteHandler = handler;
  }

  onLoadRequested(handler: (kind: LoadKind) => void): void {
    this.#loadHandler = handler;
  }

  render(data: TrackListData): void {
    const focus = this.captureFocus();
    const switched = this.#data?.playlist !== data.playlist;
    this.#data = data;
    this.renderHeader(data.playlist);
    this.renderContent(data);
    this.applyPlayback();
    if (focus !== null) {
      this.restoreFocus(focus);
    }
    if (switched) {
      this.#root.scrollTop = 0;
    }
  }

  setPlayback(currentNode: Node<Song> | null, isPlaying: boolean): void {
    this.#currentNode = currentNode;
    this.#isPlaying = isPlaying;
    this.applyPlayback();
  }

  private applyPlayback(): void {
    for (const [node, row] of this.#rowsByNode) {
      const isCurrent = node === this.#currentNode;
      row.classList.toggle("is-current", isCurrent);
      row.classList.toggle("is-playing", isCurrent && this.#isPlaying);
      row.toggleAttribute("aria-current", isCurrent);
    }
  }

  private renderHeader(playlist: Playlist): void {
    const eyebrow = Object.assign(document.createElement("p"), {
      className: "list-eyebrow",
      textContent: playlist.isLibrary ? "Tu música" : "Playlist",
    });
    this.#title.textContent = playlist.name;
    const meta = Object.assign(document.createElement("p"), {
      className: "list-meta",
      textContent: TrackListView.describe(playlist),
    });
    const text = Object.assign(document.createElement("div"), { className: "list-heading" });
    text.append(eyebrow, this.#title, meta);
    this.#header.replaceChildren(text);
    if (!playlist.isLibrary) {
      this.#header.append(TrackListView.createPlaylistActions());
    }
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
    this.#content.replaceChildren(TrackListView.createColumns(), list);
  }

  private createRow(node: Node<Song>, position: number, isLibrary: boolean): HTMLLIElement {
    const song = node.value;
    const row = Object.assign(document.createElement("li"), { className: "track-row" });
    row.classList.toggle("is-unavailable", !song.isAvailable());
    const play = Object.assign(document.createElement("button"), { type: "button", className: "track-main" });
    play.dataset.action = "play";
    play.setAttribute("aria-label", `Reproducir ${song.title}`);
    play.append(
      TrackListView.createPosition(position),
      TrackListView.createCover(song),
      TrackListView.createSongText(song),
      Object.assign(document.createElement("span"), { className: "track-album", textContent: song.album }),
      Object.assign(document.createElement("span"), { className: "track-duration", textContent: formatTime(song.duration) }),
    );
    row.append(play, TrackListView.createRowActions(song, isLibrary));
    this.#rowNodes.set(row, node);
    this.#rowsByNode.set(node, row);
    return row;
  }

  private registerEvents(): void {
    this.#root.addEventListener("click", (event) => this.handleClick(event));
    this.#destinationSelect.addEventListener("change", () => this.updatePositionLimit());
    this.#placementGroup.addEventListener("change", () => this.updatePositionVisibility());
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
    } else if (action === "add") {
      this.openAddFromSong(node.value);
    } else if (action === "remove" && playlist.isLibrary) {
      this.openRemoveFromLibrary(node.value);
    } else if (action === "remove") {
      this.#removeNodeHandler(playlist.id, node);
    }
  }

  private handleViewAction(action: string, playlist: Playlist): void {
    if (action === "add-song") {
      this.openAddToPlaylist(playlist);
    } else if (action === "rename") {
      this.openRename(playlist);
    } else if (action === "delete-playlist") {
      this.openDelete(playlist);
    } else if (action === "load-files" || action === "load-folder") {
      this.#loadHandler(action === "load-files" ? "files" : "folder");
    }
  }

  private buildDialogs(): void {
    this.#renameDialog.onConfirm(() => this.confirmRename());
    this.#deleteDialog.body.append(this.#deleteMessage);
    this.#deleteDialog.onConfirm(() => this.confirmDelete());
    this.#removeDialog.body.append(this.#removeMessage);
    this.#removeDialog.onConfirm(() => this.confirmRemoveFromLibrary());
    this.#addDialog.body.prepend(this.#addSummary);
    this.#positionField.before(this.#placementGroup);
    this.#positionField.append(this.#positionHint);
    this.#addDialog.onConfirm(() => this.confirmAdd());
    for (const dialog of [this.#renameDialog, this.#deleteDialog, this.#removeDialog, this.#addDialog]) {
      dialog.onClose(() => this.restorePendingFocus());
    }
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
    this.#pendingSong = song;
    this.#addTarget = null;
    this.#addSummary.textContent = `Canción: ${song.title}`;
    this.fillDestinations();
    this.prepareAddDialog(true, this.#destinationOptions.size === 0 ? NO_PLAYLISTS : null);
  }

  private openAddToPlaylist(playlist: Playlist): void {
    this.#pendingSong = null;
    this.#addTarget = playlist;
    this.#addSummary.textContent = `Destino: ${playlist.name}`;
    this.fillSongs();
    this.prepareAddDialog(false, this.#songOptions.size === 0 ? EMPTY_LIBRARY : null);
  }

  private prepareAddDialog(chooseDestination: boolean, warning: string | null): void {
    this.#destinationField.hidden = !chooseDestination;
    this.#songField.hidden = chooseDestination;
    this.#positionInput.value = "";
    this.setPlacement("end");
    this.openDialog(this.#addDialog, chooseDestination ? this.#destinationSelect : this.#songSelect);
    if (warning !== null) {
      this.#addDialog.showError(warning);
    }
  }

  private fillDestinations(): void {
    this.#destinationOptions.clear();
    this.#destinationSelect.replaceChildren();
    for (const playlist of this.#data?.playlists ?? []) {
      this.#destinationOptions.set(playlist.id, playlist);
      this.#destinationSelect.append(new Option(`${playlist.name} (${countLabel(playlist.length, "canción", "canciones")})`, playlist.id));
    }
    const visible = this.#data?.playlist;
    if (visible !== undefined && this.#destinationOptions.has(visible.id)) {
      this.#destinationSelect.value = visible.id;
    }
  }

  private fillSongs(): void {
    this.#songOptions.clear();
    this.#songSelect.replaceChildren();
    const library = this.#data?.library;
    if (library === undefined) {
      return;
    }
    for (const node of library.nodes()) {
      const song = node.value;
      this.#songOptions.set(song.id, song);
      this.#songSelect.append(new Option(`${song.title} — ${song.artist || UNKNOWN_ARTIST}`, song.id));
    }
  }

  private confirmAdd(): string | null {
    const song = this.#pendingSong ?? this.#songOptions.get(this.#songSelect.value) ?? null;
    const target = this.selectedDestination();
    if (song === null) {
      return EMPTY_LIBRARY;
    }
    if (target === null) {
      return NO_PLAYLISTS;
    }
    const placement = this.readPlacement(target.length + 1);
    if (typeof placement === "string") {
      return placement;
    }
    this.#addHandler({ song, playlistId: target.id, placement });
    return null;
  }

  private readPlacement(maxPosition: number): SongPlacement | string {
    const kind = this.checkedPlacement();
    if (kind !== "position") {
      return { kind };
    }
    const position = Number(this.#positionInput.value);
    if (this.#positionInput.value.trim() === "" || !Number.isInteger(position) || position < 1 || position > maxPosition) {
      return `Escribe un número entre 1 y ${maxPosition}`;
    }
    return { kind, position };
  }

  private selectedDestination(): Playlist | null {
    return this.#addTarget ?? this.#destinationOptions.get(this.#destinationSelect.value) ?? null;
  }

  private checkedPlacement(): SongPlacement["kind"] {
    const checked = this.#placementGroup.querySelector<HTMLInputElement>("input:checked");
    const value = checked?.value;
    return value === "start" || value === "position" ? value : "end";
  }

  private setPlacement(kind: SongPlacement["kind"]): void {
    const radio = this.#placementGroup.querySelector<HTMLInputElement>(`input[value="${kind}"]`);
    if (radio !== null) {
      radio.checked = true;
    }
    this.updatePositionVisibility();
  }

  private updatePositionVisibility(): void {
    this.#positionField.hidden = this.checkedPlacement() !== "position";
    this.updatePositionLimit();
    this.#addDialog.clearError();
  }

  private updatePositionLimit(): void {
    const maxPosition = (this.selectedDestination()?.length ?? 0) + 1;
    this.#positionInput.max = String(maxPosition);
    this.#positionHint.textContent = `Entre 1 y ${maxPosition}`;
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
      if (row !== undefined) {
        (row.querySelector<HTMLElement>(`[data-action="${memory.action}"]`) ?? row.querySelector<HTMLElement>("button"))?.focus();
        return;
      }
    }
    const control = memory.action === "" ? null : this.#root.querySelector<HTMLElement>(`[data-action="${memory.action}"]`);
    (control ?? this.#title).focus();
  }

  private restorePendingFocus(): void {
    const memory = this.#pendingFocus;
    this.#pendingFocus = null;
    const active = document.activeElement;
    if (memory !== null && (active === null || active === document.body)) {
      this.restoreFocus(memory);
    }
  }

  private static describe(playlist: Playlist): string {
    const count = countLabel(playlist.length, "canción", "canciones");
    return playlist.length === 0 ? count : `${count} · ${formatTotal(playlist.totalDuration())}`;
  }

  private static createPlaylistActions(): HTMLDivElement {
    const actions = Object.assign(document.createElement("div"), { className: "list-actions" });
    const add = createLabeledButton("plus", "Agregar canción", "button button-primary");
    const rename = createLabeledButton("edit", "Renombrar", "button button-secondary");
    const remove = createLabeledButton("trash", "Eliminar playlist", "button button-ghost button-ghost-danger");
    add.dataset.action = "add-song";
    rename.dataset.action = "rename";
    remove.dataset.action = "delete-playlist";
    actions.append(add, rename, remove);
    return actions;
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
      text.textContent = "Elige archivos de audio o una carpeta de tu computador. Se reproducen aquí mismo y nunca se suben a internet.";
      card.append(TrackListView.createLoadActions(data.isLoading));
    } else {
      title.textContent = "Esta playlist está vacía";
      text.textContent = "Agrega canciones desde la Biblioteca";
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

  private static createColumns(): HTMLDivElement {
    const columns = Object.assign(document.createElement("div"), { className: "track-columns" });
    columns.setAttribute("aria-hidden", "true");
    for (const [className, text] of [
      ["track-position", "#"],
      ["track-columns-title", "Título"],
      ["track-album", "Álbum"],
      ["track-duration", "Duración"],
    ]) {
      columns.append(Object.assign(document.createElement("span"), { className, textContent: text }));
    }
    return columns;
  }

  private static createPosition(position: number): HTMLSpanElement {
    const cell = Object.assign(document.createElement("span"), { className: "track-position" });
    const bars = Object.assign(document.createElement("span"), { className: "track-bars" });
    bars.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
    cell.append(Object.assign(document.createElement("span"), { className: "track-number", textContent: String(position) }), bars);
    return cell;
  }

  private static createCover(song: Song): HTMLSpanElement {
    const cover = Object.assign(document.createElement("span"), { className: "cover track-cover" });
    if (song.coverUrl === null) {
      cover.append(createIcon("music"));
    } else {
      cover.classList.add("has-image");
      cover.append(Object.assign(document.createElement("img"), { src: song.coverUrl, alt: "", loading: "lazy" }));
    }
    return cover;
  }

  private static createSongText(song: Song): HTMLSpanElement {
    const text = Object.assign(document.createElement("span"), { className: "track-text" });
    const detail = song.isAvailable() ? song.artist || UNKNOWN_ARTIST : "Archivo no disponible";
    text.append(
      Object.assign(document.createElement("span"), { className: "track-title", textContent: song.title }),
      Object.assign(document.createElement("span"), { className: "track-artist", textContent: detail }),
    );
    return text;
  }

  private static createRowActions(song: Song, isLibrary: boolean): HTMLSpanElement {
    const actions = Object.assign(document.createElement("span"), { className: "track-actions" });
    const add = createIconButton("plus", `Agregar «${song.title}» a una playlist`, "icon-button track-action");
    const removeLabel = isLibrary ? "Eliminar de la biblioteca" : "Quitar de esta playlist";
    const remove = createIconButton("trash", `${removeLabel}: ${song.title}`, "icon-button track-action track-action-danger");
    add.dataset.action = "add";
    remove.dataset.action = "remove";
    actions.append(add, remove);
    return actions;
  }

  private static createPlacementGroup(): HTMLFieldSetElement {
    const group = Object.assign(document.createElement("fieldset"), { className: "placement-group" });
    group.append(Object.assign(document.createElement("legend"), { className: "field-label", textContent: "¿En qué posición?" }));
    for (const [value, text] of [
      ["start", "Inicio"],
      ["end", "Final"],
      ["position", "Posición"],
    ]) {
      const label = Object.assign(document.createElement("label"), { className: "placement-option" });
      const radio = Object.assign(document.createElement("input"), { type: "radio", name: "placement", value });
      label.append(radio, Object.assign(document.createElement("span"), { textContent: text }));
      group.append(label);
    }
    return group;
  }
}
