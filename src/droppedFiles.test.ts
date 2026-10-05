import { describe, it, expect } from "vitest";
import { hasDroppedFiles, readDroppedFiles } from "./droppedFiles";

interface FakeEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (resolve: (file: File) => void, reject: (error: Error) => void) => void;
  createReader?: () => { readEntries: (resolve: (entries: FakeEntry[]) => void) => void };
}

function fileEntry(path: string, content = "audio"): FakeEntry {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return { isFile: true, isDirectory: false, name, fullPath: path, file: (resolve) => resolve(new File([content], name)) };
}

function brokenEntry(path: string): FakeEntry {
  return { isFile: true, isDirectory: false, name: path, fullPath: path, file: (_resolve, reject) => reject(new Error("unreadable")) };
}

function directoryEntry(path: string, children: FakeEntry[], batchSize = 2): FakeEntry {
  return {
    isFile: false,
    isDirectory: true,
    name: path.slice(path.lastIndexOf("/") + 1),
    fullPath: path,
    createReader: () => {
      let offset = 0;
      return {
        readEntries: (resolve) => {
          resolve(children.slice(offset, offset + batchSize));
          offset += batchSize;
        },
      };
    },
  };
}

function transferOf(entries: (FakeEntry | null)[], files: File[] = []): DataTransfer {
  const items = entries.map((entry) => ({ kind: "file", webkitGetAsEntry: () => entry }));
  return { items, files, types: ["Files"] } as unknown as DataTransfer;
}

describe("hasDroppedFiles", () => {
  it("detects file drags only", () => {
    expect(hasDroppedFiles(null)).toBe(false);
    expect(hasDroppedFiles({ types: ["text/plain"] } as unknown as DataTransfer)).toBe(false);
    expect(hasDroppedFiles({ types: ["Files"] } as unknown as DataTransfer)).toBe(true);
  });
});

describe("readDroppedFiles", () => {
  it("reads single files and sets their relative path", async () => {
    const files = await readDroppedFiles(transferOf([fileEntry("/uno.mp3")]));
    expect(files.map((file) => file.name)).toEqual(["uno.mp3"]);
    expect(files[0].webkitRelativePath).toBe("uno.mp3");
  });

  it("walks folders recursively across reader batches", async () => {
    const album = directoryEntry("/disco", [
      fileEntry("/disco/a.mp3"),
      fileEntry("/disco/a.lrc"),
      directoryEntry("/disco/extra", [fileEntry("/disco/extra/b.mp3")]),
      fileEntry("/disco/c.mp3"),
      fileEntry("/disco/d.mp3"),
    ]);
    const files = await readDroppedFiles(transferOf([album, fileEntry("/suelto.mp3")]));
    expect(files.map((file) => file.webkitRelativePath)).toEqual(["disco/a.mp3", "disco/a.lrc", "disco/extra/b.mp3", "disco/c.mp3", "disco/d.mp3", "suelto.mp3"]);
  });

  it("skips unreadable entries and keeps the rest", async () => {
    const files = await readDroppedFiles(transferOf([brokenEntry("/roto.mp3"), fileEntry("/bien.mp3")]));
    expect(files.map((file) => file.name)).toEqual(["bien.mp3"]);
  });

  it("falls back to the plain file list when entries are unavailable", async () => {
    const plain = new File(["audio"], "plano.mp3");
    const files = await readDroppedFiles(transferOf([null], [plain]));
    expect(files).toEqual([plain]);
  });

  it("returns nothing for an empty folder", async () => {
    expect(await readDroppedFiles(transferOf([directoryEntry("/vacia", [])]))).toEqual([]);
  });
});
