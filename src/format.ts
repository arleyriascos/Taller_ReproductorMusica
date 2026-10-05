import type { PanelName, PanelWidths } from "./types";

const EMPTY_TIME = "—:—";
const BYTES_PER_MEGABYTE = 1024 * 1024;
const UNKNOWN_ARTIST = "Artista desconocido";

function isValidSeconds(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds > 0;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = twoDigits(whole % 60);
  return hours > 0 ? `${hours}:${twoDigits(minutes)}:${rest}` : `${minutes}:${rest}`;
}

export function formatTime(seconds: number): string {
  return isValidSeconds(seconds) ? clock(seconds) : EMPTY_TIME;
}

export function formatElapsed(seconds: number): string {
  return clock(isValidSeconds(seconds) ? seconds : 0);
}

export function formatTotal(seconds: number): string {
  const totalMinutes = isValidSeconds(seconds) ? Math.ceil(seconds / 60) : 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatMegabytes(bytes: number): string {
  const megabytes = Number.isFinite(bytes) && bytes > 0 ? bytes / BYTES_PER_MEGABYTE : 0;
  return megabytes.toFixed(1).replace(".", ",");
}

export function artistLabel(artist: string): string {
  return artist === "" ? UNKNOWN_ARTIST : artist;
}

export function comparableText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/(?<!n)̃|[̀-̂̄-ͯ]/g, "")
    .normalize("NFC");
}

export const DEFAULT_PANEL_WIDTHS: PanelWidths = { sidebar: 240, right: 340 };
export const PANEL_LIMITS: Record<PanelName, { min: number; max: number }> = {
  sidebar: { min: 200, max: 360 },
  right: { min: 280, max: 520 },
};
export const MAIN_MIN_WIDTH = 480;

function limitedWidth(panel: PanelName, width: number): number {
  const { min, max } = PANEL_LIMITS[panel];
  const finite = Number.isFinite(width) ? Math.round(width) : DEFAULT_PANEL_WIDTHS[panel];
  return Math.min(Math.max(finite, min), max);
}

function fitInto(panel: PanelName, width: number, room: number): number {
  return Math.max(PANEL_LIMITS[panel].min, Math.min(width, room));
}

export function clampPanelWidths(widths: PanelWidths, availableWidth: number, favored: PanelName = "sidebar"): PanelWidths {
  const other: PanelName = favored === "sidebar" ? "right" : "sidebar";
  const result: PanelWidths = { sidebar: limitedWidth("sidebar", widths.sidebar), right: limitedWidth("right", widths.right) };
  result[other] = fitInto(other, result[other], availableWidth - MAIN_MIN_WIDTH - result[favored]);
  result[favored] = fitInto(favored, result[favored], availableWidth - MAIN_MIN_WIDTH - result[other]);
  return result;
}

export const COVER_TONE_COUNT = 6;

export function coverToneIndex(id: string): number {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash % COVER_TONE_COUNT;
}

export function coverInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first === undefined ? "?" : first.toLocaleUpperCase();
}
