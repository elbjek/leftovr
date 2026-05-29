import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../../theme";
import { BottomSheet, Button, Card, Text } from "../primitives";

type PremiumPlan = "individual" | "household";

type Props = {
  visible: boolean;
  plan?: PremiumPlan;
  copy: {
    individualTitle: string;
    householdTitle: string;
    individualBody: string;
    householdBody: string;
    individualMonthly: string;
    individualYearly: string;
    householdMonthly: string;
    householdYearly: string;
    prototypeBadge: string;
    previewIndividualAction: string;
    previewHouseholdAction: string;
    dismissAction: string;
  };
  onPreview: () => void;
  onDismiss: () => void;
};

export function PremiumSheet({ visible, plan = "individual", copy, onPreview, onDismiss }: Props) {
  const household = plan === "household";

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <Text variant="h2">{household ? copy.householdTitle : copy.individualTitle}</Text>
      <Text variant="body" muted style={styles.body}>
        {household ? copy.householdBody : copy.individualBody}
      </Text>
      <Card style={styles.priceCard}>
        <View>
          <Text variant="label">{household ? copy.householdMonthly : copy.individualMonthly}</Text>
          <Text variant="small" muted style={styles.priceSub}>
            {household ? copy.householdYearly : copy.individualYearly}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text variant="micro" color={colors.text} uppercase>
            {copy.prototypeBadge}
          </Text>
        </View>
      </Card>
      <Button
        title={household ? copy.previewHouseholdAction : copy.previewIndividualAction}
        onPress={onPreview}
        style={styles.primary}
      />
      <Button title={copy.dismissAction} variant="text" onPress={onDismiss} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: spacing.sm,
  },
  priceCard: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceSub: {
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  primary: {
    marginBottom: spacing.sm,
  },
});
