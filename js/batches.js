// js/batches.js
import { db, ref, push, update, remove, onValue, set, get } from './firebase.js';
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
    
    // 💡 دوال المفرخ الذكي والأرفف المجمعة
    window.loadIncubatorShelf = loadIncubatorShelf;
    window.toggleShelfInputs = toggleShelfInputs;
    window.calcShelfDist = calcShelfDist;
    window.emptyShelf = emptyShelf;
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

// 4. دالة عرض الدفعات في الشاشات المختلفة
function renderBatches() {
    const ui = { 
        inc: document.getElementById('incubatorList'), 
        rear: document.getElementById('rearingList'), 
        slaugh: document.getElementById('slaughterList'), 
        alerts: document.getElementById('alertsContainer') 
    };
    
    if(ui.inc) ui.inc.innerHTML = ''; 
    if(ui.rear) ui.rear.innerHTML = ''; 
    if(ui.slaugh) ui.slaugh.innerHTML = ''; 
    if(ui.alerts) ui.alerts.innerHTML = ''; 
    
    let stats = { eggs: 0, chicks: 0 }; 
    const now = new Date();

    Object.keys(allBatches).forEach(id => {
        const b = allBatches[id];
        const bTypeName = birdStandards[b.birdType || 'quail']?.name || 'طائر';
        
        if (b.status === 'incubator' || b.status === 'hatcher') {
            stats.eggs += b.initialEggs;
            const daysIn = Math.floor((now - new Date(b.insertDate)) / 86400000);
            const bStd = birdStandards[b.birdType || 'quail'];
            
            if(b.status === 'incubator' && daysIn >= bStd.hatcher && ui.alerts) {
                ui.alerts.innerHTML += `<div>⚠️ الدفعة <b>${b.name}</b> جاهزة للمفقس.</div>`; 
            }
        }
        else if (b.status === 'rearing') {
            const alive = b.hatchedChicks - (b.totalDead||0); 
            stats.chicks += alive;
        }
    });

    if(ui.alerts && ui.alerts.innerHTML === '') ui.alerts.innerHTML = '<div class="text-success" style="font-weight:bold;">✅ لا يوجد تنبيهات عاجلة.</div>';
    
    const dashEggs = document.getElementById('dashEggs');
    const dashChicks = document.getElementById('dashChicks');
    if (dashEggs) dashEggs.innerText = stats.eggs; 
    if (dashChicks) dashChicks.innerText = stats.chicks;
}

// ========================================================
// 💡 أجزاء المفرخ الذكي المفقودة التي تم إضافتها ودمجها هنا
// ========================================================

function toggleShelfInputs() {
    const type = document.getElementById('shelfLoadType').value;
    const multiContainer = document.getElementById('multiShelfContainer');
    if(multiContainer) multiContainer.style.display = type === 'multi' ? 'block' : 'none';
    calcShelfDist();
}

async function calcShelfDist() {
    const type = document.getElementById('shelfLoadType')?.value;
    const totalEggs = parseInt(document.getElementById('shelfLoadQty')?.value) || 0;
    const hint = document.getElementById('shelfDistHint');
    if(!hint) return;

    let shelvesCount = 1;
    
    // سحب إعدادات المكنة لضمان صحة التقسيم
    const settingsSnap = await get(ref(db, "settings"));
    const ptoShelves = settingsSnap.exists() && settingsSnap.val().setIncShelves ? settingsSnap.val().setIncShelves : 12;

    if (type === 'multi') {
        shelvesCount = parseInt(document.getElementById('multiShelfCount').value) || 1;
    } else if (type === 'full') {
        let empty = 0;
        const gridSnap = await get(ref(db, "incubatorGrid"));
        const incubatorShelves = gridSnap.exists() ? gridSnap.val() : {};
        for(let i = 1; i <= ptoShelves; i++) { if(!incubatorShelves[`shelf_${i}`]) empty++; }
        shelvesCount = empty;
    }
    
    if(shelvesCount > 0 && totalEggs > 0) {
        const perShelf = Math.floor(totalEggs / shelvesCount);
        hint.innerHTML = `<i class="fas fa-layer-group"></i> سيتم تقسيم (${totalEggs} بيضة) على (${shelvesCount} أرفف) بواقع <b>~${perShelf} بيضة/رف</b> ضمن <u>دفعة واحدة</u>.`;
    } else {
        hint.innerHTML = '';
    }
}

