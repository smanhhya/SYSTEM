// js/freezer.js
import { db, ref, set, get, push, update, onValue } from './firebase.js';
import { toggleLoader, showToast, closeModal } from './ui.js';
import { validateNumber } from './helpers.js';
import { globalSettings, gradeNames, birdStandards } from './settings.js';
import { allBatches } from './batches.js';
import { recordTransaction } from './finance.js';

let globalFreezerStock = {};
let allFreezerLogs = {};

export function initFreezer() {
    // 1. مراقبة الرصيد الكلي للفريزر
    onValue(ref(db, "inventory/freezer"), (snapshot) => {
        globalFreezerStock = snapshot.exists() ? snapshot.val() : {};
        renderFreezerGrid();
    });

    // 2. مراقبة سجلات الإيداع (عشان نحسب مدة التخزين والـ FIFO)
    onValue(ref(db, "inventory/freezerLogs"), (snapshot) => {
        allFreezerLogs = snapshot.exists() ? snapshot.val() : {};
        renderFreezerLogs();
    });

    // ربط دوال الواجهة
    window.promptClassify = promptClassify;
    window.finishSlaughter = finishSlaughter;
    window.calculateSaleTotal = calculateSaleTotal;
    window.processSale = processSale;
}

// ================= 1. تصنيف الذبح وإضافته للمخزون =================
function promptClassify(id) {
    document.getElementById('classBatchId').value = id;
    openModal('modalClassify');
}

async function finishSlaughter() {
    const batchId = document.getElementById('classBatchId').value;
    const batch = allBatches[batchId];
    if(!batch) return;

    let yieldTotal = 0; 
    const toAdd = {};
    let hasInput = false;

    // تجميع القيم المدخلة لكل تصنيف
    Object.keys(gradeNames).forEach(g => {
        const val = validateNumber(document.getElementById(`c_${g}`).value, gradeNames[g]) || 0;
        toAdd[g] = val;
        if(g !== 'bad') yieldTotal += val;
        if(val > 0) hasInput = true;
    });

    if(!hasInput) return showToast("برجاء إدخال ناتج التصنيف", true);

    toggleLoader(true, "جاري ترحيل البضاعة للفريزر...");

    try {
        // أ. تحديث الرصيد الكلي
        const newGlobalStock = { ...globalFreezerStock };
        Object.keys(toAdd).forEach(g => newGlobalStock[g] = (newGlobalStock[g] || 0) + toAdd[g]);
        await set(ref(db, "inventory/freezer"), newGlobalStock);

        // ب. إنشاء سجل إيداع جديد (عشان نعرف عمر البضاعة دي)
        const today = new Date().toISOString().split('T')[0];
        await push(ref(db, 'inventory/freezerLogs'), {
            batchId: batchId,
            batchName: batch.name,
            birdType: batch.birdType || 'quail',
            dateAdded: today,
            items: toAdd,
            timestamp: Date.now()
        });

        // ج. إغلاق الدفعة
        await update(ref(db, `batches/${batchId}`), { 
            status: 'completed', 
            slaughterYield: yieldTotal, 
            classifyData: toAdd 
        });

        // تنظيف الواجهة
        Object.keys(gradeNames).forEach(g => document.getElementById(`c_${g}`).value = 0);
        closeModal('modalClassify');
        showToast("اكتملت الدفعة وتم ترحيل الأرصدة للفريزر بنجاح");
    } catch (error) {
        showToast("حدث خطأ أثناء الترحيل", true);
        console.error(error);
    } finally {
        toggleLoader(false);
    }
}

// ================= 2. المبيعات وتطبيق الـ FIFO =================
function calculateSaleTotal() {
    const grade = document.getElementById('sGrade').value;
    const qty = parseInt(document.getElementById('sQty').value) || 0;
    const price = globalSettings[grade] || 0;
    document.getElementById('saleTotalDisplay').innerText = (qty * price) + " ج.م";
}

async function processSale() {
    const grade = document.getElementById('sGrade').value;
    const qty = validateNumber(document.getElementById('sQty').value, 'الكمية');
    if(!qty) return;

    const price = globalSettings[grade] || 0;
    const amount = qty * price;
    const currentStock = globalFreezerStock[grade] || 0;

    if(qty > currentStock) {
        showToast(`لا يوجد رصيد كافي! المتاح: ${currentStock}`, true);
        return;
    }

    toggleLoader(true, "جاري إتمام البيع وتطبيق FIFO لخصم الأقدم...");

    try {
        // أ. خصم الرصيد من المخزون الكلي
        await set(ref(db, `inventory/freezer/${grade}`), currentStock - qty);

        // ب. تسجيل الإيراد في الحسابات
        await recordTransaction('in', amount, `مبيعات (${qty} جوز - ${gradeNames[grade]})`);

        // ج. تطبيق خوارزمية FIFO على السجلات القديمة
        let remainingToDeduct = qty;
        
        // ترتيب السجلات من الأقدم للأحدث بناءً على الـ timestamp
        const sortedLogIds = Object.keys(allFreezerLogs).sort((a,b) => allFreezerLogs[a].timestamp - allFreezerLogs[b].timestamp);

        for(let logId of sortedLogIds) {
            if(remainingToDeduct <= 0) break; // خلصنا خصم الكمية

            let log = allFreezerLogs[logId];
            if(log.items && log.items[grade] > 0) {
                let availableInLog = log.items[grade];
                
                if(availableInLog <= remainingToDeduct) {
                    // السجل ده هيتصفّر بالكامل ولسه محتاجين نكمل خصم
                    remainingToDeduct -= availableInLog;
                    await set(ref(db, `inventory/freezerLogs/${logId}/items/${grade}`), 0);
                } else {
                    // السجل ده فيه بضاعة تكفي وتفيض
                    await set(ref(db, `inventory/freezerLogs/${logId}/items/${grade}`), availableInLog - remainingToDeduct);
                    remainingToDeduct = 0; 
                }
            }
        }

        document.getElementById('sQty').value = '';
        document.getElementById('saleTotalDisplay').innerText = "0 ج.م";
        closeModal('modalSale');
        showToast("تم إتمام البيع بنجاح");
    } catch (error) {
        showToast("خطأ أثناء البيع", true);
        console.error(error);
    } finally {
        toggleLoader(false);
    }
}

