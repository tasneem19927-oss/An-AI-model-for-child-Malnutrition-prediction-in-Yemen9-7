import { analyzeMuacTapeImage } from "../muacVisionModel";
import { defaultTFLiteEngine } from "../tfliteModel";
import { runEdgeDeviceBenchmark } from "../edgeBenchmark";
import { calibrateProbability, applyPlattScaling, applyIsotonicRegression } from "../calibration";
import { predictStackingEnsemble } from "../stackingModel";
import { biobertONNXEngine } from "../biobertOnnx";
import { ingestMedicalDocument } from "../kbIngestionPipeline";
import { runRagBenchmarkEvaluation } from "../ragBenchmark";
import { evaluateUnifiedCdss } from "../unifiedCdssEngine";
import { generateFollowupSchedule } from "../followupSystem";
import { clinicalAuditLogger } from "../auditLogger";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

export async function runClinicalAiEngineTests(): Promise<{ passed: number; total: number }> {
  let passed = 0;
  let total = 0;

  const testCases = [
    {
      name: "1. On-Device MUAC Vision Model detects color band",
      run: () => {
        const analysis = analyzeMuacTapeImage({
          width: 100,
          height: 100,
          pixels: new Uint8ClampedArray(4000).fill(200)
        });
        assert(analysis.detectedMuacMm > 80, "Detected MUAC should be valid mm reading");
        assert(analysis.confidence > 0.85, "Confidence score should be > 0.85");
      }
    },
    {
      name: "2. INT8 Quantized TFLite Engine executes inference within mobile latency bounds",
      run: () => {
        const res = defaultTFLiteEngine.predict({
          age_months: 12,
          sex: 1,
          weight_kg: 6.5,
          height_cm: 68.0,
          muac_mm: 110,
          oedema: 1
        });
        assert(res.wastingProb >= 0 && res.wastingProb <= 1, "Probability should be between 0 and 1");
        assert(res.latencyMs < 20, "Latency should be < 20ms");
      }
    },
    {
      name: "3. Edge Device Benchmark returns low-end Android metrics",
      run: () => {
        const bench = runEdgeDeviceBenchmark("Low-End Android (2GB RAM)");
        assert(bench.inferenceLatencyMs > 0, "Latency should be > 0");
        assert(bench.memoryUsageMb < 100, "Memory footprint should be < 100MB");
      }
    },
    {
      name: "4. Probability Calibration calculates Platt and Isotonic scaling",
      run: () => {
        const rawP = 0.78;
        const plattP = applyPlattScaling(rawP);
        const isotonicP = applyIsotonicRegression(rawP);
        const calibrated = calibrateProbability(rawP);

        assert(plattP > 0 && isotonicP > 0, "Calibrated probabilities should be > 0");
        assert(calibrated.selectedMethod === "Platt" || calibrated.selectedMethod === "Isotonic", "Valid calibration method");
      }
    },
    {
      name: "5. Stacking Ensemble combines base models for boosted accuracy",
      run: () => {
        const res = predictStackingEnsemble(0.65, { haz: -2.5, whz: -3.1, muac_mm: 112, oedema: 0 });
        assert(res.metaStackingProbability > 0, "Meta probability > 0");
        assert(res.statisticallySignificantGain === true, "Significant gain verified");
      }
    },
    {
      name: "6. BioBERT ONNX Engine extracts symptoms and clinical intents offline",
      run: () => {
        const result = biobertONNXEngine.parseClinicalNotes("Child has severe acute malnutrition with bilateral pitting oedema.");
        assert(result.intent === "MALNUTRITION_DIAGNOSIS", "Intent matched");
        assert(result.entities.length > 0, "Entities extracted");
      }
    },
    {
      name: "7. Knowledge Base Ingestion Pipeline formats guidelines with BioBERT embeddings",
      run: () => {
        const ref = ingestMedicalDocument({
          title: "WHO IMCI Guidelines 2025",
          organization: "WHO",
          year: 2025,
          content: "Acute malnutrition treatment protocols using RUTF and F-75 milk in stabilization centers.",
          sourceUrl: "https://who.int/imci",
          category: "SAM Protocol"
        });
        assert(ref.id.includes("REF-WHO"), "Correct REF ID generated");
      }
    },
    {
      name: "8. RAG Benchmark Evaluation metrics calculate Recall@K and MRR",
      run: () => {
        const ragEval = runRagBenchmarkEvaluation();
        assert(ragEval.recallAtK > 0.90, "Recall@K > 0.90");
        assert(ragEval.meanReciprocalRank > 0.85, "MRR > 0.85");
      }
    },
    {
      name: "9. Unified CDSS Engine enforces WHO Hard Constraints over ML soft priors when inconsistent",
      run: () => {
        const cdss = evaluateUnifiedCdss(
          "PAT-123",
          0.15,
          0.20,
          0.10,
          6.0,
          65.0,
          108,
          true,
          { whz: -3.2 }
        );
        assert(cdss.finalSeverity === "Severe", "Final severity should be Severe due to Hard Constraints");
      }
    },
    {
      name: "10. Follow-up Visit Schedule allocates weekly intervals for SAM",
      run: () => {
        const sched = generateFollowupSchedule("PAT-456", "Amina Ali", "Severe");
        assert(sched.recommendedIntervalDays === 7, "Weekly follow up for SAM");
      }
    },
    {
      name: "11. Clinical Audit Logger logs immutable events",
      run: async () => {
        const log = await clinicalAuditLogger.logEvent(
          "test@mophp.gov.ye",
          "Doctor",
          "Test Action",
          "Audit verification test"
        );
        assert(log.id.includes("AUDIT-"), "Valid Audit ID generated");
      }
    }
  ];

  for (const testCase of testCases) {
    total++;
    try {
      await testCase.run();
      passed++;
    } catch (err) {
      console.error(`Test failed: ${testCase.name}`, err);
    }
  }

  return { passed, total };
}
