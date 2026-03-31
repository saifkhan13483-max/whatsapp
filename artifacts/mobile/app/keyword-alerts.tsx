import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useKeywordAlerts, useAddKeyword, useDeleteKeyword } from "@/hooks/useKeywordAlerts";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

const SEVERITIES = ["low", "medium", "high"] as const;
const SEVERITY_COLORS: Record<string, string> = {
  low: "#4CAF50",
  medium: "#FFC107",
  high: "#FF3B30",
};

export default function KeywordAlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: keywords = [] } = useKeywordAlerts();
  const addKeyword = useAddKeyword();
  const deleteKeyword = useDeleteKeyword();
  const [newWord, setNewWord] = useState("");
  const [severity, setSeverity] = useState<typeof SEVERITIES[number]>("medium");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleAdd() {
    if (!newWord.trim()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await addKeyword.mutateAsync({ keyword: newWord.trim(), severity });
      setNewWord("");
    } catch {
      Alert.alert("Error", "Could not add keyword");
    }
  }

  async function handleDelete(id: number) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteKeyword.mutate(id);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: "#075E54", paddingTop: topPad + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: "#fff", flex: 1, textAlign: "center" }]}>Keyword Alerts</Text>
        <View style={styles.btn} />
      </View>

      <View style={[styles.addSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.sm }]}>Add Keyword</Text>
        <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Enter keyword..."
            placeholderTextColor={colors.muted}
            value={newWord}
            onChangeText={setNewWord}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
        </View>
        <View style={styles.severityRow}>
          {SEVERITIES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.sevChip,
                {
                  backgroundColor: severity === s ? SEVERITY_COLORS[s] : "transparent",
                  borderColor: SEVERITY_COLORS[s],
                },
              ]}
              onPress={() => setSeverity(s)}
            >
              <Text style={{ color: severity === s ? "#fff" : SEVERITY_COLORS[s], fontFamily: "Inter_500Medium", fontSize: 12 }}>
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary, opacity: addKeyword.isPending ? 0.7 : 1 }]}
          onPress={handleAdd}
          disabled={addKeyword.isPending}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={[typography.bodyMedium, { color: "#fff" }]}>Add Keyword</Text>
        </TouchableOpacity>
      </View>

      {keywords.length === 0 ? (
        <EmptyState
          icon="shield-outline"
          title="No keywords"
          subtitle="Add keywords to get alerted when they appear in conversations"
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.sm, paddingBottom: Platform.OS === "web" ? 120 : 80 }}>
          {keywords.map((kw) => (
            <View key={kw.id} style={[styles.kwCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.sevDot, { backgroundColor: SEVERITY_COLORS[kw.severity] }]} />
              <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>{kw.keyword}</Text>
              <View style={[styles.sevLabel, { backgroundColor: SEVERITY_COLORS[kw.severity] + "20" }]}>
                <Text style={{ color: SEVERITY_COLORS[kw.severity], fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                  {kw.severity.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(kw.id)}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.base, paddingBottom: spacing.base },
  btn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  addSection: { margin: spacing.base, padding: spacing.base, borderRadius: 12, borderWidth: 1, gap: spacing.sm },
  inputRow: { borderRadius: 8, borderWidth: 1 },
  input: { padding: spacing.md, fontFamily: "Inter_400Regular", fontSize: 15 },
  severityRow: { flexDirection: "row", gap: spacing.sm },
  sevChip: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8, borderWidth: 1.5 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md, borderRadius: 8 },
  kwCard: { flexDirection: "row", alignItems: "center", padding: spacing.base, borderRadius: 12, borderWidth: 1, gap: spacing.md },
  sevDot: { width: 10, height: 10, borderRadius: 5 },
  sevLabel: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});
