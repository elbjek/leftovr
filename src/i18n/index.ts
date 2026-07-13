import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import { en } from "./locales/en";
import { sr } from "./locales/sr";

const resources = {
  en: { translation: en },
  sr: { translation: sr },
} as const;

export const supportedLanguages = ["en", "sr"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];
const languageStorageKey = "leftovr.language";

export function isSupportedLanguage(language: string | null | undefined): language is SupportedLanguage {
  return supportedLanguages.includes(language as SupportedLanguage);
}

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
    supportedLngs: [...supportedLanguages],
    returnNull: false,
    saveMissing: __DEV__,
    parseMissingKeyHandler: (key) => `[[${key}]]`,
    interpolation: {
      escapeValue: false,
    },
  });

  AsyncStorage.getItem(languageStorageKey)
    .then((language) => {
      if (isSupportedLanguage(language) && language !== i18nInstance.language) {
        i18nInstance.changeLanguage(language);
      }
    })
    .catch(() => undefined);

  i18nInstance.on("languageChanged", (language) => {
    if (isSupportedLanguage(language)) {
      AsyncStorage.setItem(languageStorageKey, language).catch(() => undefined);
    }
  });
}

export const i18n = i18nInstance;
