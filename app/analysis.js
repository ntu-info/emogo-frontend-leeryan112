// app/analysis.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Button,
} from "react-native";
import { getAllSamples } from "../db";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AnalysisScreen({ navigation }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const goHome = () => {
    if (navigation?.goHome) navigation.goHome();
  };

  useEffect(() => {
    setLoading(true);

    getAllSamples((rows) => {
      // 只保留有 mood、timestamp 的資料
      const cleaned = (rows || [])
        .map((r) => {
          const ts = r.timestamp ? new Date(r.timestamp) : null;
          return {
            ...r,
            _ts: ts,
          };
        })
        .filter((r) => r._ts && !isNaN(r._ts.getTime()) && r.mood != null);

      // 依照時間排序（舊→新）
      cleaned.sort((a, b) => a._ts - b._ts);

      setRecords(cleaned);
      setLoading(false);
    });
  }, [navigation]);

  // ========= 心情 vs 時間：點圖 =========
  const renderMoodTimeline = () => {
    if (records.length === 0) {
      return (
        <Text style={styles.emptyText}>
          目前還沒有任何紀錄，可以先去首頁記錄一筆心情再回來看看 😊
        </Text>
      );
    }

    const chartWidth = SCREEN_WIDTH - 40; // 左右各留點邊距
    const chartHeight = 200;
    const paddingX = 20;
    const paddingY = 20;

    const n = records.length;
    const points = records.map((r, index) => {
      // x：依照紀錄順序等距排，越新的在越右邊
      const ratioX = n === 1 ? 0.5 : index / (n - 1);
      const x =
        paddingX + ratioX * (chartWidth - paddingX * 2);

      // y：0~100 → 由下往上
      const moodVal = Number(r.mood) || 0;
      const clamped = Math.min(100, Math.max(0, moodVal));
      const ratioY = clamped / 100; // 0 在底部、100 在頂端
      const y =
        chartHeight - paddingY - ratioY * (chartHeight - paddingY * 2);

      const isMind = r.wasMindWandering === 1;

      return {
        x,
        y,
        isMind,
        id: r.id,
        dateLabel: formatDateShort(r._ts),
        timeLabel: formatTimeHM(r._ts),
        mood: clamped,
      };
    });

    // 為了讓 x 軸標籤不要太擠，只顯示少數幾個點的日期
    const labelIndices = pickLabelIndices(n);

    return (
      <View>
        <View style={[styles.chartBox, { height: chartHeight }]}>
          {/* 軸線 */}
          <View
            style={[
              styles.axisLine,
              {
                left: paddingX,
                top: paddingY,
                bottom: paddingY,
              },
            ]}
          />
          <View
            style={[
              styles.axisLine,
              {
                left: paddingX,
                right: paddingX,
                bottom: paddingY,
              },
            ]}
          />

          {/* 0 / 50 / 100 文字 */}
          <View
            style={[
              styles.yLabelRow,
              { top: chartHeight - paddingY - 2 },
            ]}
          >
            <Text style={styles.yLabelText}>0</Text>
          </View>
          <View
            style={[
              styles.yLabelRow,
              {
                top:
                  chartHeight / 2 - 6,
              },
            ]}
          >
            <Text style={styles.yLabelText}>50</Text>
          </View>
          <View
            style={[
              styles.yLabelRow,
              { top: paddingY - 8 },
            ]}
          >
            <Text style={styles.yLabelText}>100</Text>
          </View>

          {/* 點 */}
          {points.map((p, idx) => (
            <View
              key={p.id ?? idx}
              style={[
                styles.point,
                {
                  left: p.x - 5,
                  top: p.y - 5,
                  backgroundColor: p.isMind ? "#EF4444" : "#3B82F6",
                },
              ]}
            />
          ))}
        </View>

        {/* X 軸日期標籤 */}
        <View style={styles.xLabelRow}>
          {labelIndices.map((i) => {
            const p = points[i];
            if (!p) return null;
            return (
              <View
                key={`label-${i}`}
                style={[
                  styles.xLabelItem,
                  { left: p.x - 30 },
                ]}
              >
                <Text style={styles.xLabelText}>{p.dateLabel}</Text>
              </View>
            );
          })}
        </View>

        {/* 圖例 */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
            <Text style={styles.legendText}>沒有分心</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.legendText}>有分心</Text>
          </View>
        </View>
      </View>
    );
  };

  // ========= 活動 vs 平均心情：長條圖 =========
  const renderActivityBars = () => {
    // 聚合活動：計算平均 mood
    const groups = {};

    records.forEach((r) => {
      const name = (r.activity || "").trim() || "(未填寫)";
      if (!groups[name]) {
        groups[name] = { sum: 0, count: 0 };
      }
      groups[name].sum += Number(r.mood) || 0;
      groups[name].count += 1;
    });

    const items = Object.entries(groups).map(([name, v]) => ({
      name,
      avg: v.count ? v.sum / v.count : 0,
      count: v.count,
    }));

    if (items.length === 0) {
      return (
        <Text style={styles.emptyText}>
          目前還沒有任何活動紀錄，可以先記錄幾次心情再回來看看。
        </Text>
      );
    }

    // 依照平均心情由高到低排序，最多取前 6 個
    items.sort((a, b) => b.avg - a.avg);
    const topItems = items.slice(0, 6);
    const maxAvg = topItems.reduce(
      (m, it) => (it.avg > m ? it.avg : m),
      0
    );

    const chartHeight = 200;

    return (
      <View>
        <View style={[styles.barChartBox, { height: chartHeight }]}>
          {topItems.map((it, idx) => {
            const ratio = maxAvg ? it.avg / maxAvg : 0;
            const barHeight = ratio * (chartHeight - 50);

            return (
              <View key={it.name + idx} style={styles.barItem}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                    },
                  ]}
                />
                <Text style={styles.barLabel}>
                  {it.avg.toFixed(1)}
                </Text>
                <Text style={styles.barName} numberOfLines={2}>
                  {it.name}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.barHint}>
          * 每個長條代表一種活動，數值是該活動下「平均心情分數」。
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 8, color: "#4B5563" }}>
          正在讀取資料…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: "#F5F7FB" }}>
      <View style={styles.container}>
        <Text style={styles.title}>心情分析</Text>
        <Text style={styles.subtitle}>
          這裡幫你把過去的心情紀錄畫成圖表，看看自己在不同情境下的變化。
        </Text>

        {/* 圖一：時間 x 心情分數（點顏色＝分心與否） */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            1. 心情分數隨時間的變化
          </Text>
          <Text style={styles.sectionHint}>
            每一個點是一筆紀錄，越右邊代表越新的時間。
            點越高代表心情分數越好，紅色點代表當下有分心，藍色代表沒有分心。
          </Text>
          {renderMoodTimeline()}
        </View>

        {/* 圖二：不同活動的平均心情分數 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            2. 做哪些事情時心情比較好？
          </Text>
          <Text style={styles.sectionHint}>
            這裡顯示各種「正在做的事情」下的平均心情分數，
            讓你看看自己在哪些活動下感覺最放鬆或最愉快。
          </Text>
          {renderActivityBars()}
        </View>

        <View style={{ marginTop: 16, alignItems: "center", marginBottom: 24 }}>
          <Button title="← 回首頁" onPress={goHome} />
        </View>
      </View>
    </ScrollView>
  );
}

// ===== 小工具：日期格式 =====
function formatDateShort(d) {
  if (!d) return "";
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${m}/${day}`;
}

function formatTimeHM(d) {
  if (!d) return "";
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// 挑幾個 index 來放 x 軸日期標籤（避免每個點都擠在一起）
function pickLabelIndices(n) {
  if (n <= 3) {
    return Array.from({ length: n }, (_, i) => i);
  }
  return [0, Math.floor((n - 1) / 2), n - 1];
}

// ===== Styles =====
const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: 16,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },

  // 折線 / 點圖
  chartBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },
  axisLine: {
    position: "absolute",
    backgroundColor: "#D1D5DB",
  },
  yLabelRow: {
    position: "absolute",
    left: 4,
  },
  yLabelText: {
    fontSize: 10,
    color: "#6B7280",
  },
  point: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  xLabelRow: {
    marginTop: 4,
    height: 24,
  },
  xLabelItem: {
    position: "absolute",
    width: 60,
    alignItems: "center",
  },
  xLabelText: {
    fontSize: 10,
    color: "#6B7280",
  },
  legendRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: "#4B5563",
  },

  // 長條圖
  barChartBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 8,
    paddingBottom: 8,
    marginTop: 8,
  },
  barItem: {
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
    marginHorizontal: 4,
  },
  bar: {
    width: 20,
    borderRadius: 6,
    backgroundColor: "#34D399",
  },
  barLabel: {
    fontSize: 11,
    color: "#374151",
    marginTop: 4,
  },
  barName: {
    fontSize: 11,
    color: "#4B5563",
    textAlign: "center",
    marginTop: 2,
  },
  barHint: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
});
