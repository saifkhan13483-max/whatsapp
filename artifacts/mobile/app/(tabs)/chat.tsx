import React, { useState, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Conversation } from "@/components/ui/ConversationRow";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { ChipFilter } from "@/components/ui/ChipFilter";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SwipeableRow } from "@/components/ui/SwipeableRow";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { BadgeCount } from "@/components/ui/BadgeCount";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatTimeLabel } from "@/lib/formatters";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Has Media", value: "media" },
  { label: "View-Once", value: "viewonce" },
];

function ConversationRowWithPrivacy({
  conversation,
  privacyMode,
  onPress,
}: {
  conversation: Conversation;
  privacyMode: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.convRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Conversation with ${conversation.contactName}`}
      accessibilityRole="button"
    >
      <AvatarCircle
        name={conversation.contactName}
        size={50}
        isOnline={conversation.isOnline}
      />
      <View style={styles.convContent}>
        <View style={styles.convTopRow}>
          <Text
            style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}
            numberOfLines={1}
          >
            {conversation.contactName}
          </Text>
          <Text style={[typography.caption, { color: colors.secondaryText }]}>
            {formatTimeLabel(conversation.lastMessageTime)}
          </Text>
        </View>
        <View style={styles.convBottomRow}>
          {privacyMode ? (
            <View style={[styles.blurredPreview, { backgroundColor: colors.border }]} />
          ) : (
            <Text
              style={[typography.caption, { color: colors.secondaryText, flex: 1 }]}
              numberOfLines={1}
            >
              {conversation.lastMessage}
            </Text>
          )}
          {(conversation.unreadCount ?? 0) > 0 && (
            <BadgeCount count={conversation.unreadCount} color={colors.primary} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatTrackerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const {
    data: conversations = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch<Conversation[]>("/conversations").catch(() => []),
  });

  const filtered = conversations.filter((c) => {
    const q = query.toLowerCase();
    const matchesSearch =
      c.contactName.toLowerCase().includes(q) ||
      (c.lastMessage ?? "").toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (activeFilter === "unread") return (c.unreadCount ?? 0) > 0;
    return true;
  });

  const togglePrivacy = useCallback(async () => {
    await Haptics.selectionAsync();
    setPrivacyMode((v) => !v);
  }, []);

  const handleMute = useCallback(
    (item: Conversation) => {
      Alert.alert("Mute alerts", `Mute all alerts for ${item.contactName}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute",
          onPress: () =>
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        },
      ]);
    },
    []
  );

  const handleArchive = useCallback((_item: Conversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <SwipeableRow
        leftActions={[
          {
            label: "Mute",
            icon: "notifications-off-outline",
            color: "#FFC107",
            onPress: () => handleMute(item),
          },
        ]}
        rightActions={[
          {
            label: "Archive",
            icon: "archive-outline",
            color: "#8696A0",
            onPress: () => handleArchive(item),
          },
        ]}
      >
        <ConversationRowWithPrivacy
          conversation={item}
          privacyMode={privacyMode}
          onPress={() => router.push(`/chat/${item.contactId}` as any)}
        />
      </SwipeableRow>
    ),
    [privacyMode, handleMute, handleArchive]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.primaryDarkest,
            paddingTop: topPad + spacing.sm,
          },
        ]}
      >
        <Text style={[typography.h3, { color: colors.headerText, flex: 1 }]}>
          Chat Tracker
        </Text>
        <TouchableOpacity
          onPress={togglePrivacy}
          style={styles.iconBtn}
          accessibilityLabel={privacyMode ? "Disable privacy mode" : "Enable privacy mode"}
          accessibilityRole="button"
        >
          <Feather
            name={privacyMode ? "eye-off" : "eye"}
            size={22}
            color={privacyMode ? colors.warning : colors.headerText}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilterSheetOpen(true)}
          style={styles.iconBtn}
          accessibilityLabel="Filter conversations"
          accessibilityRole="button"
        >
          <Feather name="filter" size={22} color={colors.headerText} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or message..."
      />

      {/* Filter chips */}
      <ChipFilter
        options={FILTERS}
        selected={activeFilter}
        onSelect={setActiveFilter}
      />

      {/* Privacy mode banner */}
      {privacyMode && (
        <View
          style={[
            styles.privacyBanner,
            { backgroundColor: colors.warning + "20", borderColor: colors.warning + "40" },
          ]}
        >
          <Ionicons name="eye-off" size={14} color={colors.warning} />
          <Text style={[typography.small, { color: colors.warning }]}>
            Privacy mode on — message previews hidden
          </Text>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={{ gap: 1 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={72} borderRadius={0} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No conversations"
          subtitle={
            query
              ? "No results for your search"
              : conversations.length === 0
              ? "Conversations will appear here when tracked"
              : "No conversations match this filter"
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
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

      {/* Filter bottom sheet */}
      <BottomSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filter Conversations"
      >
        <View style={{ gap: spacing.sm, paddingBottom: insets.bottom + spacing.base }}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.filterOption,
                {
                  backgroundColor:
                    activeFilter === f.value ? colors.primary + "15" : colors.card,
                  borderColor:
                    activeFilter === f.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(f.value);
                setFilterSheetOpen(false);
              }}
            >
              <Text
                style={[
                  typography.bodyMedium,
                  {
                    color:
                      activeFilter === f.value ? colors.primary : colors.text,
                  },
                ]}
              >
                {f.label}
              </Text>
              {activeFilter === f.value && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
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
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  privacyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.base,
    marginBottom: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
  },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    backgroundColor: "transparent",
  },
  convContent: { flex: 1 },
  convTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  convBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  blurredPreview: {
    flex: 1,
    height: 14,
    borderRadius: 6,
    opacity: 0.5,
  },
});
