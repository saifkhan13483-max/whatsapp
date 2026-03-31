import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { AvatarCircle } from "./AvatarCircle";
import { BadgeCount } from "./BadgeCount";
import { useColors } from "@/hooks/useColors";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatTimeLabel } from "@/lib/formatters";

export interface Conversation {
  id: number;
  contactId: number;
  contactName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline?: boolean;
}

interface Props {
  conversation: Conversation;
  onPress: () => void;
}

export function ConversationRow({ conversation, onPress }: Props) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <AvatarCircle name={conversation.contactName} size={50} isOnline={conversation.isOnline} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {conversation.contactName}
          </Text>
          <Text style={[typography.caption, { color: colors.secondaryText }]}>
            {formatTimeLabel(conversation.lastMessageTime)}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={[typography.caption, { color: colors.secondaryText, flex: 1 }]} numberOfLines={1}>
            {conversation.lastMessage}
          </Text>
          {conversation.unreadCount > 0 && (
            <BadgeCount count={conversation.unreadCount} color={colors.primary} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  content: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  bottomRow: { flexDirection: "row", alignItems: "center" },
});
