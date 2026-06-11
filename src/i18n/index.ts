import { createContext, useContext } from "react";
import zh from "./zh";
import en from "./en";
import type { Translations } from "./zh";

const translations: Record<string, Translations> = { zh, en };

export const LangContext = createContext<{
  lang: string;
  setLang: (l: string) => void;
  t: Translations;
} | null>(null);

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export { zh, en, translations };
export type { Translations };
