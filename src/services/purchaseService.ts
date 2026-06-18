import { Platform } from "react-native";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

import { env } from "@/lib/env";

// Product identifiers as configured in App Store Connect / RevenueCat. The
// paywall picks the pair matching the chosen plan; the tier each grants is
// resolved server-side by the RevenueCat webhook, never trusted from the client.
export const PRODUCT_IDS = {
  individual: { monthly: "monthly_individual", yearly: "yearly_individual" },
  household: { monthly: "monthly_household", yearly: "yearly_household" },
} as const;

let configured = false;

// react-native-purchases is a native module — absent in Expo Go and web export.
// Lazily require it so importing this file never crashes those targets; it is
// only touched on iOS when the key is present.
function getPurchases() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-purchases").default;
}

function isAvailable() {
  return Platform.OS === "ios" && Boolean(env.revenueCatIosKey);
}

/** Configure the SDK once at app start. Safe to call when unavailable (no-op). */
export function configurePurchases(): void {
  if (!isAvailable() || configured) return;
  getPurchases().configure({ apiKey: env.revenueCatIosKey });
  configured = true;
}

/** Tie purchases to the Supabase user so the webhook can map app_user_id → tier. */
export async function identifyPurchaser(userId: string): Promise<void> {
  if (!isAvailable()) return;
  configurePurchases();
  await getPurchases().logIn(userId);
}

/** Detach the user from the SDK on sign-out (back to an anonymous id). */
export async function resetPurchaser(): Promise<void> {
  if (!isAvailable()) return;
  await getPurchases().logOut();
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!isAvailable()) return null;
  configurePurchases();
  const offerings = await getPurchases().getOfferings();
  return offerings.current ?? null;
}

/** Find a package in the offering by its underlying store product identifier. */
export function findPackage(
  offering: PurchasesOffering | null,
  productId: string,
): PurchasesPackage | null {
  return offering?.availablePackages.find((p) => p.product.identifier === productId) ?? null;
}

/** Returns true on a completed purchase, false when the user cancels. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  const Purchases = getPurchases();
  try {
    await Purchases.purchasePackage(pkg);
    return true;
  } catch (error) {
    if ((error as { userCancelled?: boolean })?.userCancelled) {
      return false;
    }
    throw error;
  }
}

/** Restore prior purchases (App Store requires an explicit restore action). */
export async function restorePurchases(): Promise<void> {
  if (!isAvailable()) return;
  configurePurchases();
  await getPurchases().restorePurchases();
}
