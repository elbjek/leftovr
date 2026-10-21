import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Platform,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Screen, ShowcaseSlide, ShowcaseStage, Text } from "@/components";
import { HAS_SEEN_HOOK_KEY } from "@/features/onboardingGate";
import { colors, radii, spacing } from "@/theme";

export default function HookCarouselRoute() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const slideWidth = Platform.OS === "web" ? Math.min(width, 430) : width;
  const listRef = useRef<FlatList<ShowcaseSlide>>(null);
  const [current, setCurrent] = useState(0);
  // Horizontal lists don't stretch items vertically everywhere (web), so
  // slides take the measured list height for the stage to fill.
  const [listHeight, setListHeight] = useState<number>();

  const slides = t("onboarding.hook.slides", { returnObjects: true }) as ShowcaseSlide[];
  // The intro slide is the cover; numbering covers the feature slides only.
  const featureCount = slides.length - 1;
  const last = current === slides.length - 1;

  const currentRef = useRef(0);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    if (page !== currentRef.current) {
      currentRef.current = page;
      setCurrent(page);
    }
  }

  async function finish() {
    await AsyncStorage.setItem(HAS_SEEN_HOOK_KEY, "true");
    router.replace("/(auth)/sign-up");
  }

  function handleContinue() {
    if (last) {
      void finish();
      return;
    }

    const next = current + 1;
    listRef.current?.scrollToOffset({ offset: next * slideWidth, animated: true });
    currentRef.current = next;
    setCurrent(next);
  }

  return (
    <Screen padded={false} backgroundColor={colors.surface}>
      <View style={styles.topBar}>
        <View style={styles.progress}>
          {slides.map((slide, index) => (
            <View
              key={slide.key}
              style={[styles.progressSegment, index <= current && styles.progressSegmentOn]}
            />
          ))}
        </View>
        <Button
          title={t("onboarding.hook.skip")}
          variant="text"
          onPress={() => void finish()}
          disabled={last}
          style={last && styles.hidden}
        />
      </View>
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
        renderItem={({ item, index }) => (
          <View style={[styles.slide, { width: slideWidth, height: listHeight }]}>
            <ShowcaseStage slide={item} active={index === current} />
            <View style={styles.copy}>
              {item.eyebrow ? (
                <View style={styles.eyebrowRow}>
                  <Text variant="micro" color={colors.primary} uppercase>
                    {t("onboarding.hook.chapter", {
                      index: String(index).padStart(2, "0"),
                      count: String(featureCount).padStart(2, "0"),
                      eyebrow: item.eyebrow,
                    })}
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
              <Text variant="display" style={styles.title}>
                {item.title}
                {item.titleAccent ? (
                  <Text variant="display" color={colors.primary} italic style={styles.title}>
                    {item.titleAccent}
                  </Text>
                ) : null}
              </Text>
              <Text variant="body" muted>
                {item.body}
              </Text>
            </View>
          </View>
        )}
      />
      <View style={styles.footer}>
        <Button
          title={last ? t("onboarding.hook.cta") : t("common.continue")}
          onPress={handleContinue}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingLeft: 28,
    paddingRight: spacing.lg,
    paddingTop: spacing.screenTop,
    minHeight: 44,
  },
  progress: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.hairlineStrong,
  },
  progressSegmentOn: {
    backgroundColor: colors.primary,
  },
  hidden: {
    opacity: 0,
  },
  list: {
    flex: 1,
  },
  slide: {
    paddingHorizontal: 28,
    paddingTop: spacing.lg,
    gap: spacing.xxl,
  },
  copy: {
    gap: spacing.sm,
    minHeight: 172,
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
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.pill,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: spacing.lg,
    paddingBottom: spacing.screenBottom,
  },
});
