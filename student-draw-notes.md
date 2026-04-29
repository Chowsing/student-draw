# 學生報告抽籤系統工作紀錄

最後更新：2026-04-29

## 系統位置

- 線上網址：https://mikebear.cloud/static/student-draw.html
- 本機目錄：`/root/caddy/static`
- 入口頁面：`/root/caddy/static/student-draw.html`

## 檔案說明

- `student-draw.html`：主頁面結構，載入 CSS、設定檔與主程式。
- `student-draw.css`：頁面樣式，包含深色投影介面、卡片、表格、可點選狀態標籤與響應式版面。
- `student-draw.config.js`：系統設定檔，目前設定課程標題與學生名單 JSON 路徑。
- `student-draw.js`：抽籤邏輯與畫面渲染。
- `multimedia_student_list.json`：學生名單，目前共 27 筆。
- `proposal_working.docx`：同目錄內的文件檔，與抽籤頁面無直接程式載入關係。

## 目前設定

設定檔：`student-draw.config.js`

```js
window.STUDENT_DRAW_CONFIG = {
  COURSE_TITLE: "多媒體系統-作業報告抽籤系統",
  STUDENT_LIST_URL: "multimedia_student_list.json",
};
```

## 目前功能

- 載入學生名單 JSON，必要欄位為：`序號`、`班級`、`學號`、`姓名`；可選欄位 `狀態` 若為 `作業未交`，該學生會顯示在總列表但排除於抽籤名單外。
- 顯示參與抽籤人數、已抽人數、尚未抽中人數；參與抽籤人數會扣除作業未交學生。
- 第一次按 `Draw` 會抽出 2 位：目前報告學生與下一位報告學生。
- 抽籤開始前，頁面會先顯示學生總列表，可直接點選狀態在 `未抽出` / `作業未交` 之間切換；第一次按 `Draw` 後名單設定會鎖定。
- 之後每按一次 `Draw`，下一位會遞補為目前報告學生，並補抽新的下一位。
- 抽籤會一路抽到所有可抽學生完成；下一位會顯示已抽完，Draw 按鈕會停用。
- `Reset` 會清空本輪抽籤狀態並重新開始，但不重新載入頁面。
- `全螢幕投影` 可切換瀏覽器全螢幕模式。
- 學生總列表會標示狀態：未抽出、已抽出、目前報告、下一位、作業未交。
- 有基本錯誤提示，例如設定缺漏、名單格式錯誤、沒有可抽籤學生。

## 抽籤狀態保存

- 目前抽籤狀態與頁面上臨時切換的 `作業未交` 狀態只存在瀏覽器記憶體中。
- 重新整理頁面或關閉瀏覽器後，抽籤結果與頁面臨時設定會消失。
- 若要讓 `作業未交` 一開始就固定帶入，需在 `multimedia_student_list.json` 對學生加入 `"狀態": "作業未交"`。
- 若需要保存抽籤進度，下次可考慮加入 `localStorage` 或後端儲存。

## 修改常用位置

- 修改頁面標題：改 `student-draw.config.js` 的 `COURSE_TITLE`。
- 修改學生名單：改 `multimedia_student_list.json`，注意必須保持 JSON 陣列格式；若學生作業未交，可加入 `"狀態": "作業未交"`。
- 修改統計文字或載入版本參數：改 `student-draw.html`。
- 修改抽籤流程：主要看 `student-draw.js` 的 `handleDraw()`。
- 修改學生狀態文字：主要看 `student-draw.js` 的 `getStudentStatus()`。
- 修改畫面樣式：改 `student-draw.css`。

## 可能的後續工作

- 加入抽籤結果匯出，例如 CSV 或 JSON。
- 加入抽籤進度保存，避免重新整理後遺失。
- 加入已抽出順序列表，方便課堂結束後回顧。
- 加入種子亂數或抽籤紀錄，提升可追溯性。
- 加入名單上傳功能，避免手動修改 JSON。

## 檢查方式

- 瀏覽器開啟：https://mikebear.cloud/static/student-draw.html
- 若學生名單沒有載入，先檢查：`/root/caddy/static/multimedia_student_list.json`
- 若頁面設定不正確，先檢查：`/root/caddy/static/student-draw.config.js`
- 若按鈕或抽籤流程異常，先檢查瀏覽器 Console 與 `student-draw.js`
