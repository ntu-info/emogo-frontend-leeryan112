# 📱 Emogo — Mood & Focus Tracker

[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/DZepDCgF)  
[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=20773481&assignment_repo_type=AssignmentRepo)

---

## 📦 Expo Build (Android Preview)

👉 **Download the latest EAS Android build:**  
https://expo.dev/accounts/leeryan/projects/expo-router-mwe/builds/ecd65f49-f5fa-44f1-930c-cf1cc716b6d5

---

# 🧠 About Emogo

**Emogo** 是一款用來記錄：

- ⏳ 當下的心情  
- 🎯 是否分心  
- 📝 自己正在做什麼  
- 🧭 GPS 定位  
- 📹 1 秒 vlog  
- 📊 情緒變化與分析  

的簡單、自然而且可視化的手機 app。

整個 app 完全使用 **React Native + Expo** 開發：

- 支援 SQLite 本地資料庫  
- 支援本機檔案（影片）保存  
- 支援多時段隨機通知  
- 支援 CSV 匯出  
- 支援情緒分析圖表  

---

# 🚀 Features

## ✍️ 1. 一次 30 秒的心情紀錄

每次填答分 4 個步驟：

1. 心情分數（0–100）  
2. 正在做的事情、是否分心、是否錄 vlog  
3. 若分心：記錄分心內容  
4. 摘要與確認  

每次記錄後會儲存在 SQLite 中，並可在「過去填答紀錄」檢視。

---

## 📹 2. 1 秒 vlog

- 使用 `expo-camera` 直接錄 1 秒影片  
- 自動儲存至 app 的私有資料夾  
- 可在「過去填答紀錄」預覽／分享／下載影片  

---

## 🔔 3. 多時段隨機通知排程

你可以設定：

- 多個時段（例如：09:00–12:00、12:00–15:00）  
- 每個時段要隨機跳幾次通知  
- 自動套用「未來 24 小時」內所有通知  

支援前景通知讓提醒不漏接。

---

## 📚 4. 過去紀錄（History）

- 按日期排序  
- 支援影片播放  
- 支援影片下載或分享（AirDrop / Files App / LINE 等）  
- 可刪除單筆紀錄  
- 即時更新  

---

## 📊 5. 心情分析（Analysis）

包含兩個圖表：

### 📈 折線圖：心情 × 日期

- 橫軸：日期（最新在右）
- 縱軸：心情分數  
- 點的顏色：分心 / 未分心  
- 每個點代表一次填答  

讓你觀察「心情隨時間的變化」與「注意力的影響」。

### 📊 長條圖：不同活動的平均心情

- 橫軸：活動名稱  
- 縱軸：平均心情分數  

協助看出哪些活動讓你心情更好。

---

## 📤 6. 匯出 CSV

可自由分享：

- AirDrop  
- Email  
- Notes  
- Cloud Drive  
- 其他 App  

---

# 🛠️ Tech Stack

| 層級 | 技術 |
|------|-------|
| **App Framework** | Expo SDK |
| **Mobile UI** | React Native |
| **GPS** | expo-location |
| **Database** | SQLite (`expo-sqlite/legacy`) |
| **Camera** | expo-camera |
| **File Storage** | expo-file-system |
| **Sharing** | expo-sharing |
| **Notifications** | expo-notifications |
| **Charts** | 手刻 SVG / React Native rendering |

---


# ⚙️ Local Development

```bash
# Install Expo CLI
npm install -g expo-cli

# Install dependencies
npm install

# Start development server
npx expo start



