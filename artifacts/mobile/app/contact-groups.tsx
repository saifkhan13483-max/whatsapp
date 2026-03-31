import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

interface Group {
  id: number;
  name: string;
  contactIds: number[];
  memberCount: number;
}

export default function ContactGroupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [newGroupName, setNewGroupName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["contact-groups"],
    queryFn: () => apiFetch<Group[]>("/contacts/groups").catch(() => []),
  });

  const createGroup = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/contacts/groups", { method: "POST", body: JSON.stringify({ name, contactIds: [] }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-groups"] });
      setNewGroupName("");
      setShowAdd(false);
    },
    onError: () => Alert.alert("Error", "Could not create group"),
  });

  const deleteGroup = useMutation({
    mutationFn: (id: number) => apiFetch(`/contacts/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-groups"] }),
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primaryDarkest, paddingTop: topPad + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: "#fff", flex: 1, textAlign: "center" }]}>Contact Groups</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.btn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            placeholder="Group name..."
            placeholderTextColor={colors.muted}
            value={newGroupName}
            onChangeText={setNewGroupName}
            autoFocus
          />
          <View style={styles.addBtns}>
            <TouchableOpacity
              style={[styles.smallBtn, { borderColor: colors.border }]}
              onPress={() => setShowAdd(false)}
            >
              <Text style={{ color: colors.secondaryText, fontFamily: "Inter_500Medium" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: colors.primary }]}
              onPress={() => newGroupName.trim() && createGroup.mutate(newGroupName)}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_500Medium" }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title="No groups"
          subtitle="Create groups to organize your contacts"
          actionLabel="Create Group"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: spacing.base, gap: spacing.sm, paddingBottom: Platform.OS === "web" ? 120 : 80 }}
          renderItem={({ item }) => (
            <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.groupIcon, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name="people" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: colors.text }]}>{item.name}</Text>
                <Text style={[typography.caption, { color: colors.secondaryText }]}>
                  {item.memberCount ?? 0} members
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert("Delete Group", `Delete "${item.name}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteGroup.mutate(item.id) },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.base, paddingBottom: spacing.base },
  btn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  addCard: { margin: spacing.base, padding: spacing.base, borderRadius: 12, borderWidth: 1, gap: spacing.sm },
  input: { padding: spacing.md, borderRadius: 8, borderWidth: 1, fontFamily: "Inter_400Regular", fontSize: 15 },
  addBtns: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  smallBtn: { paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  groupCard: { flexDirection: "row", alignItems: "center", padding: spacing.base, borderRadius: 12, borderWidth: 1, gap: spacing.md },
  groupIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
