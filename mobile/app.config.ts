import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

const apiUrl = process.env.API_URL;
const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;
const googleServicesPlist = process.env.GOOGLE_SERVICES_PLIST;
const enableFirebase = process.env.ENABLE_FIREBASE === 'true';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Erione CMMS',
  slug: 'erione-cmms',
  version: '1.0.41',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'erionecmms',
  userInterfaceStyle: 'automatic',
  newArchEnabled: false,
  notification: {
    icon: './assets/images/notification.png'
  },
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#07090e'
  },
  updates: {
    fallbackToCacheTimeout: 0,
    url: 'https://u.expo.dev/803b5007-0c60-4030-ac3a-c7630b223b92',
    assetPatternsToBeBundled: ['**/*']
  },
  ios: {
    bundleIdentifier: 'com.cmms.erione',
    buildNumber: '7',
    jsEngine: 'hermes',
    supportsTablet: false,
    runtimeVersion: '1.0.41',
    ...(enableFirebase
      ? { googleServicesFile: googleServicesPlist ?? './GoogleService-Info.plist' }
      : {}),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'CAMERA'],
    versionCode: 34,
    package: 'com.cmms.erione',
    jsEngine: 'hermes',
    googleServicesFile:
      googleServicesJson ?? './android/app/google-services.json',
    runtimeVersion: '1.0.41'
  },
  web: {
    favicon: './assets/images/favicon.png'
  },
  extra: {
    API_URL: apiUrl,
    eas: {
      projectId: '803b5007-0c60-4030-ac3a-c7630b223b92'
    }
  },
  plugins: [
    'expo-font',
    'expo-notifications',
    '@react-native-community/datetimepicker',
    ...(enableFirebase ? ['@react-native-firebase/app'] : []),
    './plugins/ios/withFmtXcode26Fix',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Erione CMMS to access camera.'
      }
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Permita que o Erione CMMS use sua localizacao para registrar deslocamento, check-in e check-out da OS.'
      }
    ],
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
          deploymentTarget: '15.1'
        },
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35
        }
      }
    ]
  ]
});
