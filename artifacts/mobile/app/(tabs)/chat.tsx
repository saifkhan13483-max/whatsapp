import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Alert,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { SwipeableRow } from "@/components/ui/SwipeableRow";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { BadgeCount } from "@/components/ui/BadgeCount";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatTimeLabel } from "@/lib/formatters";

interface Chat {
  chatJid: string;
  lastMessage: string | null;
  lastMessageType: string | null;
  lastMessageTime: string;
  isViewOnce: boolean;
  fromMe: boolean;
  senderName: string | null;
}

function chatDisplayName(chat: Chat): string {
  if (chat.senderName) return chat.senderName;
  return chat.chatJid.split("@")[0] ?? chat.chatJid;
}

const FILTERS = [
  { label: "All", value: "all", icon: "chatbubbles" },
  { label: "View-Once", value: "viewonce", icon: "eye" },
  { label: "Has Media", value: "media", icon: "image" },
  { label: "From Me", value: "fromme", icon: "arrow-up-circle" },
];

function ConversationItem({
  conversation,
  privacyMode,
  onPress,
}: {
  conversation: Chat;
  privacyMode: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const displayName = chatDisplayName(conversation);

  return (
    <TouchableOpacity
      style={[
        styles.convRow,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Conversation with ${displayName}`}
      accessibilityRole="button"
    >
      <AvatarCircle name={displayName} size={52} isOnline={false} />
      <View style={styles.convContent}>
        <View style={styles.convTopRow}>
          <Text
            style={[
              typography.bodyMedium,
              { color: colors.text, flex: 1, fontFamily: "Inter_500Medium" },
            ]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text style={[typography.small, { color: colors.secondaryText }]}>
            {formatTimeLabel(conversation.lastMessageTime)}
          </Text>
        </View>
        <View style={styles.convBottomRow}>
          {privacyMode ? (
            <View style={[styles.blurredPreview, { backgroundColor: colors.border }]} />
          ) : (
            <Text
              style={[
                typography.caption,
                { color: colors.secondaryText, flex: 1, fontFamily: "Inter_400Regular" },
              ]}
              numberOfLines={1}
            >
              {conversation.fromMe ? "You: " : ""}
              {conversation.isViewOnce
                ? "📷 View-once media"
                : conversation.lastMessage || "No messages yet"}
            </Text>
          )}
          {conversation.isViewOnce && (
            <BadgeCount count={1} color={colors.purple ?? colors.primary} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatTrackerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    data: conversations = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Chat[]>({
    queryKey: ["chats"],
    queryFn: () => apiFetch<Chat[]>("/chats").catch(() => []),
    refetchInterval: 30000,
  });

  const totalViewOnce = useMemo(
    () => conversations.filter((c) => c.isViewOnce).length,
    [conversations]
  );

  const filtered = useMemo(
    () =>
      conversations.filter((c) => {
        const q = query.toLowerCase();
        const displayName = chatDisplayName(c);
        const matchesSearch =
          displayName.toLowerCase().includes(q) ||
          (c.lastMessage ?? "").toLowerCase().includes(q) ||
          c.chatJid.toLowerCase().includes(q);
        if (!matchesSearch) return false;
        if (activeFilter === "viewonce") return c.isViewOnce;
        if (activeFilter === "media")
          return (
            c.lastMessageType !== null &&
            c.lastMessageType !== "conversation" &&
            c.lastMessageType !== "extendedTextMessage"
          );
        if (activeFilter === "fromme") return c.fromMe;
        return true;
      }),
    [conversations, query, activeFilter]
  );

  const togglePrivacy = useCallback(async () => {
    await Haptics.selectionAsync();
    setPrivacyMode((v) => !v);
  }, []);

  const handleMute = useCallback((item: Chat) => {
    const name = chatDisplayName(item);
    Alert.alert(`Mute ${name}`, "Silence alerts for this conversation?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mute",
        onPress: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      },
    ]);
  }, []);

  const handleArchive = useCallback((item: Chat) => {
    const name = chatDisplayName(item);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(`Archive ${name}`, "Move this conversation to archive?", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", onPress: () => {} },
    ]);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Chat }) => (
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
        <ConversationItem
          conversation={item}
          privacyMode={privacyMode}
          onPress={() =>
            router.push(`/chat/${encodeURIComponent(item.chatJid)}` as any)
          }
        />
      </SwipeableRow>
    ),
    [privacyMode, handleMute, handleArchive]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primaryDarkest, colors.primaryDark] as [string, string]}
        style={[styles.header, { paddingTop: topPad + spacing.sm }]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: "#fff" }]}>Chat Tracker</Text>
            {totalViewOnce > 0 && (
              <Text style={[typography.small, { color: "rgba(255,255,255,0.75)" }]}>
                {totalViewOnce} view-once media recovered
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={togglePrivacy}
            style={[
              styles.iconBtn,
              privacyMode && { backgroundColor: colors.warning + "30" },
            ]}
            accessibilityLabel={privacyMode ? "Disable privacy mode" : "Enable privacy mode"}
            accessibilityRole="button"
          >
            <Feather
              name={privacyMode ? "eye-off" : "eye"}
              size={21}
              color={privacyMode ? colors.warning : "#fff"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterSheetOpen(true)}
            style={styles.iconBtn}
            accessibilityLabel="Filter conversations"
            accessibilityRole="button"
          >
            <Feather name="filter" size={21} color="#fff" />
            {activeFilter !== "all" && (
              <View style={[styles.filterDot, { backgroundColor: colors.warning }]} />
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.7)" />
          <TextInput
            style={[styles.searchInput, { color: "#fff" }]}
            placeholder="Search by name or message..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Filter chips */}
      <View style={[styles.chipRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {FILTERS.map((f) => {
          const active = activeFilter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.chip,
                { borderColor: active ? colors.primary : "transparent" },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(f.value);
              }}
              accessibilityLabel={`Filter ${f.label}`}
              accessibilityRole="button"
            >
              <Ionicons
                name={f.icon as any}
                size={13}
                color={active ? colors.primary : colors.secondaryText}
              />
              <Text
                style={[
                  typography.caption,
                  { color: active ? colors.primary : colors.secondaryText, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Privacy mode banner */}
      {privacyMode && (
        <View
          style={[
            styles.privacyBanner,
            { backgroundColor: colors.warning + "18", borderColor: colors.warning + "50" },
          ]}
        >
          <Ionicons name="eye-off" size={14} color={colors.warning} />
          <Text style={[typography.small, { color: colors.warning, flex: 1 }]}>
            Privacy mode on — message previews are hidden
          </Text>
          <TouchableOpacity onPress={togglePrivacy}>
            <Text style={[typography.small, { color: colors.warning, fontFamily: "Inter_600SemiBold" }]}>
              Turn Off
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={{ gap: 1, padding: 0 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={76} borderRadius={0} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={query ? "No results found" : conversations.length === 0 ? "No chats yet" : "No chats match"}
          subtitle={
            query
              ? `No chats matching "${query}"`
              : conversations.length === 0
              ? "Messages captured from your linked WhatsApp will appear here"
              : "Try a different filter or search term"
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.chatJid}
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
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 80 }} />
          )}
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
                  backgroundColor: activeFilter === f.value ? colors.primary + "12" : colors.card,
                  borderColor: activeFilter === f.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(f.value);
                setFilterSheetOpen(false);
              }}
            >
              <View style={[styles.filterOptionIcon, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons
                  name={f.icon as any}
                  size={18}
                  color={activeFilter === f.value ? colors.primary : colors.secondaryText}
                />
              </View>
              <Text
                style={[
                  typography.bodyMedium,
                  { color: activeFilter === f.value ? colors.primary : colors.text, flex: 1 },
                ]}
              >
                {f.label}
              </Text>
              {activeFilter === f.value && (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
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
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 20,
    paddingHorizontal: spacing.base,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  chipRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  privacyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
  },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  convContent: { flex: 1, gap: 2 },
  convTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
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
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
