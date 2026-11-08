import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { ListRow } from "../primitives";

export type CheckItem = {
  id: string;
  name: string;
  category?: string;
  /** "Expired" when the user-entered date passed, else "Past its best". */
  label: string;
  /** Compact date-only variant for dense lists ("5 Jul 2026" / "No date"). */
  shortLabel?: string;
};

type Props = {
  count: number;
  labels: {
    kicker: string;
    subtitle: string;
  };
  onPress: () => void;
};

/**
 * Items past their (known or estimated) date. They left the category shelves
 * and everything that cooks — this warm note exists to be emptied: it opens
 * the triage sheet where food gets vouched for ("still good") or tossed.
 */
export function CheckTheseShelf({ count, labels, onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <ListRow
          title={`${labels.kicker} · ${count}`}
          subtitle={labels.subtitle}
          leading={<AlertIcon />}
          trailing={
            <View style={styles.go}>
              <ArrowIcon />
            </View>
          }
          chevron={false}
          onPress={onPress}
        />
      </View>
    </View>
  );
}

function AlertIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5 21 20H3L12 3.5Z"
        stroke={colors.primary}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 10v4.5M12 17.2v.3" stroke={colors.primary} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

function ArrowIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenX,
  },
  card: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
  },
  go: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
