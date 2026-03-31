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
  Alert,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/providers/AuthProvider";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({ username: "", email: "", password: "" });

  async function handleSubmit() {
    if (!form.email || !form.password) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        if (!form.username) {
          Alert.alert("Error", "Username is required");
          setLoading(false);
          return;
        }
        await register(form.username, form.email, form.password);
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#075E54", "#128C7E"]} style={styles.hero}>
        <View style={{ paddingTop: Platform.OS === "web" ? 67 : insets.top + 20 }}>
          <View style={styles.logoCircle}>
            <Ionicons name="phone-portrait" size={40} color="#075E54" />
          </View>
          <Text style={[typography.h2, { color: "#fff", marginTop: spacing.base, textAlign: "center" }]}>
            WaTracker Pro
          </Text>
          <Text style={[typography.caption, { color: "rgba(255,255,255,0.75)", textAlign: "center" }]}>
            WhatsApp Activity Monitor
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={[styles.form, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.toggle}>
          {["Sign In", "Create Account"].map((label, i) => {
            const active = (i === 0) === isLogin;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.toggleBtn, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setIsLogin(i === 0)}
              >
                <Text style={[typography.bodyMedium, { color: active ? colors.primary : colors.secondaryText }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!isLogin && (
          <View style={styles.field}>
            <Text style={[typography.label, { color: colors.secondaryText, marginBottom: 6 }]}>Username</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              value={form.username}
              onChangeText={(t) => setForm({ ...form, username: t })}
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={[typography.label, { color: colors.secondaryText, marginBottom: 6 }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            placeholder="your@email.com"
            placeholderTextColor={colors.muted}
            value={form.email}
            onChangeText={(t) => setForm({ ...form, email: t })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={[typography.label, { color: colors.secondaryText, marginBottom: 6 }]}>Password</Text>
          <View style={[styles.passWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <TextInput
              style={[styles.passInput, { color: colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              value={form.password}
              onChangeText={(t) => setForm({ ...form, password: t })}
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? "eye-off" : "eye"} size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[typography.bodyMedium, { color: "#fff" }]}>
              {isLogin ? "Sign In" : "Create Account"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.base, alignItems: "center" }}>
          <Text style={[typography.caption, { color: colors.secondaryText }]}>Continue without signing in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, paddingBottom: spacing.xl, alignItems: "center" },
  logoCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  form: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  toggle: { flexDirection: "row", marginBottom: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e9edef" },
  toggleBtn: { flex: 1, paddingVertical: spacing.md, alignItems: "center" },
  field: { marginBottom: spacing.base },
  input: { padding: spacing.md, borderRadius: 8, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  passWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1 },
  passInput: { flex: 1, padding: spacing.md, fontSize: 15, fontFamily: "Inter_400Regular" },
  submitBtn: { padding: spacing.base, borderRadius: 8, alignItems: "center", marginTop: spacing.sm },
});
