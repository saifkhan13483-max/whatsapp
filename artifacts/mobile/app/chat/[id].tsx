import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";

import { useColors } from "@/hooks/useColors";
import { useContact } from "@/hooks/useContacts";
import { useKeywordAlerts } from "@/hooks/useKeywordAlerts";
import { apiFetch } from "@/lib/api";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { PulsingDot } from "@/components/ui/PulsingDot";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

interface Message {
  id: number;
  content: string;
  direction: "sent" | "received";
  timestamp: string;
  type: "text" | "image" | "video" | "voice";
  isDeleted?: boolean;
  isViewOnce?: boolean;
}

type ListItem =
  | { type: "message"; data: Message }
  | { type: "separator"; label: string };

function dateSeparatorLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMMM d, yyyy");
  } catch {
    return "";
  }
}

function insertDateSeparators(messages: Message[]): ListItem[] {
  const result: ListItem[] = [];
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  let lastDateStr = "";
  for (const msg of sorted) {
    try {
      const dateKey = format(new Date(msg.timestamp), "yyyy-MM-dd");
      if (dateKey !== lastDateStr) {
        result.push({
          type: "separator",
          label: dateSeparatorLabel(msg.timestamp),
        });
        lastDateStr = dateKey;
      }
    } catch {}
    result.push({ type: "message", data: msg });
  }
  return result.reverse();
}

function highlightKeywords(
  text: string,
  keywords: string[],
  textColor: string,
  highlightBg: string
) {
  if (!keywords.length) {
    return <Text style={{ color: textColor }}>{text}</Text>;
  }
  const pattern = keywords
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        const isKeyword = keywords.some(
          (k) => k.toLowerCase() === part.toLowerCase()
        );
        return (
          <Text
            key={i}
            style={{
              color: textColor,
              backgroundColor: isKeyword ? highlightBg : "transparent",
              borderRadius: isKeyword ? 3 : 0,
            }}
          >
            {part}
          </Text>
        );
      })}
    </>
  );
}