async function loadIncubatorShelf() {
    const startShelfNum = parseInt(document.getElementById('selectedShelfId').value);
    const type = document.getElementById('shelfLoadType').value;
    const dateStr = document.getElementById('shelfLoadDate').value; // مثلا: 2026-08-08T10:00
    const totalEggs = parseInt(document.getElementById('shelfLoadQty').value) || 0;
    
    if(!dateStr) return showToast("أدخل تاريخ الدخول", true);
    if(totalEggs <= 0) return showToast("الرجاء إدخال إجمالي عدد البيض!", true);

    toggleLoader(true, "جاري توزيع الأرفف والدمج الذكي...");

    try {
        const eggsSnap = await get(ref(db, "inventory/readyEggsStock"));
        const accumulatedGoodEggs = eggsSnap.exists() ? eggsSnap.val() : 0;

        if(totalEggs > accumulatedGoodEggs) {
            toggleLoader(false);
            return showToast(`رصيدك (${accumulatedGoodEggs}) غير كافٍ لهذه الدفعة!`, true);
        }

        const settingsSnap = await get(ref(db, "settings"));
        const ptoShelves = settingsSnap.exists() && settingsSnap.val().setIncShelves ? settingsSnap.val().setIncShelves : 12;

        const gridSnap = await get(ref(db, "incubatorGrid"));
        const incubatorShelves = gridSnap.exists() ? gridSnap.val() : {};

        let targetShelvesCount = 1;
        if (type === 'multi') {
            targetShelvesCount = parseInt(document.getElementById('multiShelfCount').value) || 1;
        } else if (type === 'full') {
            let empty = 0;
            for(let i = 1; i <= ptoShelves; i++) { if(!incubatorShelves[`shelf_${i}`]) empty++; }
            targetShelvesCount = empty;
        }

        if (targetShelvesCount <= 0) {
            toggleLoader(false);
            return showToast("لا يوجد أرفف مستهدفة!", true);
        }

        let emptyShelvesToFill = [];
        if (!incubatorShelves[`shelf_${startShelfNum}`]) emptyShelvesToFill.push(startShelfNum);

        for(let i = 1; i <= ptoShelves && emptyShelvesToFill.length < targetShelvesCount; i++) {
            if(i !== startShelfNum && !incubatorShelves[`shelf_${i}`]) emptyShelvesToFill.push(i);
        }

        if(emptyShelvesToFill.length < targetShelvesCount) {
            toggleLoader(false);
            return showToast(`الأرفف الفارغة لا تكفي! المطلوب (${targetShelvesCount}) والمتاح (${emptyShelvesToFill.length}) فقط.`, true);
        }

        // =========================================================
        // 💡 السحر هنا: البحث عن دفعة بنفس التاريخ لدمج الرفوف معها
        // =========================================================
        const dateOnly = dateStr.split('T')[0]; // استخراج التاريخ فقط (بدون الوقت)
        let existingBatchId = null;
        let existingInitialEggs = 0;

        // البحث في الدفعات الموجودة عن دفعة في المفرخ بنفس تاريخ اليوم
        for (const [id, b] of Object.entries(allBatches)) {
            if (b.status === 'incubator' && b.insertDate.startsWith(dateOnly)) {
                existingBatchId = id;
                existingInitialEggs = b.initialEggs || 0;
                break; // وجدنا دفعة بنفس اليوم، نتوقف عن البحث
            }
        }

        // إذا وجدنا دفعة نستخدم الـ ID بتاعها، لو مفيش نعمل ID جديد
        const batchIdToUse = existingBatchId || push(ref(db, 'batches')).key; 
        
        const perShelf = Math.floor(totalEggs / targetShelvesCount);
        const remainder = totalEggs % targetShelvesCount;
        let updates = {};

        emptyShelvesToFill.forEach((shelfNum, index) => {
            let qtyForThisShelf = perShelf + (index === 0 ? remainder : 0); 
            updates[`shelf_${shelfNum}`] = { 
                qty: qtyForThisShelf, 
                insertDate: dateStr,
                batchId: batchIdToUse // ربط الرف بـ ID الدفعة الموحدة
            };
        });

        // 1. تحديث شكل المكنة البصري وخصم البيض من الرصيد
        await update(ref(db, "incubatorGrid"), updates);
        await set(ref(db, "inventory/readyEggsStock"), accumulatedGoodEggs - totalEggs);

        // 2. تحديث الدفاتر (الدمج أو الإنشاء)
        if (existingBatchId) {
            // لو لقينا دفعة بنفس اليوم، هنزود عدد البيض بتاعها بس (دمج)
            await update(ref(db, `batches/${existingBatchId}`), {
                initialEggs: existingInitialEggs + totalEggs
            });
            showToast(`تم إضافة الرفوف ودمجها مع دفعة يوم ${dateOnly} 🚀`);
        } else {
            // لو مفيش، هنعمل دفعة جديدة خالص
            const std = birdStandards['quail']; 
            const insertD = new Date(dateStr);
            const hatcherD = new Date(insertD); hatcherD.setHours(insertD.getHours() + (std.hatcher * 24));
            const hatchD = new Date(insertD); hatchD.setHours(insertD.getHours() + (std.hatch * 24));
            const rearD = new Date(hatchD); rearD.setHours(hatchD.getHours() + (std.slaughter * 24));

            await set(ref(db, `batches/${batchIdToUse}`), { 
                name: 'دفعة ' + dateOnly, 
                birdType: 'quail', 
                insertDate:

async function emptyShelf(shelfNum) {
    if(confirm(`هل أنت متأكد من تفريغ الرف رقم ${shelfNum}؟`)) {
        try {
            await remove(ref(db, `incubatorGrid/shelf_${shelfNum}`));
            showToast("تم تفريغ الرف وهو جاهز الآن لدفعة جديدة.");
        } catch(error) {
            console.error(error);
            showToast("حدث خطأ أثناء التفريغ", true);
        }
    }
}
