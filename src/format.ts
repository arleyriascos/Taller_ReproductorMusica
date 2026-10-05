const EMPTY_TIME = "—:—";

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

export function comparableText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/(?<!n)̃|[̀-̂̄-ͯ]/g, "")
    .normalize("NFC");
}
