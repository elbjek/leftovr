import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { useShareImage } from "../../hooks/useShareImage";
import { radii, spacing } from "../../theme";
import { BottomSheet, Button, FilterChip, SegmentedControl, Text } from "../primitives";
import { ShareCard, ShareCardExport, type ShareCardProps, type ShareFormat } from "./ShareCard";

/** One card on offer: its chip label, what it draws and the caption it shares with. */
export type ShareLook = {
  id: string;
  label: string;
  card: ShareCardProps;
  caption: string;
};

type Props = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  /** Only looks with real content; the first one opens. */
  looks: ShareLook[];
  labels: { post: string; story: string; share: string };
};

/** How tall the preview may be; the card's width follows from its format. */
const PREVIEW_HEIGHT = 340;

/**
 * Pick which stat to share and in which shape (Instagram post or story), see
 * it, then the iOS share sheet. The export is drawn off screen inside this
 * sheet's own Modal — never a second Modal (iOS drops it).
 */
export function ShareStatsSheet({ visible, onDismiss, title, looks, labels }: Props) {
  const [lookId, setLookId] = useState<string | null>(null);
  const [format, setFormat] = useState<ShareFormat>("post");
  const [busy, setBusy] = useState(false);
  const image = useShareImage();

  const look = looks.find((option) => option.id === lookId) ?? looks[0];
  if (!look) return null;

  const share = async () => {
    setBusy(true);
    try {
      await image.share(look.caption, format);
    } finally {
      setBusy(false);
    }
  };

  const previewWidth = Math.round(PREVIEW_HEIGHT * (format === "story" ? 9 / 16 : 4 / 5));

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      overlay={<ShareCardExport viewRef={image.ref} format={format} {...look.card} />}
    >
      <View style={styles.content}>
        <Text variant="h2" accessibilityRole="header">
          {title}
        </Text>

        <View style={styles.preview}>
          {/* Keyed by card and format: a fresh layout each switch, so iOS
              never reuses the other card's text measurements. */}
          <View key={`${look.id}-${format}`} style={styles.previewClip}>
            <ShareCard width={previewWidth} format={format} {...look.card} />
          </View>
        </View>

        {looks.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {looks.map((option) => (
              <FilterChip key={option.id} label={option.label} active={option.id === look.id} onPress={() => setLookId(option.id)} />
            ))}
          </ScrollView>
        ) : null}

        <SegmentedControl<ShareFormat>
          value={format}
          onChange={setFormat}
          options={[
            { value: "post", label: labels.post },
            { value: "story", label: labels.story },
          ]}
        />

        <Button title={labels.share} onPress={() => void share()} disabled={busy} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  preview: {
    height: PREVIEW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  previewClip: {
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  chips: {
    gap: spacing.xs,
    paddingRight: spacing.xxl,
  },
});
