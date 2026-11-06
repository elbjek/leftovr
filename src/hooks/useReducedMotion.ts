import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the device asks for reduced motion.
 *
 * Five components already read AccessibilityInfo.isReduceMotionEnabled()
 * by hand, each with its own effect and its own state; four of them never
 * subscribe to the change event, so toggling the setting while the app is
 * open does nothing until a remount.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
