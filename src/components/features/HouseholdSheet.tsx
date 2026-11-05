import { useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { canShareHousehold, useAuth } from "@/features";
import { useHousehold } from "@/hooks/useHousehold";
import { renameHousehold } from "@/repositories/householdRepository";
import { spacing } from "../../theme";
import { BottomSheet, Text, TextField } from "../primitives";
import { HouseholdSection } from "./HouseholdSection";
import { PremiumSheet } from "./PremiumSheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Food in the current kitchen — decides whether joining asks to move it. */
  itemCount: number;
  initialJoinCode?: string;
};

/**
 * The one place to manage the household: kitchen name, members (owner can
 * make owner / remove), leave, invite and join. Opened from the household pill
 * on Kitchen and Home, and from Settings.
 */
export function HouseholdSheet({ visible, onClose, itemCount, initialJoinCode }: Props) {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh } = useAuth();
  const household = useHousehold(activeHousehold?.id);
  const [name, setName] = useState(activeHousehold?.name ?? "");
  const [prevName, setPrevName] = useState(activeHousehold?.name);
  if (activeHousehold?.name !== prevName) {
    setPrevName(activeHousehold?.name);
    setName(activeHousehold?.name ?? "");
  }
  // The premium sheet is a Modal of its own: open it only once this sheet is gone.
  const [premiumNext, setPremiumNext] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  if (!profile || !activeHousehold) return null;
  const householdId = activeHousehold.id;
  const currentName = activeHousehold.name;

  async function saveName() {
    const clean = name.trim();
    if (!clean || clean === currentName) {
      setName(currentName);
      return;
    }
    try {
      await renameHousehold(householdId, clean);
      await refresh();
    } catch {
      setName(currentName);
      Alert.alert(t("settings.household.manageErrorTitle"), t("settings.household.manageError"));
    }
  }

  return (
    <>
      <BottomSheet
        visible={visible}
        onDismiss={onClose}
        onClosed={() => {
          if (!premiumNext) return;
          setPremiumNext(false);
          setShowPremium(true);
        }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Text variant="h2">{currentName}</Text>
          <TextField
            label={t("settings.household.kitchenName")}
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            returnKeyType="done"
          />
          <HouseholdSection
            householdName={currentName}
            members={household.members}
            currentUserId={profile.id}
            activeInvite={household.activeInvite}
            isPremium={canShareHousehold(profile, activeHousehold)}
            hasOwnPaidSub={(profile.tier ?? "free") !== "free"}
            paysForHousehold={
              profile.tier === "household_premium" && activeHousehold.plan_tier === "household_premium"
            }
            currentItemCount={itemCount}
            onCreateInvite={household.createInvite}
            onLookupCode={household.lookupCode}
            onJoin={async (code, moveItems) => {
              await household.joinHousehold(code, moveItems);
              await refresh();
            }}
            onPremiumGate={() => {
              setPremiumNext(true);
              onClose();
            }}
            onRemoveMember={household.removeMember}
            onMakeOwner={household.makeOwner}
            onLeave={async () => {
              await household.leave();
              await refresh();
            }}
            initialJoinCode={initialJoinCode}
          />
        </ScrollView>
      </BottomSheet>
      <PremiumSheet
        visible={showPremium}
        plan="household"
        onPurchased={refresh}
        onDismiss={() => setShowPremium(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexShrink: 1,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
