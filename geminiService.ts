import { GoogleGenAI, Type } from "@google/genai";

const HISTORY_KEY = 'spy_recent_word_pairs';
const HISTORY_LIMIT = 30;
const CATEGORY_ROTATION = [
  '食物', '交通工具', '運動', '影視娛樂', '科技產品', '職場情境', '旅遊場景', '校園生活', '流行文化', '日常用品', '動物', '植物', '地標建築', '網路社群', '金融消費', '永續淨零', 'AI與自動化', '新能源'
];

interface WordPair {
  civilianWord: string;
  undercoverWord: string;
}

const loadRecentPairs = (): WordPair[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveRecentPair = (pair: WordPair) => {
  const current = loadRecentPairs();
  const next = [pair, ...current].slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
};

const buildPrompt = (recentPairs: WordPair[]) => {
  const category = CATEGORY_ROTATION[Math.floor(Math.random() * CATEGORY_ROTATION.length)];
  const recentWordList = recentPairs
    .flatMap(p => [p.civilianWord, p.undercoverWord])
    .filter(Boolean)
    .slice(0, 40);

  const avoidLine = recentWordList.length
    ? `避免使用以下最近出現過的詞：${recentWordList.join('、')}。`
    : '避免重複常見老題（例如：蘋果/水梨、鋼琴/電子琴）。';

  return `你是「誰是臥底」題庫設計師。
請只輸出一組全新詞語對，主題偏向「${category}」，並遵守以下規則：
1) 平民詞與臥底詞要高度相近但不相同。
2) 兩詞都必須是繁體中文，長度 2~4 字。
3) 禁止同義詞、上下位詞過近到無法區分（例如「手機/行動電話」）。
4) 禁止冷僻專有名詞，優先大眾可理解詞彙。
5) ${avoidLine}
6) 可選擇具國際視野或未來趨勢感的詞彙，但仍需日常可理解。
7) 直接回傳 JSON 物件，欄位為 civilianWord 與 undercoverWord。`;
};

export const generateWordPair = async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const recentPairs = loadRecentPairs();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: buildPrompt(recentPairs),
      config: {
        temperature: 1.35,
        topP: 0.95,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            civilianWord: { type: Type.STRING, description: "平民看到的詞語" },
            undercoverWord: { type: Type.STRING, description: "臥底看到的詞語" }
          },
          required: ["civilianWord", "undercoverWord"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 回傳內容為空");

    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as WordPair;

    if (!parsed.civilianWord || !parsed.undercoverWord) {
      throw new Error('AI 詞語格式錯誤');
    }

    saveRecentPair(parsed);
    return parsed;
  } catch (error) {
    console.error("Gemini 產生失敗，使用備用詞庫", error);
    const fallbacks = [
      { civilianWord: "登機證", undercoverWord: "護照夾" },
      { civilianWord: "冰美式", undercoverWord: "冷萃咖" },
      { civilianWord: "雨衣", undercoverWord: "風衣" },
      { civilianWord: "有線耳機", undercoverWord: "藍牙耳機" },
      { civilianWord: "會議室", undercoverWord: "休息室" },
      { civilianWord: "投影機", undercoverWord: "顯示器" },
      { civilianWord: "跑步機", undercoverWord: "滑步機" },
      { civilianWord: "摩天輪", undercoverWord: "雲霄飛車" }
    ];
    const pick = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    saveRecentPair(pick);
    return pick;
  }
};
