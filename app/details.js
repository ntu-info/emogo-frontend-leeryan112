// app/details.js
import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  TextInput,
  Alert,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import { insertSample } from "../db";

// ---- 模組層級歷史紀錄（同一輪執行都共用） ----
let activityHistory = [];
let mindHistory = [];

const MOOD_ANCHORS = [
  { value: 0, label: "非常不好", emoji: "😣" },
  { value: 25, label: "有點不好", emoji: "😕" },
  { value: 50, label: "普通", emoji: "😐" },
  { value: 75, label: "有點好", emoji: "🙂" },
  { value: 100, label: "非常好", emoji: "😄" },
];

export default function DetailsScreen({ navigation }) {
  const [step, setStep] = useState(1);

  // Step 1: 心情
  const [mood, setMood] = useState(50);
  const [sliderTouched, setSliderTouched] = useState(false);

  // Step 2: 活動、分心、vlog
  const [activity, setActivity] = useState("");
  const [activitySuggestions, setActivitySuggestions] = useState(activityHistory);
  const [wasMindWandering, setWasMindWandering] = useState(null);

  // Step 3: 分心內容
  const [mindContent, setMindContent] = useState("");
  const [mindSuggestions, setMindSuggestions] = useState(mindHistory);

  // GPS
  const [coords, setCoords] = useState(null);
  const [locationError, setLocationError] = useState(null);

  // 相機相關
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasVlog, setHasVlog] = useState(false);
  const [videoUri, setVideoUri] = useState(null);

  const goHome = () => navigation.goHome?.();

  // 進入頁面時抓定位
  useEffect(() => {
    if (Platform.OS === "web") return;

    (async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationError("未取得定位權限");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setCoords(loc.coords);
      } catch (e) {
        setLocationError("取得定位時發生錯誤");
      }
    })();
  }, []);

  // ================= 相機流程 =================

  const openCamera = async () => {
    if (Platform.OS === "web") {
      Alert.alert("僅限手機使用", "錄影功能只能在手機 App 上使用。");
      return;
    }

    // 尚未詢問過權限
    if (!permission || permission.status == null) {
      const p = await requestPermission();
      if (p.status !== "granted") {
        Alert.alert("需要相機權限", "請到系統設定中開啟相機權限。");
        return;
      }
    }

    if (!permission.granted) {
      Alert.alert("需要相機權限", "請到系統設定中開啟相機權限。");
      return;
    }

    setShowCamera(true);
  };

  const handleRecord = async () => {
    if (!cameraRef.current) return;

    try {
      setIsRecording(true);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 1,
        quality: "480p",
      });

      setIsRecording(false);
      setShowCamera(false);

      if (video?.uri) {
        setHasVlog(true);
        setVideoUri(video.uri);
        Alert.alert("成功錄製 1 秒 vlog", "影片已暫存在本機裝置。");
      }
    } catch (e) {
      console.log("record error:", e);
      setIsRecording(false);
      setShowCamera(false);
      Alert.alert("錄影錯誤", "錄影過程發生問題，請再試一次。");
    }
  };

  const cancelCamera = () => {
    if (isRecording) return;
    setShowCamera(false);
  };

  // ============ 相機畫面（獨立 render） ============
  if (showCamera && Platform.OS !== "web") {
    if (!permission || permission.status == null) {
      return (
        <View style={styles.cameraContainer}>
          <Text style={{ color: "#FFF", textAlign: "center", marginTop: 40 }}>
            正在確認相機權限…
          </Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.cameraContainer}>
          <Text style={{ color: "#FFF", textAlign: "center", margin: 20 }}>
            目前沒有相機權限，請到系統設定中開啟。
          </Text>
          <Button title="回到問卷" onPress={() => setShowCamera(false)} />
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          mode="video"
        >
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraHint}>
              {isRecording ? "錄影中…" : "錄製 1 秒 vlog"}
            </Text>
            <View style={styles.cameraButtonRow}>
              <Button
                title={isRecording ? "錄影中…" : "開始錄影"}
                onPress={handleRecord}
                disabled={isRecording}
              />
              <Button title="取消" onPress={cancelCamera} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  // ================= Step 切換 =================

  const nextFromStep1 = () => {
    if (!sliderTouched) {
      Alert.alert("請先調整拉桿", "往左或往右移動一下，再按下一步唷。");
      return;
    }
    setStep(2);
  };

  const nextFromStep2 = () => {
    const trimmed = (activity || "").trim();

    if (!trimmed) {
      Alert.alert("請填寫內容", "請簡單寫一下你剛剛主要在做的事情。");
      return;
    }
    if (wasMindWandering == null) {
      Alert.alert("請選擇一個選項", "請回答剛剛有沒有分心想其他事情。");
      return;
    }

    // ★ 在這邊就先更新「正在做什麼」的歷史紀錄 → 之後回來 Step 2 就會看到 chips
    activityHistory = [trimmed, ...activityHistory.filter((x) => x !== trimmed)].slice(
      0,
      8
    );
    setActivitySuggestions(activityHistory);

    setStep(wasMindWandering ? 3 : 4);
  };

  const nextFromStep3 = () => {
    const trimmed = (mindContent || "").trim();

    if (!trimmed) {
      Alert.alert("請填寫內容", "請簡單寫一下分心時在想什麼。");
      return;
    }

    // ★ 在這邊更新「分心內容」歷史紀錄
    mindHistory = [trimmed, ...mindHistory.filter((x) => x !== trimmed)].slice(
      0,
      8
    );
    setMindSuggestions(mindHistory);

    setStep(4);
  };

  // ================= 儲存 =================

  const handleSave = () => {
    const timestamp = new Date().toISOString();

    const record = {
      timestamp,
      mood,
      activity,
      wasMindWandering,
      mindContent: wasMindWandering ? mindContent : null,
      hasVlog,
      videoUri,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    };

    // 再保險一次：儲存時也同步更新歷史紀錄
    if ((activity || "").trim()) {
      const a = activity.trim();
      activityHistory = [a, ...activityHistory.filter((x) => x !== a)].slice(
        0,
        8
      );
      setActivitySuggestions(activityHistory);
    }

    if (wasMindWandering && (mindContent || "").trim()) {
      const m = mindContent.trim();
      mindHistory = [m, ...mindHistory.filter((x) => x !== m)].slice(0, 8);
      setMindSuggestions(mindHistory);
    }

    insertSample(record, (ok) => {
      if (!ok) {
        Alert.alert("儲存失敗", "寫入本機資料庫時發生問題，請稍後再試。");
        return;
      }
      Alert.alert("已儲存", "這次的紀錄已存到本機 SQLite。", [
        { text: "回首頁", onPress: goHome },
      ]);
    });
  };

  // ================= Step 指示器 =================
  const renderStepIndicator = () => {
    const steps = ["心情", "正在做什麼", "分心內容", "摘要"];

    return (
      <View style={styles.stepIndicatorRow}>
        {steps.map((label, index) => {
          const stepIndex = index + 1;
          const active = stepIndex === step;
          const done = stepIndex < step;
          return (
            <View key={label} style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  active && styles.stepCircleActive,
                  done && styles.stepCircleDone,
                ]}
              >
                <Text style={styles.stepCircleText}>{stepIndex}</Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  active && styles.stepLabelActive,
                  done && styles.stepLabelDone,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // ================= Step 1：心情 =================
  const renderStep1 = () => {
    const anchor =
      MOOD_ANCHORS.reduce((a, b) =>
        Math.abs(b.value - mood) < Math.abs(a.value - mood) ? b : a
      );

    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>現在的心情</Text>
        <Text style={styles.sectionHint}>
          0 代表非常不好，100 代表非常好。數字越大代表心情越好 💖
        </Text>

        <View style={styles.moodAnchorRow}>
          {MOOD_ANCHORS.map((a) => (
            <View key={a.value} style={styles.moodAnchorItem}>
              <Text style={styles.moodAnchorEmoji}>{a.emoji}</Text>
              <Text style={styles.moodAnchorValue}>{a.value}</Text>
            </View>
          ))}
        </View>

        <Slider
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={mood}
          onValueChange={(v) => {
            setMood(v);
            if (!sliderTouched) setSliderTouched(true);
          }}
        />

        <Text style={styles.moodValueText}>
          目前：{mood} 分（{anchor.emoji} {anchor.label}）
        </Text>

        <View style={styles.navRow}>
          <Button
            title="下一步"
            disabled={!sliderTouched}
            onPress={nextFromStep1}
          />
        </View>
      </View>
    );
  };

  // ================= Step 2：在做什麼 + 分心 + vlog =================
  const renderStep2 = () => (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>剛剛在做什麼？</Text>
      <Text style={styles.sectionHint}>
        請記錄「在按下記錄之前」你主要在做的事情，例如：讀書、寫報告、跟人聊天…
      </Text>

      <TextInput
        style={[styles.input, styles.inputWide]}
        value={activity ?? ""}
        onChangeText={(t) => setActivity(t ?? "")}
        placeholder=""
      />

      {activitySuggestions.length > 0 && (
        <>
          <Text style={styles.chipTitle}>
            歷史紀錄（點一下快速填寫）：
          </Text>
          <View style={styles.chipRow}>
            {activitySuggestions.map((item) => (
              <Pressable
                key={item}
                onPress={() => setActivity(item)}
                style={[
                  styles.chip,
                  activity === item && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    activity === item && styles.chipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* vlog 錄影 */}
      <View style={{ marginTop: 16 }}>
        <Text style={styles.sectionTitle}>錄製 1 秒 vlog（選填）</Text>
        <Text style={styles.sectionHint}>
          會開啟相機錄製 1 秒的小影片，僅存放在本機，不會自動上傳。
        </Text>
        <Button
          title={hasVlog ? "已錄製（可再錄覆蓋）" : "錄製 1 秒 vlog"}
          onPress={openCamera}
        />
      </View>

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>剛剛有沒有分心想其他事情？</Text>
      <Text style={styles.sectionHint}>
        例如想到之後行程、某段對話、或還沒做完的事情等。
      </Text>

      <Pressable
        style={[
          styles.mwButton,
          wasMindWandering === false && styles.mwButtonSelected,
        ]}
        onPress={() => setWasMindWandering(false)}
      >
        <Text
          style={[
            styles.mwButtonText,
            wasMindWandering === false && styles.mwButtonTextSelected,
          ]}
        >
          沒有，大部分時間都專心在做這件事
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.mwButton,
          wasMindWandering === true && styles.mwButtonSelected,
        ]}
        onPress={() => setWasMindWandering(true)}
      >
        <Text
          style={[
            styles.mwButtonText,
            wasMindWandering === true && styles.mwButtonTextSelected,
          ]}
        >
          有，有一段時間分心想到其他事情
        </Text>
      </Pressable>

      <View style={styles.navRowBetween}>
        <Button title="上一步" onPress={() => setStep(1)} />
        <Button title="下一步" onPress={nextFromStep2} />
      </View>
    </View>
  );

  // ================= Step 3：分心內容 =================
  const renderStep3 = () => (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>分心的時候在想什麼？</Text>
      <Text style={styles.sectionHint}>
        不用寫得很詳細，簡單寫一下主題就好，例如「之後的工作」「跟某人的對話」等。
      </Text>

      <TextInput
        style={[styles.input, styles.inputWide, styles.noteInput]}
        value={mindContent ?? ""}
        onChangeText={(t) => setMindContent(t ?? "")}
        placeholder=""
        multiline
      />

      {mindSuggestions.length > 0 && (
        <>
          <Text style={styles.chipTitle}>
            歷史紀錄（點一下快速填寫）：
          </Text>
          <View style={styles.chipRow}>
            {mindSuggestions.map((item) => (
              <Pressable
                key={item}
                onPress={() => setMindContent(item)}
                style={[
                  styles.chip,
                  mindContent === item && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    mindContent === item && styles.chipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <View style={styles.navRowBetween}>
        <Button title="上一步" onPress={() => setStep(2)} />
        <Button title="下一步" onPress={nextFromStep3} />
      </View>
    </View>
  );

  // ================= Step 4：摘要 =================
  const renderStep4 = () => {
    const anchor =
      MOOD_ANCHORS.reduce((a, b) =>
        Math.abs(b.value - mood) < Math.abs(a.value - mood) ? b : a
      );

    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>這次填答摘要</Text>

        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>心情分數：</Text>
          <Text style={styles.summaryValue}>
            {mood} 分（{anchor.emoji} {anchor.label}）
          </Text>
        </View>

        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>當時在做的事：</Text>
          <Text style={styles.summaryValue}>{activity || "（尚未填寫）"}</Text>
        </View>

        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>是否有分心：</Text>
          <Text style={styles.summaryValue}>
            {wasMindWandering == null
              ? "（尚未填寫）"
              : wasMindWandering
              ? "有分心"
              : "沒有分心"}
          </Text>
        </View>

        {wasMindWandering && (
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>分心時在想什麼：</Text>
            <Text style={styles.summaryValue}>
              {mindContent || "（尚未填寫）"}
            </Text>
          </View>
        )}

        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>是否有錄 1 秒 vlog：</Text>
          <Text style={styles.summaryValue}>
            {hasVlog ? "有（已錄製影片）" : "尚未錄製"}
          </Text>
        </View>

        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>GPS 座標：</Text>
          <Text style={styles.summaryValue}>
            {coords
              ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
              : locationError || "尚未取得 / 權限尚未允許"}
          </Text>
        </View>

        <View style={styles.navRowBetween}>
          <Button
            title="上一步"
            onPress={() => setStep(wasMindWandering ? 3 : 2)}
          />
          <Button title="儲存並回首頁" onPress={handleSave} />
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={{ backgroundColor: "#F5F7FB" }}>
      <View style={styles.container}>
        <Text style={styles.title}>記錄這一刻的感受</Text>
        <Text style={styles.subtitle}>
          簡單幾個問題，幫你記下今天的心情與當下狀態。
        </Text>

        {renderStepIndicator()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        <View style={styles.bottomNav}>
          <Button title="← 回首頁" onPress={goHome} />
        </View>
      </View>
    </ScrollView>
  );
}

// =================== Styles ===================
const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center" },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    color: "#666",
    marginBottom: 16,
  },

  stepIndicatorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  stepItem: { flex: 1, alignItems: "center" },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5EDFF",
  },
  stepCircleActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  stepCircleDone: { backgroundColor: "#93C5FD", borderColor: "#93C5FD" },
  stepCircleText: { fontSize: 13, color: "#1E3A8A" },
  stepLabel: { marginTop: 4, fontSize: 12, color: "#6B7280" },
  stepLabelActive: { color: "#2563EB", fontWeight: "600" },
  stepLabelDone: { color: "#4B5563" },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  sectionHint: { fontSize: 12, color: "#777", marginBottom: 8 },

  moodAnchorRow: { flexDirection: "row", justifyContent: "space-between" },
  moodAnchorItem: { alignItems: "center", flex: 1 },
  moodAnchorEmoji: { fontSize: 22 },
  moodAnchorValue: { fontSize: 11, color: "#555" },

  input: {
    borderWidth: 1,
    borderColor: "#CCC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#FAFAFA",
    marginBottom: 4,
  },
  inputWide: { width: "100%" },
  noteInput: { minHeight: 70, textAlignVertical: "top" },

  chipTitle: { fontSize: 13, marginTop: 8, marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    backgroundColor: "#EFF4FF",
    marginRight: 6,
    marginBottom: 6,
  },
  chipSelected: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  chipText: { fontSize: 12, color: "#1E3A8A" },
  chipTextSelected: { color: "#FFF", fontWeight: "600" },

  sectionDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },

  mwButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    padding: 8,
    backgroundColor: "#F3F4FF",
    marginBottom: 8,
  },
  mwButtonSelected: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  mwButtonText: { fontSize: 13, color: "#1F2937" },
  mwButtonTextSelected: { color: "#FFF", fontWeight: "600" },

  summaryBlock: { marginTop: 8 },
  summaryLabel: { fontSize: 13, color: "#6B7280" },
  summaryValue: { fontSize: 15, fontWeight: "500", marginTop: 2 },

  navRow: { marginTop: 8, alignItems: "flex-end" },
  navRowBetween: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  bottomNav: { marginTop: 16, alignItems: "center", marginBottom: 24 },

  // 相機畫面
  cameraContainer: { flex: 1, backgroundColor: "black" },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  cameraHint: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 12,
  },
  cameraButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
