import { formatElapsed, formatTime } from "./format";
import { createIconButton, setButtonIcon, setCover, type IconName } from "./icons";
import type { Song } from "./Song";
import type { PlayerState, RepeatMode } from "./types";

type ActionHandler = () => void;
type ValueHandler = (value: number) => void;

const EMPTY_TITLE = "Elige una canción";
const UNKNOWN_ARTIST = "Artista desconocido";

const REPEAT_BUTTONS: Record<RepeatMode, { icon: IconName; label: string }> = {
  off: { icon: "repeat", label: "Repetir: desactivado" },
  all: { icon: "repeat", label: "Repetir: toda la lista" },
  one: { icon: "repeatOne", label: "Repetir: una canción" },
};

export class PlayerBarView {
  readonly #now = Object.assign(document.createElement("div"), { className: "player-now" });
  readonly #expand = createIconButton("chevronUp", "Abrir reproduciendo ahora", "icon-button player-expand");
  readonly #cover = Object.assign(document.createElement("div"), { className: "cover player-cover" });
  readonly #title = Object.assign(document.createElement("p"), { className: "player-title" });
  readonly #artist = Object.assign(document.createElement("p"), { className: "player-artist" });
  readonly #previous = createIconButton("previous", "Anterior", "icon-button player-step");
  readonly #toggle = createIconButton("play", "Reproducir", "icon-button play-button player-toggle");
  readonly #next = createIconButton("next", "Siguiente", "icon-button player-step");
  readonly #repeat = createIconButton("repeat", REPEAT_BUTTONS.off.label, "icon-button player-repeat");
  readonly #elapsed = Object.assign(document.createElement("span"), { className: "player-time" });
  readonly #total = Object.assign(document.createElement("span"), { className: "player-time" });
  readonly #seek = PlayerBarView.createRange("Progreso de la canción", "player-seek");
  readonly #mute = createIconButton("volume", "Silenciar", "icon-button player-mute");
  readonly #volume = PlayerBarView.createRange("Volumen", "player-volume-range");
  readonly #structure = createIconButton("structure", "Mostrar estructura", "icon-button player-structure");
  #isSeeking = false;
  #coverUrl: string | null | undefined;
  #repeatMode: RepeatMode | null = null;
  #previousHandler: ActionHandler = () => {};
  #toggleHandler: ActionHandler = () => {};
  #nextHandler: ActionHandler = () => {};
  #repeatHandler: ActionHandler = () => {};
  #nowPlayingHandler: ActionHandler = () => {};
  #structureHandler: ActionHandler = () => {};
  #muteHandler: ActionHandler = () => {};
  #seekHandler: ValueHandler = () => {};
  #volumeHandler: ValueHandler = () => {};

  constructor(root: HTMLElement) {
    this.#volume.max = "1";
    this.#structure.setAttribute("aria-pressed", "false");
    root.append(this.createNowPlaying(), this.createCenter(), this.createExtras());
    this.registerEvents();
  }

  onPrevious(handler: ActionHandler): void {
    this.#previousHandler = handler;
  }

  onTogglePlay(handler: ActionHandler): void {
    this.#toggleHandler = handler;
  }

  onNext(handler: ActionHandler): void {
    this.#nextHandler = handler;
  }

  onCycleRepeat(handler: ActionHandler): void {
    this.#repeatHandler = handler;
  }

  onToggleNowPlaying(handler: ActionHandler): void {
    this.#nowPlayingHandler = handler;
  }

