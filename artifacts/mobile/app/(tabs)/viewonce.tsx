import React from "react";
import { View, FlatList, StyleSheet, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { GradientHeader } from "@/components/ui/GradientHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatRelativeTime } from "@/lib/formatters";

interface ViewOnceItem {
  id: number;
  contactName: string;
  type: "image" | "video";
  recoveredAt: string;
  fileSize?: string;
}

export default function ViewOnceScreen() {
  const colors = useColors();

  const { data: items = [], isLoading } = useQuery<ViewOnceItem[]>({
    queryKey: ["view-once"],
    queryFn: () => apiFetch<ViewOnceItem[]>("/view-once").catch(() => []),
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="View Once Recovery"
        subtitle="Recovered media items"
      />

      <View style={[styles.infoCard, { backgroundColor: colors.purple + "15", borderColor: colors.purple + "40" }]}>
        <Ionicons name="information-circle" size={20} color={colors.purple} />
        <Text style={[typography.caption, { color: colors.purple, flex: 1 }]}>
          View-once media is captured and stored before it disappears from WhatsApp.
        </Text>
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.base, gap: spacing.sm }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={72} borderRadius={12} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="eye-off-outline"
          title="No recovered media"
          subtitle="View-once images and videos from monitored contacts will appear here"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: spacing.base, gap: spacing.sm, paddingBottom: Platform.OS === "web" ? 120 : 80 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.mediaIcon, { backgroundColor: item.type === "image" ? colors.blue + "20" : colors.purple + "20" }]}>
                <Ionicons
                  name={item.type === "image" ? "image" : "videocam"}
                  size={24}
                  color={item.type === "image" ? colors.blue : colors.purple}
                />
              </View>
              <View style={styles.info}>
                <Text style={[typography.bodyMedium, { color: colors.text }]}>{item.contactName}</Text>
                <Text style={[typography.caption, { color: colors.secondaryText }]}>
                  {item.type === "image" ? "Image" : "Video"} • {formatRelativeTime(item.recoveredAt)}
                </Text>
              </View>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="download-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    margin: spacing.base,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.md,
  },
  mediaIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
