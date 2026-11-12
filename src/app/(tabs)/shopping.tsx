import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { BottomSheet, Button, FilterChip, HouseholdPill, HouseholdSheet, ListRow, Logo, PlusIcon, Screen, ShoppingListIcon, Tappable, Text, useToast } from "@/components";
import { FoodGlyph } from "@/components/illustrations";
import { useAuth } from "@/features";
import { foodMatchKey, searchFoods } from "@/lib";
import { useInventory, useShoppingList } from "@/hooks";
import { canonicalFoodName, isMetricAmountRunningLow } from "@/services";
import { colors, radii, shadows, spacing, typography } from "@/theme";

// Monday first; values are JS getDay() numbers, which the server uses too.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

// What the Remind me sheet suggests before anyone has saved a schedule, from
// onboarding's "How do you usually shop?". Nothing is sent until saved.
const SUGGESTED_REMINDER: Record<string, { days: number[]; hour: number }> = {
  weekly: { days: [6], hour: 10 },
  few: { days: [1, 4], hour: 17 },
};

// The same food under any name: catalog food, else the canonical name.
function itemKeyOf(name: string) {
  return foodMatchKey(name) ?? canonicalFoodName(name);
}

// The household's shopping list: what to buy, what's run out ("Buy again"),
// and when to be reminded. A dock tab; also opened from Kitchen's card, the
// app icon's quick action and the reminder push.
export default function ShoppingRoute() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { activeHousehold, profile } = useAuth();
  const householdId = activeHousehold?.id;
  const { items, buyAgain, dismissals, reminder, openCount, refresh, add, setChecked, remove, dismiss, setReminder } =
    useShoppingList(householdId);
  const { groups, refresh: refreshInventory } = useInventory(householdId);

  const [draft, setDraft] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [hour, setHour] = useState(10);
  const [householdOpen, setHouseholdOpen] = useState(false);
  const [addFocused, setAddFocused] = useState(false);
  const rawName = profile?.display_name?.trim() ?? "";
  const firstName = rawName && !rawName.includes("@") ? rawName.split(/\s+/)[0] : "";

  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const dayNames = t("shopping.days", { returnObjects: true }) as string[];

  const open = items.filter((item) => !item.checked_at);
  const bought = items.filter((item) => item.checked_at);

  // Used-up staples from the server (already minus dismissed ones), then
  // whatever Kitchen says is running low, minus anything already on the list
  // or dismissed since it was last added.
  const suggestions = useMemo(() => {
    const listed = new Set(open.flatMap((item) => [item.normalized_name, item.food_key ?? item.normalized_name]));
    const out: { key: string; name: string; reason: string }[] = [];
    for (const item of buyAgain) {
      if (listed.has(item.item_key) || listed.has(item.normalized_name)) continue;
      listed.add(item.item_key);
      out.push({
        key: item.item_key,
        name: item.name,
        reason: item.thrown_out ? t("shopping.thrownOut") : t("shopping.usedUp"),
      });
    }
    for (const group of groups.filter(isMetricAmountRunningLow)) {
      const key = itemKeyOf(group.name);
      if (listed.has(key) || listed.has(canonicalFoodName(group.name))) continue;
      const dismissedAt = dismissals[key];
      const lastAdded = group.lots.reduce((latest, lot) => (lot.added_at > latest ? lot.added_at : latest), "");
      if (dismissedAt && dismissedAt > lastAdded) continue;
      listed.add(key);
      out.push({ key, name: group.name, reason: t("shopping.runningLow") });
    }
    return out;
  }, [buyAgain, dismissals, groups, open, t]);

  // Catalog foods matching what's typed, minus ones already on the list.
  const foodHits = useMemo(() => {
    const listed = new Set(open.map((item) => item.food_key).filter(Boolean));
    return searchFoods(draft, i18n.language).filter((food) => !listed.has(food.id));
  }, [draft, i18n.language, open]);
  // Anything typed can go on as it is ("quinoa" isn't in the catalog), so say so.
  const typed = draft.trim();
  const showTyped = typed.length > 0 && !foodHits.some((food) => food.name.toLowerCase() === typed.toLowerCase());

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch {
      showToast(t("shopping.error"));
    }
  }

  function submit(name = draft.trim()) {
    if (!name) return;
    setDraft("");
    void run(() => add(name));
  }

  function openReminder() {
    const saved = reminder && reminder.days.length > 0 ? reminder : null;
    const suggested = SUGGESTED_REMINDER[profile?.shopping_style ?? ""];
    setDays(saved?.days ?? suggested?.days ?? []);
    setHour(saved?.hour ?? suggested?.hour ?? reminder?.hour ?? 10);
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
      bottomInset={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {/* Same top as the other tabs: logo, household pill and scan. */}
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Logo size={26} />
          {activeHousehold ? (
            <HouseholdPill
              name={activeHousehold.name}
              initial={firstName || activeHousehold.name}
              label={t("settings.household.openSheet", { name: activeHousehold.name })}
              onPress={() => setHouseholdOpen(true)}
            />
          ) : null}
        </View>
        <View>
          <Text variant="h3" accessibilityRole="header" numberOfLines={1}>
            {t("shopping.title")}
          </Text>
          <Text variant="small" muted>
            {t("shopping.toBuy", { count: openCount })}
          </Text>
        </View>
      </View>

      {/* Kitchen's search field, with the scan button's round tomato "+". */}
      <View style={styles.gutter}>
        <View style={[styles.addField, addFocused && styles.addFieldFocused]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => submit()}
            onFocus={() => setAddFocused(true)}
            onBlur={() => setAddFocused(false)}
            placeholder={t("shopping.addPlaceholder")}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t("shopping.addPlaceholder")}
            returnKeyType="done"
            submitBehavior="submit"
            maxLength={80}
            style={styles.addInput}
          />
          <Tappable
            label={t("shopping.add")}
            onPress={() => submit()}
            disabled={!draft.trim()}
            style={[styles.addButton, !draft.trim() && styles.addButtonIdle]}
          >
            <PlusIcon color={colors.onPrimary} size={16} />
          </Tappable>
        </View>
      </View>

      {showTyped || foodHits.length > 0 ? (
        <View style={styles.gutter}>
          <View style={[styles.card, styles.hits]}>
            {showTyped ? (
              <ListRow
                title={t("shopping.addName", { name: typed })}
                leading={<FoodTile name={typed} />}
                trailing={
                  <View style={styles.go}>
                    <PlusIcon color={colors.primary} size={16} />
                  </View>
                }
                chevron={false}
                onPress={() => submit()}
              />
            ) : null}
            {foodHits.map((food) => (
              <ListRow
                key={food.id}
                title={food.name}
                leading={<FoodTile name={food.id} />}
                trailing={
                  <View style={styles.go}>
                    <PlusIcon color={colors.primary} size={16} />
                  </View>
                }
                chevron={false}
                label={t("shopping.addName", { name: food.name })}
                onPress={() => submit(food.name)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Each item its own white card, like Kitchen's food rows. */}
      <View style={styles.list}>
        {open.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <View style={styles.iconWell}>
              <ShoppingListIcon size={24} />
            </View>
            <Text variant="small" muted style={styles.emptyText}>
              {t("shopping.empty")}
            </Text>
          </View>
        ) : null}
        {open.map((item) => (
          <ListRow
            key={item.id}
            style={styles.card}
            title={item.name}
            leading={<ItemLeading name={item.name} checked={false} />}
            trailing={<RemoveButton label={t("shopping.remove", { name: item.name })} onPress={() => void run(() => remove(item.id))} />}
            chevron={false}
            label={t("shopping.tick", { name: item.name })}
            onPress={() => void run(() => setChecked(item.id, true))}
          />
        ))}
      </View>

      {bought.length > 0 ? (
        <View style={styles.list}>
          <SectionHead title={t("shopping.bought")} count={bought.length} />
          {bought.map((item) => (
            <ListRow
              key={item.id}
              style={[styles.card, styles.boughtCard]}
              title={item.name}
              leading={<ItemLeading name={item.name} checked />}
              chevron={false}
              label={t("shopping.untick", { name: item.name })}
              onPress={() => void run(() => setChecked(item.id, false))}
            />
          ))}
        </View>
      ) : null}

      {/* Kitchen's Shopping list card: icon, title, summary, peach arrow. */}
      <View style={styles.gutter}>
        <ListRow
          style={styles.card}
          title={t("shopping.reminderTitle")}
          subtitle={reminderSummary}
          leading={
            <View style={styles.iconWell}>
              <BellIcon />
            </View>
          }
          trailing={
            <View style={styles.go}>
              <ArrowIcon />
            </View>
          }
          chevron={false}
          onPress={openReminder}
        />
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.list}>
          <SectionHead title={t("shopping.buyAgainTitle")} body={t("shopping.buyAgainBody")} />
          {suggestions.map((s) => (
            <ListRow
              key={s.key}
              style={styles.card}
              title={s.name}
              subtitle={s.reason}
              leading={<FoodTile name={s.name} />}
              trailing={
                <View style={styles.suggestionActions}>
                  <View style={styles.go}>
                    <PlusIcon color={colors.primary} size={16} />
                  </View>
                  <RemoveButton
                    label={t("shopping.dismiss", { name: s.name })}
                    onPress={() => void run(() => dismiss(s.key))}
                  />
                </View>
              }
              chevron={false}
              label={t("shopping.addName", { name: s.name })}
              onPress={() => void run(() => add(s.name))}
            />
          ))}
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
      <HouseholdSheet visible={householdOpen} onClose={() => setHouseholdOpen(false)} itemCount={groups.length} />
    </Screen>
  );
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

// Kitchen's section head: h3 left, the count (or a line under it).
function SectionHead({ title, count, body }: { title: string; count?: number; body?: string }) {
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        {count !== undefined ? (
          <Text variant="small" muted>
            {count}
          </Text>
        ) : null}
      </View>
      {body ? (
        <Text variant="small" muted>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

// Kitchen's food thumbnail: sage tile, the food's icon.
function FoodTile({ name }: { name: string }) {
  return (
    <View style={styles.food}>
      <FoodGlyph name={name} size={42} />
    </View>
  );
}

function ItemLeading({ name, checked }: { name: string; checked: boolean }) {
  return (
    <View style={styles.leading}>
      <View style={[styles.tick, checked && styles.tickOn]}>
        {checked ? (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12.5 10 17l9-10" stroke={colors.onPrimary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
      <FoodTile name={name} />
    </View>
  );
}

// Kitchen's search clear button: small peach square, tomato cross.
function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Tappable label={label} onPress={onPress} hitSlop={12} style={[styles.removeButton]}>
      <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
        <Path d="M5 5l14 14M19 5 5 19" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </Tappable>
  );
}

function BellIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
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

function ArrowIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
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
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  addField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: radii.lg,
    minHeight: 52,
    ...shadows.soft,
  },
  addFieldFocused: {
    borderColor: colors.primary,
  },
  addInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.md,
    ...typography.body,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonIdle: {
    opacity: 0.4,
  },
  list: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  // Kitchen's food row card: white, 24pt corners, the soft lift.
  card: {
    padding: spacing.md,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: {
    flex: 1,
  },
  hits: {
    paddingVertical: spacing.xs,
  },
  boughtCard: {
    opacity: 0.55,
  },
  leading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  food: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWell: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
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
    width: 22,
    height: 22,
    borderRadius: radii.md,
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  go: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
