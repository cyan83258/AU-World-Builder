/**
 * AU World Builder - Prompt Injection
 */

import { setExtensionPrompt, extension_prompt_roles, extension_prompt_types } from "../../../../extensions.js";
import { extensionName, INJECTION_POSITION } from './constants.js';
import { log, getSettings, state } from './state.js';
import { getAUData } from './storage.js';

const INJECTION_PREFIX = extensionName + "_";

function buildInjectionPrompt(data) {
    const parts = [];

    if (data.worldSetting) {
        parts.push("[AU World Setting]");
        parts.push(data.worldSetting.trim());
        parts.push("");
    }

    if (data.characterSettings?.char || data.characterSettings?.user) {
        parts.push("[Character Profiles]");
        if (data.characterSettings.char) {
            parts.push("{{char}}:");
            parts.push(data.characterSettings.char.trim());
            parts.push("");
        }
        if (data.characterSettings.user) {
            parts.push("{{user}}:");
            parts.push(data.characterSettings.user.trim());
            parts.push("");
        }
    }

    if (data.clothingStyles?.char || data.clothingStyles?.user) {
        parts.push("[Clothing Styles]");
        if (data.clothingStyles.char) {
            parts.push("{{char}}'s style:");
            parts.push(data.clothingStyles.char.trim());
            parts.push("");
        }
        if (data.clothingStyles.user) {
            parts.push("{{user}}'s style:");
            parts.push(data.clothingStyles.user.trim());
            parts.push("");
        }
    }

    const settings = getSettings();
    if (settings.genrePromptEnabled && data.genrePrompt) {
        parts.push("[Genre & Tone]");
        parts.push(data.genrePrompt.trim());
        parts.push("");
    }

    return parts.join("\n").trim();
}

export function injectAUContent() {
    const settings = getSettings();
    
    if (!settings.enabled) {
        removeInjection();
        return;
    }

    const data = getAUData();

    if (!data || (!data.worldSetting && !data.characterSettings?.char && !data.characterSettings?.user)) {
        removeInjection();
        return;
    }

    const prompt = buildInjectionPrompt(data);

    if (!prompt) {
        removeInjection();
        return;
    }

    const position = settings.injectionPosition || INJECTION_POSITION.IN_CHAT;
    const depth = settings.injectionDepth || 2;
    const role = settings.injectionRole || 0;

    removeInjection();

    try {
        setExtensionPrompt(
            INJECTION_PREFIX + "au_content",
            prompt,
            position,
            depth,
            settings.scanDepth !== false,
            role
        );
        log("AU content injected at position " + position + ", depth " + depth);
    } catch (error) {
        log("Injection error: " + error.message);
    }
}

export function injectAUToPrompt() {
    return injectAUContent();
}

export function removeInjection() {
    try {
        setExtensionPrompt(INJECTION_PREFIX + "au_content", "", 0, 0);
    } catch (error) {
        // Ignore
    }
}

export function getInjectionPositions() {
    return [
        { value: INJECTION_POSITION.IN_CHAT, label: "In-Chat (@ depth)" },
        { value: INJECTION_POSITION.BEFORE_MAIN, label: "Before Main Prompt" },
        { value: INJECTION_POSITION.AFTER_MAIN, label: "After Main Prompt" }
    ];
}

export function getInjectionStatus() {
    const data = getAUData();
    const hasContent = data && (data.worldSetting || data.characterSettings?.char || data.characterSettings?.user);

    return {
        active: hasContent,
        contentSections: {
            world: !!data?.worldSetting,
            characters: !!(data?.characterSettings?.char || data?.characterSettings?.user),
            genre: !!data?.genrePrompt
        }
    };
}

export function getInjectionPreview() {
    const data = getAUData();
    if (!data) {
        return "No AU data available.";
    }
    return buildInjectionPrompt(data) || "No content to inject.";
}