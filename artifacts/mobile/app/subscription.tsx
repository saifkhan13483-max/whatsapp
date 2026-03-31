import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { usePlans, useCurrentSubscription, useUpgradePlan } from "@/hooks/useSubscription";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

type BillingPeriod = "monthly" | "annual";

interface LocalPlan {
  id: string;
  name: string;
  badge?: string;
  monthlyPrice: number;
  annualPrice: number;
  isPopular?: boolean;
  isBestValue?: boolean;
  features: { label: string; included: boolean }[];
}

const LOCAL_PLANS: LocalPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      { label: "Track 1 contact", included: true },
      { label: "Online/offline alerts", included: true },
      { label: "Basic activity summary", included: true },
      { label: "Full activity reports", included: false },
      { label: "Keyword alerts", included: false },
      { label: "View-once recovery", included: false },
      { label: "Family dashboard", included: false },
      { label: "Export to CSV", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most Popular",
    monthlyPrice: 9,
    annualPrice: 65,
    isPopular: true,
    features: [
      { label: "Unlimited contacts", included: true },
      { label: "Online/offline alerts", included: true },
      { label: "Full activity reports", included: true },
      { label: "Keyword alerts", included: true },
      { label: "View-once recovery", included: true },
      { label: "Family dashboard", included: true },
      { label: "Export to CSV", included: true },
      { label: "Priority support", included: false },
    ],
  },
  {
    id: "family",
    name: "Family",
    badge: "Best Value",
    monthlyPrice: 19,
    annualPrice: 137,
    isBestValue: true,
    features: [
      { label: "Unlimited contacts", included: true },
      { label: "Online/offline alerts", included: true },
      { label: "Full activity reports", included: true },
      { label: "Keyword alerts", included: true },
      { label: "View-once recovery", included: true },
      { label: "Family dashboard", included: true },
      { label: "Export to CSV", included: true },
      { label: "Priority support", included: true },
    ],
  },
];

const COMPARISON_FEATURES = [
  "Contacts tracked",
  "Activity reports",
  "Keyword alerts",
  "View-once recovery",
  "Family dashboard",
  "CSV export",
  "Priority support",
];

const PLAN_FEATURE_VALUES: Record<string, (string | boolean)[]> = {
  free: ["1", true, false, false, false, false, false],
  pro: ["Unlimited", true, true, true, true, true, false],
  family: ["Unlimited", true, true, true, true, true, true],
};

