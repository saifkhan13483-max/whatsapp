import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";

import { useColors } from "@/hooks/useColors";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { PairingCodeDisplay } from "@/components/ui/PairingCodeDisplay";
import { PhoneInputField, type Country } from "@/components/ui/PhoneInputField";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatRelativeTime } from "@/lib/formatters";

const STEP_LABELS = ["Phone", "Code", "Done"];

const DEFAULT_COUNTRY: Country = { code: "PK", dialCode: "+92", name: "Pakistan" };

export default function ConnectWhatsAppScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phoneValue, setPhoneValue] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [pairingCode, setPairingCode] = useState<string>("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string>("");
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    connectionStatus,
    requestPairingCode,
    isRequestingCode,
    disconnect,
    isDisconnecting,
    reconnect,
    isReconnecting,
    pairingCodeStatus,
    setIsPolling,
    refetchStatus,
  } = useWhatsAppConnection(currentStep === 2);

  useEffect(() => {
    return () => {
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (currentStep === 2) {
        setIsPolling(true);
        refetchStatus();
      }
      return () => {
        setIsPolling(false);
      };
    }, [currentStep])
  );

  useEffect(() => {
    if (currentStep === 2 && pairingCodeStatus) {
      if (pairingCodeStatus.status === "accepted") {
        setIsPolling(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCurrentStep(3);
      } else if (pairingCodeStatus.status === "error") {
        setIsPolling(false);
        Toast.show({
          type: "error",
          text1: "Connection error",
          text2: "Could not reach WhatsApp. Please try again.",
        });
      }
    }
  }, [pairingCodeStatus, currentStep]);

  useEffect(() => {
    if (connectionStatus?.status === "connected" && currentStep === 2) {
      setIsPolling(false);
      setCurrentStep(3);
    }
  }, [connectionStatus, currentStep]);

  const stepOpacity = useSharedValue(1);

  function animateStep(nextStep: 1 | 2 | 3) {
    stepOpacity.value = withTiming(0, { duration: 150 }, () => {
      stepOpacity.value = withTiming(1, { duration: 300 });
    });
    setTimeout(() => setCurrentStep(nextStep), 150);
  }

  const stepAnimStyle = useAnimatedStyle(() => ({
    opacity: stepOpacity.value,
  }));

  function validatePhone(): boolean {
    const digits = phoneValue.replace(/\D/g, "");
    if (digits.length < 7) {
      setPhoneError("Please enter a valid phone number");
      return false;
    }
    setPhoneError(undefined);
    return true;
  }

  function startRetryCountdown() {
    if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
    setRetryCountdown(5);
    retryIntervalRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(retryIntervalRef.current!);
          retryIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function getPairingErrorMessage(e: any): string {
    const status: number = e?.httpStatus ?? 0;
    if (status === 400) return "Invalid phone number. Please check and try again.";
    if (status === 401) return "WhatsApp rejected the connection. Please try again.";
    if (status === 408) return "Request timed out. Check your internet and retry.";
    if (status === 409) return "WhatsApp is already connected. Go to Settings to manage it.";
    if (status === 428) return "Connection not ready. Wait a moment and try again.";
    if (status === 429) return "Too many attempts. Please wait 10 minutes.";
    if (status === 502) return "WhatsApp returned an empty code. Please try again.";
    return e?.message ?? "Could not connect to WhatsApp. Please try again.";
  }

  async function handleGetPairingCode() {
    if (!validatePhone()) return;
    const fullPhone = `${selectedCountry.dialCode}${phoneValue.replace(/\D/g, "")}`;
    try {
      const result = await requestPairingCode(fullPhone);
      setPairingCode(result.pairingCode);
      setPairingExpiresAt(result.expiresAt);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      animateStep(2);
    } catch (e: any) {
      startRetryCountdown();
      Toast.show({
        type: "error",
        text1: "Failed to get pairing code",
        text2: getPairingErrorMessage(e),
        visibilityTime: 5000,
      });
    }
  }

  async function handleRequestNewCode() {
    const fullPhone = `${selectedCountry.dialCode}${phoneValue.replace(/\D/g, "")}`;
    try {
      const result = await requestPairingCode(fullPhone);
      setPairingCode(result.pairingCode);
      setPairingExpiresAt(result.expiresAt);
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Failed to request new code",
        text2: e?.message ?? "Please try again.",
      });
    }
  }

  function handleLaterPress() {
    Alert.alert(
      "Are you sure?",
      "The code will expire and you will need to request a new one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, do it later",
          onPress: () => router.back(),
        },
      ]
    );
  }

  const topPad = Platform.OS === "web" ? 16 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + spacing.sm, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (currentStep === 2) {
              handleLaterPress();
            } else {
              router.back();
            }
          }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text, textAlign: "center", flex: 1 }]}>
          Connect WhatsApp
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <StepIndicator currentStep={currentStep} totalSteps={3} labels={STEP_LABELS} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.stepContainer, stepAnimStyle]}>
          {currentStep === 1 && <Step1
            colors={colors}
            selectedCountry={selectedCountry}
            phoneValue={phoneValue}
            phoneError={phoneError}
            isLoading={isRequestingCode}
            retryCountdown={retryCountdown}
            onCountryChange={setSelectedCountry}
            onPhoneChange={setPhoneValue}
            onSubmit={handleGetPairingCode}
          />}

          {currentStep === 2 && pairingCode && pairingExpiresAt && (
            <Step2
              colors={colors}
              pairingCode={pairingCode}
              expiresAt={pairingExpiresAt}
              isLoadingNew={isRequestingCode}
              onRequestNew={handleRequestNewCode}
              onLater={handleLaterPress}
            />
          )}

          {currentStep === 3 && (
            <Step3
              colors={colors}
              connectionStatus={connectionStatus}
            />
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Step1({
  colors,
  selectedCountry,
  phoneValue,
  phoneError,
  isLoading,
  retryCountdown,
  onCountryChange,
  onPhoneChange,
  onSubmit,
}: any) {
  const isValid = phoneValue.replace(/\D/g, "").length >= 7;
  const isDisabled = isLoading || retryCountdown > 0 || !isValid;

  return (
    <View style={styles.stepContent}>
      <View style={[styles.illustration, { backgroundColor: colors.primary }]}>
        <Ionicons name="phone-portrait-outline" size={40} color="#fff" />
      </View>

      <Text style={[typography.h2, { color: colors.text, textAlign: "center" }]}>
        Enter Your WhatsApp Number
      </Text>
      <Text style={[typography.body, { color: colors.secondaryText, textAlign: "center" }]}>
        This is the phone number registered on your WhatsApp account
      </Text>

      <View style={{ width: "100%", gap: spacing.sm }}>
        <PhoneInputField
          value={phoneValue}
          onChangeText={onPhoneChange}
          onCountryChange={onCountryChange}
          selectedCountry={selectedCountry}
          error={phoneError}
          disabled={isLoading}
        />
      </View>

      <View
        style={[
          styles.infoBox,
          { backgroundColor: colors.info + "15", borderColor: colors.info + "40" },
        ]}
      >
        <Ionicons name="information-circle-outline" size={18} color={colors.info} />
        <Text style={[typography.small, { color: colors.secondaryText, flex: 1 }]}>
          Your phone number is only used to generate a pairing code. WaTracker never stores your full phone number.
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          { backgroundColor: colors.primary, opacity: isDisabled ? 0.5 : 1 },
        ]}
        onPress={onSubmit}
        disabled={isDisabled}
        accessibilityLabel="Get pairing code"
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[typography.bodyMedium, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
            {retryCountdown > 0 ? `Try Again in ${retryCountdown}s` : "Get Pairing Code"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function Step2({
  colors,
  pairingCode,
  expiresAt,
  isLoadingNew,
  onRequestNew,
  onLater,
}: any) {
  const INSTRUCTIONS = [
    { num: "1", text: "Open WhatsApp on your phone", icon: "smartphone" as const },
    { num: "2", text: "Go to Settings \u2192 Linked Devices \u2192 Link a Device", icon: "settings" as const },
    { num: "3", text: "Tap 'Link with phone number instead' and enter the code above", icon: "key" as const },
  ];

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <Text style={[typography.h2, { color: colors.text, textAlign: "center" }]}>
        Enter This Code in WhatsApp
      </Text>
      <Text style={[typography.body, { color: colors.secondaryText, textAlign: "center" }]}>
        Open WhatsApp on your phone and follow the steps below
      </Text>

      <PairingCodeDisplay
        code={pairingCode}
        expiresAt={expiresAt}
        onRequestNew={onRequestNew}
        isLoadingNew={isLoadingNew}
      />

      <View style={[styles.instructionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {INSTRUCTIONS.map((row, idx) => (
          <View
            key={row.num}
            style={[
              styles.instructionRow,
              idx < INSTRUCTIONS.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={[styles.numCircle, { backgroundColor: colors.primary }]}>
              <Text style={[typography.small, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
                {row.num}
              </Text>
            </View>
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{row.text}</Text>
            <Feather name={row.icon} size={18} color={colors.muted} />
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={onLater}
        style={styles.laterBtn}
        accessibilityLabel="Do this later"
        accessibilityRole="button"
      >
        <Text style={[typography.bodyMedium, { color: colors.secondaryText }]}>
          I'll do this later
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function Step3({ colors, connectionStatus }: any) {
  const slideY = useSharedValue(20);
  const opacity = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(1);

  useEffect(() => {
    slideY.value = withTiming(0, { duration: 400 });
    opacity.value = withTiming(1, { duration: 400 });

    let count = 0;
    function pulse() {
      if (count >= 2) return;
      count++;
      ringScale.value = withTiming(1.6, { duration: 800 }, () => {
        ringScale.value = 1;
        ringOpacity.value = 1;
        pulse();
      });
      ringOpacity.value = withTiming(0, { duration: 800 });
    }
    pulse();
  }, []);

  const entryStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: slideY.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  return (
    <Animated.View style={[styles.stepContent, entryStyle]}>
      <View style={styles.successIconWrap}>
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.animatedRing,
            { borderColor: colors.primary },
            ringStyle,
          ]}
        />
        <View style={[styles.successCircle, { backgroundColor: colors.primary }]}>
          <Ionicons name="checkmark-outline" size={64} color="#fff" />
        </View>
      </View>

      <Text style={[typography.h1, { color: colors.primary, textAlign: "center" }]}>
        WhatsApp Connected!
      </Text>
      <Text style={[typography.body, { color: colors.secondaryText, textAlign: "center" }]}>
        WaTracker is now monitoring your WhatsApp activity
      </Text>

      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.shadow,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          },
        ]}
      >
        <View style={styles.infoCardRow}>
          <Feather name="phone" size={16} color={colors.primary} />
          <Text style={[typography.bodyMedium, { color: colors.text }]}>
            {connectionStatus?.phoneNumber ?? "Connected"}
          </Text>
        </View>
        <View style={[styles.infoCardDivider, { backgroundColor: colors.border }]} />
        <View style={styles.infoCardRow}>
          <Feather name="clock" size={16} color={colors.primary} />
          <Text style={[typography.bodyMedium, { color: colors.text }]}>
            {connectionStatus?.connectedAt
              ? `Connected ${formatRelativeTime(connectionStatus.connectedAt)}`
              : "Just now"}
          </Text>
        </View>
        <View style={[styles.infoCardDivider, { backgroundColor: colors.border }]} />
        <View style={styles.infoCardRow}>
          <Feather name="monitor" size={16} color={colors.primary} />
          <Text style={[typography.bodyMedium, { color: colors.text }]}>
            WaTracker Pro (Linked Device)
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          router.replace("/(tabs)");
        }}
        accessibilityLabel="Go to Dashboard"
        accessibilityRole="button"
      >
        <Text style={[typography.bodyMedium, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
          Go to Dashboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.outlinedBtn, { borderColor: colors.primary }]}
        onPress={() => router.replace("/(tabs)/settings")}
        accessibilityLabel="View Settings"
        accessibilityRole="button"
      >
        <Text style={[typography.bodyMedium, { color: colors.primary }]}>View Settings</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: spacing.base,
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    alignItems: "center",
    gap: spacing.base,
    paddingVertical: spacing.sm,
  },
  illustration: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: 10,
    borderWidth: 1,
    width: "100%",
  },
  primaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  outlinedBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  instructionsCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.base,
  },
  numCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  laterBtn: {
    paddingVertical: spacing.sm,
  },
  successIconWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.base,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  animatedRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  infoCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  infoCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.base,
  },
  infoCardDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.base,
  },
});
