// js/settings.js
import { db, ref, set, onValue } from './firebase.js';
import { showToast, toggleLoader } from './ui.js';
import { validateNumber } from './helpers.js';

// 1. المعايير الثابتة للطيور (تُستخدم في حساب التواريخ تلقائياً)
export const birdStandards = {
    quail: { name: 'سمان', hatcher: 15, hatch: 18, slaughter: 35 },
    chicken: { name: 'فراخ بيضاء', hatcher: 18, hatch: 21, slaughter: 40 },
    turkey: { name: 'رومي', hatcher: 25, hatch: 28, slaughter: 90 }
};

// 2. أسماء تصنيفات البيع
export const gradeNames = {
    royal: 'رويال', super_special: 'سوبر سبشيال', special: 'سبشيال', 
    jumbo: 'جامبو', super: 'سوبر', bad: 'كسر/فرز'
};

// 3. كائن الإعدادات الافتراضية (سيتحدث من قاعدة البيانات)
export let globalSettings = {
    birdType: 'quail', feedPrice: 30,
    royal: 120, super_special: 110, special: 100,
    jumbo: 90, super: 80, bad: 0
};

// 4. دالة تهيئة الإعدادات (تُستدعى عند بدء النظام)
export function initSettings() {
    // الاستماع لتغييرات قاعدة البيانات لحظياً
    onValue(ref(db, "settings"), (snapshot) => {
        if (snapshot.exists()) {
            globalSettings = { ...globalSettings, ...snapshot.val() };
            updateSettingsUI();
        }
    });

    // ربط زر "حفظ الإعدادات" في HTML بهذه الدالة
    window.saveSettings = saveSettingsForm;
}

// 5. تحديث الحقول في صفحة الإعدادات لتطابق قاعدة البيانات
function updateSettingsUI() {
    // نتأكد إننا في صفحة الإعدادات والعناصر موجودة لتجنب أخطاء الكونسول
    if (document.getElementById('setBirdType')) {
        document.getElementById('setBirdType').value = globalSettings.birdType || 'quail';
        document.getElementById('setFeed').value = globalSettings.feedPrice;
        document.getElementById('setRoyal').value = globalSettings.royal;
        document.getElementById('setSuperSpecial').value = globalSettings.super_special;
        document.getElementById('setSpecial').value = globalSettings.special;
        document.getElementById('setJumbo').value = globalSettings.jumbo;
        document.getElementById('setSuper').value = globalSettings.super;
    }
}

// 6. دالة حفظ الإعدادات الجديدة (مدمجة مع الـ Validation والـ Loader)
async function saveSettingsForm() {
    // نستخدم الـ helpers للتحقق من الأرقام ومنع القيم السالبة أو الفارغة
    const feedPrice = validateNumber(document.getElementById('setFeed').value, 'سعر العلف');
    const royal = validateNumber(document.getElementById('setRoyal').value, 'سعر رويال');
    const superSpecial = validateNumber(document.getElementById('setSuperSpecial').value, 'سعر سوبر سبشيال');
    
    // إذا كان هناك خطأ في الإدخال، نتوقف ولا نكمل الحفظ
    if (feedPrice === null || royal === null || superSpecial === null) return;

    toggleLoader(true, "جاري حفظ وتحديث الإعدادات...");

    const newSet = {
        birdType: document.getElementById('setBirdType').value,
        feedPrice: feedPrice,
        royal: royal,
        super_special: superSpecial,
        special: validateNumber(document.getElementById('setSpecial').value, 'سعر سبشيال') || 0,
        jumbo: validateNumber(document.getElementById('setJumbo').value, 'سعر جامبو') || 0,
        super: validateNumber(document.getElementById('setSuper').value, 'سعر سوبر') || 0,
        bad: 0
    };

    try {
        await set(ref(db, 'settings'), newSet);
        showToast("تم تحديث الإعدادات والأسعار بنجاح");
    } catch (error) {
        showToast("حدث خطأ أثناء الحفظ تأكد من الاتصال بالإنترنت", true);
        console.error("Settings Save Error:", error);
    } finally {
        toggleLoader(false); // إخفاء شاشة التحميل في كل الحالات
    }
}
