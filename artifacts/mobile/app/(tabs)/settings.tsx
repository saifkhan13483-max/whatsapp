import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { ConnectionStatusCard } from "@/components/ui/ConnectionStatusCard";
import {
  useSettings,
  useUpdateSettings,
  useDndRules,
  useAddDnd,
  useDeleteDnd,
} from "@/hooks/useSettings";
import { useCurrentSubscription } from "@/hooks/useSubscription";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SliderInput } from "@/components/ui/SliderInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

const AVATAR_COLORS = [
  "#25D366", "#128C7E", "#075E54", "#34B7F1",
  "#7C4DFF", "#FF6B6B", "#FFC107", "#4CAF50",
];

const AUTO_LOCK_OPTIONS = [
  { label: "Immediately", value: 0 },
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "5 minutes", value: 300 },
];

function SectionCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text style={[typography.caption, { color: colors.primary, fontFamily: "Inter_700Bold", letterSpacing: 0.4 }]}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  subtitle,
  right,
  onPress,
  iconColor,
  last,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  iconColor?: string;
  last?: boolean;
  destructive?: boolean;
}) {
  const colors = useColors();
  const tint = destructive ? colors.danger : (iconColor ?? colors.primary);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={label}
      accessibilityRole={onPress ? "button" : "none"}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint + "1a" }]}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[typography.body, { color: destructive ? colors.danger : colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.secondaryText }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ?? (onPress ? (
        <Ionicons name="chevron-forward" size={17} color={colors.muted} />
      ) : null)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: current } = useCurrentSubscription();
  const { data: dndRules = [] } = useDndRules();
  const addDnd = useAddDnd();
  const deleteDnd = useDeleteDnd();
  const {
    enabled: biometricEnabled,
    supported: biometricSupported,
    toggle: toggleBiometric,
    autoLockSeconds,
    setAutoLockSeconds,
  } = useBiometricLock();

  const {
    connectionStatus,
    disconnect: disconnectWhatsApp,
    isDisconnecting,
    reconnect: reconnectWhatsApp,
    isReconnecting,
  } = useWhatsAppConnection();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [dndSheetOpen, setDndSheetOpen] = useState(false);
  const [dndLabel, setDndLabel] = useState("");
  const [dndStart, setDndStart] = useState("22:00");
  const [dndEnd, setDndEnd] = useState("07:00");
  const [clearDialogVisible, setClearDialogVisible] = useState(false);
  const [usageLimit, setUsageLimit] = useState(4);
  const [activitySpikeAlert, setActivitySpikeAlert] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);

  const isPro = !!(current?.planName && current.planName.toLowerCase() !== "free");

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This will permanently delete all your data including contacts, sessions, chats, and settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Final Confirmation",
              "Type DELETE to confirm. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => {} },
              ]
            ),
        },
      ]
    );
  };

  const handleAddDnd = () => {
    if (!dndLabel.trim()) {
      Alert.alert("Label required", "Please enter a name for this quiet hours window.");
      return;
    }
    addDnd.mutate({ label: dndLabel.trim(), startTime: dndStart, endTime: dndEnd });
    setDndLabel("");
    setDndStart("22:00");
    setDndEnd("07:00");
    setDndSheetOpen(false);
  };

  const handleDeleteDnd = (id: number, label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Delete Quiet Hours", `Remove "${label}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteDnd.mutate(id) },
    ]);
  };

  const isWide = width >= 768;

  const content = (
    <>
      {/* SECURITY */}
      <SectionTitle title="Security" icon="lock-closed" />
      <SectionCard>
        {biometricSupported && (
          <SettingRow
            icon="finger-print"
            label="Biometric Lock"
            subtitle="Face ID or fingerprint required to open"
            right={
              <ToggleSwitch
                value={biometricEnabled}
                onValueChange={(v) => { Haptics.selectionAsync(); toggleBiometric(v); }}
              />
            }
          />
        )}
        {biometricEnabled && (
          <SettingRow
            icon="timer-outline"
            label="Auto-lock Timer"
            subtitle={AUTO_LOCK_OPTIONS.find((o) => o.value === (autoLockSeconds ?? 30))?.label ?? "30 seconds"}
            onPress={() => {
              Alert.alert("Auto-lock after", undefined, [
                ...AUTO_LOCK_OPTIONS.map((opt) => ({
                  text: opt.label,
                  onPress: () => setAutoLockSeconds?.(opt.value),
                })),
                { text: "Cancel", style: "cancel" as const },
              ]);
            }}
          />
        )}
        <SettingRow
          icon="key-outline"
          label="Change Password"
          onPress={() => Alert.alert("Change Password", "Password change coming soon.")}
          last
        />
      </SectionCard>

      {/* WHATSAPP CONNECTION */}
      <SectionTitle title="WhatsApp Connection" icon="logo-whatsapp" />
      <View style={{ marginBottom: 4 }}>
        <ConnectionStatusCard
          status={connectionStatus?.status ?? "not_connected"}
          phoneNumber={connectionStatus?.phoneNumber ?? undefined}
          connectedAt={connectionStatus?.connectedAt ?? undefined}
          onConnect={() => router.push("/connect-whatsapp")}
          onContinueSetup={() => router.push("/connect-whatsapp")}
          onDisconnect={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            Alert.alert(
              "Disconnect WhatsApp",
              "Are you sure you want to unlink your WhatsApp account?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Disconnect",
                  style: "destructive",
                  onPress: () => disconnectWhatsApp(),
                },
              ]
            );
          }}
          onReconnect={() => reconnectWhatsApp()}
          isDisconnecting={isDisconnecting}
          isReconnecting={isReconnecting}
        />
      </View>

      {/* SUBSCRIPTION */}
      <SectionTitle title="Subscription" icon="diamond" />
      <View
        style={[
          styles.subscriptionCard,
          {
            backgroundColor: isPro ? colors.purple + "18" : colors.card,
            borderColor: isPro ? colors.purple + "50" : colors.border,
          },
        ]}
      >
        <View style={styles.subCardRow}>
          <View style={[styles.subIcon, { backgroundColor: isPro ? colors.purple + "25" : colors.muted + "25" }]}>
            <Ionicons name="diamond" size={24} color={isPro ? colors.purple : colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyMedium, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              {current?.planName ?? "Free Plan"}
            </Text>
            <Text style={[typography.caption, { color: colors.secondaryText }]}>
              {current?.expiresAt ? `Renews ${current.expiresAt}` : isPro ? "Active subscription" : "Basic features only"}
            </Text>
          </View>
          {!isPro && (
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: colors.purple }]}
              onPress={() => router.push("/subscription")}
            >
              <Text style={[typography.caption, { color: "#fff", fontFamily: "Inter_700Bold" }]}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>
        {!isPro && (
          <View style={[styles.subFeatures, { borderTopColor: colors.border }]}>
            <Text style={[typography.small, { color: colors.secondaryText }]}>
              Pro unlocks: unlimited contacts, keyword alerts, reports, and more
            </Text>
          </View>
        )}
      </View>

      {/* NOTIFICATIONS */}
      <SectionTitle title="Notifications" icon="notifications" />
      <SectionCard>
        <SettingRow
          icon="notifications"
          label="Push Notifications"
          right={
            <ToggleSwitch
              value={settings?.notificationsEnabled ?? true}
              onValueChange={(v) => { Haptics.selectionAsync(); updateSettings.mutate({ notificationsEnabled: v }); }}
            />
          }
        />
        <SettingRow
          icon="volume-high"
          label="Alert Sound"
          right={<ToggleSwitch value={true} onValueChange={() => {}} />}
        />
        <SettingRow
          icon="phone-portrait"
          label="Vibration"
          right={<ToggleSwitch value={true} onValueChange={() => {}} />}
        />
        <SettingRow
          icon="eye"
          label="Show Message Preview"
          subtitle="Display content in notification banners"
          right={<ToggleSwitch value={true} onValueChange={() => {}} />}
          last
        />
      </SectionCard>

      {/* DO NOT DISTURB */}
      <SectionTitle title="Do Not Disturb" icon="moon" />
      <SectionCard>
        {dndRules.map((rule, idx) => (
          <View
            key={rule.id}
            style={[
              styles.dndRow,
              {
                borderBottomColor: colors.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View style={[styles.dndIcon, { backgroundColor: colors.blue + "1a" }]}>
              <Ionicons name="moon" size={18} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.text }]}>{rule.label}</Text>
              <Text style={[typography.caption, { color: colors.secondaryText }]}>
                {rule.startTime} – {rule.endTime}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDeleteDnd(rule.id, rule.label)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={`Delete ${rule.label}`}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.addDndBtn, { borderTopColor: dndRules.length > 0 ? colors.border : "transparent" }]}
          onPress={() => setDndSheetOpen(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={[typography.bodyMedium, { color: colors.primary }]}>Add Quiet Hours Window</Text>
        </TouchableOpacity>
      </SectionCard>

      {/* ALERT SETTINGS */}
      <SectionTitle title="Alert Settings" icon="alert-circle" />
      <SectionCard>
        <SettingRow
          icon="moon"
          label="Late Night Threshold"
          subtitle="Alerts after 23:00 marked as late night"
          onPress={() => Alert.alert("Late Night Threshold", "Time picker coming soon.")}
          iconColor={colors.purple}
        />
        <View style={styles.sliderRow}>
          <View style={[styles.rowIcon, { backgroundColor: colors.warning + "1a" }]}>
            <Ionicons name="time" size={19} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.text }]}>Daily Usage Limit</Text>
            <Text style={[typography.caption, { color: colors.secondaryText }]}>
              Alert when contact exceeds {usageLimit}h per day
            </Text>
            <SliderInput value={usageLimit} min={1} max={12} step={1} onChange={setUsageLimit} />
          </View>
        </View>
        <SettingRow
          icon="alert-circle"
          label="Keyword Alerts"
          subtitle="Get notified when specific words appear"
          onPress={() => router.push("/keyword-alerts")}
          iconColor={colors.warning}
        />
        <SettingRow
          icon="trending-up"
          label="Activity Spike Alert"
          subtitle="Notify when usage increases by 200%+"
          right={
            <ToggleSwitch
              value={activitySpikeAlert}
              onValueChange={(v) => { Haptics.selectionAsync(); setActivitySpikeAlert(v); }}
            />
          }
          last
        />
      </SectionCard>

      {/* THEME */}
      <SectionTitle title="Appearance" icon="color-palette" />
      <SectionCard>
        {(["light", "dark", "system"] as const).map((t, idx, arr) => (
          <SettingRow
            key={t}
            icon={t === "light" ? "sunny" : t === "dark" ? "moon" : "phone-portrait"}
            label={t === "system" ? "System Default" : t.charAt(0).toUpperCase() + t.slice(1) + " Mode"}
            subtitle={t === "system" ? "Follow device setting" : undefined}
            onPress={() => { Haptics.selectionAsync(); setTheme(t); }}
            right={
              theme === t ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              ) : (
                <View style={[styles.themeRadio, { borderColor: colors.border }]} />
              )
            }
            last={idx === arr.length - 1}
          />
        ))}
      </SectionCard>

      {/* DATA */}
      <SectionTitle title="Data & Privacy" icon="shield-checkmark" />
      <SectionCard>
        <SettingRow
          icon="download-outline"
          label="Export All Data"
          subtitle="Download JSON backup of your data"
          onPress={() => Alert.alert("Export Data", "Your data export will be prepared shortly.")}
        />
        <SettingRow
          icon="cloud-upload-outline"
          label="Import Data"
          subtitle="Restore from a backup JSON file"
          onPress={() => Alert.alert("Import Data", "Select a JSON backup file to import.")}
        />
        <SettingRow
          icon="refresh-circle-outline"
          label="Clear App Cache"
          onPress={() =>
            Alert.alert("Clear Cache", "This will reset all cached data and refresh the app.", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", onPress: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
            ])
          }
        />
        <SettingRow
          icon="trash"
          label="Delete Account"
          subtitle="Permanently delete all data"
          destructive
          onPress={handleDeleteAccount}
          last
        />
      </SectionCard>

      {/* MORE */}
      <SectionTitle title="More" icon="ellipsis-horizontal-circle" />
      <SectionCard>
        <SettingRow
          icon="star"
          label="Rate WaTracker Pro"
          onPress={() => Alert.alert("Rate Us", "Thank you for using WaTracker Pro!")}
          iconColor={colors.warning}
        />
        <SettingRow
          icon="help-circle-outline"
          label="Help & Support"
          onPress={() => Alert.alert("Help & Support", "Visit our FAQ and support portal.")}
        />
        <SettingRow
          icon="document-text-outline"
          label="Terms of Service"
          onPress={() => {}}
        />
        <SettingRow
          icon="shield-outline"
          label="Privacy Policy"
          onPress={() => {}}
          last
        />
      </SectionCard>

      {/* Version */}
      <TouchableOpacity
        style={styles.versionRow}
        onPress={() => {
          const next = devTapCount + 1;
          setDevTapCount(next);
          if (next >= 7) setDevTapCount(0);
        }}
        activeOpacity={0.6}
      >
        <Text style={[typography.small, { color: colors.muted, textAlign: "center" }]}>
          WaTracker Pro v2.0
        </Text>
        <Text style={[typography.small, { color: colors.muted, textAlign: "center", opacity: 0.6 }]}>
          Build 2024.1
        </Text>
      </TouchableOpacity>

      {/* Logout */}
      {user && (
        <View style={{ paddingHorizontal: spacing.base, marginBottom: spacing.base }}>
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: colors.danger + "60", backgroundColor: colors.danger + "0d" }]}
            onPress={handleLogout}
            accessibilityLabel="Logout"
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[typography.bodyMedium, { color: colors.danger }]}>Log Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Profile Header */}
      <LinearGradient
        colors={[colors.primaryDarkest, colors.primaryDark] as [string, string]}
        style={[styles.profileHeader, { paddingTop: topPad + spacing.sm }]}
      >
        <View style={styles.profileRow}>
          <TouchableOpacity
            onPress={() => setColorPickerOpen(!colorPickerOpen)}
            accessibilityLabel="Change avatar color"
            accessibilityRole="button"
          >
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarInitials}>
                {user?.username?.slice(0, 2).toUpperCase() ?? "??"}
              </Text>
              <View style={[styles.avatarEdit, { backgroundColor: "rgba(0,0,0,0.4)" }]}>
                <Ionicons name="pencil" size={10} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: "#fff" }]}>
              {user?.username ?? "Guest"}
            </Text>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.7)" }]}>
              {user?.email ?? "Not logged in"}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 6 }}>
              <View style={[styles.badge, { backgroundColor: isPro ? colors.purple + "40" : "rgba(255,255,255,0.15)" }]}>
                <Ionicons name="diamond" size={11} color={isPro ? "#E1BEE7" : "rgba(255,255,255,0.7)"} />
                <Text style={[typography.small, { color: isPro ? "#E1BEE7" : "rgba(255,255,255,0.7)", fontFamily: "Inter_600SemiBold" }]}>
                  {current?.planName ?? "Free"}
                </Text>
              </View>
            </View>
          </View>
          {!user && (
            <TouchableOpacity
              style={[styles.signInBtn, { backgroundColor: "rgba(255,255,255,0.9)" }]}
              onPress={() => router.push("/auth")}
            >
              <Text style={{ color: colors.primaryDarkest, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                Sign In
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Color picker inline */}
        {colorPickerOpen && (
          <View style={[styles.colorPicker, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Text style={[typography.small, { color: "rgba(255,255,255,0.75)", marginBottom: 8 }]}>
              Choose avatar color
            </Text>
            <View style={styles.colorRow}>
              {AVATAR_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    avatarColor === c && styles.colorSwatchActive,
                  ]}
                  onPress={() => {
                    setAvatarColor(c);
                    setColorPickerOpen(false);
                    Haptics.selectionAsync();
                  }}
                />
              ))}
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.base,
          gap: spacing.xs,
          paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>

      {/* DND bottom sheet */}
      <BottomSheet
        visible={dndSheetOpen}
        onClose={() => setDndSheetOpen(false)}
        title="Add Quiet Hours"
      >
        <View style={{ gap: spacing.base, paddingBottom: insets.bottom + spacing.base }}>
          <View>
            <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: 6 }]}>
              Window Name
            </Text>
            <TextInput
              value={dndLabel}
              onChangeText={setDndLabel}
              placeholder="e.g. Bedtime, Work Hours"
              placeholderTextColor={colors.muted}
              style={[
                styles.dndInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              returnKeyType="next"
            />
          </View>
          <View style={styles.dndTimeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: 6 }]}>
                Start Time
              </Text>
              <TextInput
                value={dndStart}
                onChangeText={setDndStart}
                placeholder="22:00"
                placeholderTextColor={colors.muted}
                style={[
                  styles.dndInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: 6 }]}>
                End Time
              </Text>
              <TextInput
                value={dndEnd}
                onChangeText={setDndEnd}
                placeholder="07:00"
                placeholderTextColor={colors.muted}
                style={[
                  styles.dndInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.saveDndBtn,
              { backgroundColor: dndLabel.trim() ? colors.primary : colors.muted },
            ]}
            onPress={handleAddDnd}
            disabled={addDnd.isPending}
          >
            <Ionicons name="moon" size={18} color="#fff" />
            <Text style={[typography.bodyMedium, { color: "#fff" }]}>
              {addDnd.isPending ? "Saving..." : "Save Quiet Hours"}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  profileHeader: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.base,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  avatarEdit: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  signInBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  colorPicker: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
  },
  colorRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchActive: {
    borderColor: "#fff",
    transform: [{ scale: 1.15 }],
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  subscriptionCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.xs,
    overflow: "hidden",
  },
  subCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.base,
  },
  subIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
  },
  subFeatures: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: 13,
    gap: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowContent: { flex: 1, gap: 1 },
  themeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  dndRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    gap: spacing.md,
  },
  dndIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  addDndBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.07)",
  },
  versionRow: {
    paddingVertical: spacing.xl,
    gap: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: 14,
    borderWidth: 1,
  },
  dndInput: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  dndTimeRow: {
    flexDirection: "row",
    gap: spacing.base,
  },
  saveDndBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: 12,
  },
});
