import React, { useState } from "react";
import { calculateZScoresAndFeatures } from "../utils/growth";
import { 
  TrendingUp, 
  Activity, 
  Calendar
} from "lucide-react";

interface PatientClinicalHistoryProps {
  historicalMeasurements: any[];
  patient: any;
  lang: "en" | "ar";
}

export const PatientClinicalHistory: React.FC<PatientClinicalHistoryProps> = ({
  historicalMeasurements,
  patient,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<"zscores" | "anthropometrics">("zscores");
  const [selectedVisitIdx, setSelectedVisitIdx] = useState<number | null>(null);

  if (!patient) return null;

  const t = {
    en: {
      title: "Patient Longitudinal Clinical History",
      subtitle: "Multi-visit WHO Z-score tracking & physiological progression",
      emptyStateTitle: "First Visit Baseline",
      emptyStateDesc: "No previous records found. Currently establishing baseline growth measurements for velocity tracking.",
      zscoresTab: "WHO Z-Scores",
      anthroTab: "MUAC & Weight/Height",
      waz: "Weight-for-Age (WAZ)",
      haz: "Height-for-Age (HAZ)",
      whz: "Weight-for-Height (WHZ)",
      muac: "MUAC (Arm Circumference)",
      weight: "Weight Progression",
      height: "Height Progression",
      visitCount: "Visit Count",
      date: "Date",
      age: "Age",
      zScoreValue: "Z-Score",
      normalRange: "Normal Range (>-2 SD)",
      moderateRange: "Moderate Malnutrition (-2 to -3 SD)",
      severeRange: "Severe Malnutrition (≤-3 SD)",
      symptoms: "Symptoms",
      notes: "Clinical Notes",
      none: "None",
      muacVal: "MUAC",
      weightVal: "Weight",
      heightVal: "Height",
      viewDetails: "Hover/Click points or select below to inspect visit clinical logs",
      recentOedema: "Bilateral Pitting Oedema Detected",
      yes: "Yes",
      no: "No",
    },
    ar: {
      title: "السجل السريري التراكمي للطفل",
      subtitle: "تتبع مؤشرات النمو (Z-scores) ومؤشر كتلة الجسم عبر الزيارات",
      emptyStateTitle: "تأسيس معايير خط الأساس",
      emptyStateDesc: "لا توجد زيارات سابقة مسجلة لهذا الطفل. يتم حالياً إرساء معايير خط الأساس لتتبع النمو التراكمي للزيارات القادمة.",
      zscoresTab: "مؤشرات منظمة الصحة العالمية",
      anthroTab: "محيط الذراع والوزن/الطول",
      waz: "الوزن بالنسبة للعمر (WAZ)",
      haz: "الطول بالنسبة للعمر (HAZ)",
      whz: "الوزن بالنسبة للارتفاع (WHZ)",
      muac: "محيط منتصف الذراع (MUAC)",
      weight: "تطور الوزن",
      height: "تطور الطول",
      visitCount: "عدد الزيارات",
      date: "التاريخ",
      age: "العمر",
      zScoreValue: "مؤشر الانحراف",
      normalRange: "النطاق الطبيعي (أكبر من -2 SD)",
      moderateRange: "سوء تغذية متوسط (-2 إلى -3 SD)",
      severeRange: "سوء تغذية حاد (أقل من -3 SD)",
      symptoms: "الأعراض",
      notes: "الملاحظات السريرية",
      none: "لا يوجد",
      muacVal: "محيط الذراع",
      weightVal: "الوزن",
      heightVal: "الطول",
      viewDetails: "اضغط على النقاط في المنحنى أو اختر زيارة لعرض الملاحظات السريرية",
      recentOedema: "وذمة تورمية في القدمين",
      yes: "نعم",
      no: "لا",
    }
  }[lang];

  // Map historical measurements with precise computed Z-scores
  const visitPoints = [...historicalMeasurements]
    .sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime())
    .map((m, idx) => {
      let ageAtMeasMonths = patient.ageMonths || 12;
      if (patient.dateOfBirth) {
        const birthDate = new Date(patient.dateOfBirth);
        const measDate = new Date(m.createdAt || m.date);
        if (!isNaN(birthDate.getTime()) && !isNaN(measDate.getTime())) {
          const diffTime = measDate.getTime() - birthDate.getTime();
          ageAtMeasMonths = Math.max(0.1, diffTime / (1000 * 3600 * 24 * 30.4));
        }
      }

      // Compute precise Z-scores dynamically
      const scores = calculateZScoresAndFeatures(
        ageAtMeasMonths,
        patient.sex || "Male",
        m.weightKg,
        m.heightCm,
        !!m.oedema,
        m.breastfeeding ?? true,
        m.vitaminA ?? true,
        !!m.diarrheaRecent,
        !!m.feverRecent,
        !!m.coughRecent,
        patient.maternalEducation || "None",
        patient.wealthIndex || "Middle"
      );

      return {
        id: m.id,
        raw: m,
        idx,
        date: m.createdAt || m.date,
        ageMonths: parseFloat(ageAtMeasMonths.toFixed(1)),
        waz: scores.waz,
        haz: scores.haz,
        whz: scores.whz,
        weight: m.weightKg,
        height: m.heightCm,
        muac: m.muacMm || 0,
        oedema: !!m.oedema,
        symptoms: m.symptoms || "",
        notes: m.notes || m.clinicalNotes || "",
      };
    });

  if (visitPoints.length === 0) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#008DC9]" />
          <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
            {t.title}
          </h3>
        </div>
        <div className="p-5 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-800 text-[11px] leading-relaxed font-medium">
          ℹ️ <strong>{t.emptyStateTitle}:</strong> {t.emptyStateDesc}
        </div>
      </div>
    );
  }

  // Active visit calculation
  const activeVisit = selectedVisitIdx !== null ? visitPoints[selectedVisitIdx] : visitPoints[visitPoints.length - 1];

  // SVG dimensions for Z-scores chart
  const width = 500;
  const height = 200;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Z-score mapping functions
  // Min Z: -5, Max Z: +2.5
  const minZ = -5;
  const maxZ = 2.5;
  const zRange = maxZ - minZ;

  const getX = (index: number) => {
    if (visitPoints.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (visitPoints.length - 1)) * chartWidth;
  };

  const getY = (z: number) => {
    const clampedZ = Math.max(minZ, Math.min(maxZ, z));
    const ratio = (clampedZ - minZ) / zRange;
    return paddingTop + chartHeight * (1 - ratio);
  };

  // Build connection line paths for WAZ, HAZ, WHZ
  const buildPath = (key: "waz" | "haz" | "whz") => {
    if (visitPoints.length === 0) return "";
    return visitPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p[key])}`).join(" ");
  };

  // Map Direct Anthropometrics
  // Scale weightKg dynamically
  const weights = visitPoints.map(p => p.weight);
  const muacs = visitPoints.map(p => p.muac);

  const minWeight = Math.max(1, Math.min(...weights) - 1);
  const maxWeight = Math.max(...weights) + 1;
  const weightRange = maxWeight - minWeight || 1;

  const getWeightY = (w: number) => {
    const ratio = (w - minWeight) / weightRange;
    return paddingTop + chartHeight * (1 - ratio);
  };

  // Scale MUAC (typically 90 to 160 mm)
  const minMuac = Math.max(50, Math.min(...muacs.filter(m => m > 0)) - 10);
  const maxMuac = Math.max(...muacs) + 10;
  const muacRange = maxMuac - minMuac || 1;

  const getMuacY = (m: number) => {
    const ratio = (m - minMuac) / muacRange;
    return paddingTop + chartHeight * (1 - ratio);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5" id="patient-clinical-history-component">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-base tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#008DC9]" />
            {t.title}
          </h3>
          <p className="text-xs text-slate-400 font-medium">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("zscores")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "zscores" 
                ? "bg-[#008DC9] text-white shadow-xs" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.zscoresTab}
          </button>
          <button
            onClick={() => setActiveTab("anthropometrics")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "anthropometrics" 
                ? "bg-[#008DC9] text-white shadow-xs" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.anthroTab}
          </button>
        </div>
      </div>

      {/* Visual Line Chart Canvas */}
      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 relative">
        <div className="h-56 w-full flex items-center justify-center relative">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            
            {activeTab === "zscores" ? (
              <>
                {/* WHO Standard Background Threshold Bands */}
                {/* Severe: Z <= -3 (shaded light red at bottom) */}
                <rect 
                  x={paddingLeft} 
                  y={getY(-3)} 
                  width={chartWidth} 
                  height={getY(-5) - getY(-3)} 
                  fill="#fee2e2" 
                  opacity="0.25" 
                />
                {/* Moderate: -3 < Z <= -2 (shaded light orange) */}
                <rect 
                  x={paddingLeft} 
                  y={getY(-2)} 
                  width={chartWidth} 
                  height={getY(-3) - getY(-2)} 
                  fill="#fef3c7" 
                  opacity="0.25" 
                />
                {/* Normal: Z > -2 (shaded light green) */}
                <rect 
                  x={paddingLeft} 
                  y={getY(2.5)} 
                  width={chartWidth} 
                  height={getY(-2) - getY(2.5)} 
                  fill="#d1fae5" 
                  opacity="0.15" 
                />

                {/* Grid threshold lines with labels on Y-axis */}
                <line x1={paddingLeft} y1={getY(2)} x2={width - paddingRight} y2={getY(2)} stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3,3" />
                <text x={paddingLeft - 8} y={getY(2) + 3} textAnchor="end" fill="#64748b" className="text-[9px] font-bold font-mono">+2 SD</text>

                <line x1={paddingLeft} y1={getY(0)} x2={width - paddingRight} y2={getY(0)} stroke="#10b981" strokeWidth="1" strokeDasharray="1,1" />
                <text x={paddingLeft - 8} y={getY(0) + 3} textAnchor="end" fill="#10b981" className="text-[9px] font-bold font-mono">0 (Median)</text>

                <line x1={paddingLeft} y1={getY(-2)} x2={width - paddingRight} y2={getY(-2)} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3,3" />
                <text x={paddingLeft - 8} y={getY(-2) + 3} textAnchor="end" fill="#d97706" className="text-[9px] font-bold font-mono">-2 SD</text>

                <line x1={paddingLeft} y1={getY(-3)} x2={width - paddingRight} y2={getY(-3)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,3" />
                <text x={paddingLeft - 8} y={getY(-3) + 3} textAnchor="end" fill="#be123c" className="text-[9px] font-bold font-mono">-3 SD</text>

                {/* Trajectory Paths */}
                {/* HAZ Line */}
                <path d={buildPath("haz")} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                
                {/* WAZ Line */}
                <path d={buildPath("waz")} fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* WHZ Line */}
                <path d={buildPath("whz")} fill="none" stroke="#be123c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                {/* Interactive Points on Lines */}
                {visitPoints.map((p, i) => (
                  <g key={i}>
                    {/* Tick label on X-axis */}
                    <text x={getX(i)} y={height - 8} textAnchor="middle" fill="#64748b" className="text-[8px] font-semibold">
                      {new Date(p.date).toLocaleDateString(lang === "ar" ? "ar-YE" : "en-US", { month: "short", day: "numeric" })}
                    </text>

                    {/* Vertical line pointer for active/hovered visit */}
                    {(selectedVisitIdx === i || (selectedVisitIdx === null && i === visitPoints.length - 1)) && (
                      <line x1={getX(i)} y1={paddingTop} x2={getX(i)} y2={height - paddingBottom} stroke="#008DC9" strokeWidth="1.5" strokeDasharray="2,2" />
                    )}

                    {/* Circle Node: WAZ */}
                    <circle 
                      cx={getX(i)} 
                      cy={getY(p.waz)} 
                      r={selectedVisitIdx === i ? "6" : "4"} 
                      fill="#ea580c" 
                      stroke="white" 
                      strokeWidth="1.5" 
                      className="cursor-pointer transition-all duration-200 hover:scale-150"
                      onClick={() => setSelectedVisitIdx(i)}
                    />

                    {/* Circle Node: HAZ */}
                    <circle 
                      cx={getX(i)} 
                      cy={getY(p.haz)} 
                      r={selectedVisitIdx === i ? "6" : "4"} 
                      fill="#d97706" 
                      stroke="white" 
                      strokeWidth="1.5" 
                      className="cursor-pointer transition-all duration-200 hover:scale-150"
                      onClick={() => setSelectedVisitIdx(i)}
                    />

                    {/* Circle Node: WHZ */}
                    <circle 
                      cx={getX(i)} 
                      cy={getY(p.whz)} 
                      r={selectedVisitIdx === i ? "7" : "5"} 
                      fill="#be123c" 
                      stroke="white" 
                      strokeWidth="2" 
                      className="cursor-pointer transition-all duration-200 hover:scale-150"
                      onClick={() => setSelectedVisitIdx(i)}
                    />
                  </g>
                ))}
              </>
            ) : (
              <>
                {/* Anthropometrics Direct Curves (Weight & MUAC) */}
                {/* Weight grid lines */}
                <line x1={paddingLeft} y1={getWeightY(minWeight)} x2={width - paddingRight} y2={getWeightY(minWeight)} stroke="#cbd5e1" strokeWidth="0.5" />
                <line x1={paddingLeft} y1={getWeightY(maxWeight)} x2={width - paddingRight} y2={getWeightY(maxWeight)} stroke="#cbd5e1" strokeWidth="0.5" />
                
                {/* Y-axis Labels */}
                <text x={paddingLeft - 8} y={getWeightY(minWeight)} textAnchor="end" fill="#ea580c" className="text-[8px] font-bold">{minWeight.toFixed(1)}kg</text>
                <text x={paddingLeft - 8} y={getWeightY(maxWeight) + 5} textAnchor="end" fill="#ea580c" className="text-[8px] font-bold">{maxWeight.toFixed(1)}kg</text>

                {/* Weight curve line */}
                {(() => {
                  const dWeight = visitPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getWeightY(p.weight)}`).join(" ");
                  return <path d={dWeight} fill="none" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
                })()}

                {/* MUAC curve line (if MUAC values exist) */}
                {muacs.some(m => m > 0) && (
                  <>
                    {(() => {
                      const dMuac = visitPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getMuacY(p.muac || 115)}`).join(" ");
                      return <path d={dMuac} fill="none" stroke="#008DC9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3,3" />;
                    })()}
                  </>
                )}

                {/* Points */}
                {visitPoints.map((p, i) => (
                  <g key={i}>
                    {/* Tick labels */}
                    <text x={getX(i)} y={height - 8} textAnchor="middle" fill="#64748b" className="text-[8px] font-semibold">
                      {new Date(p.date).toLocaleDateString(lang === "ar" ? "ar-YE" : "en-US", { month: "short", day: "numeric" })}
                    </text>

                    {/* Weight Point */}
                    <circle 
                      cx={getX(i)} 
                      cy={getWeightY(p.weight)} 
                      r={selectedVisitIdx === i ? "6" : "4"} 
                      fill="#ea580c" 
                      stroke="white" 
                      strokeWidth="1.5" 
                      className="cursor-pointer"
                      onClick={() => setSelectedVisitIdx(i)}
                    />

                    {/* MUAC Point */}
                    {p.muac > 0 && (
                      <circle 
                        cx={getX(i)} 
                        cy={getMuacY(p.muac)} 
                        r={selectedVisitIdx === i ? "6" : "4"} 
                        fill="#008DC9" 
                        stroke="white" 
                        strokeWidth="1.5" 
                        className="cursor-pointer"
                        onClick={() => setSelectedVisitIdx(i)}
                      />
                    )}
                  </g>
                ))}
              </>
            )}
          </svg>
        </div>

        {/* Legend Panel */}
        <div className="flex flex-wrap justify-center gap-4 text-[10px] font-black uppercase tracking-wider bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs">
          {activeTab === "zscores" ? (
            <>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#be123c] rounded-full" /> {t.whz}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#ea580c] rounded-full" /> {t.waz}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#d97706] rounded-full" /> {t.haz}</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#ea580c] rounded-full" /> {t.weightVal} (kg)</span>
              {muacs.some(m => m > 0) && (
                <span className="flex items-center gap-1 border-l pl-3 border-slate-200">
                  <span className="w-2.5 h-2.5 bg-[#008DC9] rounded-full" /> {t.muacVal} (mm)
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Selected Visit Inspection Details Panel */}
      <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3.5 transition-all duration-300 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-[#008DC9]" />
            <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
              {lang === "en" ? `Visit Details:` : `تفاصيل الزيارة:`}{" "}
              <span className="text-[#008DC9] font-mono font-black">
                {new Date(activeVisit.date).toLocaleDateString(lang === "ar" ? "ar-YE" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </span>
          </div>
          <span className="text-[10px] bg-[#008DC9]/10 text-[#008DC9] font-extrabold uppercase px-2 py-0.5 rounded-full">
            {t.age}: {activeVisit.ageMonths} {lang === "en" ? "Months" : "أشهر"}
          </span>
        </div>

        {/* Real-time calculated parameters for active visit */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-3xs">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">{t.weightVal}</span>
            <span className="text-sm font-black text-slate-900 block mt-0.5">{activeVisit.weight.toFixed(2)} kg</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-3xs">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">{t.heightVal}</span>
            <span className="text-sm font-black text-slate-900 block mt-0.5">{activeVisit.height.toFixed(1)} cm</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-3xs">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">{t.muacVal}</span>
            <span className="text-sm font-black text-slate-900 block mt-0.5">
              {activeVisit.muac > 0 ? `${activeVisit.muac} mm` : "N/A"}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-3xs">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">{lang === "en" ? "Bilateral Oedema" : "الوذمة"}</span>
            <span className={`text-xs font-black block mt-1 ${activeVisit.oedema ? "text-rose-600 animate-pulse" : "text-emerald-600"}`}>
              {activeVisit.oedema ? t.yes : t.no}
            </span>
          </div>
        </div>

        {/* Z-Scores block for selected visit */}
        {activeTab === "zscores" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-3 rounded-xl border text-xs text-left ${
              activeVisit.whz <= -3 ? "bg-rose-50 border-rose-200 text-rose-950" :
              activeVisit.whz <= -2 ? "bg-amber-50 border-amber-200 text-amber-950" :
              "bg-emerald-50/50 border-emerald-100 text-emerald-950"
            }`}>
              <span className="font-extrabold block text-[9px] uppercase text-slate-500 mb-0.5">{t.whz}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black">{activeVisit.whz.toFixed(2)}</span>
                <span className="text-[9px] font-bold">SD</span>
              </div>
              <span className="text-[9px] font-semibold opacity-80 block mt-1">
                {activeVisit.whz <= -3 ? t.severeRange : activeVisit.whz <= -2 ? t.moderateRange : t.normalRange}
              </span>
            </div>

            <div className={`p-3 rounded-xl border text-xs text-left ${
              activeVisit.waz <= -3 ? "bg-rose-50 border-rose-200 text-rose-950" :
              activeVisit.waz <= -2 ? "bg-amber-50 border-amber-200 text-amber-950" :
              "bg-emerald-50/50 border-emerald-100 text-emerald-950"
            }`}>
              <span className="font-extrabold block text-[9px] uppercase text-slate-500 mb-0.5">{t.waz}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black">{activeVisit.waz.toFixed(2)}</span>
                <span className="text-[9px] font-bold">SD</span>
              </div>
              <span className="text-[9px] font-semibold opacity-80 block mt-1">
                {activeVisit.waz <= -3 ? t.severeRange : activeVisit.waz <= -2 ? t.moderateRange : t.normalRange}
              </span>
            </div>

            <div className={`p-3 rounded-xl border text-xs text-left ${
              activeVisit.haz <= -3 ? "bg-rose-50 border-rose-200 text-rose-950" :
              activeVisit.haz <= -2 ? "bg-amber-50 border-amber-200 text-amber-950" :
              "bg-emerald-50/50 border-emerald-100 text-emerald-950"
            }`}>
              <span className="font-extrabold block text-[9px] uppercase text-slate-500 mb-0.5">{t.haz}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black">{activeVisit.haz.toFixed(2)}</span>
                <span className="text-[9px] font-bold">SD</span>
              </div>
              <span className="text-[9px] font-semibold opacity-80 block mt-1">
                {activeVisit.haz <= -3 ? t.severeRange : activeVisit.haz <= -2 ? t.moderateRange : t.normalRange}
              </span>
            </div>
          </div>
        )}

        {/* Symptoms and clinical notes */}
        {(activeVisit.symptoms || activeVisit.notes) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-slate-200 text-left">
            {activeVisit.symptoms && (
              <div>
                <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-wide block mb-0.5">{t.symptoms}</span>
                <p className="font-semibold text-slate-700">{activeVisit.symptoms}</p>
              </div>
            )}
            {activeVisit.notes && (
              <div>
                <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-wide block mb-0.5">{t.notes}</span>
                <p className="font-semibold text-slate-600 italic">"{activeVisit.notes}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visit List table for detailed manual lookup */}
      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-extrabold uppercase border-b border-slate-200 text-[9px] tracking-wider">
                <th className="p-2.5 pl-4">{t.date}</th>
                <th className="p-2.5">{t.age}</th>
                <th className="p-2.5">{t.weightVal}</th>
                <th className="p-2.5">{t.heightVal}</th>
                <th className="p-2.5">{t.muacVal}</th>
                <th className="p-2.5 pr-4 text-right">WHZ / WAZ / HAZ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visitPoints.map((v, i) => (
                <tr 
                  key={v.id} 
                  onClick={() => setSelectedVisitIdx(i)}
                  className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                    (selectedVisitIdx === i || (selectedVisitIdx === null && i === visitPoints.length - 1))
                      ? "bg-blue-50/50 font-semibold" 
                      : ""
                  }`}
                >
                  <td className="p-2.5 pl-4 font-medium text-slate-600">
                    {new Date(v.date).toLocaleDateString(lang === "ar" ? "ar-YE" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="p-2.5 text-slate-600 font-mono font-bold">{v.ageMonths}m</td>
                  <td className="p-2.5 text-slate-900 font-bold">{v.weight.toFixed(2)} kg</td>
                  <td className="p-2.5 text-slate-900 font-bold">{v.height.toFixed(1)} cm</td>
                  <td className="p-2.5 text-slate-600 font-bold">{v.muac > 0 ? `${v.muac} mm` : "N/A"}</td>
                  <td className="p-2.5 pr-4 text-right font-mono font-black">
                    <span className={v.whz <= -3 ? "text-rose-600" : v.whz <= -2 ? "text-amber-600" : "text-emerald-600"}>
                      {v.whz.toFixed(1)}
                    </span>
                    {" / "}
                    <span className={v.waz <= -3 ? "text-rose-600" : v.waz <= -2 ? "text-amber-600" : "text-emerald-600"}>
                      {v.waz.toFixed(1)}
                    </span>
                    {" / "}
                    <span className={v.haz <= -3 ? "text-rose-600" : v.haz <= -2 ? "text-amber-600" : "text-emerald-600"}>
                      {v.haz.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
