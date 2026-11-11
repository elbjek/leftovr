import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { BottomSheet, Button, FilterChip, ListRow, PlusIcon, Screen, Tappable, Text, useToast } from "@/components";
import { FoodGlyph } from "@/components/illustrations";
import { useAuth } from "@/features";
import { useInventory, useShoppingList } from "@/hooks";
import { canonicalFoodName, isMetricAmountRunningLow } from "@/services";
import { colors, radii, shadows, spacing, typography } from "@/theme";

// Monday first; values are JS getDay() numbers, which the server uses too.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

// The household's shopping list: what to buy, what's run out ("Buy again"),
// and when to be reminded. Opened from Kitchen's card and the reminder push.
export default function ShoppingRoute() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { activeHousehold } = useAuth();
  const householdId = activeHousehold?.id;
  const { items, buyAgain, reminder, openCount, refresh, add, setChecked, remove, setReminder } = useShoppingList(householdId);
  const { groups, refresh: refreshInventory } = useInventory(householdId);

  const [draft, setDraft] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [hour, setHour] = useState(10);

  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const dayNames = t("shopping.days", { returnObjects: true }) as string[];

  const open = items.filter((item) => !item.checked_at);
  const bought = items.filter((item) => item.checked_at);

  // Used-up staples from the server, then whatever Kitchen says is running
  // low, minus anything already on the list.
  const suggestions = useMemo(() => {
    const listed = new Set(open.map((item) => item.normalized_name));
    const out: { key: string; name: string; reason: string }[] = [];
    for (const item of buyAgain) {
      if (listed.has(item.normalized_name)) continue;
      listed.add(item.normalized_name);
      out.push({ key: item.normalized_name, name: item.name, reason: t("shopping.usedUp") });
    }
    for (const group of groups.filter(isMetricAmountRunningLow)) {
      const key = canonicalFoodName(group.name);
      if (listed.has(key)) continue;
      listed.add(key);
      out.push({ key, name: group.name, reason: t("shopping.runningLow") });
    }
    return out;
  }, [buyAgain, groups, open, t]);

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch {
      showToast(t("shopping.error"));
    }
  }

  function submit() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    void run(() => add(name));
  }

  function openReminder() {
    setDays(reminder?.days ?? []);
    setHour(reminder?.hour ?? 10);
    setReminderOpen(true);
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refresh().catch(() => undefined), refreshInventory()]);
    setRefreshing(false);
  }

  const reminderSummary =
    reminder && reminder.days.length > 0
      ? t("shopping.reminderOn", {
          days: WEEK.filter((d) => reminder.days.includes(d)).map((d) => dayNames[d]).join(", "),
          time: formatHour(reminder.hour),
        })
      : t("shopping.reminderOff");

  return (
    <Screen
      scroll
      padded={false}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      <View style={styles.head}>
        <Tappable
          label={t("common.back")}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/fridge"))}
          hitSlop={6}
          style={[styles.backButton]}
        >
          <Svg width={8} height={14} viewBox="0 0 9 16" fill="none">
            <Path d="M8 1 2 8l6 7" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Tappable>
        <View style={styles.headCopy}>
          <Text variant="h3" accessibilityRole="header" numberOfLines={1}>
            {t("shopping.title")}
          </Text>
          <Text variant="small" muted>
            {t("shopping.toBuy", { count: openCount })}
          </Text>
        </View>
      </View>

      <View style={styles.gutter}>
        <View style={styles.addCard}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            placeholder={t("shopping.addPlaceholder")}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t("shopping.addPlaceholder")}
            returnKeyType="done"
            submitBehavior="submit"
            maxLength={80}
            style={styles.addInput}
          />
          <Tappable label={t("shopping.add")} onPress={submit} disabled={!draft.trim()} style={[styles.addButton]}>
            <PlusIcon color={colors.onPrimary} size={18} />
          </Tappable>
        </View>
      </View>

      <View style={styles.gutter}>
        <View style={styles.card}>
          {open.length === 0 ? (
            <Text variant="small" muted style={styles.empty}>
              {t("shopping.empty")}
            </Text>
          ) : null}
          {open.map((item) => (
            <ListRow
              key={item.id}
              title={item.name}
              leading={<Tick checked={false} />}
              trailing={<RemoveButton label={t("shopping.remove", { name: item.name })} onPress={() => void run(() => remove(item.id))} />}
              chevron={false}
              label={t("shopping.tick", { name: item.name })}
              onPress={() => void run(() => setChecked(item.id, true))}
            />
          ))}
          {bought.length > 0 ? (
            <>
              <Text variant="micro" muted style={styles.boughtLabel}>
                {t("shopping.bought")}
              </Text>
              {bought.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.name}
                  leading={<Tick checked />}
                  chevron={false}
                  label={t("shopping.untick", { name: item.name })}
                  onPress={() => void run(() => setChecked(item.id, false))}
                  style={styles.boughtRow}
                />
              ))}
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.gutter}>
        <View style={styles.card}>
          <ListRow
            title={t("shopping.reminderTitle")}
            subtitle={reminderSummary}
            leading={<BellIcon />}
            onPress={openReminder}
          />
        </View>
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.gutter}>
            <Text variant="h3" accessibilityRole="header">
              {t("shopping.buyAgainTitle")}
            </Text>
            <Text variant="small" muted>
              {t("shopping.buyAgainBody")}
            </Text>
          </View>
          <View style={styles.gutter}>
            <View style={styles.card}>
              {suggestions.map((s) => (
                <ListRow
                  key={s.key}
                  title={s.name}
                  subtitle={s.reason}
                  leading={
                    <View style={styles.glyphWell}>
                      <FoodGlyph name={s.name} size={30} />
                    </View>
                  }
                  trailing={
                    <View style={styles.addPill}>
                      <Text variant="label" color={colors.primary}>
                        {t("shopping.add")}
                      </Text>
                    </View>
                  }
                  chevron={false}
                  label={t("shopping.addName", { name: s.name })}
                  onPress={() => void run(() => add(s.name))}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      <BottomSheet visible={reminderOpen} onDismiss={() => setReminderOpen(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text variant="h3">{t("shopping.reminderTitle")}</Text>
            <Text variant="small" muted>
              {t("shopping.reminderBody")}
            </Text>
          </View>
          <View style={styles.days}>
            {WEEK.map((d) => (
              <FilterChip
                key={d}
                label={dayNames[d]}
                active={days.includes(d)}
                onPress={() => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
              />
            ))}
          </View>
          <View style={styles.hourRow}>
            <Text variant="label">{t("shopping.reminderTime")}</Text>
            <View style={styles.stepper}>
              <Tappable label={t("shopping.earlier")} onPress={() => setHour((h) => (h + 23) % 24)} style={[styles.stepButton]}>
                <Text variant="label" color={colors.primary}>−</Text>
              </Tappable>
              <Text variant="title" style={styles.hourText}>
                {formatHour(hour)}
              </Text>
              <Tappable label={t("shopping.later")} onPress={() => setHour((h) => (h + 1) % 24)} style={[styles.stepButton]}>
                <Text variant="label" color={colors.primary}>+</Text>
              </Tappable>
            </View>
          </View>
          <Button
            title={t("shopping.reminderSave")}
            onPress={() => {
              setReminderOpen(false);
              void run(() => setReminder({ days: [...days].sort((a, b) => a - b), hour }));
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function Tick({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.tick, checked && styles.tickOn]}>
      {checked ? (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12.5 10 17l9-10" stroke={colors.onPrimary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Tappable label={label} onPress={onPress} hitSlop={8} style={[styles.removeButton]}>
      <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
        <Path d="M5 5l14 14M19 5 5 19" stroke={colors.muted} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </Tappable>
  );
}

function BellIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0"
        stroke={colors.primary}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.tabBarClearance,
    gap: spacing.xl,
  },
  gutter: {
    paddingHorizontal: spacing.screenX,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.screenX,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  addCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadows.soft,
  },
  addInput: {
    flex: 1,
    minHeight: 44,
    color: colors.text,
    ...typography.body,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    ...shadows.soft,
  },
  empty: {
    paddingVertical: spacing.lg,
  },
  boughtLabel: {
    paddingTop: spacing.md,
  },
  boughtRow: {
    opacity: 0.55,
  },
  tick: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  tickOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    gap: spacing.md,
  },
  glyphWell: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  addPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  sheet: {
    gap: spacing.xl,
  },
  sheetHead: {
    gap: spacing.xxs,
  },
  days: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  hourRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  hourText: {
    minWidth: 64,
    textAlign: "center",
  },
});
