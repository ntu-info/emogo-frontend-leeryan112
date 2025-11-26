// app/(tabs)/settings.js
import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  TextInput,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Keyboard,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getAllSamples } from "../../db";

// --------- module-level：記住「最後一次」的時段設定（app 沒關之前都會記得）---------
let lastWindows = [
  { id: 1, startMinutes: 9 * 60, endMinutes: 12 * 60, count: "1" },
  { id: 2, startMinutes: 12 * 60, endMinutes: 15 * 60, count: "1" },
];

export default function SettingsScreen({ navigation }) {
  const isWeb = Platform.OS === "web";

  // 每個時段：startMinutes / endMinutes / count
  const [windows, setWindows] = useState(lastWindows);

  // 讓所有修改 windows 的地方，都會同步更新 lastWindows
  const setAndPersistWindows = (updater) => {
    setWindows((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : updater;
      lastWindows = next;
      return next;
    });
  };

  // 目前在調哪一個時間（哪個時段的 start / end）
  const [activePicker, setActivePicker] = useState(null); // {id, field} or null

  // ========= 工具：分鐘 ↔ Date / 顯示文字 =========
  const minutesToLabel = (m) => {
    const h24 = Math.floor(m / 60);
    const minute = m % 60;
    const isPM = h24 >= 12;
    const period = isPM ? "下午" : "上午";
    const hour12 = ((h24 + 11) % 12) + 1;
    const hh = hour12.toString().padStart(2, "0");
    const mm = minute.toString().padStart(2, "0");
    return `${period} ${hh}:${mm}`;
  };

  const dateFromMinutes = (m) => {
    const now = new Date();
    const h24 = Math.floor(m / 60);
    const minute = m % 60;
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      h24,
      minute,
      0,
      0
    );
  };

  const minutesFromDate = (d) => d.getHours() * 60 + d.getMinutes();

  // ========= 通知權限 =========
  const askPermission = async () => {
    if (isWeb) {
      Alert.alert("僅限手機使用", "通知功能需在手機 App 上執行。");
      return;
    }
    const { status: currentStatus } = await Notifications.getPermissionsAsync();
    if (currentStatus === "granted") {
      Alert.alert("通知權限狀態", "已允許 ✅");
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    Alert.alert("通知權限狀態", status === "granted" ? "已允許 ✅" : "未允許 ❌");
  };

  // ========= 時段陣列操作 =========
  const updateWindowField = (id, field, value) => {
    setAndPersistWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    );
  };

  const addWindow = () => {
    setAndPersistWindows((prev) => [
      ...prev,
      {
        id: Date.now(),
        startMinutes: 15 * 60,
        endMinutes: 18 * 60,
        count: "1",
      },
    ]);
  };

  const removeWindow = (id) => {
    setAndPersistWindows((prev) => {
      if (prev.length <= 1) {
        Alert.alert("提醒", "至少保留一個時段。");
        return prev;
      }
      return prev.filter((w) => w.id !== id);
    });
  };

  const openPicker = (id, field) => {
    if (isWeb) {
      Alert.alert("僅限手機使用", "時間滾輪需在手機上使用。");
      return;
    }
    setActivePicker({ id, field });
    Keyboard.dismiss();
  };

  // ========= 排程：只排「接下來 24 小時內」的隨機時間 =========
  const scheduleByWindows = async () => {
    if (isWeb) {
      Alert.alert("僅限手機使用", "排程通知需在手機 App 上執行。");
      return;
    }

    // 1. 權限
    const { status: currentStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = currentStatus;
    if (currentStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      Alert.alert(
        "沒有通知權限",
        "請到 iPhone 的「設定 → 通知 → Emogo」中允許通知。"
      );
      return;
    }

    // 2. 檢查 / 整理時段
    const parsed = [];
    for (const w of windows) {
      const n = parseInt(w.count || "0", 10);
      if (!n || n < 1) {
        Alert.alert(
          "次數有問題",
          `請確認「${minutesToLabel(w.startMinutes)} ~ ${minutesToLabel(
            w.endMinutes
          )}」的次數是大於 0 的整數。`
        );
        return;
      }
      if (w.endMinutes <= w.startMinutes) {
        Alert.alert(
          "時間區間錯誤",
          `結束時間必須晚於開始時間：${minutesToLabel(
            w.startMinutes
          )} ~ ${minutesToLabel(w.endMinutes)}`
        );
        return;
      }
      parsed.push({
        id: w.id,
        startMinutes: w.startMinutes,
        endMinutes: w.endMinutes,
        count: n,
      });
    }

    // 3. 清掉舊排程
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const labels = [];
    const promises = [];

    // 4. 只排「今天剩下時間 + 明天凌晨到該時段結束」這一段 24h 內
    for (const w of parsed) {
      const span = w.endMinutes - w.startMinutes;

      for (let i = 0; i < w.count; i++) {
        const offset = Math.floor(Math.random() * span);
        const minuteOfDay = w.startMinutes + offset;

        // 今天已過這個時間，就排到「明天」；否則排在「今天」
        const dayOffset = minuteOfDay > nowMinutes ? 0 : 1;

        const fireDate = new Date(now);
        fireDate.setDate(now.getDate() + dayOffset);
        const hour24 = Math.floor(minuteOfDay / 60);
        const minute = minuteOfDay % 60;
        fireDate.setHours(hour24, minute, 0, 0);

        if (fireDate.getTime() <= Date.now()) {
          fireDate.setTime(Date.now() + 2000);
        }

        const p = Notifications.scheduleNotificationAsync({
          content: {
            title: "Emogo 提醒",
            body: "來記錄一下這一刻的心情 🌱",
          },
          trigger: fireDate,
        });
        promises.push(p);

        const labelPrefix = dayOffset === 0 ? "今天" : "明天";
        labels.push(`${labelPrefix} ${minutesToLabel(minuteOfDay)}`);
      }
    }

    await Promise.all(promises);

    Alert.alert(
      "已排定接下來 24 小時的提醒",
      labels.length === 0
        ? "目前沒有任何有效時段。"
        : labels.join("\n")
    );
  };

  // ========= 匯出 CSV（date,time,mood_score,activity,mind_wandering,mind_content,gps） =========
  const exportDataAsCSV = () => {
    if (isWeb) {
      Alert.alert("僅限手機使用", "匯出功能需在手機 App 上執行。");
      return;
    }

    getAllSamples(async (rows) => {
      try {
        const header = [
          "date",
          "time",
          "mood_score",
          "activity",
          "mind_wandering",
          "mind_content",
          "gps",
        ].join(",");

        const safe = (v) =>
          String(v ?? "")
            .replace(/,/g, " ")      // 避免逗號切欄
            .replace(/\r?\n/g, " "); // 避免換行打爆一列

        const csvRows = (rows || []).map((row) => {
          let dateStr = "";
          let timeStr = "";

          if (row.timestamp) {
            const ts = new Date(row.timestamp);
            if (!isNaN(ts.getTime())) {
              const yyyy = ts.getFullYear();
              const mm = String(ts.getMonth() + 1).padStart(2, "0");
              const dd = String(ts.getDate()).padStart(2, "0");
              dateStr = `${yyyy}-${mm}-${dd}`;

              const hh = String(ts.getHours()).padStart(2, "0");
              const min = String(ts.getMinutes()).padStart(2, "0");
              timeStr = `${hh}:${min}`;
            }
          }

          let mindFlag = "";
          if (row.wasMindWandering === 1) mindFlag = "yes";
          else if (row.wasMindWandering === 0) mindFlag = "no";

          let gpsRaw = "";
          if (row.latitude != null && row.longitude != null) {
            gpsRaw = `${row.latitude},${row.longitude}`;
          }

          return [
            dateStr,
            timeStr,
            row.mood ?? "",
            safe(row.activity),
            mindFlag,
            safe(row.mindContent),
            safe(gpsRaw),
          ].join(",");
        });

        const csvString = [header, ...csvRows].join("\n");

        const fileUri = FileSystem.cacheDirectory + "emogo_export.csv";
        await FileSystem.writeAsStringAsync(fileUri, csvString, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert(
            "無法開啟分享面板",
            "檔案已產生在 App 的暫存空間，但此裝置目前不支援分享功能。"
          );
          return;
        }

        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export Emogo records",
        });
      } catch (e) {
        console.log("CSV export error:", e);
        Alert.alert("錯誤", "匯出 CSV 時發生問題。");
      }
    });
  };

  const goHome = () => {
    if (navigation?.goHome) navigation.goHome();
  };

  // picker 當前值
  let pickerValue = null;
  if (activePicker) {
    const win = windows.find((w) => w.id === activePicker.id);
    if (win) {
      const mins =
        activePicker.field === "start"
          ? win.startMinutes
          : win.endMinutes;
      pickerValue = dateFromMinutes(mins);
    }
  }

  return (
    <View style={styles.root}>
      {/* 可捲動內容 */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.title}>設定與資料</Text>

          {/* 通知設定 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>通知設定</Text>
            <Text style={styles.sectionHint}>
              你可以設定好幾個時段，讓 Emogo 在那些時間裡隨機提醒你記錄心情。
            </Text>

            <Button title="詢問通知權限" onPress={askPermission} />

            <View style={{ marginTop: 12 }}>
              {windows.map((w, idx) => (
                <View key={w.id} style={styles.windowRow}>
                  <Text style={styles.windowLabel}>時段 {idx + 1}</Text>

                  <View style={styles.windowLine}>
                    <Pressable
                      onPress={() => openPicker(w.id, "start")}
                      style={styles.timeBox}
                    >
                      <Text style={styles.timeLabel}>開始</Text>
                      <Text style={styles.timeValue}>
                        {minutesToLabel(w.startMinutes)}
                      </Text>
                    </Pressable>

                    <Text style={{ marginHorizontal: 4 }}>~</Text>

                    <Pressable
                      onPress={() => openPicker(w.id, "end")}
                      style={styles.timeBox}
                    >
                      <Text style={styles.timeLabel}>結束</Text>
                      <Text style={styles.timeValue}>
                        {minutesToLabel(w.endMinutes)}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.windowLine}>
                    <Text style={{ fontSize: 13, marginRight: 4 }}>
                      這個時段隨機發送：
                    </Text>
                    <TextInput
                      style={styles.countInput}
                      value={w.count}
                      onChangeText={(v) =>
                        updateWindowField(w.id, "count", v)
                      }
                      keyboardType="number-pad"
                      placeholder="1"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                    <Text style={{ fontSize: 13, marginLeft: 4 }}>
                      次 / 每日
                    </Text>
                  </View>

                  <View style={styles.windowFooterRow}>
                    <Text style={styles.windowHint}>
                      例如：上午 09:00 ~ 中午 12:00，1 次 ⇒
                      這段時間內會隨機挑一個時間跳通知。
                    </Text>
                    {windows.length > 1 && (
                      <Text
                        style={styles.removeLink}
                        onPress={() => removeWindow(w.id)}
                      >
                        刪除此時段
                      </Text>
                    )}
                  </View>
                </View>
              ))}

              <View style={{ marginTop: 8, marginBottom: 4 }}>
                <Button title="＋ 新增時段" onPress={addWindow} />
              </View>

              <Button title="套用每日隨機排程" onPress={scheduleByWindows} />
              {isWeb && (
                <Text style={styles.note}>
                  * 目前在瀏覽器中無法實際排程通知，需在手機實機上操作。
                </Text>
              )}
            </View>
          </View>

          {/* 匯出資料區塊 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>資料匯出</Text>
            <Text style={styles.sectionHint}>
              匯出的 CSV 檔可以用 Excel、Google 試算表或 R / Python 做後續分析。
            </Text>
            <Button title="匯出資料為 CSV" onPress={exportDataAsCSV} />
            {isWeb && (
              <Text style={styles.note}>
                * 匯出功能需在手機 App 上使用，這裡先提供介面預覽。
              </Text>
            )}
          </View>

          <View style={styles.footer}>
            <Button title="← 回到首頁" onPress={goHome} />
          </View>
        </View>
      </ScrollView>

      {/* 浮在畫面上的時間滾輪（iOS / Android 實機） */}
      {activePicker && !isWeb && pickerValue && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerLabel}>
              {activePicker.field === "start"
                ? "調整開始時間"
                : "調整結束時間"}
            </Text>
            <View style={styles.pickerWheelContainer}>
              <DateTimePicker
                value={pickerValue}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                textColor="#111827"
                themeVariant="light"
                onChange={(_, date) => {
                  if (!date) return;
                  const mins = minutesFromDate(date);
                  setAndPersistWindows((prev) =>
                    prev.map((w) => {
                      if (w.id !== activePicker.id) return w;
                      if (activePicker.field === "start") {
                        return { ...w, startMinutes: mins };
                      } else {
                        return { ...w, endMinutes: mins };
                      }
                    })
                  );
                }}
                style={{ flex: 1 }}
              />
            </View>
            <Button title="完成" onPress={() => setActivePicker(null)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  container: {
    padding: 16,
    paddingTop: 40,
  },
  title: {
    fontSize: 22,
    marginBottom: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: "#777",
    marginBottom: 8,
  },
  note: {
    fontSize: 11,
    color: "#777",
    marginTop: 4,
  },
  footer: {
    marginTop: "auto",
    alignItems: "center",
    paddingVertical: 16,
  },

  // 時段 UI
  windowRow: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#F9FAFB",
  },
  windowLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  windowLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  timeBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#FFFFFF",
  },
  timeLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  timeValue: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  countInput: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
    backgroundColor: "#FFF",
    textAlign: "center",
  },
  windowFooterRow: {
    marginTop: 4,
  },
  windowHint: {
    fontSize: 11,
    color: "#6B7280",
  },
  removeLink: {
    fontSize: 11,
    color: "#EF4444",
    marginTop: 2,
    textDecorationLine: "underline",
  },

  // 滾輪時間選擇：浮在整個畫面底部
  pickerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },
  pickerCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  pickerLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  pickerWheelContainer: {
    height: 230,
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    marginBottom: 8,
  },
});
