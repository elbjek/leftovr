import * as Notifications from "expo-notifications";
import { Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/features";

/**
 * Where each push type from `notifications-dispatch` / `notify-member-activity`
 * should land. Unknown types open the app without navigating.
 */
const ROUTE_BY_TYPE: Record<string, Href> = {
  daily: "/(tabs)/fridge",
  eatfirst: "/(tabs)/fridge",
  member_activity: "/(tabs)/fridge",
  member_cooked: "/(tabs)/fridge",
  member_change: "/(tabs)/settings",
  recap: "/(tabs)/insights",
  streak: "/(tabs)/recipes",
  reengagement: "/(tabs)/recipes",
  topup: "/(tabs)/scan",
  shopping: "/(tabs)/shopping",
};

function routeFor(response: Notifications.NotificationResponse | null): Href | null {
  const data = response?.notification.request.content.data as { type?: string } | undefined;
  const type = data?.type;
  return type ? ROUTE_BY_TYPE[type] ?? null : null;
}

/**
 * Sends a notification tap to the screen it is about. The target is held until
 * the user is signed in and past onboarding, so a tap during a cold start
 * doesn't fight the auth redirect.
 */
export function useNotificationRouting() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const ready = Boolean(session && profile?.onboarding_completed_at);

  const pending = useRef<Href | null>(null);
  // Bumped on arrival so the effect below runs again; the target itself lives
  // in the ref, which keeps this out of render.
  const [arrivals, setArrivals] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // The tap that cold-started the app.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled) return;
        const route = routeFor(response);
        if (!route) return;
        pending.current = route;
        setArrivals((n) => n + 1);
      })
      .catch(() => undefined);

    // Taps while the app is running or backgrounded.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeFor(response);
      if (!route) return;
      pending.current = route;
      setArrivals((n) => n + 1);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !pending.current) return;
    const route = pending.current;
    pending.current = null;
    router.navigate(route);
  }, [ready, arrivals, router]);
}
