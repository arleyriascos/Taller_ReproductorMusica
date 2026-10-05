const ICONS = {
  logo: '<path d="M9 18V6l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" />',
  music: '<path d="M10 17V5.5l9-1.5v11" /><circle cx="7.5" cy="17" r="2.5" /><circle cx="16.5" cy="15" r="2.5" />',
  library: '<rect x="3" y="4" width="4" height="16" rx="1" /><rect x="9" y="4" width="4" height="16" rx="1" /><path d="m15.5 5.2 3.8-1 2.2 15.6-3.8 1z" />',
  playlist: '<path d="M4 6h11M4 11h11M4 16h7" /><path d="M18 17.5V9l3-1" /><circle cx="16" cy="17.5" r="2" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" />',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" />',
  close: '<path d="M6 6l12 12M18 6 6 18" />',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" fill="currentColor" stroke="none" />',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />',
  previous: '<path d="M18 6.2v11.6a.8.8 0 0 1-1.2.7L8.5 12.7a.8.8 0 0 1 0-1.4l8.3-5.8a.8.8 0 0 1 1.2.7z" fill="currentColor" stroke="none" /><path d="M6 6v12" />',
  next: '<path d="M6 6.2v11.6a.8.8 0 0 0 1.2.7l8.3-5.8a.8.8 0 0 0 0-1.4L7.2 5.5a.8.8 0 0 0-1.2.7z" fill="currentColor" stroke="none" /><path d="M18 6v12" />',
  volume: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />',
  muted: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" /><path d="m16 9.5 5 5M21 9.5l-5 5" />',
  speaker: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" /><path d="M15.5 9a4 4 0 0 1 0 6" />',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" />',
  alert: '<circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" />',
  info: '<circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5v.01" />',
} as const;

export type IconName = keyof typeof ICONS;

const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="icon">';

const parsedIcons = new Map<IconName, Element>();

function parseIcon(name: IconName): Element {
  const template = document.createElement("template");
  template.innerHTML = `${SVG_OPEN}${ICONS[name]}</svg>`;
  const svg = template.content.firstElementChild;
  if (svg === null) {
    throw new Error(`Icon ${name} could not be parsed`);
  }
  return svg;
}

export function createIcon(name: IconName): Element {
  let icon = parsedIcons.get(name);
  if (icon === undefined) {
    icon = parseIcon(name);
    parsedIcons.set(name, icon);
  }
  return icon.cloneNode(true) as Element;
}

export function createIconButton(name: IconName, label: string, className: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  setButtonIcon(button, name, label);
  return button;
}

export function setButtonIcon(button: HTMLButtonElement, name: IconName, label: string): void {
  button.setAttribute("aria-label", label);
  button.title = label;
  button.replaceChildren(createIcon(name));
}

export function createLabeledButton(name: IconName, label: string, className: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  const text = document.createElement("span");
  text.textContent = label;
  button.append(createIcon(name), text);
  return button;
}