  setNowPlayingOpen(isOpen: boolean): void {
    setButtonIcon(this.#expand, isOpen ? "chevronDown" : "chevronUp", isOpen ? "Cerrar reproduciendo ahora" : "Abrir reproduciendo ahora");
    this.#expand.setAttribute("aria-expanded", String(isOpen));
  }

  onToggleStructure(handler: ActionHandler): void {
    this.#structureHandler = handler;
  }

  setStructureOpen(isOpen: boolean): void {
    setButtonIcon(this.#structure, "structure", isOpen ? "Ocultar estructura" : "Mostrar estructura");
    this.#structure.setAttribute("aria-pressed", String(isOpen));
  }

  onToggleMute(handler: ActionHandler): void {
    this.#muteHandler = handler;
  }

  onSeek(handler: ValueHandler): void {
    this.#seekHandler = handler;
  }

  onVolumeChange(handler: ValueHandler): void {
    this.#volumeHandler = handler;
  }

  render(state: PlayerState): void {
    this.renderSong(state.song);
    this.renderControls(state);
    this.renderRepeat(state.repeatMode);
    this.renderVolume(state.volume, state.isMuted);
    this.updateProgress(state.currentTime, state.duration);
  }

  updateProgress(currentTime: number, duration: number): void {
    this.#total.textContent = formatTime(duration);
    if (this.#isSeeking) {
      return;
    }
    this.#seek.max = String(Math.max(duration, 0));
    this.#seek.value = String(currentTime);
    this.showSeekPosition(currentTime, duration);
  }

  private renderSong(song: Song | null): void {
    this.#title.textContent = song?.title ?? EMPTY_TITLE;
    this.#artist.textContent = song === null ? "" : song.artist || UNKNOWN_ARTIST;
    this.#title.title = song?.title ?? "";
    this.renderCover(song?.coverUrl ?? null);
  }

  private renderCover(url: string | null): void {
    if (url !== this.#coverUrl) {
      this.#coverUrl = url;
      setCover(this.#cover, url);
    }
  }

  private renderRepeat(mode: RepeatMode): void {
    if (mode === this.#repeatMode) {
      return;
    }
    this.#repeatMode = mode;
    const { icon, label } = REPEAT_BUTTONS[mode];
    setButtonIcon(this.#repeat, icon, label);
    this.#repeat.classList.toggle("is-active", mode !== "off");
  }

  private renderControls(state: PlayerState): void {
    const hasSong = state.song !== null;
    this.#toggle.disabled = !hasSong;
    this.#expand.disabled = !hasSong;
    this.#now.classList.toggle("is-openable", hasSong);
    this.#seek.disabled = !hasSong;
    setButtonIcon(this.#toggle, state.isPlaying ? "pause" : "play", state.isPlaying ? "Pausar" : "Reproducir");
    PlayerBarView.renderStep(this.#previous, hasSong && state.hasPrevious, hasSong ? "Es la primera canción" : "Anterior", "Anterior");
    PlayerBarView.renderStep(this.#next, hasSong && state.hasNext, hasSong ? "Es la última canción" : "Siguiente", "Siguiente");
  }

  private renderVolume(volume: number, isMuted: boolean): void {
    const shown = isMuted ? 0 : volume;
    this.#volume.value = String(shown);
    this.#volume.setAttribute("aria-valuetext", `${Math.round(shown * 100)} %`);
    PlayerBarView.setFill(this.#volume, shown);
    setButtonIcon(this.#mute, isMuted ? "muted" : "volume", isMuted ? "Activar sonido" : "Silenciar");
    this.#mute.setAttribute("aria-pressed", String(isMuted));
  }

  private showSeekPosition(currentTime: number, duration: number): void {
    this.#elapsed.textContent = formatElapsed(currentTime);
    this.#seek.setAttribute("aria-valuetext", `${formatElapsed(currentTime)} de ${formatTime(duration)}`);
    PlayerBarView.setFill(this.#seek, duration > 0 ? currentTime / duration : 0);
  }

  private createNowPlaying(): HTMLDivElement {
    const meta = Object.assign(document.createElement("div"), { className: "player-meta" });
    meta.append(this.#title, this.#artist);
    this.#expand.setAttribute("aria-expanded", "false");
    this.#now.append(this.#cover, meta, this.#expand);
    return this.#now;
  }

  private createCenter(): HTMLDivElement {
    const center = Object.assign(document.createElement("div"), { className: "player-center" });
    const controls = Object.assign(document.createElement("div"), { className: "player-controls" });
    const timeline = Object.assign(document.createElement("div"), { className: "player-timeline" });
    controls.append(this.#previous, this.#toggle, this.#next, this.#repeat);
    timeline.append(this.#elapsed, this.#seek, this.#total);
    center.append(controls, timeline);
    return center;
  }

  private createExtras(): HTMLDivElement {
    const extras = Object.assign(document.createElement("div"), { className: "player-extras" });
    const volume = Object.assign(document.createElement("div"), { className: "player-volume" });
    volume.append(this.#mute, this.#volume);
    extras.append(this.#structure, volume);
    return extras;
  }

  private registerEvents(): void {
    this.#previous.addEventListener("click", () => this.#previousHandler());
    this.#toggle.addEventListener("click", () => this.#toggleHandler());
    this.#next.addEventListener("click", () => this.#nextHandler());
    this.#repeat.addEventListener("click", () => this.#repeatHandler());
    this.#now.addEventListener("click", () => this.requestNowPlaying());
    this.#structure.addEventListener("click", () => this.#structureHandler());
    this.#mute.addEventListener("click", () => this.#muteHandler());
    this.#volume.addEventListener("input", () => this.#volumeHandler(this.#volume.valueAsNumber));
    this.#seek.addEventListener("input", () => this.previewSeek());
    this.#seek.addEventListener("change", () => this.commitSeek());
  }

  private requestNowPlaying(): void {
    if (!this.#expand.disabled) {
      this.#nowPlayingHandler();
    }
  }

  private previewSeek(): void {
    this.#isSeeking = true;
    this.showSeekPosition(this.#seek.valueAsNumber, Number(this.#seek.max));
  }

  private commitSeek(): void {
    this.#isSeeking = false;
    this.#seekHandler(this.#seek.valueAsNumber);
  }

  private static renderStep(button: HTMLButtonElement, isEnabled: boolean, disabledHint: string, label: string): void {
    button.disabled = !isEnabled;
    button.title = isEnabled ? label : disabledHint;
  }

  private static setFill(range: HTMLInputElement, ratio: number): void {
    const percent = Math.min(Math.max(ratio, 0), 1) * 100;
    range.style.setProperty("--fill", `${percent}%`);
  }

  private static createRange(label: string, className: string): HTMLInputElement {
    const range = Object.assign(document.createElement("input"), {
      type: "range",
      className: `range ${className}`,
      min: "0",
      max: "0",
      step: "any",
      value: "0",
    });
    range.setAttribute("aria-label", label);
    return range;
  }
}
