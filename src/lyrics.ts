import { comparableText } from "./format";
import type { LyricLine, Lyrics, LyricsSource } from "./types";

export interface SearchTerms {
  artist: string;
  title: string;
}

interface ParsedLine {
  times: number[];
  text: string;
}

const TIMESTAMP = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
const METADATA_TAG = /^\[([a-z]+):(.*)\]$/i;
const WORD_TIMESTAMP = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;
const NOISE_WORD =
  "(?:official\\s+)?(?:music\\s+|lyrics?\\s+)?(?:video|audio|visuali[sz]er)|official|lyrics?|hd|hq|4k|(?:\\d{4}\\s+)?remaster(?:ed)?(?:\\s+\\d{4})?(?:\\s+version)?";
const NOISE = `(?:${NOISE_WORD})(?:\\s+(?:${NOISE_WORD}))*`;
const BRACKETED_NOISE = new RegExp(`\\s*[([]\\s*${NOISE}\\s*[)\\]]`, "gi");
const TRAILING_NOISE = new RegExp(`(?:\\s*[-–—|]\\s*|\\s+)${NOISE}\\s*$`, "i");
const ARTIST_SEPARATOR = /\s+[-–—]\s+/;

export function parseLrc(text: string): LyricLine[] {
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");
  const offset = offsetOf(rawLines);
  const parsed = rawLines.filter((line) => !isMetadataLine(line)).map(parseLine);
  return parsed.some((line) => line.times.length > 0) ? syncedLines(parsed, offset) : unsyncedLines(parsed);
}

export function sortByTime(lines: LyricLine[]): LyricLine[] {
  return lines.sort((first, second) => (first.time ?? 0) - (second.time ?? 0));
}

export function toLyrics(lines: LyricLine[], source: LyricsSource): Lyrics | null {
  if (lines.every((line) => line.text === "")) {
    return null;
  }
  return { synced: lines.some((line) => line.time !== null), instrumental: false, lines, source };
}

export function instrumentalLyrics(source: LyricsSource): Lyrics {
  return { synced: false, instrumental: true, lines: [], source };
}

export function activeLineIndex(lines: readonly LyricLine[], seconds: number): number {
  let active = -1;
  for (const [index, line] of lines.entries()) {
    if (line.time !== null && line.time > seconds) {
      break;
    }
    if (line.time !== null) {
      active = index;
    }
  }
  return active;
}

export function cleanSearchTitle(title: string, artist: string): SearchTerms {
  return splitArtist(removeNoise(collapse(title)), collapse(artist));
}

function parseLine(raw: string): ParsedLine {
  const times: number[] = [];
  let rest = raw.trim();
  let match = TIMESTAMP.exec(rest);
  while (match !== null) {
    times.push(toSeconds(match));
    rest = rest.slice(match[0].length).trimStart();
    match = TIMESTAMP.exec(rest);
  }
  return { times, text: collapse(rest.replace(WORD_TIMESTAMP, "")) };
}

function toSeconds(match: RegExpExecArray): number {
  const [, minutes, seconds, fraction = "0"] = match;
  return Number(minutes) * 60 + Number(seconds) + Number(`0.${fraction}`);
}

function isMetadataLine(line: string): boolean {
  return METADATA_TAG.test(line.trim());
}

function offsetOf(lines: readonly string[]): number {
  for (const line of lines) {
    const match = METADATA_TAG.exec(line.trim());
    if (match !== null && match[1].toLowerCase() === "offset") {
      const milliseconds = Number(match[2].trim());
      return Number.isFinite(milliseconds) ? milliseconds / 1000 : 0;
    }
  }
  return 0;
}

function syncedLines(parsed: readonly ParsedLine[], offset: number): LyricLine[] {
  const lines = parsed.flatMap(({ times, text }) => times.map((time) => ({ time: Math.max(0, time - offset), text })));
  return sortByTime(lines);
}

function unsyncedLines(parsed: readonly ParsedLine[]): LyricLine[] {
  const lines = parsed.map(({ text }) => ({ time: null, text }));
  const first = lines.findIndex((line) => line.text !== "");
  const last = lines.findLastIndex((line) => line.text !== "");
  return first === -1 ? [] : lines.slice(first, last + 1);
}

function removeNoise(title: string): string {
  let cleaned = title.replace(BRACKETED_NOISE, "");
  let previous = "";
  while (cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned.replace(TRAILING_NOISE, "");
  }
  cleaned = collapse(cleaned);
  return cleaned === "" ? title : cleaned;
}

function splitArtist(title: string, artist: string): SearchTerms {
  const match = ARTIST_SEPARATOR.exec(title);
  if (match === null) {
    return { artist, title };
  }
  const before = title.slice(0, match.index);
  const after = title.slice(match.index + match[0].length);
  if (artist === "") {
    return { artist: before, title: after };
  }
  return comparableText(before) === comparableText(artist) ? { artist, title: after } : { artist, title };
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
