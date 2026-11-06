import { useRef, type ComponentRef } from "react";
import { PixelRatio, Platform, Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { SHARE_IMAGE, type ShareFormat } from "@/components/features/ShareCard";

/**
 * Share a ShareCardExport as a PNG, with `message` as its caption. Attach
 * `ref` to the export's `viewRef`, and pass the same `format` the export is
 * drawn at. If the capture fails the text still goes.
 */
export function useShareImage() {
  const ref = useRef<ComponentRef<typeof View>>(null);

  async function share(message: string, format: ShareFormat = "post") {
    let url: string | undefined;
    // ponytail: RN Share attaches files on iOS only; Android shares the
    // caption. Add expo-sharing if the image matters on Android.
    if (Platform.OS === "ios" && ref.current) {
      try {
        // iOS scales the requested size by the pixel ratio, so ask in points for exact pixels.
        const size = SHARE_IMAGE[format];
        url = await captureRef(ref, {
          format: "png",
          result: "tmpfile",
          width: size.width / PixelRatio.get(),
          height: size.height / PixelRatio.get(),
        });
      } catch (error) {
        if (__DEV__) console.warn("[share] capture failed", error);
      }
    }
    await Share.share(url ? { url, message } : { message });
  }

  return { ref, share };
}
