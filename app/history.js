// app/history.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Button,
  Alert,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Video } from "expo-av";
import * as Sharing from "expo-sharing";
import {
  getAllSamples,
  deleteSampleById,
} from "../db";

export default function HistoryScreen({ navigation }) {
  const [records, setRecords] = useState([]);
  const isWeb = Platform.OS === "web";

  const loadRecords = () => {
    getAllSamples((rows) => {
      setRecords(rows || []);
    });
  };

  useEffect(() => {
    loadRecords();
  }, [navigation]);

  const goHome = () => {
    navigation?.goHome?.();
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return { date: "", time: "" };
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return { date: "", time: "" };
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return {
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hh}:${min}`,
    };
  };

  const formatMindWandering = (val) => {
    if (val === 1) return "有分心";
    if (val === 0) return "沒有分心";
    return "（未填寫）";
  };

  const formatGps = (row) => {
    if (row.latitude == null || row.longitude == null) return "（無資料）";
    return `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`;
  };

  // 分享 / 下載影片
  const shareVideo = async (uri) => {
    if (!uri) {
      Alert.alert("找不到影片", "這筆紀錄沒有影片可以分享。");
      return;
    }
    if (isWeb) {
      Alert.alert("僅限手機使用", "影片分享需在手機 App 上使用。");
      return;
    }

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("無法分享", "此裝置目前不支援分享/下載影片。");
        return;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: "分享 / 下載這段 1 秒 vlog",
      });
    } catch (e) {
      console.log("share video error:", e);
      Alert.alert("分享失敗", "分享影片時發生錯誤，請稍後再試。");
    }
  };

  // 刪除單筆紀錄
  const deleteRecord = (id) => {
    Alert.alert("刪除紀錄", "確定要刪除這筆紀錄嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: () => {
          deleteSampleById(id, (ok) => {
            if (!ok) {
              Alert.alert("錯誤", "刪除時發生問題，請稍後再試。");
              return;
            }
            loadRecords();
          });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>過去填答紀錄</Text>
      <Text style={styles.subtitle}>
        以下是存在本機的心情紀錄與 1 秒 vlog（若有錄製）。
      </Text>

      <ScrollView style={styles.scroll}>
        {records.length === 0 && (
          <Text style={styles.emptyText}>目前還沒有任何紀錄。</Text>
        )}

        {records.map((row) => {
          const { date, time } = formatDateTime(row.timestamp);
          const mw = formatMindWandering(row.wasMindWandering);
          const gps = formatGps(row);

          return (
            <View key={row.id} style={styles.card}>
              <View style={styles.rowHeader}>
                <Text style={styles.dateText}>{date}</Text>
                <Text style={styles.timeText}>{time}</Text>
              </View>

              <Text style={styles.label}>
                心情分數：<Text style={styles.value}>{row.mood ?? "—"}</Text>
              </Text>

              <Text style={styles.label}>
                正在做的事情：
                <Text style={styles.value}>
                  {row.activity || "（未填寫）"}
                </Text>
              </Text>

              <Text style={styles.label}>
                是否分心：
                <Text style={styles.value}>{mw}</Text>
              </Text>

              <Text style={styles.label}>
                GPS：
                <Text style={styles.value}>{gps}</Text>
              </Text>

              {/* 如果有影片就顯示 Video + 分享按鈕 */}
              {row.video_uri ? (
                <View style={styles.videoBlock}>
                  <Text style={styles.label}>1 秒 vlog：</Text>
                  <Video
                    style={styles.video}
                    source={{ uri: row.video_uri }}
                    useNativeControls
                    resizeMode="cover"
                  />
                  <View style={styles.videoButtonsRow}>
                    <Button
                      title="分享 / 下載影片"
                      onPress={() => shareVideo(row.video_uri)}
                    />
                  </View>
                </View>
              ) : (
                <Text style={styles.noVideoText}>沒有錄製 vlog</Text>
              )}

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteRecord(row.id)}
                >
                  <Text style={styles.deleteText}>刪除這筆紀錄</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="← 回首頁" onPress={goHome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 12,
    backgroundColor: "#F5F7FB",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    textAlign: "center",
    color: "#666",
    marginBottom: 8,
  },
  scroll: {
    marginTop: 8,
  },
  emptyText: {
    textAlign: "center",
    color: "#777",
    marginTop: 24,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "600",
  },
  timeText: {
    fontSize: 13,
    color: "#4B5563",
  },
  label: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 2,
  },
  value: {
    fontWeight: "500",
    color: "#111827",
  },
  videoBlock: {
    marginTop: 8,
  },
  video: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#000",
    marginTop: 4,
  },
  videoButtonsRow: {
    marginTop: 8,
    alignItems: "flex-start",
  },
  noVideoText: {
    marginTop: 4,
    fontSize: 12,
    color: "#9CA3AF",
  },
  cardFooter: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteText: {
    fontSize: 12,
    color: "#DC2626",
  },
  footer: {
    paddingVertical: 12,
    alignItems: "center",
  },
});
