import { useColorScheme } from "react-native";

const palette = {
  primaryGreen: "#25D366",
  darkGreen: "#128C7E",
  darkestGreen: "#075E54",
  blueAccent: "#34B7F1",
  purpleAccent: "#7C4DFF",

  lightBackground: "#f0f2f5",
  darkBackground: "#0b141a",

  lightSurface: "#ffffff",
  darkSurface: "#111b21",

  lightText: "#111B21",
  darkText: "#e9edef",

  lightSecondaryText: "#667781",
  darkSecondaryText: "#8696a0",

  lightBorder: "#e9edef",
  darkBorder: "#2a3942",

  online: "#25D366",
  offline: "#8696A0",
  warning: "#FFC107",
  danger: "#FF3B30",
  success: "#4CAF50",
  info: "#2196F3",
  muted: "#B0BEC5",

  lightCard: "#ffffff",
  darkCard: "#1f2c34",

  lightInputBg: "#f0f2f5",
  darkInputBg: "#2a3942",
};

const lightColors = {
  background: palette.lightBackground,
  surface: palette.lightSurface,
  card: palette.lightCard,
  text: palette.lightText,
  secondaryText: palette.lightSecondaryText,
  border: palette.lightBorder,
  inputBg: palette.lightInputBg,

  primary: palette.primaryGreen,
  primaryDark: palette.darkGreen,
  primaryDarkest: palette.darkestGreen,
  blue: palette.blueAccent,
  purple: palette.purpleAccent,

  online: palette.online,
  offline: palette.offline,
  warning: palette.warning,
  danger: palette.danger,
  success: palette.success,
  info: palette.info,
  muted: palette.muted,

  tabBar: "#ffffff",
  tabBarBorder: "#e9edef",
  tabBarActive: palette.primaryGreen,
  tabBarInactive: palette.lightSecondaryText,

  headerBg: palette.darkestGreen,
  headerText: "#ffffff",

  shadow: "#000",
  shadowOpacity: 0.08,

  mutedForeground: palette.lightSecondaryText,
};

const darkColors = {
  background: palette.darkBackground,
  surface: palette.darkSurface,
  card: palette.darkCard,
  text: palette.darkText,
  secondaryText: palette.darkSecondaryText,
  border: palette.darkBorder,
  inputBg: palette.darkInputBg,

  primary: palette.primaryGreen,
  primaryDark: palette.darkGreen,
  primaryDarkest: palette.darkestGreen,
  blue: palette.blueAccent,
  purple: palette.purpleAccent,

  online: palette.online,
  offline: palette.offline,
  warning: palette.warning,
  danger: palette.danger,
  success: palette.success,
  info: palette.info,
  muted: palette.muted,

  tabBar: palette.darkSurface,
  tabBarBorder: palette.darkBorder,
  tabBarActive: palette.primaryGreen,
  tabBarInactive: palette.darkSecondaryText,

  headerBg: "#1f2c34",
  headerText: palette.darkText,

  shadow: "transparent",
  shadowOpacity: 0,

  mutedForeground: palette.darkSecondaryText,
};

export type AppColors = typeof lightColors;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
} as const;

export default {
  light: lightColors,
  dark: darkColors,
  radius: 12,
};

export function useColors(): AppColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}
