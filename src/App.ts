import { AudioStore } from "./AudioStore";
import { AudiusService } from "./AudiusService";
import { ExploreSession } from "./ExploreSession";
import { ExploreView } from "./ExploreView";
import { countLabel } from "./format";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { LyricsService } from "./LyricsService";
import { MusicPlayer } from "./MusicPlayer";
import type { Node } from "./Node";
import { NotificationView } from "./NotificationView";
import { NowPlayingPanelView } from "./NowPlayingPanelView";
import { NowPlayingView } from "./NowPlayingView";
import { PanelLayoutView } from "./PanelLayoutView";
import { PlayerBarView } from "./PlayerBarView";
import type { Playlist } from "./Playlist";
import { PlaylistManager } from "./PlaylistManager";
import { PlaylistStorage } from "./PlaylistStorage";
import { ShortcutsDialogView } from "./ShortcutsDialogView";
import { SidebarView } from "./SidebarView";
import type { Song } from "./Song";
import { SongLoader } from "./SongLoader";
import { StructurePanelView } from "./StructurePanelView";
import { TrackListView } from "./TrackListView";
import type {
  AddSongRequest,
  AddSongsRequest,
  AddTracksResult,
  LoadResult,
  MoveDirection,
  PlayerErrorCode,
  PlayerState,
  PlaylistNameIssue,
  Preferences,
  SongPlacement,
  TrackPlacement,
} from "./types";

const APP_NAME = "Musongs";

const PLAYER_ERRORS: Record<PlayerErrorCode, string> = {
  unavailable: "Esta canción no está disponible",
  "playback-failed": "No se pudo reproducir este archivo",
};
const REMOTE_PLAYBACK_ERROR = "No se pudo reproducir esta canción de Audius";

