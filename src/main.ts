import "./styles.css";
import { MusicPlayer } from "./MusicPlayer";
import type { Node } from "./Node";
import { PlaylistManager } from "./PlaylistManager";
import type { Song } from "./Song";
import { SongLoader } from "./SongLoader";
import type { AddTracksResult, LoadResult, PlayerErrorCode, PlayerState } from "./types";

const ERROR_MESSAGES: Record<PlayerErrorCode, string> = {
  unavailable: "Esta canción no está disponible",
  "playback-failed": "No se pudo reproducir este archivo",
};

const manager = new PlaylistManager();
const loader = new SongLoader();
const player = MusicPlayer.getInstance();

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createButton(label: string, onClick: () => void, className = "test-button"): HTMLButtonElement {
  const button = createElement("button", className, label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function createRange(label: string, max: number, onInput: (value: number) => void): HTMLInputElement {
  const input = createElement("input", "test-range");
  input.type = "range";
  input.min = "0";
  input.max = String(max);
  input.step = "any";
  input.setAttribute("aria-label", label);
  input.addEventListener("input", () => onInput(input.valueAsNumber));
  return input;
}

function createFileInput(configure: (input: HTMLInputElement) => void): HTMLInputElement {
  const input = createElement("input", "test-file-input");
  input.type = "file";
  input.hidden = true;
  configure(input);
  input.addEventListener("change", () => void loadFiles(input));
  return input;
}

const summaryLine = createElement("p", "test-summary", "Selecciona canciones o una carpeta para empezar.");
const errorLine = createElement("p", "test-error");
const trackList = createElement("ol", "test-track-list");
const nowPlaying = createElement("p", "test-now-playing");
const timeLabel = createElement("span", "test-time");
const previousButton = createButton("Anterior", () => player.previous());
const toggleButton = createButton("Reproducir", () => player.togglePlayPause());
const nextButton = createButton("Siguiente", () => player.next());
const muteButton = createButton("Silenciar", () => player.toggleMute());
const seekInput = createRange("Posición de la canción", 0, (value) => player.seek(value));
const volumeInput = createRange("Volumen", 1, (value) => player.setVolume(value));
const filesInput = createFileInput((input) => {
  input.multiple = true;
  input.accept = "audio/*";
});
const folderInput = createFileInput((input) => {
  input.webkitdirectory = true;
});

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  return seconds > 0 ? formatTime(seconds) : "—:—";
}

async function loadFiles(input: HTMLInputElement): Promise<void> {
  const files = input.files;
  if (files === null || files.length === 0) {
    return;
  }
  summaryLine.textContent = "Cargando…";
  const result = await loader.load(files);
  input.value = "";
  showSummary(manager.addTracks(result.tracks), result);
  renderState(player.getState());
}

function showSummary(counts: AddTracksResult, result: LoadResult): void {
  summaryLine.textContent = [
    `Agregadas: ${counts.added}`,
    `Duplicadas: ${counts.duplicated}`,
    `Reconectadas: ${counts.reconnected}`,
    `No compatibles: ${result.rejected.length}`,
    `Ignoradas: ${result.ignored}`,
  ].join(" · ");
}

function removeSong(song: Song): void {
  manager.removeSongEverywhere(song);
  player.refresh();
  renderState(player.getState());
}

function createTrackRow(node: Node<Song>, position: number): HTMLLIElement {
  const song = node.value;
  const isCurrent = node === manager.library.current;
  const row = createElement("li", isCurrent ? "test-track is-current" : "test-track");
  const playButton = createButton("", () => player.playFrom(manager.library, node), "test-track-play");
  playButton.append(
    createElement("span", "test-track-position", String(position)),
    createElement("span", "test-track-title", song.title),
    createElement("span", "test-track-artist", song.artist || "Artista desconocido"),
    createElement("span", "test-track-duration", formatDuration(song.duration)),
  );
  row.append(playButton, createButton("Quitar", () => removeSong(song)));
  return row;
}

function renderTracks(): void {
  trackList.replaceChildren();
  let position = 1;
  for (const node of manager.library.nodes()) {
    trackList.append(createTrackRow(node, position));
    position++;
  }
  if (position === 1) {
    trackList.append(createElement("li", "test-empty", "La biblioteca está vacía."));
  }
}

function renderProgress(currentTime: number, duration: number): void {
  seekInput.max = String(duration);
  seekInput.value = String(currentTime);
  seekInput.disabled = duration === 0;
  timeLabel.textContent = `${formatTime(currentTime)} / ${formatDuration(duration)}`;
}

function renderState(state: PlayerState): void {
  previousButton.disabled = !state.hasPrevious;
  nextButton.disabled = !state.hasNext;
  toggleButton.disabled = state.song === null;
  toggleButton.textContent = state.isPlaying ? "Pausar" : "Reproducir";
  nowPlaying.textContent = state.song === null ? "Nada en reproducción" : state.song.title;
  muteButton.textContent = state.isMuted ? "Activar sonido" : "Silenciar";
  volumeInput.value = String(state.volume);
  if (state.isPlaying) {
    errorLine.textContent = "";
  }
  renderProgress(state.currentTime, state.duration);
  renderTracks();
}

function createHeader(): HTMLElement {
  const header = createElement("header", "test-header");
  header.append(
    createElement("h1", "test-title", "Musongs · página de prueba"),
    createButton("Cargar canciones", () => filesInput.click()),
    createButton("Cargar carpeta", () => folderInput.click()),
    filesInput,
    folderInput,
  );
  return header;
}

function createControls(): HTMLElement {
  const controls = createElement("section", "test-controls");
  controls.setAttribute("aria-label", "Controles de reproducción");
  controls.append(nowPlaying, previousButton, toggleButton, nextButton, timeLabel, seekInput, volumeInput, muteButton);
  return controls;
}

function mountTestPage(root: HTMLElement): void {
  const page = createElement("main", "test-page");
  page.append(createHeader(), summaryLine, errorLine, createControls(), trackList);
  root.replaceChildren(page);
  player.onStateChange(renderState);
  player.onProgress(renderProgress);
  player.onError((code) => {
    errorLine.textContent = ERROR_MESSAGES[code];
  });
  renderState(player.getState());
}

const appRoot = document.querySelector<HTMLElement>("#app");

if (appRoot) {
  mountTestPage(appRoot);
}
