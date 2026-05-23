// js/batches.js
import { db, ref, push, update, remove, onValue } from './firebase.js';
import { toggleLoader, showToast, closeModal } from './ui.js';
import { validateNumber, validateString } from './helpers.js';
import { birdStandards } from './settings.js';

// متغير لتخزين الدفعات محلياً لتسريع العرض
export let allBatches = {};

export function initBatches() {
    // الاستماع اللحظي (Real-time) لقاعدة البيانات
    onValue(ref(db, "batches"), (snapshot) => {
        allBatches = snapshot.exists() ? snapshot.val() : {};
        renderBatches(); // تحديث الواجهة فوراً عند أي تغيير
    });

    // ربط الدوال بأزرار الـ HTML
    window.saveNewBatch = saveNewBatch;
    window.deleteBatch = deleteBatch;
    window.updateStage = updateStage;
}

// 1. إدخال دفعة جديدة (مع الحساب التلقائي للتواريخ)
async function saveNewBatch() {
    const nameInput = document.getElementById('bName').value;
    const eggsInput = document.getElementById('bEggs').value;
    const dateStr = document.getElementById('bDate').value;
    const bType = document.getElementById('bBirdType').value;
    
    // التحقق من صحة البيانات باستخدام ملف helpers
    const name = validateString(nameInput, 'اسم الدفعة');
    const eggs = validateNumber(eggsInput, 'عدد البيض');

    if (!name || eggs === null || !dateStr) return;

    toggleLoader(true, "جاري إدخال الدفعة وحساب جدول التفريخ...");

    // سحب معايير الطائر المختار (أو السمان كافتراضي)
    const std = birdStandards[bType] || birdStandards['quail'];
    
    // حساب التواريخ بناءً على المعايير العالمية
    const insertD = new Date(dateStr);
    
    const hatcherD = new Date(insertD); 
    hatcherD.setDate(insertD.getDate() + std.hatcher); // موعد النقل للمفقس
    
    const hatchD = new Date(insertD); 
    hatchD.setDate(insertD.getDate() + std.hatch);     // موعد الفقس
    
    const rearD = new Date(hatchD); 
    rearD.setDate(hatchD.getDate() + std.slaughter);   // موعد الذبح (يُحسب من الفقس)

    const newBatch = { 
        name: name, 
        birdType: bType,
        insertDate: dateStr,
        hatcherDate: hatcherD.toISOString().split('T')[0],
        hatchDate: hatchD.toISOString().split('T')[0],
        rearDate: rearD.toISOString().split('T')[0],
        initialEggs: eggs, 
        status: 'incubator', // مرحلة البداية
        totalDead: 0, 
        totalFeed: 0,
        createdAt: Date.now()
    };

    try {
        await push(ref(db, 'batches'), newBatch);
        showToast(`تم بدء دورة (${std.name}) وتم جدولة التواريخ تلقائياً`);
        document.getElementById('bName').value = '';
        document.getElementById('bEggs').value = '';
        closeModal('modalBatch');
    } catch (error) {
        showToast("خطأ في الاتصال بقاعدة البيانات", true);
        console.error(error);
    } finally {
        toggleLoader(false);
    }
}

// 2. تحديث حالة الدفعة (مثال: من حضانة إلى مفقس)
async function updateStage(id, newStage) {
    toggleLoader(true, "جاري نقل الدفعة...");
    try {
        await update(ref(db, `batches/${id}`), { status: newStage });
        showToast("تم تحديث حالة الدفعة بنجاح");
    } catch (error) {
        showToast("حدث خطأ أثناء النقل", true);
    } finally {
        toggleLoader(false);
    }
}

// 3. حذف دفعة (مع التأكيد)
async function deleteBatch(id) {
    if(confirm("⚠️ هل أنت متأكد من حذف هذه الدفعة نهائياً؟ سيتم مسح سجلها بالكامل.")) {
        toggleLoader(true, "جاري الحذف...");
        try {
            await remove(ref(db, `batches/${id}`));
            showToast("تم حذف الدفعة");
        } catch (error) {
            showToast("حدث خطأ أثناء الحذف", true);
        } finally {
            toggleLoader(false);
        }
    }
}

// 4. دالة عرض الدفعات في الشاشات المختلفة (Dashboard, Incubator, Rearing)
function renderBatches() {
    const ui = { 
        inc: document.getElementById('incubatorList'), 
        rear: document.getElementById('rearingList'), 
        slaugh: document.getElementById('slaughterList'), 
        alerts: document.getElementById('alertsContainer') 
    };
    
    // تفريغ القوائم قبل إعادة الملء لتجنب التكرار
    if(ui.inc) ui.inc.innerHTML = ''; 
    if(ui.rear) ui.rear.innerHTML = ''; 
    if(ui.slaugh) ui.slaugh.innerHTML = ''; 
    if(ui.alerts) ui.alerts.innerHTML = ''; 
    
    let stats = { eggs: 0, chicks: 0 }; 
    const now = new Date();

    Object.keys(allBatches).forEach(id => {
        const b = allBatches[id];
        const bTypeName = birdStandards[b.birdType || 'quail']?.name || 'طائر';
        
        // عرض مبسط للتنبيهات (ستُطور لاحقاً في ملف التقارير)
        if (b.status === 'incubator' || b.status === 'hatcher') {
            stats.eggs += b.initialEggs;
            const daysIn = Math.floor((now - new Date(b.insertDate)) / 86400000);
            const bStd = birdStandards[b.birdType || 'quail'];
            
            if(b.status === 'incubator' && daysIn >= bStd.hatcher && ui.alerts) {
                ui.alerts.innerHTML += `<div>⚠️ الدفعة <b>${b.name}</b> جاهزة للمفقس.</div>`; 
            }
            
            // ... (هنا يتم إدراج HTML الخاص بكروت التفريخ كما هو في الكود القديم)
            // لتجنب زحمة الكود هنا، نكتفي بربط البيانات.
        }
        else if (b.status === 'rearing') {
            const alive = b.hatchedChicks - (b.totalDead||0); 
            stats.chicks += alive;
            // ...
        }
    });

    if(ui.alerts && ui.alerts.innerHTML === '') ui.alerts.innerHTML = '<div class="text-success" style="font-weight:bold;">✅ لا يوجد تنبيهات عاجلة.</div>';
    
    // تحديث أرقام لوحة القيادة
    const dashEggs = document.getElementById('dashEggs');
    const dashChicks = document.getElementById('dashChicks');
    if (dashEggs) dashEggs.innerText = stats.eggs; 
    if (dashChicks) dashChicks.innerText = stats.chicks;
}
