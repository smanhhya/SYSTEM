// js/main.js
import { initNavigation } from './ui.js';
import { initSettings } from './settings.js';
import { initBatches } from './batches.js';
import { initFinance } from './finance.js'; // السطر الجديد
import { db } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSettings(); 
    initBatches(); 
    initFinance(); // تهيئة دفتر الحسابات والتسجيل اليومي
    
    console.log("🚀 النظام المالي جاهز ويعمل بكفاءة!");
});

import { openModal, closeModal } from './ui.js';
window.openModal = openModal;
window.closeModal = closeModal;
