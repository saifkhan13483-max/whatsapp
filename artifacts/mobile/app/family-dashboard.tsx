import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useFamilyDashboard } from "@/hooks/useFamilyDashboard";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatDuration } from "@/lib/formatters";

export default function FamilyDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: summary, isLoading } = useFamilyDashboard();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: "#075E54", paddingTop: topPad + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: "#fff", flex: 1, textAlign: "center" }]}>Family Dashboard</Text>
        <View style={styles.btn} />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.base, gap: spacing.base }}>
          <SkeletonLoader width="100%" height={100} borderRadius={12} />
          <SkeletonLoader width="100%" height={200} borderRadius={12} />
        </View>
      ) : !summary || summary.members.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No family members"
          subtitle="Add contacts to see family activity overview"
          actionLabel="Add Contacts"
          onAction={() => router.back()}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.base, paddingBottom: Platform.OS === "web" ? 120 : 80 }}>
          <View style={styles.statsRow}>
            <StatCard label="Total Tracked" value={String(summary.totalContacts)} icon="people" color={colors.primary} />
            <StatCard label="Online Now" value={String(summary.onlineNow)} icon="radio-button-on" color={colors.online} />
          </View>

          <StatCard
            label="Family WhatsApp Time Today"
            value={formatDuration(summary.totalMinutesToday)}
            icon="hourglass"
            color={colors.blue}
          />

          <View>
            <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
              Family Members
            </Text>
            {summary.members.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/contact/${member.id}`)}
              >
                <AvatarCircle name={member.name} size={48} isOnline={member.isOnline} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.text }]}>{member.name}</Text>
                  <Text style={[typography.caption, { color: colors.secondaryText }]}>
                    {member.isOnline ? "Online now" : `${formatDuration(member.minutesToday)} today`}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: member.isOnline ? colors.online : colors.offline },
                    ]}
                  />
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginTop: 4 }} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.base, paddingBottom: spacing.base },
  btn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
