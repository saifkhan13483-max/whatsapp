import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { enabled: biometricEnabled, supported: biometricSupported, toggle: toggleBiometric } = useBiometricLock();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  }

  function SettingRow({
    icon,
    label,
    subtitle,
    right,
    onPress,
    color,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    subtitle?: string;
    right?: React.ReactNode;
    onPress?: () => void;
    color?: string;
  }) {
    const tint = color ?? colors.primary;
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.border }]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View style={[styles.rowIcon, { backgroundColor: tint + "20" }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        <View style={styles.rowContent}>
          <Text style={[typography.body, { color: colors.text }]}>{label}</Text>
          {subtitle ? (
            <Text style={[typography.caption, { color: colors.secondaryText }]}>{subtitle}</Text>
          ) : null}
        </View>
        {right ?? (
          onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primaryDarkest, colors.primaryDark] as string[]}
        style={[styles.header, { paddingTop: topPad + spacing.sm }]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
          <Ionicons name="person" size={36} color={colors.primaryDarkest} />
        </View>
        <Text style={[typography.h3, { color: colors.headerText, marginTop: spacing.sm }]}>
          {user?.username ?? "Guest"}
        </Text>
        <Text style={[typography.caption, { color: colors.headerText + "BF" }]}>
          {user?.email ?? "Not logged in"}
        </Text>
        {!user && (
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.surface }]}
            onPress={() => router.push("/auth")}
          >
            <Text style={{ color: colors.primaryDarkest, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
              Sign In
            </Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 80 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="Notifications" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="notifications"
            label="Push Notifications"
            right={
              <ToggleSwitch
                value={settings?.notificationsEnabled ?? true}
                onValueChange={(v) => updateSettings.mutate({ notificationsEnabled: v })}
              />
            }
          />
          <SettingRow
            icon="radio-button-on"
            label="Online Alerts"
            right={
              <ToggleSwitch
                value={settings?.onlineAlerts ?? true}
                onValueChange={(v) => updateSettings.mutate({ onlineAlerts: v })}
              />
            }
          />
          <SettingRow
            icon="radio-button-off"
            label="Offline Alerts"
            right={
              <ToggleSwitch
                value={settings?.offlineAlerts ?? false}
                onValueChange={(v) => updateSettings.mutate({ offlineAlerts: v })}
              />
            }
          />
        </View>

        <SectionHeader title="Appearance" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["light", "dark", "system"] as const).map((t) => (
            <SettingRow
              key={t}
              icon={t === "light" ? "sunny" : t === "dark" ? "moon" : "phone-portrait"}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              subtitle={theme === t ? "Active" : undefined}
              onPress={() => setTheme(t)}
              right={theme === t ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined}
            />
          ))}
        </View>

        <SectionHeader title="Privacy & Security" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {biometricSupported && (
            <SettingRow
              icon="finger-print"
              label="Biometric Lock"
              subtitle="Require biometric to open app"
              right={
                <ToggleSwitch
                  value={biometricEnabled}
                  onValueChange={(v) => toggleBiometric(v)}
                />
              }
            />
          )}
          <SettingRow
            icon="shield-checkmark"
            label="Keyword Alerts"
            subtitle="Monitor message keywords"
            onPress={() => router.push("/keyword-alerts")}
          />
          <SettingRow
            icon="time"
            label="Do Not Disturb"
            subtitle="Quiet hours settings"
            onPress={() => {}}
          />
          <SettingRow
            icon="lock-closed"
            label="Data & Privacy"
            subtitle="Manage your stored data"
            onPress={() => {}}
          />
        </View>

        <SectionHeader title="Account" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="diamond"
            label="Subscription"
            subtitle="Manage your plan"
            onPress={() => router.push("/subscription")}
            color={colors.purple}
          />
          <SettingRow
            icon="bar-chart"
            label="Reports"
            onPress={() => router.push("/reports")}
          />
          <SettingRow
            icon="people"
            label="Family Dashboard"
            onPress={() => router.push("/family-dashboard")}
          />
        </View>

        {user && (
          <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.base }}>
            <TouchableOpacity
              style={[styles.logoutBtn, { borderColor: colors.danger }]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={[typography.bodyMedium, { color: colors.danger }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  section: {
    marginHorizontal: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
  },
});
