import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useContacts } from "@/hooks/useContacts";
import { useReport } from "@/hooks/useReports";
import { ChipFilter } from "@/components/ui/ChipFilter";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart } from "@/components/ui/BarChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatDuration, formatHour } from "@/lib/formatters";

const RANGE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ contactId?: string }>();
  const { data: contacts = [] } = useContacts();
  const [selectedId, setSelectedId] = useState(params.contactId ? parseInt(params.contactId) : 0);
  const [range, setRange] = useState("week");

  const activeId = selectedId || (contacts[0]?.id ?? 0);
  const { data: report, isLoading } = useReport(activeId, range);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: "#075E54", paddingTop: topPad + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: "#fff", flex: 1, textAlign: "center" }]}>Activity Reports</Text>
        <View style={styles.btn} />
      </View>

      <View style={[styles.contactSelector, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, padding: spacing.base }}>
          {contacts.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.chip,
                {
                  backgroundColor: activeId === c.id ? colors.primary : colors.card,
                  borderColor: activeId === c.id ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedId(c.id)}
            >
              <Text style={{ color: activeId === c.id ? "#fff" : colors.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ChipFilter options={RANGE_OPTIONS} selected={range} onSelect={setRange} />

      {contacts.length === 0 ? (
        <EmptyState icon="bar-chart-outline" title="No contacts" subtitle="Add contacts to generate reports" />
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !report ? (
        <EmptyState icon="bar-chart-outline" title="No data" subtitle="No activity data for this period" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.base, paddingBottom: Platform.OS === "web" ? 120 : 80 }}>
          <View style={styles.statsRow}>
            <StatCard label="Sessions" value={String(report.totalSessions)} icon="time" color={colors.primary} />
            <StatCard label="Online Time" value={formatDuration(report.totalMinutes)} icon="hourglass" color={colors.blue} />
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.sm }]}>
              Activity by Hour
            </Text>
            {report.dailyBreakdown.length > 0 ? (
              <BarChart
                data={report.dailyBreakdown.map((d, i) => ({ label: d.date, value: d.minutes }))}
                height={120}
                color={colors.primary}
              />
            ) : (
              <Text style={[typography.caption, { color: colors.secondaryText }]}>No data</Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.sm }]}>
              Peak Activity Hour
            </Text>
            <Text style={[typography.h2, { color: colors.primary }]}>{formatHour(report.peakHour)}</Text>
            <Text style={[typography.caption, { color: colors.secondaryText }]}>Most active at this hour</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.base, paddingBottom: spacing.base },
  btn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  contactSelector: { borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 24, borderWidth: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  card: { padding: spacing.base, borderRadius: 12, borderWidth: 1 },
});
