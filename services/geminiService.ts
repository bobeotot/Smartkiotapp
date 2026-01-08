
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const getAIInsights = async (transactions: Transaction[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const summaryData = transactions.map(t => ({
    cat: t.category,
    val: t.amount,
    date: t.date.split('T')[0]
  }));

  const prompt = `
    Dưới đây là danh sách các giao dịch doanh thu của một cửa hàng đa dịch vụ (Giặt sấy, Homestay, Healthy Food, Cho thuê xe đạp):
    ${JSON.stringify(summaryData)}

    Hãy đóng vai một chuyên gia phân tích kinh doanh, phân tích dữ liệu trên và cung cấp:
    1. Tóm tắt nhanh hiệu quả kinh doanh.
    2. Nhận diện mảng nào đang mang lại doanh thu tốt nhất.
    3. Đưa ra 3 lời khuyên thực tế để tối ưu hóa doanh thu cho các mảng còn lại.
    4. Dự báo xu hướng ngắn hạn.

    Hãy viết bằng tiếng Việt, súc tích và chuyên nghiệp. Sử dụng định dạng Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Không thể phân tích dữ liệu lúc này.";
  } catch (error) {
    console.error("AI Insights Error:", error);
    return "Đã xảy ra lỗi khi gọi AI. Vui lòng kiểm tra kết nối mạng.";
  }
};
