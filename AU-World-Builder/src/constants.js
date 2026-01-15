/**
 * AU World Builder - Constants and Default Settings
 */

// Extension basic info
export const extensionName = "au-world-builder";

// Extension folder path detection
function detectExtensionPath() {
    try {
        const scripts = document.querySelectorAll('script[src*="au-world-builder"], script[src*="AU-World-Builder"]');
        for (const script of scripts) {
            const src = script.src;
            const match = src.match(/(.+?(?:au-world-builder|AU-World-Builder))/i);
            if (match) {
                const url = new URL(match[1]);
                return url.pathname.replace(/^\//, '');
            }
        }
    } catch (e) {
        console.warn('[au-world-builder] Script path detection failed:', e);
    }

    try {
        if (typeof import.meta !== 'undefined' && import.meta.url) {
            const url = new URL(import.meta.url);
            const pathParts = url.pathname.split('/');
            const extIndex = pathParts.findIndex(p =>
                p.toLowerCase() === 'au-world-builder' || p === 'AU-World-Builder'
            );
            if (extIndex !== -1) {
                return pathParts.slice(1, extIndex + 1).join('/');
            }
        }
    } catch (e) {
        console.warn('[au-world-builder] import.meta.url detection failed:', e);
    }

    return `scripts/extensions/third-party/${extensionName}`;
}

export const extensionFolderPath = detectExtensionPath();
export const METADATA_KEY = "au_world_builder";
export const DATA_VERSION = 1;

// API source types
export const API_SOURCE = {
    SILLYTAVERN: "sillytavern",
    CUSTOM: "custom"
};

// Injection position constants
export const INJECTION_POSITION = {
    IN_CHAT: 1,
    BEFORE_MAIN: 0,
    AFTER_MAIN: 2
};

// Default settings
export const defaultSettings = {
    enabled: true,
    autoUpdateEnabled: false,
    autoUpdateInterval: 5,
    genrePromptEnabled: false,
    genrePromptText: "",
    injectionPosition: 1,
    injectionDepth: 2,
    injectionRole: 0,
    scanDepth: true,
    apiSource: API_SOURCE.SILLYTAVERN,
    stConnectionProfile: "",
    customApiUrl: "",
    customApiKey: "",
    customApiModel: "",
    customApiMaxTokens: 4000,
    customApiTimeout: 120,
    apiPresets: [],
    selectedPreset: "",
    debugMode: false
};

// World generation prompt template
export const WORLD_GENERATION_PROMPT = `You are a creative worldbuilding assistant. Based on the provided character profiles and the user's AU (Alternate Universe) concept, create a detailed world setting and adapted character profiles.

## Your Task
1. Create a cohesive world setting (Overview) based on the AU concept provided
2. Adapt the existing character profiles to fit this new world
3. Design appropriate clothing styles for each character that match the world setting

## Output Format (CRITICAL - Follow Exactly)
You MUST output in this exact format with these exact headers. All content must be in English.
Each section content should be 2 paragraphs.

---
#World Setting
(Write 2 paragraphs describing the world overview, including history, society, atmosphere, and key elements of this AU)

---
#Character Settings
##{{char}}
(Write 2 paragraphs about {{char}}'s adapted background, role, and personality in this AU world)

##{{user}}
(Write 2 paragraphs about {{user}}'s adapted background, role, and personality in this AU world)

#Character Clothing Styles
##{{char}}'s style
(Write 2 paragraphs describing {{char}}'s typical clothing and aesthetic in this AU)

##{{user}}'s style
(Write 2 paragraphs describing {{user}}'s typical clothing and aesthetic in this AU)

## Rules
1. All output MUST be in English
2. Each section MUST contain exactly 2 paragraphs
3. Maintain character personalities while adapting them to the new setting
4. Make the world feel cohesive and internally consistent
5. Clothing styles should reflect both the world setting and character personalities`;

// Update prompt template
export const UPDATE_PROMPT = `You are a creative worldbuilding assistant. Based on the recent story developments, update the world setting and character profiles to reflect any changes or new information revealed.

## Current World Setting
{{CURRENT_WORLD}}

## Current Character Settings
{{CURRENT_CHARACTERS}}

## Recent Story Content (Messages #{{START}} - #{{END}})
{{STORY_CONTENT}}

## Your Task
Review the recent story content and update the world setting and character profiles if there are any significant developments, revelations, or changes. If no significant changes occurred, maintain the existing content with minor refinements if needed.

## Output Format (CRITICAL - Follow Exactly)
Output in this exact format with these exact headers. All content must be in English.
Each section content should be 2 paragraphs.

---
#World Setting
(Write 2 paragraphs with updated world overview)

---
#Character Settings
##{{char}}
(Write 2 paragraphs about {{char}}'s updated profile)

##{{user}}
(Write 2 paragraphs about {{user}}'s updated profile)

#Character Clothing Styles
##{{char}}'s style
(Write 2 paragraphs describing {{char}}'s current clothing style)

##{{user}}'s style
(Write 2 paragraphs describing {{user}}'s current clothing style)

## Rules
1. All output MUST be in English
2. Each section MUST contain exactly 2 paragraphs
3. Preserve established facts while incorporating new developments
4. Only make changes if the story clearly indicates them`;

// Genre/Tone generation prompt
export const GENRE_TONE_PROMPT = `Based on the following AU world setting, generate an appropriate genre and tone instruction prompt that should be used when writing stories in this world.

## World Setting
{{WORLD_SETTING}}

## AU Concept
{{AU_CONCEPT}}

## Your Task
Generate a single-line prompt that describes the appropriate genre(s) and tone(s) for this AU world. This will be injected into the story generation to maintain consistent style.

## Output Format
Output ONLY a single line in this format:
Write in [genre1], [genre2], [genre3] genre. Maintain [adjective1], [adjective2] tone.

Example outputs:
- Write in noir, hard-boiled, romance genre. Maintain dark, melancholic tone.
- Write in fantasy, adventure, slice-of-life genre. Maintain whimsical, heartwarming tone.
- Write in dystopian, sci-fi, thriller genre. Maintain tense, bleak tone.

Do not include any other text, explanation, or formatting. Just the single prompt line.`;

// PROMPTS object for generator.js compatibility
export const PROMPTS = {
    INITIAL: WORLD_GENERATION_PROMPT,
    UPDATE: UPDATE_PROMPT,
    GENRE: GENRE_TONE_PROMPT,
    WORLD: WORLD_GENERATION_PROMPT,
    CHARACTERS: WORLD_GENERATION_PROMPT
};