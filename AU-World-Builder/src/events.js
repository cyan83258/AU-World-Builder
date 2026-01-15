/**
 * AU World Builder - Event Handlers
 */

import { eventSource, event_types } from "../../../../../script.js";
import { log, getSettings, isCurrentlyProcessing, state } from './state.js';
import { getAUData } from './storage.js';
import { injectAUContent, removeInjection } from './injection.js';

let messageCountSinceLastUpdate = 0;
let statusUpdateCallback = null;

export function setStatusUpdateCallback(callback) {
    statusUpdateCallback = callback;
}

export function registerEventListeners() {
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.MESSAGE_SENT, onMessageSent);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
    log("Event listeners initialized");
}

async function onChatChanged() {
    log("Chat changed, loading AU data");
    messageCountSinceLastUpdate = 0;

    const data = getAUData();
    if (data && (data.worldSetting || data.characterSettings?.char || data.characterSettings?.user)) {
        injectAUContent();
    } else {
        removeInjection();
    }

    if (typeof window.auWorldBuilderUIRefresh === 'function') {
        window.auWorldBuilderUIRefresh();
    }
    
    if (statusUpdateCallback) {
        statusUpdateCallback();
    }
}

function onMessageReceived() {
    messageCountSinceLastUpdate++;
    checkAutoUpdate();
}

function onMessageSent() {
    messageCountSinceLastUpdate++;
    checkAutoUpdate();
}

function onCharacterMessageRendered() {
    // Could trigger additional processing
}

function checkAutoUpdate() {
    const settings = getSettings();

    if (!settings.autoUpdateEnabled) {
        return;
    }

    const interval = settings.autoUpdateInterval || 10;

    if (messageCountSinceLastUpdate >= interval) {
        log("Auto-update triggered after " + messageCountSinceLastUpdate + " messages");
        triggerAutoUpdate();
        messageCountSinceLastUpdate = 0;
    }
}

async function triggerAutoUpdate() {
    if (state.isGenerating) {
        log("Auto-update skipped - generation in progress");
        return;
    }

    try {
        const { generateAUContent } = await import('./generator.js');
        const settings = getSettings();
        const updateRange = settings.autoUpdateRange || 20;

        await generateAUContent('update', {
            messageRange: { start: -updateRange, end: -1 }
        });

        log("Auto-update completed");
    } catch (error) {
        log("Auto-update failed: " + error.message);
    }
}

export function getMessageCount() {
    return messageCountSinceLastUpdate;
}

export function resetMessageCounter() {
    messageCountSinceLastUpdate = 0;
}