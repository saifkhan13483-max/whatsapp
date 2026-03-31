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
import { useColors } from "@/constants/colors";
import { useContacts } from "@/hooks/useContacts";
import { useCompare } from "@/hooks/useCompare";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { ComparisonChart } from "@/components/ui/ComparisonChart";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ComparisonData } from "@/hooks/useCompare";

type Metric = "totalOnlineMinutes" | "sessionsCount" | "avgSessionDuration";
const METRICS: Metric[] = ["totalOnlineMinutes", "sessionsCount", "avgSessionDuration"];
const METRIC_LABELS = ["Online Time", "Sessions", "Avg Duration"];

export default function CompareScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: contacts = [] } = useContacts();
  const [selected, setSelected] = useState<number[]>([]);
  const [metricIdx, setMetricIdx] = useState(0);

  const { data: comparison = [], isLoading } = useCompare(selected);

  function toggleContact(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.primaryDarkest }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compare Contacts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Select up to 4 contacts
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contactRow}>
          {contacts.map((c) => {
            const sel = selected.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.contactChip,
                  {
                    backgroundColor: sel ? colors.primary + "22" : colors.card,
                    borderColor: sel ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => toggleContact(c.id)}
                activeOpacity={0.8}
              >
                <AvatarCircle name={c.name} size={36} />
                <Text style={[styles.chipName, { color: sel ? colors.primary : colors.text }]} numberOfLines={1}>
                  {c.name}
                </Text>
                {sel && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selected.length >= 2 ? (
          <View style={{ gap: 16 }}>
            <SegmentedControl
              options={METRIC_LABELS}
              selectedIndex={metricIdx}
              onChange={setMetricIdx}
            />

            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
                  Loading comparison...
                </Text>
              </View>
            ) : comparison.length > 0 ? (
              <ComparisonChart data={comparison} metric={METRICS[metricIdx]} />
            ) : (
              <EmptyState
                icon="bar-chart-outline"
                title="No data yet"
                message="Comparison data will appear once your contacts have activity"
              />
            )}

            {comparison.length > 0 && (
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Summary</Text>
                {comparison.map((d, i) => {
                  const hrs = Math.floor(d.totalOnlineMinutes / 60);
                  const mins = d.totalOnlineMinutes % 60;
                  return (
                    <View key={d.contactId} style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
                      <AvatarCircle name={d.name} size={32} />
                      <Text style={[styles.summaryName, { color: colors.text }]}>{d.name}</Text>
                      <View style={styles.summaryStats}>
                        <Text style={[styles.summaryVal, { color: colors.primary }]}>
                          {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
                        </Text>
                        <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>
                          {d.sessionsCount} sessions
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <EmptyState
            icon="people-outline"
            title="Select contacts to compare"
            message="Choose 2–4 contacts above to compare their activity side by side"
          />
        )}
      </ScrollView>
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
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  contactRow: { gap: 10, paddingVertical: 4 },
  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    maxWidth: 160,
  },
  chipName: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  loadingBox: { alignItems: "center", gap: 8, paddingVertical: 40 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  summaryTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  summaryStats: { alignItems: "flex-end" },
  summaryVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
