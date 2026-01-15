/**
 * AU World Builder - Content Generator
 */

import { extensionName, defaultSettings, PROMPTS } from './constants.js';
import { log, state, getSettings, logError } from './state.js';
import {
    getAUData,
    saveAUData,
    parseGeneratedContent,
    saveAllParsedContent,
    getChatMessages,
    getCharacterProfile,
    updateAUConcept,
    updateLastUpdateIndex,
    getChatLength
} from './storage.js';
import { callAPI } from './api.js';
import { injectAUContent } from './injection.js';

export async function generateAUWorld(concept) {
    if (state.isGenerating) {
        return { success: false, error: "Generation already in progress" };
    }

    state.isGenerating = true;

    try {
        log("Starting AU world generation with concept: " + concept);

        const charProfile = getCharacterProfile();
        if (!charProfile) {
            throw new Error("No character selected");
        }

        updateAUConcept(concept);

        const prompt = buildInitialPrompt(charProfile, concept);
        const result = await callAPI(prompt);
        
        if (!result) {
            throw new Error("Empty response from API");
        }

        const parsed = parseGeneratedContent(result);
        saveAllParsedContent(parsed);
        updateLastUpdateIndex(getChatLength() - 1);
        injectAUContent();

        log("AU world generation completed");
        return { success: true, data: getAUData() };

    } catch (error) {
        logError('generateAUWorld', error);
        return { success: false, error: error.message };
    } finally {
        state.isGenerating = false;
    }
}

export async function updateAUWorld(start, end) {
    if (state.isGenerating) {
        return { success: false, error: "Generation already in progress" };
    }

    state.isGenerating = true;

    try {
        log(`Updating AU world from message ${start} to ${end}`);

        const charProfile = getCharacterProfile();
        const currentData = getAUData();
        const messages = getChatMessages(start, end);

        if (messages.length === 0) {
            throw new Error("No messages in the specified range");
        }

        const prompt = buildUpdatePrompt(charProfile, currentData, messages, start, end);
        const result = await callAPI(prompt);
        
        if (!result) {
            throw new Error("Empty response from API");
        }

        const parsed = parseGeneratedContent(result);
        saveAllParsedContent(parsed);
        updateLastUpdateIndex(end);
        injectAUContent();

        log("AU world update completed");
        return { success: true, data: getAUData() };

    } catch (error) {
        logError('updateAUWorld', error);
        return { success: false, error: error.message };
    } finally {
        state.isGenerating = false;
    }
}

export async function generateGenrePrompt() {
    if (state.isGenerating) {
        return { success: false, error: "Generation already in progress" };
    }

    state.isGenerating = true;

    try {
        log("Generating genre/tone prompt");

        const currentData = getAUData();
        
        if (!currentData.worldSetting) {
            throw new Error("Please generate world setting first");
        }

        const prompt = PROMPTS.GENRE
            .replace("{{WORLD_SETTING}}", currentData.worldSetting || "")
            .replace("{{AU_CONCEPT}}", currentData.auConcept || "");
        
        const result = await callAPI(prompt);
        
        if (!result) {
            throw new Error("Empty response from API");
        }

        const data = getAUData();
        data.genrePrompt = result.trim();
        saveAUData(data);

        log("Genre prompt generation completed");
        return { success: true, data: getAUData() };

    } catch (error) {
        logError('generateGenrePrompt', error);
        return { success: false, error: error.message };
    } finally {
        state.isGenerating = false;
    }
}

export async function generateAUContent(type = 'initial', options = {}) {
    switch (type) {
        case 'initial':
            return await generateAUWorld(options.concept || getAUData()?.auConcept || "");
        case 'update':
            const range = options.messageRange || { start: 0, end: getChatLength() - 1 };
            return await updateAUWorld(range.start, range.end);
        case 'genre':
            return await generateGenrePrompt();
        default:
            return { success: false, error: "Unknown generation type: " + type };
    }
}

function buildInitialPrompt(charProfile, concept) {
    let prompt = PROMPTS.INITIAL;
    
    prompt = `## Character Information
Name: ${charProfile.name}
Description: ${charProfile.description || 'No description provided'}
Personality: ${charProfile.personality || 'No personality provided'}
Scenario: ${charProfile.scenario || 'No scenario provided'}

## User Information
Name: ${charProfile.userName}
Persona: ${charProfile.userPersona || 'No persona provided'}

## AU Concept
${concept}

` + prompt;

    return prompt;
}

function buildUpdatePrompt(charProfile, currentData, messages, start, end) {
    const messagesText = messages.map(m => {
        const name = m.is_user ? charProfile.userName : charProfile.name;
        return `[${name}]: ${m.mes}`;
    }).join("\n\n");

    return PROMPTS.UPDATE
        .replace("{{CURRENT_WORLD}}", currentData.worldSetting || "Not generated yet")
        .replace("{{CURRENT_CHARACTERS}}", 
            (currentData.characterSettings?.char || "") + "\n" + 
            (currentData.characterSettings?.user || "") || "Not generated yet")
        .replace("{{START}}", String(start))
        .replace("{{END}}", String(end))
        .replace("{{STORY_CONTENT}}", messagesText);
}

export function isGenerating() {
    return state.isGenerating;
}