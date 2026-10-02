"use client";

import { useCallback } from "react";
import { useApp, type Lang } from "../store";
import en, { type MessageKey } from "./en";
import hi from "./hi";
import ml from "./ml";

const dictionaries = { en, hi, ml } as const;

export const LANGUAGES: { id: Lang; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "hi", label: "Hindi", native: "हिन्दी" },
  { id: "ml", label: "Malayalam", native: "മലയാളം" },
];

export type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>) {
  let s: string = dictionaries[lang]?.[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function useT(): TFn {
  const lang = useApp((s) => s.settings.lang);
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}

export type { MessageKey };