// ================= 3. عرض الواجهة (الرصيد وتنبيهات الألوان) =================
function renderFreezerGrid() {
    const grid = document.getElementById('freezerGrid');
    const dashFreezer = document.getElementById('dashFreezer');
    if(!grid) return;

    let total = 0; let html = '';
    Object.keys(gradeNames).forEach(g => {
        if(g === 'bad') return;
        const count = globalFreezerStock[g] || 0; 
        total += count;
        
        html += `<div style="background:var(--bg); padding:15px; border-radius:10px; text-align:center; border:1px solid var(--border);">
            <span style="font-size:13px; color:var(--text-muted); font-weight:bold;">${gradeNames[g]}</span>
            <div style="font-size:22px; font-weight:900; color:var(--primary); margin-top:5px;">${count}</div>
        </div>`;
    });
    grid.innerHTML = html;
    if(dashFreezer) dashFreezer.innerText = total;
}

function renderFreezerLogs() {
    const logsContainer = document.getElementById('freezerLogs');
    const alertsContainer = document.getElementById('alertsContainer');
    if(!logsContainer) return;

    let html = '';
    let criticalAlertsHtml = '';
    const now = new Date();
    
    // الترتيب من الأحدث للأقدم للعرض
    const sortedLogIds = Object.keys(allFreezerLogs).sort((a,b) => allFreezerLogs[b].timestamp - allFreezerLogs[a].timestamp);

    sortedLogIds.forEach(id => {
        const log = allFreezerLogs[id];
        
        // تصفية السجلات اللي أرصدتها كلها بقت صفر بفضل الـ FIFO
        const totalItemsInLog = Object.keys(log.items).reduce((sum, key) => sum + log.items[key], 0);
        if(totalItemsInLog === 0) return; // لا تعرض السجلات الفارغة

        const daysOld = Math.floor((now - new Date(log.dateAdded)) / 86400000);
        
        // نظام التنبيهات بالألوان
        let badgeHtml = '';
        if(daysOld <= 7) {
            badgeHtml = `<span class="badge" style="background:var(--success);">مخزون طازج</span>`;
        } else if(daysOld <= 30) {
            badgeHtml = `<span class="badge" style="background:var(--warning); color:#000;">${daysOld} يوم بالفريزر</span>`;
        } else {
            badgeHtml = `<span class="badge" style="background:var(--danger);">قديم جداً (${daysOld} يوم)</span>`;
            // إضافة تنبيه للشاشة الرئيسية
            criticalAlertsHtml += `<div>🚨 بضاعة الدفعة <b>${log.batchName}</b> لها أكثر من شهر بالفريزر! يجب بيعها فوراً.</div>`;
        }
        
        // تجميع الأصناف المتبقية في هذا السجل فقط
        let itemsStr = Object.keys(log.items)
            .filter(k => log.items[k] > 0 && k !== 'bad')
            .map(k => `${gradeNames[k]}: ${log.items[k]}`)
            .join(' | ');

        html += `
        <div style="background:var(--card-bg); border:1px solid var(--border); padding:12px; border-radius:10px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;">
                <strong>${log.batchName}</strong>
                ${badgeHtml}
            </div>
            <div style="color:var(--text-muted); font-size:12px; margin-bottom:5px;">تاريخ التخزين: ${log.dateAdded}</div>
            <div style="font-weight:bold; color:var(--primary); font-size:14px;">المتبقي منها: ${itemsStr}</div>
        </div>`;
    });

    logsContainer.innerHTML = html || '<div style="text-align:center; padding:10px; color:var(--text-muted);">الفريزر فارغ حالياً</div>';
    
    // إضافة التنبيهات الحرجة للداشبورد إن وجدت
    if(alertsContainer && criticalAlertsHtml) {
        alertsContainer.innerHTML = criticalAlertsHtml + alertsContainer.innerHTML.replace('✅ لا يوجد تنبيهات عاجلة.', '');
    }
}
