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
    ios: {
      ...config.ios,
      supportsTablet: true,
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
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
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
      'expo-local-authentication',
      'expo-notifications',
      'expo-image-picker',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'e6ea880a-486a-42e1-8be7-ca44af58f58d',
      },
    },
    owner: 'mrsekyi',
  };
};
