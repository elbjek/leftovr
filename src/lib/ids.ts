// RFC 4122 v4-format id for client-side idempotency keys. Hermes has no
// crypto.randomUUID; uniqueness is all we need here, not unpredictability.
// ponytail: Math.random, swap for expo-crypto if an id ever needs to be secret.
export function newClientId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
