import { useState } from "react";
import { Alert, Linking, Pressable, Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";

import { colors, radii, spacing } from "../../theme";
import { Button, Text, TextField } from "../primitives";
import { HouseholdInvite, HouseholdMember, InviteLookup } from "@/repositories/householdRepository";

type Props = {
  householdName: string;
  members: HouseholdMember[];
  currentUserId: string;
  activeInvite: HouseholdInvite | null;
  isPremium: boolean;
  /** True when the user personally pays for a subscription (individual or the
   *  household payer). Joining another household won't refund or cancel it. */
  hasOwnPaidSub: boolean;
  currentItemCount: number;
  onCreateInvite: () => Promise<HouseholdInvite | null>;
  onLookupCode: (code: string) => Promise<InviteLookup | null>;
  onJoin: (code: string, moveItems: boolean) => Promise<void>;
  onPremiumGate: () => void;
  /** True when the user's own subscription is what makes this kitchen Household Premium. */
  paysForHousehold: boolean;
  onRemoveMember: (userId: string) => Promise<void>;
  onMakeOwner: (userId: string) => Promise<void>;
  onLeave: () => Promise<void>;
  initialJoinCode?: string;
};

// Apple never lets an app cancel a user's subscription — they must do it in the
// App Store. Deep-link straight to the manage-subscriptions screen.
const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

// Native confirm dialog resolved as a promise so handleJoin can await the
// user's choice before committing the (irreversible) household switch. "Manage
// subscription" sends them to the App Store to cancel and does not join.
function confirmActiveSubscription(t: (key: string) => string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      t("settings.household.subWarningTitle"),
      t("settings.household.subWarningBody"),
      [
        { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
        {
          text: t("settings.household.subWarningManage"),
          onPress: () => {
            void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL);
            resolve(false);
          },
        },
        { text: t("settings.household.subWarningContinue"), style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function HouseholdSection({
  householdName,
  members,
  currentUserId,
  activeInvite,
  isPremium,
  hasOwnPaidSub,
  currentItemCount,
  onCreateInvite,
  onLookupCode,
  onJoin,
  onPremiumGate,
  paysForHousehold,
  onRemoveMember,
  onMakeOwner,
  onLeave,
  initialJoinCode,
}: Props) {
  const { t } = useTranslation();
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? "");
  const [lookupResult, setLookupResult] = useState<InviteLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showJoinChoice, setShowJoinChoice] = useState(false);

  // Sync a newly-arrived deep-linked invite code into local state during render
  // (React's "adjust state on prop change" pattern — avoids a setState effect).
  const [prevInitialJoinCode, setPrevInitialJoinCode] = useState(initialJoinCode);
  if (initialJoinCode && initialJoinCode !== prevInitialJoinCode) {
    setPrevInitialJoinCode(initialJoinCode);
    setJoinCode(initialJoinCode);
    setLookupResult(null);
    setLookupError(null);
    setJoinError(null);
  }

  const isOwner = members.some((m) => m.user_id === currentUserId && m.role === "owner");
  // Same heir rule as the server: the longest-standing other member (list is joined_at order).
  const heir = members.find((m) => m.user_id !== currentUserId);

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch {
      Alert.alert(t("settings.household.manageErrorTitle"), t("settings.household.manageError"));
    }
  }

  function handleManageMember(member: HouseholdMember) {
    const name = member.display_name;
    Alert.alert(name, undefined, [
      {
        text: t("settings.household.makeOwner"),
        onPress: () =>
          Alert.alert(
            t("settings.household.makeOwnerTitle", { name }),
            t("settings.household.makeOwnerBody"),
            [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("settings.household.makeOwner"), onPress: () => void run(() => onMakeOwner(member.user_id)) },
            ],
          ),
      },
      {
        text: t("settings.household.removeMember"),
        style: "destructive",
        onPress: () =>
          Alert.alert(
            t("settings.household.removeTitle", { name }),
            t("settings.household.removeBody"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("settings.household.removeMember"),
                style: "destructive",
                onPress: () => void run(() => onRemoveMember(member.user_id)),
              },
            ],
          ),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  function handleLeave() {
    const body = [
      t("settings.household.leaveBody"),
      isOwner && heir ? t("settings.household.leaveOwnerBody", { name: heir.display_name }) : null,
      paysForHousehold ? t("settings.household.leavePayerBody") : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    Alert.alert(t("settings.household.leaveTitle", { name: householdName }), body, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.household.leave"), style: "destructive", onPress: () => void run(onLeave) },
    ]);
  }

  async function handleCreateInvite() {
    if (!isPremium) {
      onPremiumGate();
      return;
    }
    setInviteLoading(true);
    try {
      await onCreateInvite();
    } catch {
      // The server gate is the household's plan_tier; the client gate also
      // passes on the payer's own tier, so a just-purchased plan can fail here
      // until the webhook lands. Say so instead of stopping the spinner.
      Alert.alert(t("settings.household.manageErrorTitle"), t("settings.household.manageError"));
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopy(code: string) {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare(code: string) {
    await Share.share({
      message: t("settings.household.shareMessage", {
        code,
        // The web link works for everyone: it opens the app through the
        // leftovr:// scheme when it's installed, and explains the code when
        // it isn't. A bare leftovr:// link is dead for anyone without the app.
        link: `https://leftovr.co/join?code=${code}`,
      }),
    });
  }

  async function handleLookup() {
    // Joining is not premium-gated: invitees inherit premium from the household
    // they join (spec §1). Only create-invite requires Household Premium.
    if (!joinCode.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const result = await onLookupCode(joinCode);
      if (result) {
        if (result.member_count >= 3) {
          setLookupError(t("settings.household.householdFull"));
        } else {
          setLookupResult(result);
        }
      } else {
        setLookupError(t("settings.household.invalidCode"));
      }
    } catch {
      setLookupError(t("settings.household.invalidCode"));
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleJoin(moveItems: boolean) {
    // Joining is covered by the new household, but the user's own subscription
    // won't refund or auto-cancel — warn the payer before they proceed.
    if (hasOwnPaidSub && !(await confirmActiveSubscription(t))) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      await onJoin(joinCode, moveItems);
      setJoinCode("");
      setLookupResult(null);
      setShowJoinChoice(false);
    } catch (err) {
      // Server raises a readable message (e.g. Household Premium owner block); surface it.
      const message = err instanceof Error ? err.message : "";
      setJoinError(
        message.includes("Household Premium")
          ? t("settings.household.ownerBlocked")
          : message.includes("member limit")
            ? t("settings.household.householdFull")
            : t("settings.household.invalidCode"),
      );
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <View style={styles.cardInner}>
        <View style={styles.sectionHeader}>
          <Text variant="label">{t("settings.household.membersTitle")}</Text>
          <Text variant="small" muted>
            {t("settings.household.memberCount", { count: members.length })}
          </Text>
        </View>

        <View style={styles.memberList}>
          {members.map((member) => {
            const isYou = member.user_id === currentUserId;
            return (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text variant="micro" color={colors.onPrimary}>
                    {member.avatar_initials ?? "?"}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text variant="small">
                    {member.display_name}
                    {isYou ? ` (${t("settings.household.you")})` : ""}
                  </Text>
                  <Text variant="micro" muted>
                    {member.role === "owner"
                      ? t("settings.household.owner")
                      : t("settings.household.member")}
                  </Text>
                </View>
                {isOwner && !isYou ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("settings.household.manageMember", { name: member.display_name })}
                    hitSlop={8}
                    onPress={() => handleManageMember(member)}
                  >
                    <Text variant="small" color={colors.primary}>
                      {t("settings.household.manage")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {members.length > 1 ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={handleLeave} style={styles.leave}>
              <Text variant="small" color={colors.red}>
                {t("settings.household.leave")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isPremium && activeInvite ? (
          <View style={styles.inviteBox}>
            <Text variant="micro" muted>
              {t("settings.household.inviteCode")}
            </Text>
            <Text variant="h3" style={styles.inviteCodeText}>
              {activeInvite.code}
            </Text>
            <Text variant="micro" muted>
              {t("settings.household.inviteExpires", {
                date: new Date(activeInvite.expires_at).toLocaleDateString(),
              })}
            </Text>
            <Button
              title={copied ? t("settings.household.codeCopied") : t("settings.household.copyCode")}
              variant="ghost"
              onPress={() => handleCopy(activeInvite.code)}
            />
            <Button
              title={t("settings.household.shareInvite")}
              variant="ghost"
              onPress={() => handleShare(activeInvite.code)}
            />
          </View>
        ) : (
          <Button
            title={t("settings.household.createInvite")}
            variant="ghost"
            loading={inviteLoading}
            onPress={handleCreateInvite}
          />
        )}

        <View style={styles.divider} />

        <View style={styles.sectionHeader}>
          <Text variant="label">{t("settings.household.enterCode")}</Text>
          <Text variant="small" muted>
            {t("settings.household.enterCodeBody")}
          </Text>
        </View>

        <TextField
          label={t("settings.household.codeLabel")}
          placeholder={t("settings.household.codePlaceholder")}
          value={joinCode}
          onChangeText={(text) => {
            setJoinCode(text);
            setLookupResult(null);
            setLookupError(null);
            setJoinError(null);
          }}
          autoCapitalize="characters"
          error={lookupError ?? joinError ?? undefined}
        />

        {lookupResult ? (
          <View style={styles.lookupResult}>
            <Text variant="h3">
              {t("settings.household.lookupTitle", { name: lookupResult.household_name })}
            </Text>
            <Text variant="small" muted>
              {t("settings.household.lookupMembers", { count: lookupResult.member_count })}
            </Text>

            {showJoinChoice && currentItemCount > 0 ? (
              <View style={styles.joinChoices}>
                <Text variant="small" style={styles.choiceTitle}>
                  {t("settings.household.joinChoiceTitle")}
                </Text>
                <Text variant="small" muted>
                  {t("settings.household.joinChoiceBody")}
                </Text>
                <Button
                  title={t("settings.household.moveItems")}
                  loading={joinLoading}
                  onPress={() => handleJoin(true)}
                />
                <Button
                  title={t("settings.household.joinWithout")}
                  variant="ghost"
                  loading={joinLoading}
                  onPress={() => handleJoin(false)}
                />
              </View>
            ) : (
              <Button
                title={t("settings.household.joinButton")}
                loading={joinLoading}
                onPress={() => {
                  if (currentItemCount > 0) {
                    setShowJoinChoice(true);
                  } else {
                    handleJoin(false);
                  }
                }}
              />
            )}
          </View>
        ) : (
          <Button
            title={t("settings.household.lookupButton")}
            variant="ghost"
            loading={lookupLoading}
            onPress={handleLookup}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    gap: spacing.md,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  memberList: {
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  leave: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  inviteBox: {
    backgroundColor: colors.primary50,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  inviteCodeText: {
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.sm,
  },
  lookupResult: {
    backgroundColor: colors.primary50,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  joinChoices: {
    gap: spacing.md,
  },
  choiceTitle: {
    fontWeight: "600",
  },
});
