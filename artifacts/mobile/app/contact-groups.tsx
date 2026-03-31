import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
  Platform,
  ScrollView,
  Modal,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useContactGroups, useCreateGroup, useUpdateGroup, useDeleteGroup } from "@/hooks/useContactGroups";
import { useContacts } from "@/hooks/useContacts";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import type { ContactGroup } from "@/hooks/useContactGroups";

interface OverlappingAvatarsProps {
  names: string[];
  max?: number;
}

const OverlappingAvatars = React.memo(function OverlappingAvatars({ names, max = 5 }: OverlappingAvatarsProps) {
  const colors = useColors();
  const shown = names.slice(0, max);
  const extra = names.length - max;
  const AVATAR_SIZE = 30;
  const OVERLAP = 10;
  const totalWidth = shown.length * (AVATAR_SIZE - OVERLAP) + OVERLAP + (extra > 0 ? AVATAR_SIZE : 0);

  return (
    <View style={{ width: totalWidth, height: AVATAR_SIZE, position: "relative" }}>
      {shown.map((name, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: i * (AVATAR_SIZE - OVERLAP),
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            borderWidth: 2,
            borderColor: colors.card,
            zIndex: i,
          }}
        >
          <AvatarCircle name={name} size={AVATAR_SIZE - 4} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={{
            position: "absolute",
            left: shown.length * (AVATAR_SIZE - OVERLAP),
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            backgroundColor: colors.border,
            borderWidth: 2,
            borderColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
            zIndex: shown.length,
          }}
        >
          <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: colors.secondaryText }}>
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
});

interface GroupCardProps {
  group: ContactGroup & { memberNames?: string[] };
  onPress: () => void;
  onLongPress: () => void;
}

const GroupCard = React.memo(function GroupCard({ group, onPress, onLongPress }: GroupCardProps) {
  const colors = useColors();
  const memberNames = group.memberNames ?? [];

  return (
    <TouchableOpacity
      style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.85}
      accessibilityLabel={`${group.name} group, ${memberNames.length} members`}
      accessibilityRole="button"
    >
      <View style={[styles.groupIconWrap, { backgroundColor: colors.primary + "20" }]}>
        <Ionicons name="people" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[typography.bodyMedium, { color: colors.text }]}>{group.name}</Text>
        <View style={styles.groupMeta}>
          {memberNames.length > 0 ? (
            <OverlappingAvatars names={memberNames} max={5} />
          ) : (
            <Text style={[typography.caption, { color: colors.muted }]}>No members yet</Text>
          )}
          <Text style={[typography.caption, { color: colors.secondaryText }]}>
            {memberNames.length} member{memberNames.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
});

interface GroupDetailModalProps {
  group: (ContactGroup & { memberNames?: string[] }) | null;
  allContacts: Array<{ id: number; name: string }>;
  visible: boolean;
  onClose: () => void;
  onUpdate: (id: number, contactIds: number[]) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, name: string) => void;
}

