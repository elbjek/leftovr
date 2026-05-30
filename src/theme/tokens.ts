export const colors = {
  primary: "#1B4332",
  primary700: "#163829",
  primary50: "rgba(27, 67, 50, 0.06)",
  primary100: "rgba(27, 67, 50, 0.12)",
  surface: "#F8F4EE",
  surface2: "#F1ECE2",
  surface3: "#E8E1D3",
  paper: "#FFFEFB",
  appBackground: "#EFE9DD",
  accent: "#D4A843",
  accentSoft: "#F0DDA8",
  text: "#1C1C1A",
  muted: "#6B7A6D",
  muted2: "#9AA59C",
  green: "#4F8A5B",
  yellow: "#D4A843",
  red: "#C76845",
  hairline: "rgba(27, 67, 50, 0.10)",
  hairlineStrong: "rgba(27, 67, 50, 0.18)",
  black: "#1C1C1A",
  white: "#FFFFFF",
  overlay: "rgba(28, 28, 26, 0.55)",
} as const;

export const fonts = {
  display: "Fraunces",
  body: "PlusJakartaSans",
  displayItalic: "FrauncesItalic",
  bodyMedium: "PlusJakartaSansMedium",
  bodySemiBold: "PlusJakartaSansSemiBold",
  bodyBold: "PlusJakartaSansBold",
  fallback: "System",
} as const;

export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: fontWeights.medium,
  },
  hero: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 38,
    fontWeight: fontWeights.medium,
  },
  h1: {
    fontFamily: fonts.body,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: fontWeights.bold,
  },
  h2: {
    fontFamily: fonts.body,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: fontWeights.bold,
  },
  h3: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeights.semibold,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeights.regular,
  },
  small: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeights.medium,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: fontWeights.semibold,
  },
  micro: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.44,
  },
} as const;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  huge: 32,
  screenX: 24,
  screenTop: 64,
  screenBottom: 32,
  tabBarClearance: 118,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 999,
} as const;

export const shadows = {
  primaryButton: {
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  card: {
    shadowColor: colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  sheet: {
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 10,
  },
} as const;

export const urgencyColors = {
  safe: colors.green,
  useSoon: colors.yellow,
  urgent: colors.red,
} as const;

export const categoryColors = {
  dairy: { background: "#F0DDA8", mark: colors.primary },
  "dairy-eggs": { background: "#F0DDA8", mark: colors.primary },
  meat: { background: "#E8C3B0", mark: colors.primary },
  fish: { background: "#C6D6DA", mark: colors.primary },
  vegetables: { background: "#C8D5C2", mark: colors.primary },
  veg: { background: "#C8D5C2", mark: colors.primary },
  fruit: { background: "#E8B59E", mark: colors.primary },
  bakery: { background: "#E5D9C4", mark: colors.primary },
  pantry: { background: "#E5D9C4", mark: colors.primary },
  grain: { background: "#E5D9C4", mark: colors.primary },
  frozen: { background: "#D4E0DF", mark: colors.primary },
  drinks: { background: "#D9E5CE", mark: colors.primary },
  snacks: { background: "#EBD2A7", mark: colors.primary },
  other: { background: colors.surface3, mark: colors.primary },
} as const;

export const tokens = {
  colors,
  fonts,
  fontWeights,
  typography,
  spacing,
  radii,
  shadows,
  urgencyColors,
  categoryColors,
} as const;

export type ChompColor = keyof typeof colors;
export type Urgency = keyof typeof urgencyColors;
export type CategoryTone = keyof typeof categoryColors;
