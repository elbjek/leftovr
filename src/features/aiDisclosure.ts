import AsyncStorage from "@react-native-async-storage/async-storage";

// App Review guideline 5.1.2(i): personal data may only go to a third-party AI
// after the user has been told and has agreed. Receipt, e-receipt and pantry
// photos are read by Anthropic, so the first of those flows asks once. The
// answer is device-local (nothing about it needs to reach the server) and
// deliberately not reset on sign-out: it is a disclosure about this install.
export const AI_DISCLOSURE_ACCEPTED_KEY = "leftovr.ai.disclosureAcceptedAt";

export async function hasAcceptedAiDisclosure() {
  return (await AsyncStorage.getItem(AI_DISCLOSURE_ACCEPTED_KEY)) != null;
}

export async function acceptAiDisclosure() {
  await AsyncStorage.setItem(AI_DISCLOSURE_ACCEPTED_KEY, new Date().toISOString());
}
