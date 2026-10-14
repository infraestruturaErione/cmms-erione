module.exports = {
  dependencies: {
    '@react-native-firebase/app': {
      platforms: {
        // Expo merges this override shallowly; retain RNFB's Android import.
        android: {
          packageImportPath: 'import io.invertase.firebase.app.ReactNativeFirebaseAppPackage;'
        },
        ios: null
      }
    },
    '@react-native-firebase/analytics': { platforms: { ios: null } }
  }
};
