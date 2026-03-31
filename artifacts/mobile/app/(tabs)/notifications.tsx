import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { isToday, isYesterday, isThisWeek } from "date-fns";

import { useColors } from "@/hooks/useColors";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useClearNotifications,
} from "@/hooks/useNotifications";
import { AppNotification, NotificationRow } from "@/components/ui/NotificationRow";
import { ChipFilter } from "@/components/ui/ChipFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { SwipeableRow } from "@/components/ui/SwipeableRow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Online", value: "online" },
  { label: "Late Night", value: "late_night" },
  { label: "Limit Exceeded", value: "limit_exceeded" },
  { label: "Keyword", value: "keyword" },
  { label: "System", value: "system" },
];

type Section = { title: string; data: AppNotification[] };

function groupNotifications(notifications: AppNotification[]): Section[] {
  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const thisWeek: AppNotification[] = [];
  const older: AppNotification[] = [];

  for (const n of notifications) {
    const d = new Date(n.createdAt ?? n.timestamp ?? Date.now());
    if (isToday(d)) today.push(n);
    else if (isYesterday(d)) yesterday.push(n);
    else if (isThisWeek(d)) thisWeek.push(n);
    else older.push(n);
  }

  const sections: Section[] = [];
  if (today.length) sections.push({ title: "Today", data: today });
  if (yesterday.length) sections.push({ title: "Yesterday", data: yesterday });
  if (thisWeek.length) sections.push({ title: "This Week", data: thisWeek });
  if (older.length) sections.push({ title: "Older", data: older });
  return sections;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("");
  const [clearDialogVisible, setClearDialogVisible] = useState(false);

  const {
    data: notifications = [],
    isLoading,
    refetch,
    isRefetching,
  } = useNotifications(filter);

  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const clearAll = useClearNotifications();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const sections = useMemo(() => groupNotifications(notifications), [notifications]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleMarkAll = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllRead.mutate();
  }, [markAllRead]);

  const handleClearAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setClearDialogVisible(true);
  }, []);

  const handleMarkRead = useCallback(
    (item: AppNotification) => {
      if (!item.read) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        markRead.mutate(item.id);
      }
    },
    [markRead]
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <SwipeableRow
        leftActions={[
          {
            label: item.read ? "Unread" : "Read",
            icon: item.read ? "mail-unread-outline" : "checkmark-circle-outline",
            color: colors.primary,
            onPress: () => handleMarkRead(item),
          },
        ]}
      >
        <NotificationRow
          notification={item}
          onPress={() => handleMarkRead(item)}
        />
      </SwipeableRow>
    ),
    [colors.primary, handleMarkRead]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View
        style={[
          styles.sectionHeader,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={[typography.caption, { color: colors.secondaryText, fontFamily: "Inter_600SemiBold" }]}>
          {section.title.toUpperCase()}
        </Text>
      </View>
    ),
    [colors]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.primaryDarkest, paddingTop: topPad + spacing.sm },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[typography.h3, { color: colors.headerText }]}>Alerts</Text>
          <Text style={[typography.small, { color: colors.headerText + "90" }]}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAll}
            style={styles.headerBtn}
            accessibilityLabel="Mark all as read"
            accessibilityRole="button"
          >
            <Text style={[typography.caption, { color: colors.primary }]}>
              Mark all read
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleClearAll}
          style={styles.iconBtn}
          accessibilityLabel="Clear all notifications"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={22} color={colors.headerText} />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ChipFilter options={FILTERS} selected={filter} onSelect={setFilter} />

      {/* Content */}
      {isLoading ? (
        <View style={{ padding: spacing.base, gap: spacing.sm }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={80} borderRadius={12} />
          ))}
        </View>
      ) : sections.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="All caught up"
          subtitle="Your alerts will appear here"
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{
            paddingBottom: Platform.OS === "web" ? 120 : 80,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Clear all confirm */}
      <ConfirmDialog
        visible={clearDialogVisible}
        title="Clear All Notifications"
        message="This will permanently delete all notifications. This cannot be undone."
        confirmLabel="Clear All"
        destructive
        onConfirm={() => {
          clearAll.mutate();
          setClearDialogVisible(false);
        }}
        onCancel={() => setClearDialogVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  sectionHeader: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
});
