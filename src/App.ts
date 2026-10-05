import { countLabel } from "./format";
import { MusicPlayer } from "./MusicPlayer";
import type { Node } from "./Node";
import { NotificationView } from "./NotificationView";
import { PlayerBarView } from "./PlayerBarView";
import type { Playlist } from "./Playlist";
import { PlaylistManager } from "./PlaylistManager";
import { SidebarView } from "./SidebarView";
import type { Song } from "./Song";
import { SongLoader } from "./SongLoader";
import { TrackListView, type AddSongRequest, type SongPlacement } from "./TrackListView";
import type { AddTracksResult, LoadResult, PlayerErrorCode, PlayerState, PlaylistNameIssue } from "./types";

const APP_NAME = "Musongs";

const PLAYER_ERRORS: Record<PlayerErrorCode, string> = {
  unavailable: "Esta canción no está disponible",
  "playback-failed": "No se pudo reproducir este archivo",
};

export class App {
  readonly #manager = new PlaylistManager();
  readonly #loader = new SongLoader();
  readonly #player = MusicPlayer.getInstance();
  readonly #sidebar = new SidebarView(App.element("sidebar"), App.element("top-bar"), App.element("drawer-backdrop"));
  readonly #trackList = new TrackListView(App.element("main"));
  readonly #playerBar = new PlayerBarView(App.element("player-bar"));
  readonly #notifications = new NotificationView(App.element("notifications"));
  #context: Playlist | null = null;
  #isLoading = false;

  start(): void {
    this.bindSidebar();
    this.bindTrackList();
    this.bindPlayerBar();
    this.bindPlayer();
    this.render();
    this.showPlayerState(this.#player.getState());
  }

  private bindSidebar(): void {
    this.#sidebar.onPlaylistSelected((id) => this.run(() => this.#manager.setVisible(id)));
    this.#sidebar.onCreatePlaylist((name) => this.createPlaylist(name));
    this.#sidebar.onFilesChosen((files) => void this.loadFiles(files));
  }

  private bindTrackList(): void {
    const list = this.#trackList;
    list.onPlay((id, node) => this.run(() => this.play(id, node)));
    list.onRemoveNode((id, node) => this.run(() => this.removeNode(id, node)));
    list.onRemoveFromLibrary((song) => this.run(() => this.removeFromLibrary(song)));
    list.onAddSong((request) => this.run(() => this.addSong(request)));
    list.onRenamePlaylist((id, name) => this.renamePlaylist(id, name));
    list.onDeletePlaylist((id) => this.run(() => this.deletePlaylist(id)));
    list.onLoadRequested((kind) => this.#sidebar.openPicker(kind));
  }

  private bindPlayerBar(): void {
    const bar = this.#playerBar;
    const player = this.#player;
    bar.onPrevious(() => player.previous());
    bar.onTogglePlay(() => player.togglePlayPause());
    bar.onNext(() => player.next());
    bar.onToggleMute(() => player.toggleMute());
    bar.onSeek((seconds) => player.seek(seconds));
    bar.onVolumeChange((volume) => player.setVolume(volume));
  }

  private bindPlayer(): void {
    this.#player.onStateChange((state) => this.showPlayerState(state));
    this.#player.onProgress((currentTime, duration) => this.#playerBar.updateProgress(currentTime, duration));
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
    this.showPlayerState(this.#player.getState());
  }

  private showPlayerState(state: PlayerState): void {
    this.#playerBar.render(state);
    this.#trackList.setPlayback(this.#context?.current ?? null, state.isPlaying);
    this.#sidebar.setPlayback(this.#context?.id ?? null, state.isPlaying);
    document.title = App.documentTitle(state);
  }

  private play(playlistId: string, node: Node<Song>): void {
    const playlist = this.#manager.getPlaylist(playlistId);
    if (playlist !== null) {
      this.#context = playlist;
      this.#player.playFrom(playlist, node);
    }
  }

  private createPlaylist(name: string): PlaylistNameIssue | null {
    const issue = this.#manager.checkName(name);
    if (issue === null) {
      const playlist = this.#manager.createPlaylist(name);
      this.run(() => this.#manager.setVisible(playlist.id));
      this.#notifications.show(`Playlist «${playlist.name}» creada`, "success");
    }
    return issue;
  }

  private renamePlaylist(id: string, name: string): PlaylistNameIssue | null {
    const issue = this.#manager.checkName(name, id);
    if (issue === null) {
      this.run(() => this.#manager.renamePlaylist(id, name));
    }
    return issue;
  }

  private deletePlaylist(id: string): void {
    const playlist = this.#manager.getPlaylist(id);
    if (playlist === null) {
      return;
    }
    if (playlist === this.#context) {
      this.#player.clearContext();
      this.#context = null;
    }
    this.#manager.deletePlaylist(id);
    this.#notifications.show(`Playlist «${playlist.name}» eliminada`, "info");
  }

  private addSong(request: AddSongRequest): void {
    const playlist = this.#manager.getPlaylist(request.playlistId);
    if (playlist === null) {
      return;
    }
    const position = App.place(playlist, request.song, request.placement);
    this.refreshIfContext(playlist);
    this.#notifications.show(`«${request.song.title}» agregada a «${playlist.name}» en la posición ${position}`, "success");
  }

  private removeNode(playlistId: string, node: Node<Song>): void {
    const playlist = this.#manager.getPlaylist(playlistId);
    if (playlist !== null) {
      playlist.removeNode(node);
      this.refreshIfContext(playlist);
    }
  }

  private removeFromLibrary(song: Song): void {
    this.#manager.removeSongEverywhere(song);
    if (this.#context !== null) {
      this.#player.refresh();
    }
    this.#notifications.show(`«${song.title}» se quitó de la biblioteca`, "info");
  }

  private refreshIfContext(playlist: Playlist): void {
    if (playlist === this.#context) {
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
      const counts = this.#manager.addTracks(result.tracks);
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
