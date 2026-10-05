import { AudioStore } from "./AudioStore";
import { countLabel } from "./format";
import { LyricsService } from "./LyricsService";
import { MusicPlayer } from "./MusicPlayer";
import type { Node } from "./Node";
import { NotificationView } from "./NotificationView";
import { NowPlayingPanelView } from "./NowPlayingPanelView";
import { NowPlayingView } from "./NowPlayingView";
import { PlayerBarView } from "./PlayerBarView";
import type { Playlist } from "./Playlist";
import { PlaylistManager } from "./PlaylistManager";
import { PlaylistStorage } from "./PlaylistStorage";
import { SidebarView } from "./SidebarView";
import type { Song } from "./Song";
import { SongLoader } from "./SongLoader";
import { StructurePanelView } from "./StructurePanelView";
import { TrackListView, type AddSongRequest, type SongPlacement } from "./TrackListView";
import type { AddTracksResult, LoadResult, MoveDirection, PlayerErrorCode, PlayerState, PlaylistNameIssue, Preferences } from "./types";

const APP_NAME = "Musongs";

const PLAYER_ERRORS: Record<PlayerErrorCode, string> = {
  unavailable: "Esta canción no está disponible",
  "playback-failed": "No se pudo reproducir este archivo",
};

export class App {
  readonly #manager = new PlaylistManager();
  readonly #loader = new SongLoader();
  readonly #player = MusicPlayer.getInstance();
  readonly #lyrics = new LyricsService();
  readonly #sidebar = new SidebarView(App.element("sidebar"), App.element("top-bar"), App.element("drawer-backdrop"));
  readonly #trackList = new TrackListView(App.element("main"));
  readonly #playerBar = new PlayerBarView(App.element("player-bar"));
  readonly #nowPlaying = new NowPlayingView(App.element("now-playing"), App.element("app-shell"), [
    App.element("top-bar"),
    App.element("sidebar"),
    App.element("drawer-backdrop"),
    App.element("main"),
    App.element("structure-backdrop"),
    App.element("structure-panel"),
  ]);
  readonly #structure = new StructurePanelView(App.element("structure-panel"), App.element("structure-backdrop"));
  readonly #nowPlayingPanel = new NowPlayingPanelView(this.#structure.nowPlayingSlot);
  readonly #nowPlayingBar = new PlayerBarView(this.#nowPlaying.controlsSlot);
  readonly #notifications = new NotificationView(App.element("notifications"));
  readonly #storage = new PlaylistStorage();
  readonly #audioStore = new AudioStore();
  #isLoading = false;
  #isRestoring = true;
  #isResetting = false;
  #savedPreferences = "";

  async start(): Promise<void> {
    this.bindStorage();
    this.bindSidebar();
    this.bindTrackList();
    this.bindPlayerBar(this.#playerBar);
    this.bindPlayerBar(this.#nowPlayingBar);
    this.bindNowPlaying();
    this.bindRightColumn();
    this.bindPlayer();
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
      await this.reattachStoredMedia();
    }
    this.applyPreferences(this.#storage.loadPreferences());
    this.#isRestoring = false;
    this.#savedPreferences = JSON.stringify(this.currentPreferences());
  }

  private async reattachStoredMedia(): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const node of this.#manager.library.nodes()) {
      pending.push(this.reattach(node.value));
    }
    await Promise.all(pending);
  }

  private async reattach(song: Song): Promise<void> {
    const media = await this.#audioStore.get(song.id);
    if (media !== null) {
      song.attachFile(media);
    }
  }

  private applyPreferences(preferences: Preferences | null): void {
    if (preferences === null) {
      return;
    }
    this.#player.setVolume(preferences.volume);
    this.#player.setMuted(preferences.muted);
    this.#player.setRepeatMode(preferences.repeatMode);
    this.#structure.restoreOpen(preferences.rightColumnOpen);
    this.#structure.selectTab(preferences.rightColumnTab);
  }

  private currentPreferences(): Preferences {
    const state = this.#player.getState();
    return {
      volume: state.volume,
      muted: state.isMuted,
      repeatMode: state.repeatMode,
      rightColumnOpen: this.#structure.isOpen,
      rightColumnTab: this.#structure.tab,
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
    this.#sidebar.onPlaylistSelected((id) => this.run(() => this.#manager.setVisible(id)));
    this.#sidebar.onCreatePlaylist((name) => this.createPlaylist(name));
    this.#sidebar.onFilesChosen((files) => void this.loadFiles(files));
    this.#sidebar.onClearData(() => void this.clearAllData());
  }

  private bindTrackList(): void {
    const list = this.#trackList;
    list.onPlay((id, node) => this.run(() => this.play(id, node)));
    list.onPlayPlaylist((id) => this.run(() => this.playPlaylist(id)));
    list.onMoveNode((id, node, direction) => this.run(() => this.moveNode(id, node, direction)));
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
    showOpen(this.#structure.isOpen);
  }

  private bindPlayer(): void {
    this.#player.onStateChange((state) => this.showPlayerState(state));
    this.#player.onProgress((currentTime, duration) => this.showProgress(currentTime, duration));
    this.#player.onError((code) => this.#notifications.show(PLAYER_ERRORS[code], "error"));
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
    this.#sidebar.render({ library: this.#manager.library, playlists, visibleId: visible.id });
    this.#trackList.render({ playlist: visible, library: this.#manager.library, playlists, isLoading: this.#isLoading });
    this.#nowPlaying.invalidateQueue();
    this.#nowPlayingPanel.invalidate();
    this.#notifications.setReconnectBannerVisible(this.#manager.hasUnavailableSongs());
    this.showPlayerState(this.#player.getState());
  }

  private showPlayerState(state: PlayerState): void {
    this.#playerBar.render(state);
    this.#nowPlayingBar.render(state);
    const context = this.#player.context;
    this.#nowPlaying.render(state, context);
    this.#nowPlayingPanel.render(state, context);
    this.#trackList.setPlayback(context, state.isPlaying);
    this.#sidebar.setPlayback(context?.id ?? null, state.isPlaying);
    this.#structure.render(this.#manager.visiblePlaylist, context);
    document.title = App.documentTitle(state);
    this.savePreferences();
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
    if (playlist === this.#player.context) {
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
      this.run(() => this.#manager.setVisible(playlist.id));
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
    if (playlist === this.#player.context) {
      this.#player.clearContext();
    }
    this.#manager.deletePlaylist(id);
    this.saveStructure();
    this.#notifications.show(`Playlist «${playlist.name}» eliminada`, "info");
  }

  private duplicatePlaylist(id: string): void {
    const copy = this.#manager.duplicatePlaylist(id);
    this.#manager.setVisible(copy.id);
    this.saveStructure();
    this.#notifications.show(`Se creó «${copy.name}»`, "success");
  }

  private addSong(request: AddSongRequest): void {
    const playlist = this.#manager.getPlaylist(request.playlistId);
    if (playlist === null) {
      return;
    }
    const position = App.place(playlist, request.song, request.placement);
    this.refreshIfContext(playlist);
    this.saveStructure();
    this.#notifications.show(`«${request.song.title}» agregada a «${playlist.name}» en la posición ${position}`, "success");
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
    void this.#audioStore.delete(song.id).then(() => this.refreshStorageUsage());
    this.#notifications.show(`«${song.title}» se quitó de la biblioteca`, "info");
  }

  private refreshIfContext(playlist: Playlist): void {
    if (playlist === this.#player.context) {
      this.#player.refresh();
    }
  }

  private async loadFiles(files: File[]): Promise<void> {
    if (this.#isLoading) {
      return;
    }
    this.setLoading(true);
    try {
      const result = await this.#loader.load(files);
      const stored: Promise<void>[] = [];
      const counts = this.#manager.addTracks(result.tracks, (song, track) => stored.push(this.#audioStore.put(song.id, track)));
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
