import {
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
} from "@expo-google-fonts/nunito-sans";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";

export function useLeftovrFonts() {
  return useFonts({
    // Nunito Sans — every text style except the logo wordmark.
    NunitoSans: NunitoSans_400Regular,
    NunitoSansMedium: NunitoSans_500Medium,
    NunitoSansSemiBold: NunitoSans_600SemiBold,
    NunitoSansBold: NunitoSans_700Bold,
    NunitoSansExtraBold: NunitoSans_800ExtraBold,
    // Plus Jakarta Sans — the logo wordmark only.
    PlusJakartaSansExtraBold: PlusJakartaSans_800ExtraBold,
  });
}
