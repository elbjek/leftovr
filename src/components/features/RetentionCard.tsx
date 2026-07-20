import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../../theme";
import { Button, Card, Text } from "../primitives";

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
};

export function RetentionCard({ title, body, actionLabel, actionIcon, onAction }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.icon}>
        <Text variant="h3" color={colors.accent} italic>
          +
        </Text>
      </View>
      <View style={styles.copy}>
        <Text variant="label">{title}</Text>
        <Text variant="small" muted style={styles.body}>
          {body}
        </Text>
      </View>
      {actionLabel ? (
        <Button title={actionLabel} variant="text" iconLeft={actionIcon} onPress={onAction} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  body: {
    marginTop: 2,
  },
});

