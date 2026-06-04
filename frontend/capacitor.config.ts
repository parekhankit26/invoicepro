import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.asproite.invoicepro',
  appName: 'InvoicePro',
  webDir: 'dist',
  server: {
    // In production, point to the live backend
    // For native app, all API calls go through the real backend
    androidScheme: 'https',
    // Uncomment for live reload during dev:
    // url: 'http://192.168.x.x:5173',
    // cleartext: true
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#f8f7f4',
  },
  android: {
    backgroundColor: '#f8f7f4',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#1a1814',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#a3e635',
      splashFullScreen: true,
      splashImmersive: true,
      useDialog: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#1a1814',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
}

export default config
