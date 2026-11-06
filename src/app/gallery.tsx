import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  BackButton,
  Button,
  Card,
  ChoiceCard,
  Divider,
  FilterChip,
  GlyphTile,
  IconButton,
  ListRow,
  PlusIcon,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  StatusPill,
  Tappable,
  Text,
  TextField,
} from "../components/primitives";
import { colors, radii, spacing, typography } from "../theme";

/**
 * Component gallery. Every primitive, every variant, every state, on one
 * screen against the real tokens.
 *
 * This is the review surface for the design system: a component reviewed
 * inside a real screen is reviewed against that screen's data and spacing,
 * which is how a system drifts. A component with no block here is not
 * finished.
 *
 * Reachable at /gallery. Not linked from anywhere in the app.
 */
export default function Gallery() {
  const router = useRouter();
  const [segment, setSegment] = useState<"all" | "soon" | "gone">("all");
  const [chip, setChip] = useState("fridge");
  const [text, setText] = useState("");

  return (
    <Screen scroll>
      <BackButton onPress={() => router.back()} />
      <ScreenHeader eyebrow="Design system" title="Gallery" subtitle="Every primitive, every state." />

      <Section title="Typography">
        <Card>
          {(["display", "h1", "h2", "h3", "body", "label", "small", "micro", "numeral"] as const).map(
            (v) => (
              <View key={v} style={styles.typeRow}>
                <Text variant="micro" muted style={styles.typeName}>
                  {v} · {typography[v].fontSize}/{typography[v].lineHeight}
                </Text>
                <Text variant={v}>{v === "numeral" ? "1 284" : "What's for dinner"}</Text>
              </View>
            ),
          )}
        </Card>
      </Section>

      <Section title="Colour">
        <View style={styles.swatches}>
          {(
            [
              ["bg", colors.bg],
              ["surface", colors.surface],
              ["surface2", colors.surface2],
              ["surface3", colors.surface3],
              ["primary", colors.primary],
              ["primary700", colors.primary700],
              ["accent", colors.accent],
              ["accentSoft", colors.accentSoft],
              ["accentInk", colors.accentInk],
              ["text", colors.text],
              ["muted", colors.muted],
              ["muted2", colors.muted2],
              ["green", colors.green],
              ["red", colors.red],
              ["redSoft", colors.redSoft],
              ["redInk", colors.redInk],
            ] as const
          ).map(([name, value]) => (
            <View key={name} style={styles.swatch}>
              <View style={[styles.chipColor, { backgroundColor: value }]} />
              <Text variant="micro" muted>
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Button">
        <Row label="primary">
          <Button title="Add to fridge" />
        </Row>
        <Row label="primary · loading">
          <Button title="Add to fridge" loading />
        </Row>
        <Row label="primary · disabled">
          <Button title="Add to fridge" disabled />
        </Row>
        <Row label="primary · icon">
          <Button title="Scan a receipt" iconLeft={<PlusIcon size={20} />} />
        </Row>
        <Row label="accent">
          <Button title="Cook this" variant="accent" />
        </Row>
        <Row label="ghost">
          <Button title="Maybe later" variant="ghost" />
        </Row>
        <Row label="text">
          <Button title="Skip" variant="text" />
        </Row>
        <Row label="fit">
          <Button title="Fit" fit />
        </Row>
        <Row label="long label">
          <Button title="Generate recipes from everything in the fridge" />
        </Row>
      </Section>

      <Section title="Card">
        <Card>
          <Text variant="h3">Plain card</Text>
          <Text muted>Padded by default.</Text>
        </Card>
        <View style={styles.gap} />
        <Card padded={false} style={styles.listCard}>
          <Text variant="h3">Unpadded card</Text>
          <Text muted>For lists that pad their own rows.</Text>
        </Card>
      </Section>

      <Section title="ChoiceCard">
        <ChoiceCard title="Fridge" subtitle="Cold storage" onPress={() => {}} />
        <View style={styles.gap} />
        <ChoiceCard title="Pantry" subtitle="Dry goods" selected onPress={() => {}} />
        <View style={styles.gap} />
        <ChoiceCard title="Yearly" subtitle="Two months free" recommended recommendedLabel="Best value" onPress={() => {}} />
        <View style={styles.gap} />
        <ChoiceCard title="Compact row" compact onPress={() => {}} />
        <View style={styles.gap} />
        <ChoiceCard title="Compact row, selected" compact selected onPress={() => {}} />
        <View style={styles.gap} />
        <ChoiceCard
          title="With an icon"
          subtitle="And a trailing value"
          icon={<PlusIcon size={20} color={colors.primary} />}
          trailing={<Text variant="small" muted>12</Text>}
          onPress={() => {}}
        />
      </Section>

      <Section title="TextField">
        <TextField label="Item name" value={text} onChangeText={setText} placeholder="Milk" />
        <View style={styles.gap} />
        <TextField label="Quantity" value="" placeholder="0" error="Enter a number" />
        <View style={styles.gap} />
        <TextField label="Disabled" value="Locked" editable={false} />
      </Section>

      <Section title="FilterChip">
        <View style={styles.rowWrap}>
          {["fridge", "pantry", "freezer"].map((c) => (
            <FilterChip key={c} label={c} active={chip === c} count="4" onPress={() => setChip(c)} />
          ))}
        </View>
      </Section>

      <Section title="ListRow + Divider">
        <Card padded={false} style={styles.listCard}>
          <ListRow
            title="Milk"
            subtitle="2 days left · Lena"
            leading={<GlyphTile name="milk" category="dairy" />}
            trailing={<StatusPill label="Use soon" tone="useSoon" />}
            onPress={() => {}}
          />
          <Divider inset />
          <ListRow
            title="Chicken breast"
            subtitle="Today · 450 g"
            leading={<GlyphTile name="chicken" category="meat" />}
            trailing={<StatusPill label="Today" tone="urgent" />}
            onPress={() => {}}
          />
          <Divider inset />
          <ListRow
            title="A very long item name that will not fit on one line"
            subtitle="And a subtitle that will not fit either, not even close"
            leading={<GlyphTile name="bread" category="bakery" />}
            onPress={() => {}}
          />
        </Card>
        <View style={styles.gap} />
        <Row label="settings shape · no leading, value trailing">
          <Card padded={false} style={styles.listCard}>
            <ListRow title="Language" trailing={<Text variant="small" muted>English</Text>} onPress={() => {}} />
            <Divider />
            <ListRow title="Units" trailing={<Text variant="small" muted>Metric</Text>} onPress={() => {}} />
            <Divider />
            <ListRow title="Delete account" danger onPress={() => {}} />
          </Card>
        </Row>
        <Row label="static · no onPress, no chevron">
          <Card padded={false} style={styles.listCard}>
            <ListRow title="Not pressable" subtitle="No chevron, no feedback" />
          </Card>
        </Row>
        <Row label="disabled">
          <Card padded={false} style={styles.listCard}>
            <ListRow title="Unavailable" subtitle="Needs a household" disabled onPress={() => {}} />
          </Card>
        </Row>
        <Row label="Divider · full and inset">
          <View style={styles.dividerDemo}>
            <Divider />
            <View style={styles.gap} />
            <Divider inset />
          </View>
        </Row>
      </Section>

      <Section title="SectionHeader">
        <Row label="section · h3">
          <SectionHeader title="In your fridge" />
        </Row>
        <Row label="section · subtitle and action">
          <SectionHeader
            title="Use first"
            subtitle="Four items go off this week"
            actions={<StatusPill label="4" />}
          />
        </Row>
        <Row label="sheet · h2">
          <SectionHeader title="Choose a language" level="sheet" />
        </Row>
        <Row label="sheet · subtitle">
          <SectionHeader
            title="Servings"
            subtitle="How many people do you usually cook for?"
            level="sheet"
          />
        </Row>
        <Row label="long title truncates nothing, action keeps its place">
          <SectionHeader
            title="Everything in the freezer that is going off soon"
            actions={<Text variant="small" muted>See all</Text>}
          />
        </Row>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          options={[
            { value: "all", label: "All" },
            { value: "soon", label: "Use soon" },
            { value: "gone", label: "Expired" },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Section>

      <Section title="GlyphTile">
        <Row label="sizes · sm 40 · md 44 · lg 64">
          <View style={styles.rowWrap}>
            <GlyphTile name="milk" category="dairy" size="sm" />
            <GlyphTile name="milk" category="dairy" size="md" />
            <GlyphTile name="milk" category="dairy" size="lg" />
          </View>
        </Row>
        <Row label="round">
          <View style={styles.rowWrap}>
            <GlyphTile name="apple" category="fruit" size="md" round />
            <GlyphTile name="bread" category="bakery" size="md" round />
          </View>
        </Row>
        <Row label="category tints">
          <View style={styles.rowWrap}>
            {["dairy", "meat", "fish", "vegetables", "fruit", "bakery", "frozen", "drinks", "snacks", "other"].map(
              (c) => (
                <GlyphTile key={c} name="" category={c} size="sm" />
              ),
            )}
          </View>
        </Row>
        <Row label="underscored category, normalised here">
          <GlyphTile name="" category="dairy_eggs" size="md" />
        </Row>
        <Row label="no match · drawn fallback">
          <GlyphTile name="zzzz" category="other" size="md" />
        </Row>
      </Section>

      <Section title="Skeleton">
        <Row label="in the shape of a ListRow">
          <Card padded={false} style={styles.listCard}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skelRow}>
                <Skeleton width={44} height={44} radius={12} />
                <View style={styles.skelCopy}>
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="35%" height={11} />
                </View>
                <Skeleton width={56} height={24} radius={12} />
              </View>
            ))}
          </Card>
        </Row>
        <Row label="shapes">
          <View style={styles.rowWrap}>
            <Skeleton width={120} height={16} />
            <Skeleton width={44} height={44} circle />
            <Skeleton width={90} height={90} radius={20} />
          </View>
        </Row>
      </Section>

      <Section title="StatusPill">
        <Row label="urgency · tone names match the Urgency keys">
          <View style={styles.rowWrap}>
            <StatusPill label="Fresh" tone="safe" />
            <StatusPill label="Use soon" tone="useSoon" />
            <StatusPill label="Today" tone="urgent" />
            <StatusPill label="Expired" tone="expired" />
          </View>
        </Row>
        <Row label="badges">
          <View style={styles.rowWrap}>
            <StatusPill label="4 items" />
            <StatusPill label="Best value" tone="accent" />
            <StatusPill label="Premium" tone="solid" />
          </View>
        </Row>
        <Row label="long label truncates, pill keeps its height">
          <StatusPill label="A very long status that will not fit on one line at all" tone="useSoon" />
        </Row>
      </Section>

      <Section title="Tappable">
        <Row label="opacity · rows and icon buttons">
          <Tappable label="A row" onPress={() => {}} style={styles.tapRow}>
            <Text>Press me</Text>
          </Tappable>
        </Row>
        <Row label="scale · tiles and card-sized targets">
          <Tappable label="A tile" feedback="scale" onPress={() => {}} style={styles.tapRow}>
            <Text>Press me</Text>
          </Tappable>
        </Row>
        <Row label="selected">
          <Tappable label="A row" selected onPress={() => {}} style={[styles.tapRow, styles.tapRowSelected]}>
            <Text color={colors.onPrimary}>Selected</Text>
          </Tappable>
        </Row>
        <Row label="disabled">
          <Tappable label="A row" disabled onPress={() => {}} style={styles.tapRow}>
            <Text>Disabled</Text>
          </Tappable>
        </Row>
        <Row label="none · when the child animates itself">
          <Tappable label="A row" feedback="none" onPress={() => {}} style={styles.tapRow}>
            <Text>No feedback</Text>
          </Tappable>
        </Row>
      </Section>

      <Section title="IconButton">
        <View style={styles.rowWrap}>
          <IconButton label="Add" onPress={() => {}}>
            <PlusIcon size={20} />
          </IconButton>
          <IconButton label="Add" transparent onPress={() => {}}>
            <PlusIcon size={20} color={colors.primary} />
          </IconButton>
        </View>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="micro" muted uppercase style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="micro" muted>
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.huge,
    gap: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.xxs,
  },
  row: {
    gap: spacing.sm,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  gap: {
    height: spacing.md,
  },
  typeRow: {
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
  },
  typeName: {
    opacity: 0.7,
  },
  swatches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  swatch: {
    alignItems: "center",
    gap: spacing.xxs,
    width: 72,
  },
  tapRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  tapRowSelected: {
    backgroundColor: colors.primary,
  },
  listCard: {
    paddingHorizontal: spacing.lg,
  },
  dividerDemo: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  skelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  skelCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  chipColor: {
    width: 56,
    height: 44,
    borderRadius: radii.sm,
  },
});
