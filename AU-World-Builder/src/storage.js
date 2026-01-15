/**
 * AU World Builder - Storage Management
 */

import { getContext, extension_settings } from "../../../../extensions.js";
import { extensionName, METADATA_KEY, DATA_VERSION } from './constants.js';
import { log, logError, getSettings } from './state.js';

/**
 * Get the default AU data structure
 */
function getDefaultData() {
    return {
        version: DATA_VERSION,
        auConcept: '',
        worldSetting: '',
        characterSettings: {
            char: '',
            user: ''
        },
        clothingStyles: {
            char: '',
            user: ''
        },
        genrePrompt: '',
        generationHistory: [],
        lastUpdateIndex: -1,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

/**
 * Get chat metadata safely
 */
function getChatMetadata() {
    const context = getContext();
    if (!context.chat || !Array.isArray(context.chat) || context.chat.length === 0) {
        return null;
    }
    
    // Use first message for metadata storage
    const firstMsg = context.chat[0];
    if (!firstMsg.extra) {
        firstMsg.extra = {};
    }
    return firstMsg.extra;
}

/**
 * Get AU data from current chat
 */
export function getAUData() {
    const metadata = getChatMetadata();
    if (!metadata) {
        return getDefaultData();
    }
    
    if (!metadata[METADATA_KEY]) {
        metadata[METADATA_KEY] = getDefaultData();
    }
    
    // Migrate if needed
    migrateData(metadata[METADATA_KEY]);
    
    return metadata[METADATA_KEY];
}

/**
 * Save AU data to current chat
 */
export function saveAUData(data) {
    const metadata = getChatMetadata();
    if (!metadata) {
        logError('Cannot save AU data: No active chat');
        return false;
    }
    
    data.updatedAt = Date.now();
    metadata[METADATA_KEY] = data;
    
    // Trigger SillyTavern save
    const context = getContext();
    if (context.saveChat) {
        context.saveChat();
    }
    
    log('AU data saved');
    return true;
}

/**
 * Migrate data from older versions
 */
function migrateData(data) {
    if (!data.version || data.version < DATA_VERSION) {
        // Add missing fields
        if (!data.clothingStyles) {
            data.clothingStyles = { char: '', user: '' };
        }
        if (!data.genrePrompt) {
            data.genrePrompt = '';
        }
        if (!data.generationHistory) {
            data.generationHistory = [];
        }
        data.version = DATA_VERSION;
        log(`Data migrated to version ${DATA_VERSION}`);
    }
}

/**
 * Update world setting
 */
export function updateWorldSetting(content) {
    const data = getAUData();
    data.worldSetting = content;
    saveAUData(data);
}

/**
 * Update character settings
 */
export function updateCharacterSettings(charContent, userContent) {
    const data = getAUData();
    data.characterSettings.char = charContent;
    data.characterSettings.user = userContent;
    saveAUData(data);
}

/**
 * Update clothing styles
 */
export function updateClothingStyles(charStyle, userStyle) {
    const data = getAUData();
    data.clothingStyles.char = charStyle;
    data.clothingStyles.user = userStyle;
    saveAUData(data);
}

/**
 * Update genre prompt
 */
export function updateGenrePrompt(prompt) {
    const data = getAUData();
    data.genrePrompt = prompt;
    saveAUData(data);
}

/**
 * Clear all AU data
 */
export function clearAUData() {
    const metadata = getChatMetadata();
    if (metadata) {
        metadata[METADATA_KEY] = getDefaultData();
        const context = getContext();
        if (context.saveChat) {
            context.saveChat();
        }
        log('AU data cleared');
    }
}

/**
 * Export AU data as JSON string
 */
export function exportAUData() {
    const data = getAUData();
    return JSON.stringify(data, null, 2);
}

/**
 * Import AU data from JSON string
 */
export function importAUData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data && typeof data === 'object') {
            // Validate and merge with defaults
            const merged = { ...getDefaultData(), ...data };
            saveAUData(merged);
            return true;
        }
        return false;
    } catch (error) {
        logError('Failed to import AU data', error);
        return false;
    }
}

