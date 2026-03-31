import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  Alert,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useContacts, useAddContact, useToggleFavorite } from "@/hooks/useContacts";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/providers/AuthProvider";
import { BadgeCount } from "@/components/ui/BadgeCount";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatRelativeTime } from "@/lib/formatters";
import type { Contact } from "@/components/ui/ContactCard";

type FilterKey = "all" | "online" | "offline" | "favorites" | "recent" | "high" | "never";

const FILTERS: { label: string; key: FilterKey; icon: string }[] = [
  { label: "All", key: "all", icon: "people" },
  { label: "Online", key: "online", icon: "radio-button-on" },
  { label: "Offline", key: "offline", icon: "radio-button-off" },
  { label: "Favorites", key: "favorites", icon: "star" },
  { label: "Recent", key: "recent", icon: "time" },
  { label: "High Activity", key: "high", icon: "trending-up" },
  { label: "Never Seen", key: "never", icon: "eye-off" },
];

const QUICK_ACTIONS = [
  { icon: "bar-chart" as const, label: "Reports", route: "/reports", color: "#34B7F1" },
  { icon: "shield-checkmark" as const, label: "Keywords", route: "/keyword-alerts", color: "#FFC107" },
  { icon: "people" as const, label: "Groups", route: "/contact-groups", color: "#7C4DFF" },
  { icon: "git-compare" as const, label: "Compare", route: "/compare", color: "#FF6B6B" },
  { icon: "time" as const, label: "Timeline", route: "/activity-timeline", color: "#4CAF50" },
  { icon: "diamond" as const, label: "Upgrade", route: "/subscription", color: "#FF9500" },
];

const Sparkline = React.memo(function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return <View style={{ width: 48 }} />;
  const max = Math.max(...values, 1);
  const barW = 4;
  const gap = 2;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 24, gap }}>
      {values.slice(-8).map((v, i) => (
        <View
          key={i}
          style={{
            width: barW,
            height: Math.max(3, (v / max) * 24),
            borderRadius: 2,
            backgroundColor: color + (i === values.slice(-8).length - 1 ? "ff" : "66"),
          }}
        />
      ))}
    </View>
  );
});

