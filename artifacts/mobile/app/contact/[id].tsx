import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useContact, useDeleteContact, useUpdateContact } from "@/hooks/useContacts";
import { useContactStats, useHourlyData } from "@/hooks/useSessions";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart } from "@/components/ui/BarChart";
import { ChipFilter } from "@/components/ui/ChipFilter";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatDuration } from "@/lib/formatters";

const RANGE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

export default function ContactDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contactId = parseInt(id ?? "0", 10);
  const [range, setRange] = useState<"today" | "week" | "month">("today");

  const { data: contact, isLoading: loadingContact } = useContact(contactId);
  const { data: stats, isLoading: loadingStats } = useContactStats(contactId, range);
  const { data: hourly = [] } = useHourlyData(contactId);
  const deleteContact = useDeleteContact();
  const updateContact = useUpdateContact();

  function handleDelete() {
    Alert.alert("Delete Contact", `Remove ${contact?.name} from tracking?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteContact.mutateAsync(contactId);
          router.back();
        },
      },
    ]);
  }

  if (loadingContact) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={{ padding: spacing.base, gap: spacing.base, paddingTop: (Platform.OS === "web" ? 67 : insets.top) + spacing.base }}>
          <SkeletonLoader width="100%" height={120} borderRadius={16} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} />
        </View>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[typography.body, { color: colors.secondaryText }]}>Contact not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[typography.caption, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text, flex: 1, textAlign: "center" }]}>
          {contact.name}
        </Text>
        <TouchableOpacity onPress={handleDelete} style={styles.backBtn}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 80, gap: spacing.base }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AvatarCircle name={contact.name} size={72} isOnline={(contact as any).isOnline} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={[typography.h3, { color: colors.text }]}>{contact.name}</Text>
            <Text style={[typography.caption, { color: colors.secondaryText }]}>{contact.phoneNumber}</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: (contact as any).isOnline ? colors.online + "20" : colors.offline + "20" },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: (contact as any).isOnline ? colors.online : colors.offline },
                ]}
              />
              <Text
                style={[
                  typography.caption,
                  { color: (contact as any).isOnline ? colors.online : colors.offline },
                ]}
              >
                {(contact as any).isOnline ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
          <View style={styles.alertRow}>
            <Text style={[typography.caption, { color: colors.secondaryText }]}>Alerts enabled</Text>
            <ToggleSwitch
              value={contact.alertEnabled}
              onValueChange={(v) => updateContact.mutate({ id: contactId, alertEnabled: v })}
            />
          </View>
        </View>

        <ChipFilter options={RANGE_OPTIONS} selected={range} onSelect={(v) => setRange(v as any)} />

        <View style={styles.statsRow}>
          <StatCard
            label="Sessions"
            value={stats ? String(stats.totalSessions) : "--"}
            icon="time"
            color={colors.primary}
          />
          <StatCard
            label="Online Time"
            value={stats ? formatDuration(stats.totalMinutes) : "--"}
            icon="hourglass"
            color={colors.blue}
          />
        </View>

        <View style={{ paddingHorizontal: spacing.base }}>
          <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.sm }]}>
            Activity by Hour
          </Text>
          {hourly.length > 0 ? (
            <BarChart data={hourly} height={120} color={colors.primary} />
          ) : (
            <View style={[styles.noData, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.secondaryText }]}>No data available</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.base, gap: spacing.sm }}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/reports?contactId=${contactId}`)}
          >
            <Ionicons name="bar-chart" size={18} color="#fff" />
            <Text style={[typography.bodyMedium, { color: "#fff" }]}>View Full Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => router.push(`/chat/${contactId}`)}
          >
            <Ionicons name="chatbubbles" size={18} color={colors.primary} />
            <Text style={[typography.bodyMedium, { color: colors.primary }]}>View Chat</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  profileCard: {
    margin: spacing.base,
    padding: spacing.xl,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: spacing.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 24,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e9edef",
  },
  statsRow: { flexDirection: "row", paddingHorizontal: spacing.base, gap: spacing.sm },
  noData: { padding: spacing.xl, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: 10,
  },
});
