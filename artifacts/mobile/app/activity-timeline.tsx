import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, subDays, addDays } from "date-fns";
import { useColors } from "@/constants/colors";
import { useActivityTimeline } from "@/hooks/useCompare";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { TimelineRow } from "@/components/ui/TimelineRow";
import { EmptyState } from "@/components/ui/EmptyState";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ActivityTimelineScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(new Date());
  const dateStr = format(date, "yyyy-MM-dd");
  const { data = [], isLoading } = useActivityTimeline(dateStr);
  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

  function prevDay() {
    setDate((d) => subDays(d, 1));
  }

  function nextDay() {
    if (!isToday) setDate((d) => addDays(d, 1));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.primaryDarkest }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Timeline</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.datePicker, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={prevDay} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.dateLabel, { color: colors.text }]}>
          {isToday ? "Today" : format(date, "EEE, MMM d yyyy")}
        </Text>
        <TouchableOpacity onPress={nextDay} style={styles.navBtn} disabled={isToday}>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isToday ? colors.secondaryText : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.secondaryText }]}>Loading timeline...</Text>
        </View>
      ) : data.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No activity"
          message={`No contacts were active on ${format(date, "MMMM d, yyyy")}`}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {data.map((contact) => (
            <View
              key={contact.contactId}
              style={[styles.contactBlock, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.contactHeader}>
                <AvatarCircle name={contact.name} size={36} />
                <Text style={[styles.contactName, { color: colors.text }]}>{contact.name}</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.primary + "22" }]}>
                  <Text style={[styles.countText, { color: colors.primary }]}>
                    {contact.events.length} events
                  </Text>
                </View>
              </View>
              <View style={styles.timeline}>
                {contact.events.map((event, i) => (
                  <TimelineRow
                    key={i}
                    time={event.time}
                    label={event.status === "online" ? "Came online" : "Went offline"}
                    status={event.status}
                    isLast={i === contact.events.length - 1}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { width: 36, alignItems: "center" },
  dateLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  contactBlock: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  contactName: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  timeline: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
