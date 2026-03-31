import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/providers/AuthProvider";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

const { height: SCREEN_H } = Dimensions.get("window");

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function validatePassword(pw: string) {
  return pw.length >= 8 && /[0-9]/.test(pw) && /[a-zA-Z]/.test(pw);
}

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setField(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (mode === "register" && form.username.trim().length < 3) {
      errs.username = "Username must be at least 3 characters";
    }
    if (!validateEmail(form.email)) {
      errs.email = "Enter a valid email address";
    }
    if (!validatePassword(form.password)) {
      errs.password = "Password must be 8+ characters with letters and numbers";
    }
    if (mode === "register" && form.password !== form.confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      setErrors({ _global: e?.message ?? "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  const gradientHeight = SCREEN_H * 0.35;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={[colors.primaryDarkest, colors.primaryDark] as [string, string]}
        style={[styles.gradient, { height: gradientHeight, paddingTop: Platform.OS === "web" ? 67 : insets.top + 16 }]}
      >
        <View style={[styles.logoCircle, { backgroundColor: colors.surface }]}>
          <Ionicons name="phone-portrait" size={36} color={colors.primaryDarkest} />
        </View>
        <Text style={[typography.h2, { color: colors.headerText, marginTop: spacing.sm, textAlign: "center" }]}>
          WaTracker Pro
        </Text>
        <Text style={[typography.caption, { color: colors.headerText + "BF", textAlign: "center" }]}>
          WhatsApp Activity Monitor
        </Text>
      </LinearGradient>

      <ScrollView
        style={[styles.card, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.segmented, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          {(["login", "register"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.segment,
                mode === m && { backgroundColor: colors.primary, shadowColor: colors.primary },
              ]}
              onPress={() => {
                setMode(m);
                setErrors({});
              }}
            >
              <Text
                style={[
                  typography.bodyMedium,
                  { color: mode === m ? colors.headerText : colors.secondaryText },
                ]}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {errors._global ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.danger + "15", borderColor: colors.danger + "40" }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={[typography.caption, { color: colors.danger, flex: 1 }]}>{errors._global}</Text>
          </View>
        ) : null}

        {mode === "register" && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.secondaryText }]}>Username</Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: errors.username ? colors.danger : colors.border,
                },
              ]}
            >
              <Ionicons name="person-outline" size={18} color={errors.username ? colors.danger : colors.muted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Your name"
                placeholderTextColor={colors.muted}
                value={form.username}
                onChangeText={(t) => setField("username", t)}
                autoCapitalize="words"
              />
            </View>
            {errors.username ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{errors.username}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.secondaryText }]}>Email</Text>
          <View
            style={[
              styles.inputRow,
              {
                backgroundColor: colors.inputBg,
                borderColor: errors.email ? colors.danger : colors.border,
              },
            ]}
          >
            <Ionicons name="mail-outline" size={18} color={errors.email ? colors.danger : colors.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="your@email.com"
              placeholderTextColor={colors.muted}
              value={form.email}
              onChangeText={(t) => setField("email", t)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
          {errors.email ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{errors.email}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.secondaryText }]}>Password</Text>
          <View
            style={[
              styles.inputRow,
              {
                backgroundColor: colors.inputBg,
                borderColor: errors.password ? colors.danger : colors.border,
              },
            ]}
          >
            <Ionicons name="lock-closed-outline" size={18} color={errors.password ? colors.danger : colors.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              value={form.password}
              onChangeText={(t) => setField("password", t)}
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {errors.password ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{errors.password}</Text>
          ) : (
            mode === "register" && (
              <Text style={[styles.hint, { color: colors.muted }]}>8+ characters, include letters and numbers</Text>
            )
          )}
        </View>

        {mode === "register" && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.secondaryText }]}>Confirm Password</Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: errors.confirmPassword ? colors.danger : colors.border,
                },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={18} color={errors.confirmPassword ? colors.danger : colors.muted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                value={form.confirmPassword}
                onChangeText={(t) => setField("confirmPassword", t)}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{errors.confirmPassword}</Text>
            ) : null}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.75 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.headerText} />
          ) : (
            <Text style={[styles.submitText, { color: colors.headerText }]}>{mode === "login" ? "Sign In" : "Create Account"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  gradient: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: 4,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.xl,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  field: { marginBottom: spacing.base },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 12,
  },
  eyeBtn: { padding: 4 },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginLeft: 2,
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginLeft: 2,
  },
  submitBtn: {
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