export default function SubscriptionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  const { data: current } = useCurrentSubscription();
  const upgrade = useUpgradePlan();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleUpgrade = (planId: string) => {
    if (current?.planId === planId) return;
    if (planId === "free") return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Upgrade Plan",
      `Upgrade to ${LOCAL_PLANS.find((p) => p.id === planId)?.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upgrade",
          onPress: async () => {
            try {
              await upgrade.mutateAsync(planId);
              Alert.alert("Success", "Your plan has been upgraded!");
            } catch {
              Alert.alert("Error", "Could not upgrade at this time. Please try again.");
            }
          },
        },
      ]
    );
  };

  const getPrice = (plan: LocalPlan) =>
    billingPeriod === "annual" ? plan.annualPrice : plan.monthlyPrice;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.primaryDarkest,
            paddingTop: topPad + spacing.sm,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.btn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text
          style={[typography.h3, { color: "#fff", flex: 1, textAlign: "center" }]}
        >
          Choose Your Plan
        </Text>
        <View style={styles.btn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Billing period toggle */}
        <View style={styles.toggleContainer}>
          <View style={[styles.togglePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                billingPeriod === "monthly" && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setBillingPeriod("monthly");
              }}
            >
              <Text
                style={[
                  typography.bodyMedium,
                  { color: billingPeriod === "monthly" ? "#fff" : colors.text },
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                billingPeriod === "annual" && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setBillingPeriod("annual");
              }}
            >
              <Text
                style={[
                  typography.bodyMedium,
                  { color: billingPeriod === "annual" ? "#fff" : colors.text },
                ]}
              >
                Annual
              </Text>
              {billingPeriod !== "annual" && (
                <View style={[styles.saveBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.saveBadgeText}>Save 40%</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan cards */}
        <View style={styles.plansContainer}>
          {LOCAL_PLANS.map((plan) => {
            const isActive = current?.planId === plan.id;
            const isFeatured = plan.isPopular;
            const price = getPrice(plan);

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isFeatured ? colors.primary : colors.border,
                    borderWidth: isFeatured ? 2 : 1,
                    transform: [{ scale: isFeatured ? 1.02 : 1 }],
                  },
                ]}
              >
                {/* Badge */}
                {plan.badge && (
                  <View
                    style={[
                      styles.planBadge,
                      {
                        backgroundColor: isFeatured ? colors.primary : colors.warning,
                      },
                    ]}
                  >
                    <Text style={styles.planBadgeText}>{plan.badge}</Text>
                  </View>
                )}

                {/* Plan name */}
                <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.xs }]}>
                  {plan.name}
                </Text>

                {/* Price */}
                <View style={styles.priceRow}>
                  <Text style={[typography.h1, { color: isActive ? colors.primary : colors.text }]}>
                    {price === 0 ? "Free" : `$${price}`}
                  </Text>
                  {price > 0 && (
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.secondaryText, alignSelf: "flex-end", marginBottom: 4 },
                      ]}
                    >
                      /{billingPeriod === "monthly" ? "mo" : "yr"}
                    </Text>
                  )}
                </View>

                {billingPeriod === "annual" && price > 0 && (
                  <Text style={[typography.caption, { color: colors.primary, marginBottom: spacing.md }]}>
                    Save ${(plan.monthlyPrice * 12 - plan.annualPrice).toFixed(0)}/year
                  </Text>
                )}

                {/* Features */}
                <View style={styles.featureList}>
                  {plan.features.map((feat, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Ionicons
                        name={feat.included ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={feat.included ? colors.primary : colors.muted}
                      />
                      <Text
                        style={[
                          typography.body,
                          {
                            color: feat.included ? colors.text : colors.muted,
                            flex: 1,
                          },
                        ]}
                      >
                        {feat.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* CTA button */}
                <TouchableOpacity
                  style={[
                    styles.ctaButton,
                    {
                      backgroundColor: isActive
                        ? colors.primary + "20"
                        : isFeatured
                        ? colors.primary
                        : "transparent",
                      borderColor: isActive ? colors.primary : isFeatured ? colors.primary : colors.border,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => handleUpgrade(plan.id)}
                  disabled={isActive || plan.id === "free"}
                  accessibilityLabel={isActive ? "Current plan" : `Choose ${plan.name}`}
                >
                  <Text
                    style={[
                      typography.bodyMedium,
                      {
                        color: isActive
                          ? colors.primary
                          : isFeatured
                          ? "#fff"
                          : colors.text,
                      },
                    ]}
                  >
                    {isActive ? "Current Plan" : plan.id === "free" ? "Free" : "Choose Plan"}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Feature comparison table */}
        <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.base }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Feature Comparison
          </Text>
          <View
            style={[
              styles.comparisonTable,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Table header */}
            <View
              style={[styles.compRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
            >
              <Text style={[styles.compFeatureCol, { color: colors.secondaryText }]}>Feature</Text>
              {LOCAL_PLANS.map((p) => (
                <Text
                  key={p.id}
                  style={[
                    styles.compPlanCol,
                    {
                      color: p.id === (current?.planId ?? "free") ? colors.primary : colors.text,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {p.name}
                </Text>
              ))}
            </View>

            {/* Feature rows */}
            {COMPARISON_FEATURES.map((feat, rowIdx) => (
              <View
                key={feat}
                style={[
                  styles.compRow,
                  {
                    backgroundColor:
                      rowIdx % 2 === 0 ? colors.card : colors.background,
                    borderBottomColor: colors.border,
                    borderBottomWidth: rowIdx < COMPARISON_FEATURES.length - 1 ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
              >
                <Text style={[styles.compFeatureCol, { color: colors.text, fontSize: 12 }]}>
                  {feat}
                </Text>
                {LOCAL_PLANS.map((p) => {
                  const val = PLAN_FEATURE_VALUES[p.id][rowIdx];
                  return (
                    <View key={p.id} style={styles.compPlanColView}>
                      {typeof val === "boolean" ? (
                        <Ionicons
                          name={val ? "checkmark-circle" : "close-circle"}
                          size={18}
                          color={val ? colors.primary : colors.muted}
                        />
                      ) : (
                        <Text style={[typography.small, { color: colors.text }]}>{val}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Money-back guarantee */}
        <View
          style={[
            styles.guarantee,
            {
              backgroundColor: colors.primary + "10",
              borderColor: colors.primary + "30",
            },
          ]}
        >
          <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyMedium, { color: colors.text }]}>
              7-day money-back guarantee
            </Text>
            <Text style={[typography.caption, { color: colors.secondaryText }]}>
              Not satisfied? Get a full refund within 7 days, no questions asked.
            </Text>
          </View>
        </View>
      </ScrollView>
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
  btn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  toggleContainer: {
    alignItems: "center",
    paddingVertical: spacing.base,
  },
  togglePill: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
  },
  toggleOption: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  saveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  saveBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  plansContainer: {
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  planCard: {
    borderRadius: 16,
    padding: spacing.xl,
    overflow: "visible",
  },
  planBadge: {
    position: "absolute",
    top: -10,
    right: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: spacing.xs,
  },
  featureList: {
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: 10,
  },
  comparisonTable: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  compRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  compFeatureCol: {
    flex: 2,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  compPlanCol: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
  },
  compPlanColView: {
    flex: 1,
    alignItems: "center",
  },
  guarantee: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    margin: spacing.base,
    marginTop: spacing.xl,
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
  },
});
