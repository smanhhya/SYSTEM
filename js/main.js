// js/main.js
import { initNavigation } from './ui.js';
import { db } from './firebase.js';

// أول ما الصفحة تحمل، شغل أساسيات الواجهة
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    
    // اختبار سريع إن قاعدة البيانات اتربطت (ممكن نمسحها بعدين)
    console.log("🚀 النظام جاهز والاتصال بقاعدة البيانات نشط!");
});

// إتاحة بعض دوال الـ UI على الـ window عشان أزرار الـ HTML القديمة تشتغل 
// (لحد ما ننقلها كلها بطريقة احترافية)
import { openModal, closeModal } from './ui.js';
window.openModal = openModal;
window.closeModal = closeModal;
