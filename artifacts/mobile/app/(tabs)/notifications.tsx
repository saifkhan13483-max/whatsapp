import React, { useState } from "react";
import { View, FlatList, StyleSheet, TouchableOpacity, Text, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useNotifications, useMarkRead, useMarkAllRead, useClearNotifications } from "@/hooks/useNotifications";
import { NotificationRow } from "@/components/ui/NotificationRow";
import { ChipFilter } from "@/components/ui/ChipFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { GradientHeader } from "@/components/ui/GradientHeader";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Online", value: "online" },
  { label: "Offline", value: "offline" },
  { label: "Keyword", value: "keyword" },
  { label: "Report", value: "report" },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState("");

  const { data: notifications = [], isLoading } = useNotifications(filter);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const clearAll = useClearNotifications();

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleMarkAll() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllRead.mutate();
  }

  async function handleClear() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearAll.mutate();
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Alerts"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        rightAction={
          unreadCount > 0
            ? { icon: "checkmark-done", onPress: handleMarkAll }
            : { icon: "trash-outline", onPress: handleClear }
        }
      />
      <ChipFilter options={FILTERS} selected={filter} onSelect={setFilter} />

      {isLoading ? (
        <View style={{ padding: spacing.base, gap: spacing.sm }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={80} borderRadius={12} />
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState icon="notifications-off-outline" title="No alerts" subtitle="You're all caught up" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: spacing.base, gap: spacing.sm, paddingBottom: Platform.OS === "web" ? 120 : 80 }}
          renderItem={({ item }) => (
            <NotificationRow
              notification={item}
              onPress={() => {
                if (!item.read) markRead.mutate(item.id);
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
