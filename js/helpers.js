// js/helpers.js
import { showToast } from './ui.js';

// منع القيم السالبة والنصوص
export function validateNumber(value, fieldName) {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
        showToast(`قيمة غير صحيحة في حقل: ${fieldName}. يجب أن تكون رقماً أكبر من أو يساوي صفر.`, true);
        return null;
    }
    return num;
}

// منع الإدخال الفارغ
export function validateString(value, fieldName) {
    if (!value || value.trim() === '') {
        showToast(`حقل ${fieldName} مطلوب ولا يمكن تركه فارغاً.`, true);
        return null;
    }
    return value.trim();
}

// منع بيع كمية أكبر من المخزون
export function validateStock(requestedQty, availableStock) {
    if (requestedQty > availableStock) {
        showToast(`لا يوجد رصيد كافي! المتاح: ${availableStock}`, true);
        return false;
    }
    return true;
}

// التحقق من تكرار اسم الدفعة
export function isBatchNameUnique(newName, existingBatches) {
    for (const key in existingBatches) {
        if (existingBatches[key].name === newName) {
            showToast(`اسم الدفعة "${newName}" مستخدم بالفعل، يرجى اختيار اسم آخر.`, true);
            return false;
        }
    }
    return true;
}
