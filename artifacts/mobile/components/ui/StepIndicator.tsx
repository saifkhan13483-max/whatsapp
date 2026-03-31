import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const completed = step < currentStep;
        const active = step === currentStep;

        return (
          <React.Fragment key={step}>
            {i > 0 && (
              <View
                style={[
                  styles.line,
                  { backgroundColor: completed ? colors.primary : colors.border },
                ]}
              />
            )}
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: completed || active ? colors.primary : "transparent",
                    borderColor: completed || active ? colors.primary : colors.border,
                    shadowColor: active ? colors.primary : "transparent",
                    shadowOpacity: active ? 0.35 : 0,
                    shadowRadius: active ? 8 : 0,
                    elevation: active ? 4 : 0,
                  },
                ]}
              >
                {completed ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: active ? "#fff" : colors.secondaryText,
                        fontFamily: "Inter_700Bold",
                        lineHeight: 16,
                      },
                    ]}
                  >
                    {step}
                  </Text>
                )}
              </View>
              {labels?.[i] && (
                <Text
                  style={[
                    typography.small,
                    {
                      color: active ? colors.primary : colors.secondaryText,
                      marginTop: 4,
                      textAlign: "center",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {labels[i]}
                </Text>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  stepWrapper: {
    alignItems: "center",
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    flex: 1,
    height: 2,
    maxWidth: 48,
    marginHorizontal: 4,
    marginBottom: 2,
  },
});
