// app/_layout.js
import React, { useState, useEffect } from "react";
import { View, Platform, StyleSheet } from "react-native";
import * as Notifications from "expo-notifications";

import HomeScreen from "./(tabs)/index";
import SettingsScreen from "./(tabs)/settings";
import DetailsScreen from "./details";
import HistoryScreen from "./history";
import AnalysisScreen from "./analysis";   // ⬅️ 新增這行！

// ✅ 告訴 Expo：收到通知時，即使在前景也要顯示 alert
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // 很重要：前景時要不要跳視窗
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const [screen, setScreen] = useState("home");

  // App 啟動時先檢查 / 要通知權限（只在手機上做）
  useEffect(() => {
    if (Platform.OS === "web") return;

    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
    })();
  }, []);

  const navigation = {
    goHome: () => setScreen("home"),
    goSettings: () => setScreen("settings"),
    goDetails: () => setScreen("details"),
    goHistory: () => setScreen("history"),
    goAnalysis: () => setScreen("analysis"),   // ⬅️ 新增這個
  };

  return (
    <View style={styles.root}>
      {/* Home */}
      <View style={[styles.screen, screen !== "home" && styles.hidden]}>
        <HomeScreen navigation={navigation} />
      </View>

      {/* Settings */}
      <View style={[styles.screen, screen !== "settings" && styles.hidden]}>
        <SettingsScreen navigation={navigation} />
      </View>

      {/* Details */}
      <View style={[styles.screen, screen !== "details" && styles.hidden]}>
        <DetailsScreen navigation={navigation} />
      </View>

      {/* History */}
      <View style={[styles.screen, screen !== "history" && styles.hidden]}>
        <HistoryScreen navigation={navigation} />
      </View>

      {/* Analysis */}
      <View style={[styles.screen, screen !== "analysis" && styles.hidden]}>
        <AnalysisScreen navigation={navigation} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  screen: {
    flex: 1,
  },
  hidden: {
    display: "none",
  },
});
