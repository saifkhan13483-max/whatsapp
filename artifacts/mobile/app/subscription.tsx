import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { usePlans, useCurrentSubscription, useUpgradePlan } from "@/hooks/useSubscription";
import { PlanCard } from "@/components/ui/PlanCard";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

export default function SubscriptionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: plans = [], isLoading: loadingPlans } = usePlans();
  const { data: current } = useCurrentSubscription();
  const upgrade = useUpgradePlan();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleUpgrade(planId: string) {
    if (current?.planId === planId) return;
    Alert.alert("Upgrade Plan", "Confirm upgrade to this plan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Upgrade",
        onPress: async () => {
          try {
            await upgrade.mutateAsync(planId);
            Alert.alert("Success", "Your plan has been upgraded!");
          } catch {
            Alert.alert("Error", "Could not upgrade at this time.");
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: "#075E54", paddingTop: topPad + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: "#fff", flex: 1, textAlign: "center" }]}>Plans & Pricing</Text>
        <View style={styles.btn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.base, paddingBottom: Platform.OS === "web" ? 120 : 80 }}>
        <View style={[styles.currentPlan, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
          <Ionicons name="diamond" size={24} color={colors.primary} />
          <View>
            <Text style={[typography.labelBold, { color: colors.text }]}>Current Plan</Text>
            <Text style={[typography.body, { color: colors.primary }]}>{current?.planName ?? "Free"}</Text>
          </View>
        </View>

        {loadingPlans ? (
          Array.from({ length: 2 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={280} borderRadius={16} />
          ))
        ) : plans.length === 0 ? (
          [
            {
              id: "free",
              name: "Free",
              price: 0,
              currency: "$",
              features: ["Track 1 contact", "Basic activity reports", "Online/Offline alerts"],
            },
            {
              id: "pro",
              name: "Pro",
              price: 9,
              currency: "$",
              features: [
                "Track unlimited contacts",
                "Full activity reports",
                "Keyword alerts",
                "View-once recovery",
                "Family dashboard",
                "Export to CSV",
              ],
              isPopular: true,
            },
            {
              id: "family",
              name: "Family",
              price: 19,
              currency: "$",
              features: [
                "Everything in Pro",
                "Family monitoring dashboard",
                "Geofence alerts",
                "Advanced comparison",
                "Priority support",
              ],
            },
          ].map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan as any}
              isActive={current?.planId === plan.id}
              onSelect={() => handleUpgrade(plan.id)}
            />
          ))
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isActive={current?.planId === plan.id}
              onSelect={() => handleUpgrade(plan.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.base, paddingBottom: spacing.base },
  btn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  currentPlan: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.base, borderRadius: 12, borderWidth: 1 },
});
