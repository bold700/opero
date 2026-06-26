import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { en } from "./locales/en";
import { nl } from "./locales/nl";

// App i18n setup. Dutch is the default + fallback language (the production
// audience), English is available. Resources are namespaced per feature inside
// a single `translation` namespace, e.g. t("customers.title"), t("nav.dashboard").
//
// Internals are ENGLISH everywhere (routes, keys, code); only the values in the
// locale files are user-facing display strings. Each feature owns one JSON file
// per locale under ./locales/<lang>/<feature>.json; ./locales/<lang>.ts merges
// them into a single resource object.

export const SUPPORTED_LANGUAGES = ["nl", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      nl: { translation: nl },
    },
    fallbackLng: "nl",
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "opero.lang",
    },
  });

export default i18n;