/**
 * Parse generated content into structured data
 */
export function parseGeneratedContent(content) {
    const result = {
        worldSetting: '',
        characterChar: '',
        characterUser: '',
        styleChar: '',
        styleUser: ''
    };
    
    try {
        // Parse sections using markers
        const worldMatch = content.match(/\[WORLD_SETTING\]([\s\S]*?)(?=\[CHARACTER_|$)/i);
        if (worldMatch) result.worldSetting = worldMatch[1].trim();
        
        const charMatch = content.match(/\[CHARACTER_CHAR\]([\s\S]*?)(?=\[CHARACTER_USER\]|\[STYLE_|\[|$)/i);
        if (charMatch) result.characterChar = charMatch[1].trim();
        
        const userMatch = content.match(/\[CHARACTER_USER\]([\s\S]*?)(?=\[STYLE_|\[|$)/i);
        if (userMatch) result.characterUser = userMatch[1].trim();
        
        const styleCharMatch = content.match(/\[STYLE_CHAR\]([\s\S]*?)(?=\[STYLE_USER\]|\[|$)/i);
        if (styleCharMatch) result.styleChar = styleCharMatch[1].trim();
        
        const styleUserMatch = content.match(/\[STYLE_USER\]([\s\S]*?)(?=\[|$)/i);
        if (styleUserMatch) result.styleUser = styleUserMatch[1].trim();
        
    } catch (error) {
        logError('Failed to parse generated content', error);
    }
    
    return result;
}

/**
 * Save all parsed content
 */
export function saveAllParsedContent(parsed, concept = '') {
    const data = getAUData();
    
    if (concept) data.auConcept = concept;
    if (parsed.worldSetting) data.worldSetting = parsed.worldSetting;
    if (parsed.characterChar) data.characterSettings.char = parsed.characterChar;
    if (parsed.characterUser) data.characterSettings.user = parsed.characterUser;
    if (parsed.styleChar) data.clothingStyles.char = parsed.styleChar;
    if (parsed.styleUser) data.clothingStyles.user = parsed.styleUser;
    
    // Add to history
    data.generationHistory.push({
        timestamp: Date.now(),
        concept: concept,
        type: 'full_generation'
    });
    
    saveAUData(data);
}

/**
 * Get character profile information
 */
export function getCharacterProfile() {
    const context = getContext();
    const char = context.characters?.[context.characterId];
    
    return {
        name: char?.name || 'Character',
        description: char?.description || '',
        personality: char?.personality || '',
        scenario: char?.scenario || '',
        firstMessage: char?.first_mes || '',
        userName: context.name1 || 'User',
        userPersona: context.persona || ''
    };
}

/**
 * Get character name
 */
export function getCharacterName() {
    const context = getContext();
    const char = context.characters?.[context.characterId];
    return char?.name || 'Character';
}

/**
 * Get user name
 */
export function getUserName() {
    const context = getContext();
    return context.name1 || 'User';
}

/**
 * Get chat messages
 */
export function getChatMessages(startIndex = 0, endIndex = -1) {
    const context = getContext();
    if (!context.chat || !Array.isArray(context.chat)) {
        return [];
    }
    
    const end = endIndex < 0 ? context.chat.length : endIndex + 1;
    return context.chat.slice(startIndex, end).map(msg => ({
        role: msg.is_user ? 'user' : (msg.is_system ? 'system' : 'assistant'),
        content: msg.mes || '',
        name: msg.name || ''
    }));
}

/**
 * Get chat length
 */
export function getChatLength() {
    const context = getContext();
    return context.chat?.length || 0;
}

/**
 * Update last update index
 */
export function updateLastUpdateIndex(index) {
    const data = getAUData();
    data.lastUpdateIndex = index;
    saveAUData(data);
}