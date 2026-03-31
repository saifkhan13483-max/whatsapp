import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AvatarCircle } from "./AvatarCircle";
import { useColors } from "@/hooks/useColors";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatRelativeTime } from "@/lib/formatters";

export interface Contact {
  id: number;
  name: string;
  phoneNumber: string;
  notes?: string;
  alertEnabled: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  sessionCount?: number;
}

interface Props {
  contact: Contact;
  onPress: () => void;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
}

export function ContactCard({ contact, onPress, isFavorite, onFavoriteToggle }: Props) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <AvatarCircle name={contact.name} isOnline={contact.isOnline} />
      <View style={styles.info}>
        <Text style={[typography.bodyMedium, { color: colors.text }]} numberOfLines={1}>
          {contact.name}
        </Text>
        <Text style={[typography.caption, { color: colors.secondaryText }]} numberOfLines={1}>
          {contact.isOnline
            ? "Online now"
            : contact.lastSeen
            ? `Last seen ${formatRelativeTime(contact.lastSeen)}`
            : contact.phoneNumber}
        </Text>
      </View>
      <View style={styles.right}>
        {contact.alertEnabled && (
          <Ionicons name="notifications" size={14} color={colors.warning} style={{ marginBottom: 4 }} />
        )}
        {onFavoriteToggle && (
          <TouchableOpacity onPress={onFavoriteToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={isFavorite ? "star" : "star-outline"}
              size={18}
              color={isFavorite ? colors.warning : colors.muted}
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: "center",
    gap: 2,
  },
});
