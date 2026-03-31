import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

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
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      if (Notifications && notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current as import("expo-notifications").EventSubscription
        );
      }
      if (Notifications && responseListener.current) {
        Notifications.removeNotificationSubscription(
          responseListener.current as import("expo-notifications").EventSubscription
        );
      }
    };
  }, []);

  async function checkPermission() {
    if (!Notifications) return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermission(status as "granted" | "denied" | "undetermined");
    } catch {}
  }

  async function requestPermission(): Promise<boolean> {
    if (!Notifications) return false;
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
