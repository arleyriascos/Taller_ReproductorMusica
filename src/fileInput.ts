import type { LoadKind } from "./types";

export function createFileInput(kind: LoadKind): HTMLInputElement {
  const input = Object.assign(document.createElement("input"), { type: "file", hidden: true });
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  if (kind === "files") {
    input.multiple = true;
    input.accept = "audio/*,.lrc";
  } else {
    input.webkitdirectory = true;
  }
  return input;
}
