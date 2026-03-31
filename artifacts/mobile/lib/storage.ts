import AsyncStorage from "@react-native-async-storage/async-storage";

export const StorageKeys = {
  THEME: "theme_preference",
  ONBOARDING_DONE: "onboarding_complete",
  BIOMETRIC_LOCK: "biometric_lock",
  FAVORITES: "favorite_contacts",
  DND_SETTINGS: "dnd_settings",
} as const;

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const val = await AsyncStorage.getItem(key);
    if (val === null) return null;
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}
