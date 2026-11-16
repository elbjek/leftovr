import * as Notifications from "expo-notifications";
import { StyleSheet } from "react-native";

import { colors, radii, shadows, spacing } from "../../theme";
import { Tappable, Text } from "../primitives";

/** Dev builds only: a fake "Kitchen updated" push, 5 s after the tap, so the
 *  tap → Kitchen walkthrough can be tried without a second account. Its
 *  `demo` name makes the Kitchen show your 3 newest foods as that housemate's.
 *  Background the app or switch tabs while it's on the way. */
export function DevHousematePushButton() {
  if (!__DEV__) return null;
  const send = async () => {
    await Notifications.requestPermissionsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Kitchen updated",
        body: "Ana added 3 items to your kitchen.",
        data: { type: "member_activity", demo: "Ana" },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
    });
  };
  return (
    <Tappable label="Test: Ana added 3 items" onPress={() => void send()} style={styles.button}>
      <Text variant="small" weight="bold" color={colors.onPrimary}>
        Test: Ana added 3 items (5s)
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: spacing.screenX,
    bottom: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    ...shadows.soft,
  },
});
