import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";

import { colors, radii, spacing } from "../../theme";
import { Button, Card, Text, TextField } from "../primitives";
import { HouseholdInvite, HouseholdMember, InviteLookup } from "@/repositories/householdRepository";

type Props = {
  householdName: string;
  members: HouseholdMember[];
  currentUserId: string;
  activeInvite: HouseholdInvite | null;
  isPremium: boolean;
  currentItemCount: number;
  onCreateInvite: () => Promise<HouseholdInvite | null>;
  onLookupCode: (code: string) => Promise<InviteLookup | null>;
  onJoin: (code: string, moveItems: boolean) => Promise<void>;
  onPremiumGate: () => void;
  initialJoinCode?: string;
};

export function HouseholdSection({
  householdName,
  members,
  currentUserId,
  activeInvite,
  isPremium,
  currentItemCount,
  onCreateInvite,
  onLookupCode,
  onJoin,
  onPremiumGate,
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

  async function handleCreateInvite() {
    if (!isPremium) {
      onPremiumGate();
      return;
    }
    setInviteLoading(true);
    try {
      await onCreateInvite();
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
        link: `leftovr://join?code=${code}`,
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
          : t("settings.household.invalidCode"),
      );
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <Card>
      <View style={styles.cardInner}>
        <View style={styles.sectionHeader}>
          <Text variant="label">{t("settings.household.title")}</Text>
          <Text variant="small" muted>
            {householdName}
          </Text>
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
                  <Text variant="micro" color={colors.surface}>
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
              </View>
            );
          })}
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
    </Card>
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
