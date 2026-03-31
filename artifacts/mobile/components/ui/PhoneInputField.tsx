import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

export interface Country {
  code: string;
  dialCode: string;
  name: string;
}

const COUNTRIES: Country[] = [
  { code: "PK", dialCode: "+92", name: "Pakistan" },
  { code: "US", dialCode: "+1", name: "United States" },
  { code: "GB", dialCode: "+44", name: "United Kingdom" },
  { code: "IN", dialCode: "+91", name: "India" },
  { code: "AE", dialCode: "+971", name: "United Arab Emirates" },
  { code: "SA", dialCode: "+966", name: "Saudi Arabia" },
  { code: "AU", dialCode: "+61", name: "Australia" },
  { code: "CA", dialCode: "+1", name: "Canada" },
  { code: "DE", dialCode: "+49", name: "Germany" },
  { code: "FR", dialCode: "+33", name: "France" },
  { code: "TR", dialCode: "+90", name: "Turkey" },
  { code: "EG", dialCode: "+20", name: "Egypt" },
  { code: "NG", dialCode: "+234", name: "Nigeria" },
  { code: "ZA", dialCode: "+27", name: "South Africa" },
  { code: "BD", dialCode: "+880", name: "Bangladesh" },
  { code: "ID", dialCode: "+62", name: "Indonesia" },
  { code: "MY", dialCode: "+60", name: "Malaysia" },
  { code: "PH", dialCode: "+63", name: "Philippines" },
  { code: "SG", dialCode: "+65", name: "Singapore" },
  { code: "TH", dialCode: "+66", name: "Thailand" },
  { code: "AF", dialCode: "+93", name: "Afghanistan" },
  { code: "AL", dialCode: "+355", name: "Albania" },
  { code: "DZ", dialCode: "+213", name: "Algeria" },
  { code: "AR", dialCode: "+54", name: "Argentina" },
  { code: "AT", dialCode: "+43", name: "Austria" },
  { code: "BE", dialCode: "+32", name: "Belgium" },
  { code: "BR", dialCode: "+55", name: "Brazil" },
  { code: "CN", dialCode: "+86", name: "China" },
  { code: "CO", dialCode: "+57", name: "Colombia" },
  { code: "DK", dialCode: "+45", name: "Denmark" },
  { code: "ET", dialCode: "+251", name: "Ethiopia" },
  { code: "GH", dialCode: "+233", name: "Ghana" },
  { code: "GR", dialCode: "+30", name: "Greece" },
  { code: "IQ", dialCode: "+964", name: "Iraq" },
  { code: "IR", dialCode: "+98", name: "Iran" },
  { code: "IT", dialCode: "+39", name: "Italy" },
  { code: "JP", dialCode: "+81", name: "Japan" },
  { code: "JO", dialCode: "+962", name: "Jordan" },
  { code: "KE", dialCode: "+254", name: "Kenya" },
  { code: "KW", dialCode: "+965", name: "Kuwait" },
  { code: "LB", dialCode: "+961", name: "Lebanon" },
  { code: "LY", dialCode: "+218", name: "Libya" },
  { code: "MX", dialCode: "+52", name: "Mexico" },
  { code: "MA", dialCode: "+212", name: "Morocco" },
  { code: "NL", dialCode: "+31", name: "Netherlands" },
  { code: "NZ", dialCode: "+64", name: "New Zealand" },
  { code: "NO", dialCode: "+47", name: "Norway" },
  { code: "OM", dialCode: "+968", name: "Oman" },
  { code: "PS", dialCode: "+970", name: "Palestine" },
  { code: "PE", dialCode: "+51", name: "Peru" },
  { code: "PL", dialCode: "+48", name: "Poland" },
  { code: "PT", dialCode: "+351", name: "Portugal" },
  { code: "QA", dialCode: "+974", name: "Qatar" },
  { code: "RO", dialCode: "+40", name: "Romania" },
  { code: "RU", dialCode: "+7", name: "Russia" },
  { code: "ES", dialCode: "+34", name: "Spain" },
  { code: "LK", dialCode: "+94", name: "Sri Lanka" },
  { code: "SD", dialCode: "+249", name: "Sudan" },
  { code: "SE", dialCode: "+46", name: "Sweden" },
  { code: "CH", dialCode: "+41", name: "Switzerland" },
  { code: "SY", dialCode: "+963", name: "Syria" },
  { code: "TN", dialCode: "+216", name: "Tunisia" },
  { code: "UG", dialCode: "+256", name: "Uganda" },
  { code: "UA", dialCode: "+380", name: "Ukraine" },
  { code: "VN", dialCode: "+84", name: "Vietnam" },
  { code: "YE", dialCode: "+967", name: "Yemen" },
];

interface PhoneInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  onCountryChange: (country: Country) => void;
  selectedCountry: Country;
  error?: string;
  disabled?: boolean;
}

function FlagBadge({ code }: { code: string }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.flagBadge,
        { backgroundColor: colors.primary + "25" },
      ]}
    >
      <Text style={[styles.flagText, { color: colors.primary }]}>{code}</Text>
    </View>
  );
}

export function PhoneInputField({
  value,
  onChangeText,
  onCountryChange,
  selectedCountry,
  error,
  disabled,
}: PhoneInputFieldProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState("");

  const borderColor = error
    ? colors.danger
    : focused
    ? colors.primary
    : colors.border;

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.trim().toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <>
      <View>
        <View
          style={[
            styles.inputRow,
            {
              borderColor,
              backgroundColor: colors.inputBg,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.countryBtn, { borderRightColor: borderColor }]}
            onPress={() => !disabled && setModalVisible(true)}
            disabled={disabled}
            accessibilityLabel={`Country code selector, currently ${selectedCountry.name} ${selectedCountry.dialCode}`}
            accessibilityRole="button"
          >
            <FlagBadge code={selectedCountry.code} />
            <Text style={[typography.bodyMedium, { color: colors.text }]}>
              {selectedCountry.dialCode}
            </Text>
            <Feather name="chevron-down" size={14} color={colors.muted} />
          </TouchableOpacity>

          <TextInput
            style={[styles.textInput, { color: colors.text }]}
            value={value}
            onChangeText={onChangeText}
            placeholder="300 1234567"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={!disabled}
            accessibilityLabel="Phone number input"
          />
        </View>
        {error ? (
          <Text style={[typography.small, { color: colors.danger, marginTop: 4 }]}>
            {error}
          </Text>
        ) : null}
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Text style={[typography.h3, { color: colors.text }]}>Select Country</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close country selector"
              accessibilityRole="button"
            >
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.inputBg, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search" size={17} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search country..."
              placeholderTextColor={colors.muted}
              autoFocus
              accessibilityLabel="Search countries"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code + item.dialCode}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.base }}
            renderItem={({ item }) => {
              const isSelected = item.code === selectedCountry.code && item.dialCode === selectedCountry.dialCode;
              return (
                <TouchableOpacity
                  style={[
                    styles.countryRow,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.primary + "10" },
                  ]}
                  onPress={() => {
                    onCountryChange(item);
                    setModalVisible(false);
                    setSearch("");
                  }}
                  accessibilityLabel={`${item.name} ${item.dialCode}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <FlagBadge code={item.code} />
                  <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>
                    {item.name}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.secondaryText }]}>
                    {item.dialCode}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  countryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderRightWidth: 1,
  },
  flagBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flagText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    margin: spacing.base,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