const EnhancedContactCard = React.memo(function EnhancedContactCard({
  contact,
  isFavorite,
  onPress,
  onFavorite,
}: {
  contact: Contact & { sessionCount?: number; sparkline?: number[] };
  isFavorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
        style={[
          styles.contactCard,
          {
            backgroundColor: colors.card,
            borderColor: (contact as any).isOnline ? colors.primary + "40" : colors.border,
            borderWidth: (contact as any).isOnline ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityLabel={`Contact ${contact.name}, ${(contact as any).isOnline ? "online" : "offline"}`}
        accessibilityRole="button"
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(contact.name, undefined, [
            { text: isFavorite ? "Unfavorite" : "Add to Favorites", onPress: onFavorite },
            { text: "View Details", onPress },
            { text: "Cancel", style: "cancel" },
          ]);
        }}
      >
        <AvatarCircle name={contact.name} isOnline={(contact as any).isOnline} size={46} />
        <View style={styles.contactInfo}>
          <Text style={[typography.bodyMedium, { color: colors.text }]} numberOfLines={1}>
            {contact.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {(contact as any).isOnline ? (
              <>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary }} />
                <Text style={[typography.caption, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  Online now
                </Text>
              </>
            ) : (
              <Text style={[typography.caption, { color: colors.secondaryText }]} numberOfLines={1}>
                {(contact as any).lastSeen
                  ? `Last seen ${formatRelativeTime((contact as any).lastSeen)}`
                  : contact.phoneNumber}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.contactRight}>
          <Sparkline
            values={(contact as any).sparkline ?? [1, 2, 1, 3, 2, 4, 2, 3]}
            color={colors.primary}
          />
          <TouchableOpacity
            onPress={onFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginTop: 4 }}
            accessibilityLabel={isFavorite ? `Remove ${contact.name} from favorites` : `Add ${contact.name} to favorites`}
            accessibilityRole="button"
          >
            <Ionicons
              name={isFavorite ? "star" : "star-outline"}
              size={15}
              color={isFavorite ? colors.warning : colors.muted}
            />
          </TouchableOpacity>
        </View>
    </TouchableOpacity>
  );
});

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
      <View style={[styles.statIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <Text style={[typography.h2, { color: "#fff", lineHeight: 32 }]}>{value}</Text>
      <Text style={[typography.small, { color: "rgba(255,255,255,0.75)" }]}>{label}</Text>
    </View>
  );
}

function AddContactSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const addContact = useAddContact();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const slideY = useSharedValue(500);

  React.useEffect(() => {
    slideY.value = visible ? withSpring(0, { damping: 18, stiffness: 200 }) : withTiming(500, { duration: 220 });
  }, [visible]);

  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }));

  async function handleAdd() {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Missing fields", "Please enter both a name and phone number.");
      return;
    }
    try {
      await addContact.mutateAsync({ name: name.trim(), phoneNumber: phone.trim() });
      setName("");
      setPhone("");
      onClose();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not add contact. Please try again.");
    }
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.base },
          slideStyle,
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.xl }]}>Add Contact</Text>

        <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Display Name</Text>
        <TextInput
          style={[styles.sheetInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          placeholder="e.g. John Doe"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          accessibilityLabel="Contact name input"
        />

        <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Phone Number</Text>
        <TextInput
          style={[styles.sheetInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          placeholder="+1 234 567 8900"
          placeholderTextColor={colors.muted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          accessibilityLabel="Phone number input"
        />

        <TouchableOpacity
          style={[
            styles.sheetBtn,
            { backgroundColor: name.trim() && phone.trim() ? colors.primary : colors.muted },
          ]}
          onPress={handleAdd}
          disabled={addContact.isPending || !name.trim() || !phone.trim()}
          accessibilityLabel="Start tracking this contact"
          accessibilityRole="button"
        >
          {addContact.isPending ? (
            <Text style={[styles.sheetBtnText, { color: "#fff" }]}>Adding...</Text>
          ) : (
            <>
              <Ionicons name="person-add" size={18} color="#fff" />
              <Text style={[styles.sheetBtnText, { color: "#fff" }]}>Start Tracking</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useAuth();
  const isWide = width >= 768;

  const { data: contacts = [], isLoading, refetch } = useContacts();
  const { data: notifications = [] } = useNotifications();
  const toggleFavorite = useToggleFavorite();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const onlineContacts = useMemo(() => contacts.filter((c) => (c as any).isOnline), [contacts]);
  const unreadCount = useMemo(() => (notifications ?? []).filter((n) => !n.read).length, [notifications]);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function handleFavorite(id: number) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toggleFavorite.mutate(id);
    Haptics.selectionAsync();
  }

  const filteredContacts = useMemo(
    () =>
      contacts.filter((c) => {
        if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (filter === "online") return (c as any).isOnline;
        if (filter === "offline") return !(c as any).isOnline;
        if (filter === "favorites") return favorites.has(c.id);
        if (filter === "recent") return !!(c as any).lastSeen;
        if (filter === "high") return ((c as any).sessionCount ?? 0) >= 5;
        if (filter === "never") return !(c as any).lastSeen && !(c as any).isOnline;
        return true;
      }),
    [contacts, searchQuery, filter, favorites]
  );

  const renderContact = useCallback(
    ({ item }: { item: Contact }) => (
      <EnhancedContactCard
        contact={item as any}
        isFavorite={favorites.has(item.id)}
        onPress={() => router.push(`/contact/${item.id}`)}
        onFavorite={() => handleFavorite(item.id)}
      />
    ),
    [favorites]
  );

  const numColumns = isWide ? 2 : 1;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={[colors.primaryDarkest, colors.primaryDark] as string[]}
        style={[styles.header, { paddingTop: topPad + spacing.sm }]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.7)" }]}>Welcome back</Text>
            <Text style={[typography.h3, { color: "#fff" }]}>{user?.username ?? "WaTracker"}</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/(tabs)/notifications")}
              accessibilityLabel={`Notifications, ${unreadCount} unread`}
              accessibilityRole="button"
            >
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {unreadCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: colors.danger }]}>
                  <BadgeCount count={unreadCount} />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/family-dashboard")}
              accessibilityLabel="Family dashboard"
              accessibilityRole="button"
            >
              <Ionicons name="people-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <Ionicons name="search" size={17} color="rgba(255,255,255,0.7)" />
          <TextInput
            style={[styles.searchInput, { color: "#fff" }]}
            placeholder="Search contacts..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search contacts"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Tracked" value={contacts.length} icon="people" accent={colors.primary} />
          <View style={styles.statDivider} />
          <StatCard label="Online Now" value={onlineContacts.length} icon="radio-button-on" accent={colors.primary} />
          <View style={styles.statDivider} />
          <StatCard label="Alerts" value={unreadCount} icon="notifications" accent={colors.danger} />
        </View>
      </LinearGradient>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.chipRow, { backgroundColor: colors.surface }]}
        contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.sm, paddingVertical: spacing.sm }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f.key);
              }}
              accessibilityLabel={`Filter by ${f.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={f.icon as any}
                size={13}
                color={active ? "#fff" : colors.secondaryText}
              />
              <Text style={[typography.caption, { color: active ? "#fff" : colors.secondaryText }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Quick Actions */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[{ backgroundColor: colors.background, flexGrow: 0 }]}
        contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.sm, paddingVertical: spacing.sm }}
      >
        {QUICK_ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(a.route as any)}
            accessibilityLabel={a.label}
            accessibilityRole="button"
          >
            <View style={[styles.quickIcon, { backgroundColor: a.color + "20" }]}>
              <Ionicons name={a.icon} size={14} color={a.color} />
            </View>
            <Text style={[typography.caption, { color: colors.text }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderContact}
        numColumns={numColumns}
        key={numColumns}
        columnWrapperStyle={isWide ? { gap: spacing.sm } : undefined}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.sm,
          paddingBottom: Platform.OS === "web" ? 120 : 100,
          gap: spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: spacing.sm }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonLoader key={i} width="100%" height={72} borderRadius={12} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="person-add-outline"
              title={searchQuery ? "No contacts found" : "No contacts tracked"}
              subtitle={
                searchQuery
                  ? `No contacts match "${searchQuery}"`
                  : "Tap the + button to add your first contact to monitor"
              }
            />
          )
        }
      />

      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: Platform.OS === "web" ? 100 : insets.bottom + 88,
            shadowColor: colors.shadow,
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setAddSheetVisible(true);
        }}
        activeOpacity={0.85}
        accessibilityLabel="Add new contact"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <AddContactSheet visible={addSheetVisible} onClose={() => setAddSheetVisible(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    marginBottom: spacing.sm,
  },
  headerIcons: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  notifBadge: { position: "absolute", top: 4, right: 4, borderRadius: 8 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 20,
    paddingHorizontal: spacing.base,
    paddingVertical: 9,
    marginBottom: spacing.base,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: spacing.sm,
    gap: 0,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: spacing.xs,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statDivider: { width: 1, height: 48, backgroundColor: "rgba(255,255,255,0.25)" },
  chipRow: { flexGrow: 0 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  contactCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.md,
  },
  contactInfo: { flex: 1, gap: 3 },
  contactRight: { alignItems: "center", gap: 2 },
  fab: {
    position: "absolute",
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  sheetInput: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: spacing.sm,
  },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  sheetBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
