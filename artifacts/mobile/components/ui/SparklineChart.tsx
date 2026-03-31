import React from "react";
import { View } from "react-native";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

export function SparklineChart({ data, width = 80, height = 30, color = "#25D366", strokeWidth = 2 }: Props) {
  if (!data || data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pad = strokeWidth;

  const points = data.map((v, i) => ({
    x: i * step,
    y: pad + ((max - v) / range) * (height - pad * 2),
  }));

  const bars = data.map((v, i) => {
    const barH = ((v - min) / range) * (height - pad * 2);
    const barW = Math.max(step * 0.6, 2);
    return { x: i * step - barW / 2, y: height - pad - barH, w: barW, h: barH };
  });

  return (
    <View style={{ width, height, flexDirection: "row", alignItems: "flex-end" }}>
      {bars.map((b, i) => (
        <View
          key={i}
          style={{
            width: b.w,
            height: Math.max(b.h, 1),
            backgroundColor: color,
            marginRight: step - b.w,
            opacity: 0.7 + (data[i] / max) * 0.3,
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
}
