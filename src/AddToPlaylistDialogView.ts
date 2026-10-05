import { DialogView } from "./DialogView";
import { countLabel } from "./format";
import { PlacementFieldsView } from "./PlacementFieldsView";
import type { Playlist } from "./Playlist";
import type { Song } from "./Song";
import type { AddSongRequest } from "./types";

const NO_DESTINATIONS = "Primero crea una playlist con «Nueva playlist»";

export class AddToPlaylistDialogView {
  readonly #dialog = new DialogView(document.body, "Agregar canción", "Agregar");
  readonly #summary = Object.assign(document.createElement("p"), { className: "dialog-text" });
  readonly #select = Object.assign(document.createElement("select"), { className: "select-input" });
  readonly #placement = new PlacementFieldsView();
  readonly #destinations = new Map<string, Playlist>();
  #song: Song | null = null;
  #handler: (request: AddSongRequest) => void = () => {};

  constructor() {
    this.#dialog.body.append(this.#summary);
    this.#dialog.addField("Playlist de destino", this.#select);
    this.#dialog.body.append(this.#placement.element);
    this.#select.addEventListener("change", () => this.updateLimit());
    this.#placement.onChange(() => this.#dialog.clearError());
    this.#dialog.onConfirm(() => this.confirm());
  }

  onConfirm(handler: (request: AddSongRequest) => void): void {
    this.#handler = handler;
  }

  onClose(handler: () => void): void {
    this.#dialog.onClose(handler);
  }

  open(song: Song, destinations: readonly Playlist[], preferred: Playlist | null): void {
    this.#song = song;
    this.#summary.textContent = `Canción: ${song.title}`;
    this.fillDestinations(destinations, preferred);
    this.#placement.reset();
    this.updateLimit();
    this.#dialog.open(this.#select);
    if (this.#destinations.size === 0) {
      this.#dialog.showError(NO_DESTINATIONS);
    }
  }

  private fillDestinations(destinations: readonly Playlist[], preferred: Playlist | null): void {
    this.#destinations.clear();
    this.#select.replaceChildren();
    for (const playlist of destinations) {
      this.#destinations.set(playlist.id, playlist);
      this.#select.append(new Option(`${playlist.name} (${countLabel(playlist.length, "canción", "canciones")})`, playlist.id));
    }
    if (preferred !== null && this.#destinations.has(preferred.id)) {
      this.#select.value = preferred.id;
    }
  }

  private updateLimit(): void {
    this.#placement.setMaxPosition((this.#destinations.get(this.#select.value)?.length ?? 0) + 1);
    this.#dialog.clearError();
  }

  private confirm(): string | null {
    const target = this.#destinations.get(this.#select.value);
    if (target === undefined || this.#song === null) {
      return NO_DESTINATIONS;
    }
    const placement = this.#placement.read();
    if (typeof placement === "string") {
      return placement;
    }
    this.#handler({ song: this.#song, playlistId: target.id, placement });
    return null;
  }
}
