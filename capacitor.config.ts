import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.lichten.fourmahjong",
  appName: "四人打ちリーチ麻雀",
  webDir: "dist-app",
  android: {
    backgroundColor: "#1a6b3c",
  },
  plugins: {
    SplashScreen: {
      backgroundColor: "#1a6b3c",
      launchAutoHide: true,
      launchShowDuration: 800,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
