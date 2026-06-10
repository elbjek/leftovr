import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Screen } from "@/components";
import { setPendingInviteCode, useAuth } from "@/features";
import { colors } from "@/theme";

export default function JoinRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { loading, session, profile } = useAuth();
  const [stashed, setStashed] = useState(false);

  const inviteCode = typeof code === "string" ? code.trim().toUpperCase() : "";
  const isOnboarded = Boolean(session && profile?.onboarding_completed_at);
  const shouldStash = Boolean(inviteCode) && !loading && !isOnboarded;

  useEffect(() => {
    if (!shouldStash) return;
    void setPendingInviteCode(inviteCode).finally(() => setStashed(true));
  }, [inviteCode, shouldStash]);

  if (loading || (shouldStash && !stashed)) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (inviteCode && isOnboarded) {
    return <Redirect href={{ pathname: "/(tabs)/settings", params: { joinCode: inviteCode } }} />;
  }

  return <Redirect href="/" />;
}
