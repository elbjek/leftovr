import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";

export function useChompFonts() {
  return useFonts({
    // Fraunces — display / headlines only.
    Fraunces: Fraunces_500Medium,
    FrauncesRegular: Fraunces_400Regular,
    FrauncesItalic: Fraunces_500Medium_Italic,
    FrauncesRegularItalic: Fraunces_400Regular_Italic,
    FrauncesSemiBold: Fraunces_600SemiBold,
    FrauncesBold: Fraunces_700Bold,
    // Plus Jakarta Sans — subtitles, body, labels, buttons.
    PlusJakartaSans: PlusJakartaSans_400Regular,
    PlusJakartaSansMedium: PlusJakartaSans_500Medium,
    PlusJakartaSansSemiBold: PlusJakartaSans_600SemiBold,
    PlusJakartaSansBold: PlusJakartaSans_700Bold,
    PlusJakartaSansExtraBold: PlusJakartaSans_800ExtraBold,
  });
}
