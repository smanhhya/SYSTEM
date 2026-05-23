// js/main.js
import { initNavigation, initOfflineSupport, toggleFab } from './ui.js';
import { initSettings } from './settings.js';
import { initBatches } from './batches.js';
import { initFinance } from './finance.js';
import { initFreezer } from './freezer.js';
import { initReports } from './reports.js';

document.addEventListener('DOMContentLoaded', () => {
    // تشغيل كل أجزاء النظام مباشرة
    initNavigation();
    initSettings(); 
    initBatches(); 
    initFinance(); 
    initFreezer();
    initReports();
    initOfflineSupport();
    
    console.log("🚀 النظام شغال مباشر الآن!");
});

// إتاحة الدوال للواجهة
import { openModal, closeModal } from './ui.js';
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleFab = toggleFab;
