// js/main.js
import { initNavigation } from './ui.js';
import { initSettings } from './settings.js'; // السطر الجديد
import { db } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSettings(); // تشغيل الإعدادات فور تحميل الصفحة
    
    console.log("🚀 النظام جاهز وتم تحميل الإعدادات!");
});

// إتاحة دوال المودال للواجهة
import { openModal, closeModal } from './ui.js';
window.openModal = openModal;
window.closeModal = closeModal;
