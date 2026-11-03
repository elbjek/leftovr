import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { Button, ShowcaseSlide, ShowcaseStage, showcaseThemes, Text } from "@/components";
import { HAS_SEEN_HOOK_KEY } from "@/features/onboardingGate";
import { colors, fonts, radii, spacing } from "@/theme";

// Room the floating footer (56pt buttons) takes over each slide's copy.
const FOOTER_SPACE = 56 + spacing.huge + spacing.xxl;

export default function HookCarouselRoute() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const slideWidth = Platform.OS === "web" ? Math.min(width, 430) : width;
  const listRef = useRef<FlatList<ShowcaseSlide>>(null);
  const [current, setCurrent] = useState(0);
  // Horizontal lists don't stretch items vertically everywhere (web), so
  // slides take the measured list height for the stage to fill.
  const [listHeight, setListHeight] = useState<number>();

  const slides = t("onboarding.hook.slides", { returnObjects: true }) as ShowcaseSlide[];
  const lastIndex = slides.length - 1;
  const last = current === lastIndex;
  const theme = showcaseThemes[slides[current].key];
  const onGold = theme.bg === colors.accent;

  const currentRef = useRef(0);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    if (page !== currentRef.current) {
      currentRef.current = page;
      setCurrent(page);
    }
  }

  function goTo(index: number) {
    const next = Math.max(0, Math.min(lastIndex, index));
    listRef.current?.scrollToOffset({ offset: next * slideWidth, animated: true });
    currentRef.current = next;
    setCurrent(next);
  }

  async function finish() {
    await AsyncStorage.setItem(HAS_SEEN_HOOK_KEY, "true");
    router.replace("/(auth)/sign-up");
  }

  const nextLabel = last
    ? t("onboarding.hook.cta")
    : current === 0
      ? t("onboarding.hook.start")
      : t("onboarding.hook.next");

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <FlatList
        ref={listRef}
        style={styles.list}
        onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: slideWidth, offset: slideWidth * index, index })}
        renderItem={({ item, index }) => {
          const slideTheme = showcaseThemes[item.key];
          return (
            <View
              style={[
                styles.slide,
                {
                  width: slideWidth,
                  height: listHeight,
                  backgroundColor: slideTheme.bg,
                  paddingTop: insets.top + 56,
                  paddingBottom: insets.bottom + FOOTER_SPACE,
                },
              ]}
            >
              <ShowcaseStage slide={item} active={index === current} />
              <View style={styles.copy}>
                {item.eyebrow ? (
                  <View style={styles.eyebrowRow}>
                    <Text variant="micro" color={slideTheme.eyebrow} uppercase style={styles.eyebrow}>
                      {item.eyebrow}
                    </Text>
                    {item.badge ? (
                      <View style={styles.badge}>
                        <Text variant="micro" color={colors.text}>
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Text style={[styles.title, { color: slideTheme.ink }]}>
                  {/* Words wrapped in *asterisks* in the locale copy render bold. */}
                  {item.title.split("*").map((part, partIndex) =>
                    partIndex % 2 ? (
                      <Text key={partIndex} style={[styles.title, styles.titleBold, { color: slideTheme.ink }]}>
                        {part}
                      </Text>
                    ) : (
                      part
                    ),
                  )}
                </Text>
                <Text variant="body" color={slideTheme.muted} style={styles.body}>
                  {item.body}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <View style={styles.progress}>
          {slides.map((slide, index) => (
            <Pressable
              key={slide.key}
              accessibilityRole="button"
              accessibilityLabel={slide.eyebrow ?? slide.key}
              onPress={() => goTo(index)}
              style={styles.progressHit}
            >
              <View
                style={[
                  styles.progressSegment,
                  {
                    backgroundColor:
                      index <= current
                        ? theme.dark
                          ? colors.accent
                          : onGold
                            ? colors.text
                            : colors.primary
                        : theme.dark
                          ? colors.inverseHairlineStrong
                          : colors.hairlineStrong,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => goTo(lastIndex)}
          disabled={last}
          style={[styles.skip, last && styles.hidden]}
        >
          <Text variant="label" color={theme.ink} style={styles.skipLabel}>
            {t("onboarding.hook.skip")}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.footer, { bottom: insets.bottom + spacing.xxl }]}>
        {current > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => goTo(current - 1)}
            style={[
              styles.back,
              {
                backgroundColor: theme.dark
                  ? colors.inverseHairline
                  : onGold
                    ? "rgba(31, 31, 31, 0.1)"
                    : colors.primary50,
              },
            ]}
          >
            <Svg width={16} height={16} viewBox="0 0 14 14" fill="none">
              <Path d="M9 3L5 7l4 4" stroke={theme.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        ) : null}
        <Button
          title={nextLabel}
          variant={theme.dark ? "accent" : "primary"}
          onPress={last ? () => void finish() : () => goTo(current + 1)}
          style={styles.next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  slide: {
    gap: spacing.xl,
  },
  topBar: {
    position: "absolute",
    left: spacing.xxl,
    right: spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    minHeight: 40,
  },
  progress: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xxs,
  },
  progressHit: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  progressSegment: {
    height: 4,
    borderRadius: 2,
  },
  skip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxs,
  },
  skipLabel: {
    fontFamily: fonts.bodyExtraBold,
  },
  hidden: {
    opacity: 0,
  },
  copy: {
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
    minHeight: 190,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 1.4,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.pill,
  },
  title: {
    fontFamily: fonts.body,
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  titleBold: {
    fontFamily: fonts.bodyExtraBold,
  },
  body: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 23,
  },
  footer: {
    position: "absolute",
    left: spacing.xxxl,
    right: spacing.xxxl,
    flexDirection: "row",
    gap: 10,
  },
  back: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  next: {
    flex: 1,
  },
});
