// js/main.js
import { initNavigation, initOfflineSupport, toggleFab } from './ui.js';
import { initSettings } from './settings.js';
import { initBatches } from './batches.js';
import { initFinance } from './finance.js';
import { initFreezer } from './freezer.js';
import { initReports } from './reports.js';

document.addEventListener('DOMContentLoaded', () => {
    // إخفاء شاشة الدخول فوراً لو كانت موجودة في الـ HTML
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';

    // تشغيل كل أجزاء النظام مباشرة
    initNavigation();
    initOfflineSupport();
    initSettings(); 
    initBatches(); 
    initFinance(); 
    initFreezer();
    initReports();
    
    console.log("🚀 النظام شغال مباشر الآن بدون تسجيل دخول!");
});

// إتاحة الدوال للواجهة
import { openModal, closeModal } from './ui.js';
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleFab = toggleFab;
