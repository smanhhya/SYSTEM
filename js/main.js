// js/main.js
import { initNavigation } from './ui.js';
import { initSettings } from './settings.js';
import { initBatches } from './batches.js';
import { initFinance } from './finance.js';
import { initFreezer } from './freezer.js'; // السطر الجديد
import { db } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSettings(); 
    initBatches(); 
    initFinance(); 
    initFreezer(); // تشغيل الفريزر ونظام المخزون الذكي
    
    console.log("🚀 نظام المخزون (الفريزر) تم ربطه بنجاح بتنفيذ FIFO!");
});

import { openModal, closeModal } from './ui.js';
window.openModal = openModal;
window.closeModal = closeModal;
