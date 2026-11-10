import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { spacing } from "../../theme";
import { Button, Card, Text } from "../primitives";

type Props = {
  count: number;
  onReview: () => void;
  onDiscard: () => void;
  style?: React.ComponentProps<typeof Card>["style"];
};

// A scan that was read but never confirmed (the app was closed on the review
// list). Shown on the home and the Add screen until reviewed or discarded.
export function UnfinishedScanCard({ count, onReview, onDiscard, style }: Props) {
  const { t } = useTranslation();
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.copy}>
        <Text variant="title">{t("scan.unfinished.title")}</Text>
        <Text variant="small" muted>
          {t("scan.unfinished.body", { count })}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title={t("scan.unfinished.discard")} variant="text" onPress={onDiscard} />
        <Button title={t("scan.unfinished.review")} onPress={onReview} style={styles.review} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  copy: {
    gap: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  review: {
    flex: 1,
  },
});