export default function ChatViewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contactId = parseInt(id ?? "0", 10);

  const { data: contact } = useContact(contactId);
  const { data: kwAlerts = [] } = useKeywordAlerts();
  const keywords = kwAlerts.map((k: any) => k.keyword ?? k.word ?? "").filter(Boolean);

  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["messages", contactId],
    queryFn: ({ pageParam = 1 }) =>
      apiFetch<Message[]>(
        `/messages/${contactId}?page=${pageParam}&limit=30`
      ).catch(() => []),
    initialPageParam: 1,
    getNextPageParam: (last, all) =>
      last.length === 30 ? all.length + 1 : undefined,
  });

  const allMessages = data?.pages.flat() ?? [];

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return allMessages;
    return allMessages.filter((m) =>
      m.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allMessages, searchQuery]);

  const listItems = useMemo(
    () => insertDateSeparators(filteredMessages),
    [filteredMessages]
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isOnline = (contact as any)?.isOnline;

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "separator") {
        return (
          <View style={styles.separatorWrap}>
            <View
              style={[
                styles.separatorPill,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[typography.small, { color: colors.secondaryText }]}>
                {item.label}
              </Text>
            </View>
          </View>
        );
      }

      const msg = item.data;
      const isSent = msg.direction === "sent";

      if (msg.isDeleted) {
        return (
          <View style={[styles.msgRow, isSent ? styles.sentRow : styles.receivedRow]}>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: isSent ? colors.primary + "80" : colors.card,
                  borderColor: colors.border,
                  borderStyle: "dashed",
                },
              ]}
            >
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.danger,
                    fontStyle: "italic",
                  },
                ]}
              >
                This message was deleted
              </Text>
            </View>
          </View>
        );
      }

      if (msg.isViewOnce) {
        return (
          <View style={[styles.msgRow, isSent ? styles.sentRow : styles.receivedRow]}>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: isSent ? "#005c4b" : colors.card,
                  borderColor: colors.purple,
                  borderWidth: 2,
                },
              ]}
            >
              <View style={styles.viewOnceBadge}>
                <Ionicons name="eye-off" size={14} color={colors.purple} />
                <Text style={[typography.small, { color: colors.purple }]}>
                  View Once — Recovered
                </Text>
              </View>
              <Text
                style={[
                  typography.caption,
                  { color: isSent ? "#B2DFDB" : colors.secondaryText, alignSelf: "flex-end" },
                ]}
              >
                {format(new Date(msg.timestamp), "HH:mm")}
              </Text>
            </View>
          </View>
        );
      }

      const hasKeywordMatch =
        keywords.length > 0 &&
        keywords.some((k) =>
          msg.content?.toLowerCase().includes(k.toLowerCase())
        );

      return (
        <View
          style={[styles.msgRow, isSent ? styles.sentRow : styles.receivedRow]}
        >
          {hasKeywordMatch && (
            <Ionicons
              name="alert-circle"
              size={16}
              color={colors.warning}
              style={{ alignSelf: "flex-end", marginBottom: 4, marginHorizontal: 4 }}
            />
          )}
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: isSent
                  ? colors.primary
                  : colors.card,
                borderColor: hasKeywordMatch ? colors.warning : colors.border,
                borderWidth: hasKeywordMatch ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text style={{ color: isSent ? colors.headerText : colors.text, fontSize: 15, lineHeight: 21 }}>
              {highlightKeywords(
                msg.content ?? "",
                keywords,
                isSent ? colors.headerText : colors.text,
                colors.warning + "60"
              )}
            </Text>
            <Text
              style={[
                typography.small,
                {
                  color: isSent ? colors.headerText + "B3" : colors.secondaryText,
                  alignSelf: "flex-end",
                  marginTop: 2,
                },
              ]}
            >
              {format(new Date(msg.timestamp), "HH:mm")}
            </Text>
          </View>
        </View>
      );
    },
    [colors, keywords]
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.primaryDarkest,
            borderBottomColor: colors.border,
            paddingTop: topPad,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (searchMode) {
              setSearchMode(false);
              setSearchQuery("");
            } else {
              router.back();
            }
          }}
          style={styles.btn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.headerText} />
        </TouchableOpacity>

        {!searchMode && (
          <>
            {contact ? (
              <AvatarCircle name={contact.name} size={36} isOnline={isOnline} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text
                style={[typography.bodyMedium, { color: colors.headerText }]}
                numberOfLines={1}
              >
                {contact?.name ?? "Chat"}
              </Text>
              <View style={styles.statusRow}>
                {isOnline && <PulsingDot size={6} />}
                <Text
                  style={[
                    typography.small,
                    { color: isOnline ? colors.primary : colors.headerText + "90" },
                  ]}
                >
                  {isOnline ? "online" : "last seen recently"}
                </Text>
              </View>
            </View>
          </>
        )}

        {searchMode && (
          <TextInput
            autoFocus
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search in chat..."
            placeholderTextColor={colors.headerText + "70"}
            style={[
              styles.searchInput,
              { color: colors.headerText, borderBottomColor: colors.headerText + "50" },
            ]}
          />
        )}

        <TouchableOpacity
          onPress={() => {
            setSearchMode((v) => !v);
            if (searchMode) setSearchQuery("");
          }}
          style={styles.btn}
          accessibilityLabel="Search messages"
          accessibilityRole="button"
        >
          <Ionicons
            name={searchMode ? "close" : "search"}
            size={22}
            color={colors.headerText}
          />
        </TouchableOpacity>

        {!searchMode && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.push(`/contact/${contactId}` as any)}
            accessibilityLabel="View contact details"
            accessibilityRole="button"
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={colors.headerText}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={{ padding: spacing.base, gap: spacing.md }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View
              key={i}
              style={{ alignItems: i % 2 === 0 ? "flex-end" : "flex-start" }}
            >
              <SkeletonLoader
                width={180 + (i % 3) * 40}
                height={52}
                borderRadius={16}
              />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={listItems}
          inverted
          keyExtractor={(item, idx) =>
            item.type === "separator" ? `sep-${idx}` : String(item.data.id)
          }
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: spacing.xl,
          }}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  btn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  separatorWrap: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  separatorPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
    alignItems: "flex-end",
  },
  sentRow: { justifyContent: "flex-end" },
  receivedRow: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  viewOnceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
});
