import { audiusFingerprint, audiusStreamUrl, AUDIUS_SITE } from "./audius";
import { Song } from "./Song";

type RawRecord = Record<string, unknown>;

const TRACK_ID = /^[A-Za-z0-9]+$/;
const PERMALINK = /^\/\S+$/;
const ARTWORK_SIZES = ["480x480", "1000x1000", "150x150"];

export class AudiusTrackAdapter {
  toSong(raw: unknown): Song | null {
    if (!AudiusTrackAdapter.isRecord(raw) || !AudiusTrackAdapter.isPlayable(raw)) {
      return null;
    }
    const id = AudiusTrackAdapter.trackIdOf(raw);
    const title = AudiusTrackAdapter.textOf(raw.title);
    const artist = AudiusTrackAdapter.artistOf(raw.user);
    const duration = AudiusTrackAdapter.durationOf(raw.duration);
    const pageUrl = AudiusTrackAdapter.pageUrlOf(raw.permalink);
    if (id === null || title === "" || artist === null || duration === null || pageUrl === null) {
      return null;
    }
    const song = new Song({ title, artist, album: "", duration, fingerprint: audiusFingerprint(id) });
    song.attachRemote(audiusStreamUrl(id), AudiusTrackAdapter.artworkOf(raw.artwork), pageUrl);
    return song;
  }

  private static isPlayable(raw: RawRecord): boolean {
    const access = raw.access;
    const isStreamAllowed = !AudiusTrackAdapter.isRecord(access) || access.stream !== false;
    return raw.is_streamable === true && raw.is_delete !== true && raw.is_unlisted !== true && isStreamAllowed;
  }

  private static trackIdOf(raw: RawRecord): string | null {
    return typeof raw.id === "string" && TRACK_ID.test(raw.id) ? raw.id : null;
  }

  private static artistOf(user: unknown): string | null {
    return AudiusTrackAdapter.isRecord(user) && typeof user.name === "string" ? user.name.trim() : null;
  }

  private static durationOf(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  }

  private static pageUrlOf(permalink: unknown): string | null {
    return typeof permalink === "string" && PERMALINK.test(permalink) ? `${AUDIUS_SITE}${permalink}` : null;
  }

  private static artworkOf(artwork: unknown): string | null {
    if (!AudiusTrackAdapter.isRecord(artwork)) {
      return null;
    }
    for (const size of ARTWORK_SIZES) {
      const url = artwork[size];
      if (typeof url === "string" && AudiusTrackAdapter.isHttps(url)) {
        return url;
      }
    }
    return null;
  }

  private static isHttps(url: string): boolean {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  }

  private static textOf(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private static isRecord(value: unknown): value is RawRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
