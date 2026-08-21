const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyAXy83HZpz5JTArZYZ8IZFfXDSjGiNzxd0';

module.exports = ({ config }) => {
  return {
    ...config,
    name: 'PharmFindr',
    slug: 'PharmFindr',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'pharmfindr',
    userInterfaceStyle: 'automatic',
    notification: {
      icon: './assets/images/android-icon-monochrome.png',
      color: '#54edfbff',
    },
    ios: {
      ...config.ios,
      supportsTablet: true,
      bundleIdentifier: 'com.mrsekyi.PharmFindr',
      infoPlist: {
        NSFaceIDUsageDescription:
          'Allow PharmFindr to use Face ID for secure authentication.',
        ITSAppUsesNonExemptEncryption: false,
      },
      config: {
        googleMapsApiKey: googleMapsApiKey,
      },
    },
    android: {
      ...config.android,
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: 'resize',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.USE_BIOMETRIC',
        'android.permission.USE_FINGERPRINT',
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.POST_NOTIFICATIONS',
      ],
      package: 'com.mrsekyi.PharmFindr',
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/icon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#BFDBFE',
        },
      ],
      'expo-font',
      'expo-web-browser',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'PharmFindr needs your location to find nearby pharmacies.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'PharmFindr needs camera access to scan prescription documents.',
        },
      ],
      [
        'expo-local-authentication',
        {
          faceIDPermission:
            'Allow PharmFindr to use Face ID for secure authentication.',
        },
      ],
      'expo-notifications',
      'expo-image-picker',
      'expo-updates',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '7e2c77fd-b4be-4420-a531-f37eec823599',
      },
    },
    owner: 'sekyiofficials-team',
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/7e2c77fd-b4be-4420-a531-f37eec823599',
    },
  };
};
