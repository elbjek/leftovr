import React from "react";
import { StyleSheet, View } from "react-native";

import { i18n } from "@/i18n";
import { colors, spacing } from "../../theme";
import { Button } from "./Button";
import { Text } from "./Text";

type Props = {
  children: React.ReactNode;
  /** Reported before the fallback renders (crash reporting, logging). */
  onError?: (error: Error, componentStack: string) => void;
};

type State = { error: Error | null };

/**
 * Catches render-time crashes so a single bad screen shows a retry card
 * instead of a blank app. Retry remounts the subtree; a crash that reproduces
 * immediately simply shows this card again.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info.componentStack ?? "");
  }

  retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <View style={styles.container}>
        <Text variant="h2" center>
          {i18n.t("errorBoundary.title")}
        </Text>
        <Text variant="body" muted center style={styles.body}>
          {i18n.t("errorBoundary.body")}
        </Text>
        <Button title={i18n.t("errorBoundary.retry")} onPress={this.retry} fit />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
});
