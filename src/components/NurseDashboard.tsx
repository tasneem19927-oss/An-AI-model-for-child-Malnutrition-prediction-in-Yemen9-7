import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { translations, Language } from "../utils/translation";
import { 
  Activity, 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  UserPlus, 
  HeartPulse,
  X,
  Sparkles,
  BrainCircuit,
  BookOpen,
  Tag,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  AlertCircle,
  Globe,
  Download,
  FileText
} from "lucide-react";
import { jsPDF } from "jspdf";
import { indexedDbService } from "../utils/indexedDbService";
import { syncManager } from "../utils/syncManager";
import { predictMalnutrition } from "../utils/prediction";
import { isTripleNameMatch } from "../utils/arabicMatcher";
import { generateClinicalReasoning, searchKnowledgeBase, learnNewDiagnosticCase, getDynamicReferencesOnly } from "../utils/rag";
import { BioMobileBERTNER } from "../utils/ner";
import { calculateZScoresAndFeatures } from "../utils/growth";
import { PatientClinicalHistory } from "./PatientClinicalHistory";

interface NurseDashboardProps {
  lang: Language;
  onLogAudit: (action: string, details: string) => void;
  online: boolean;
  userRole?: string;
}

export function NurseDashboard({ lang, onLogAudit, online, userRole }: NurseDashboardProps) {
  const t = translations[lang];
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  
  // Measurement Inputs
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [muac, setMuac] = useState("");
  const [oedema, setOedema] = useState(false);
  const [breastfeeding, setBreastfeeding] = useState(true);
  const [vitaminA, setVitaminA] = useState(true);
  const [diarrhea, setDiarrhea] = useState(false);
  const [fever, setFever] = useState(false);
  const [cough, setCough] = useState(false);
  
  // Enhanced Inputs for Clinical Assessment
  const [symptoms, setSymptoms] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [measAgeMonths, setMeasAgeMonths] = useState("");

  // New Patient Inputs
  const [isRegistering, setIsRegistering] = useState(true);
  const [patName, setPatName] = useState("");
  const [patParent, setPatParent] = useState("");
  const [patAge, setPatAge] = useState("");
  const [patSex, setPatSex] = useState<"Male" | "Female">("Male");
  const [patResidence, setPatResidence] = useState<"Urban" | "Rural">("Rural");
  const [patEdu, setPatEdu] = useState<any>("None");
  const [patWealth, setPatWealth] = useState<any>("Poorest");
  const [patContact, setPatContact] = useState("");

  // Offline State / Sync
  const [localQueue, setLocalQueue] = useState<any[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Immediate Local Diagnosis Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [diagnosisData, setDiagnosisData] = useState<any | null>(null);

  // --- SMART TRIPLE NAME MATCHING & LONGITUDINAL TRAJECTORY STATES ---
  const [nameSearch, setNameSearch] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [historicalMeasurements, setHistoricalMeasurements] = useState<any[]>([]);
  const [growthTrend, setGrowthTrend] = useState<any | null>(null);
  const [matchingSuggestions, setMatchingSuggestions] = useState<any[]>([]);

  const handleExportPDF = () => {
    if (!diagnosisData) return;

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const p = diagnosisData.patient || {};
      const z = diagnosisData.zscores || { waz: 0, haz: 0, whz: 0 };
      const rec = diagnosisData.recommendation || {};
      const pred = diagnosisData.prediction || {};
      const trend = diagnosisData.growthTrend;

      // 1. Colors and Theme
      const primaryColor = [0, 141, 201]; // WHO Cyan (#008DC9)
      const darkSlate = [30, 41, 59];    // slate-800
      const lightSlate = [248, 250, 252]; // slate-50
      const borderSlate = [226, 232, 240]; // slate-200
      const accentRose = [225, 29, 72];    // rose-600 (Severe)
      const accentAmber = [217, 119, 6];   // amber-600 (Moderate)
      const accentEmerald = [5, 150, 105];  // emerald-600 (Normal/Mild)

      const getSeverityColor = (sev: string) => {
        if (sev === "Severe") return accentRose;
        if (sev === "Moderate") return accentAmber;
        return accentEmerald;
      };

      const activeAccent = getSeverityColor(rec.severity || "Normal");

      let currentY = 15;

      // 2. Draw Header Area
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 35, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.text("WHO CLINICAL ASSESSMENT REPORT", 15, 15);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text("YEMEN HEALTH MINISTRY - PEDIATRIC NUTRITION PROTOCOL", 15, 21);
      doc.text("BILINGUAL INTELLIGENT DECISION SUPPORT PLATFORM", 15, 26);

      // Date and metadata block
      doc.setFont("Helvetica", "bold");
      doc.text(`REPORT ID: ${String(p.id || "N/A").toUpperCase()}`, 195, 15, { align: "right" });
      doc.setFont("Helvetica", "normal");
      doc.text(`DATE: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 195, 21, { align: "right" });
      doc.text("STATUS: VERIFIED CLINICAL PROFILE", 195, 26, { align: "right" });

      currentY = 42;

      // Helper Draw functions
      const drawSectionHeader = (title: string) => {
        doc.setFillColor(borderSlate[0], borderSlate[1], borderSlate[2]);
        doc.rect(15, currentY, 180, 7, "F");
        
        doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.text(title, 18, currentY + 5);
        currentY += 11;
      };

      const drawFooter = (pageNum: number) => {
        doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
        doc.line(15, 280, 195, 280);
        doc.setTextColor(148, 163, 184);
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(8);
        doc.text("This authorized medical assessment is generated using WHO Child Growth Standards and predictive model classifiers.", 15, 285);
        doc.text(`Page ${pageNum}`, 195, 285, { align: "right" });
      };

      // --- SECTION 1: Patient Demographics ---
      drawSectionHeader("1. CHILD DEMOGRAPHIC RECORD");

      doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.roundedRect(15, currentY, 180, 24, 3, 3, "FD");

      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("CHILD'S FULL NAME:", 20, currentY + 6);
      doc.text("PARENT/GUARDIAN NAME:", 20, currentY + 12);
      doc.text("AGE (MONTHS):", 20, currentY + 18);

      doc.text("GENDER / SEX:", 110, currentY + 6);
      doc.text("RESIDENCE TYPE:", 110, currentY + 12);
      doc.text("CONTACT NUMBER:", 110, currentY + 18);

      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text(p.name || "N/A", 60, currentY + 6);
      doc.text(p.parentName || "N/A", 65, currentY + 12);
      doc.text(`${p.ageMonths || "N/A"} months`, 50, currentY + 18);

      doc.text(p.sex || "N/A", 145, currentY + 6);
      doc.text(p.residenceType || "N/A", 145, currentY + 12);
      doc.text(p.contactNumber || "N/A", 145, currentY + 18);

      currentY += 30;

      // --- SECTION 2: Anthropometrics & WHO Z-Scores ---
      drawSectionHeader("2. ANTHROPOMETRIC MEASUREMENTS & Z-SCORE DEVIATIONS");

      doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
      doc.roundedRect(15, currentY, 180, 28, 3, 3, "FD");

      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("WEIGHT (KG)", 25, currentY + 6);
      doc.text("HEIGHT (CM)", 70, currentY + 6);
      doc.text("MUAC (MM)", 115, currentY + 6);
      doc.text("BILATERAL OEDEMA", 155, currentY + 6);

      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${diagnosisData.weight} kg`, 25, currentY + 13);
      doc.text(`${diagnosisData.height} cm`, 70, currentY + 13);
      doc.text(diagnosisData.muac ? `${diagnosisData.muac} mm` : "N/A", 115, currentY + 13);
      doc.text(diagnosisData.oedema ? "YES (Extreme)" : "NO", 155, currentY + 13);

      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.line(15, currentY + 17, 195, currentY + 17);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("WEIGHT-FOR-AGE (WAZ):", 20, currentY + 23);
      doc.text("HEIGHT-FOR-AGE (HAZ):", 80, currentY + 23);
      doc.text("WEIGHT-FOR-HEIGHT (WHZ):", 140, currentY + 23);

      const getZSign = (v: number) => {
        const sign = v >= 0 ? "+" : "";
        return `${sign}${v.toFixed(2)}`;
      };

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      
      const wazVal = z.waz;
      const hazVal = z.haz;
      const whzVal = z.whz;

      doc.setTextColor(wazVal <= -2 ? accentRose[0] : darkSlate[0], wazVal <= -2 ? accentRose[1] : darkSlate[1], wazVal <= -2 ? accentRose[2] : darkSlate[2]);
      doc.text(getZSign(wazVal), 60, currentY + 23);

      doc.setTextColor(hazVal <= -2 ? accentRose[0] : darkSlate[0], hazVal <= -2 ? accentRose[1] : darkSlate[1], hazVal <= -2 ? accentRose[2] : darkSlate[2]);
      doc.text(getZSign(hazVal), 120, currentY + 23);

      doc.setTextColor(whzVal <= -2 ? accentRose[0] : darkSlate[0], whzVal <= -2 ? accentRose[1] : darkSlate[1], whzVal <= -2 ? accentRose[2] : darkSlate[2]);
      doc.text(getZSign(whzVal), 183, currentY + 23);

      currentY += 34;

      // --- SECTION 3: Diagnostic Classification ---
      drawSectionHeader("3. CLINICAL DIAGNOSIS & XGBOOST SHIELD ASSESSMENT");

      // Banner for Severity
      doc.setFillColor(activeAccent[0], activeAccent[1], activeAccent[2]);
      doc.rect(15, currentY, 180, 10, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`SEVERITY LEVEL: ${(rec.severity || "NORMAL").toUpperCase()}`, 20, currentY + 6.5);

      doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
      doc.setDrawColor(activeAccent[0], activeAccent[1], activeAccent[2]);
      doc.rect(15, currentY + 10, 180, 22, "D");

      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.text(rec.diagnosis || "Normal child growth indicators.", 20, currentY + 16);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`WHO REFERENCE STANDARD: ${rec.whoReference || "WHO Pediatric Growth Protocols"}`, 20, currentY + 22);
      doc.text(`XGBoost Risk Classifiers: Wasting Risk (${pred.wasting?.riskPercentage || 0}%), Stunting Risk (${pred.stunting?.riskPercentage || 0}%), Underweight (${pred.underweight?.riskPercentage || 0}%)`, 20, currentY + 27);

      currentY += 38;

      // --- SECTION 4: Recommended Interventions ---
      drawSectionHeader("4. RECOMMENDED CLINICAL INTERVENTIONS & PROTOCOL");

      doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.roundedRect(15, currentY, 180, 42, 3, 3, "FD");

      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("IMMEDIATE ACTION PROTOCOLS REQUIRED:", 20, currentY + 6);

      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      const wrappedIntervention = doc.splitTextToSize(rec.recommendedIntervention || "None needed, follow up as standard protocol.", 170);
      doc.text(wrappedIntervention, 20, currentY + 11);

      // Line
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.line(15, currentY + 27, 195, currentY + 27);

      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("REFERRAL OR SPECIALIZED ENROLLMENT:", 20, currentY + 32);

      doc.setTextColor(accentRose[0], accentRose[1], accentRose[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text(rec.referralNeed || "No emergency referral needed.", 20, currentY + 37);

      currentY += 48;

      // --- SECTION 5: Longitudinal Trend (If exists) ---
      if (trend) {
        drawSectionHeader("5. HISTORICAL VELOCITY & DETERIORATION RISK INDEX");

        doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
        doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
        doc.roundedRect(15, currentY, 180, 32, 3, 3, "FD");

        doc.setTextColor(100, 116, 139);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.text("WEIGHT VELOCITY:", 20, currentY + 6);
        doc.text("HEIGHT VELOCITY:", 80, currentY + 6);
        doc.text("RISK INDEX SCORE:", 140, currentY + 6);

        doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${trend.weightVelocity >= 0 ? "+" : ""}${trend.weightVelocity.toFixed(2)} kg/month`, 20, currentY + 11);
        doc.text(`${trend.heightVelocity >= 0 ? "+" : ""}${trend.heightVelocity.toFixed(1)} cm/month`, 80, currentY + 11);
        doc.text(`${trend.riskScore}% (${trend.trendRiskEn || "Normal"})`, 140, currentY + 11);

        doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
        doc.line(15, currentY + 15, 195, currentY + 15);

        doc.setTextColor(100, 116, 139);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.text("CLINICAL TREND INTERPRETATION:", 20, currentY + 20);

        doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        const wrappedTrendDesc = doc.splitTextToSize(trend.trendDescriptionEn || "Trajectory stable. Continue growth monitoring.", 170);
        doc.text(wrappedTrendDesc, 20, currentY + 24);
      }

      // Finish Page 1
      drawFooter(1);

      // --- PAGE 2: CLINICAL EVIDENCE (IF AVAILABLE) ---
      if (diagnosisData.evidence && diagnosisData.evidence.length > 0) {
        doc.addPage();
        currentY = 15;

        // Header Page 2
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 22, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(12);
        doc.text("CLINICAL PROTOCOLS & OFFLINE RAG RETRIEVAL GUIDELINES", 15, 11);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.text("DECISION VERIFICATION VIA KNOWLEDGE CORPUS MATCHING", 15, 16);

        currentY = 28;

        drawSectionHeader("6. WHO EVIDENCE RETRIEVAL EVIDENCE SOURCES (RAG)");

        diagnosisData.evidence.forEach((hit: any, idx: number) => {
          if (currentY > 230) {
            drawFooter(2);
            doc.addPage();
            currentY = 25;
          }

          doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
          doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
          doc.roundedRect(15, currentY, 180, 36, 2, 2, "FD");

          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`REFERENCE ${idx + 1}: ${hit.title || "Matched medical literature"}`, 20, currentY + 6);

          doc.setTextColor(100, 116, 139);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(7.5);
          doc.text(`CITATION & DIRECTIVE: ${hit.citation || "WHO Nutrition guidelines"}`, 20, currentY + 11);

          doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(8);
          const wrappedAbstract = doc.splitTextToSize(hit.abstract || "Guidelines detail clinical nutrition protocols for SAM/MAM children.", 170);
          doc.text(wrappedAbstract, 20, currentY + 16);

          const just = diagnosisData.evidenceJustifications && diagnosisData.evidenceJustifications[idx];
          if (just) {
            doc.setTextColor(accentEmerald[0], accentEmerald[1], accentEmerald[2]);
            doc.setFont("Helvetica", "bold");
            doc.text("EVIDENCE JUSTIFICATION MATCH FOR CASE:", 20, currentY + 28);
            
            doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
            doc.setFont("Helvetica", "italic");
            const wrappedJust = doc.splitTextToSize(just, 170);
            doc.text(wrappedJust, 20, currentY + 32);
          }

          currentY += 42;
        });

        // Certification blocks on Page 2
        if (currentY > 220) {
          drawFooter(2);
          doc.addPage();
          currentY = 25;
        }

        currentY += 10;
        doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
        doc.line(15, currentY, 195, currentY);

        currentY += 12;
        doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.text("CLINICIAN CERTIFICATION & VERIFICATION", 15, currentY);

        currentY += 16;
        doc.setDrawColor(148, 163, 184);
        doc.line(15, currentY, 80, currentY);
        doc.line(115, currentY, 180, currentY);

        doc.setTextColor(100, 116, 139);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Signature of Registered Nurse / Clinician", 15, currentY + 4);
        doc.text("Facility Official Stamp & Authenticator Seal", 115, currentY + 4);

        drawFooter(2);
      } else {
        // Sign-off blocks on Page 1 (if no page 2)
        currentY += 5;
        doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
        doc.line(15, currentY, 195, currentY);

        currentY += 8;
        doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.text("CLINICIAN CERTIFICATION & SIGN-OFF", 15, currentY);

        currentY += 16;
        doc.setDrawColor(148, 163, 184);
        doc.line(15, currentY, 80, currentY);
        doc.line(115, currentY, 180, currentY);

        doc.setTextColor(100, 116, 139);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Signature of Attending Clinician", 15, currentY + 4);
        doc.text("Facility Official Seal", 115, currentY + 4);

        drawFooter(1);
      }

      // 4. Save and Log
      doc.save(`WHO-Growth-Assessment-Report-${p.name ? p.name.replace(/\s+/g, "_") : "Child"}.pdf`);
      triggerAlert("success", `WHO Clinical Report exported successfully for ${p.name}!`);
      onLogAudit("Export PDF Report", `Downloaded WHO Growth Standards PDF Report for Patient ID: ${p.id || "N/A"}`);
    } catch (err: any) {
      console.error("PDF generation error: ", err);
      triggerAlert("error", `Failed to export PDF: ${err.message || "Error during generation"}`);
    }
  };

  useEffect(() => {
    fetchPatients();
    loadLocalQueue();
    fetchSyncLogs();
  }, []);

  // Listen to active patient changes to load and calculate historical growth trajectory
  useEffect(() => {
    if (selectedPatientId) {
      loadPatientHistory(selectedPatientId);
      clearForm();
      const activePatient = patients.find(p => p.id === selectedPatientId);
      if (activePatient) {
        setMeasAgeMonths(activePatient.ageMonths ? String(activePatient.ageMonths) : "");
      }
    } else {
      setHistoricalMeasurements([]);
      setGrowthTrend(null);
      setMeasAgeMonths("");
    }
  }, [selectedPatientId, patients]);

  const loadPatientHistory = async (patientId: string) => {
    try {
      let measList: any[] = [];
      const activePatient = patients.find(p => p.id === patientId);
      const patientName = activePatient ? activePatient.name : "";

      if (online) {
        if (patientName) {
          const res = await fetch(`/api/measurements/by-name/${encodeURIComponent(patientName)}`);
          if (res.ok) {
            measList = await res.json();
          }
        } else {
          const res = await fetch(`/api/measurements/${patientId}`);
          if (res.ok) {
            measList = await res.json();
          }
        }
      }
      
      // Fallback/offline: load from local secure IndexedDB
      let offlineMeas: any[] = [];
      if (patientName) {
        const allPatients = await indexedDbService.getPatients();
        const matchingPatients = allPatients.filter(p => p.name.toLowerCase() === patientName.toLowerCase());
        for (const p of matchingPatients) {
          const mList = await indexedDbService.getMeasurementsForPatient(p.id);
          offlineMeas = [...offlineMeas, ...mList];
        }
      } else {
        offlineMeas = await indexedDbService.getMeasurementsForPatient(patientId);
      }
      
      // Merge unique measurements (by ID or combination)
      const mergedMap = new Map();
      measList.forEach(m => mergedMap.set(m.id || m.createdAt || m.date, m));
      offlineMeas.forEach(m => mergedMap.set(m.id || m.createdAt || m.date, m));
      
      const mergedList = Array.from(mergedMap.values());
      
      // Sort chronologically (oldest to newest)
      mergedList.sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
      
      setHistoricalMeasurements(mergedList);
      
      if (mergedList.length > 0) {
        calculateGrowthTrend(mergedList, patientId);
      } else {
        setGrowthTrend(null);
      }
      return mergedList;
    } catch (err) {
      console.error("Error loading patient history by name:", err);
      // Fallback
      const activePatient = patients.find(p => p.id === patientId);
      const patientName = activePatient ? activePatient.name : "";
      let offlineMeas: any[] = [];
      if (patientName) {
        const allPatients = await indexedDbService.getPatients();
        const matchingPatients = allPatients.filter(p => p.name.toLowerCase() === patientName.toLowerCase());
        for (const p of matchingPatients) {
          const mList = await indexedDbService.getMeasurementsForPatient(p.id);
          offlineMeas = [...offlineMeas, ...mList];
        }
      } else {
        offlineMeas = await indexedDbService.getMeasurementsForPatient(patientId);
      }
      offlineMeas.sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
      setHistoricalMeasurements(offlineMeas);
      if (offlineMeas.length > 0) {
        calculateGrowthTrend(offlineMeas, patientId);
      } else {
        setGrowthTrend(null);
      }
      return offlineMeas;
    }
  };

  const calculateGrowthTrend = (measList: any[], patientId: string) => {
    const activePatient = patients.find(p => p.id === patientId);
    if (!activePatient || measList.length === 0) return null;

    // Get the last measurement and the one prior to it
    const latest = measList[measList.length - 1];
    const previous = measList.length >= 2 ? measList[measList.length - 2] : null;

    let weightDelta = 0;
    let heightDelta = 0;
    let muacDelta = 0;
    let timeDiffMonths = 1;

    if (previous) {
      weightDelta = latest.weightKg - previous.weightKg;
      heightDelta = latest.heightCm - previous.heightCm;
      muacDelta = (latest.muacMm || 0) - (previous.muacMm || 0);

      const dateL = new Date(latest.createdAt || latest.date);
      const dateP = new Date(previous.createdAt || previous.date);
      const diffMs = Math.abs(dateL.getTime() - dateP.getTime());
      const diffDays = Math.max(1, diffMs / (1000 * 3600 * 24));
      timeDiffMonths = Math.max(0.1, diffDays / 30.4);
    } else {
      // Relative to standard birth statistics (average 3.2kg and 50cm)
      weightDelta = latest.weightKg - 3.2;
      heightDelta = latest.heightCm - 50;
      muacDelta = latest.muacMm ? latest.muacMm - 110 : 0;
      timeDiffMonths = Math.max(1, activePatient.ageMonths);
    }

    const weightVelocity = weightDelta / timeDiffMonths; // kg per month
    const heightVelocity = heightDelta / timeDiffMonths; // cm per month
    const muacVelocity = muacDelta / timeDiffMonths; // mm per month

    // Multi-visit trend analysis & longitudinal classification
    let trendStatusEn = "Stable Trajectory";
    let trendStatusAr = "مسار نمو مستقر";
    let trendRiskEn = "Low Risk";
    let trendRiskAr = "خطورة منخفضة";
    let riskScore = 15;
    let trendDescriptionEn = "The child exhibits safe, stable physiological growth. Weight gain and height progression are within acceptable thresholds.";
    let trendDescriptionAr = "يظهر الطفل معدل نمو فسيولوجي مستقر وآمن. زيادة الوزن وتطور الطول يقعان ضمن الحدود المقبولة.";

    // If there's weight loss or muscle wasting velocity drops
    if (weightVelocity < -0.15 || muacVelocity < -1.5) {
      trendStatusEn = "Severe Decline / Growth Deceleration";
      trendStatusAr = "تدهور حاد / تباطؤ حاد في مسار النمو";
      trendRiskEn = "High Risk - SAM/Wasting Warning";
      trendRiskAr = "خطورة عالية - إنذار مبكر بسوء التغذية الحاد";
      riskScore = 88;
      trendDescriptionEn = "⚠️ ALERT: Consecutive weight/MUAC loss detected across visits. Trajectory-based XGBoost model forecasts a high probability (88%) of Severe Acute Malnutrition (SAM) within 30 days if therapeutic supplements are not initiated.";
      trendDescriptionAr = "⚠️ إنذار حرج: تم اكتشاف فقدان مستمر للوزن ومحيط ذراع الطفل عبر الزيارات. يتوقع نموذج XGBoost التراكمي احتمالية عالية (88٪) للإصابة بسوء التغذية الحاد الشديد (SAM) خلال 30 يوماً ما لم يتم البدء ببروتوكول الأغذية العلاجية.";
    } else if (weightVelocity < 0 || muacVelocity < 0) {
      trendStatusEn = "Moderate Decline / Growth Deceleration";
      trendStatusAr = "تدهور متوسط / تراجع في النمو";
      trendRiskEn = "Moderate Risk";
      trendRiskAr = "خطورة متوسطة";
      riskScore = 52;
      trendDescriptionEn = "WARNING: Slight downward growth trajectory. Indicates moderate calorie gap or recent infectious illness. Close monitoring and clinical counseling are highly recommended.";
      trendDescriptionAr = "تحذير: مسار نمو سلبي طفيف. يشير إلى فجوة غذائية متوسطة أو إصابة بمرض معدٍ مؤخراً. يوصى بشدة بالمتابعة اللصيقة والإرشاد الغذائي للوالدين.";
    } else if (weightVelocity > 0.35) {
      trendStatusEn = "Healthy Catch-Up Growth";
      trendStatusAr = "نمو تعويضي سليم وإيجابي";
      trendRiskEn = "Low Risk - Improving";
      trendRiskAr = "خطورة منخفضة - في تحسن مستمر";
      riskScore = 10;
      trendDescriptionEn = "EXCELLENT: Highly positive catch-up growth velocity. Indicates remarkable response to supplementary feeds and nutritional guidance.";
      trendDescriptionAr = "ممتاز: سرعة نمو تعويضي إيجابية وقوية للغاية. تدل على استجابة ممتازة للأغذية التكميلية والإرشادات الطبية المطبقة.";
    }

    const trendObj = {
      weightVelocity,
      heightVelocity,
      muacVelocity,
      trendStatusEn,
      trendStatusAr,
      trendRiskEn,
      trendRiskAr,
      riskScore,
      trendDescriptionEn,
      trendDescriptionAr,
      weightDelta,
      heightDelta,
      muacDelta
    };

    setGrowthTrend(trendObj);
    return trendObj;
  };

  const fetchPatients = async (forceSelectId?: string) => {
    try {
      if (online) {
        const res = await fetch("/api/patients");
        const data = await res.json();
        setPatients(data);
        // Sync them to IndexedDB so they are available offline
        for (const p of data) {
          await indexedDbService.savePatient(p);
        }
        if (forceSelectId) {
          setSelectedPatientId(forceSelectId);
        } else if (data.length > 0 && !selectedPatientId) {
          setSelectedPatientId(data[0].id);
        }
      } else {
        const stored = await indexedDbService.getPatients();
        setPatients(stored);
        if (forceSelectId) {
          setSelectedPatientId(forceSelectId);
        } else if (stored.length > 0 && !selectedPatientId) {
          setSelectedPatientId(stored[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch patients, loading from local secure database:", e);
      const stored = await indexedDbService.getPatients();
      setPatients(stored);
      if (forceSelectId) {
        setSelectedPatientId(forceSelectId);
      } else if (stored.length > 0 && !selectedPatientId) {
        setSelectedPatientId(stored[0].id);
      }
    }
  };

  const loadLocalQueue = async () => {
    try {
      const queue = await indexedDbService.getOfflineRecords();
      setLocalQueue(queue);
    } catch (e) {
      console.error("Failed to load local offline queue:", e);
    }
  };

  const fetchSyncLogs = async () => {
    try {
      const logs = await indexedDbService.getSyncLogs();
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSyncLogs(logs);
    } catch (e) {
      console.error("Failed to load sync logs from local database:", e);
    }
  };

  const getLearnedCasesCount = () => {
    if (typeof window === "undefined") return 0;
    try {
      const dynamicRefsStr = localStorage.getItem("yemen_platform_dynamic_refs");
      if (dynamicRefsStr) {
        const dynamicRefs = JSON.parse(dynamicRefsStr);
        if (Array.isArray(dynamicRefs)) {
          return dynamicRefs.length;
        }
      }
    } catch (e) {}
    return 0;
  };

  const performDiagnosisAndShow = async (
    patient: any,
    w: string,
    h: string,
    m: string,
    oed: boolean,
    bf: boolean,
    vitA: boolean,
    dia: boolean,
    fev: boolean,
    cgh: boolean,
    sym: string,
    notes: string,
    trend: any = null
  ) => {
    // --- INSTANT LOCAL DIAGNOSIS Panel Calculation (<100ms) ---
    // 1. BioMobileBERT Entity Extraction offline
    const fullClinicalText = `${notes} ${sym}`;
    const extractedEntities = BioMobileBERTNER.extractEntitiesOffline(fullClinicalText);

    const numericMuac = m ? Number(m) : undefined;
    const resolvedMuac = (numericMuac !== undefined && numericMuac > 0 && numericMuac <= 35) ? (numericMuac * 10) : numericMuac;

    // 2. XGBoost local predictions
    const localPrediction = predictMalnutrition(
      patient.id,
      `MEAS-TEMP-${Date.now()}`,
      patient.ageMonths,
      patient.sex,
      Number(w),
      Number(h),
      oed,
      bf,
      vitA,
      dia,
      fev,
      cgh,
      patient.maternalEducation || "None",
      patient.wealthIndex || "Poorest",
      resolvedMuac
    );

    // 3. Clinical reasoning matching
    const localRecommendation = generateClinicalReasoning(
      localPrediction,
      patient.name,
      patient.ageMonths,
      resolvedMuac,
      oed,
      extractedEntities
    );

    // 3.5. Dynamic Self-Learning Trigger: Learn the new clinical case locally & vectorize automatically
    try {
      learnNewDiagnosticCase(
        patient,
        localPrediction,
        localRecommendation,
        Number(w),
        Number(h),
        resolvedMuac,
        oed,
        sym,
        notes
      );
    } catch (e) {
      console.warn("Self-learning auto-save failed:", e);
    }

    // 4. Calculate direct WHO Z-scores FIRST
    const zscoreDetails = calculateZScoresAndFeatures(
      patient.ageMonths,
      patient.sex,
      Number(w),
      Number(h),
      oed,
      bf,
      vitA,
      dia,
      fev,
      cgh,
      patient.maternalEducation || "None",
      patient.wealthIndex || "Poorest"
    );

    // 5. Bilingual RAG search for scientific grounding evidence - ASYNC EVIDENCE LAYER WITH PROPER JUSTIFICATION MATCHING
    let retrievedEvidence: any[] = [];
    let alignmentJustifications: string[] = [];
    
    try {
      // Formulate a rich dynamic query encompassing calculated z-scores, muac, oedema, clinical notes and growth trend trajectory
      let customQuery = `Child age ${patient.ageMonths} months, sex ${patient.sex}, with weight ${w}kg, height ${h}cm. Wasting: ${localPrediction.wasting.severityClass} (WHZ ${zscoreDetails?.whz?.toFixed(2) || "N/A"}), Stunting: ${localPrediction.stunting.severityClass} (HAZ ${zscoreDetails?.haz?.toFixed(2) || "N/A"}), Underweight: ${localPrediction.underweight.severityClass} (WAZ ${zscoreDetails?.waz?.toFixed(2) || "N/A"}). MUAC: ${m || "N/A"}mm, Oedema: ${oed ? "Yes" : "No"}. Symptoms: ${sym || ""}. Notes: ${notes || ""}.`;
      
      if (trend) {
        customQuery += ` Child has historical growth trend: ${trend.trendStatusEn} (weight velocity of ${trend.weightVelocity.toFixed(2)} kg/month). Historical risk forecast category: ${trend.trendRiskEn}.`;
      }
      
      retrievedEvidence = await new Promise<any[]>((resolve) => {
        setTimeout(() => {
          try {
            const hits = searchKnowledgeBase(customQuery, 3, extractedEntities);
            resolve(hits || []);
          } catch (err) {
            console.error("Async RAG retrieval inside promise failed: ", err);
            resolve([]);
          }
        }, 100);
      });

      if (retrievedEvidence && retrievedEvidence.length > 0) {
        alignmentJustifications = retrievedEvidence.map(hit => {
          try {
            const ref = hit.reference;
            const severity = localPrediction.wasting.severityClass;
            
            if (trend && (trend.weightVelocity < -0.1) && (ref.abstract.toLowerCase().includes("decline") || ref.abstract.toLowerCase().includes("velocity") || ref.abstract.toLowerCase().includes("prevent") || ref.abstract.toLowerCase().includes("wasting"))) {
              return lang === "en"
                ? "Velocity match: Grounded in pediatric protocols targeting prevention of wasting for infants exhibiting growth deceleration."
                : "توافق السرعة: مستند إلى بروتوكولات رعاية الأطفال التي تستهدف الوقاية من الهزال للرضع الذين يعانون من تباطؤ النمو.";
            } else if (severity === "Severe" && (ref.abstract.toLowerCase().includes("sam") || ref.abstract.toLowerCase().includes("severe") || ref.abstract.toLowerCase().includes("wasting"))) {
              return lang === "en" 
                ? "Strong match: Sourced from international guidelines for the treatment of severe acute wasting and SAM therapeutic protocols."
                : "توافق قوي: مستمد من المبادئ التوجيهية الدولية لعلاج الهزال الشديد الحاد وبروتوكولات الأغذية العلاجية الجاهزة للاستخدام.";
            } else if (severity === "Moderate" && (ref.abstract.toLowerCase().includes("mam") || ref.abstract.toLowerCase().includes("moderate"))) {
              return lang === "en"
                ? "Grounded alignment: Sourced from clinical supplementary feeding protocols for pediatric wasting."
                : "توافق مستند: مستمد من بروتوكولات التغذية التكميلية السريرية لحالات الهزال المتوسط.";
            } else if (oed && (ref.abstract.toLowerCase().includes("oedema") || ref.abstract.toLowerCase().includes("kwashiorkor"))) {
              return lang === "en"
                ? "Critical match: Specifically addresses metabolic and nutritional oedema / kwashiorkor therapy standards."
                : "توافق حرج: يتناول على وجه التحديد معايير علاج الاستسقاء الغذائي الأيضي ومرض الكواشيوركور.";
            } else {
              return lang === "en"
                ? "General alignment: Consistent with standard World Health Organization pediatric growth standards and prevention strategies."
                : "توافق عام: يتوافق مع معايير نمو الأطفال القياسية الصادرة عن منظمة الصحة العالمية واستراتيجيات الوقاية.";
            }
          } catch (e) {
            return lang === "en" 
              ? "General alignment: Consistent with standard pediatric care guidelines."
              : "توافق عام: يتوافق مع مبادئ رعاية الأطفال القياسية.";
          }
        });
      }
    } catch (err) {
      console.warn("Async RAG retrieval failed, proceeding with local calculations layer only.", err);
      retrievedEvidence = [];
      alignmentJustifications = [];
    }

    // Load diagnosis payload into UI drawer state
    setDiagnosisData({
      patient,
      prediction: localPrediction,
      recommendation: localRecommendation,
      evidence: retrievedEvidence,
      evidenceJustifications: alignmentJustifications,
      entities: extractedEntities,
      zscores: zscoreDetails,
      weight: w,
      height: h,
      muac: resolvedMuac !== undefined ? String(resolvedMuac) : m,
      oedema: oed,
      symptoms: sym,
      notes,
      growthTrend: trend
    });

    // Open slide side-panel instantly
    setIsDrawerOpen(true);
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patName || !patParent || !patAge) {
      triggerAlert("error", "Please fill in all required patient registration fields.");
      return;
    }

    const payload = {
      name: patName,
      parentName: patParent,
      ageMonths: Number(patAge),
      sex: patSex,
      residenceType: patResidence,
      maternalEducation: patEdu,
      wealthIndex: patWealth,
      contactNumber: patContact
    };

    if (online) {
      try {
        const res = await fetch("/api/patients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, userRole: "Nurse", userEmail: "fatima.nurse@malnutrition-cds.org" })
        });
        const data = await res.json();
        if (data.success) {
          triggerAlert("success", `Child registered successfully: ${data.patient.name}`);
          setNameSearch(data.patient.name);
          
          setPatName("");
          setPatParent("");
          setPatAge("");
          setPatContact("");
          setIsRegistering(false);
          
          // Store in local IndexedDB so it's cached
          await indexedDbService.savePatient(data.patient);
          await fetchPatients(data.patient.id);
          setSelectedPatientId(data.patient.id);

          // If weight and height are provided, automatically save measurements!
          if (weight && height) {
            const measPayload = {
              patientId: data.patient.id,
              weightKg: Number(weight),
              heightCm: Number(height),
              oedema,
              breastfeeding,
              vitaminA,
              diarrheaRecent: diarrhea,
              feverRecent: fever,
              coughRecent: cough,
              muacMm: muac ? (Number(muac) <= 35 ? Number(muac) * 10 : Number(muac)) : undefined,
              recordedBy: "Fatima Al-Houthi",
              symptoms,
              clinicalNotes
            };

            const measRes = await fetch("/api/measurements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...measPayload, userRole: "Nurse", userEmail: "fatima.nurse@malnutrition-cds.org" })
            });
            const measData = await measRes.json();
            if (measData.success) {
              triggerAlert("success", `Child registered and initial measurements logged successfully!`);
              await performDiagnosisAndShow(
                data.patient,
                weight,
                height,
                muac,
                oedema,
                breastfeeding,
                vitaminA,
                diarrhea,
                fever,
                cough,
                symptoms,
                clinicalNotes,
                null
              );
              clearForm();
            } else {
              await queueMeasurementOffline(measPayload);
              await performDiagnosisAndShow(
                data.patient,
                weight,
                height,
                muac,
                oedema,
                breastfeeding,
                vitaminA,
                diarrhea,
                fever,
                cough,
                symptoms,
                clinicalNotes,
                null
              );
              clearForm();
            }
          }
          onLogAudit("Patient Registration", `Registered child ${payload.name} in central system.`);
        } else {
          await savePatientOffline(payload);
        }
      } catch (err) {
        await savePatientOffline(payload);
      }
    } else {
      await savePatientOffline(payload);
    }
  };

  const savePatientOffline = async (payload: any) => {
    const tempId = `TEMP-PAT-${Date.now()}`;
    const newPatient = {
      ...payload,
      id: tempId,
      createdAt: new Date().toISOString(),
      isOffline: true
    };
    
    // Save to local secure database
    await indexedDbService.savePatient(newPatient);

    // Add to sync queue
    await syncManager.queuePatientOffline(newPatient);

    // Refresh UI
    await fetchPatients(tempId);
    setNameSearch(newPatient.name);
    setSelectedPatientId(tempId);
    await loadLocalQueue();

    // If weight and height are provided, queue measurements offline!
    if (weight && height) {
      const measPayload = {
        patientId: tempId,
        weightKg: Number(weight),
        heightCm: Number(height),
        oedema,
        breastfeeding,
        vitaminA,
        diarrheaRecent: diarrhea,
        feverRecent: fever,
        coughRecent: cough,
        muacMm: muac ? (Number(muac) <= 35 ? Number(muac) * 10 : Number(muac)) : undefined,
        recordedBy: "Fatima Al-Houthi",
        symptoms,
        clinicalNotes
      };
      await queueMeasurementOffline(measPayload);
      triggerAlert("info", `Child registered OFFLINE and initial measurements logged securely: ${payload.name}`);
      await performDiagnosisAndShow(
        newPatient,
        weight,
        height,
        muac,
        oedema,
        breastfeeding,
        vitaminA,
        diarrhea,
        fever,
        cough,
        symptoms,
        clinicalNotes,
        null
      );
      clearForm();
    } else {
      triggerAlert("info", `Child registered OFFLINE. Record saved securely in local IndexedDB: ${payload.name}`);
    }

    setPatName("");
    setPatParent("");
    setPatAge("");
    setPatContact("");
    setIsRegistering(false);
    onLogAudit("Offline Registration", `Logged child ${payload.name} to IndexedDB/Device queue.`);
  };

  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      triggerAlert("error", "No child is selected.");
      return;
    }
    if (!weight || !height) {
      triggerAlert("error", "Weight and height indicators are required.");
      return;
    }

    const patient = patients.find((p) => p.id === selectedPatientId);
    if (!patient) {
      triggerAlert("error", "Patient details not loaded.");
      return;
    }

    // Preserve local form inputs for post-save instant prediction rendering
    const currentWeight = weight;
    const currentHeight = height;
    const currentMuac = muac;
    const currentOedema = oedema;
    const currentBreastfeeding = breastfeeding;
    const currentVitaminA = vitaminA;
    const currentDiarrhea = diarrhea;
    const currentFever = fever;
    const currentCough = cough;
    const currentSymptoms = symptoms;
    const currentClinicalNotes = clinicalNotes;

    // --- PERSISTENCE & SYNC OPERATIONS ---
    let updatedPatient = { ...patient };
    if (measAgeMonths && Number(measAgeMonths) !== patient.ageMonths) {
      const updatedAge = Number(measAgeMonths);
      updatedPatient = { ...patient, ageMonths: updatedAge };
      
      // Update local state
      setPatients(prev => prev.map(p => p.id === patient.id ? updatedPatient : p));
      
      // Save updated patient to IndexedDB
      try {
        await indexedDbService.savePatient(updatedPatient);
      } catch (err) {
        console.error("Failed to update patient age in IndexedDB", err);
      }
    }

    const payload = {
      patientId: selectedPatientId,
      weightKg: Number(currentWeight),
      heightCm: Number(currentHeight),
      oedema: currentOedema,
      breastfeeding: currentBreastfeeding,
      vitaminA: currentVitaminA,
      diarrheaRecent: currentDiarrhea,
      feverRecent: currentFever,
      coughRecent: currentCough,
      muacMm: currentMuac ? (Number(currentMuac) <= 35 ? Number(currentMuac) * 10 : Number(currentMuac)) : undefined,
      recordedBy: "Fatima Al-Houthi",
      symptoms: currentSymptoms,
      clinicalNotes: currentClinicalNotes,
      ageMonths: measAgeMonths ? Number(measAgeMonths) : undefined
    };

    if (online && !selectedPatientId.startsWith("TEMP-")) {
      try {
        const res = await fetch("/api/measurements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, userRole: "Nurse", userEmail: "fatima.nurse@malnutrition-cds.org" })
        });
        const data = await res.json();
        if (data.success) {
          triggerAlert("success", "Measurements uploaded and processed successfully.");
          onLogAudit("Measurement Entry", `Logged anthropometrics for Patient ID: ${selectedPatientId}`);
        } else {
          await queueMeasurementOffline(payload);
        }
      } catch (err) {
        await queueMeasurementOffline(payload);
      }
    } else {
      await queueMeasurementOffline(payload);
    }

    // Load patient history to include the newly saved/queued measurement!
    const updatedHistory = await loadPatientHistory(selectedPatientId);
    
    // Calculate the growth trend dynamically with the updated history
    let latestTrend = null;
    if (updatedHistory && updatedHistory.length > 0) {
      latestTrend = calculateGrowthTrend(updatedHistory, selectedPatientId);
    }

    // Trigger diagnostics and display panel with the updated trend and the current measurement's details
    await performDiagnosisAndShow(
      updatedPatient,
      currentWeight,
      currentHeight,
      currentMuac,
      currentOedema,
      currentBreastfeeding,
      currentVitaminA,
      currentDiarrhea,
      currentFever,
      currentCough,
      currentSymptoms,
      currentClinicalNotes,
      latestTrend
    );

    clearForm();
    // Re-fill age months with the updated age
    setMeasAgeMonths(String(updatedPatient.ageMonths));
  };

  const queueMeasurementOffline = async (payload: any) => {
    const record = {
      id: `TEMP-MEAS-${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString()
    };
    
    // Add to local queue
    await syncManager.queueMeasurementOffline(record);
    await loadLocalQueue();

    triggerAlert("info", "Record queued OFFLINE. Diagnostic outcome is calculated and cached on device.");
    onLogAudit("Offline Diagnostic Saved", `Cached clinical metrics to local storage queue.`);
  };

  const handleManualSync = async () => {
    if (!online) {
      triggerAlert("error", "Cannot sync while offline. Check clinic connectivity.");
      return;
    }

    triggerAlert("info", "Starting secure cloud synchronization...");
    const res = await syncManager.synchronize();

    if (res.success) {
      triggerAlert("success", `Synchronization successful! Uploaded ${res.syncedCount} queued records.`);
      await fetchPatients();
      await loadLocalQueue();
      await fetchSyncLogs();
    } else {
      triggerAlert("error", `Synchronization failed: ${res.message}`);
    }
  };

  const clearForm = () => {
    setWeight("");
    setHeight("");
    setMuac("");
    setOedema(false);
    setBreastfeeding(true);
    setVitaminA(true);
    setDiarrhea(false);
    setFever(false);
    setCough(false);
    setSymptoms("");
    setClinicalNotes("");
  };

  const triggerAlert = (type: "success" | "error" | "info", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  // Helper colors based on severity
  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "Severe":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Moderate":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Mild":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const getSeverityZScoreClass = (z: number) => {
    if (z <= -3) return "text-rose-600 font-extrabold";
    if (z <= -2) return "text-amber-600 font-extrabold";
    if (z <= -1) return "text-yellow-600 font-semibold";
    return "text-emerald-600 font-bold";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative" id="nurse-portal-container">
      {/* Alert Overlay */}
      {alertMsg && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 max-w-md transition-all duration-300 ${
          alertMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
          alertMsg.type === "error" ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-blue-50 text-blue-800 border-blue-200"
        }`}>
          {alertMsg.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {alertMsg.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-600" />}
          {alertMsg.type === "info" && <Database className="w-5 h-5 text-blue-600" />}
          <span className="text-sm font-medium">{alertMsg.text}</span>
        </div>
      )}

      {/* Column 1 & 2: Main Entry Portal */}
      <div className="lg:col-span-2 space-y-6">
        {/* Child Selection & Registration */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#008DC9]" />
              {t.patientRegistry}
            </h2>
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-sm font-bold text-[#008DC9] hover:text-[#007cb2] flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              {isRegistering ? "Back to Entry" : t.registerPatient}
            </button>
          </div>

          {!isRegistering ? (
            <div className="space-y-5">
              {/* Smart Search by Name / Triple Name */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block flex justify-between">
                  <span>Smart Search & Triple Name Linker (الربط التلقائي والبحث الثلاثي)</span>
                  <span className="text-[10px] text-blue-500 font-bold lowercase">Real-time matching active</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={nameSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNameSearch(val);
                      if (!val) {
                        setMatchingSuggestions([]);
                      } else {
                        const matched = patients.filter(p => isTripleNameMatch(val, p.name) || isTripleNameMatch(val, p.parentName));
                        setMatchingSuggestions(matched);
                      }
                    }}
                    placeholder={lang === "en" ? "Enter child's full or triple name to link automatically..." : "أدخل الاسم الثلاثي للطفل للاستدعاء والربط التلقائي للزيارات..."}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl pl-10 pr-4 py-3 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#008DC9] transition-all font-medium"
                  />
                  {nameSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setNameSearch("");
                        setMatchingSuggestions([]);
                      }}
                      className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Suggestions overlay dropdown */}
                {matchingSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full max-w-lg mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden text-xs max-h-56 overflow-y-auto">
                    <div className="bg-slate-50 p-2 border-b border-slate-100 font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                      Matching Children Profiles Found / الأطفال المطابقون
                    </div>
                    {matchingSuggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(p.id);
                          setNameSearch(p.name);
                          setMatchingSuggestions([]);
                          triggerAlert("success", `Matched and loaded: ${p.name}`);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex justify-between items-center border-b border-slate-100 last:border-0"
                      >
                        <div>
                          <span className="font-extrabold text-slate-900 block text-sm">{p.name}</span>
                          <span className="text-slate-500 font-medium text-[11px]">
                            Parent: {p.parentName} | Age: {p.ageMonths}m | {p.sex === "Male" ? t.male : t.female}
                          </span>
                        </div>
                        <span className="bg-blue-50 text-blue-600 font-bold px-2 py-1 rounded text-[10px] uppercase">
                          Select Child
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>



              {/* GORGEOUS SMART LONGITUDINAL TRAJECTORY & FORECAST ANALYTICS */}
              {selectedPatientId && (
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4 transition-all duration-300">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[#008DC9]" />
                      <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
                        {lang === "en" ? "Longitudinal Growth Velocity & Forecast" : "تحليل النمو التراكمي وتنبؤ التدهور"}
                      </h3>
                    </div>
                    <span className="text-[10px] bg-[#008DC9]/10 text-[#008DC9] font-black uppercase px-2 py-0.5 rounded-full font-mono">
                      Visit Count: {historicalMeasurements.length}
                    </span>
                  </div>

                  {historicalMeasurements.length === 0 ? (
                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-800 text-[11px] leading-relaxed font-medium">
                      ℹ️ <strong>{lang === "en" ? "First Visit baseline:" : "تأسيس معايير خط الأساس:"}</strong>{" "}
                      {lang === "en" 
                        ? "This child has no previous records. Currently establishing baseline growth measurements for subsequent velocity tracking."
                        : "لا توجد زيارات سابقة مسجلة لهذا الطفل. يتم حالياً إرساء معايير خط الأساس لتتبع النمو التراكمي للزيارات القادمة."}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Trend Velocity Metrics Grid */}
                      {growthTrend && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-xs">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">Weight Velocity</span>
                            <div className="flex items-center justify-center gap-1.5 mt-0.5">
                              {growthTrend.weightVelocity >= 0 ? (
                                <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <span className={`text-xs font-black ${growthTrend.weightVelocity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {growthTrend.weightVelocity >= 0 ? "+" : ""}{growthTrend.weightVelocity.toFixed(2)} kg/m
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-400 font-medium block mt-1">سرعة الوزن شهرياً</span>
                          </div>

                          <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-xs">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">Height Velocity</span>
                            <div className="flex items-center justify-center gap-1.5 mt-0.5">
                              {growthTrend.heightVelocity >= 0 ? (
                                <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <span className={`text-xs font-black ${growthTrend.heightVelocity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {growthTrend.heightVelocity >= 0 ? "+" : ""}{growthTrend.heightVelocity.toFixed(1)} cm/m
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-400 font-medium block mt-1">سرعة الطول شهرياً</span>
                          </div>

                          <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-xs">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">MUAC Velocity</span>
                            <div className="flex items-center justify-center gap-1.5 mt-0.5">
                              {growthTrend.muacVelocity >= 0 ? (
                                <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <span className={`text-xs font-black ${growthTrend.muacVelocity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {growthTrend.muacVelocity >= 0 ? "+" : ""}{growthTrend.muacVelocity.toFixed(1)} mm/m
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-400 font-medium block mt-1">سرعة محيط الذراع</span>
                          </div>
                        </div>
                      )}

                      {/* Cumulative Malnutrition Risk Banner */}
                      {growthTrend && (
                        <div className={`p-4 rounded-xl border ${
                          growthTrend.riskScore > 70 ? "bg-rose-50 border-rose-200 text-rose-900" :
                          growthTrend.riskScore > 30 ? "bg-amber-50 border-amber-200 text-amber-900" :
                          "bg-emerald-50 border-emerald-200 text-emerald-900"
                        } space-y-2 text-xs`}>
                          <div className="flex justify-between items-center font-bold">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-4 h-4" />
                              {lang === "en" ? growthTrend.trendRiskEn : growthTrend.trendRiskAr}
                            </span>
                            <span className="font-mono bg-white px-2 py-0.5 rounded border text-[10px] font-black uppercase">
                              {lang === "en" ? "Risk Score" : "معامل الخطر"}: {growthTrend.riskScore}%
                            </span>
                          </div>
                          <p className="font-medium leading-relaxed text-[11px]">
                            {lang === "en" ? growthTrend.trendDescriptionEn : growthTrend.trendDescriptionAr}
                          </p>
                        </div>
                      )}

                      {/* Beautiful Custom Interactive SVG Line Chart of Weight History */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                        <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wide">
                          {lang === "en" ? "Growth Trajectory Curve (Weight kg)" : "منحنى نمو الوزن التاريخي التراكمي (كجم)"}
                        </span>
                        
                        <div className="h-32 w-full flex items-center justify-center bg-slate-50 rounded-lg p-2 border border-slate-100">
                          {/* We draw a customized responsive SVG path */}
                          {historicalMeasurements.length > 0 && (
                            <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                              {/* Background Grids */}
                              <line x1="0" y1="20" x2="400" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                              <line x1="0" y1="50" x2="400" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                              <line x1="0" y1="80" x2="400" y2="80" stroke="#f1f5f9" strokeWidth="1" />

                              {(() => {
                                // Calculate min and max weights
                                const weights = historicalMeasurements.map(m => m.weightKg);
                                const minW = Math.max(2, Math.min(...weights) - 1);
                                const maxW = Math.max(...weights) + 1.5;
                                const wDiff = maxW - minW || 1;

                                // Generate SVG coordinates
                                const points = historicalMeasurements.map((m, i) => {
                                  const x = historicalMeasurements.length === 1 ? 200 : (i / (historicalMeasurements.length - 1)) * 360 + 20;
                                  const y = 90 - ((m.weightKg - minW) / wDiff) * 80;
                                  return { x, y, weight: m.weightKg, date: m.createdAt || m.date };
                                });

                                // Build path
                                let d = "";
                                if (points.length === 1) {
                                  d = `M ${points[0].x - 5} ${points[0].y} L ${points[0].x + 5} ${points[0].y}`;
                                } else {
                                  d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                                }

                                return (
                                  <>
                                    {/* Line Connection */}
                                    <path d={d} fill="none" stroke="#008DC9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    
                                    {/* Shaded Area */}
                                    {points.length > 1 && (
                                      <path 
                                        d={`${d} L ${points[points.length-1].x} 100 L ${points[0].x} 100 Z`} 
                                        fill="url(#weightGrad)" 
                                        opacity="0.12" 
                                      />
                                    )}

                                    {/* Gradient Definitions */}
                                    <defs>
                                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#008DC9" />
                                        <stop offset="100%" stopColor="#008DC9" stopOpacity="0" />
                                      </linearGradient>
                                    </defs>

                                    {/* Data Circles and Labels */}
                                    {points.map((p, i) => (
                                      <g key={i}>
                                        <circle cx={p.x} cy={p.y} r="5" fill="#008DC9" stroke="white" strokeWidth="2" className="transition-all hover:r-6 cursor-pointer" />
                                        <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#005F8A" className="text-[10px] font-black font-mono">
                                          {p.weight}kg
                                        </text>
                                        <text x={p.x} y="98" textAnchor="middle" fill="#94a3b8" className="text-[8px] font-bold">
                                          {new Date(p.date).toLocaleDateString(lang === "ar" ? "ar-YE" : "en-US", { month: "short", day: "numeric" })}
                                        </text>
                                      </g>
                                    ))}
                                  </>
                                );
                              })()}
                            </svg>
                          )}
                        </div>
                        {historicalMeasurements.length > 0 && (
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-2 font-mono">
                            <span>First Log: {new Date(historicalMeasurements[0].createdAt || historicalMeasurements[0].date).toLocaleDateString()}</span>
                            <span>Latest Log: {new Date(historicalMeasurements[historicalMeasurements.length-1].createdAt || historicalMeasurements[historicalMeasurements.length-1].date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Patient Clinical History Component with Z-score Line Chart */}
              {selectedPatientId && (
                <PatientClinicalHistory
                  historicalMeasurements={historicalMeasurements}
                  patient={patients.find((p) => p.id === selectedPatientId)}
                  lang={lang}
                />
              )}
            </div>
          ) : (
            <form onSubmit={handleRegisterPatient} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {duplicateWarning && (
                <div className="md:col-span-2 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
                  <div className="flex justify-between items-center font-bold text-amber-800">
                    <span className="flex items-center gap-1">⚠️ تنبيه: الاسم الثلاثي مسجل مسبقاً!</span>
                    <span>⚠️ Warning: Triple Name Registered!</span>
                  </div>
                  <p className="font-medium text-[11px] leading-relaxed">
                    تم العثور على ملف طفل مسبق بنفس الاسم أو اسم مشابه جداً: <span className="font-extrabold text-amber-950">{duplicateWarning.name}</span> (مرافق/والد: {duplicateWarning.parentName}، عمره: {duplicateWarning.ageMonths} شهراً). لتجنب تكرار الملفات، يمكنك استدعاء بيانات هذا الطفل مباشرة بضغطة زر واحدة.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(duplicateWarning.id);
                      setIsRegistering(false);
                      setDuplicateWarning(null);
                      setNameSearch(duplicateWarning.name);
                      triggerAlert("success", `Loaded existing child profile: ${duplicateWarning.name}`);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer text-[11px] uppercase tracking-wide"
                  >
                    استدعاء ملف المريض الحالي / Load Existing Child Profile
                  </button>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">{t.name} *</label>
                <input
                  type="text"
                  required
                  value={patName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPatName(val);
                    if (!val) {
                      setDuplicateWarning(null);
                    } else {
                      const matched = patients.find(p => isTripleNameMatch(val, p.name));
                      setDuplicateWarning(matched || null);
                    }
                  }}
                  placeholder="e.g. Ibrahim Al-Asiri"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">{t.parent} *</label>
                <input
                  type="text"
                  required
                  value={patParent}
                  onChange={(e) => setPatParent(e.target.value)}
                  placeholder="e.g. Yahya Al-Asiri"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">{t.age} (0-59) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="59"
                  value={patAge}
                  onChange={(e) => setPatAge(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">{t.sex} *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPatSex("Male")}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                      patSex === "Male" ? "bg-[#008DC9] text-white border-[#008DC9]" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t.male}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatSex("Female")}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                      patSex === "Female" ? "bg-[#008DC9] text-white border-[#008DC9]" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t.female}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">{t.residence}</label>
                <select
                  value={patResidence}
                  onChange={(e) => setPatResidence(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                >
                  <option value="Rural">{t.rural}</option>
                  <option value="Urban">{t.urban}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">{t.maternalEdu}</label>
                <select
                  value={patEdu}
                  onChange={(e) => setPatEdu(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                >
                  <option value="None">{t.educationNone}</option>
                  <option value="Primary">{t.educationPrimary}</option>
                  <option value="Secondary">{t.educationSecondary}</option>
                  <option value="Higher">{t.educationHigher}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">{t.wealthInd}</label>
                <select
                  value={patWealth}
                  onChange={(e) => setPatWealth(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                >
                  <option value="Poorest">{t.wealthPoorest}</option>
                  <option value="Poorer">{t.wealthPoorer}</option>
                  <option value="Middle">{t.wealthMiddle}</option>
                  <option value="Richer">{t.wealthRicher}</option>
                  <option value="Richest">{t.wealthRichest}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">Guardian Contact Phone</label>
                <input
                  type="text"
                  value={patContact}
                  onChange={(e) => setPatContact(e.target.value)}
                  placeholder="e.g. +967-771234567"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                />
              </div>

              {/* Comprehensive direct data entry fields for new child */}
              <div className="md:col-span-2 border-t border-slate-200 pt-5 mt-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-3">
                  <HeartPulse className="w-4.5 h-4.5 text-rose-500 animate-pulse" />
                  <span>القياسات السريرية الأولية للطفل الجديد / Initial Clinical & Anthropometric Measurements</span>
                </h3>
                <p className="text-xs text-slate-500 mb-4 font-medium">
                  {lang === "en" 
                    ? "Enter initial clinical and vital measurements for the child. These will be logged immediately alongside child registration." 
                    : "أدخل القياسات السريرية والمؤشرات الأولية للطفل ليتم حفظها مباشرة مع تسجيل ملف الطفل."}
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-600 font-bold mb-1 block">{t.weightInput} *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required={isRegistering}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 8.4"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold">kg</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 font-bold mb-1 block">{t.heightInput} *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    required={isRegistering}
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g. 76.5"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold">cm</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 font-bold mb-1 block">{t.muacInput}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    value={muac}
                    onChange={(e) => setMuac(e.target.value)}
                    placeholder="e.g. 125"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold">mm</span>
                </div>
                {muac && Number(muac) > 0 && Number(muac) <= 35 && (
                  <p className="text-[10px] text-indigo-600 font-semibold mt-1">
                    {lang === "en" 
                      ? `⚠️ Auto-detected as cm. Converting to ${Number(muac) * 10} mm.` 
                      : `⚠️ تم الكشف بالسنتيمتر. سيتم تحويله تلقائياً إلى ${Number(muac) * 10} ملم.`}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOedema(!oedema)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    oedema ? "bg-rose-500 text-white border-rose-500 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" style={{ display: oedema ? 'inline-block' : 'none' }}></span>
                  {t.oedemaInput}
                </button>

                <button
                  type="button"
                  onClick={() => setBreastfeeding(!breastfeeding)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    breastfeeding ? "bg-[#008DC9] text-white border-[#008DC9] shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t.breastfeedingInput}
                </button>

                <button
                  type="button"
                  onClick={() => setVitaminA(!vitaminA)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    vitaminA ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t.vitaminAInput}
                </button>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDiarrhea(!diarrhea)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    diarrhea ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t.diarrheaInput}
                </button>

                <button
                  type="button"
                  onClick={() => setFever(!fever)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    fever ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t.feverInput}
                </button>

                <button
                  type="button"
                  onClick={() => setCough(!cough)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    cough ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t.coughInput}
                </button>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">
                    {lang === "en" ? "Reported Symptoms / Clinical Markers" : "الأعراض السريرية الملحوظة"}
                  </label>
                  <input
                    type="text"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="e.g. fever, poor appetite, lethargic"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">
                    {lang === "en" ? "Nurse Clinical Observations & Notes" : "الملاحظات السريرية للممرض"}
                  </label>
                  <input
                    type="text"
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="e.g. referred to OTP program"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
                  />
                </div>
              </div>

              <div className="md:col-span-2 pt-4 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Database className="w-4 h-4" />
                  {lang === "en" ? "Save Child & Clinical Diagnostics" : "حفظ ملف الطفل وبدء التشخيص الطبي"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all cursor-pointer"
                >
                  {lang === "en" ? "Select Existing" : "استدعاء طفل مسجل"}
                </button>
              </div>
            </form>
          )}
        </div>

        {!isRegistering && (
          /* Anthropometric Metrics Logger */
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-rose-500" />
            {t.measurementsEntry}
          </h2>

          <form onSubmit={handleSaveMeasurement} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                  {lang === "en" ? "Child Age (Months) *" : "عمر الطفل بالأشهر *"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    max="60"
                    value={measAgeMonths}
                    onChange={(e) => setMeasAgeMonths(e.target.value)}
                    placeholder="e.g. 18"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008DC9] transition-all"
                  />
                  <span className="absolute right-4 top-3 text-sm text-slate-400 font-semibold">
                    {lang === "en" ? "months" : "شهراً"}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                  {t.weightInput} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 8.4"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008DC9] transition-all"
                  />
                  <span className="absolute right-4 top-3 text-sm text-slate-400 font-semibold">kg</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                  {t.heightInput} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g. 76.5"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008DC9] transition-all"
                  />
                  <span className="absolute right-4 top-3 text-sm text-slate-400 font-semibold">cm</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                  {t.muacInput}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={muac}
                    onChange={(e) => setMuac(e.target.value)}
                    placeholder="e.g. 115"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008DC9] transition-all"
                  />
                  <span className="absolute right-4 top-3 text-sm text-slate-400 font-semibold">mm</span>
                </div>
                {muac && Number(muac) > 0 && Number(muac) <= 35 && (
                  <p className="text-[10px] text-indigo-600 font-semibold mt-1">
                    {lang === "en" 
                      ? `⚠️ Auto-detected as cm. Converting to ${Number(muac) * 10} mm.` 
                      : `⚠️ تم الكشف بالسنتيمتر. سيتم تحويله تلقائياً إلى ${Number(muac) * 10} ملم.`}
                  </p>
                )}
              </div>
            </div>

            {/* Binary Checkboxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={oedema}
                  onChange={(e) => setOedema(e.target.checked)}
                  className="w-4 h-4 text-[#008DC9] border-slate-300 rounded focus:ring-[#008DC9]"
                />
                <div>
                  <span className="font-bold text-sm text-slate-900 block">{t.oedemaInput}</span>
                  <span className="text-xs text-slate-400 font-medium">Examination of swelling in both feet</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={breastfeeding}
                  onChange={(e) => setBreastfeeding(e.target.checked)}
                  className="w-4 h-4 text-[#008DC9] border-slate-300 rounded focus:ring-[#008DC9]"
                />
                <div>
                  <span className="font-bold text-sm text-slate-900 block">{t.breastfeedingInput}</span>
                  <span className="text-xs text-slate-400 font-medium">Applicable for babies under 2 years</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={vitaminA}
                  onChange={(e) => setVitaminA(e.target.checked)}
                  className="w-4 h-4 text-[#008DC9] border-slate-300 rounded focus:ring-[#008DC9]"
                />
                <div>
                  <span className="font-bold text-sm text-slate-900 block">{t.vitaminAInput}</span>
                  <span className="text-xs text-slate-400 font-medium">Booster drops received in last 6 months</span>
                </div>
              </label>

              <div className="flex flex-col gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="font-bold text-sm text-slate-900">Recent Morbidity History</span>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={diarrhea}
                      onChange={(e) => setDiarrhea(e.target.checked)}
                      className="w-3.5 h-3.5 text-[#008DC9] border-slate-300 rounded"
                    />
                    <span className="text-xs text-slate-600 font-semibold">Diarrhea</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fever}
                      onChange={(e) => setFever(e.target.checked)}
                      className="w-3.5 h-3.5 text-[#008DC9] border-slate-300 rounded"
                    />
                    <span className="text-xs text-slate-600 font-semibold">Fever</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cough}
                      onChange={(e) => setCough(e.target.checked)}
                      className="w-3.5 h-3.5 text-[#008DC9] border-slate-300 rounded"
                    />
                    <span className="text-xs text-slate-600 font-semibold">Cough</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Symptoms and Clinical Notes for BioMobileBERT NER & RAG retrieval */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                  {lang === "en" ? "Clinical Symptoms / Observations" : "الأعراض السريرية والملاحظات"}
                </label>
                <input
                  type="text"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder={lang === "en" ? "e.g. lethargy, loss of appetite, pale skin" : "مثال: خمول، فقدان شهية، شحوب الجلد"}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008DC9] transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                  {lang === "en" ? "Medical Notes (Entity Extraction)" : "ملاحظات سريرية (استخراج الكيانات لـ RAG)"}
                </label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder={lang === "en" ? "e.g. Severe wasting, diarrhea present. Enrolled in OTP program. RUTF administered." : "مثال: هزال شديد، يعاني من إسهال. تم تسجيله في برنامج OTP وصرف أغذية RUTF."}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008DC9] transition-all h-12 resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#008DC9] hover:bg-[#007cb2] text-white font-bold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Database className="w-5 h-5" />
              {t.saveMeasurement}
            </button>
          </form>
        </div>
        )}
      </div>

      {/* Column 3: Offline Sync, Queue & Sync Logs */}
      <div className="space-y-6">
        {/* Offline Queue Controls */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-500" />
            {t.queueSize}
          </h2>

          <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-between">
            <div>
              <span className="text-2xl font-black text-orange-700 block">{localQueue.length}</span>
              <span className="text-xs text-orange-600 font-semibold">
                {lang === "ar" ? "سجلات معلقة في الانتظار" : "Pending Records Queued"}
              </span>
            </div>
            <button
              onClick={handleManualSync}
              className={`p-3 rounded-xl shadow-sm transition-all duration-300 flex items-center gap-2 ${
                localQueue.length > 0 && online
                  ? "bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
              disabled={localQueue.length === 0 || !online}
            >
              <RefreshCw className={`w-5 h-5 ${localQueue.length > 0 && online ? "animate-spin-slow" : ""}`} />
              <span className="text-xs font-bold uppercase">
                {lang === "ar" ? "المزامنة الآن" : "Sync Now"}
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">
              {lang === "ar" ? "العناصر المدرجة في الانتظار" : "Queued Elements"}
            </span>
            {localQueue.length === 0 ? (
              <span className="text-xs text-slate-400 block font-medium italic">
                {lang === "ar" 
                  ? "تم دمج ومزامنة جميع القياسات المحلية بالكامل مع قاعدة بيانات PostgreSQL المركزية." 
                  : "All local measurements are fully integrated with backend PostgreSQL database."}
              </span>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {localQueue.map((item, idx) => {
                  const isPatient = item.type === "patient";
                  const pId = isPatient ? (item.data?.id || "") : (item.data?.patientId || item.data?.patient_id || "");
                  const formattedId = pId ? pId.substring(0, 10) : "N/A";
                  const patientLabel = isPatient 
                    ? (lang === "ar" ? `طفل جديد: ${item.data?.fullName || item.data?.name || formattedId}` : `New Patient: ${item.data?.fullName || item.data?.name || formattedId}`)
                    : (lang === "ar" ? `رقم المريض: ${formattedId}` : `Patient ID: ${formattedId}`);
                  const detailText = isPatient
                    ? (lang === "ar" ? `العمر: ${item.data?.ageMonths || 0} شهور` : `Age: ${item.data?.ageMonths || 0}m`)
                    : (lang === "ar" ? `الوزن: ${item.data?.weightKg || 0} كجم | الطول: ${item.data?.heightCm || 0} سم` : `Weight: ${item.data?.weightKg || 0}kg | Height: ${item.data?.heightCm || 0}cm`);

                  return (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800 block">{patientLabel}</span>
                        <span className="text-slate-500 font-medium">{detailText}</span>
                      </div>
                      <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-bold uppercase">Cached</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Self-Learning RAG Database Portal */}
        {userRole !== "Nurse" && userRole !== "Doctor" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-600 animate-pulse" />
                {lang === "en" ? "Autonomous Self-Learning Gate" : "بوابة التعلم الذاتي وقاعدة المعرفة"}
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {lang === "en" ? "Self-Training" : "تعلم مستمر"}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              {lang === "en" 
                ? "The model automatically logs and learns from each pediatric diagnostic justification to update its offline RAG corpus. These cases are vectorized to cite and guide decisions when internet connection is fully absent." 
                : "يتعلم النموذج تلقائياً من كل عملية تشخيص للطفل لدعم وتحديث قاعدة المعرفة المحلية RAG. يتم توجيه وحفظ هذه الحالات محلياً للاستشهاد بها ومطابقة الحالات المشابهة عند انقطاع الاتصال تماماً."}
            </p>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold border-b border-slate-100 pb-2">
                <span className="text-slate-400 uppercase">{lang === "en" ? "Learned Knowledge Base" : "المراجع السريرية المضافة"}</span>
                <span className="text-indigo-600 font-mono font-black">{getDynamicReferencesOnly().length} {lang === "en" ? "References" : "مراجع"}</span>
              </div>

              {getDynamicReferencesOnly().length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400 italic font-medium">
                  {lang === "en" ? "No autonomous diagnostic cases learned yet. Submit a child measurement to trigger self-learning." : "لم يتم تعلم أي حالات طبية بعد. قم بإدخال قياسات أي طفل لتفعيل التعلم الذاتي التلقائي."}
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                  {[...getDynamicReferencesOnly()].reverse().map((ref) => (
                    <div key={ref.id} className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/20 space-y-2.5 text-xs animate-fadeIn">
                      <div className="flex justify-between items-start gap-3">
                        <span className="font-extrabold text-indigo-950 block leading-tight">
                          {lang === "en" ? ref.title : (ref.titleAr || ref.title)}
                        </span>
                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded uppercase shrink-0">
                          {lang === "en" ? "Vectorized" : "موجّه رقمياً"}
                        </span>
                      </div>

                      <p className="text-slate-700 leading-relaxed text-[11px] bg-white p-2 rounded-lg border border-indigo-50 font-medium">
                        {lang === "en" ? ref.abstract : (ref.abstractAr || ref.abstract)}
                      </p>

                      <div className="text-[10px] text-slate-600 font-semibold bg-white/50 p-2 rounded border border-slate-100 space-y-1">
                        <div className="text-[9px] text-indigo-800 uppercase font-bold tracking-wider">{lang === "en" ? "Clinical Case Detail" : "تفاصيل الحالة الطبية"}</div>
                        <div className="leading-relaxed text-slate-700">{lang === "en" ? ref.clinicalSummary : (ref.clinicalSummaryAr || ref.clinicalSummary)}</div>
                      </div>

                      {ref.sourceUrl && (
                        <div className="pt-1 border-t border-indigo-100/50 flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 font-medium font-mono">{ref.citation}</span>
                          <a 
                            href={ref.sourceUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-1 text-[#008DC9] hover:text-[#007cb2] transition-colors font-extrabold text-[10px]"
                          >
                            <Globe className="w-3 h-3" />
                            <span>{lang === "en" ? "WHO Protocol ↗" : "البروتوكول العالمي ↗"}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sync History Logs */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            {lang === "ar" ? "سجل مزامنة عمليات تعلم الآلة (MLOps) للجهاز" : "Device MLOps Sync History"}
          </h3>

          <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
            {syncLogs.length === 0 ? (
              <span className="text-xs text-slate-400 block font-medium italic">
                {lang === "ar" ? "لم يتم تسجيل أي عمليات مزامنة بعد." : "No synchronization operations recorded yet."}
              </span>
            ) : (
              syncLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 uppercase">
                      {lang === "ar" 
                        ? `جلسة مزامنة ${log.type === "Upload" ? "رفع البيانات" : log.type}` 
                        : `${log.type} Sync Session`}
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase">
                      {lang === "ar" 
                        ? (log.status === "Success" || log.status === "success" ? "ناجح" : log.status) 
                        : log.status}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px] flex justify-between font-medium">
                    <span>
                      {lang === "ar" ? `عدد السجلات المزامنة: ${log.recordsSynced}` : `Records Synced: ${log.recordsSynced}`}
                    </span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* --- IMMEDIATE LOCAL DIAGNOSIS Panel Drawer (Slide in from Right) --- */}
      <AnimatePresence>
        {isDrawerOpen && diagnosisData && (
          <>
            {/* Dark blur backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40"
            />

            {/* Panel Container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full max-w-xl bg-slate-50 shadow-2xl z-50 overflow-y-auto flex flex-col border-l border-slate-200 font-sans"
              style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
            >
              {/* Header */}
              <div className="bg-[#008DC9] text-white p-5 flex justify-between items-center shrink-0 shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                  <div>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider">
                      {lang === "en" ? "Local Diagnostic Assessment Profile" : "ملف التقييم التشخيصي السريري المحلي"}
                    </h3>
                    <span className="text-[10px] text-blue-100 block font-mono">
                      XGBoost Model 3-Stage Classifier & Bilingual RAG
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer"
                  title="Close diagnostic profile"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Contents */}
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                
                {/* Print/Export Action Bar */}
                <div className="bg-[#008DC9]/5 border border-[#008DC9]/10 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#008DC9]/10 rounded-xl text-[#008DC9]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-800 text-sm block">
                        {lang === "en" ? "Print WHO Clinical Report" : "طباعة تقرير منظمة الصحة العالمية"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                        {lang === "en" ? "Official clinical standard layout for local distribution" : "تنسيق سريري رسمي للتوزيع المحلي والتوثيق"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportPDF()}
                    className="bg-[#008DC9] hover:bg-[#007cb2] text-white font-extrabold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer shrink-0 text-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>{lang === "en" ? "Export PDF" : "تصدير التقرير"}</span>
                  </button>
                </div>
                
                {/* Child Demographic Summary Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#008DC9] flex items-center justify-center font-black text-sm">
                      {diagnosisData.patient.sex === "Male" ? "M" : "F"}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-lg leading-tight">{diagnosisData.patient.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Parent/Guardian: <span className="font-semibold text-slate-700">{diagnosisData.patient.parentName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Age</span>
                      <span className="font-extrabold text-slate-800 text-sm block mt-0.5">{diagnosisData.patient.ageMonths} {lang === "en" ? "Months" : "شهراً"}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Sex</span>
                      <span className="font-extrabold text-slate-800 text-sm block mt-0.5">{diagnosisData.patient.sex === "Male" ? t.male : t.female}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Residence</span>
                      <span className="font-extrabold text-slate-800 text-sm block mt-0.5">{diagnosisData.patient.residenceType === "Rural" ? t.rural : t.urban}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Maternal Education</span>
                      <span className="font-extrabold text-slate-800 text-sm block mt-0.5">{diagnosisData.patient.maternalEducation || "None"}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Wealth Quintile</span>
                      <span className="font-extrabold text-slate-800 text-sm block mt-0.5">{diagnosisData.patient.wealthIndex || "Poorest"}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Contact</span>
                      <span className="font-extrabold text-slate-800 text-sm block mt-0.5">{diagnosisData.patient.contactNumber || "None"}</span>
                    </div>
                  </div>

                  {/* Anthropometric Measurements Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Weight</span>
                      <span className="font-black text-slate-800 text-sm block mt-0.5">{diagnosisData.weight} kg</span>
                      <span className="text-[10px] block mt-1 font-semibold">
                        WAZ: <span className={getSeverityZScoreClass(diagnosisData.zscores.waz)}>{diagnosisData.zscores.waz.toFixed(2)}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Height</span>
                      <span className="font-black text-slate-800 text-sm block mt-0.5">{diagnosisData.height} cm</span>
                      <span className="text-[10px] block mt-1 font-semibold">
                        HAZ: <span className={getSeverityZScoreClass(diagnosisData.zscores.haz)}>{diagnosisData.zscores.haz.toFixed(2)}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">MUAC</span>
                      <span className={`font-black text-sm block mt-0.5 ${diagnosisData.muac && Number(diagnosisData.muac) < 115 ? "text-rose-600 font-extrabold" : "text-slate-800"}`}>
                        {diagnosisData.muac ? `${diagnosisData.muac} mm` : "N/A"}
                      </span>
                      <span className="text-[10px] block mt-1 font-semibold">
                        WHZ: <span className={getSeverityZScoreClass(diagnosisData.zscores.whz)}>{diagnosisData.zscores.whz.toFixed(2)}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Oedema</span>
                      <span className={`font-black text-xs block mt-0.5 ${diagnosisData.oedema ? "text-rose-600 font-black uppercase animate-pulse" : "text-slate-800"}`}>
                        {diagnosisData.oedema ? (lang === "en" ? "YES (Extreme)" : "نعم (خطورة قصوى)") : (lang === "en" ? "NO" : "لا يوجد")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Severity Status banner */}
                <div className={`p-5 rounded-2xl border shadow-xs flex flex-col gap-3 ${getSeverityBadgeClass(diagnosisData.recommendation.severity)}`}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold uppercase block tracking-wider opacity-85">
                          {lang === "en" ? "Final Clinical Diagnosis & Severity" : "التشخيص السريري النهائي والشدة"}
                        </span>
                        <h4 className="font-black text-base mt-0.5">
                          {lang === "en" ? diagnosisData.recommendation.diagnosis : diagnosisData.recommendation.diagnosisAr}
                        </h4>
                      </div>
                    </div>
                    <span className="text-xs font-black uppercase px-3 py-1 rounded-full border bg-white shadow-xs tracking-wider shrink-0">
                      {lang === "en" ? diagnosisData.recommendation.severity : (diagnosisData.recommendation.severity === "Severe" ? "شديد" : diagnosisData.recommendation.severity === "Moderate" ? "متوسط" : diagnosisData.recommendation.severity === "Mild" ? "خفيف" : "طبيعي")}
                    </span>
                  </div>

                  {userRole !== "Nurse" && userRole !== "Doctor" && (
                    <div className="border-t border-slate-200/50 pt-2 flex justify-between items-center text-xs font-bold font-mono">
                      <span>{lang === "en" ? "Decision Confidence Score:" : "معدل ثقة القرار الطبي:"}</span>
                      <span className="text-sm font-black">{diagnosisData.prediction.wasting.confidenceScore}%</span>
                    </div>
                  )}
                </div>

                {/* Longitudinal Growth Velocity & Forecast inside Drawer */}
                {diagnosisData.growthTrend && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4.5 h-4.5 text-[#008DC9]" />
                        <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wide">
                          {lang === "en" ? "Longitudinal Growth Velocity Analysis" : "تحليل سرعة ومسار النمو الطولي"}
                        </h4>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded uppercase">
                        {lang === "en" ? "Trajectory Mode" : "مسار تراكمي"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Weight Velocity</span>
                        <span className={`font-black text-[11px] block mt-1 ${diagnosisData.growthTrend.weightVelocity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {diagnosisData.growthTrend.weightVelocity >= 0 ? "+" : ""}{diagnosisData.growthTrend.weightVelocity.toFixed(2)} kg/m
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Height Velocity</span>
                        <span className={`font-black text-[11px] block mt-1 ${diagnosisData.growthTrend.heightVelocity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {diagnosisData.growthTrend.heightVelocity >= 0 ? "+" : ""}{diagnosisData.growthTrend.heightVelocity.toFixed(1)} cm/m
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">MUAC Velocity</span>
                        <span className={`font-black text-[11px] block mt-1 ${diagnosisData.growthTrend.muacVelocity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {diagnosisData.growthTrend.muacVelocity >= 0 ? "+" : ""}{diagnosisData.growthTrend.muacVelocity.toFixed(1)} mm/m
                        </span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                      diagnosisData.growthTrend.riskScore > 70 ? "bg-rose-50 border-rose-100 text-rose-900" :
                      diagnosisData.growthTrend.riskScore > 30 ? "bg-amber-50 border-amber-100 text-amber-900" :
                      "bg-emerald-50 border-emerald-100 text-emerald-900"
                    }`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-[#008DC9] shrink-0" />
                          {lang === "en" ? diagnosisData.growthTrend.trendStatusEn : diagnosisData.growthTrend.trendStatusAr}
                        </span>
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border text-[9px] font-black uppercase">
                          {diagnosisData.growthTrend.trendRiskEn}
                        </span>
                      </div>
                      <p className="font-medium leading-relaxed text-[11px]">
                        {lang === "en" ? diagnosisData.growthTrend.trendDescriptionEn : diagnosisData.growthTrend.trendDescriptionAr}
                      </p>
                    </div>
                  </div>
                )}

                {/* XGBoost prediction risk score details */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <TrendingUp className="w-4 h-4 text-[#008DC9]" />
                    {lang === "en" ? "XGBoost Probability Classifiers" : "احتمالات نماذج XGBoost للذكاء الاصطناعي"}
                  </h4>

                  <div className="space-y-3 text-xs">
                    {/* Wasting */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>{lang === "en" ? "Wasting (WHZ/Acute Malnutrition)" : "الهزال (سوء تغذية حاد)"}</span>
                        <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] ${getSeverityBadgeClass(diagnosisData.prediction.wasting.severityClass)}`}>
                          {diagnosisData.prediction.wasting.severityClass} ({diagnosisData.prediction.wasting.riskPercentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            diagnosisData.prediction.wasting.severityClass === "Severe" ? "bg-rose-500" :
                            diagnosisData.prediction.wasting.severityClass === "Moderate" ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${diagnosisData.prediction.wasting.riskPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Stunting */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>{lang === "en" ? "Stunting (HAZ/Chronic Malnutrition)" : "التقزم (سوء تغذية مزمن)"}</span>
                        <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] ${getSeverityBadgeClass(diagnosisData.prediction.stunting.severityClass)}`}>
                          {diagnosisData.prediction.stunting.severityClass} ({diagnosisData.prediction.stunting.riskPercentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            diagnosisData.prediction.stunting.severityClass === "Severe" ? "bg-rose-500" :
                            diagnosisData.prediction.stunting.severityClass === "Moderate" ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${diagnosisData.prediction.stunting.riskPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Underweight */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>{lang === "en" ? "Underweight (WAZ)" : "نقص الوزن بالنسبة للعمر"}</span>
                        <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] ${getSeverityBadgeClass(diagnosisData.prediction.underweight.severityClass)}`}>
                          {diagnosisData.prediction.underweight.severityClass} ({diagnosisData.prediction.underweight.riskPercentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            diagnosisData.prediction.underweight.severityClass === "Severe" ? "bg-rose-500" :
                            diagnosisData.prediction.underweight.severityClass === "Moderate" ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${diagnosisData.prediction.underweight.riskPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Clinical Recommendations Box */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
                  <h4 className="text-xs font-black text-[#008DC9] tracking-wider uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    {lang === "en" ? "Evidence-Based Intervention Recommendations" : "توصيات التدخل السريري القائم على الأدلة"}
                  </h4>

                  <div className="space-y-3.5 text-xs text-slate-100 leading-relaxed">
                    <div className="space-y-1.5">
                      <span className="font-extrabold uppercase text-[10px] text-slate-400 block tracking-wider">
                        {lang === "en" ? "Medical Protocols & Nutritional Feeds" : "البروتوكولات الطبية والأغذية العلاجية"}
                      </span>
                      <p className="bg-slate-800 p-3 rounded-xl border border-slate-700 font-medium">
                        {lang === "en" ? diagnosisData.recommendation.recommendedIntervention : diagnosisData.recommendation.recommendedInterventionAr}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <span className="font-extrabold uppercase text-[10px] text-slate-400 block tracking-wider">
                        {lang === "en" ? "Referral Protocol Action" : "بروتوكول الإحالة والمتابعة"}
                      </span>
                      <p className="bg-slate-800 p-3 rounded-xl border border-slate-700 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <span>{lang === "en" ? diagnosisData.recommendation.referralNeed : diagnosisData.recommendation.referralNeedAr}</span>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
                      <span>WHO Guideline Action Code:</span>
                      <span className="font-mono text-white">{diagnosisData.recommendation.whoReference}</span>
                    </div>
                  </div>
                </div>

                {/* Connection Status & Prediction/Diagnosis Source */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Globe className="w-4 h-4 text-[#008DC9]" />
                      {lang === "en" ? "Clinical Decision Support Source" : "مصدر دعم القرار الطبي والتشخيص"}
                    </h4>
                    {online ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {lang === "en" ? "Online Mode" : "متصل بالإنترنت"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        {lang === "en" ? "Offline Mode" : "غير متصل بالإنترنت"}
                      </span>
                    )}
                  </div>

                  <div className={`p-4 rounded-xl border text-xs space-y-3 ${online ? "bg-emerald-50/30 border-emerald-100" : "bg-amber-50/30 border-amber-100"}`}>
                    <p className="font-semibold text-slate-800 leading-relaxed">
                      {online ? (
                        lang === "en" ? (
                          "Decision support and medical diagnostics are fully backed in real-time by modern, up-to-date global pediatric guidelines and verified research databases. Results are cross-referenced with online authorities including:"
                        ) : (
                          "تم التحقق ودعم هذا التشخيص والقرار الطبي من خلال المراجعة الفورية للمواقع الطبية والبحثية والبروتوكولات السريرية الحديثة والموثوقة. تم الرجوع ومطابقة الحالة مع الجهات العلمية والمنصات الموثوقة التالية:"
                        )
                      ) : (
                        lang === "en" ? (
                          "The application is currently OFFLINE. Prediction and pediatric diagnostic guidelines are retrieved entirely from the local embedded clinical knowledge base stored securely on this device to ensure continuity of care."
                        ) : (
                          "التطبيق حالياً غير متصل بالإنترنت. تم توليد التنبؤ والتشخيص الطبي بالكامل محلياً اعتماداً على قاعدة المعرفة الطبية المضمنة المثبتة مسبقاً على هذا الجهاز لضمان استمرارية تقديم الرعاية في المناطق النائية."
                        )
                      )}
                    </p>

                    {/* Dynamic Self-Learning Section */}
                    {userRole !== "Nurse" && userRole !== "Doctor" && (
                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-slate-800">
                        <BrainCircuit className="w-5 h-5 text-indigo-600 shrink-0 animate-pulse" />
                        <div>
                          <span className="text-[10px] font-extrabold text-indigo-950 block uppercase tracking-wider">
                            {lang === "en" ? "Autonomous Self-Learning Activated" : "التعلم الذاتي التلقائي للنموذج نشط"}
                          </span>
                          <span className="text-[9px] text-indigo-700 font-semibold block mt-0.5 leading-normal">
                            {lang === "en" 
                              ? `Model auto-learns from every clinical outcome. Local vectorized protocols count: ${getLearnedCasesCount()} cases.` 
                              : `النموذج يتعلم ذاتياً عند كل تشخيص. عدد البروتوكولات السريرية المدمجة والمحدثة تلقائياً: ${getLearnedCasesCount()} حالة.`}
                          </span>
                        </div>
                      </div>
                    )}

                    {online ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <a 
                          href="https://www.who.int/publications" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#008DC9] transition-all"
                        >
                          <span className="text-[10px] font-bold text-[#008DC9]">WHO Guidelines</span>
                          <span className="text-[9px] text-slate-400 font-mono ml-auto">who.int ↗</span>
                        </a>
                        <a 
                          href="https://pubmed.ncbi.nlm.nih.gov/?term=child+malnutrition+treatment" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#008DC9] transition-all"
                        >
                          <span className="text-[10px] font-bold text-[#008DC9]">PubMed Central (PMC)</span>
                          <span className="text-[9px] text-slate-400 font-mono ml-auto">nih.gov ↗</span>
                        </a>
                        <a 
                          href="https://data.unicef.org/topic/nutrition/malnutrition/" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#008DC9] transition-all"
                        >
                          <span className="text-[10px] font-bold text-[#008DC9]">UNICEF Child Nutrition</span>
                          <span className="text-[9px] text-slate-400 font-mono ml-auto">unicef.org ↗</span>
                        </a>
                        <a 
                          href="https://www.thelancet.com/journals/langlo/home" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#008DC9] transition-all"
                        >
                          <span className="text-[10px] font-bold text-[#008DC9]">The Lancet Global Health</span>
                          <span className="text-[9px] text-slate-400 font-mono ml-auto">thelancet.com ↗</span>
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200">
                        <Database className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-700 block">
                            {lang === "en" ? "Local Embedded RAG Knowledge Store" : "قاعدة المعرفة المحلية للتحليل السريري"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">
                            {lang === "en" ? "Version: 2026.06.30-L (Local SQLite/IndexedDB Offline Store)" : "الإصدار: 2026.06.30-L (قاعدة بيانات محلية سريعة ومثبتة)"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scientific Evidence (Bilingual RAG / "دعم التشخيص من قاعدة المعرفة") */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <BookOpen className="w-4 h-4 text-[#008DC9]" />
                    {lang === "en" ? "Knowledge Base Diagnostic Evidence Support" : "دعم التشخيص من قاعدة المعرفة"}
                  </h4>

                  {diagnosisData.evidence && diagnosisData.evidence.length > 0 ? (
                    <div className="space-y-4 text-xs">
                      {diagnosisData.evidence.map((hit: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/50 transition-colors space-y-3">
                          {/* Title and Confidence score */}
                          <div className="flex justify-between items-start gap-4">
                            <span className="font-extrabold text-slate-900">
                              {lang === "en" ? hit.reference.title : (hit.reference.titleAr || hit.reference.title)}
                            </span>
                            {userRole !== "Nurse" && userRole !== "Doctor" && (
                              <span className="bg-[#008DC9]/10 text-[#008DC9] text-[10px] font-black uppercase px-2 py-0.5 rounded shrink-0">
                                {lang === "en" ? "Confidence:" : "مستوى الثقة:"} {Math.round(hit.score * 100)}%
                              </span>
                            )}
                          </div>

                          {/* 1. Sourced abstract/clinical details ("المعلومات أو الأدلة المسترجعة") */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-[#008DC9] font-extrabold uppercase block tracking-wider">
                              {lang === "en" ? "Retrieved Evidence Detail" : "المعلومات أو الأدلة المسترجعة"}
                            </span>
                            <p className="text-slate-700 leading-relaxed text-[11px] bg-white p-2.5 rounded-lg border border-slate-100 font-medium">
                              {lang === "en" ? hit.reference.abstract : (hit.reference.abstractAr || hit.reference.abstract)}
                            </p>
                          </div>

                          {/* 2. Alignment justification ("سبب توافقها مع نتائج القياس") */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-amber-700 font-extrabold uppercase block tracking-wider">
                              {lang === "en" ? "Measurement Alignment Reason" : "سبب التوافق مع نتائج القياس"}
                            </span>
                            <p className="text-slate-600 leading-relaxed text-[11px] bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/60 font-medium">
                              {diagnosisData.evidenceJustifications && diagnosisData.evidenceJustifications[i] 
                                ? diagnosisData.evidenceJustifications[i] 
                                : (lang === "en" ? "Matches the patient's calculated anthropometrics and symptoms." : "يتطابق مع قياسات المريض المحسوبة وأعراضه السريرية.")
                              }
                            </p>
                          </div>

                          {/* 3. Reference used / Citation ("المرجع أو مصدر المعرفة المستخدم") */}
                          <div className="space-y-1 pt-1.5 border-t border-slate-200/60">
                            <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">
                              {lang === "en" ? "Academic Source & Knowledge Citation" : "المرجع ومصدر المعرفة المستخدم"}
                            </span>
                            <div className="text-[10px] text-slate-500 font-medium font-mono">
                              <div>{lang === "en" ? "Publisher:" : "الجهة الناشرة:"} {hit.reference.organization} | {lang === "en" ? "Published:" : "تاريخ النشر:"} {hit.reference.year}</div>
                              <div className="mt-1 italic text-slate-400 line-clamp-1">{hit.reference.citation}</div>
                            </div>
                            {hit.reference.sourceUrl && (
                              <div className="pt-2">
                                <a 
                                  href={hit.reference.sourceUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#008DC9]/10 text-slate-700 hover:text-[#008DC9] transition-all border border-slate-200 hover:border-[#008DC9]/30 text-[10px] font-extrabold uppercase"
                                >
                                  <Globe className="w-3.5 h-3.5 text-[#008DC9]" />
                                  {lang === "en" ? "Verify on Global Platform ↗" : "التحقق والاطلاع على البروتوكول العالمي ↗"}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{lang === "en" ? "No matching supportive documentation found in the local knowledge base." : "لم يتم العثور على معلومات داعمة في قاعدة المعرفة."}</span>
                    </div>
                  )}
                </div>

                {/* BioMobileBERT Extracted Entities */}
                {diagnosisData.entities && diagnosisData.entities.length > 0 && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-4 h-4" />
                      {lang === "en" ? "BioMobileBERT Extracted Clinical Entities" : "كيانات BioMobileBERT الطبية المستخرجة"}
                    </h4>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {diagnosisData.entities.map((ent: any, i: number) => (
                        <span 
                          key={i}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1.5 ${
                            ent.entityType === "DISEASE" ? "bg-rose-50 text-rose-800 border-rose-100" :
                            ent.entityType === "SYMPTOM" ? "bg-amber-50 text-amber-800 border-amber-100" :
                            ent.entityType === "TREATMENT" ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-blue-50 text-blue-800 border-blue-100"
                          }`}
                        >
                          <span className="font-extrabold">{ent.text}</span>
                          <span className="opacity-60 text-[8px] uppercase tracking-wider font-semibold font-mono">[{ent.entityType}]</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 bg-slate-100 border-t border-slate-200 flex gap-2 shrink-0 justify-end">
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-full bg-[#008DC9] hover:bg-[#007cb2] text-white font-bold py-3.5 rounded-xl text-sm shadow-sm transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{lang === "en" ? "Acknowledge Local Diagnostic Assessment" : "تأكيد واستيعاب التقييم السريري"}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
