import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as aesjs from "aes-js";

// aes-js's hex.toBytes silently yields NaN bytes for non-hex input, which then
// throws deep inside the cipher ("Array contains invalid value"). Validate up front.
function isHex(value: string) {
  return value.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(value);
}

// SECURITY_REVIEW S5: Supabase auth tokens (refresh + access JWT) were stored
// in plaintext AsyncStorage. expo-secure-store caps values at 2048 bytes — too
// small for a session — so we follow Supabase's official adapter: a per-key
// AES-256 key lives in SecureStore (hardware-backed keystore/keychain) and the
// encrypted session payload lives in AsyncStorage.
// https://supabase.com/blog/react-native-authentication
export class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    // No key (e.g. a legacy plaintext value written before this adapter), or a
    // value/key that isn't valid hex → not decryptable. Bail instead of letting
    // aes-js choke on NaN bytes.
    if (!encryptionKeyHex || !isHex(encryptionKeyHex) || !isHex(value)) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return null;
    }

    try {
      return await this._decrypt(key, encrypted);
    } catch {
      // Corrupt or legacy entry — drop it so the app falls back to a
      // logged-out state instead of crashing on every read/refresh.
      await this.removeItem(key);
      return null;
    }
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);

    await AsyncStorage.setItem(key, encrypted);
  }
}
