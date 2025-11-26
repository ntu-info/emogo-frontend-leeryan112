// app/(tabs)/index.js
import React from "react";
import { View, Text, StyleSheet, Button } from "react-native";

export default function HomeScreen({ navigation }) {
  const goDetails = () => {
    navigation?.goDetails && navigation.goDetails();
  };
  const goSettings = () => {
    navigation?.goSettings && navigation.goSettings();
  };
  const goHistory = () => {
    navigation?.goHistory && navigation.goHistory();
  };
  const goAnalysis = () => {
    navigation?.goAnalysis && navigation.goAnalysis();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.appName}>Emogo 心情日誌 😊</Text>
      <Text style={styles.subtitle}>
        花 30 秒記錄一下現在的感受，幫自己多留一點空間。
      </Text>

      <View style={styles.mainButtonWrapper}>
        <Button title="開始記錄現在的心情" onPress={goDetails} />
      </View>

      <Text style={styles.helperText}>
        建議一天記錄幾次，看看自己的心情在一天中的變化。
      </Text>

      <View style={styles.secondaryButtons}>
        <View style={styles.secondaryButton}>
          <Button title="過去填答紀錄" onPress={goHistory} />
          
        </View>
        <View style={styles.secondaryButton}>
          <Button title="分析" onPress={goAnalysis} />
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="⚙️ 通知與資料設定" onPress={goSettings} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#F5F7FB",
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#555",
    marginBottom: 32,
  },
  mainButtonWrapper: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    color: "#777",
    textAlign: "center",
    marginHorizontal: 20,
  },
  secondaryButtons: {
    marginTop: 24,
    gap: 12,
  },
  secondaryButton: {
    marginHorizontal: 20,
  },
  footer: {
    marginTop: "auto",
    alignItems: "center",
    paddingBottom: 24,
  },
});
