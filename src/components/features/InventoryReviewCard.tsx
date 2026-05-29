import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../../theme";
import { Button, Card, Text } from "../primitives";

type Props = {
  count: number;
  title: string;
  body: string;
  actionLabel: string;
  onReview: () => void;
};

export function InventoryReviewCard({ count, title, body, actionLabel, onReview }: Props) {
  if (count <= 0) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.icon}>
        <Text variant="h3" color={colors.primary}>
          {count}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text variant="label">{title}</Text>
        <Text variant="small" muted style={styles.body}>
          {body}
        </Text>
      </View>
      <Button title={actionLabel} variant="text" onPress={onReview} />
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
    backgroundColor: colors.primary50,
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
