/**
 * AU World Builder - State Management
 */

import { extension_settings } from "../../../../extensions.js";
import { extensionName, defaultSettings } from './constants.js';

/**
 * Global state object
 */
export const state = {
    isGenerating: false,
    lastError: null,
    chatLoadingCooldown: false,
    processingMessageIndex: -1
};

/**
 * Log with prefix
 */
export function log(...args) {
    const settings = getSettings();
    if (settings?.debugMode) {
        console.log('[AU-World-Builder]', ...args);
    }
}

/**
 * Log error with prefix
 */
export function logError(message, error = null) {
    console.error('[AU-World-Builder]', message, error || '');
    state.lastError = { message, error, timestamp: Date.now() };
}

/**
 * Get extension settings
 */
export function getSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = { ...defaultSettings };
    }
    return extension_settings[extensionName];
}

/**
 * Set chat loading cooldown
 */
export function setChatLoadingCooldown(value) {
    state.chatLoadingCooldown = value;
    if (value) {
        setTimeout(() => {
            state.chatLoadingCooldown = false;
        }, 2000);
    }
}

/**
 * Check if currently processing
 */
export function isCurrentlyProcessing() {
    return state.isGenerating || state.chatLoadingCooldown;
}

/**
 * Set processing state
 */
export function setProcessing(value) {
    state.isGenerating = value;
}

/**
 * Get last error
 */
export function getLastError() {
    return state.lastError;
}

/**
 * Clear last error
 */
export function clearLastError() {
    state.lastError = null;
}