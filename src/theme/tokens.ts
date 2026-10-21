export const colors = {
  primary: "#234B34",
  primary700: "#1A3A28",
  primary50: "rgba(35, 75, 52, 0.06)",
  primary100: "rgba(35, 75, 52, 0.12)",
  surface: "#F9F6F1",
  surface2: "#F3F3EB",
  surface3: "#E2DBCD",
  paper: "#FDF8F6",
  appBackground: "#F9F6F1",
  // Flat neutral hairline for card outlines (no shadows).
  cardLine: "#E6E4D8",
  accent: "#F2C14E",
  accentSoft: "#FBE7B4",
  text: "#1F1F1F",
  // Green-gray tuned for 4.5:1+ contrast on cream surfaces at small sizes.
  muted: "#55655A",
  muted2: "#9AA59C",
  green: "#5E9A64",
  yellow: "#F2C14E",
  red: "#E76F51",
  // Light sage highlight (from brand palette) for selected/active states.
  sage: "#A7C3A3",
  sageSoft: "rgba(167, 195, 163, 0.28)",
  // Solid light-sage fill for thumbnails/tiles.
  sageTint: "#D8E4D1",
  sageBorder: "rgba(35, 75, 52, 0.28)",
  hairline: "rgba(35, 75, 52, 0.10)",
  hairlineStrong: "rgba(35, 75, 52, 0.18)",
  // Hairlines on primary (dark green) surfaces.
  inverseHairline: "rgba(249, 246, 241, 0.12)",
  inverseHairlineStrong: "rgba(249, 246, 241, 0.24)",
  black: "#1F1F1F",
  white: "#FFFFFF",
  overlay: "rgba(31, 31, 31, 0.55)",
} as const;

export const fonts = {
  display: "Fraunces",
  displaySemiBold: "FrauncesSemiBold",
  displayItalic: "FrauncesItalic",
  body: "Nunito",
  bodyMedium: "NunitoMedium",
  bodySemiBold: "NunitoSemiBold",
  bodyBold: "NunitoBold",
  bodyExtraBold: "NunitoExtraBold",
  fallback: "System",
} as const;

const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const typography = {
  display: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: fontWeights.bold,
  },
  hero: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 38,
    lineHeight: 38,
    fontWeight: fontWeights.bold,
  },
  h1: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: fontWeights.bold,
  },
  h2: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: fontWeights.bold,
  },
  h3: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeights.bold,
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
  // Screens render inside SafeAreaView, which already clears the notch —
  // this is just breathing room below it.
  screenTop: 16,
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
    boxShadow: "0px 8px 24px rgba(35, 75, 52, 0.18)",
  },
  card: {
    boxShadow: "0px 6px 14px rgba(31, 31, 31, 0.04)",
  },
  elevated: {
    boxShadow: "0px 14px 34px rgba(31, 31, 31, 0.10)",
  },
  sheet: {
    boxShadow: "0px -8px 28px rgba(31, 31, 31, 0.18)",
  },
} as const;

export const urgencyColors = {
  safe: colors.green,
  useSoon: colors.yellow,
  urgent: colors.red,
  expired: colors.muted2,
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

export type Urgency = keyof typeof urgencyColors;
export type CategoryTone = keyof typeof categoryColors;
