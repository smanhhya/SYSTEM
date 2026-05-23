// js/finance.js
import { db, ref, push, update, onValue } from './firebase.js';
import { toggleLoader, showToast, closeModal } from './ui.js';
import { validateNumber } from './helpers.js';
import { globalSettings } from './settings.js';
import { allBatches } from './batches.js'; // بنستدعي الدفعات عشان نجيب اسم الدفعة

export let allTransactions = {};

export function initFinance() {
    // مراقبة دفتر الحسابات (Ledger) لحظياً
    onValue(ref(db, "ledger"), (snapshot) => {
        allTransactions = snapshot.exists() ? snapshot.val() : {};
        renderLedger(); // تحديث شاشة الحسابات
    });

    // ربط الدوال بالواجهة
    window.saveDailyLog = saveDailyLog;
    window.saveTransaction = saveTransactionForm;
}

// 1. التسجيل اليومي (النافق والعلف) - بيحدث الدفعة وبيسجل تكلفة العلف
async function saveDailyLog() {
    const batchId = document.getElementById('dBatch').value;
    const dead = validateNumber(document.getElementById('dDead').value, 'النافق') || 0;
    const feed = validateNumber(document.getElementById('dFeed').value, 'العلف') || 0;

    if (!batchId || (dead === 0 && feed === 0)) {
        showToast("برجاء إدخال النافق أو العلف بشكل صحيح", true);
        return;
    }

    toggleLoader(true, "جاري تسجيل اليومية وحساب التكلفة...");

    const batch = allBatches[batchId];
    const today = new Date().toISOString().split('T')[0];

    try {
        // أ. إضافة السجل في تاريخ اليوم داخل الدفعة نفسها
        await push(ref(db, `batches/${batchId}/dailyLogs`), { 
            date: today, 
            dead: dead, 
            feed: feed,
            timestamp: Date.now()
        });

        // ب. تحديث الإجمالي التراكمي للدفعة (عشان تظهر في الـ Dashboard بسرعة)
        await update(ref(db, `batches/${batchId}`), { 
            totalDead: (batch.totalDead || 0) + dead, 
            totalFeed: (batch.totalFeed || 0) + feed 
        });

        // ج. لو فيه علف اتسحب، نترجمه لفلوس ونسجله كمصروف في الحسابات
        if (feed > 0) {
            const feedCost = feed * (globalSettings.feedPrice || 30);
            await recordTransaction('out', feedCost, `علف يومي (${feed} كجم) - ${batch.name}`, batchId);
        }

        showToast("تم حفظ السجل اليومي وتحديث التكاليف بنجاح");
        
        // تصفير الخانات وقفل المودال
        document.getElementById('dDead').value = 0;
        document.getElementById('dFeed').value = 0;
        closeModal('modalDaily');

    } catch (error) {
        showToast("حدث خطأ أثناء حفظ السجل اليومي", true);
        console.error(error);
    } finally {
        toggleLoader(false);
    }
}

// 2. دالة داخلية لتسجيل أي حركة مالية في الدفتر
export async function recordTransaction(type, amount, desc, batchId = 'general') {
    const today = new Date().toISOString().split('T')[0];
    await push(ref(db, 'ledger'), { 
        type: type, // 'in' (إيراد) أو 'out' (مصروف)
        amount: amount, 
        desc: desc, 
        batchId: batchId, 
        date: today, 
        timestamp: Date.now() 
    });
}

// 3. دالة لواجهة المستخدم لتسجيل مصروف يدوي (أدوية، كهرباء، الخ..)
async function saveTransactionForm(type) {
    const amount = validateNumber(document.getElementById('eAmount').value, 'المبلغ');
    const desc = document.getElementById('eType').value.trim();
    const batchId = type === 'out' ? document.getElementById('eBatch').value : 'general';

    if (amount === null || !desc) {
        showToast("برجاء إدخال المبلغ وبند الصرف", true);
        return;
    }

    toggleLoader(true, "جاري التسجيل بالدفتر...");

    try {
        await recordTransaction(type, amount, desc, batchId);
        document.getElementById('eAmount').value = '';
        document.getElementById('eType').value = '';
        closeModal('modalExpense');
        showToast("تم التسجيل بالدفتر المالي");
    } catch (error) {
        showToast("حدث خطأ أثناء تسجيل المصروف", true);
    } finally {
        toggleLoader(false);
    }
}

// 4. عرض الحسابات (إيرادات، مصروفات، صافي الربح)
function renderLedger() {
    const ledgerList = document.getElementById('ledgerList');
    if (!ledgerList) return;

    let tIn = 0, tOut = 0;
    let html = '';

    // ترتيب المعاملات من الأحدث للأقدم
    const sortedIds = Object.keys(allTransactions).sort((a, b) => {
        return allTransactions[b].timestamp - allTransactions[a].timestamp;
    });

    sortedIds.forEach(id => {
        const t = allTransactions[id];
        if (t.type === 'in') tIn += t.amount; 
        else tOut += t.amount;

        const colorClass = t.type === 'in' ? 'text-success' : 'text-danger';
        const sign = t.type === 'in' ? '+' : '-';

        html += `
        <div class="transaction-item">
            <div>
                <b>${t.desc}</b><br>
                <span style="font-size:12px;color:var(--text-muted);">${t.date}</span>
            </div>
            <div style="font-weight:900;" class="${colorClass}" dir="ltr">
                ${sign} ${t.amount}
            </div>
        </div>`;
    });

    // تحديث الواجهة بالأرقام النهائية
    const totalRev = document.getElementById('totalRev');
    const totalExp = document.getElementById('totalExp');
    const netProfit = document.getElementById('netProfit');
    const dashSales = document.getElementById('dashSales');

    if (totalRev) totalRev.innerText = tIn; 
    if (totalExp) totalExp.innerText = tOut;
    if (netProfit) netProfit.innerText = (tIn - tOut) + " ج.م"; 
    if (dashSales) dashSales.innerText = tIn;

    ledgerList.innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--text-muted);">لا يوجد سجلات مالية حتى الآن</div>';
}
