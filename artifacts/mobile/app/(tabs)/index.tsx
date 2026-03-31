import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/hooks/useColors";
import { useContacts, useFavoriteContacts } from "@/hooks/useContacts";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/providers/AuthProvider";
import { StatCard } from "@/components/ui/StatCard";
import { ContactCard } from "@/components/ui/ContactCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { BadgeCount } from "@/components/ui/BadgeCount";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useAuth();

  const { data: contacts = [], isLoading: loadingContacts, refetch } = useContacts();
  const { data: notifications = [] } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);

  const onlineContacts = contacts.filter((c) => (c as any).isOnline);
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#075E54", "#128C7E"]}
        style={[styles.header, { paddingTop: topPad + spacing.sm }]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.75)" }]}>
              Welcome back
            </Text>
            <Text style={[typography.h3, { color: "#fff" }]}>
              {user?.username ?? "WaTracker"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.iconBtn, { position: "relative" }]}
              onPress={() => router.push("/(tabs)/notifications")}
            >
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              {unreadCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: colors.danger }]}>
                  <BadgeCount count={unreadCount} />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/family-dashboard")}
            >
              <Ionicons name="people-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.miniStat}>
            <Text style={[typography.h2, { color: "#fff" }]}>{contacts.length}</Text>
            <Text style={[typography.small, { color: "rgba(255,255,255,0.75)" }]}>Tracked</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.miniStat}>
            <Text style={[typography.h2, { color: "#fff" }]}>{onlineContacts.length}</Text>
            <Text style={[typography.small, { color: "rgba(255,255,255,0.75)" }]}>Online Now</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.miniStat}>
            <Text style={[typography.h2, { color: "#fff" }]}>{unreadCount}</Text>
            <Text style={[typography.small, { color: "rgba(255,255,255,0.75)" }]}>Unread Alerts</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 80, gap: spacing.base }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {onlineContacts.length > 0 && (
          <View style={{ marginTop: spacing.base }}>
            <SectionHeader title="Online Now" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.onlineRow}>
              {onlineContacts.slice(0, 10).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.onlineChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/contact/${c.id}`)}
                >
                  <View style={[styles.onlineDot, { backgroundColor: colors.online }]} />
                  <Text style={[typography.caption, { color: colors.text }]} numberOfLines={1}>
                    {c.name.split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View>
          <SectionHeader
            title="All Contacts"
            actionLabel="Add"
            onAction={() => router.push("/contact/new")}
          />
          <View style={{ paddingHorizontal: spacing.base, gap: spacing.sm }}>
            {loadingContacts ? (
              Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLoader key={i} width="100%" height={72} borderRadius={12} />
              ))
            ) : contacts.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="person-add-outline" size={36} color={colors.muted} />
                <Text style={[typography.bodyMedium, { color: colors.text, marginTop: spacing.sm }]}>
                  No contacts tracked
                </Text>
                <Text style={[typography.caption, { color: colors.secondaryText, textAlign: "center" }]}>
                  Add contacts to start monitoring their WhatsApp activity
                </Text>
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/auth")}
                >
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                    Get Started
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              contacts.map((c) => (
                <ContactCard
                  key={c.id}
                  contact={c as any}
                  onPress={() => router.push(`/contact/${c.id}`)}
                />
              ))
            )}
          </View>
        </View>

        <View>
          <SectionHeader
            title="Quick Actions"
          />
          <View style={styles.actionsGrid}>
            {[
              { icon: "bar-chart" as const, label: "Reports", route: "/reports" },
              { icon: "shield-checkmark" as const, label: "Keywords", route: "/keyword-alerts" },
              { icon: "people" as const, label: "Groups", route: "/contact-groups" },
              { icon: "diamond" as const, label: "Upgrade", route: "/subscription" },
            ].map((a) => (
              <TouchableOpacity
                key={a.label}
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(a.route as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + "15" }]}>
                  <Ionicons name={a.icon} size={22} color={colors.primary} />
                </View>
                <Text style={[typography.caption, { color: colors.text, marginTop: 6 }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.base,
  },
  headerRight: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  notifBadge: { position: "absolute", top: 4, right: 4, borderRadius: 8 },
  statsRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: spacing.base },
  miniStat: { flex: 1, alignItems: "center" },
  divider: { width: 1, backgroundColor: "rgba(255,255,255,0.3)" },
  onlineRow: { paddingHorizontal: spacing.base, gap: spacing.sm },
  onlineChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 24, borderWidth: 1, gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  emptyCard: { padding: spacing.xl, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: spacing.sm },
  addBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: 8 },
  actionsGrid: { flexDirection: "row", paddingHorizontal: spacing.base, gap: spacing.sm },
  actionCard: { flex: 1, alignItems: "center", padding: spacing.base, borderRadius: 12, borderWidth: 1 },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
