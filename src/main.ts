import "./styles.css";

function createTextElement(tagName: string, className: string, text: string): HTMLElement {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderPlaceholder(root: HTMLElement): void {
  const container = document.createElement("main");
  container.className = "placeholder";
  container.append(
    createTextElement("h1", "placeholder-title", "Musongs"),
    createTextElement("p", "placeholder-subtitle", "Reproductor en construcción"),
  );
  root.replaceChildren(container);
}

const appRoot = document.querySelector<HTMLElement>("#app");

if (appRoot) {
  renderPlaceholder(appRoot);
}
