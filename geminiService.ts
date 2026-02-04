import { GoogleGenAI, Type } from "@google/genai";

export const generateWordPair = async () => {
  // 確保從環境變數正確讀取 API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "請產生一組適合『誰是臥底』遊戲的詞語對。這兩個詞必須非常相似但不同。回傳格式為 JSON，包含 civilianWord (平民詞) 和 undercoverWord (臥底詞)。例如：珍珠奶茶與波霸奶茶、鋼琴與電子琴。",
      config: {
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

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Gemini 產生失敗，使用備用詞庫", error);
    const fallbacks = [
      { civilianWord: "蘋果", undercoverWord: "水梨" },
      { civilianWord: "鋼琴", undercoverWord: "電子琴" },
      { civilianWord: "蜘蛛人", undercoverWord: "蝙蝠俠" },
      { civilianWord: "珍珠奶茶", undercoverWord: "波霸奶茶" },
      { civilianWord: "麥當勞", undercoverWord: "肯德基" },
      { civilianWord: "筆記型電腦", undercoverWord: "平板電腦" }
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};