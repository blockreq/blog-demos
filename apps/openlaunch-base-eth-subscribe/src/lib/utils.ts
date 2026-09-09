import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddr(a?: string | null) {
  if (!a || a.length < 10) return a || "?";
  return a.slice(0, 8) + "…" + a.slice(-4);
}

export function unpadTopic(topic?: string) {
  if (!topic || topic.length < 42) return "";
  return "0x" + topic.slice(-40).toLowerCase();
}

export function wordAddr(data: string | undefined, i: number) {
  if (!data || data.length < 2 + (i + 1) * 64) return "";
  return ("0x" + data.slice(2 + i * 64 + 24, 2 + (i + 1) * 64)).toLowerCase();
}

export function wordU256(data: string | undefined, i: number) {
  if (!data || data.length < 2 + (i + 1) * 64) return 0n;
  return BigInt("0x" + data.slice(2 + i * 64, 2 + (i + 1) * 64));
}

export function isAddr(a?: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a || "");
}
