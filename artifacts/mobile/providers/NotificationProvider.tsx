import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";

let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
} catch {}

interface NotificationState {
  expoPushToken: string | null;
  permission: "granted" | "denied" | "undetermined";
  requestPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationState>({
  expoPushToken: null,
  permission: "undetermined",
  requestPermission: async () => false,
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const notificationListener = useRef<unknown>(null);
  const responseListener = useRef<unknown>(null);

  useEffect(() => {
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    checkPermission();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(response.notification.request.content.data);
    });

    return () => {
      try {
        (notificationListener.current as any)?.remove?.();
      } catch {}
      try {
        (responseListener.current as any)?.remove?.();
      } catch {}
    };
  }, []);

  function handleNotificationTap(data: Record<string, unknown>) {
    if (!data) return;

    try {
      const type = data.type as string | undefined;
      const contactId = data.contactId as number | string | undefined;
      const chatId = data.chatId as number | string | undefined;

      if (type === "contact" && contactId) {
        router.push(`/contact/${contactId}` as any);
      } else if (type === "chat" && chatId) {
        router.push(`/chat/${chatId}` as any);
      } else if (type === "keyword" && contactId) {
        router.push(`/chat/${contactId}` as any);
      } else {
        router.push("/(tabs)/notifications" as any);
      }
    } catch {}
  }

  async function checkPermission() {
    if (!Notifications) return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermission(status as "granted" | "denied" | "undetermined");
    } catch {}
  }

  async function requestPermission(): Promise<boolean> {
    if (!Notifications) return false;
    if (Platform.OS === "web") return false;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermission(status as "granted" | "denied" | "undetermined");
      if (status === "granted") {
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          setExpoPushToken(tokenData.data);
        } catch {}
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  return (
    <NotificationContext.Provider value={{ expoPushToken, permission, requestPermission }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationProvider() {
  return useContext(NotificationContext);
}
