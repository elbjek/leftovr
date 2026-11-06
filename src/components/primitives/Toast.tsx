import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";

import { colors, radii, shadows, spacing } from "../../theme";
import { Text } from "./Text";

type ToastContextValue = { showToast: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3000;

/**
 * One-line, non-blocking failure notice — for things that quietly failed in the
 * background (a saved preference, a sync). Blocking decisions still use Alert.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: string) => {
    setMessage(next);
  }, []);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        () => setMessage(null),
      );
    }, VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, opacity]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
          <Text variant="small" color={colors.white} center accessibilityLiveRegion="polite">
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return value;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.screenX,
    right: spacing.screenX,
    bottom: 96,
    backgroundColor: colors.black,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
});
