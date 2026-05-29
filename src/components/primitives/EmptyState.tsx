import React from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../../theme";
import { Button } from "./Button";
import { Text } from "./Text";

type Props = {
  title: string;
  body?: string;
  illustration?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, body, illustration, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      {illustration ? <View style={styles.illustration}>{illustration}</View> : null}
      <Text variant="h2" center>
        {title}
      </Text>
      {body ? (
        <Text variant="body" muted center style={styles.body}>
          {body}
        </Text>
      ) : null}
      {actionLabel ? (
        <Button title={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.huge,
  },
  illustration: {
    marginBottom: spacing.xl,
  },
  body: {
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.xl,
    alignSelf: "stretch",
  },
});

