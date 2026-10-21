import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { useFonts } from "expo-font";

export function useLeftovrFonts() {
  return useFonts({
    // Fraunces — display / headlines only.
    Fraunces: Fraunces_500Medium,
    FrauncesRegular: Fraunces_400Regular,
    FrauncesItalic: Fraunces_500Medium_Italic,
    FrauncesRegularItalic: Fraunces_400Regular_Italic,
    FrauncesSemiBold: Fraunces_600SemiBold,
    FrauncesBold: Fraunces_700Bold,
    // Nunito — every text style except the logo wordmark.
    Nunito: Nunito_400Regular,
    NunitoMedium: Nunito_500Medium,
    NunitoSemiBold: Nunito_600SemiBold,
    NunitoBold: Nunito_700Bold,
    NunitoExtraBold: Nunito_800ExtraBold,
  });
}
