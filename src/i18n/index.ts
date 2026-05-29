import * as Localization from "expo-localization";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import { en } from "./locales/en";
import { sr } from "./locales/sr";

export const resources = {
  en: { translation: en },
  sr: { translation: sr },
} as const;

export const supportedLanguages = ["en", "sr"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

function getInitialLanguage(): SupportedLanguage {
  const locale = Localization.getLocales()[0]?.languageCode;
  return locale === "sr" ? "sr" : "en";
}

const i18nInstance = createInstance();

if (!i18nInstance.isInitialized) {
  i18nInstance.use(initReactI18next).init({
    compatibilityJSON: "v4",
    resources,
    lng: getInitialLanguage(),
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
}

export const i18n = i18nInstance;
