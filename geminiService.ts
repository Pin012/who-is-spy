
import { GoogleGenAI, Type } from "@google/genai";

export const generateWordPair = async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "請產生一組全新、具創意、適合『誰是臥底』遊戲的詞語對。這兩個詞必須非常相似但不同，可為抽象概念、職場及生活情境詞彙。直接回傳 JSON 物件，不要包含 markdown 標籤，包含 civilianWord (平民詞) 和 undercoverWord (臥底詞)。",
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

    const text = response.text;
    if (!text) throw new Error("AI 回傳內容為空");
    
    // 清理可能的 markdown 標籤
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
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
