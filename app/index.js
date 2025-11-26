// app/index.js
import { Redirect } from "expo-router";

export default function Index() {
  // 一律把根路由導向到 (tabs) 底下的首頁
  return <Redirect href="/(tabs)" />;
}
