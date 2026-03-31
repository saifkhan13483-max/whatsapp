import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AvatarCircle } from "./AvatarCircle";
import { PulsingDot } from "./PulsingDot";
import { SparklineChart } from "./SparklineChart";

export interface FamilyMember {
  id: number;
  name: string;
  phoneNumber: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen?: string;
  totalOnlineToday: number;
  sessionsToday: number;
  weeklyData: number[];
}

interface Props {
  member: FamilyMember;
  onPress?: () => void;
}

export function FamilyMemberCard({ member, onPress }: Props) {
  const colors = useColors();
  const hrs = Math.floor(member.totalOnlineToday / 60);
  const mins = member.totalOnlineToday % 60;
  const timeLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <AvatarCircle name={member.name} size={44} />
          {member.isOnline && (
            <View style={styles.dotWrap}>
              <PulsingDot color={colors.online} size={10} />
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{member.name}</Text>
          <Text style={[styles.status, { color: member.isOnline ? colors.online : colors.secondaryText }]}>
            {member.isOnline ? "Online now" : member.lastSeen ?? "Offline"}
          </Text>
        </View>
        <SparklineChart data={member.weeklyData} width={60} height={28} color={colors.primary} />
      </View>
      <View style={[styles.stats, { borderTopColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: colors.primary }]}>{timeLabel}</Text>
          <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Online today</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: colors.blue }]}>{member.sessionsToday}</Text>
          <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Sessions</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  dotWrap: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  status: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  stats: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  statVal: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  divider: {
    width: 1,
    marginVertical: 8,
  },
});
