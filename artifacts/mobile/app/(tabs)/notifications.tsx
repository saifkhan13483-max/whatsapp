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
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { isToday, isYesterday, isThisWeek } from "date-fns";

import { useColors } from "@/hooks/useColors";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useClearNotifications,
} from "@/hooks/useNotifications";
import { AppNotification } from "@/components/ui/NotificationRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { SwipeableRow } from "@/components/ui/SwipeableRow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatRelativeTime } from "@/lib/formatters";

const FILTERS = [
  { label: "All", value: "", icon: "notifications" },
  { label: "Online", value: "online", icon: "radio-button-on" },
  { label: "Late Night", value: "late_night", icon: "moon" },
  { label: "Limit", value: "limit_exceeded", icon: "time" },
  { label: "Keyword", value: "keyword", icon: "alert-circle" },
  { label: "System", value: "system", icon: "settings" },
];

type Section = { title: string; data: AppNotification[] };

function groupNotifications(notifications: AppNotification[]): Section[] {
  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const thisWeek: AppNotification[] = [];
  const older: AppNotification[] = [];

  for (const n of notifications) {
    const d = new Date(n.createdAt ?? Date.now());
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

function typeIconConfig(type: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case "online": return { name: "radio-button-on", color: "#25D366" };
    case "offline": return { name: "radio-button-off", color: "#8696A0" };
    case "late_night": return { name: "moon", color: "#7C4DFF" };
    case "limit_exceeded": return { name: "timer", color: "#FF9500" };
    case "keyword": return { name: "warning", color: "#FFC107" };
    case "system": return { name: "settings", color: "#34B7F1" };
    default: return { name: "notifications", color: "#25D366" };
  }
}

function NotificationCard({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const colors = useColors();
  const ic = typeIconConfig(notification.type);
  const unread = !notification.read;

  return (
    <TouchableOpacity
      style={[
        styles.notifCard,
        {
          backgroundColor: unread ? colors.primary + "0d" : colors.card,
          borderColor: unread ? colors.primary + "30" : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityLabel={`${notification.title}: ${notification.body}`}
      accessibilityRole="button"
    >
      <View style={[styles.notifIcon, { backgroundColor: ic.color + "20" }]}>
        <Ionicons name={ic.name} size={20} color={ic.color} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifTopRow}>
          <Text
            style={[
              typography.labelBold,
              { color: colors.text, flex: 1, fontFamily: unread ? "Inter_600SemiBold" : "Inter_500Medium" },
            ]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text style={[typography.small, { color: unread ? colors.primary : colors.muted }]}>
            {formatRelativeTime(notification.createdAt)}
          </Text>
        </View>
        <Text
          style={[typography.caption, { color: colors.secondaryText, lineHeight: 18 }]}
          numberOfLines={2}
        >
          {notification.body}
        </Text>
        {notification.contactName && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
            <Ionicons name="person" size={11} color={colors.muted} />
            <Text style={[typography.small, { color: colors.muted }]}>{notification.contactName}</Text>
          </View>
        )}
      </View>
      {unread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState("");
  const [clearDialogVisible, setClearDialogVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    data: notifications = [],
    isLoading,
    refetch,
    isRefetching,
  } = useNotifications(filter);

  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const clearAll = useClearNotifications();

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const sections = useMemo(() => groupNotifications(notifications), [notifications]);

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
        <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.xs }}>
          <NotificationCard notification={item} onPress={() => handleMarkRead(item)} />
        </View>
      </SwipeableRow>
    ),
    [colors.primary, handleMarkRead]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
        <Text
          style={[
            typography.caption,
            { color: colors.secondaryText, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
          ]}
        >
          {section.title.toUpperCase()}
        </Text>
        <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
      </View>
    ),
    [colors]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primaryDarkest, colors.primaryDark] as string[]}
        style={[styles.header, { paddingTop: topPad + spacing.sm }]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: "#fff" }]}>Alerts</Text>
            <Text style={[typography.small, { color: "rgba(255,255,255,0.7)" }]}>
              {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={handleMarkAll}
                style={[styles.actionBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
                accessibilityLabel="Mark all as read"
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-done" size={16} color="#fff" />
                <Text style={[typography.small, { color: "#fff", fontFamily: "Inter_600SemiBold" }]}>
                  Mark All
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleClearAll}
              style={styles.iconBtn}
              accessibilityLabel="Clear all notifications"
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Unread summary pill */}
        {unreadCount > 0 && (
          <View style={[styles.summaryPill, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <View style={[styles.summaryDot, { backgroundColor: colors.danger }]} />
            <Text style={[typography.small, { color: "#fff" }]}>
              You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* Filter chips */}
      <View style={[styles.chipRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.chip,
                {
                  borderColor: active ? colors.primary : "transparent",
                  backgroundColor: active ? colors.primary + "12" : "transparent",
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f.value);
              }}
            >
              <Ionicons name={f.icon as any} size={12} color={active ? colors.primary : colors.secondaryText} />
              <Text
                style={[
                  typography.small,
                  { color: active ? colors.primary : colors.secondaryText, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{ padding: spacing.base, gap: spacing.sm }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={84} borderRadius={12} />
          ))}
        </View>
      ) : sections.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="All caught up"
          subtitle={filter ? "No alerts match this filter" : "New alerts will appear here when triggered"}
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
            paddingTop: spacing.xs,
            paddingBottom: Platform.OS === "web" ? 120 : 80,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ConfirmDialog
        visible={clearDialogVisible}
        title="Clear All Alerts"
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
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.base,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.md,
  },
  notifIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
});
