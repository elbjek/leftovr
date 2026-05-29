import { View } from "react-native";

import {
  AliveFridgeIllustration,
  Button,
  ChoiceCard,
  PageDots,
  Screen,
  Text,
} from "@/components";
import { colors, spacing } from "@/theme";

export default function IndexRoute() {
  return (
    <Screen>
      <View style={{ alignItems: "center", marginBottom: spacing.xxxl }}>
        <PageDots count={5} current={0} />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <AliveFridgeIllustration />
      </View>

      <View style={{ gap: spacing.lg }}>
        <Text variant="micro" color={colors.accent} uppercase center>
          Chomp setup
        </Text>
        <Text variant="display" center>
          Your fridge is getting its memory.
        </Text>
        <Text variant="body" muted center>
          Expo Router is running, and the native design system is ready for the next build phase.
        </Text>
        <ChoiceCard
          title="Scan a receipt"
          subtitle="The core Chomp flow starts here."
          recommended
          recommendedLabel="Recommended"
        />
        <Button title="Continue" />
      </View>
    </Screen>
  );
}