function GroupDetailModal({
  group,
  allContacts,
  visible,
  onClose,
  onUpdate,
  onDelete,
  onRename,
}: GroupDetailModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group?.name ?? "");
  const [selectedIds, setSelectedIds] = useState<number[]>(group?.contactIds ?? []);

  React.useEffect(() => {
    setEditName(group?.name ?? "");
    setSelectedIds(group?.contactIds ?? []);
    setIsEditing(false);
  }, [group?.id]);

  if (!group) return null;

  function toggleMember(id: number) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleSave() {
    if (editName.trim() && editName !== group?.name) {
      onRename(group!.id, editName.trim());
    }
    onUpdate(group!.id, selectedIds);
    setIsEditing(false);
  }

  function handleDelete() {
    Alert.alert("Delete Group", `Delete "${group?.name}"? This action cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onDelete(group!.id);
          onClose();
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.modalHeader,
            { backgroundColor: colors.headerBg, paddingTop: insets.top + spacing.sm },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.modalBtn} accessibilityLabel="Close" accessibilityRole="button">
            <Ionicons name="close" size={24} color={colors.headerText} />
          </TouchableOpacity>
          {isEditing ? (
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={[styles.modalTitleInput, { color: colors.headerText, borderBottomColor: colors.headerText + "50" }]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          ) : (
            <Text style={[typography.h3, { color: colors.headerText, flex: 1, textAlign: "center" }]}>
              {group.name}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => {
              if (isEditing) handleSave();
              else setIsEditing(true);
            }}
            style={styles.modalBtn}
            accessibilityLabel={isEditing ? "Save changes" : "Edit group"}
            accessibilityRole="button"
          >
            <Ionicons name={isEditing ? "checkmark" : "pencil-outline"} size={22} color={colors.headerText} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.base, paddingBottom: 60 }}>
          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={[typography.bodyMedium, { color: colors.text }]}>
                {selectedIds.length} member{selectedIds.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          <Text style={[typography.labelBold, { color: colors.text }]}>
            {isEditing ? "Edit Members" : "Members"}
          </Text>
          {allContacts.map((c) => {
            const selected = selectedIds.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.contactRow,
                  {
                    backgroundColor: selected ? colors.primary + "12" : colors.card,
                    borderColor: selected ? colors.primary + "44" : colors.border,
                  },
                ]}
                onPress={isEditing ? () => toggleMember(c.id) : undefined}
                disabled={!isEditing}
                accessibilityRole="checkbox"
                accessibilityLabel={`${c.name}, ${selected ? "in group" : "not in group"}`}
                accessibilityState={{ checked: selected }}
              >
                <AvatarCircle name={c.name} size={38} />
                <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>{c.name}</Text>
                {isEditing ? (
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: selected ? colors.primary : "transparent",
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {selected && <Ionicons name="checkmark" size={14} color={colors.headerText} />}
                  </View>
                ) : selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.deleteGroupBtn, { borderColor: colors.danger + "44" }]}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete group"
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.deleteGroupText, { color: colors.danger }]}>Delete Group</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface CreateGroupModalProps {
  visible: boolean;
  contacts: Array<{ id: number; name: string }>;
  onClose: () => void;
  onCreate: (name: string, contactIds: number[]) => void;
}

function CreateGroupModal({ visible, contacts, onClose, onCreate }: CreateGroupModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  function toggleContact(id: number) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleCreate() {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter a group name.");
      return;
    }
    onCreate(name.trim(), selectedIds);
    setName("");
    setSelectedIds([]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.modalHeader,
            { backgroundColor: colors.headerBg, paddingTop: insets.top + spacing.sm },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.modalBtn} accessibilityLabel="Cancel" accessibilityRole="button">
            <Ionicons name="close" size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={[typography.h3, { color: colors.headerText, flex: 1, textAlign: "center" }]}>
            Create Group
          </Text>
          <TouchableOpacity
            onPress={handleCreate}
            style={styles.modalBtn}
            accessibilityLabel="Create group"
            accessibilityRole="button"
          >
            <Ionicons name="checkmark" size={24} color={colors.headerText} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.base, paddingBottom: 60 }}>
          <View style={[styles.nameInputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.label, { color: colors.secondaryText, marginBottom: spacing.sm }]}>
              GROUP NAME
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Kids, Employees, Family..."
              placeholderTextColor={colors.muted}
              style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.border }]}
              autoFocus
              returnKeyType="next"
              accessibilityLabel="Group name"
            />
          </View>

          <Text style={[typography.labelBold, { color: colors.text }]}>
            Select Members ({selectedIds.length})
          </Text>
          {contacts.map((c) => {
            const sel = selectedIds.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.contactRow,
                  {
                    backgroundColor: sel ? colors.primary + "12" : colors.card,
                    borderColor: sel ? colors.primary + "44" : colors.border,
                  },
                ]}
                onPress={() => toggleContact(c.id)}
                accessibilityRole="checkbox"
                accessibilityLabel={`${c.name}`}
                accessibilityState={{ checked: sel }}
              >
                <AvatarCircle name={c.name} size={38} />
                <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>{c.name}</Text>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: sel ? colors.primary : "transparent",
                      borderColor: sel ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {sel && <Ionicons name="checkmark" size={14} color={colors.headerText} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ContactGroupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: groups = [], isLoading, refetch, isRefetching } = useContactGroups();
  const { data: contacts = [] } = useContacts();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<(typeof groups[0] & { memberNames?: string[] }) | null>(null);

  const contactsById = useMemo(() => {
    const map: Record<number, string> = {};
    contacts.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [contacts]);

  const groupsWithNames = useMemo(() =>
    groups.map((g) => ({
      ...g,
      memberNames: (g.contactIds ?? []).map((id) => contactsById[id]).filter(Boolean),
    })),
    [groups, contactsById]
  );

  const handleCreate = useCallback(async (name: string, contactIds: number[]) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createGroup.mutateAsync({ name, contactIds });
      setShowCreate(false);
    } catch {
      Alert.alert("Error", "Could not create group. Please try again.");
    }
  }, [createGroup]);

  const handleUpdate = useCallback((id: number, contactIds: number[]) => {
    updateGroup.mutate({ id, contactIds });
  }, [updateGroup]);

  const handleRename = useCallback((id: number, name: string) => {
    updateGroup.mutate({ id, name });
  }, [updateGroup]);

  const handleDelete = useCallback((id: number) => {
    deleteGroup.mutate(id);
  }, [deleteGroup]);

  const handleGroupLongPress = useCallback(async (group: typeof groupsWithNames[0]) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedGroup(group);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.headerText, flex: 1, textAlign: "center" }]}>
          Groups
        </Text>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={styles.backBtn}
          accessibilityLabel="Create new group"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={24} color={colors.headerText} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.base, gap: spacing.base }}>
          <SkeletonLoader width="100%" height={80} borderRadius={12} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} />
        </View>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title="No groups yet"
          subtitle="Create groups to organize your contacts. Tap the + button to get started."
          actionLabel="Create Group"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <FlatList
          data={groupsWithNames}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            padding: spacing.base,
            gap: spacing.sm,
            paddingBottom: Platform.OS === "web" ? 120 : 96,
          }}
          scrollEnabled={groups.length > 0}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <GroupCard
              group={item}
              onPress={() => setSelectedGroup(item)}
              onLongPress={() => handleGroupLongPress(item)}
            />
          )}
        />
      )}

      <CreateGroupModal
        visible={showCreate}
        contacts={contacts}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      <GroupDetailModal
        group={selectedGroup}
        allContacts={contacts}
        visible={selectedGroup !== null}
        onClose={() => setSelectedGroup(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onRename={handleRename}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.md,
  },
  groupIconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  groupMeta: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  modalBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  modalTitleInput: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  detailCard: { borderRadius: 12, borderWidth: 1, padding: spacing.base },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  deleteGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  deleteGroupText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nameInputCard: { borderRadius: 12, borderWidth: 1, padding: spacing.base },
  nameInput: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
});
