export const colors = {
  primary: "#234B34",
  primary700: "#1A3A28",
  primary50: "rgba(35, 75, 52, 0.06)",
  primary100: "rgba(35, 75, 52, 0.12)",
  // Page background. TinyMeals' cream (its `bg`), so the two apps share a
  // page colour. It sits only dE 3.9 from the white cards, so the cards are
  // separated by the warm `shadows.soft` lift below, not by this contrast.
  bg: "#FEF8F3",
  // Cards and sheets: the layer that sits on top of bg.
  surface: "#FFFFFF",
  // Text and icons on primary (dark green) fills.
  onPrimary: "#FFFFFF",
  // Inset wells: the layer that sits below bg.
  surface2: "#F3E7D3",  // TinyMeals `bgSubtle`.
  surface3: "#EEE2CD",
  // Alias for surface, kept so existing call sites keep working.
  paper: "#FFFFFF",
  // Alias for bg, kept so existing call sites keep working.
  appBackground: "#FEF8F3",
  // Flat neutral hairline for card outlines (no shadows).
  cardLine: "#E6E4D8",
  accent: "#F2C14E",
  accentSoft: "#FBE7B4",
  text: "#1F1F1F",
  // Green-gray tuned for 4.5:1+ contrast on cream surfaces at small sizes.
  muted: "#55655A",
  muted2: "#9AA59C",
  green: "#5E9A64",
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
  inverseHairline: "rgba(255, 255, 255, 0.12)",
  inverseHairlineStrong: "rgba(255, 255, 255, 0.24)",
  // Kitchen home (TinyMeals-style): white cards on cream, warm tints.
  card: "#FFFFFF",
  accentInk: "#8A5A0B",
  redSoft: "#F9E4DC",
  redInk: "#9A3F27",
  black: "#1F1F1F",
  white: "#FFFFFF",
  overlay: "rgba(31, 31, 31, 0.55)",
} as const;

export const fonts = {
  logo: "PlusJakartaSansExtraBold",
  body: "NunitoSans",
  bodyMedium: "NunitoSansMedium",
  bodySemiBold: "NunitoSansSemiBold",
  bodyBold: "NunitoSansBold",
  bodyExtraBold: "NunitoSansExtraBold",
  fallback: "System",
} as const;

export const typography = {
  display: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  h1: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  h2: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: fonts.bodyBold,
    fontSize: 19,
    lineHeight: 24,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 20,
  },
  small: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  micro: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.66,
  },
  // Big figures: counts, money, streaks.
  numeral: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"] as const,
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
  xs: 8,
  sm: 12,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const shadows = {
  primaryButton: {
    boxShadow: "0px 8px 24px rgba(35, 75, 52, 0.18)",
  },
  card: {
    boxShadow: "0px 6px 14px rgba(90, 60, 20, 0.05)",
  },
  // Soft lift for white cards on the cream page. Warm, matching TinyMeals'
  // homeHero: on a cream this close to white, the shadow is what makes a card
  // read as a card.
  soft: {
    boxShadow: "0px 8px 22px rgba(120, 80, 40, 0.07)",
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
  useSoon: colors.accent,
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
