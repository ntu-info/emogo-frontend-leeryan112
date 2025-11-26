import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

let dbPromise = null;
let initialized = false;

// 取得（或建立）資料庫實例
async function getDb() {
  if (Platform.OS === "web") return null;

  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("experience.db");
  }
  const db = await dbPromise;

  // 確保只跑一次建表
  if (!initialized) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        mood INTEGER,
        activity TEXT,
        wasMindWandering INTEGER,
        mindContent TEXT,
        video_uri TEXT,
        latitude REAL,
        longitude REAL
      );
    `);
    initialized = true;
  }

  return db;
}

// 給別的檔案呼叫的初始化（其實不呼叫也沒關係，因為上面 getDb 會自動建表）
export async function initDb() {
  if (Platform.OS === "web") return;
  await getDb();
}

// 新增一筆紀錄
export async function insertSample(sample, callback) {
  if (Platform.OS === "web") {
    // Web 先當成功處理
    callback && callback(true);
    return;
  }

  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO samples
        (timestamp, mood, activity, wasMindWandering, mindContent, video_uri, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sample.timestamp,
        sample.mood,
        sample.activity,
        sample.wasMindWandering == null
          ? null
          : sample.wasMindWandering
          ? 1
          : 0,
        sample.mindContent ?? null,
        sample.videoUri ?? null,
        sample.latitude,
        sample.longitude,
      ]
    );

    callback && callback(true);
  } catch (err) {
    console.log("insertSample error:", err);
    callback && callback(false);
  }
}

// 撈全部紀錄（給 history & 匯出用）
export async function getAllSamples(callback) {
  if (Platform.OS === "web") {
    callback && callback([]);
    return;
  }

  try {
    const db = await getDb();
    const rows = await db.getAllAsync(
      "SELECT * FROM samples ORDER BY datetime(timestamp) DESC;"
    );
    callback && callback(rows);
  } catch (err) {
    console.log("getAllSamples error:", err);
    callback && callback([]);
  }
}

// 刪掉單筆紀錄（history 裡按垃圾桶用）
export async function deleteSampleById(id, callback) {
  if (Platform.OS === "web") {
    callback && callback(true);
    return;
  }

  try {
    const db = await getDb();
    await db.runAsync("DELETE FROM samples WHERE id = ?", [id]);
    callback && callback(true);
  } catch (err) {
    console.log("deleteSampleById error:", err);
    callback && callback(false);
  }
}

// 刪掉全部紀錄（清空用）
export async function deleteAllSamples(callback) {
  if (Platform.OS === "web") {
    callback && callback(true);
    return;
  }

  try {
    const db = await getDb();
    await db.runAsync("DELETE FROM samples");
    callback && callback(true);
  } catch (err) {
    console.log("deleteAllSamples error:", err);
    callback && callback(false);
  }
}
