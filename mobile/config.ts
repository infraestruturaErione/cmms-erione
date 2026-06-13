import Constants from 'expo-constants';

export const googleMapsConfig = {
  apiKey: process.env.GOOGLE_KEY
};

const defaultApiUrl = Constants.expoConfig?.extra?.API_URL ?? process.env.API_URL;
export const IS_LOCALHOST = false;

export const legalLinks = {
  termsOfUse: 'https://cmms.erione.com.br/terms-of-use',
  privacyPolicy: 'https://cmms.erione.com.br/privacy-policy'
};

export const getApiUrl = async (): Promise<string> => {
  if (!defaultApiUrl) {
    throw new Error(
      'API_URL não configurada. Defina API_URL no mobile/.env ou no ambiente do Expo.'
    );
  }
  return defaultApiUrl.endsWith('/') ? defaultApiUrl : defaultApiUrl + '/';
};
