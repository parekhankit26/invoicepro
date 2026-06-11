import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.asproite.invoicepro',
  appName: 'InvoicePro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  ios: {
    // Prevents white flash / blank screen before the web bundle loads
    backgroundColor: '#1a1814',
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: true,
    // limitsNavigationsToAppBoundDomains: false allows Supabase auth redirects
    limitsNavigationsToAppBoundDomains: false
  }
};

export default config;
