import { useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radii, shadows, spacing } from "../../theme";
import { Text } from "./Text";

// Inline date picker (field + month grid), adapted from TinyMeals' onboarding
// calendar: tap the field to open the grid under it, the title to jump by
// year then month. No native picker or second sheet, so it works inside a
// BottomSheet on iOS.

type Panel = "days" | "years" | "months";

type Props = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  /** Field text when no date is set. */
  placeholder: string;
  /** Shows an × that clears the date. */
  onClear?: () => void;
  clearLabel?: string;
  /** First / last pickable day (default: 5 years either side of today). */
  minDate?: Date;
  maxDate?: Date;
};

const YEAR_RANGE = 5;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clampMonth(date: Date, min: Date, max: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  if (first < new Date(min.getFullYear(), min.getMonth(), 1)) return new Date(min.getFullYear(), min.getMonth(), 1);
  if (first > new Date(max.getFullYear(), max.getMonth(), 1)) return new Date(max.getFullYear(), max.getMonth(), 1);
  return first;
}

export function DateField({ label, value, onChange, placeholder, onClear, clearLabel, minDate, maxDate }: Props) {
  const { t } = useTranslation();
  const today = useMemo(() => startOfDay(new Date()), []);
  const min = useMemo(
    () => startOfDay(minDate ?? new Date(today.getFullYear() - YEAR_RANGE, 0, 1)),
    [minDate, today],
  );
  const max = useMemo(
    () => startOfDay(maxDate ?? new Date(today.getFullYear() + YEAR_RANGE, 11, 31)),
    [maxDate, today],
  );
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("days");
  const [viewMonth, setViewMonth] = useState(() => clampMonth(value ?? today, min, max));
  const [pickYear, setPickYear] = useState(viewMonth.getFullYear());

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const title = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // Monday-first week; labels from the device locale like every other date.
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }),
      ),
    [],
  );
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(undefined, { month: "short" })),
    [],
  );
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = min.getFullYear(); y <= max.getFullYear(); y++) list.push(y);
    return list;
  }, [min, max]);

  const cells = useMemo(() => {
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const list: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= days; day++) list.push(new Date(year, month, day));
    return list;
  }, [year, month]);

  const canPrev = new Date(year, month, 1) > new Date(min.getFullYear(), min.getMonth(), 1);
  const canNext = new Date(year, month, 1) < new Date(max.getFullYear(), max.getMonth(), 1);

  function toggle() {
    Keyboard.dismiss();
    if (!open) {
      setViewMonth(clampMonth(value ?? today, min, max));
      setPanel("days");
    }
    setOpen(!open);
  }

  function pick(date: Date) {
    onChange(date);
    setOpen(false);
  }

  const valueText = value
    ? value.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : placeholder;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={[styles.field, open && styles.fieldOpen]}
      >
        <Text variant="micro" muted uppercase>
          {label}
        </Text>
        <View style={styles.valueRow}>
          <CalendarIcon />
          <Text style={styles.valueText} color={value ? colors.text : colors.muted}>
            {valueText}
          </Text>
          {value && onClear ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={clearLabel ?? label}
              hitSlop={8}
              onPress={() => {
                setOpen(false);
                onClear();
              }}
            >
              <CloseIcon />
            </Pressable>
          ) : (
            <Chevron rotate={open ? 180 : 0} />
          )}
        </View>
      </Pressable>

      {open ? (
        <View style={styles.card}>
          <View style={styles.header}>
            {panel === "days" ? (
              <RoundArrow label={t("calendar.previousMonth")} disabled={!canPrev} onPress={() => setViewMonth(new Date(year, month - 1, 1))} />
            ) : (
              <RoundArrow
                label={t("calendar.back")}
                onPress={() => setPanel(panel === "months" ? "years" : "days")}
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("calendar.chooseMonthYear")}
              onPress={() => {
                if (panel === "days") setPickYear(year);
                setPanel(panel === "years" ? "days" : "years");
              }}
              style={({ pressed }) => [styles.titleButton, pressed && styles.pressed]}
            >
              <Text style={styles.title}>
                {panel === "years" ? t("calendar.year") : panel === "months" ? String(pickYear) : title}
              </Text>
              <Chevron rotate={0} size={10} />
            </Pressable>
            {panel === "days" ? (
              <RoundArrow label={t("calendar.nextMonth")} direction="right" disabled={!canNext} onPress={() => setViewMonth(new Date(year, month + 1, 1))} />
            ) : (
              <View style={styles.arrowSpacer} />
            )}
          </View>

          {panel === "years" ? (
            <View style={styles.jumpGrid}>
              {years.map((y) => (
                <JumpCell
                  key={y}
                  label={String(y)}
                  width="33.33%"
                  selected={y === year}
                  onPress={() => {
                    setPickYear(y);
                    setPanel("months");
                  }}
                />
              ))}
            </View>
          ) : null}

          {panel === "months" ? (
            <View style={styles.jumpGrid}>
              {monthNames.map((name, index) => {
                const first = new Date(pickYear, index, 1);
                const disabled =
                  first > max || new Date(pickYear, index + 1, 0) < min;
                return (
                  <JumpCell
                    key={name}
                    label={name}
                    width="25%"
                    selected={pickYear === year && index === month}
                    disabled={disabled}
                    onPress={() => {
                      setViewMonth(first);
                      setPanel("days");
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          {panel === "days" ? (
            <>
              <View style={styles.weekRow}>
                {weekdays.map((day, i) => (
                  <View key={`${day}-${i}`} style={styles.weekCell}>
                    <Text style={styles.weekday} color={colors.muted}>
                      {day}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.dayGrid}>
                {cells.map((date, i) => {
                  if (!date) return <View key={`e-${i}`} style={styles.dayCell} />;
                  const disabled = date < min || date > max;
                  const selected = value ? sameDay(date, value) : false;
                  const isToday = sameDay(date, today);
                  return (
                    <Pressable
                      key={date.getDate()}
                      accessibilityRole="button"
                      accessibilityLabel={date.toLocaleDateString(undefined, { day: "numeric", month: "long" })}
                      accessibilityState={{ selected, disabled }}
                      disabled={disabled}
                      onPress={() => pick(date)}
                      style={({ pressed }) => [styles.dayCell, pressed && !disabled && styles.pressed]}
                    >
                      <View style={[styles.dayDot, isToday && !selected && styles.todayDot, selected && styles.selectedDot]}>
                        <Text
                          style={[styles.dayText, (selected || isToday) && styles.dayTextStrong]}
                          color={selected ? colors.onPrimary : disabled ? colors.muted2 : colors.text}
                        >
                          {date.getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function RoundArrow({
  label,
  direction = "left",
  disabled,
  onPress,
}: {
  label: string;
  direction?: "left" | "right";
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.arrow,
        disabled && styles.arrowDisabled,
        pressed && !disabled && { transform: [{ scale: 0.92 }] },
      ]}
    >
      <Svg width={7} height={12} viewBox="0 0 9 16" fill="none" style={direction === "right" ? { transform: [{ scaleX: -1 }] } : undefined}>
        <Path d="M8 1 2 8l6 7" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

function JumpCell({
  label,
  width,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  width: `${number}%`;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.jumpCell, { width }, disabled && styles.arrowDisabled, pressed && styles.pressed]}
    >
      <View style={[styles.jumpPill, selected && styles.selectedDot]}>
        <Text style={[styles.jumpText, selected && styles.dayTextStrong]} color={selected ? colors.onPrimary : colors.text}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function CalendarIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 14 14">
      <Path
        d="M2.5 3.5h9v8h-9zM2.5 5.8h9M4.5 2v2M9.5 2v2"
        stroke={colors.primary}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Chevron({ rotate, size = 11 }: { rotate: number; size?: number }) {
  return (
    <View style={{ transform: [{ rotate: `${rotate}deg` }] }}>
      <Svg width={size} height={(size * 7) / 11} viewBox="0 0 12 8" fill="none">
        <Path d="m1 1.5 5 5 5-5" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function CloseIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  fieldOpen: {
    borderColor: colors.sage,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 36,
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...shadows.elevated,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary50,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowDisabled: {
    opacity: 0.35,
  },
  arrowSpacer: {
    width: 32,
    height: 32,
  },
  titleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  title: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    fontSize: 15,
    textTransform: "capitalize",
  },
  pressed: {
    opacity: 0.7,
  },
  weekRow: {
    flexDirection: "row",
    marginTop: spacing.sm,
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekday: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  todayDot: {
    backgroundColor: colors.primary50,
  },
  selectedDot: {
    backgroundColor: colors.primary,
  },
  dayText: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
    fontSize: 14,
  },
  dayTextStrong: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
  },
  jumpGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md,
  },
  jumpCell: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  jumpPill: {
    minWidth: 64,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  jumpText: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
    fontSize: 14,
    textTransform: "capitalize",
  },
});
