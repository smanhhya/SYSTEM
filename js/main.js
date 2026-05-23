// js/main.js
import { initNavigation } from './ui.js';
import { initSettings } from './settings.js';
import { initBatches } from './batches.js'; // السطر الجديد
import { db } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSettings(); 
    initBatches(); // تهيئة ومراقبة الدفعات
    
    console.log("🚀 النظام جاهز وتم ربط إدارة الدفعات!");
});

import { openModal, closeModal } from './ui.js';
window.openModal = openModal;
window.closeModal = closeModal;
