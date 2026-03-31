import React, { useState } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useContact } from "@/hooks/useContacts";
import { apiFetch } from "@/lib/api";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatRelativeTime } from "@/lib/formatters";

interface Message {
  id: number;
  content: string;
  direction: "sent" | "received";
  timestamp: string;
  type: "text" | "image" | "video";
}

export default function ChatViewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contactId = parseInt(id ?? "0", 10);

  const { data: contact } = useContact(contactId);

  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["messages", contactId],
    queryFn: ({ pageParam = 1 }) =>
      apiFetch<Message[]>(`/messages/${contactId}?page=${pageParam}&limit=30`).catch(() => []),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.length === 30 ? all.length + 1 : undefined),
  });

  const messages = data?.pages.flat() ?? [];

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        {contact && <AvatarCircle name={contact.name} size={36} isOnline={(contact as any).isOnline} />}
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyMedium, { color: colors.text }]} numberOfLines={1}>
            {contact?.name ?? "Chat"}
          </Text>
          <Text style={[typography.small, { color: colors.secondaryText }]}>
            {(contact as any)?.isOnline ? "Online" : "Tap for info"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push(`/contact/${contactId}`)}
        >
          <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.base }}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => {
            const isSent = item.direction === "sent";
            return (
              <View style={[styles.msgRow, isSent ? styles.sentRow : styles.receivedRow]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isSent ? colors.primary : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[typography.body, { color: isSent ? "#fff" : colors.text }]}>
                    {item.content}
                  </Text>
                  <Text
                    style={[
                      typography.small,
                      { color: isSent ? "rgba(255,255,255,0.7)" : colors.secondaryText, alignSelf: "flex-end" },
                    ]}
                  >
                    {formatRelativeTime(item.timestamp)}
                  </Text>
                </View>
              </View>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  btn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  msgRow: { flexDirection: "row" },
  sentRow: { justifyContent: "flex-end" },
  receivedRow: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
});
