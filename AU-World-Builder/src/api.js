/**
 * AU World Builder - API Communication
 */

import { extension_settings } from "../../../../extensions.js";
import { main_api, generateQuietPrompt, generateRaw } from "../../../../../script.js";
import { extensionName, API_SOURCE } from './constants.js';
import { log, getSettings, logError } from './state.js';

let ConnectionManagerRequestService = null;

async function loadConnectionManager() {
    if (ConnectionManagerRequestService) return true;

    try {
        const shared = await import("../../../../shared.js");
        ConnectionManagerRequestService = shared.ConnectionManagerRequestService;
        log('ConnectionManagerRequestService loaded');
        return true;
    } catch (error) {
        log('ConnectionManagerRequestService not available: ' + error.message);
        return false;
    }
}

export async function callAPI(prompt) {
    const settings = getSettings();

    if (settings.apiSource === API_SOURCE.CUSTOM) {
        return await callCustomAPI(prompt);
    } else {
        if (settings.stConnectionProfile) {
            return await callConnectionManagerAPI(prompt);
        }
        return await callSillyTavernAPI(prompt);
    }
}

async function callConnectionManagerAPI(prompt) {
    const settings = getSettings();

    const loaded = await loadConnectionManager();
    if (!loaded || !ConnectionManagerRequestService) {
        log('ConnectionManager not available, falling back to default API');
        return await callSillyTavernAPI(prompt);
    }

    const profileId = settings.stConnectionProfile;
    const profiles = extension_settings?.connectionManager?.profiles || [];
    const profile = profiles.find(p => p.id === profileId);

    if (!profile) {
        log('Profile ' + profileId + ' not found, falling back to default API');
        return await callSillyTavernAPI(prompt);
    }

    try {
        const maxTokens = settings.customApiMaxTokens || 4000;
        log('Using ConnectionManager profile: ' + profile.name);

        const messages = [
            { role: 'system', content: 'You are a creative worldbuilding assistant. Follow the output format exactly as specified.' },
            { role: 'user', content: prompt }
        ];

        const result = await ConnectionManagerRequestService.sendRequest(
            profileId, messages, maxTokens,
            { includePreset: true, includeInstruct: true, stream: false }, {}
        );

        const content = result?.content || result || '';
        if (!content) throw new Error('Empty response from ConnectionManager');
        return content;
    } catch (error) {
        log('ConnectionManager API error: ' + error.message);
        throw error;
    }
}

async function callSillyTavernAPI(prompt) {
    try {
        let result;

        if (typeof generateRaw === 'function') {
            result = await generateRaw({
                prompt: prompt,
                maxContext: null,
                quietToLoud: false,
                skipWIAN: true,
                skipAN: true,
                quietImage: null,
                quietName: null
            });
        } else if (typeof generateQuietPrompt === 'function') {
            result = await generateQuietPrompt(prompt, false, false);
        } else {
            throw new Error("SillyTavern API function not found");
        }

        return result || '';
    } catch (error) {
        log('SillyTavern API error: ' + error.message);
        logError('callSillyTavernAPI', error);
        throw error;
    }
}

async function callCustomAPI(prompt) {
    const settings = getSettings();

    if (!settings.customApiUrl || !settings.customApiModel) {
        throw new Error("Custom API settings are required");
    }

    const headers = { "Content-Type": "application/json" };
    if (settings.customApiKey) {
        headers["Authorization"] = "Bearer " + settings.customApiKey;
    }

    try {
        const controller = new AbortController();
        const timeout = (settings.customApiTimeout || 120) * 1000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const maxTokens = settings.customApiMaxTokens || 4000;
        const model = settings.customApiModel.toLowerCase();

        const useMaxCompletionTokens = /^(o1|o3|gpt-4o-2024-1[12])/.test(model) ||
                                       model.includes('o1-') || model.includes('o3-');

        const requestBody = {
            model: settings.customApiModel,
            messages: [
                { role: 'system', content: 'You are a creative worldbuilding assistant. Follow the output format exactly as specified.' },
                { role: "user", content: prompt }
            ],
            temperature: 0.7
        };

        if (useMaxCompletionTokens) {
            requestBody.max_completion_tokens = maxTokens;
        } else {
            requestBody.max_tokens = maxTokens;
        }

        const response = await fetch(settings.customApiUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error("HTTP " + response.status + ": " + response.statusText);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || data.content || "";
    } catch (error) {
        log('Custom API error: ' + error.message);
        logError('callCustomAPI', error);
        throw error;
    }
}

export async function loadModels() {
    const settings = getSettings();
    const url = settings.customApiUrl;
    const key = settings.customApiKey;

    if (!url) throw new Error("API URL is required");

    const modelsUrl = url.replace(/\/chat\/completions\/?$/, "/models");
    const headers = {};
    if (key) headers["Authorization"] = "Bearer " + key;

    const response = await fetch(modelsUrl, { headers });
    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    const models = data.data || data.models || [];
    return models.map(model => model.id || model.name || model);
}

export async function testApiConnection() {
    try {
        const result = await callAPI("Test message. Please respond with 'Connection successful'.");
        return !!result;
    } catch (error) {
        log('API test failed: ' + error.message);
        throw error;
    }
}

export function getApiStatus() {
    const settings = getSettings();

    if (settings.apiSource === API_SOURCE.SILLYTAVERN) {
        if (settings.stConnectionProfile) {
            const profiles = extension_settings?.connectionManager?.profiles || [];
            const profile = profiles.find(p => p.id === settings.stConnectionProfile);

            if (profile) {
                return {
                    source: "sillytavern",
                    connected: true,
                    displayName: "Profile: " + profile.name,
                    profileId: profile.id
                };
            }
        }

        const apiName = main_api || "Not connected";
        const displayNames = {
            "openai": "OpenAI",
            "textgenerationwebui": "Text Generation WebUI",
            "kobold": "KoboldAI",
            "novel": "NovelAI",
            "claude": "Claude",
            "palm": "PaLM",
            "openrouter": "OpenRouter"
        };

        return {
            source: "sillytavern",
            connected: !!main_api,
            displayName: displayNames[apiName] || apiName
        };
    } else {
        const hasConfig = settings.customApiUrl && settings.customApiModel;
        let displayName = settings.customApiModel || "Configuration needed";
        if (settings.selectedPreset) {
            displayName = settings.selectedPreset + " (" + settings.customApiModel + ")";
        }

        return {
            source: "custom",
            connected: hasConfig,
            displayName: displayName,
            url: settings.customApiUrl
        };
    }
}

export function getConnectionProfiles() {
    try {
        return extension_settings?.connectionManager?.profiles || [];
    } catch (error) {
        return [];
    }
}