import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
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
import { SectionHeader } from "@/components/ui/SectionHeader";
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

function SettingRow({
  icon,
  label,
  subtitle,
  right,
  onPress,
  color,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  color?: string;
  last?: boolean;
}) {
  const colors = useColors();
  const tint = color ?? colors.primary;
  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={label}
      accessibilityRole={onPress ? "button" : "none"}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint + "20" }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[typography.body, { color: colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.secondaryText }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      ) : null)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
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

  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [dndSheetOpen, setDndSheetOpen] = useState(false);
  const [dndLabel, setDndLabel] = useState("");
  const [dndStart, setDndStart] = useState("22:00");
  const [dndEnd, setDndEnd] = useState("07:00");
  const [deleteDialogStep, setDeleteDialogStep] = useState(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [usageLimit, setUsageLimit] = useState(4);
  const [activitySpikeAlert, setActivitySpikeAlert] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const [devSheetOpen, setDevSheetOpen] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  const handleDeleteAccount = () => {
    if (deleteDialogStep === 0) {
      Alert.alert("Delete Account", "Are you sure you want to delete your account?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => setDeleteDialogStep(1),
        },
      ]);
    } else if (deleteDialogStep === 1) {
      Alert.alert(
        "This cannot be undone",
        "All data will be permanently deleted including contacts, sessions, and settings.",
        [
          { text: "Cancel", style: "cancel", onPress: () => setDeleteDialogStep(0) },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => setDeleteDialogStep(2),
          },
        ]
      );
    }
  };

  const handleVersionTap = () => {
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= 7) {
      setDevTapCount(0);
      setDevSheetOpen(true);
    }
  };

  const handleAddDnd = () => {
    if (!dndLabel.trim()) {
      Alert.alert("Label required", "Please enter a label for this DND window.");
      return;
    }
    addDnd.mutate({ label: dndLabel, startTime: dndStart, endTime: dndEnd });
    setDndLabel("");
    setDndStart("22:00");
    setDndEnd("07:00");
    setDndSheetOpen(false);
  };

  const handleDeleteDnd = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Delete DND Window", "Remove this quiet hours window?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteDnd.mutate(id),
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Profile header */}
      <LinearGradient
        colors={[colors.primaryDarkest, colors.primaryDark] as string[]}
        style={[styles.profileHeader, { paddingTop: topPad + spacing.sm }]}
      >
        <TouchableOpacity
          onPress={() => setColorPickerOpen(true)}
          accessibilityLabel="Change avatar color"
          accessibilityRole="button"
        >
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarInitials}>
              {user?.username?.slice(0, 2).toUpperCase() ?? "??"}
            </Text>
          </View>
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.headerText, marginTop: spacing.sm }]}>
          {user?.username ?? "Guest"}
        </Text>
        <Text style={[typography.caption, { color: colors.headerText + "BF" }]}>
          {user?.email ?? "Not logged in"}
        </Text>
        {!user && (
          <TouchableOpacity
            style={[styles.signInBtn, { backgroundColor: colors.surface }]}
            onPress={() => router.push("/auth")}
          >
            <Text style={{ color: colors.primaryDarkest, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
              Sign In
            </Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Color picker */}
      {colorPickerOpen && (
        <View style={[styles.colorPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: spacing.sm }]}>
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
                }}
              />
            ))}
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* SECURITY SECTION */}
        <SectionHeader title="Security" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {biometricSupported && (
            <SettingRow
              icon="finger-print"
              label="Biometric Lock"
              subtitle="Require Face ID or Fingerprint to open app"
              right={
                <ToggleSwitch
                  value={biometricEnabled}
                  onValueChange={(v) => {
                    Haptics.selectionAsync();
                    toggleBiometric(v);
                  }}
                />
              }
            />
          )}
          {biometricEnabled && (
            <SettingRow
              icon="timer-outline"
              label="Auto-lock after"
              subtitle={
                AUTO_LOCK_OPTIONS.find((o) => o.value === (autoLockSeconds ?? 30))?.label ?? "30 seconds"
              }
              onPress={() => {
                Alert.alert(
                  "Auto-lock timer",
                  "Lock app after being backgrounded for:",
                  [
                    ...AUTO_LOCK_OPTIONS.map((opt) => ({
                      text: opt.label,
                      onPress: () => setAutoLockSeconds?.(opt.value),
                    })),
                    { text: "Cancel", style: "cancel" as const },
                  ]
                );
              }}
            />
          )}
          <SettingRow
            icon="key-outline"
            label="Change Password"
            onPress={() => Alert.alert("Change Password", "Password change will be available soon.")}
            last
          />
        </View>

        {/* SUBSCRIPTION SECTION */}
        <SectionHeader title="Subscription" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="diamond"
            label={current?.planName ?? "Free Plan"}
            subtitle={current?.expiresAt ? `Expires ${current.expiresAt}` : "No expiry"}
            color={colors.purple}
          />
          <SettingRow
            icon="arrow-up-circle"
            label="Upgrade Plan"
            subtitle="Unlock all features"
            onPress={() => router.push("/subscription")}
            color={colors.purple}
            last
          />
        </View>

        {/* NOTIFICATIONS SECTION */}
        <SectionHeader title="Notifications" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="notifications"
            label="Push Notifications"
            right={
              <ToggleSwitch
                value={settings?.notificationsEnabled ?? true}
                onValueChange={(v) => {
                  Haptics.selectionAsync();
                  updateSettings.mutate({ notificationsEnabled: v });
                }}
              />
            }
          />
          <SettingRow
            icon="volume-high"
            label="Sound"
            right={<ToggleSwitch value={true} onValueChange={() => {}} />}
          />
          <SettingRow
            icon="phone-portrait"
            label="Vibration"
            right={<ToggleSwitch value={true} onValueChange={() => {}} />}
          />
          <SettingRow
            icon="eye"
            label="Show Preview"
            subtitle="Show message preview in notifications"
            right={<ToggleSwitch value={true} onValueChange={() => {}} />}
            last
          />
        </View>

        {/* DO NOT DISTURB SECTION */}
        <SectionHeader title="Do Not Disturb" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {dndRules.map((rule, idx) => (
            <View
              key={rule.id}
              style={[
                styles.dndRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: idx < dndRules.length - 1 ? StyleSheet.hairlineWidth : 0,
                },
              ]}
            >
              <Ionicons name="moon" size={20} color={colors.blue} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: colors.text }]}>{rule.label}</Text>
                <Text style={[typography.caption, { color: colors.secondaryText }]}>
                  {rule.startTime} – {rule.endTime}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteDnd(rule.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`Delete ${rule.label} DND rule`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.addDndBtn, { borderTopColor: colors.border }]}
            onPress={() => setDndSheetOpen(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[typography.bodyMedium, { color: colors.primary }]}>
              Add DND Window
            </Text>
          </TouchableOpacity>
        </View>

        {/* ALERTS SECTION */}
        <SectionHeader title="Alerts" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="moon"
            label="Late Night Starts At"
            subtitle="23:00"
            onPress={() => Alert.alert("Late Night Threshold", "Time picker coming soon.")}
          />
          <View style={styles.sliderRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.warning + "20" }]}>
              <Ionicons name="time" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.text }]}>Daily Usage Limit</Text>
              <Text style={[typography.caption, { color: colors.secondaryText }]}>
                Alert when contact exceeds {usageLimit}h
              </Text>
              <SliderInput
                value={usageLimit}
                min={1}
                max={12}
                step={1}
                onChange={setUsageLimit}
              />
            </View>
          </View>
          <SettingRow
            icon="alert-circle"
            label="Keyword Alerts"
            subtitle="Monitor message keywords"
            onPress={() => router.push("/keyword-alerts")}
          />
          <SettingRow
            icon="trending-up"
            label="Activity Spike Alert"
            subtitle="Notify when usage increases by >200%"
            right={
              <ToggleSwitch
                value={activitySpikeAlert}
                onValueChange={(v) => {
                  Haptics.selectionAsync();
                  setActivitySpikeAlert(v);
                }}
              />
            }
            last
          />
        </View>

        {/* THEME SECTION */}
        <SectionHeader title="Theme" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["light", "dark", "system"] as const).map((t, idx, arr) => (
            <SettingRow
              key={t}
              icon={t === "light" ? "sunny" : t === "dark" ? "moon" : "phone-portrait"}
              label={t === "system" ? "System Default" : t.charAt(0).toUpperCase() + t.slice(1)}
              onPress={() => {
                Haptics.selectionAsync();
                setTheme(t);
              }}
              right={
                theme === t ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : undefined
              }
              last={idx === arr.length - 1}
            />
          ))}
        </View>

        {/* DATA SECTION */}
        <SectionHeader title="Data" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="download"
            label="Export All Data"
            subtitle="Download JSON of all your data"
            onPress={() =>
              Alert.alert("Export Data", "Your data export will be prepared and shared.")
            }
          />
          <SettingRow
            icon="cloud-upload"
            label="Import Data"
            subtitle="Restore from a backup JSON file"
            onPress={() =>
              Alert.alert("Import Data", "Pick a JSON backup file to import contacts.")
            }
          />
          <SettingRow
            icon="refresh-circle"
            label="Clear Cache"
            onPress={() =>
              Alert.alert("Clear Cache", "This will reset cached data. Continue?", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", onPress: () => {} },
              ])
            }
          />
          <SettingRow
            icon="trash"
            label="Delete Account"
            subtitle="Permanently delete all data"
            color={colors.danger}
            onPress={handleDeleteAccount}
            last
          />
        </View>

        {/* LINKS SECTION */}
        <SectionHeader title="More" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="star"
            label="Rate Us"
            onPress={() =>
              Alert.alert("Rate WaTracker Pro", "Thank you for your feedback!")
            }
          />
          <SettingRow
            icon="help-circle"
            label="Help & Support"
            onPress={() =>
              Alert.alert("Help & Support", "FAQ and support are available on our website.")
            }
          />
          <SettingRow
            icon="document-text"
            label="Terms of Service"
            onPress={() => {}}
          />
          <SettingRow
            icon="shield-checkmark"
            label="Privacy Policy"
            onPress={() => {}}
            last
          />
        </View>

        {/* App info (easter egg) */}
        <TouchableOpacity
          onPress={handleVersionTap}
          style={styles.versionRow}
          activeOpacity={0.7}
        >
          <Text style={[typography.caption, { color: colors.muted, textAlign: "center" }]}>
            WaTracker Pro v2.0
          </Text>
        </TouchableOpacity>

        {/* Logout */}
        {user && (
          <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.sm }}>
            <TouchableOpacity
              style={[styles.logoutBtn, { borderColor: colors.danger }]}
              onPress={handleLogout}
              accessibilityLabel="Logout"
              accessibilityRole="button"
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={[typography.bodyMedium, { color: colors.danger }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
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
              Label
            </Text>
            <TextInput
              value={dndLabel}
              onChangeText={setDndLabel}
              placeholder="e.g. Bedtime"
              placeholderTextColor={colors.secondaryText}
              style={[
                styles.dndInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
            />
          </View>
          <View style={styles.dndTimeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: 6 }]}>
                Start time
              </Text>
              <TextInput
                value={dndStart}
                onChangeText={setDndStart}
                placeholder="22:00"
                placeholderTextColor={colors.secondaryText}
                style={[
                  styles.dndInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: 6 }]}>
                End time
              </Text>
              <TextInput
                value={dndEnd}
                onChangeText={setDndEnd}
                placeholder="07:00"
                placeholderTextColor={colors.secondaryText}
                style={[
                  styles.dndInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.addDndSaveBtn, { backgroundColor: colors.primary }]}
            onPress={handleAddDnd}
          >
            <Text style={[typography.bodyMedium, { color: "#fff" }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Dev info sheet */}
      <BottomSheet
        visible={devSheetOpen}
        onClose={() => setDevSheetOpen(false)}
        title="Developer Info"
      >
        <View style={{ gap: spacing.sm, paddingBottom: insets.bottom + spacing.base }}>
          {[
            { label: "App Version", value: "2.0.0" },
            { label: "Build", value: "production" },
            { label: "User ID", value: String(user?.id ?? "N/A") },
            { label: "Theme", value: theme },
          ].map((row) => (
            <View
              key={row.label}
              style={[styles.devRow, { borderBottomColor: colors.border }]}
            >
              <Text style={[typography.caption, { color: colors.secondaryText }]}>
                {row.label}
              </Text>
              <Text style={[typography.caption, { color: colors.text }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      </BottomSheet>

      {/* Step 2 delete confirm */}
      {deleteDialogStep === 2 && (
        <View style={styles.deleteOverlay}>
          <View style={[styles.deleteModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
              Final Confirmation
            </Text>
            <Text style={[typography.body, { color: colors.secondaryText, marginBottom: spacing.base }]}>
              Type <Text style={{ color: colors.danger, fontFamily: "Inter_700Bold" }}>DELETE</Text> to confirm account deletion:
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={colors.secondaryText}
              style={[
                styles.deleteInput,
                { borderColor: colors.danger, color: colors.text, backgroundColor: colors.inputBg },
              ]}
              autoCapitalize="characters"
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.base }}>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => {
                  setDeleteDialogStep(0);
                  setDeleteConfirmText("");
                }}
              >
                <Text style={[typography.bodyMedium, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteBtn,
                  {
                    backgroundColor:
                      deleteConfirmText === "DELETE" ? colors.danger : colors.muted,
                  },
                ]}
                disabled={deleteConfirmText !== "DELETE"}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  logout();
                  setDeleteDialogStep(0);
                  setDeleteConfirmText("");
                }}
              >
                <Text style={[typography.bodyMedium, { color: "#fff" }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  profileHeader: {
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
  avatarInitials: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 24,
  },
  signInBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  colorPicker: {
    padding: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colorRow: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  section: {
    marginHorizontal: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
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
  sliderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.base,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dndRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    gap: spacing.md,
  },
  addDndBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dndTimeRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dndInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  addDndSaveBtn: {
    padding: spacing.base,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  versionRow: {
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  deleteOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteModal: {
    width: "88%",
    padding: spacing.xl,
    borderRadius: 16,
    borderWidth: 1,
  },
  deleteInput: {
    borderWidth: 2,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    letterSpacing: 2,
  },
  deleteBtn: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 10,
  },
  devRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
