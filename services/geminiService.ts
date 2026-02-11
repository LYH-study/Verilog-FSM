import { GoogleGenAI, Type } from "@google/genai";
import { FSMData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are a specialized Verilog parser engine for generating publication-quality FSM diagrams.

Rules:
1. **States**:
   - 'label': Extract the EXACT parameter name (e.g. "IDLE", "GEN_STA", "RD_BITS"). 
   - 'description': MANDATORY. Provide a 2-4 character Chinese term summarizing the state (e.g. "初始", "读位", "写校验", "结束").
2. **Transitions**:
   - 'condition': Extract the logic condition. 
     - **CRITICAL: Simplify and Consolidate.**
     - If the logic covers a range (e.g., cnt=0, cnt=1, cnt=2), MERGE it into a range (e.g., "cnt < 3").
     - If multiple flags trigger the same jump, merge them (e.g. "Start | Go").
     - Use "&", "|", "!" for operators.
   - 'action': Extract key Mealy actions/outputs assigned in the transition (e.g. "load=1").
3. **Structure**: 
   - Identify the RESET state as INITIAL.
`;

export const parseVerilogWithGemini = async (verilogCode: string): Promise<FSMData> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this Verilog code and extract the FSM structure:\n\n${verilogCode}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            moduleName: { type: Type.STRING },
            clockSignal: { type: Type.STRING },
            resetSignal: { type: Type.STRING },
            states: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["INITIAL", "STATE"] },
                  description: { type: Type.STRING, description: "Chinese description (e.g. 空闲)" }
                }
              }
            },
            transitions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  condition: { type: Type.STRING },
                  action: { type: Type.STRING }
                }
              }
            }
          },
          required: ["moduleName", "states", "transitions"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as FSMData;
    }
    throw new Error("No response from AI model");

  } catch (error) {
    console.error("Error parsing Verilog:", error);
    throw error;
  }
};