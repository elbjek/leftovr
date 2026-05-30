import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  AliveFridgeIllustration,
  Button,
  ForgottenFridgeIllustration,
  PageDots,
  ReceiptToFridgeIllustration,
  ScanLoopIllustration,
  Screen,
  Text,
} from "@/components";
import { HAS_SEEN_HOOK_KEY } from "@/features/onboardingGate";
import { colors, fonts, spacing } from "@/theme";

type HookSlide = {
  key: string;
  title: string;
  titleAccent?: string;
  titleAfter?: string;
  body: string;
  illustration: "forgotten" | "alive" | "receipt" | "scanLoop" | "socialProof" | "wordmark";
  steps?: string[];
  kicker?: string;
  wordmarkKicker?: string;
  quotes?: { text: string; byline: string }[];
};

export default function HookCarouselRoute() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<HookSlide>>(null);
  const [current, setCurrent] = useState(0);

  const slides = t("onboarding.hook.slides", { returnObjects: true }) as HookSlide[];
  const last = current === slides.length - 1;

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const width = event.nativeEvent.layoutMeasurement.width;
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrent(page);
  }

  async function handleContinue() {
    if (!last) {
      listRef.current?.scrollToIndex({ index: current + 1, animated: true });
      return;
    }

    await AsyncStorage.setItem(HAS_SEEN_HOOK_KEY, "true");
    router.replace("/(auth)/sign-up");
  }

  return (
    <Screen padded={false} backgroundColor={colors.surface}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.dotsTop}>
              <PageDots count={slides.length} current={current} />
            </View>
            <View style={styles.illustration}>{renderIllustration(item)}</View>
            <View style={styles.bottomBlock}>
              <View style={[styles.copy, item.illustration === "wordmark" && styles.copyCentered]}>
                {item.kicker ? (
                  <Text variant="micro" muted uppercase>
                    {item.kicker}
                  </Text>
                ) : null}
                <Text
                  variant="display"
                  center={item.illustration === "wordmark"}
                  style={styles.hookTitle}
                >
                  {item.title}
                  {item.titleAccent ? (
                    <Text variant="display" color={colors.primary} italic style={styles.hookTitle}>
                      {item.titleAccent}
                    </Text>
                  ) : null}
                  {item.titleAfter}
                </Text>
                {item.body ? (
                  <Text
                    variant="body"
                    muted
                    center={item.illustration === "wordmark"}
                    style={item.illustration !== "wordmark" && styles.bodyText}
                  >
                    {item.body}
                  </Text>
                ) : null}
                {item.steps ? (
                  <View style={styles.steps}>
                    {item.steps.map((step, index) => (
                      <View key={step} style={styles.step}>
                        <View style={styles.stepNumber}>
                          <Text variant="label" color={colors.surface}>
                            {index + 1}
                          </Text>
                        </View>
                        <Text variant="h3" style={styles.stepLabel}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              <Button
                title={last ? t("onboarding.hook.cta") : t("common.continue")}
                onPress={handleContinue}
              />
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

function renderIllustration(slide: HookSlide) {
  if (slide.illustration === "forgotten") return <ForgottenFridgeIllustration width={220} height={220} />;
  if (slide.illustration === "scanLoop") return <ScanLoopIllustration width={260} height={160} />;
  if (slide.illustration === "socialProof") return <SocialProofIllustration quotes={slide.quotes ?? []} />;
  if (slide.illustration === "wordmark") return <WordmarkIllustration kicker={slide.wordmarkKicker} />;
  if (slide.illustration === "receipt") return <ReceiptToFridgeIllustration width={280} height={200} />;
  return <AliveFridgeIllustration width={220} height={220} />;
}

function SocialProofIllustration({ quotes }: { quotes: { text: string; byline: string }[] }) {
  const [first, second] = quotes;

  return (
    <View style={styles.socialProof}>
      <View style={[styles.quoteCard, styles.quoteOne]}>
        <Text variant="small" style={styles.quoteText}>
          {first?.text}
        </Text>
        <Text variant="micro" muted style={styles.quoteByline}>
          {first?.byline}
        </Text>
      </View>
      <View style={[styles.quoteCard, styles.quoteTwo]}>
        <Text variant="small" style={styles.quoteText}>
          {second?.text}
        </Text>
        <Text variant="micro" muted style={styles.quoteByline}>
          {second?.byline}
        </Text>
      </View>
    </View>
  );
}

function WordmarkIllustration({ kicker }: { kicker?: string }) {
  return (
    <View style={styles.wordmarkIllustration}>
      <Text variant="display" color={colors.primary} italic style={styles.wordmark}>
        chomp
        <Text variant="display" color={colors.accent} italic style={styles.wordmark}>
          .
        </Text>
      </Text>
      {kicker ? (
        <Text variant="micro" muted uppercase style={styles.wordmarkKicker}>
          {kicker}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 68,
    paddingBottom: 32,
    justifyContent: "flex-start",
  },
  dotsTop: {
    alignItems: "center",
    marginBottom: 28,
  },
  illustration: {
    flex: 1,
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBlock: {
    gap: 32,
  },
  copy: {
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  hookTitle: {
    fontSize: 40,
    lineHeight: 42,
    marginBottom: 16,
  },
  copyCentered: {
    alignItems: "center",
  },
  bodyText: {
    maxWidth: "90%",
    marginBottom: 0,
  },
  steps: {
    gap: 12,
    marginTop: 4,
    marginBottom: 0,
    alignSelf: "stretch",
    minWidth: 210,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  stepLabel: {
    fontFamily: fonts.bodyBold,
  },
  socialProof: {
    width: 280,
    height: 220,
  },
  quoteCard: {
    position: "absolute",
    width: 200,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  quoteOne: {
    left: 0,
    top: 8,
    backgroundColor: colors.paper,
    transform: [{ rotate: "-3deg" }],
  },
  quoteTwo: {
    left: 76,
    top: 104,
    backgroundColor: colors.accentSoft,
    transform: [{ rotate: "4deg" }],
  },
  quoteByline: {
    marginTop: spacing.xs,
  },
  quoteText: {
    fontFamily: fonts.bodyBold,
  },
  wordmarkIllustration: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
  },
  wordmark: {
    fontSize: 64,
    lineHeight: 70,
  },
  wordmarkKicker: {
    marginTop: spacing.md,
  },
});
