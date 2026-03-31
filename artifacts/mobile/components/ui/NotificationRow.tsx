import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatRelativeTime } from "@/lib/formatters";

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  contactName?: string;
}

interface Props {
  notification: AppNotification;
  onPress: () => void;
}

function iconForType(type: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case "online": return { name: "radio-button-on", color: "#25D366" };
    case "offline": return { name: "radio-button-off", color: "#8696A0" };
    case "keyword": return { name: "warning", color: "#FFC107" };
    case "report": return { name: "document-text", color: "#34B7F1" };
    default: return { name: "notifications", color: "#7C4DFF" };
  }
}

export function NotificationRow({ notification, onPress }: Props) {
  const colors = useColors();
  const ic = iconForType(notification.type);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: notification.read ? colors.card : colors.primary + "14", borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.iconWrap, { backgroundColor: ic.color + "20" }]}>
        <Ionicons name={ic.name} size={20} color={ic.color} />
      </View>
      <View style={styles.content}>
        <Text style={[typography.labelBold, { color: colors.text }]} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={[typography.caption, { color: colors.secondaryText }]} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={[typography.small, { color: colors.muted, marginTop: 2 }]}>
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </View>
      {!notification.read && (
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
});
