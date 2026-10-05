import { describe, it, expect } from "vitest";
import { artistLabel, clampPanelWidths, comparableText, countLabel, COVER_TONE_COUNT, coverInitial, coverToneIndex, formatElapsed, formatMegabytes, formatTime, formatTotal, MAIN_MIN_WIDTH } from "./format";

describe("formatTime", () => {
  it("formats minutes and seconds with two-digit seconds", () => {
    expect(formatTime(1)).toBe("0:01");
    expect(formatTime(59)).toBe("0:59");
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(225)).toBe("3:45");
  });

  it("drops fractions of a second", () => {
    expect(formatTime(61.9)).toBe("1:01");
  });

  it("adds hours with two-digit minutes from one hour on", () => {
    expect(formatTime(3599)).toBe("59:59");
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3725)).toBe("1:02:05");
  });

  it("shows a placeholder for zero, negative and invalid values", () => {
    for (const value of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatTime(value)).toBe("—:—");
    }
  });
});

describe("formatElapsed", () => {
  it("formats like formatTime for valid values", () => {
    expect(formatElapsed(75)).toBe("1:15");
    expect(formatElapsed(3725)).toBe("1:02:05");
  });

  it("shows 0:00 for zero, negative and invalid values", () => {
    for (const value of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatElapsed(value)).toBe("0:00");
    }
  });
});

describe("formatTotal", () => {
  it("rounds up to whole minutes", () => {
    expect(formatTotal(1)).toBe("1 min");
    expect(formatTotal(60)).toBe("1 min");
    expect(formatTotal(61)).toBe("2 min");
  });

  it("adds hours from 60 minutes on", () => {
    expect(formatTotal(3540)).toBe("59 min");
    expect(formatTotal(3600)).toBe("1 h 0 min");
    expect(formatTotal(5430)).toBe("1 h 31 min");
  });

  it("shows 0 min for zero and invalid values", () => {
    for (const value of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatTotal(value)).toBe("0 min");
    }
  });
});

describe("countLabel", () => {
  it("uses the singular only for exactly one", () => {
    expect(countLabel(1, "canción", "canciones")).toBe("1 canción");
    expect(countLabel(0, "canción", "canciones")).toBe("0 canciones");
    expect(countLabel(28, "canción", "canciones")).toBe("28 canciones");
  });
});

describe("comparableText", () => {
  it("ignores case and surrounding spaces", () => {
    expect(comparableText("  Rock Clásico ")).toBe(comparableText("rock clásico"));
  });

  it("ignores accents, dieresis and circumflex", () => {
    expect(comparableText("Canción")).toBe("cancion");
    expect(comparableText("PINGÜINO")).toBe("pinguino");
    expect(comparableText("Être")).toBe("etre");
    expect(comparableText("àÁâ")).toBe("aaa");
  });

  it("keeps ñ as a distinct letter in any case and normalization form", () => {
    expect(comparableText("Año")).toBe("año");
    expect(comparableText("AÑO")).toBe("año");
    expect(comparableText("Año")).toBe("año");
    expect(comparableText("Año")).not.toBe(comparableText("Ano"));
  });

  it("removes a tilde that is not on an n", () => {
    expect(comparableText("ã")).toBe("a");
  });

  it("returns an empty string for blank text", () => {
    expect(comparableText("   ")).toBe("");
  });
});

describe("artistLabel", () => {
  it("returns the artist when there is one", () => {
    expect(artistLabel("Soda Stereo")).toBe("Soda Stereo");
  });

  it("falls back to the unknown artist text for an empty string", () => {
    expect(artistLabel("")).toBe("Artista desconocido");
  });
});

describe("formatMegabytes", () => {
  it("shows one decimal with a comma", () => {
    expect(formatMegabytes(1024 * 1024)).toBe("1,0");
    expect(formatMegabytes(5.25 * 1024 * 1024)).toBe("5,3");
    expect(formatMegabytes(300 * 1024)).toBe("0,3");
  });

  it("shows zero for empty and invalid values", () => {
    for (const value of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatMegabytes(value)).toBe("0,0");
    }
  });
});

describe("clampPanelWidths", () => {
  it("keeps valid widths untouched when there is room", () => {
    expect(clampPanelWidths({ sidebar: 260, right: 400 }, 1600)).toEqual({ sidebar: 260, right: 400 });
  });

  it("limits the sidebar to 200–360 and the right column to 280–520", () => {
    expect(clampPanelWidths({ sidebar: 100, right: 100 }, 2000)).toEqual({ sidebar: 200, right: 280 });
    expect(clampPanelWidths({ sidebar: 900, right: 900 }, 3000)).toEqual({ sidebar: 360, right: 520 });
  });

  it("never lets the main column drop below 480", () => {
    for (const available of [1100, 1200, 1280, 1366, 1500]) {
      const result = clampPanelWidths({ sidebar: 360, right: 520 }, available);
      expect(available - result.sidebar - result.right).toBeGreaterThanOrEqual(MAIN_MIN_WIDTH);
    }
  });

  it("reduces the other panel first and keeps the favored one", () => {
    expect(clampPanelWidths({ sidebar: 360, right: 520 }, 1200, "sidebar")).toEqual({ sidebar: 360, right: 360 });
    expect(clampPanelWidths({ sidebar: 360, right: 520 }, 1200, "right")).toEqual({ sidebar: 200, right: 520 });
  });

  it("reduces the favored panel only when the other is already at its minimum", () => {
    expect(clampPanelWidths({ sidebar: 360, right: 520 }, 1000, "sidebar")).toEqual({ sidebar: 240, right: 280 });
  });

  it("rounds fractional widths and replaces invalid ones with the defaults", () => {
    expect(clampPanelWidths({ sidebar: 250.6, right: 333.2 }, 1600)).toEqual({ sidebar: 251, right: 333 });
    expect(clampPanelWidths({ sidebar: Number.NaN, right: Number.POSITIVE_INFINITY }, 1600)).toEqual({ sidebar: 240, right: 340 });
  });

  it("supports dragging one panel without moving the other", () => {
    expect(clampPanelWidths({ sidebar: 500, right: 340 }, 1100, "right")).toEqual({ sidebar: 280, right: 340 });
    expect(clampPanelWidths({ sidebar: 240, right: 700 }, 1100, "sidebar")).toEqual({ sidebar: 240, right: 380 });
  });
});

describe("coverToneIndex", () => {
  it("is deterministic and inside the palette", () => {
    for (const id of ["a", "playlist-1", "3f2b9c9e-7d51-4a6e-8c3f-0d2a1b4e5f60", "", "ñandú"]) {
      const index = coverToneIndex(id);
      expect(index).toBe(coverToneIndex(id));
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(COVER_TONE_COUNT);
    }
  });

  it("spreads different ids over several tones", () => {
    const tones = new Set(Array.from({ length: 60 }, (_, index) => coverToneIndex(`id-${index}`)));
    expect(tones.size).toBe(COVER_TONE_COUNT);
  });
});

describe("coverInitial", () => {
  it("uppercases the first letter of the trimmed name", () => {
    expect(coverInitial("  rock clásico")).toBe("R");
    expect(coverInitial("ñandú")).toBe("Ñ");
  });

  it("keeps emoji and symbols whole", () => {
    expect(coverInitial("🎵 Mix")).toBe("🎵");
  });

  it("falls back to a question mark for blank names", () => {
    expect(coverInitial("   ")).toBe("?");
  });
});
