import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { colors, radii, spacing } from "@/theme";

import { Logo } from "../illustrations";
import { Text } from "../primitives";

type Props = {
  body: string;
  appleLabel: string;
  googleLabel: string;
  emailLabel: string;
  termsCopy: string;
  termsLabel: string;
  privacyLabel: string;
  onApple?: () => void;
  onGoogle?: () => void;
  onEmail: () => void;
};

export function AuthLanding({
  body,
  appleLabel,
  googleLabel,
  emailLabel,
  termsCopy,
  termsLabel,
  privacyLabel,
  onApple,
  onGoogle,
  onEmail,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.brandBlock}>
        <View style={styles.wordmarkRow}>
          <Logo size={40} />
        </View>
        <Text variant="body" muted center style={styles.body}>
          {body}
        </Text>
      </View>

      <View style={styles.buttons}>
        <AuthButton
          label={appleLabel}
          backgroundColor={colors.black}
          color={colors.white}
          icon={<AppleIcon />}
          onPress={onApple}
        />
        <AuthButton
          label={googleLabel}
          backgroundColor={colors.paper}
          color={colors.text}
          borderColor={colors.hairlineStrong}
          icon={<GoogleIcon />}
          onPress={onGoogle}
        />
        <AuthButton
          label={emailLabel}
          backgroundColor={colors.primary}
          color={colors.surface}
          icon={<EmailIcon />}
          onPress={onEmail}
        />
      </View>

      <View style={styles.spacer} />

      <Text variant="small" muted center style={styles.terms}>
        {termsCopy}{" "}
        <Text variant="small" color={colors.primary} style={styles.link}>
          {termsLabel}
        </Text>{" "}
        and{" "}
        <Text variant="small" color={colors.primary} style={styles.link}>
          {privacyLabel}
        </Text>
        .
      </Text>
    </View>
  );
}

function AuthButton({
  label,
  icon,
  backgroundColor,
  color,
  borderColor,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  backgroundColor: string;
  color: string;
  borderColor?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.authButton,
        { backgroundColor, borderColor: borderColor ?? backgroundColor },
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text variant="label" color={color} style={styles.authButtonLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function AppleIcon() {
  return (
    <Svg width={18} height={20} viewBox="0 0 18 20" fill={colors.white}>
      <Path d="M14.6 10.6c0-2 1.6-3 1.7-3-0.9-1.4-2.4-1.6-2.9-1.6-1.2-0.1-2.4 0.7-3 0.7-0.6 0-1.6-0.7-2.6-0.7-1.3 0-2.5 0.8-3.2 2-1.4 2.4-0.4 5.9 1 7.8 0.7 0.9 1.5 2 2.5 1.9 1 0 1.4-0.6 2.6-0.6 1.2 0 1.5 0.6 2.6 0.6 1.1 0 1.8-0.9 2.4-1.9 0.8-1.1 1.1-2.1 1.1-2.2-0.1-0.1-2.2-0.8-2.2-3zm-2-5.6c0.5-0.6 0.9-1.5 0.8-2.4-0.8 0-1.7 0.5-2.2 1.2-0.5 0.5-0.9 1.5-0.8 2.3 0.9 0.1 1.7-0.4 2.2-1.1z" />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8c-.2 1.1-.8 2.1-1.8 2.7v2.3h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" />
      <Path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2L12.1 13.5c-.8.5-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.4C2.4 15.9 5.5 18 9 18z" />
      <Path fill="#FBBC04" d="M3.9 10.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V4.9H.9C.3 6.1 0 7.5 0 9s.3 2.9.9 4.1l3-2.4z" />
      <Path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.4l2.6-2.6C13.5.9 11.4 0 9 0 5.5 0 2.4 2.1.9 4.9l3 2.4C4.6 5.1 6.6 3.6 9 3.6z" />
    </Svg>
  );
}

function EmailIcon() {
  return (
    <Svg width={18} height={14} viewBox="0 0 18 14" fill="none">
      <Rect x={0.5} y={0.5} width={17} height={13} rx={2} stroke={colors.surface} strokeWidth={1.5} />
      <Path d="M1 2L9 8L17 2" stroke={colors.surface} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingTop: 88,
    paddingHorizontal: 28,
    paddingBottom: spacing.huge,
  },
  brandBlock: {
    alignItems: "center",
    marginBottom: 48,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  body: {
    marginTop: 18,
    maxWidth: 260,
  },
  buttons: {
    gap: 12,
  },
  authButton: {
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  authButtonLabel: {
    fontSize: 16,
  },
  spacer: {
    flex: 1,
  },
  terms: {
    marginTop: spacing.xxl,
  },
  link: {
    textDecorationLine: "underline",
  },
});
