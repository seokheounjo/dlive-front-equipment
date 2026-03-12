import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dlive.cona',
  appName: "D'LIVE CONA",
  webDir: 'dist',
  server: {
    cleartext: true,  // HTTP 허용 (58.143.140.222는 HTTP)
  }
};

export default config;
