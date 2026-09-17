import i18n from 'i18next';

import { initReactI18next } from 'react-i18next';
// import LanguageDetector from 'i18next-browser-languagedetector';
import deJSON from './translations/de';
import arJSON from './translations/ar';
import locale from './translations/en';
import esJSON from './translations/es';
import frJSON from './translations/fr';
import trJSON from './translations/tr';
import plJSON from './translations/pl';
import itJSON from './translations/it';
import ptBRJSON from './translations/pt_BR';
import svJSON from './translations/sv';
import ruJSON from './translations/ru';
import huJSON from './translations/hu';
import nlJSON from './translations/nl';
import zhCnJSON from './translations/zh_cn';
import baJSON from './translations/ba';
const resources = {
  de: { translation: deJSON },
  en: { translation: locale },
  es: { translation: esJSON },
  fr: { translation: frJSON },
  tr: { translation: trJSON },
  pl: { translation: plJSON },
  pt_br: { translation: ptBRJSON },
  ar: { translation: arJSON },
  it: { translation: itJSON },
  sv: { translation: svJSON },
  ru: { translation: ruJSON },
  hu: { translation: huJSON },
  nl: { translation: nlJSON },
  zh_cn: { translation: zhCnJSON },
  ba: { translation: baJSON },
};

i18n
  // .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,
    keySeparator: false,
    lng: 'en',
    fallbackLng: 'en',
    react: {
      useSuspense: true
    },
    interpolation: {
      escapeValue: false
    }
  });

// Os codigos de idioma aqui usam underscore (pt_br) porque vem de
// companySettings.generalPreferences.language.toLowerCase(). O i18next nao
// tem regra de plural pra "pt_br" (so' pra "pt"/"pt-BR"), e sem regra ele cai
// silenciosamente sempre na forma singular - "20 foto selecionada" em vez de
// "20 fotos selecionadas". Registrar a regra do idioma base resolve isso sem
// mexer nos identificadores usados pelo resto do app.
const ptRule = i18n.services.pluralResolver.getRule('pt');
if (ptRule) {
  i18n.services.pluralResolver.addRule('pt_br', ptRule);
}

export default i18n;
