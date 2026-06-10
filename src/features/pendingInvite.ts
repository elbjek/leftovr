import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_INVITE_CODE_KEY = "chomp.pendingInviteCode";

export async function setPendingInviteCode(code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, code);
}

export async function consumePendingInviteCode(): Promise<string | null> {
  const code = await AsyncStorage.getItem(PENDING_INVITE_CODE_KEY);
  if (code) {
    await AsyncStorage.removeItem(PENDING_INVITE_CODE_KEY);
  }
  return code;
}
