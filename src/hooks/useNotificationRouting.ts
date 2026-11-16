import * as Notifications from "expo-notifications";
import { Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { openRecipesAndGenerate, openSavedRecipe, useAuth } from "@/features";
import { findHousemateCookedRecipeId, getRecipeRow } from "@/repositories/recipeRepository";

/**
 * Where each push type from `notifications-dispatch` / `notify-member-activity`
 * should land. Unknown types open the app without navigating.
 */
const ROUTE_BY_TYPE: Record<string, Href> = {
  // Eat these first: the Kitchen's "Use soon" list, soonest first.
  eatfirst: { pathname: "/(tabs)/fridge", params: { view: "soon" } },
  // Kitchen changed (joined / left / removed): the household sheet's members.
  member_change: { pathname: "/(tabs)/settings", params: { household: "1" } },
  streak: "/(tabs)/recipes",
  reengagement: "/(tabs)/recipes",
  topup: "/(tabs)/scan",
  shopping: "/(tabs)/shopping",
};

/** What a tap does once the app is ready: usually a navigation. */
type Landing = (router: ReturnType<typeof useRouter>, userId: string) => void | Promise<void>;

function landingFor(response: Notifications.NotificationResponse | null): Landing | null {
  if (!response) return null;
  const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
  const type = typeof data.type === "string" ? data.type : null;
  if (!type) return null;
  // iOS reports the date in seconds, Android in milliseconds.
  const { date } = response.notification;
  const sentMs = date < 1e12 ? date * 1000 : date;

  if (type === "daily") {
    // "Tonight: cook with …": the home, generating ideas from what's going off
    // (the Kitchen's "What to cook next" does the same).
    return () => openRecipesAndGenerate();
  }
  if (type === "recap") {
    // "Your week": Insights on the week the recap was about, not This month.
    return (router) => router.navigate({ pathname: "/(tabs)/insights", params: { week: String(Math.round(sentMs)) } });
  }
  if (type === "member_activity") {
    // "Kitchen updated": the Kitchen refetches and lists what housemates added
    // since the push (10 min of slack for the adder's device clock).
    const params: Record<string, string> = { new: String(Math.round(sentMs - 10 * 60_000)) };
    // DevHousematePushButton's fake push names a pretend housemate.
    if (typeof data.demo === "string") params.demo = data.demo;
    return (router) => router.navigate({ pathname: "/(tabs)/fridge", params });
  }
  if (type === "member_cooked") {
    // "Ana cooked X": that recipe, found from the household's cook log; a cook
    // without a saved recipe (or a failed lookup) lands on the home.
    const householdId = typeof data.household_id === "string" ? data.household_id : null;
    return async (router, userId) => {
      try {
        const recipeId = householdId
          ? await findHousemateCookedRecipeId(householdId, userId, new Date(sentMs - 10 * 60_000).toISOString())
          : null;
        const row = recipeId ? await getRecipeRow(recipeId) : null;
        if (row) return openSavedRecipe(row);
      } catch {
        // Fall through to the home.
      }
      router.navigate("/(tabs)/recipes");
    };
  }
  const route = ROUTE_BY_TYPE[type];
  return route ? (router) => router.navigate(route) : null;
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
  const userId = profile?.id;

  const pending = useRef<Landing | null>(null);
  // Bumped on arrival so the effect below runs again; the target itself lives
  // in the ref, which keeps this out of render.
  const [arrivals, setArrivals] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // The tap that cold-started the app.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled) return;
        const landing = landingFor(response);
        if (!landing) return;
        pending.current = landing;
        setArrivals((n) => n + 1);
      })
      .catch(() => undefined);

    // Taps while the app is running or backgrounded.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const landing = landingFor(response);
      if (!landing) return;
      pending.current = landing;
      setArrivals((n) => n + 1);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !userId || !pending.current) return;
    const landing = pending.current;
    pending.current = null;
    void landing(router, userId);
  }, [ready, userId, arrivals, router]);
}
