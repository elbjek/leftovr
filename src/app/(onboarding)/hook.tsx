import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { AuthButtons, Button, ShowcaseSlide, ShowcaseStage, showcaseThemes, Tappable, Text } from "@/components";
import { useOnboardingSignIn } from "@/features/onboardingSignIn";
import { colors, radii, spacing } from "@/theme";

// Room the floating footer (56pt buttons) takes over each slide's copy.
const FOOTER_SPACE = 56 + spacing.huge + spacing.xxl;
// The last slide's sign-in block: three 56pt buttons, the invite link and an error line.
const AUTH_SPACE = 56 * 3 + 12 * 2 + 40 + 20 + spacing.lg;

export default function HookCarouselRoute() {
  const { t } = useTranslation();
  const signIn = useOnboardingSignIn();
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
                  paddingBottom: insets.bottom + (index === lastIndex ? AUTH_SPACE : FOOTER_SPACE),
                },
              ]}
            >
              <ShowcaseStage slide={item} active={index === current} />
              <View style={styles.copy}>
                {item.eyebrow ? (
                  <View style={styles.eyebrowRow}>
                    <Text variant="micro" color={slideTheme.eyebrow} uppercase>
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
                <Text variant="h3" weight="regular" style={{ color: slideTheme.ink }}>
                  {/* Words wrapped in *asterisks* in the locale copy render bold. */}
                  {item.title.split("*").map((part, partIndex) =>
                    partIndex % 2 ? (
                      <Text key={partIndex} variant="h3" weight="extrabold" style={{ color: slideTheme.ink }}>
                        {part}
                      </Text>
                    ) : (
                      part
                    ),
                  )}
                </Text>
                <Text variant="body" color={slideTheme.muted}>
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
            <Tappable
              key={slide.key}
              label={slide.eyebrow ?? slide.key}
              onPress={() => goTo(index)}
              hitSlop={0}
              style={styles.progressHit}
            >
              <View
                style={[
                  styles.progressSegment,
                  {
                    backgroundColor:
                      index <= current
                        ? theme.dark
                          ? colors.onPrimary
                          : colors.primary
                        : theme.dark
                          ? colors.inverseHairlineStrong
                          : colors.hairlineStrong,
                  },
                ]}
              />
            </Tappable>
          ))}
        </View>
        <Tappable
          onPress={() => goTo(lastIndex)}
          disabled={last}
          style={[styles.skip, last && styles.hidden]}
        >
          <Text variant="label" color={theme.ink}>
            {t("onboarding.hook.skip")}
          </Text>
        </Tappable>
      </View>

      {last ? (
        <View style={[styles.auth, { bottom: insets.bottom + spacing.lg }]}>
          {/* Sign-in is the tour's last slide; the profile questions follow. */}
          <AuthButtons
            appleLabel={t("auth.apple")}
            googleLabel={t("auth.google")}
            emailLabel={t("auth.emailContinue")}
            onApple={() => void signIn.apple()}
            onGoogle={() => void signIn.google()}
            onEmail={() => void signIn.email()}
          />
          <Tappable
            onPress={() => router.push("/(onboarding)/invite")}
            style={styles.inviteLink}
          >
            <Text variant="label">
              {t("onboarding.hook.inviteCode")}
            </Text>
          </Tappable>
          {signIn.error ? (
            <Text variant="small" color={colors.redInk} center accessibilityLiveRegion="polite">
              {signIn.error}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={[styles.footer, { bottom: insets.bottom + spacing.xxl }]}>
          {current > 0 ? (
            <Tappable
              label={t("common.back")}
              onPress={() => goTo(current - 1)}
              hitSlop={0}
              style={[
                styles.back,
                {
                  backgroundColor: theme.dark ? colors.inverseHairline : colors.surface2,
                },
              ]}
            >
              <Svg width={16} height={16} viewBox="0 0 14 14" fill="none">
                <Path d="M9 3L5 7l4 4" stroke={theme.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Tappable>
          ) : null}
          <Button
            title={current === 0 ? t("onboarding.hook.start") : t("onboarding.hook.next")}
            // On the tomato slide the action is the white card surface with ink text.
            variant={theme.dark ? "accent" : "primary"}
            onPress={() => goTo(current + 1)}
            style={[styles.next, theme.dark && styles.nextOnDark]}
          />
        </View>
      )}
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
  hidden: {
    opacity: 0,
  },
  copy: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
    minHeight: 190,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
  },
  footer: {
    position: "absolute",
    left: spacing.screenX,
    right: spacing.screenX,
    flexDirection: "row",
    gap: spacing.md,
  },
  back: {
    width: 56,
    height: 56,
    borderRadius: radii.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  next: {
    flex: 1,
  },
  nextOnDark: {
    backgroundColor: colors.surface,
  },
  auth: {
    position: "absolute",
    left: spacing.screenX,
    right: spacing.screenX,
    gap: spacing.md,
  },
  inviteLink: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
});
