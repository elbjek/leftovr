import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, ChoiceCard, Logo, Screen, Text } from "@/components";
import { HAS_PICKED_LANGUAGE_KEY } from "@/features/onboardingGate";
import { i18n } from "@/i18n";
import { colors, fonts } from "@/theme";

type LanguageChoice = {
  value: "en" | "sr";
  title: string;
  subtitle: string;
  flag: string;
};

export default function LanguageRoute() {
  const { t } = useTranslation();
  const languages = t("onboarding.language.choices", {
    returnObjects: true,
  }) as LanguageChoice[];
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "sr">(
    i18n.language === "sr" ? "sr" : "en",
  );

  async function handleContinue() {
    await i18n.changeLanguage(selectedLanguage);
    await AsyncStorage.setItem(HAS_PICKED_LANGUAGE_KEY, "true");
    router.replace("/(onboarding)/hook");
  }

  return (
    <Screen
      padded={false}
      contentContainerStyle={styles.screenPad}
    >
      <View style={styles.wrap}>
        <View style={styles.wordmarkWrap}>
          <Logo size={34} />
          <Text variant="display" color={colors.primary} style={styles.wordmark}>
            leftovr
            <Text variant="display" color={colors.accent} style={styles.wordmark}>
              .
            </Text>
          </Text>
        </View>

        <View style={styles.copy}>
          <Text variant="display">
            {t("onboarding.language.title")}
            <Text variant="display" color={colors.primary} italic>
              {"\n"}
              {t("onboarding.language.titleAccent")}
            </Text>
          </Text>
          <Text variant="body" muted>
            {t("onboarding.language.body")}
          </Text>
        </View>

        <View style={styles.choices}>
          {languages.map((language) => (
            <ChoiceCard
              key={language.value}
              title={language.title}
              subtitle={language.subtitle}
              selected={selectedLanguage === language.value}
              icon={
                <Text
                  style={styles.flag}
                  accessibilityLabel={t("onboarding.language.flagLabel", {
                    language: language.title,
                  })}
                >
                  {language.flag}
                </Text>
              }
              trailing={<Radio selected={selectedLanguage === language.value} />}
              onPress={() => setSelectedLanguage(language.value)}
            />
          ))}
        </View>

        <Button title={t("common.continue")} onPress={handleContinue} />
      </View>
    </Screen>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenPad: {
    paddingHorizontal: 28,
    paddingTop: 92,
    paddingBottom: 32,
  },
  wrap: {
    flex: 1,
  },
  wordmarkWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 40,
  },
  wordmark: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    fontSize: 32,
    lineHeight: 36,
  },
  copy: {
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 24,
  },
  choices: {
    flex: 1,
    gap: 10,
  },
  flag: {
    fontSize: 24,
    lineHeight: 28,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.surface,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
});
