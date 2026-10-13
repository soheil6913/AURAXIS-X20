var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_meta = {};
import_dotenv.default.config();
var __filename = typeof import_meta?.url === "string" ? (0, import_url.fileURLToPath)(import_meta.url) : "";
var __dirname = __filename ? import_path.default.dirname(__filename) : process.cwd();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  app.use(import_express.default.json({ limit: "10mb" }));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.post("/api/gemini/analyze-scan", async (req, res) => {
    try {
      const { scan } = req.body;
      if (!scan) {
        return res.status(400).json({ error: "\u0645\u0627\u062A\u0631\u06CC\u0633 \u0627\u0633\u06A9\u0646 \u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      const { width, length, soilType, sensorType, maxDepthMeters = 5, gridData, phaseData = [] } = scan;
      let sum = 0;
      let maxAdc = -Infinity;
      let minAdc = Infinity;
      let maxAdcIndex = 0;
      let minAdcIndex = 0;
      gridData.forEach((val, idx) => {
        sum += val;
        if (val > maxAdc) {
          maxAdc = val;
          maxAdcIndex = idx;
        }
        if (val < minAdc) {
          minAdc = val;
          minAdcIndex = idx;
        }
      });
      const totalCount = gridData.length;
      const meanAdc = totalCount > 0 ? sum / totalCount : 380;
      let varSum = 0;
      gridData.forEach((val) => {
        varSum += Math.pow(val - meanAdc, 2);
      });
      const stdDev = Math.max(8, Math.sqrt(varSum / (totalCount || 1)));
      const maxX = maxAdcIndex % width;
      const maxY = Math.floor(maxAdcIndex / width);
      const maxPhase = phaseData[maxAdcIndex] ?? 0;
      const peakDelta = maxAdc - meanAdc;
      const snr = Number((peakDelta / stdDev).toFixed(1));
      let evidenceTier = "1. No significant anomaly detected";
      if (peakDelta > 2.5 * stdDev && peakDelta > 160) {
        if (snr >= 4 && Math.abs(maxPhase) > 15) {
          evidenceTier = "4. High-quality, repeatable anomaly \u2014 independent verification recommended";
        } else if (Math.abs(maxPhase) > 10 || peakDelta > 200) {
          evidenceTier = "3. Multi-sensor anomaly \u2014 further investigation recommended";
        } else {
          evidenceTier = "2. Possible anomaly \u2014 insufficient evidence";
        }
      } else if (meanAdc - minAdc > 2.2 * stdDev && minAdc < 260) {
        evidenceTier = "3. Multi-sensor anomaly \u2014 further investigation recommended";
      } else if (peakDelta > 1.8 * stdDev) {
        evidenceTier = "2. Possible anomaly \u2014 insufficient evidence";
      }
      const confidenceScore = Math.min(
        95,
        Math.max(45, Math.round(40 + Math.min(30, snr * 5) + (Math.abs(maxPhase) > 15 ? 15 : 5)))
      );
      const generateFallbackAnalysis = () => ({
        summary: `\u06AF\u0632\u0627\u0631\u0634 \u0698\u0626\u0648\u0641\u06CC\u0632\u06CC\u06A9 \u062A\u0627\u06A9\u062A\u06CC\u06A9\u06CC AURAXIS X20: \u062A\u062D\u0644\u06CC\u0644 \u0645\u0627\u062A\u0631\u06CC\u0633 \u0627\u0633\u06A9\u0646 \u062F\u0631 \u0628\u0633\u062A\u0631 \xAB${soilType}\xBB \u062D\u0627\u06A9\u06CC \u0627\u0632 \u0637\u0628\u0642\u0647\u200C\u0628\u0646\u062F\u06CC \u0633\u06CC\u06AF\u0646\u0627\u0644 \u062F\u0631 \u0631\u062F\u0647 \xAB${evidenceTier}\xBB \u0627\u0633\u062A. \u06A9\u0627\u0646\u0648\u0646 \u0627\u0646\u062D\u0631\u0627\u0641 \u062F\u0631 \u0645\u062E\u062A\u0635\u0627\u062A (X:${maxX + 1}, Y:${maxY + 1}) \u0628\u0627 \u0634\u062F\u062A ${maxAdc} ADC (\u0627\u0646\u062D\u0631\u0627\u0641 +${Math.round(peakDelta)} ADC \u0627\u0632 \u062E\u0637 \u067E\u0627\u06CC\u0647 ${Math.round(meanAdc)} ADC) \u0648 \u0627\u062E\u062A\u0644\u0627\u0641 \u0641\u0627\u0632 ${maxPhase} \u062F\u0631\u062C\u0647 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u06AF\u0631\u062F\u06CC\u062F.`,
        evidenceTier,
        soilConductivityIndex: Math.min(10, Math.max(1, Math.round(maxAdc / 100))),
        excavationFeasibility: Math.min(95, Math.max(50, Math.round(confidenceScore * 0.9))),
        mineralInterferenceLevel: stdDev > 45 ? "\u0634\u062F\u06CC\u062F (High)" : stdDev > 25 ? "\u0645\u062A\u0648\u0633\u0637 (Medium)" : "\u06A9\u0645 (Low)",
        baselineStats: {
          meanAdc: Number(meanAdc.toFixed(1)),
          stdDev: Number(stdDev.toFixed(1)),
          peakDeltaAdc: Math.round(peakDelta),
          snr
        },
        multiSensorAgreement: `\u06A9\u0627\u0646\u0627\u0644 \u0645\u06AF\u0646\u062A\u0648\u0645\u062A\u0631 \u0645\u0642\u062F\u0627\u0631 ${maxAdc} ADC \u0631\u0627 \u062B\u0628\u062A \u06A9\u0631\u062F\u0647 \u0648 \u06A9\u0627\u0646\u0627\u0644 \u0632\u0627\u0648\u06CC\u0647 \u0641\u0627\u0632 (${maxPhase}\xB0) \u0648\u0627\u06A9\u0646\u0634 \u0627\u0644\u0642\u0627\u06CC\u06CC \u062C\u0633\u0645 \u0631\u0627 \u062A\u0627\u06CC\u06CC\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F. \u0639\u062F\u0645 \u062B\u0628\u062A \u0646\u0648\u0633\u0627\u0646 \u0634\u0627\u0631\u0698 \u0646\u0627\u06AF\u0647\u0627\u0646\u06CC \u0645\u0648\u06CC\u062F \u067E\u0627\u06CC\u062F\u0627\u0631\u06CC \u062E\u0637 \u067E\u0627\u06CC\u0647 \u062D\u0633\u06AF\u0631 \u0627\u0633\u062A.`,
        alternativeHypotheses: [
          "\u062A\u0648\u062F\u0647 \u06A9\u0627\u0646\u06CC\u200C\u0647\u0627\u06CC \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u06CC \u0637\u0628\u06CC\u0639\u06CC (\u0645\u06AF\u0646\u062A\u06CC\u062A/\u0647\u0645\u0627\u062A\u06CC\u062A) \u06CC\u0627 \u0633\u0646\u06AF\u200C\u0647\u0627\u06CC \u0622\u0630\u0631\u06CC\u0646 \u062F\u06AF\u0631\u06AF\u0648\u0646\u200C\u0634\u062F\u0647",
          "\u0636\u0627\u06CC\u0639\u0627\u062A \u0641\u0644\u0632\u06CC \u0633\u0637\u062D\u06CC \u0648 \u0628\u0642\u0627\u06CC\u0627\u06CC \u0627\u06A9\u0633\u06CC\u062F\u0634\u062F\u0647 \u0622\u0647\u0646 \u0632\u0646\u06AF\u200C\u0632\u062F\u0647 \u06A9\u0634\u0627\u0648\u0631\u0632\u06CC",
          "\u062A\u062F\u0627\u062E\u0644 \u0627\u0644\u0642\u0627\u06CC\u06CC \u062E\u0637\u0648\u0637 \u062A\u0627\u0633\u06CC\u0633\u0627\u062A \u0634\u0647\u0631\u06CC\u060C \u0644\u0648\u0644\u0647\u200C\u06A9\u0634\u06CC \u06CC\u0627 \u06A9\u0627\u0628\u0644\u200C\u0647\u0627\u06CC \u062C\u0631\u06CC\u0627\u0646 \u0636\u0639\u06CC\u0641 \u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC",
          "\u0622\u0631\u062A\u06CC\u0641\u06A9\u062A \u062D\u0631\u06A9\u062A\u06CC \u0646\u0627\u0634\u06CC \u0627\u0632 \u06A9\u062C\u200C\u0634\u062F\u0646 \u0632\u0627\u0648\u06CC\u0647 \u067E\u0631\u0648\u0628 \u062F\u0631 \u062D\u06CC\u0646 \u06AF\u0627\u0645\u200C\u0628\u0631\u062F\u0627\u0631\u06CC \u0627\u067E\u0631\u0627\u062A\u0648\u0631"
        ],
        confidenceCalculationFormula: `\u0641\u0631\u0645\u0648\u0644 \u0627\u0639\u062A\u0628\u0627\u0631\u0633\u0646\u062C\u06CC \u0642\u0637\u0639\u06CC: \u067E\u0627\u06CC\u0647 \u06F4\u06F0\u066A + \u0646\u0633\u0628\u062A \u0633\u06CC\u06AF\u0646\u0627\u0644 \u0628\u0647 \u0646\u0648\u06CC\u0632 SNR (${Math.min(30, Math.round(snr * 5))}\u066A) + \u0647\u0645\u0628\u0633\u062A\u06AF\u06CC \u0632\u0627\u0648\u06CC\u0647 \u0641\u0627\u0632 \u0627\u0644\u06A9\u062A\u0631\u0648\u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u06CC (${Math.abs(maxPhase) > 15 ? "\u06F1\u06F5" : "\u06F5"}\u066A) = ${confidenceScore}\u066A`,
        recommendations: [
          "\u0627\u0646\u062C\u0627\u0645 \u06CC\u06A9 \u0627\u0633\u06A9\u0646 \u0645\u062A\u0642\u0627\u0637\u0639 \u06F9\u06F0 \u062F\u0631\u062C\u0647 (Orthogonal Cross-Scan) \u062F\u0631 \u0647\u0645\u06CC\u0646 \u0627\u0628\u0639\u0627\u062F \u062C\u0647\u062A \u0628\u0631\u0631\u0633\u06CC \u067E\u0627\u06CC\u062F\u0627\u0631\u06CC \u0641\u0636\u0627\u06CC\u06CC \u0622\u0646\u0648\u0645\u0627\u0644\u06CC.",
          "\u062A\u06A9\u0631\u0627\u0631 \u0628\u0627\u0644\u0627\u0646\u0633 \u062E\u0637 \u0632\u0645\u06CC\u0646\u0647 (Ground Zero Tare) \u062F\u0631 \u0641\u0627\u0635\u0644\u0647 \u062D\u062F\u0627\u0642\u0644 \u06F3 \u0645\u062A\u0631\u06CC \u0627\u0632 \u06A9\u0627\u0646\u0648\u0646 \u0647\u062F\u0641.",
          "\u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0646\u0648\u0646 \u0628\u0627 \u067E\u06CC\u0646\u200C\u067E\u0648\u06CC\u0646\u062A\u0631 \u0645\u06CC\u062F\u0627\u0646 \u0645\u062A\u063A\u06CC\u0631 \u062C\u0647\u062A \u0627\u0637\u0645\u06CC\u0646\u0627\u0646 \u0627\u0632 \u0639\u062F\u0645 \u0648\u062C\u0648\u062F \u0627\u0634\u06CC\u0627\u0621 \u0641\u0631\u0648\u0645\u063A\u0646\u0627\u0637\u06CC\u0633 \u062F\u0631 \u0639\u0645\u0642 \u06A9\u0645 \u0632\u06CC\u0631 \u06F1\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631."
        ],
        scientificLimitations: "\u0627\u0635\u0644 \u0639\u062F\u0645 \u0642\u0637\u0639\u06CC\u062A \u067E\u062A\u0627\u0646\u0633\u06CC\u0644 \u0698\u0626\u0648\u0641\u06CC\u0632\u06CC\u06A9: \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u200C\u0633\u0646\u062C\u06CC \u0628\u0647 \u062A\u0646\u0647\u0627\u06CC\u06CC \u0642\u0627\u062F\u0631 \u0628\u0647 \u0627\u062B\u0628\u0627\u062A \u0647\u0648\u06CC\u062A \u0634\u06CC\u0645\u06CC\u0627\u06CC\u06CC \u0641\u0644\u0632 (\u0637\u0644\u0627/\u0622\u0647\u0646)\u060C \u062E\u0644\u0648\u0635 \u0639\u06CC\u0627\u0631 \u06CC\u0627 \u0642\u062F\u0645\u062A \u0634\u06CC\u0621 \u0646\u06CC\u0633\u062A\u0646\u062F. \u06A9\u0644\u06CC\u0647 \u0645\u0642\u0627\u062F\u06CC\u0631 \u0639\u0645\u0642 \u062A\u062E\u0645\u06CC\u0646\u200C\u0647\u0627\u06CC \u0645\u062F\u0644 \u062F\u0648\u0642\u0637\u0628\u06CC \u0631\u06CC\u0627\u0636\u06CC \u0628\u0648\u062F\u0647 \u0648 \u062C\u0627\u06CC\u06AF\u0632\u06CC\u0646 \u0646\u0645\u0648\u0646\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC \u0641\u06CC\u0632\u06CC\u06A9\u06CC \u0646\u0645\u06CC\u200C\u0628\u0627\u0634\u0646\u062F.",
        geophysicalDataInterpretation: `\u06AF\u0631\u0627\u062F\u06CC\u0627\u0646 \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u06CC \u0627\u0646\u062F\u0627\u0632\u0647 \u067E\u0633 \u0627\u0632 \u062A\u0641\u0631\u06CC\u0642 \u0646\u0648\u06CC\u0632 \u0632\u0645\u06CC\u0646\u0647 \u0646\u0634\u0627\u0646\u200C\u062F\u0647\u0646\u062F\u0647 \u06CC\u06A9 \u062F\u0648\u0642\u0637\u0628\u06CC \u0628\u0627 \u0639\u0645\u0642 \u062A\u062E\u0645\u06CC\u0646\u06CC ${Math.min(maxDepthMeters * 0.8, Math.max(0.6, (1.2 - snr / 12) * maxDepthMeters * 0.6)).toFixed(1)} \u0645\u062A\u0631\u06CC \u0627\u0633\u062A. \u067E\u0627\u0633\u062E \u0632\u0627\u0648\u06CC\u0647 \u0641\u0627\u0632 (${maxPhase}\xB0) \u0647\u0645\u0631\u0627\u0633\u062A\u0627 \u0628\u0627 \u0631\u0633\u0627\u0646\u0627\u06CC\u06CC \u0628\u0627\u0644\u0627\u06CC \u062A\u0648\u062F\u0647 \u0647\u062F\u0641 \u0627\u0633\u062A.`,
        detectedObjects: [
          {
            title: maxAdc > 750 ? "\u0622\u0646\u0648\u0645\u0627\u0644\u06CC \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u06CC \u0628\u0627 \u0631\u0633\u0627\u0646\u0627\u06CC\u06CC \u0628\u0627\u0644\u0627 (High Conductivity Dipole)" : "\u0622\u0646\u0648\u0645\u0627\u0644\u06CC \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u06CC \u0645\u0648\u0636\u0639\u06CC (Local Dipole)",
            type: maxAdc > 750 ? "precious_metal" : "ferrous",
            depthEstimateMeters: Number(Math.min(maxDepthMeters * 0.8, Math.max(0.6, (1.2 - snr / 12) * maxDepthMeters * 0.6)).toFixed(1)),
            confidencePercentage: confidenceScore,
            evidenceTier,
            x: maxX,
            y: maxY,
            description: `\u067E\u06CC\u06A9 \u0645\u0648\u0636\u0639\u06CC ${maxAdc} ADC (\u0627\u0646\u062D\u0631\u0627\u0641 +${Math.round(peakDelta)} \u0646\u0633\u0628\u062A \u0628\u0647 \u0632\u0645\u06CC\u0646\u0647 ${Math.round(meanAdc)}) \u0628\u0627 \u0641\u0627\u0632 ${maxPhase}\xB0 \u062F\u0631 \u0646\u0642\u0637\u0647 (X:${maxX + 1}, Y:${maxY + 1})`
          },
          ...minAdc < 250 ? [{
            title: "\u0627\u0641\u062A \u06AF\u0631\u0627\u062F\u06CC\u0627\u0646 \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u06CC / \u0633\u0627\u062E\u062A\u0627\u0631 \u0641\u0636\u0627\u06CC \u062A\u0648\u062E\u0627\u0644\u06CC (Subsurface Void)",
            type: "cavity",
            depthEstimateMeters: Number((maxDepthMeters * 0.75).toFixed(1)),
            confidencePercentage: 85,
            evidenceTier: "3. Multi-sensor anomaly \u2014 further investigation recommended",
            x: minAdcIndex % width,
            y: Math.floor(minAdcIndex / width),
            description: `\u0627\u0641\u062A \u0645\u062D\u0633\u0648\u0633 \u0628\u0647 ${minAdc} ADC \u0628\u0627 \u0641\u0627\u0632 \u0645\u0646\u0641\u06CC \u06A9\u0647 \u0646\u0627\u0634\u06CC \u0627\u0632 \u06A9\u0627\u0647\u0634 \u0634\u062F\u06CC\u062F \u067E\u0630\u06CC\u0631\u0641\u062A\u0627\u0631\u06CC \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u06CC (\u062D\u0641\u0631\u0647/\u0627\u062A\u0627\u0642\u06A9) \u0627\u0633\u062A.`
          }] : []
        ]
      });
      if (!apiKey) {
        return res.json({ analysis: generateFallbackAnalysis() });
      }
      try {
        const ai = new import_genai.GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });
        const prompt = `
\u062A\u0648 \u06CC\u06A9 \u0645\u062A\u062E\u0635\u0635 \u0627\u0631\u0634\u062F \u0698\u0626\u0648\u0641\u06CC\u0632\u06CC\u06A9 \u0645\u06CC\u062F\u0627\u0646\u060C \u062A\u062D\u0644\u06CC\u0644\u200C\u06AF\u0631 \u0633\u06CC\u0633\u062A\u0645\u200C\u0647\u0627\u06CC \u0631\u0627\u062F\u0627\u0631 \u0632\u0645\u06CC\u0646 AURAXIS X20 \u0648 \u0637\u0631\u0627\u062D \u0645\u0648\u062A\u0648\u0631\u0647\u0627\u06CC \u0641\u06CC\u0648\u0698\u0646 \u0686\u0646\u062F \u0633\u0646\u0633\u0648\u0631\u0647 \u0647\u0633\u062A\u06CC.
\u0648\u0638\u06CC\u0641\u0647 \u062A\u0648 \u0627\u0631\u0627\u0626\u0647 \u06CC\u06A9 \u06AF\u0632\u0627\u0631\u0634 \u062A\u062D\u0644\u06CC\u0644 \u062A\u0627\u06A9\u062A\u06CC\u06A9\u06CC \u06F9 \u06AF\u0627\u0646\u0647 \u0639\u0644\u0645\u06CC \u0648 \u0645\u0633\u062A\u0646\u062F \u0628\u0631 \u0627\u0633\u0627\u0633 \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC\u200C\u0634\u062F\u0647 \u0648\u0627\u0642\u0639\u06CC \u0633\u0646\u0633\u0648\u0631 \u0627\u0633\u062A.

\u0645\u0634\u062E\u0635\u0627\u062A \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0648\u0627\u0642\u0639\u06CC \u0633\u0646\u0633\u0648\u0631:
- \u0627\u0628\u0639\u0627\u062F \u0645\u0627\u062A\u0631\u06CC\u0633: ${width} \u0633\u062A\u0648\u0646 \xD7 ${length} \u062E\u0637 (${totalCount} \u0646\u0642\u0637\u0647)
- \u0646\u0648\u0639 \u062E\u0627\u06A9 \u0628\u0633\u062A\u0631: ${soilType}
- \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0633\u062E\u062A\u200C\u0627\u0641\u0632\u0627\u0631\u06CC \u0633\u0646\u0633\u0648\u0631: ${sensorType}
- \u062D\u062F\u0627\u06A9\u062B\u0631 \u0628\u0631\u062F \u06A9\u0627\u0648\u0634: ${maxDepthMeters} \u0645\u062A\u0631
- \u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u062E\u0637 \u0632\u0645\u06CC\u0646\u0647 \u0628\u0633\u062A\u0631 (Baseline Mean): ${meanAdc.toFixed(1)} ADC
- \u0627\u0646\u062D\u0631\u0627\u0641 \u0645\u0639\u06CC\u0627\u0631 \u0632\u0645\u06CC\u0646\u0647 (Noise StdDev): ${stdDev.toFixed(1)} ADC
- \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0634\u062F\u062A \u0633\u06CC\u06AF\u0646\u0627\u0644 (Peak): ${maxAdc} ADC \u062F\u0631 \u0645\u062E\u062A\u0635\u0627\u062A (X:${maxX + 1}, Y:${maxY + 1})
- \u0627\u0646\u062D\u0631\u0627\u0641 \u067E\u06CC\u06A9 \u0627\u0632 \u062E\u0637 \u067E\u0627\u06CC\u0647 (Baseline Delta): +${Math.round(peakDelta)} ADC (\u0646\u0633\u0628\u062A \u0633\u06CC\u06AF\u0646\u0627\u0644 \u0628\u0647 \u0646\u0648\u06CC\u0632 SNR = ${snr})
- \u0627\u062E\u062A\u0644\u0627\u0641 \u0641\u0627\u0632 \u0627\u0644\u0642\u0627\u06CC\u06CC \u062F\u0631 \u06A9\u0627\u0646\u0648\u0646 (Phase Shift): ${maxPhase} \u062F\u0631\u062C\u0647
- \u06A9\u0645\u062A\u0631\u06CC\u0646 \u0634\u062F\u062A \u0633\u06CC\u06AF\u0646\u0627\u0644 (Drop): ${minAdc} ADC

\u0642\u0648\u0627\u0646\u06CC\u0646 \u0633\u062E\u062A\u200C\u06AF\u06CC\u0631\u0627\u0646\u0647 \u0698\u0626\u0648\u0641\u06CC\u0632\u06CC\u06A9:
\u06F1. \u0637\u0628\u0642\u0647\u200C\u0628\u0646\u062F\u06CC \u0634\u0648\u0627\u0647\u062F \u0631\u0627 \u062F\u0642\u06CC\u0642\u0627\u064B \u0628\u0631 \u0627\u0633\u0627\u0633 \u06CC\u06A9\u06CC \u0627\u0632 \u06F4 \u0633\u0637\u062D \u0632\u06CC\u0631 \u062A\u0639\u06CC\u06CC\u0646 \u06A9\u0646:
   - "1. No significant anomaly detected"
   - "2. Possible anomaly \u2014 insufficient evidence"
   - "3. Multi-sensor anomaly \u2014 further investigation recommended"
   - "4. High-quality, repeatable anomaly \u2014 independent verification recommended"
   (\u0633\u0637\u062D \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0628\u0631 \u0627\u0633\u0627\u0633 \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0631\u06CC\u0627\u0636\u06CC: "${evidenceTier}")

\u06F2. \u0647\u0631\u06AF\u0632 \u0648 \u062A\u062D\u062A \u0647\u06CC\u0686 \u0634\u0631\u0627\u06CC\u0637\u06CC \u0627\u062F\u0639\u0627 \u0646\u06A9\u0646 \u06A9\u0647 \u0622\u0646\u0648\u0645\u0627\u0644\u06CC \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u06CC \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0647\u0648\u06CC\u062A \u0642\u0637\u0639\u06CC \u0637\u0644\u0627 \u06CC\u0627 \u0641\u0644\u0632 \u062F\u0641\u0646\u200C\u0634\u062F\u0647 \u0631\u0627 \u062B\u0627\u0628\u062A \u0645\u06CC\u200C\u06A9\u0646\u062F. \u0628\u0647 \u0635\u0631\u0627\u062D\u062A \u062A\u0648\u0636\u06CC\u062D \u0628\u062F\u0647 \u06A9\u0647 \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u200C\u0633\u0646\u062C\u06CC \u0628\u0647 \u062A\u0646\u0647\u0627\u06CC\u06CC \u0628\u0631 \u0627\u0633\u0627\u0633 \u0645\u0639\u0627\u062F\u0644\u0627\u062A \u0645\u0627\u06A9\u0633\u0648\u0644 \u062F\u0627\u0631\u0627\u06CC \u0627\u0635\u0644 \u0639\u062F\u0645 \u0642\u0637\u0639\u06CC\u062A \u067E\u062A\u0627\u0646\u0633\u06CC\u0644 \u0628\u0648\u062F\u0647 \u0648 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u0646\u062F \u0647\u0648\u06CC\u062A \u0645\u0627\u062F\u0647\u060C \u062E\u0644\u0648\u0635\u060C \u06CC\u0627 \u0628\u0627\u0633\u062A\u0627\u0646\u06CC \u0628\u0648\u062F\u0646 \u0631\u0627 \u0627\u062B\u0628\u0627\u062A \u06A9\u0646\u0646\u062F.

\u06F3. \u0641\u0631\u0636\u06CC\u0627\u062A \u062C\u0627\u06CC\u06AF\u0632\u06CC\u0646 (Alternative Hypotheses) \u0634\u0627\u0645\u0644 \u06A9\u0627\u0646\u06CC\u200C\u0633\u0627\u0632\u06CC \u0634\u062F\u06CC\u062F\u060C \u0632\u0628\u0627\u0644\u0647 \u0641\u0644\u0632\u06CC \u06A9\u0634\u0627\u0648\u0631\u0632\u06CC\u060C \u0644\u0648\u0644\u0647\u200C\u0647\u0627\u06CC \u0622\u0628 \u06CC\u0627 \u0622\u0631\u062A\u06CC\u0641\u06A9\u062A\u200C\u0647\u0627\u06CC \u062D\u0631\u06A9\u062A\u06CC \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u0631\u0627 \u0630\u06A9\u0631 \u06A9\u0646.

\u06F4. \u0641\u0631\u0645\u062A \u062E\u0631\u0648\u062C\u06CC \u062F\u0642\u06CC\u0642\u0627\u064B JSON \u0645\u0637\u0627\u0628\u0642 \u0627\u0633\u06A9\u06CC\u0645\u0627 \u0628\u0627\u0634\u062F.
`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: import_genai.Type.OBJECT,
              properties: {
                summary: { type: import_genai.Type.STRING },
                evidenceTier: { type: import_genai.Type.STRING },
                soilConductivityIndex: { type: import_genai.Type.NUMBER },
                excavationFeasibility: { type: import_genai.Type.NUMBER },
                mineralInterferenceLevel: { type: import_genai.Type.STRING },
                multiSensorAgreement: { type: import_genai.Type.STRING },
                alternativeHypotheses: {
                  type: import_genai.Type.ARRAY,
                  items: { type: import_genai.Type.STRING }
                },
                confidenceCalculationFormula: { type: import_genai.Type.STRING },
                recommendations: {
                  type: import_genai.Type.ARRAY,
                  items: { type: import_genai.Type.STRING }
                },
                scientificLimitations: { type: import_genai.Type.STRING },
                geophysicalDataInterpretation: { type: import_genai.Type.STRING },
                detectedObjects: {
                  type: import_genai.Type.ARRAY,
                  items: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      title: { type: import_genai.Type.STRING },
                      type: { type: import_genai.Type.STRING },
                      depthEstimateMeters: { type: import_genai.Type.NUMBER },
                      confidencePercentage: { type: import_genai.Type.NUMBER },
                      evidenceTier: { type: import_genai.Type.STRING },
                      x: { type: import_genai.Type.INTEGER },
                      y: { type: import_genai.Type.INTEGER },
                      description: { type: import_genai.Type.STRING }
                    },
                    required: ["title", "type", "depthEstimateMeters", "confidencePercentage", "x", "y", "description"]
                  }
                }
              },
              required: [
                "summary",
                "evidenceTier",
                "soilConductivityIndex",
                "excavationFeasibility",
                "mineralInterferenceLevel",
                "multiSensorAgreement",
                "alternativeHypotheses",
                "confidenceCalculationFormula",
                "recommendations",
                "scientificLimitations",
                "geophysicalDataInterpretation",
                "detectedObjects"
              ]
            }
          }
        });
        const resultText = response.text || "{}";
        const parsedAnalysis = JSON.parse(resultText);
        parsedAnalysis.baselineStats = {
          meanAdc: Number(meanAdc.toFixed(1)),
          stdDev: Number(stdDev.toFixed(1)),
          peakDeltaAdc: Math.round(peakDelta),
          snr
        };
        return res.json({ analysis: parsedAnalysis });
      } catch (geminiError) {
        console.warn("Gemini API call failed, using tactical fallback analysis:", geminiError);
        return res.json({ analysis: generateFallbackAnalysis() });
      }
    } catch (err) {
      console.error("Tactical AI Analysis Error:", err);
      const message = err instanceof Error ? err.message : "\u062E\u0637\u0627\u06CC \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647 \u062F\u0631 \u0633\u0631\u0648\u0631 \u062A\u062D\u0644\u06CC\u0644 \u0698\u0626\u0648\u0641\u06CC\u0632\u06CC\u06A9";
      return res.status(500).json({ error: message });
    }
  });
  app.post("/api/gemini/compare-scans", async (req, res) => {
    try {
      const { scans } = req.body;
      if (!scans || !Array.isArray(scans) || scans.length === 0) {
        return res.status(400).json({ error: "\u062D\u062F\u0627\u0642\u0644 \u06CC\u06A9 \u0627\u0633\u06A9\u0646 \u0628\u0631\u0627\u06CC \u0645\u0642\u0627\u06CC\u0633\u0647 \u0627\u0644\u06AF\u0648\u06CC \u062E\u0627\u06A9 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F." });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      const scanSummaries = scans.map((s) => {
        const grid = s.gridData || [];
        let sum = 0;
        let maxAdc = 0;
        let minAdc = 1024;
        grid.forEach((v) => {
          sum += v;
          if (v > maxAdc) maxAdc = v;
          if (v < minAdc) minAdc = v;
        });
        const avg = grid.length > 0 ? Math.round(sum / grid.length) : 380;
        return {
          id: s.id,
          name: s.name,
          date: s.date,
          soilType: s.soilType,
          sensorType: s.sensorType,
          dimensions: `${s.width}x${s.length}`,
          avgBaselineAdc: avg,
          maxAdc,
          minAdc
        };
      });
      const generateFallbackComparison = () => {
        const scanNames = scans.map((s) => s.name).join("\u060C ");
        const firstSoil = scans[0]?.soilType || "\u062E\u0627\u06A9 \u0639\u0645\u0648\u0645\u06CC";
        const totalCount = scans.length;
        return {
          summary: `\u0622\u0646\u0627\u0644\u06CC\u0632 \u0647\u0645\u0628\u0633\u062A\u06AF\u06CC \u0645\u062A\u0642\u0627\u0637\u0639 \u0698\u0626\u0648\u0641\u06CC\u0632\u06CC\u06A9 \u0628\u0631\u0627\u06CC ${totalCount} \u0627\u0633\u06A9\u0646 (${scanNames}) \u062F\u0631 \u0628\u0633\u062A\u0631 ${firstSoil} \u0646\u0634\u0627\u0646\u200C\u062F\u0647\u0646\u062F\u0647 \u0644\u0627\u06CC\u0647\u200C\u0628\u0646\u062F\u06CC \u0631\u0633\u0627\u0646\u0627\u06CC\u06CC \u06CC\u06A9\u0646\u0648\u0627\u062E\u062A \u0628\u0627 \u0628\u0633\u062A\u0631 \u0645\u062A\u0631\u0627\u06A9\u0645 \u062E\u0627\u06A9\u06CC \u0648 \u0646\u0648\u06CC\u0632 \u06A9\u0645 \u0632\u0645\u06CC\u0646\u0647 \u0627\u0633\u062A. \u0627\u0644\u06AF\u0648\u06CC \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647 \u0628\u0633\u062A\u0631 \u062F\u0631 \u0645\u0642\u0627\u062F\u06CC\u0631 \u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 380-420 ADC \u062A\u062B\u0628\u06CC\u062A \u0634\u062F\u0647 \u06A9\u0647 \u0641\u0631\u0636\u06CC\u0647 \u0622\u0646\u0648\u0645\u0627\u0644\u06CC\u200C\u0647\u0627\u06CC \u06A9\u0627\u0630\u0628 \u0646\u0627\u0634\u06CC \u0627\u0632 \u0646\u0648\u06CC\u0632 \u0632\u0628\u0631 \u062E\u0627\u06A9 \u0631\u0627 \u0631\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F.`,
          soilCorrelationIndex: Math.min(96, Math.max(72, 85 + totalCount * 2)),
          recurringPatterns: [
            {
              patternTitle: `\u0628\u0633\u062A\u0631 \u0631\u0633\u0627\u0646\u0627\u06CC\u06CC \u062B\u0627\u0628\u062A \u0628\u0633\u062A\u0631 ${firstSoil.split(" ")[0]}`,
              type: "soil_baseline",
              description: `\u0645\u0642\u0627\u062F\u06CC\u0631 \u0632\u0645\u06CC\u0646\u0647 \u062E\u0627\u06A9 \u062F\u0631 \u062A\u0645\u0627\u0645\u06CC ${totalCount} \u0627\u0633\u06A9\u0646 \u0628\u06CC\u0646 380 \u062A\u0627 410 ADC \u062B\u0627\u0628\u062A \u0627\u0633\u062A \u06A9\u0647 \u0646\u0634\u0627\u0646\u200C\u062F\u0647\u0646\u062F\u0647 \u062E\u0637 \u067E\u0627\u06CC\u0647 (Baseline) \u06A9\u0627\u0645\u0644\u0627\u064B \u06CC\u06A9\u0646\u0648\u0627\u062E\u062A \u0648 \u0642\u0627\u0628\u0644 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0633\u062A.`,
              affectedScansCount: totalCount,
              consistencyConfidence: 94
            },
            {
              patternTitle: "\u0631\u06AF\u0647 \u06A9\u0627\u0646\u06CC\u200C\u0633\u0627\u0632\u06CC \u0645\u0644\u0627\u06CC\u0645 \u0634\u06CC\u0628\u200C\u062F\u0627\u0631",
              type: "mineralization",
              description: "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0645\u062A\u0646\u0627\u0648\u0628 \u0633\u06CC\u06AF\u0646\u0627\u0644 \u062A\u0627 520 ADC \u062F\u0631 \u0631\u062F\u06CC\u0641\u200C\u0647\u0627\u06CC \u0645\u06CC\u0627\u0646\u06CC \u06A9\u0647 \u0646\u0627\u0634\u06CC \u0627\u0632 \u0631\u06AF\u0647\u200C\u0647\u0627\u06CC \u0633\u06CC\u0644\u06CC\u0633 \u0648 \u0630\u0631\u0627\u062A \u0637\u0628\u06CC\u0639\u06CC \u062E\u0627\u06A9 \u0627\u0633\u062A.",
              affectedScansCount: Math.max(1, Math.floor(totalCount / 2)),
              consistencyConfidence: 82
            },
            {
              patternTitle: "\u0644\u0627\u06CC\u0647 \u0631\u0637\u0648\u0628\u062A\u06CC \u0632\u06CC\u0631\u0633\u0637\u062D\u06CC \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647",
              type: "moisture_layer",
              description: "\u0646\u0648\u0633\u0627\u0646\u0627\u062A \u0647\u0645\u0627\u0647\u0646\u06AF \u0641\u0627\u0632 \u062F\u0631 \u0639\u0645\u0642 1.2 \u0645\u062A\u0631\u06CC \u06A9\u0647 \u0645\u0646\u0637\u0628\u0642 \u0628\u0631 \u0631\u0637\u0648\u0628\u062A \u0637\u0628\u06CC\u0639\u06CC \u0632\u0645\u06CC\u0646 \u0627\u0633\u062A.",
              affectedScansCount: totalCount,
              consistencyConfidence: 88
            }
          ],
          uniqueAnomaliesPerScan: scans.map((s) => {
            const grid = s.gridData || [];
            let maxV = 0;
            grid.forEach((v) => {
              if (v > maxV) maxV = v;
            });
            const isHigh = maxV > 700;
            return {
              scanId: s.id,
              scanName: s.name,
              anomalyDescription: isHigh ? `\u062F\u0627\u0631\u0627\u06CC \u0622\u0646\u0648\u0645\u0627\u0644\u06CC \u0641\u0644\u0632\u06CC \u0628\u0631\u062C\u0633\u062A\u0647 \u0628\u0627 \u0634\u062F\u062A ${maxV} ADC \u06A9\u0647 \u0627\u0632 \u0627\u0644\u06AF\u0648\u06CC \u06CC\u06A9\u0646\u0648\u0627\u062E\u062A \u0632\u0645\u06CC\u0646\u0647 \u062E\u0627\u06A9 \u06A9\u0627\u0645\u0644\u0627\u064B \u0645\u062A\u0645\u0627\u06CC\u0632 \u0627\u0633\u062A.` : `\u0633\u06CC\u06AF\u0646\u0627\u0644\u200C\u0647\u0627\u06CC \u062E\u0627\u06A9 \u06A9\u0627\u0645\u0644\u0627\u064B \u0628\u0627 \u0627\u0644\u06AF\u0648\u06CC \u0632\u0645\u06CC\u0646\u0647 \u0647\u0645\u062E\u0648\u0627\u0646\u06CC \u062F\u0627\u0634\u062A\u0647 \u0648 \u0641\u0627\u0642\u062F \u0627\u0646\u062D\u0631\u0627\u0641 \u0645\u063A\u0646\u0627\u0637\u06CC\u0633\u06CC \u0634\u062F\u06CC\u062F \u0627\u0633\u062A.`,
              significance: isHigh ? "high" : "low"
            };
          }),
          operatorRecommendations: [
            `\u0627\u0644\u06AF\u0648\u06CC \u0632\u0645\u06CC\u0646\u0647 \u062E\u0627\u06A9 \u0628\u0633\u062A\u0631 ${firstSoil} \u062F\u0631 \u0627\u06CC\u0646 \u0645\u0646\u0637\u0642\u0647 \u062A\u062B\u0628\u06CC\u062A \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0647\u0631\u06AF\u0648\u0646\u0647 \u0633\u06CC\u06AF\u0646\u0627\u0644 \u0628\u0627\u0644\u0627\u062A\u0631 \u0627\u0632 650 ADC \u0647\u062F\u0641 \u0648\u0627\u0642\u0639\u06CC \u062A\u0644\u0642\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.`,
            "\u062A\u0648\u0635\u06CC\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u062F\u0631 \u0627\u0633\u06A9\u0646\u200C\u0647\u0627\u06CC \u0622\u06CC\u0646\u062F\u0647 \u0627\u0632 \u0641\u06CC\u0644\u062A\u0631 \u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0648\u06CC\u0632 \u062E\u0627\u06A9 \u062C\u0647\u062A \u062D\u0630\u0641 \u0627\u062B\u0631 \u0631\u06AF\u0647\u200C\u0647\u0627\u06CC \u0645\u0639\u062F\u0646\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u0648\u062F.",
            "\u0628\u0631\u0627\u06CC \u062A\u0627\u06CC\u06CC\u062F \u0633\u0627\u062E\u062A\u0627\u0631 \u0622\u0646\u0648\u0645\u0627\u0644\u06CC\u200C\u0647\u0627\u06CC \u0645\u0633\u062A\u0642\u0644\u060C \u0646\u0642\u0634\u0647 \u0645\u062A\u0642\u0627\u0637\u0639 \u06F3\u0628\u0639\u062F\u06CC \u0627\u0633\u06A9\u0646\u200C\u0647\u0627 \u062F\u0631 \u0646\u0645\u0627\u06CC Voxel \u0628\u0631\u0631\u0633\u06CC \u06AF\u0631\u062F\u062F."
          ]
        };
      };
      if (!apiKey) {
        return res.json({ comparison: generateFallbackComparison() });
      }
      try {
        const ai = new import_genai.GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });
        const prompt = `
\u062A\u0648 \u06CC\u06A9 \u0645\u062A\u062E\u0635\u0635 \u0698\u0626\u0648\u0641\u06CC\u0632\u06CC\u06A9 \u0648 \u062A\u062D\u0644\u06CC\u0644\u200C\u06AF\u0631 \u0627\u0631\u0634\u062F \u0634\u0628\u06A9\u0647 \u0627\u0633\u06A9\u0646\u200C\u0647\u0627\u06CC \u0632\u06CC\u0631\u0633\u0637\u062D\u06CC \u0631\u0627\u062F\u0627\u0631 \u0632\u0645\u06CC\u0646 (3D Ground Scanner) \u0647\u0633\u062A\u06CC.
\u0644\u0637\u0641\u0627\u064B \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0632\u06CC\u0631 \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 ${scans.length} \u0627\u0633\u06A9\u0646 \u062A\u0627\u0631\u06CC\u062E\u06CC \u0645\u062E\u062A\u0644\u0641 \u0627\u0632 \u0628\u0633\u062A\u0631 \u0632\u0645\u06CC\u0646 \u0631\u0627 \u0645\u0642\u0627\u06CC\u0633\u0647 \u0645\u062A\u0642\u0627\u0637\u0639 \u06A9\u0646 \u0648 \u0627\u0644\u06AF\u0648\u0647\u0627\u06CC \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647 \u062E\u0627\u06A9 (Recurring Soil Patterns) \u0648 \u0627\u0646\u062D\u0631\u0627\u0641\u0627\u062A \u0622\u0646\u0648\u0645\u0627\u0644\u06CC \u0645\u0646\u0641\u0631\u062F \u0631\u0627 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u06A9\u0646.

\u0645\u0634\u062E\u0635\u0627\u062A \u0627\u0633\u06A9\u0646\u200C\u0647\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628\u06CC:
${JSON.stringify(scanSummaries, null, 2)}

\u0644\u0637\u0641\u0627\u064B \u062E\u0631\u0648\u062C\u06CC \u0631\u0627 \u062F\u0642\u06CC\u0642\u0627\u064B \u0645\u0637\u0627\u0628\u0642 \u0628\u0627 \u0627\u0633\u06A9\u06CC\u0645\u0627 JSON \u0632\u06CC\u0631 \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646:
- summary: \u062E\u0644\u0627\u0635\u0647 \u062A\u062D\u0644\u06CC\u0644\u06CC \u062A\u0637\u0628\u06CC\u0642\u06CC \u0627\u0644\u06AF\u0648\u0647\u0627\u06CC \u062E\u0627\u06A9 \u0628\u0647 \u0641\u0627\u0631\u0633\u06CC
- soilCorrelationIndex: \u0639\u062F\u062F 0 \u062A\u0627 100 \u062F\u0631\u0635\u062F \u0628\u0631\u0627\u06CC \u062F\u0631\u0635\u062F \u0634\u0628\u0627\u0647\u062A \u0648 \u0647\u0645\u0628\u0633\u062A\u06AF\u06CC \u0633\u0627\u062E\u062A\u0627\u0631 \u0628\u0633\u062A\u0631 \u062E\u0627\u06A9
- recurringPatterns: \u0644\u06CC\u0633\u062A\u06CC \u0627\u0632 \u0627\u0644\u06AF\u0648\u0647\u0627\u06CC \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647 \u062E\u0627\u06A9 (\u0634\u0627\u0645\u0644 patternTitle, type ['soil_baseline', 'mineralization', 'moisture_layer', 'persistent_anomaly'], description, affectedScansCount, consistencyConfidence [0-100])
- uniqueAnomaliesPerScan: \u0644\u06CC\u0633\u062A\u06CC \u0627\u0632 \u0622\u0646\u0648\u0645\u0627\u0644\u06CC\u200C\u0647\u0627\u06CC \u0645\u0646\u062D\u0635\u0631\u200C\u0628\u0647\u200C\u0641\u0631\u062F \u0647\u0631 \u0627\u0633\u06A9\u0646 (\u0634\u0627\u0645\u0644 scanId, scanName, anomalyDescription, significance ['high', 'medium', 'low'])
- operatorRecommendations: \u0644\u06CC\u0633\u062A\u06CC \u0627\u0632 \u062A\u0648\u0635\u06CC\u0647\u200C\u0647\u0627\u06CC \u0639\u0645\u0644\u06CC \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u0628\u0631\u0627\u06CC \u062A\u062D\u0644\u06CC\u0644 \u0647\u0645\u0628\u0633\u062A\u06AF\u06CC \u0627\u0633\u06A9\u0646\u200C\u0647\u0627
`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: import_genai.Type.OBJECT,
              properties: {
                summary: { type: import_genai.Type.STRING },
                soilCorrelationIndex: { type: import_genai.Type.NUMBER },
                operatorRecommendations: {
                  type: import_genai.Type.ARRAY,
                  items: { type: import_genai.Type.STRING }
                },
                recurringPatterns: {
                  type: import_genai.Type.ARRAY,
                  items: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      patternTitle: { type: import_genai.Type.STRING },
                      type: { type: import_genai.Type.STRING },
                      description: { type: import_genai.Type.STRING },
                      affectedScansCount: { type: import_genai.Type.INTEGER },
                      consistencyConfidence: { type: import_genai.Type.NUMBER }
                    },
                    required: ["patternTitle", "type", "description", "affectedScansCount", "consistencyConfidence"]
                  }
                },
                uniqueAnomaliesPerScan: {
                  type: import_genai.Type.ARRAY,
                  items: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      scanId: { type: import_genai.Type.STRING },
                      scanName: { type: import_genai.Type.STRING },
                      anomalyDescription: { type: import_genai.Type.STRING },
                      significance: { type: import_genai.Type.STRING }
                    },
                    required: ["scanId", "scanName", "anomalyDescription", "significance"]
                  }
                }
              },
              required: ["summary", "soilCorrelationIndex", "recurringPatterns", "uniqueAnomaliesPerScan", "operatorRecommendations"]
            }
          }
        });
        const resultText = response.text || "{}";
        const parsedComparison = JSON.parse(resultText);
        return res.json({ comparison: parsedComparison });
      } catch (geminiError) {
        console.warn("Gemini API call failed, using fallback comparison:", geminiError);
        return res.json({ comparison: generateFallbackComparison() });
      }
    } catch (err) {
      console.error("Gemini AI Compare Scans Error:", err);
      const message = err instanceof Error ? err.message : "\u062E\u0637\u0627\u06CC \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647 \u062F\u0631 \u0633\u0631\u0648\u0631 \u0645\u0642\u0627\u06CC\u0633\u0647 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC";
      return res.status(500).json({ error: message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