export class App {
  readonly #manager = new PlaylistManager();
  readonly #loader = new SongLoader();
  readonly #player = MusicPlayer.getInstance();
  readonly #lyrics = new LyricsService();
  readonly #sidebar = new SidebarView(App.element("sidebar"), App.element("top-bar"), App.element("drawer-backdrop"));
  readonly #trackList = new TrackListView(App.element("main"));
  readonly #explorer = new ExploreView(App.element("explore"));
  readonly #explore = new ExploreSession(new AudiusService());
  readonly #playerBar = new PlayerBarView(App.element("player-bar"));
  readonly #nowPlaying = new NowPlayingView(App.element("now-playing"), App.element("app-shell"), [
    App.element("top-bar"),
    App.element("sidebar"),
    App.element("drawer-backdrop"),
    App.element("main"),
    App.element("explore"),
    App.element("structure-backdrop"),
    App.element("structure-panel"),
  ]);
  readonly #structure = new StructurePanelView(App.element("structure-panel"), App.element("structure-backdrop"));
  readonly #nowPlayingPanel = new NowPlayingPanelView(this.#structure.nowPlayingSlot);
  readonly #nowPlayingBar = new PlayerBarView(this.#nowPlaying.controlsSlot);
  readonly #layout = new PanelLayoutView(App.element("app-shell"));
  readonly #shortcutsDialog = new ShortcutsDialogView();
  readonly #notifications = new NotificationView(App.element("notifications"));
  readonly #storage = new PlaylistStorage();
  readonly #audioStore = new AudioStore();
  #isExploring = false;
  #isLoading = false;
  #isRestoring = true;
  #isResetting = false;
  #savedPreferences = "";

  async start(): Promise<void> {
    this.bindStorage();
    this.bindSidebar();
    this.bindTrackList();
    this.bindExplore();
    this.bindPlayerBar(this.#playerBar);
    this.bindPlayerBar(this.#nowPlayingBar);
    this.bindNowPlaying();
    this.bindRightColumn();
    this.bindPlayer();
    this.bindShortcuts();
    await this.restoreSession();
    this.render();
    void this.refreshStorageUsage();
  }

  private bindStorage(): void {
    this.#storage.onFailure(() => this.#notifications.show("No se pudo guardar tu biblioteca en este navegador", "error"));
    this.#audioStore.onFailure(() =>
      this.#notifications.show("No se pudo guardar el audio en este navegador: tendrás que reconectar tus archivos", "error"),
    );
    this.#notifications.onReconnectRequested(() => this.#sidebar.openPicker("folder"));
  }

  private async restoreSession(): Promise<void> {
    const state = this.#storage.loadState();
    if (state !== null) {
      this.#manager.restore(state);
      await this.#audioStore.reattach(this.#manager.librarySongs());
    }
    this.applyPreferences(this.#storage.loadPreferences());
    this.#isRestoring = false;
    this.#savedPreferences = JSON.stringify(this.currentPreferences());
  }

  private applyPreferences(preferences: Preferences | null): void {
    if (preferences === null) {
      return;
    }
    this.#player.setVolume(preferences.volume);
    this.#player.setMuted(preferences.muted);
    this.#player.setRepeatMode(preferences.repeatMode);
    this.#player.setShuffle(preferences.shuffle);
    this.#structure.restoreOpen(preferences.rightColumnOpen);
    this.#structure.selectTab(preferences.rightColumnTab);
    this.#layout.restore(preferences.panelWidths);
  }

  private currentPreferences(): Preferences {
    const state = this.#player.getState();
    return {
      volume: state.volume,
      muted: state.isMuted,
      repeatMode: state.repeatMode,
      rightColumnOpen: this.#structure.isOpen,
      rightColumnTab: this.#structure.tab,
      panelWidths: this.#layout.widths,
      shuffle: state.isShuffled,
    };
  }

  private savePreferences(): void {
    if (this.#isRestoring || this.#isResetting) {
      return;
    }
    const preferences = this.currentPreferences();
    const serialized = JSON.stringify(preferences);
    if (serialized !== this.#savedPreferences) {
      this.#savedPreferences = serialized;
      this.#storage.savePreferences(preferences);
    }
  }

  private saveStructure(): void {
    if (!this.#isResetting) {
      this.#storage.saveState(this.#manager.toStoredState());
    }
  }

  private async refreshStorageUsage(): Promise<void> {
    this.#sidebar.setStorageUsage(await this.#audioStore.usage());
  }

  private async clearAllData(): Promise<void> {
    this.#isResetting = true;
    this.#player.clearContext();
    await this.#audioStore.clear();
    this.#storage.clear();
    window.location.reload();
  }

  private bindSidebar(): void {
    this.#sidebar.onPlaylistSelected((id) => this.run(() => this.showPlaylist(id)));
    this.#sidebar.onExploreSelected(() => this.run(() => this.showExplore()));
    this.#sidebar.onCreatePlaylist((name) => this.createPlaylist(name));
    this.#sidebar.onFilesChosen((files) => void this.loadFiles(files));
    this.#sidebar.onClearData(() => void this.clearAllData());
  }

  private bindExplore(): void {
    const view = this.#explorer;
    const session = this.#explore;
    session.onChange(() => this.render());
    view.onSearch((query) => session.search(query));
    view.onGenre((genre) => session.chooseGenre(genre));
    view.onRetry(() => session.retry());
    view.onPlay((node) => this.run(() => this.#player.playFrom(session.playlist, node)));
    view.onAddSong((request) => this.run(() => this.addSong(request)));
  }

  private bindTrackList(): void {
    const list = this.#trackList;
    list.onPlay((id, node) => this.run(() => this.play(id, node)));
    list.onPlayPlaylist((id) => this.run(() => this.playPlaylist(id)));
    list.onMoveNode((id, node, direction) => this.run(() => this.moveNode(id, node, direction)));
    list.onMoveToPosition((id, node, position) => this.run(() => this.moveToPosition(id, node, position)));
    list.onDropOnPlaylist((targetId, node) => this.run(() => this.dropOnPlaylist(targetId, node)));
    list.onFilesAdded((id, files, position) => void this.loadFiles(files, this.placementFor(id, position)));
    list.onToggleShuffle(() => this.#player.toggleShuffle());
    list.onAddSongs((request) => this.run(() => this.addSongs(request)));
    list.onRemoveNode((id, node) => this.run(() => this.removeNode(id, node)));
    list.onRemoveFromLibrary((song) => this.run(() => this.removeFromLibrary(song)));
    list.onAddSong((request) => this.run(() => this.addSong(request)));
    list.onRenamePlaylist((id, name) => this.renamePlaylist(id, name));
    list.onDuplicatePlaylist((id) => this.run(() => this.duplicatePlaylist(id)));
    list.onDeletePlaylist((id) => this.run(() => this.deletePlaylist(id)));
    list.onLoadRequested((kind) => this.#sidebar.openPicker(kind));
  }

  private bindPlayerBar(bar: PlayerBarView): void {
    const player = this.#player;
    bar.onPrevious(() => player.previous());
    bar.onTogglePlay(() => player.togglePlayPause());
    bar.onNext(() => player.next());
    bar.onCycleRepeat(() => player.cycleRepeatMode());
    bar.onToggleShuffle(() => player.toggleShuffle());
    bar.onToggleMute(() => player.toggleMute());
    bar.onSeek((seconds) => player.seek(seconds));
    bar.onVolumeChange((volume) => player.setVolume(volume));
    bar.onToggleNowPlaying(() => this.toggleNowPlaying());
    bar.onToggleRightColumn(() => this.toggleRightColumn());
  }

  private bindNowPlaying(): void {
    const view = this.#nowPlaying;
    view.onPlayNode((node) => this.run(() => this.playInContext(node)));
    view.onSeek((seconds) => this.#player.seek(seconds));
    view.onLyricsRequested((song) => void this.loadLyrics(song));
    view.onVisibilityChange((isOpen) => {
      this.#playerBar.setNowPlayingOpen(isOpen);
      this.#nowPlayingBar.setNowPlayingOpen(isOpen);
    });
  }

  private bindRightColumn(): void {
    const showOpen = (isOpen: boolean): void => {
      this.#playerBar.setRightColumnOpen(isOpen);
      this.#nowPlayingBar.setRightColumnOpen(isOpen);
      this.#layout.setRightOpen(isOpen);
    };
    this.#nowPlayingPanel.onPlayNode((node) => this.run(() => this.playInContext(node)));
    this.#nowPlayingPanel.onExpand(() => this.#nowPlaying.open());
    this.#nowPlayingPanel.onViewAll(() => this.#nowPlaying.open("queue"));
    this.#structure.onPlayNode((playlist, node) => this.run(() => this.#player.playFrom(playlist, node)));
    this.#structure.onVisibilityChange((isOpen) => {
      showOpen(isOpen);
      this.savePreferences();
    });
    this.#structure.onTabChange(() => this.savePreferences());
    this.#layout.onCommit(() => this.savePreferences());
    showOpen(this.#structure.isOpen);
  }

  private bindShortcuts(): void {
    const player = this.#player;
    new KeyboardShortcuts({
      togglePlay: () => player.togglePlayPause(),
      next: () => player.next(),
      previous: () => player.previous(),
      seekBy: (seconds) => player.seekBy(seconds),
      changeVolume: (delta) => player.changeVolume(delta),
      toggleMute: () => player.toggleMute(),
      toggleShuffle: () => player.toggleShuffle(),
      cycleRepeat: () => player.cycleRepeatMode(),
      toggleNowPlaying: () => this.toggleNowPlayingIfPossible(),
      toggleRightColumn: () => this.toggleRightColumn(),
      focusSearch: () => this.focusSearch(),
      showHelp: () => this.#shortcutsDialog.open(),
    });
    this.#sidebar.onShortcutsRequested(() => this.#shortcutsDialog.open());
  }

  private focusSearch(): void {
    if (this.#isExploring) {
      this.#explorer.focusSearch();
    } else {
      this.#trackList.focusSearch();
    }
  }

  private toggleNowPlayingIfPossible(): void {
    if (this.#nowPlaying.isOpen || this.#player.getState().song !== null) {
      this.toggleNowPlaying();
    }
  }

  private bindPlayer(): void {
    this.#player.onStateChange((state) => this.showPlayerState(state));
    this.#player.onProgress((currentTime, duration) => this.showProgress(currentTime, duration));
    this.#player.onError((code, song) => this.#notifications.show(App.playerErrorMessage(code, song), "error"));
  }

  private run(action: () => void): void {
    try {
      action();
    } catch {
      this.#notifications.show("No se pudo completar la acción", "error");
    }
    this.render();
  }

  private render(): void {
    const playlists = [...this.#manager.userPlaylists()];
    const visible = this.#manager.visiblePlaylist;
    this.#sidebar.render({ library: this.#manager.library, playlists, visibleId: visible.id, isExploring: this.#isExploring });
    this.renderExplore(playlists);
    this.#trackList.render({ playlist: visible, library: this.#manager.library, playlists, isLoading: this.#isLoading });
    this.#nowPlaying.invalidateQueue();
    this.#nowPlayingPanel.invalidate();
    this.#notifications.setReconnectBannerVisible(this.#manager.hasUnavailableSongs());
    this.showPlayerState(this.#player.getState());
  }

  private renderExplore(playlists: readonly Playlist[]): void {
    const session = this.#explore;
    App.element("main").hidden = this.#isExploring;
    this.#explorer.setVisible(this.#isExploring);
    this.#explorer.render({
      status: session.status,
      playlist: session.playlist,
      query: session.query,
      genre: session.genre,
      destinations: [this.#manager.library, ...playlists],
    });
  }

  private showPlaylist(id: string): void {
    this.#isExploring = false;
    this.#manager.setVisible(id);
  }

  private showExplore(): void {
    this.#isExploring = true;
    this.#explore.start();
  }

  private showPlayerState(state: PlayerState): void {
    this.#playerBar.render(state);
    this.#nowPlayingBar.render(state);
    const context = this.#player.context;
    this.#nowPlaying.render(state, context);
    this.#nowPlayingPanel.render(state, context);
    const source = this.#player.source;
    this.#trackList.setPlayback(source, state.isPlaying, state.isShuffled);
    this.#sidebar.setPlayback(source?.id ?? null, state.isPlaying, source !== null && this.#explore.owns(source));
    this.#explorer.setPlayback(source, state.isPlaying);
    this.#structure.render(this.structureSubject(context), context);
    document.title = App.documentTitle(state);
    this.savePreferences();
  }

  private structureSubject(context: Playlist | null): Playlist {
    if (this.#isExploring) {
      return this.#explore.playlist;
    }
    const visible = this.#manager.visiblePlaylist;
    const isShuffledView = context !== null && context !== visible && this.#player.source === visible;
    return isShuffledView ? context : visible;
  }

  private showProgress(currentTime: number, duration: number): void {
    this.#playerBar.updateProgress(currentTime, duration);
    this.#nowPlayingBar.updateProgress(currentTime, duration);
    this.#nowPlaying.updateProgress(currentTime);
  }

  private toggleNowPlaying(): void {
    if (this.#nowPlaying.isOpen) {
      this.#nowPlaying.close();
    } else {
      this.#nowPlaying.open();
    }
  }

  private toggleRightColumn(): void {
    if (this.#nowPlaying.isOpen) {
      this.#nowPlaying.close();
      this.#structure.open();
    } else {
      this.#structure.toggle();
    }
  }

  private playInContext(node: Node<Song>): void {
    const context = this.#player.context;
    if (context !== null) {
      this.#player.playFrom(context, node);
    }
  }

  private async loadLyrics(song: Song): Promise<void> {
    const result = await this.#lyrics.getLyrics(song);
    this.#nowPlaying.showLyrics(song, result);
  }

  private play(playlistId: string, node: Node<Song>): void {
    const playlist = this.#manager.getPlaylist(playlistId);
    if (playlist !== null) {
      this.#player.playFrom(playlist, node);
    }
  }

  private playPlaylist(playlistId: string): void {
    const playlist = this.#manager.getPlaylist(playlistId);
    if (playlist === null) {
      return;
    }
    if (playlist === this.#player.source) {
      this.#player.togglePlayPause();
      return;
    }
    const start = App.firstPlayable(playlist);
    if (start !== null) {
      this.#player.playFrom(playlist, start);
    }
  }

  private createPlaylist(name: string): PlaylistNameIssue | null {
    const issue = this.#manager.checkName(name);
    if (issue === null) {
      const playlist = this.#manager.createPlaylist(name);
      this.saveStructure();
      this.run(() => this.showPlaylist(playlist.id));
      this.#notifications.show(`Playlist «${playlist.name}» creada`, "success");
    }
    return issue;
  }

  private renamePlaylist(id: string, name: string): PlaylistNameIssue | null {
    const issue = this.#manager.checkName(name, id);
    if (issue === null) {
      this.run(() => {
        this.#manager.renamePlaylist(id, name);
        this.saveStructure();
      });
    }
    return issue;
  }

  private deletePlaylist(id: string): void {
    const playlist = this.#manager.getPlaylist(id);
    if (playlist === null) {
      return;
    }
    if (playlist === this.#player.source) {
      this.#player.clearContext();
    }
    this.#manager.deletePlaylist(id);
    this.saveStructure();
    this.#notifications.show(`Playlist «${playlist.name}» eliminada`, "info");
  }

  private duplicatePlaylist(id: string): void {
    const copy = this.#manager.duplicatePlaylist(id);
    this.showPlaylist(copy.id);
    this.saveStructure();
    this.#notifications.show(`Se creó «${copy.name}»`, "success");
  }

  private addSong(request: AddSongRequest): void {
    const playlist = this.#manager.getPlaylist(request.playlistId);
    if (playlist === null) {
      return;
    }
    const song = request.song;
    if (playlist.isLibrary && this.#manager.findByFingerprint(song.fingerprint) !== null) {
      this.#notifications.show(`«${song.title}» ya está en tu biblioteca`, "info");
      return;
    }
    const placed = playlist.isLibrary ? { song, isNew: false } : this.#manager.ensureInLibrary(song);
    const position = App.place(playlist, placed.song, request.placement);
    this.refreshIfContext(playlist);
    this.saveStructure();
    const target = placed.isNew ? `la biblioteca y a «${playlist.name}»` : `«${playlist.name}»`;
    this.#notifications.show(`«${song.title}» agregada a ${target} en la posición ${position}`, "success");
  }

  private moveNode(playlistId: string, node: Node<Song>, direction: MoveDirection): void {
    const playlist = this.#manager.getPlaylist(playlistId);
    if (playlist === null) {
      return;
    }
    if (direction === "up") {
      playlist.moveUp(node);
    } else {
      playlist.moveDown(node);
    }
    this.refreshIfContext(playlist);
    this.saveStructure();
  }

  private addSongs(request: AddSongsRequest): void {
    const playlist = this.#manager.getPlaylist(request.playlistId);
    if (playlist === null) {
      return;
    }
    let placement = request.placement;
    let added = 0;
    for (const node of this.#manager.library.nodes()) {
      if (request.songs.has(node.value)) {
        placement = { kind: "position", position: App.place(playlist, node.value, placement) + 1 };
        added++;
      }
    }
    this.refreshIfContext(playlist);
    this.saveStructure();
    this.#notifications.show(added === 1 ? "Se agregó 1 canción" : `Se agregaron ${added} canciones`, "success");
  }

  private moveToPosition(playlistId: string, node: Node<Song>, position: number): void {
    const playlist = this.#manager.getPlaylist(playlistId);
    if (playlist !== null) {
      playlist.moveToPosition(node, position);
      this.refreshIfContext(playlist);
      this.saveStructure();
    }
  }

  private dropOnPlaylist(targetId: string, node: Node<Song>): void {
    const playlist = this.#manager.getPlaylist(targetId);
    if (playlist !== null) {
      playlist.addAtEnd(node.value);
      this.refreshIfContext(playlist);
      this.saveStructure();
      this.#notifications.show(`Se agregó «${node.value.title}» a «${playlist.name}»`, "success");
    }
  }

  private placementFor(playlistId: string, position: number): TrackPlacement {
    const playlist = this.#manager.getPlaylist(playlistId);
    if (playlist === null) {
      return {};
    }
    return playlist.isLibrary ? { libraryPosition: position } : { destination: { playlist, position } };
  }

  private removeNode(playlistId: string, node: Node<Song>): void {
    const playlist = this.#manager.getPlaylist(playlistId);
    if (playlist !== null) {
      playlist.removeNode(node);
      this.refreshIfContext(playlist);
      this.saveStructure();
    }
  }

  private removeFromLibrary(song: Song): void {
    this.#manager.removeSongEverywhere(song);
    if (this.#player.context !== null) {
      this.#player.refresh();
    }
    this.saveStructure();
    void this.#audioStore.forget(song).then(() => this.refreshStorageUsage());
    this.#notifications.show(`«${song.title}» se quitó de la biblioteca`, "info");
  }

  private refreshIfContext(playlist: Playlist): void {
    if (playlist === this.#player.source) {
      this.#player.refresh();
    }
  }

  private async loadFiles(files: File[], placement: TrackPlacement = {}): Promise<void> {
    if (this.#isLoading) {
      return;
    }
    this.setLoading(true);
    try {
      const result = await this.#loader.load(files);
      const stored: Promise<void>[] = [];
      const counts = this.#manager.addTracks(result.tracks, (song, track) => stored.push(this.#audioStore.put(song.id, track)), placement);
      this.saveStructure();
      await Promise.all(stored);
      void this.refreshStorageUsage();
      this.#notifications.show(App.loadSummary(counts, result), counts.added + counts.reconnected > 0 ? "success" : "info");
    } catch {
      this.#notifications.show("No se pudieron cargar las canciones", "error");
    } finally {
      this.setLoading(false);
    }
  }

  private setLoading(isLoading: boolean): void {
    this.#isLoading = isLoading;
    this.#sidebar.setLoading(isLoading);
    if (isLoading) {
      this.#notifications.showProgress("Cargando canciones…");
    } else {
      this.#notifications.hideProgress();
    }
    this.render();
  }

  private static firstPlayable(playlist: Playlist): Node<Song> | null {
    let head: Node<Song> | null = null;
    for (const node of playlist.nodes()) {
      head ??= node;
      if (node.value.isAvailable()) {
        return node;
      }
    }
    return head;
  }

  private static place(playlist: Playlist, song: Song, placement: SongPlacement): number {
    if (placement.kind === "start") {
      playlist.addAtStart(song);
      return 1;
    }
    if (placement.kind === "end") {
      playlist.addAtEnd(song);
      return playlist.length;
    }
    playlist.addAtPosition(song, placement.position);
    return placement.position;
  }

  private static loadSummary(counts: AddTracksResult, result: LoadResult): string {
    const parts = [
      [counts.added, "agregada", "agregadas"],
      [counts.duplicated, "duplicada", "duplicadas"],
      [counts.reconnected, "reconectada", "reconectadas"],
      [result.rejected.length, "no compatible", "no compatibles"],
      [result.ignored, "ignorada", "ignoradas"],
    ] as const;
    const summary = parts
      .filter(([count]) => count > 0)
      .map(([count, singular, plural]) => countLabel(count, singular, plural))
      .join(" · ");
    return summary === "" ? "No se encontraron canciones" : `Canciones: ${summary}`;
  }

  private static playerErrorMessage(code: PlayerErrorCode, song: Song | null): string {
    return code === "playback-failed" && song?.isRemote === true ? REMOTE_PLAYBACK_ERROR : PLAYER_ERRORS[code];
  }

  private static documentTitle(state: PlayerState): string {
    if (state.song === null) {
      return APP_NAME;
    }
    const prefix = state.isPlaying ? "▶ " : "";
    return `${prefix}${state.song.title} · ${APP_NAME}`;
  }

  private static element(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (element === null) {
      throw new Error(`Missing element #${id}`);
    }
    return element;
  }
}
