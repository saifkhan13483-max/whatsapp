import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  isPopular?: boolean;
}

interface Props {
  plan: Plan;
  isActive: boolean;
  onSelect: () => void;
}

export function PlanCard({ plan, isActive, onSelect }: Props) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? colors.primary : colors.border,
          borderWidth: isActive ? 2 : 1,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      {plan.isPopular && (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>POPULAR</Text>
        </View>
      )}
      <Text style={[typography.h3, { color: colors.text }]}>{plan.name}</Text>
      <View style={styles.priceRow}>
        <Text style={[typography.h1, { color: colors.primary }]}>{plan.currency}{plan.price}</Text>
        <Text style={[typography.caption, { color: colors.secondaryText }]}>/month</Text>
      </View>
      <View style={styles.features}>
        {plan.features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.secondaryText, flex: 1 }]}>{f}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.btn, { backgroundColor: isActive ? colors.primary : "transparent", borderColor: colors.primary, borderWidth: 1 }]}>
        <Text style={[typography.bodyMedium, { color: isActive ? "#fff" : colors.primary }]}>
          {isActive ? "Current Plan" : "Upgrade"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.xl,
    borderRadius: 16,
    gap: spacing.md,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -10,
    right: spacing.base,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  features: { gap: spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: spacing.sm,
  },
});
