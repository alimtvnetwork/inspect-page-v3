/**
 * Filename templating + sanitization. Source: spec/21-app/07-file-naming.md.
 * Pure — no chrome APIs.
 */
import { FILENAME_MAX_CHARS } from "@shared/constants";

export interface FilenameVars {
  domain?: string;
  tag?: string;
  timestamp?: string;
  title?: string;
}

export function localTimestamp(d: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function domainFromUrl(href: string): string {
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./, "").replace(/\./g, "_");
  } catch {
    return "page";
  }
}

export function slugifyTitle(title: string): string {
  return title.toLowerCase().slice(0, 40);
}

export function sanitize(name: string): string {
  let out = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  out = out.replace(/^-+|-+$/g, "");
  // Trim base name to FILENAME_MAX_CHARS preserving extension.
  const dot = out.lastIndexOf(".");
  if (dot > 0) {
    const ext = out.slice(dot);
    const base = out.slice(0, dot).slice(0, FILENAME_MAX_CHARS - ext.length);
    return `${base}${ext}`;
  }
  return out.slice(0, FILENAME_MAX_CHARS);
}

export function applyTemplate(template: string, vars: FilenameVars): string {
  const replaced = template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v === undefined ? "" : v;
  });
  return sanitize(replaced);
}
