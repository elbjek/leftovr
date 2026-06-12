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
  const slideWidth = Platform.OS === "web" ? Math.min(width, 430) : width;
  const listRef = useRef<FlatList<HookSlide>>(null);
  const [current, setCurrent] = useState(0);

  const slides = t("onboarding.hook.slides", { returnObjects: true }) as HookSlide[];
  const last = current === slides.length - 1;

  const currentRef = useRef(0);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    if (page !== currentRef.current) {
      currentRef.current = page;
      setCurrent(page);
    }
  }

  async function handleContinue() {
    if (!last) {
      const next = current + 1;
      listRef.current?.scrollToOffset({ offset: next * slideWidth, animated: true });
      currentRef.current = next;
      setCurrent(next);
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: slideWidth, offset: slideWidth * index, index })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: slideWidth }]}>
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
                        <View style={styles.stepRail}>
                          <View style={styles.stepDot}>
                            <Text variant="small" color={colors.surface}>
                              {index + 1}
                            </Text>
                          </View>
                          {index < (item.steps?.length ?? 0) - 1 ? (
                            <View style={styles.stepConnector} />
                          ) : null}
                        </View>
                        <View style={styles.stepLabelWrap}>
                          <Text variant="h3" style={styles.stepLabel}>
                            {step}
                          </Text>
                        </View>
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
        leftovr
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
    paddingTop: spacing.screenTop,
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
    marginTop: 4,
    marginBottom: 0,
    alignSelf: "stretch",
    minWidth: 210,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  stepRail: {
    width: 28,
    alignItems: "center",
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepConnector: {
    width: 2,
    height: 20,
    marginTop: 2,
    backgroundColor: colors.primary100,
  },
  stepLabelWrap: {
    height: 28,
    justifyContent: "center",
  },
  stepLabel: {
    fontFamily: fonts.bodyMedium,
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
