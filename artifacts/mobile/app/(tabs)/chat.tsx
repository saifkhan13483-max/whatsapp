import React, { useState } from "react";
import { View, FlatList, StyleSheet, Text, ActivityIndicator, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Conversation, ConversationRow } from "@/components/ui/ConversationRow";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { GradientHeader } from "@/components/ui/GradientHeader";
import { spacing } from "@/constants/spacing";

export default function ChatTrackerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch<Conversation[]>("/conversations").catch(() => []),
  });

  const filtered = conversations.filter((c) =>
    c.contactName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GradientHeader title="Chat Tracker" subtitle={`${conversations.length} conversations`} />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search conversations..." />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No conversations"
          subtitle="Track WhatsApp conversations to see them here"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => router.push(`/chat/${item.contactId}`)}
            />
          )}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
