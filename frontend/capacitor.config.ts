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
    // Cream background (#f8f7f4) prevents black flash during iOS rubber-band overscroll
    backgroundColor: '#f8f7f4',
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false
  }
};

export default config;
