import React from "react";
import { Switch } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ value, onValueChange, disabled }: Props) {
  const colors = useColors();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor="#fff"
      ios_backgroundColor={colors.border}
    />
  );
}
