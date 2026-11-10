/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#16803C';
const tintColorDark = '#C6FF23';

export const Colors = {
  light: {
    text: '#17251C',
    background: '#F4F7F5',
    tint: tintColorLight,
    icon: '#64736A',
    tabIconDefault: '#64736A',
    tabIconSelected: tintColorLight,
    card: '#FFFFFF',
    border: '#DFE8E1',
    mutedText: '#64736A',
  },
  dark: {
    text: '#F8FAFC',
    background: '#10191F',
    tint: tintColorDark,
    icon: '#8EA0B8',
    tabIconDefault: '#8EA0B8',
    tabIconSelected: tintColorDark,
    card: '#19272F',
    border: 'rgba(148,163,184,0.20)',
    mutedText: '#8EA0B8',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
