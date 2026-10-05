export function hasDroppedFiles(transfer: DataTransfer | null): boolean {
  return transfer !== null && Array.from(transfer.types).includes("Files");
}

export function readDroppedFiles(transfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(transfer.items, (item) => (item.kind === "file" ? item.webkitGetAsEntry() : null)).filter((entry) => entry !== null);
  if (entries.length === 0) {
    return Promise.resolve(Array.from(transfer.files));
  }
  return filesOfAll(entries);
}

async function filesOfAll(entries: readonly FileSystemEntry[]): Promise<File[]> {
  const groups = await Promise.all(entries.map((entry) => filesOf(entry)));
  return groups.flat();
}

async function filesOf(entry: FileSystemEntry): Promise<File[]> {
  try {
    if (isFileEntry(entry)) {
      return [await fileOf(entry)];
    }
    return isDirectoryEntry(entry) ? await filesOfAll(await childrenOf(entry)) : [];
  } catch {
    return [];
  }
}

async function fileOf(entry: FileSystemFileEntry): Promise<File> {
  const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
  Object.defineProperty(file, "webkitRelativePath", { value: entry.fullPath.replace(/^\//, "") });
  return file;
}

async function childrenOf(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const children: FileSystemEntry[] = [];
  for (let batch = await readBatch(reader); batch.length > 0; batch = await readBatch(reader)) {
    children.push(...batch);
  }
  return children;
}

function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}
