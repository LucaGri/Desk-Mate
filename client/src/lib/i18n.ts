import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../locales/en.json';
import it from '../locales/it.json';
import de from '../locales/de.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';

const resources = {
  en: { translation: en },
  it: { translation: it },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export const changeLanguage = (locale: string) => {
  i18n.changeLanguage(locale);
  localStorage.setItem('i18nextLng', locale);
};

export default i18n;
