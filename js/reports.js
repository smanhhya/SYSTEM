// js/reports.js
import { birdStandards, globalSettings, gradeNames } from './settings.js';
import { allBatches } from './batches.js';
import { allTransactions } from './finance.js';

export function initReports() {
    // ربط القائمة المنسدلة للتقارير بالدالة
    const reportSelect = document.getElementById('reportBatchSelect');
    if (reportSelect) {
        reportSelect.addEventListener('change', generateBatchReport);
    }
    
    // إتاحة الدالة عالمياً لو احتجناها من أي مكان
    window.generateBatchReport = generateBatchReport;
}

function generateBatchReport() {
    const id = document.getElementById('reportBatchSelect').value;
    const container = document.getElementById('batchReportContainer');
    
    if (!id) { 
        container.style.display = 'none'; 
        return; 
    }
    
    const b = allBatches[id];
    if (!b) return;

    // 1. حساب إجمالي تكلفة الدفعة من دفتر الحسابات
    let batchCost = 0; 
    Object.values(allTransactions).forEach(t => {
        // نجمع أي مصروف (out) مسجل على هذه الدفعة
        if (t.batchId === id && t.type === 'out') {
            batchCost += t.amount;
        }
    });

    // 2. أرقام التشغيل والتحليلات
    const initialEggs = b.initialEggs || 0;
    const hatched = b.hatchedChicks || 0;
    const dead = b.totalDead || 0;
    const totalFeed = b.totalFeed || 0;
    
    // حساب نسبة النفوق من الكتاكيت اللي فقست
    const mortalityRate = hatched > 0 ? ((dead / hatched) * 100).toFixed(1) : 0;
    
    // لو الدفعة اكتملت وتم تصنيفها، نقدر نطلع التقرير المالي الشامل
    if (b.status === 'completed' && b.classifyData) {
        const yieldPairs = b.slaughterYield || 0; // إجمالي الأجواز السليمة
        let potentialRevenue = 0; 
        let outputHtml = '';
        
        // حساب القيمة البيعية للمخرجات
        Object.keys(b.classifyData).forEach(g => {
            if (b.classifyData[g] > 0) {
                // نضرب العدد في السعر الحالي للصنف
                potentialRevenue += (b.classifyData[g] * (globalSettings[g] || 0));
                
                // تجهيز العرض المرئي
                const bgColor = g === 'bad' ? 'var(--danger)' : 'var(--primary)';
                outputHtml += `<span class="badge" style="background:${bgColor}; margin:2px; font-size:11px;">
                                 ${gradeNames[g]}: ${b.classifyData[g]}
                               </span>`;
            }
        });
        
        // حساب الـ FCR التقريبي (كفاءة التحويل)
        // بفرض أن متوسط وزن الجوز المذبوح نصف كيلو (0.5 كجم) للتسهيل، يمكن تعديلها لاحقاً
        const estimatedMeatKg = yieldPairs * 0.5; 
        const fcr = estimatedMeatKg > 0 ? (totalFeed / estimatedMeatKg).toFixed(2) : 0;
        
        // حسابات الربحية
        const costPerPair = yieldPairs > 0 ? (batchCost / yieldPairs).toFixed(2) : 0;
        const netProfit = potentialRevenue - batchCost;
        
        // تجهيز الختم النهائي للدفعة (مكسب / خسارة)
        let stampHtml = '';
        if (netProfit > 0) {
            stampHtml = `<div class="result-stamp text-success" style="border-color:var(--success);">✅ الدفعة حققت مكسب: +${netProfit} ج.م</div>`;
        } else if (netProfit < 0) {
            stampHtml = `<div class="result-stamp text-danger" style="border-color:var(--danger);">❌ الدفعة حققت خسارة: ${netProfit} ج.م</div>`;
        } else {
            stampHtml = `<div class="result-stamp text-warning" style="border-color:var(--warning);">➖ الدفعة لم تحقق ربح أو خسارة (تعادل)</div>`;
        }

        const birdName = birdStandards[b.birdType || 'quail']?.name || 'طائر';

        // رسم التقرير الختامي
        container.innerHTML = `
            <div style="background:var(--card-bg); padding:15px; border-radius:12px; border: 2px solid var(--border); box-shadow:0 4px 10px rgba(0,0,0,0.05);">
                <div style="text-align:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:15px;">
                    <h3 style="margin:0; color:var(--primary);">البيان الختامي (P&L) - ${b.name}</h3>
                    <span style="font-size:12px; color:var(--text-muted);">نوع الطائر: ${birdName}</span>
                </div>
                
                <div class="grid-2" style="font-size:13px; line-height:2; background:var(--bg); padding:10px; border-radius:10px;">
                    <div>🥚 بيض البداية: <b>${initialEggs}</b></div>
                    <div>🐣 نسبة الفقس: <b class="text-success">${b.hatchRate || 0}%</b></div>
                    <div>☠️ نسبة النفوق: <b class="text-danger">${mortalityRate}%</b></div>
                    <div>📈 FCR تقريبي: <b class="text-info">${fcr}</b></div>
                </div>
                
                <hr style="border:1px dashed var(--border); margin:15px 0;">
                
                <div style="margin-bottom:15px;">
                    <b style="font-size:13px; color:var(--text-muted);">مخرجات الدفعة للفريزر:</b><br>
                    <div style="margin-top:8px;">${outputHtml}</div>
                </div>
                
                <div class="grid-2" style="background:#fff; border:1px solid var(--border); padding:12px; border-radius:10px;">
                    <div style="text-align:center;">إجمالي التكلفة<br><b class="text-danger" style="font-size:18px;">${batchCost} ج</b></div>
                    <div style="text-align:center; border-right:1px solid var(--border);">القيمة البيعية<br><b class="text-success" style="font-size:18px;">${potentialRevenue} ج</b></div>
                </div>
                
                <div style="text-align:center; margin-top:15px; background:var(--bg); padding:8px; border-radius:8px;">
                    <span style="font-size:13px;">تكلفة إنتاج الجوز الواحد (علف + مصاريف): <b class="text-primary" style="font-size:16px;">${costPerPair} ج.م</b></span>
                </div>
                
                ${stampHtml}
            </div>`;
    } 
    // لو الدفعة لسه شغالة (تربية أو تفريخ)، نطلع تقرير متابعة مبدئي
    else {
        container.innerHTML = `
            <div style="background:var(--card-bg); padding:15px; border-radius:12px; border: 2px dashed var(--warning); text-align:center;">
                <h3 style="margin-top:0; color:var(--warning);">الدفعة قيد التشغيل (${b.status})</h3>
                <p style="font-size:14px; color:var(--text-muted);">إجمالي التكلفة المسجلة حتى الآن: <b class="text-danger">${batchCost} ج.م</b></p>
                <p style="font-size:13px;">نسبة النفوق الحالية: <b>${mortalityRate}%</b> | العلف المستهلك: <b>${totalFeed} كجم</b></p>
                <div style="font-size:12px; color:var(--text-muted); margin-top:10px;">* التقرير الختامي يصدر تلقائياً بعد إنهاء الذبح وتصنيف البضاعة.</div>
            </div>`;
    }
    
    container.style.display = 'block';
}
