import { ComponentRef, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Keyboard, ScrollView, ScrollViewProps } from "react-native";

type ScrollViewRef = ComponentRef<typeof ScrollView>;

/**
 * A vertical ScrollView that holds still when its content fits (2026-11-16,
 * Lena: pages that fit above the fold shouldn't move). With a refresh control
 * it can still be pulled down to refresh, but not pushed up: iOS lets any
 * scroll view with a refresh control be dragged, so an upward drag is snapped
 * back to the top. While the keyboard is up it scrolls as usual, so fields
 * under the keyboard stay reachable. Horizontal ones are left alone.
 *
 * ponytail: the snap-back is a per-frame scrollTo, the only way RN offers to
 * bounce one direction; a native top-only bounce would replace it.
 */
export const FitScrollView = forwardRef<ScrollViewRef, ScrollViewProps>(function FitScrollView(props, ref) {
  const { horizontal, refreshControl, scrollEnabled = true, scrollEventThrottle, onLayout, onContentSizeChange, onScroll } = props;
  const inner = useRef<ScrollViewRef>(null);
  useImperativeHandle(ref, () => inner.current as ScrollViewRef);

  const [viewHeight, setViewHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardUp(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const fits = !horizontal && !keyboardUp && viewHeight > 0 && contentHeight <= viewHeight + 1;
  const pullOnly = fits && Boolean(refreshControl);

  return (
    <ScrollView
      {...props}
      ref={inner}
      scrollEnabled={scrollEnabled && (!fits || pullOnly)}
      scrollEventThrottle={pullOnly ? 16 : scrollEventThrottle}
      onLayout={(event) => {
        setViewHeight(event.nativeEvent.layout.height);
        onLayout?.(event);
      }}
      onContentSizeChange={(width, height) => {
        setContentHeight(height);
        onContentSizeChange?.(width, height);
      }}
      onScroll={(event) => {
        if (pullOnly && event.nativeEvent.contentOffset.y > 0) {
          inner.current?.scrollTo({ y: 0, animated: false });
        }
        onScroll?.(event);
      }}
    />
  );
});
