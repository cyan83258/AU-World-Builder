/**
 * AU World Builder - SillyTavern third-party extension (no ES modules)
 */

(function () {
    'use strict';

    const extensionName = 'AU-World-Builder';
    const MODULE_NAME = 'au_world_builder_injection';

    function log(...args) {
        console.log('[' + extensionName + ']', ...args);
    }

    function logError(...args) {
        console.error('[' + extensionName + ']', ...args);
    }

    function getExtensionFolderPath() {
        try {
            const script = document.currentScript;
            if (script && script.src) {
                const src = script.src.split('?')[0].split('#')[0];
                return src.substring(0, src.lastIndexOf('/'));
            }
        } catch (e) {
            // ignore
        }

        try {
            if (typeof getContext === 'function') {
                const ctx = getContext();
                if (ctx && ctx.profile) {
                    return 'data/' + ctx.profile + '/extensions/AU-World-Builder';
                }
            }
        } catch (e) {
            // ignore
        }

        return 'data/default-user/extensions/AU-World-Builder';
    }

    const extensionFolderPath = getExtensionFolderPath();

    const defaultSettings = {
        enabled: true,
        apiSource: 'sillytavern',
        connectionProfile: '',
        customApiUrl: '',
        customApiKey: '',
        customApiModel: '',
        customApiMaxTokens: 4000,
        customApiTimeout: 120,
        autoUpdateEnabled: false,
        autoUpdateInterval: 5,
        genrePromptEnabled: false,
        debugMode: false,
        auConcept: '',
        worldSetting: '',
        characterSettings: { char: '', user: '' },
        clothingStyles: { char: '', user: '' },
        genrePrompt: '',
        presets: [],
        outputLanguage: 'korean',
    };

    function getSettings() {
        let stSettings = null;
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                if (ctx && ctx.extensionSettings) {
                    stSettings = ctx.extensionSettings;
                }
            }
        } catch (e) {
            // ignore
        }
        const extSettings = stSettings || window.extension_settings || {};
        window.extension_settings = extSettings;
        if (!extSettings[extensionName]) {
            extSettings[extensionName] = {};
        }
        const settings = extSettings[extensionName];
        for (const [key, value] of Object.entries(defaultSettings)) {
            if (settings[key] === undefined) {
                settings[key] =
                    typeof value === 'object' && value !== null
                        ? JSON.parse(JSON.stringify(value))
                        : value;
            }
        }
        return settings;
    }

    function saveSettings() {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                if (ctx && ctx.saveSettingsDebounced) {
                    ctx.saveSettingsDebounced();
                    return;
                }
            }
            if (typeof saveSettingsDebounced === 'function') {
                saveSettingsDebounced();
            }
        } catch (e) {
            logError('Failed to save settings', e);
        }
    }

    function saveSetting(key, value) {
        const settings = getSettings();
        settings[key] = value;
        saveSettings();
        log('Setting saved: ' + key);
        // Update extension prompt when settings change
        if (typeof updateExtensionPrompt === 'function') {
            updateExtensionPrompt();
        }
    }

    async function loadPopupHTML() {
        const possiblePaths = [
            extensionFolderPath + '/popup.html',
            'scripts/extensions/third-party/AU-World-Builder/popup.html',
            'data/default-user/extensions/AU-World-Builder/popup.html',
        ];
        for (const path of possiblePaths) {
            try {
                const popupHtml = await $.get(path);
                $('body').append(popupHtml);
                log('Popup HTML loaded from: ' + path);
                return true;
            } catch (error) {
                log('Failed to load popup.html from ' + path + ', trying next...');
            }
        }
        logError('Failed to load popup.html from all paths');
        return false;
    }

    function loadCSS() {
        const possiblePaths = [
            extensionFolderPath + '/style.css',
            'scripts/extensions/third-party/AU-World-Builder/style.css',
            'data/default-user/extensions/AU-World-Builder/style.css',
        ];
        for (const path of possiblePaths) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = path;
            document.head.appendChild(link);
            log('CSS loaded from: ' + path);
            return;
        }
    }

    function openPopup() {
        const popup = document.getElementById('au-world-builder-popup');
        if (popup) {
            popup.style.display = 'flex';
            populateConnectionProfiles();
            loadSettingsToUI();
            checkApiStatus();
            renderPresetList();
        } else {
            logError('Popup element with id "au-world-builder-popup" not found');
        }
    }

    function loadSettingsToUI() {
        const settings = getSettings();

        const enabledToggle = document.getElementById('auwb-enabled');
        if (enabledToggle) enabledToggle.checked = settings.enabled;

        const conceptInput = document.getElementById('auwb-au-concept');
        if (conceptInput && settings.auConcept) conceptInput.value = settings.auConcept;

        const worldDisplay = document.getElementById('auwb-world-setting-content');
        if (worldDisplay) worldDisplay.value = settings.worldSetting || '';

        const charDisplay = document.getElementById('auwb-char-setting-content');
        if (charDisplay) charDisplay.value = (settings.characterSettings && settings.characterSettings.char) || '';

        const userDisplay = document.getElementById('auwb-user-setting-content');
        if (userDisplay) userDisplay.value = (settings.characterSettings && settings.characterSettings.user) || '';

        const charStyleDisplay = document.getElementById('auwb-char-style-content');
        if (charStyleDisplay) charStyleDisplay.value = (settings.clothingStyles && settings.clothingStyles.char) || '';

        const userStyleDisplay = document.getElementById('auwb-user-style-content');
        if (userStyleDisplay) userStyleDisplay.value = (settings.clothingStyles && settings.clothingStyles.user) || '';

        const genreDisplay = document.getElementById('auwb-genre-prompt');
        if (genreDisplay) genreDisplay.value = settings.genrePrompt || '';

        const apiSourceSelect = document.getElementById('auwb-api-source');
        if (apiSourceSelect) {
            apiSourceSelect.value = settings.apiSource || 'sillytavern';
            updateApiSettingsVisibility();
        }

        const profileSelect = document.getElementById('auwb-connection-profile');
        if (profileSelect && settings.connectionProfile) {
            profileSelect.value = settings.connectionProfile;
        }

        const autoUpdateToggle = document.getElementById('auwb-auto-update');
        if (autoUpdateToggle) autoUpdateToggle.checked = settings.autoUpdateEnabled;

        const intervalInput = document.getElementById('auwb-update-interval');
        if (intervalInput) intervalInput.value = settings.autoUpdateInterval || 5;

        const genreToggle = document.getElementById('auwb-genre-enabled');
        if (genreToggle) genreToggle.checked = settings.genrePromptEnabled;

        const urlInput = document.getElementById('auwb-api-url');
        if (urlInput) urlInput.value = settings.customApiUrl || '';

        const keyInput = document.getElementById('auwb-api-key');
        if (keyInput) keyInput.value = settings.customApiKey || '';

        const modelInput = document.getElementById('auwb-api-model');
        if (modelInput) modelInput.value = settings.customApiModel || '';

        const maxTokensInput = document.getElementById('auwb-api-max-tokens');
        if (maxTokensInput) maxTokensInput.value = settings.customApiMaxTokens || 4000;

        const timeoutInput = document.getElementById('auwb-api-timeout');
        if (timeoutInput) timeoutInput.value = settings.customApiTimeout || 120;

        const debugToggle = document.getElementById('auwb-debug-mode');
        if (debugToggle) debugToggle.checked = settings.debugMode;

        const languageSelect = document.getElementById('auwb-output-language');
        if (languageSelect) languageSelect.value = settings.outputLanguage || 'korean';

        updateCharacterNames();
        log('Settings loaded to UI');
    }

    function updateCharacterNames() {
        const charInfo = getCharacterInfo();

        document.querySelectorAll('.auwb-char-name').forEach(function (el) {
            el.textContent = charInfo.charName;
        });

        document.querySelectorAll('.auwb-user-name').forEach(function (el) {
            el.textContent = charInfo.userName;
        });

        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                const chatLength = ctx.chat ? ctx.chat.length : 0;

                const chatLengthEl = document.getElementById('auwb-chat-length');
                if (chatLengthEl) chatLengthEl.textContent = String(chatLength);

                const endInput = document.getElementById('auwb-update-end');
                if (endInput && chatLength > 0) endInput.value = String(chatLength - 1);
            }
        } catch (e) {
            // ignore
        }
    }

    async function checkApiStatus() {
        const statusEl = document.getElementById('auwb-api-status');
        if (!statusEl) return;

        statusEl.innerHTML = '<span class="auwb-status-indicator checking"></span><span>Checking...</span>';

        try {
            let apiAvailable = false;

            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                if (ctx.generateRaw || ctx.generateQuietPrompt) {
                    apiAvailable = true;
                }
            }
            if (!apiAvailable && typeof generateQuietPrompt === 'function') {
                apiAvailable = true;
            }

            if (apiAvailable) {
                statusEl.innerHTML = '<span class="auwb-status-indicator connected"></span><span>Connected</span>';
            } else {
                statusEl.innerHTML = '<span class="auwb-status-indicator disconnected"></span><span>No API Available</span>';
            }
        } catch (e) {
            statusEl.innerHTML = '<span class="auwb-status-indicator disconnected"></span><span>Error</span>';
        }
    }

    function getCharacterInfo() {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();

                let charDescription = '';
                let charPersonality = '';
                let charScenario = '';
                let personaDescription = '';

                let charName = ctx.name2 || '{{char}}';
                let userName = ctx.name1 || '{{user}}';

                if (ctx.getCharacterCardFields) {
                    const fields = ctx.getCharacterCardFields();
                    charDescription = fields.description || '';
                    charPersonality = fields.personality || '';
                    charScenario = fields.scenario || '';
                    personaDescription = fields.persona || '';
                }

                if (!charDescription && ctx.characters && ctx.characterId !== undefined) {
                    const char = ctx.characters[ctx.characterId];
                    if (char) {
                        charDescription = char.description || '';
                        charPersonality = char.personality || '';
                        charScenario = char.scenario || '';
                        charName = char.name || charName;
                    }
                }

                return {
                    charName: charName,
                    userName: userName,
                    charDescription: charDescription,
                    charPersonality: charPersonality,
                    charScenario: charScenario,
                    personaDescription: personaDescription,
                };
            }
            return {
                charName: '{{char}}',
                userName: '{{user}}',
                charDescription: '',
                charPersonality: '',
                charScenario: '',
                personaDescription: '',
            };
        } catch (error) {
            logError('Failed to get character info', error);
            return {
                charName: '{{char}}',
                userName: '{{user}}',
                charDescription: '',
                charPersonality: '',
                charScenario: '',
                personaDescription: '',
            };
        }
    }

    function getChatMessages(startIdx, endIdx) {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                if (ctx.chat && Array.isArray(ctx.chat)) {
                    const start = Math.max(0, startIdx);
                    const end = Math.min(ctx.chat.length - 1, endIdx);
                    const messages = [];
                    for (let i = start; i <= end; i++) {
                        const msg = ctx.chat[i];
                        if (msg && msg.mes) {
                            const sender = msg.is_user ? (ctx.name1 || 'User') : (ctx.name2 || 'Character');
                            messages.push(sender + ': ' + msg.mes);
                        }
                    }
                    return messages.join('\n\n');
                }
            }
            return '';
        } catch (e) {
            logError('Failed to get chat messages', e);
            return '';
        }
    }

    function getCurrentProfileName() {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                if (ctx.extensionSettings && ctx.extensionSettings.connectionManager) {
                    const selectedId = ctx.extensionSettings.connectionManager.selectedProfile;
                    if (selectedId) {
                        const profile = ctx.extensionSettings.connectionManager.profiles.find(function (p) {
                            return p.id === selectedId;
                        });
                        return profile ? profile.name : null;
                    }
                }
            }
        } catch (e) {
            logError('Failed to get current profile', e);
        }
        return null;
    }

    async function switchToProfile(profileName) {
        if (!profileName) return false;
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                if (ctx.executeSlashCommandsWithOptions) {
                    await ctx.executeSlashCommandsWithOptions('/profile ' + profileName);
                    log('Switched to profile: ' + profileName);
                    await new Promise(function (resolve) { setTimeout(resolve, 1500); });
                    return true;
                } else if (ctx.executeSlashCommands) {
                    await ctx.executeSlashCommands('/profile ' + profileName);
                    log('Switched to profile: ' + profileName);
                    await new Promise(function (resolve) { setTimeout(resolve, 1500); });
                    return true;
                }
            }
            if (typeof executeSlashCommands === 'function') {
                await executeSlashCommands('/profile ' + profileName);
                log('Switched to profile: ' + profileName);
                await new Promise(function (resolve) { setTimeout(resolve, 1500); });
                return true;
            }
        } catch (e) {
            logError('Failed to switch profile', e);
        }
        return false;
    }

    function getProfileNameById(profileId) {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                if (ctx.extensionSettings && ctx.extensionSettings.connectionManager) {
                    const profile = ctx.extensionSettings.connectionManager.profiles.find(function (p) {
                        return p.id === profileId;
                    });
                    return profile ? profile.name : null;
                }
            }
        } catch (e) {
            // ignore
        }
        return null;
    }

    async function callAPI(prompt) {
        const settings = getSettings();
        const selectedProfileId = settings.connectionProfile;
        let originalProfile = null;
        let switchedProfile = false;

        try {
            if (selectedProfileId) {
                const targetProfileName = getProfileNameById(selectedProfileId);
                if (targetProfileName) {
                    originalProfile = getCurrentProfileName();
                    if (originalProfile !== targetProfileName) {
                        log('Switching from profile "' + originalProfile + '" to "' + targetProfileName + '"');
                        switchedProfile = await switchToProfile(targetProfileName);
                    }
                }
            }

            let result = '';

            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                if (ctx.generateRaw) {
                    result = await ctx.generateRaw({
                        prompt: prompt,
                        maxContext: null,
                        quietToLoud: false,
                        skipWIAN: true,
                        skipAN: true,
                    });
                } else if (ctx.generateQuietPrompt) {
                    result = await ctx.generateQuietPrompt(prompt, false, false);
                }
            }
            if (!result && typeof generateQuietPrompt === 'function') {
                result = await generateQuietPrompt(prompt, false, false);
            }
            if (!result) {
                throw new Error('No API function available or empty result');
            }
            return result;
        } catch (error) {
            throw new Error('API call failed: ' + error.message);
        } finally {
            if (switchedProfile && originalProfile) {
                log('Restoring original profile: ' + originalProfile);
                await switchToProfile(originalProfile);
            }
        }
    }

    async function testApiConnection() {
        const testPrompt = "Test connection. Reply with 'OK'.";
        try {
            const result = await callAPI(testPrompt);
            if (result) return true;
            throw new Error('Empty result');
        } catch (error) {
            throw new Error('API connection failed: ' + error.message);
        }
    }

    async function generateAUWorld(concept) {
        const charInfo = getCharacterInfo();

        const prompt = [
            'You are a creative worldbuilding assistant. Based on the given AU (Alternate Universe) concept and character information, generate a structured AU world setting.',
            '',
            '## AU Concept',
            concept,
            '',
            '## Character Information',
            '- Character Name: ' + charInfo.charName,
            '- Character Description: ' + (charInfo.charDescription || 'Not provided'),
            '- Character Personality: ' + (charInfo.charPersonality || 'Not provided'),
            '- Original Scenario: ' + (charInfo.charScenario || 'Not provided'),
            '',
            '## User Information',
            '- User Name: ' + charInfo.userName,
            '- User/Persona Description: ' + (charInfo.personaDescription || 'Not provided'),
            '',
            '## Output Format (STRICTLY follow this format with these exact markers)',
            'You MUST output in this EXACT format with [WORLD], [CHAR], [USER], [CHAR_CLOTHING], [USER_CLOTHING] markers:',
            '',
            '[WORLD]',
            '(Write a detailed world setting here - the rules, atmosphere, society, key locations. 2-3 paragraphs.)',
            '[/WORLD]',
            '',
            '[CHAR]',
            "(Write " + charInfo.charName + "'s role, background, abilities, and how they fit into this AU world. Include their occupation, status, relationships. 2-3 paragraphs.)",
            '[/CHAR]',
            '',
            '[USER]',
            "(Write " + charInfo.userName + "'s role, background, and how they fit into this AU world. Include their occupation, status, relationship to " + charInfo.charName + ". 1-2 paragraphs.)",
            '[/USER]',
            '',
            '[CHAR_CLOTHING]',
            "(Write a detailed single paragraph describing " + charInfo.charName + "'s typical clothing/outfit in this AU. Include colors, materials, accessories, and style details.)",
            '[/CHAR_CLOTHING]',
            '',
            '[USER_CLOTHING]',
            "(Write a detailed single paragraph describing " + charInfo.userName + "'s typical clothing/outfit in this AU. Include colors, materials, accessories, and style details.)",
            '[/USER_CLOTHING]',
            '',
            getSettings().outputLanguage === 'korean' 
                ? 'IMPORTANT: Write ALL content in Korean (한국어). Now generate the AU world setting:'
                : 'IMPORTANT: Write ALL content in English. Now generate the AU world setting:'
        ].join('\n');

        return await callAPI(prompt);
    }

    function parseGeneratedContent(content) {
        const parsed = {
            world: '',
            charSetting: '',
            userSetting: '',
            charClothing: '',
            userClothing: '',
        };

        const worldMatch = content.match(/\[WORLD\]([\s\S]*?)\[\/WORLD\]/i);
        if (worldMatch) parsed.world = worldMatch[1].trim();

        const charMatch = content.match(/\[CHAR\]([\s\S]*?)\[\/CHAR\]/i);
        if (charMatch) parsed.charSetting = charMatch[1].trim();

        const userMatch = content.match(/\[USER\]([\s\S]*?)\[\/USER\]/i);
        if (userMatch) parsed.userSetting = userMatch[1].trim();

        const charClothingMatch = content.match(/\[CHAR_CLOTHING\]([\s\S]*?)\[\/CHAR_CLOTHING\]/i);
        if (charClothingMatch) parsed.charClothing = charClothingMatch[1].trim();

        const userClothingMatch = content.match(/\[USER_CLOTHING\]([\s\S]*?)\[\/USER_CLOTHING\]/i);
        if (userClothingMatch) parsed.userClothing = userClothingMatch[1].trim();

        if (!parsed.world && !parsed.charSetting) {
            const sections = content.split(/###\s*\d+\.?/);
            if (sections.length >= 2) {
                parsed.world = (sections[1] || '').trim();
                parsed.charSetting = (sections[2] || '').trim();
                parsed.userSetting = (sections[3] || '').trim();
            }
        }

        return parsed;
    }

    async function generateGenrePromptText() {
        const charInfo = getCharacterInfo();
        const settings = getSettings();
        const worldSetting = (document.getElementById('auwb-world-setting-content') || {}).value || settings.worldSetting || '';

        if (!worldSetting) {
            throw new Error('Please generate or enter a World Setting first.');
        }

        const prompt = [
            'You are a creative writing assistant. Based on the AU world setting provided, generate a concise genre/tone prompt.',
            '',
            '## AU World Setting',
            worldSetting,
            '',
            '## Character: ' + charInfo.charName,
            '## User: ' + charInfo.userName,
            '',
            '## Task',
            'Create a brief genre/tone prompt (2-4 sentences) that captures:',
            '- The genre (fantasy, sci-fi, romance, etc.)',
            '- The mood and atmosphere',
            '- The writing style to use',
            '- Key thematic elements',
            '',
            "This prompt will guide the AI's writing style for roleplay in this AU.",
            '',
            getSettings().outputLanguage === 'korean'
                ? 'IMPORTANT: Write the genre/tone prompt in Korean (한국어). Genre/Tone Prompt:'
                : 'IMPORTANT: Write the genre/tone prompt in English. Genre/Tone Prompt:'
        ].join('\n');

        return await callAPI(prompt);
    }

    function getAllCurrentSettings() {
        const settings = getSettings();
        return {
            world: (document.getElementById('auwb-world-setting-content') || {}).value || settings.worldSetting || '',
            charSetting: (document.getElementById('auwb-char-setting-content') || {}).value || (settings.characterSettings && settings.characterSettings.char) || '',
            userSetting: (document.getElementById('auwb-user-setting-content') || {}).value || (settings.characterSettings && settings.characterSettings.user) || '',
            charClothing: (document.getElementById('auwb-char-style-content') || {}).value || (settings.clothingStyles && settings.clothingStyles.char) || '',
            userClothing: (document.getElementById('auwb-user-style-content') || {}).value || (settings.clothingStyles && settings.clothingStyles.user) || '',
            genrePrompt: (document.getElementById('auwb-genre-prompt') || {}).value || settings.genrePrompt || '',
        };
    }

    /**
     * Build injection text from current AU settings
     * @returns {string} The formatted injection text
     */
    function buildInjectionText() {
        const settings = getSettings();
        if (!settings.enabled) {
            return '';
        }

        const current = getAllCurrentSettings();
        const charInfo = getCharacterInfo();
        const parts = [];

        if (current.world && current.world.trim()) {
            parts.push('[AU World Setting]');
            parts.push(current.world.trim());
            parts.push('');
        }

        if (current.charSetting && current.charSetting.trim()) {
            parts.push('[' + charInfo.charName + ' - AU Character Setting]');
            parts.push(current.charSetting.trim());
            parts.push('');
        }

        if (current.userSetting && current.userSetting.trim()) {
            parts.push('[' + charInfo.userName + ' - AU Character Setting]');
            parts.push(current.userSetting.trim());
            parts.push('');
        }

        if (current.charClothing && current.charClothing.trim()) {
            parts.push('[' + charInfo.charName + ' - Current Clothing/Appearance]');
            parts.push(current.charClothing.trim());
            parts.push('');
        }

        if (current.userClothing && current.userClothing.trim()) {
            parts.push('[' + charInfo.userName + ' - Current Clothing/Appearance]');
            parts.push(current.userClothing.trim());
            parts.push('');
        }

        if (settings.genrePromptEnabled && current.genrePrompt && current.genrePrompt.trim()) {
            parts.push('[Genre/Tone Instructions]');
            parts.push(current.genrePrompt.trim());
            parts.push('');
        }

        return parts.join('\n').trim();
    }

    /**
     * Update the extension prompt with current AU settings
     * This injects AU content into SillyTavern's prompt system
     */
    function updateExtensionPrompt() {
        try {
            const ctx = SillyTavern.getContext();
            if (!ctx || typeof ctx.setExtensionPrompt !== 'function') {
                log('setExtensionPrompt not available');
                return;
            }

            const settings = getSettings();
            const injectionText = buildInjectionText();

            // extension_prompt_types: NONE=-1, IN_PROMPT=0, IN_CHAT=1, BEFORE_PROMPT=2
            // extension_prompt_roles: SYSTEM=0, USER=1, ASSISTANT=2
            if (settings.enabled && injectionText) {
                // IN_CHAT (1) with depth 1 means it appears before the last message
                // Using SYSTEM role (0) for AU world context
                ctx.setExtensionPrompt(
                    MODULE_NAME,
                    injectionText,
                    1,  // IN_CHAT
                    4,  // depth - insert at position 4 from bottom
                    true,  // allowWIScan
                    0   // SYSTEM role
                );
                log('Extension prompt updated with AU content');
            } else {
                // Clear the prompt if disabled or empty
                ctx.setExtensionPrompt(MODULE_NAME, '', -1, 0);
                log('Extension prompt cleared');
            }
        } catch (e) {
            logError('Failed to update extension prompt', e);
        }
    }

    // ========== PRESET FUNCTIONS ==========

    /**
     * Generate a unique ID for presets
     */
    function generatePresetId() {
        return 'preset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get all saved presets
     */
    function getPresets() {
        const settings = getSettings();
        return settings.presets || [];
    }

    /**
     * Save a new preset with current settings
     */
    function savePreset(name) {
        if (!name || !name.trim()) {
            throw new Error('Preset name is required');
        }

        const current = getAllCurrentSettings();
        const charInfo = getCharacterInfo();

        const preset = {
            id: generatePresetId(),
            name: name.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            characterName: charInfo.charName,
            data: {
                worldSetting: current.world,
                characterSettings: {
                    char: current.charSetting,
                    user: current.userSetting
                },
                clothingStyles: {
                    char: current.charClothing,
                    user: current.userClothing
                },
                genrePrompt: current.genrePrompt
            }
        };

        const settings = getSettings();
        if (!settings.presets) {
            settings.presets = [];
        }
        settings.presets.push(preset);
        saveSettings();

        log('Preset saved: ' + name);
        return preset;
    }

    /**
     * Load a preset by ID
     */
    function loadPreset(presetId) {
        const presets = getPresets();
        const preset = presets.find(function(p) { return p.id === presetId; });

        if (!preset) {
            throw new Error('Preset not found');
        }

        const data = preset.data;

        // Update settings
        saveSetting('worldSetting', data.worldSetting || '');
        saveSetting('characterSettings', data.characterSettings || { char: '', user: '' });
        saveSetting('clothingStyles', data.clothingStyles || { char: '', user: '' });
        saveSetting('genrePrompt', data.genrePrompt || '');

        // Update UI
        var worldEl = document.getElementById('auwb-world-setting-content');
        if (worldEl) worldEl.value = data.worldSetting || '';

        var charSettingEl = document.getElementById('auwb-char-setting-content');
        if (charSettingEl) charSettingEl.value = (data.characterSettings && data.characterSettings.char) || '';

        var userSettingEl = document.getElementById('auwb-user-setting-content');
        if (userSettingEl) userSettingEl.value = (data.characterSettings && data.characterSettings.user) || '';

        var charStyleEl = document.getElementById('auwb-char-style-content');
        if (charStyleEl) charStyleEl.value = (data.clothingStyles && data.clothingStyles.char) || '';

        var userStyleEl = document.getElementById('auwb-user-style-content');
        if (userStyleEl) userStyleEl.value = (data.clothingStyles && data.clothingStyles.user) || '';

        var genreEl = document.getElementById('auwb-genre-prompt');
        if (genreEl) genreEl.value = data.genrePrompt || '';

        log('Preset loaded: ' + preset.name);
        return preset;
    }

    /**
     * Rename a preset
     */
    function renamePreset(presetId, newName) {
        if (!newName || !newName.trim()) {
            throw new Error('New name is required');
        }

        const settings = getSettings();
        const preset = settings.presets.find(function(p) { return p.id === presetId; });

        if (!preset) {
            throw new Error('Preset not found');
        }

        preset.name = newName.trim();
        preset.updatedAt = new Date().toISOString();
        saveSettings();

        log('Preset renamed to: ' + newName);
        return preset;
    }

    /**
     * Delete a preset
     */
    function deletePreset(presetId) {
        const settings = getSettings();
        const index = settings.presets.findIndex(function(p) { return p.id === presetId; });

        if (index === -1) {
            throw new Error('Preset not found');
        }

        const deleted = settings.presets.splice(index, 1)[0];
        saveSettings();

        log('Preset deleted: ' + deleted.name);
        return deleted;
    }

    /**
     * Export all presets to JSON
     */
    function exportPresets() {
        const presets = getPresets();
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            type: 'au-world-builder-presets',
            presets: presets
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'au-world-builder-presets-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        log('Exported ' + presets.length + ' presets');
    }

    /**
     * Import presets from JSON file
     */
    function importPresets(fileContent) {
        try {
            const importData = JSON.parse(fileContent);

            if (importData.type !== 'au-world-builder-presets' || !Array.isArray(importData.presets)) {
                throw new Error('Invalid preset file format');
            }

            const settings = getSettings();
            if (!settings.presets) {
                settings.presets = [];
            }

            var importedCount = 0;
            importData.presets.forEach(function(preset) {
                // Generate new ID to avoid conflicts
                preset.id = generatePresetId();
                preset.name = preset.name + ' (imported)';
                settings.presets.push(preset);
                importedCount++;
            });

            saveSettings();
            log('Imported ' + importedCount + ' presets');
            return importedCount;
        } catch (e) {
            logError('Failed to import presets', e);
            throw e;
        }
    }

    /**
     * Render the preset list in UI
     */
    function renderPresetList() {
        var listEl = document.getElementById('auwb-preset-list');
        if (!listEl) return;

        var presets = getPresets();

        if (presets.length === 0) {
            listEl.innerHTML = '<div class="auwb-preset-empty">No presets saved yet.</div>';
            return;
        }

        var html = '';
        presets.forEach(function(preset) {
            var date = new Date(preset.createdAt).toLocaleDateString();
            html += '<div class="auwb-preset-item" data-preset-id="' + preset.id + '">';
            html += '<span class="auwb-preset-name">' + escapeHtml(preset.name) + '</span>';
            html += '<span class="auwb-preset-date">' + date + '</span>';
            html += '<div class="auwb-preset-actions">';
            html += '<button class="auwb-preset-btn load" title="Load"><i class="fa-solid fa-download"></i></button>';
            html += '<button class="auwb-preset-btn rename" title="Rename"><i class="fa-solid fa-pen"></i></button>';
            html += '<button class="auwb-preset-btn delete" title="Delete"><i class="fa-solid fa-trash"></i></button>';
            html += '</div>';
            html += '</div>';
        });

        listEl.innerHTML = html;

        // Bind events to preset items
        listEl.querySelectorAll('.auwb-preset-item').forEach(function(item) {
            var presetId = item.getAttribute('data-preset-id');

            item.querySelector('.auwb-preset-btn.load').addEventListener('click', function(e) {
                e.stopPropagation();
                try {
                    loadPreset(presetId);
                    showStatus('Preset loaded successfully!', 'success');
                    renderPresetList();
                } catch (err) {
                    showStatus('Failed to load preset: ' + err.message, 'error');
                }
            });

            item.querySelector('.auwb-preset-btn.rename').addEventListener('click', function(e) {
                e.stopPropagation();
                startRenamePreset(item, presetId);
            });

            item.querySelector('.auwb-preset-btn.delete').addEventListener('click', function(e) {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this preset?')) {
                    try {
                        deletePreset(presetId);
                        showStatus('Preset deleted', 'success');
                        renderPresetList();
                    } catch (err) {
                        showStatus('Failed to delete preset: ' + err.message, 'error');
                    }
                }
            });
        });
    }

    /**
     * Start inline rename for a preset
     */
    function startRenamePreset(itemEl, presetId) {
        var nameEl = itemEl.querySelector('.auwb-preset-name');
        var currentName = nameEl.textContent;

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'auwb-preset-name-input';
        input.value = currentName;

        nameEl.style.display = 'none';
        itemEl.insertBefore(input, nameEl);
        input.focus();
        input.select();

        function finishRename() {
            var newName = input.value.trim();
            if (newName && newName !== currentName) {
                try {
                    renamePreset(presetId, newName);
                    showStatus('Preset renamed', 'success');
                } catch (err) {
                    showStatus('Failed to rename: ' + err.message, 'error');
                }
            }
            renderPresetList();
        }

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishRename();
            } else if (e.key === 'Escape') {
                renderPresetList();
            }
        });
    }

    /**
     * Escape HTML special characters
     */
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== END PRESET FUNCTIONS ==========

    /**
     * Register event listeners for prompt injection
     */
    function registerPromptInjection() {
        try {
            const ctx = SillyTavern.getContext();
            if (!ctx || !ctx.eventSource || !ctx.event_types) {
                log('Event system not available, will try again later');
                return false;
            }

            // Listen for chat changes to update the prompt
            ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, function() {
                log('Chat changed, updating extension prompt');
                updateExtensionPrompt();
            });

            // Listen for generation starts
            ctx.eventSource.on(ctx.event_types.GENERATION_STARTED, function() {
                log('Generation started, ensuring prompt is up to date');
                updateExtensionPrompt();
            });

            // Listen for character changes
            ctx.eventSource.on(ctx.event_types.CHARACTER_MESSAGE_RENDERED, function() {
                // Update after character is rendered to ensure context is available
                updateExtensionPrompt();
            });

            log('Prompt injection event listeners registered');
            return true;
        } catch (e) {
            logError('Failed to register prompt injection', e);
            return false;
        }
    }

    async function updateFromRange(startIdx, endIdx) {
        const chatContent = getChatMessages(startIdx, endIdx);
        if (!chatContent) {
            throw new Error('No messages found in the specified range.');
        }

        const charInfo = getCharacterInfo();
        const current = getAllCurrentSettings();

        const prompt = [
            'You are an expert AU (Alternate Universe) content editor. Your task is to UPDATE and REFINE the existing AU settings based on new information from chat messages.',
            '',
            'IMPORTANT: You must PRESERVE the existing content and only MODIFY or ADD details based on what happens in the chat. Do NOT delete or completely rewrite sections unless the chat explicitly contradicts them.',
            '',
            '## Character Names',
            '- Character: ' + charInfo.charName,
            '- User: ' + charInfo.userName,
            '',
            '## EXISTING AU SETTINGS (Preserve these and update only what\'s necessary)',
            '',
            '### Current World Setting:',
            current.world || '(Not yet established)',
            '',
            '### Current ' + charInfo.charName + ' Setting:',
            current.charSetting || '(Not yet established)',
            '',
            '### Current ' + charInfo.userName + ' Setting:',
            current.userSetting || '(Not yet established)',
            '',
            '### Current ' + charInfo.charName + ' Clothing:',
            current.charClothing || '(Not yet established)',
            '',
            '### Current ' + charInfo.userName + ' Clothing:',
            current.userClothing || '(Not yet established)',
            '',
            '## NEW CHAT MESSAGES TO ANALYZE (Message #' + startIdx + ' to #' + endIdx + ')',
            chatContent,
            '',
            '## YOUR TASK',
            '1. Read the chat messages carefully',
            '2. Identify any NEW information about: world details, character developments, relationship changes, location descriptions, clothing changes, abilities revealed, etc.',
            '3. UPDATE the existing settings by ADDING the new information while KEEPING all existing details that weren\'t contradicted',
            '4. If clothing is mentioned or described in chat, update the clothing sections accordingly',
            '5. If no changes are needed for a section, keep it exactly as is',
            '',
            'Output in this EXACT format:',
            '',
            '[WORLD]',
            '(The updated world setting - keep existing content, add new details from chat)',
            '[/WORLD]',
            '',
            '[CHAR]',
            '(The updated ' + charInfo.charName + ' setting - keep existing content, add new character developments)',
            '[/CHAR]',
            '',
            '[USER]',
            '(The updated ' + charInfo.userName + ' setting - keep existing content, add new developments)',
            '[/USER]',
            '',
            '[CHAR_CLOTHING]',
            '(The updated clothing for ' + charInfo.charName + ' - if mentioned in chat, update; otherwise keep existing)',
            '[/CHAR_CLOTHING]',
            '',
            '[USER_CLOTHING]',
            '(The updated clothing for ' + charInfo.userName + ' - if mentioned in chat, update; otherwise keep existing)',
            '[/USER_CLOTHING]',
            '',
            getSettings().outputLanguage === 'korean'
                ? 'IMPORTANT: Write ALL content in Korean (한국어). Now analyze the chat and provide the UPDATED settings:'
                : 'IMPORTANT: Write ALL content in English. Now analyze the chat and provide the UPDATED settings:'
        ].join('\n');

        return await callAPI(prompt);
    }

    function getConnectionProfiles() {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                const ctx = SillyTavern.getContext();
                if (ctx && ctx.extensionSettings && ctx.extensionSettings.connectionManager) {
                    return ctx.extensionSettings.connectionManager.profiles || [];
                }
            }
            if (typeof getContext === 'function') {
                const ctx2 = getContext();
                if (ctx2 && ctx2.extensionSettings && ctx2.extensionSettings.connectionManager) {
                    return ctx2.extensionSettings.connectionManager.profiles || [];
                }
            }
            if (window.extension_settings && window.extension_settings.connectionManager) {
                return window.extension_settings.connectionManager.profiles || [];
            }
            return [];
        } catch (error) {
            logError('Failed to get connection profiles', error);
            return [];
        }
    }

    function populateConnectionProfiles() {
        const select = document.getElementById('auwb-connection-profile');
        if (!select) return;

        const profiles = getConnectionProfiles();
        select.innerHTML = '<option value="">Use current API connection</option>';

        profiles.forEach(function (profile) {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name || profile.id;
            select.appendChild(option);
        });

        const settings = getSettings();
        if (settings.connectionProfile) {
            select.value = settings.connectionProfile;
        }

        log('Loaded ' + profiles.length + ' connection profiles');
    }

    function updateApiSettingsVisibility() {
        const apiSourceSelect = document.getElementById('auwb-api-source');
        const stSettings = document.getElementById('auwb-st-api-settings');
        const customSettings = document.getElementById('auwb-custom-api-settings');
        if (!apiSourceSelect) return;

        if (apiSourceSelect.value === 'sillytavern') {
            if (stSettings) stSettings.style.display = 'block';
            if (customSettings) customSettings.style.display = 'none';
        } else {
            if (stSettings) stSettings.style.display = 'none';
            if (customSettings) customSettings.style.display = 'block';
        }
    }

    function showStatus(message, type) {
        const statusEl = document.getElementById('auwb-status-message');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'auwb-status-message ' + type;
            statusEl.style.display = 'block';
            if (type !== 'error') {
                setTimeout(function () {
                    statusEl.style.display = 'none';
                }, 5000);
            }
        }
        log(type.toUpperCase() + ': ' + message);
    }

    function getInjectionPreview() {
        const current = getAllCurrentSettings();
        const charInfo = getCharacterInfo();
        let preview = '=== AU World Builder Injection Preview ===\n\n';

        if (current.world) {
            preview += '--- World Setting ---\n' + current.world + '\n\n';
        }
        if (current.charSetting) {
            preview += '--- ' + charInfo.charName + "'s Setting ---\n" + current.charSetting + '\n\n';
        }
        if (current.userSetting) {
            preview += '--- ' + charInfo.userName + "'s Setting ---\n" + current.userSetting + '\n\n';
        }
        if (current.charClothing) {
            preview += '--- ' + charInfo.charName + "'s Clothing ---\n" + current.charClothing + '\n\n';
        }
        if (current.userClothing) {
            preview += '--- ' + charInfo.userName + "'s Clothing ---\n" + current.userClothing + '\n\n';
        }
        if (current.genrePrompt && getSettings().genrePromptEnabled) {
            preview += '--- Genre/Tone Prompt ---\n' + current.genrePrompt + '\n\n';
        }

        return preview;
    }

    function exportSettings() {
        const settings = getSettings();
        const charInfo = getCharacterInfo();
        const current = getAllCurrentSettings();
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            characterName: charInfo.charName,
            userName: charInfo.userName,
            auConcept: settings.auConcept,
            worldSetting: current.world,
            characterSettings: { char: current.charSetting, user: current.userSetting },
            clothingStyles: { char: current.charClothing, user: current.userClothing },
            genrePrompt: current.genrePrompt,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'au-world-builder-' + (charInfo.charName || 'export') + '-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showStatus('Settings exported successfully!', 'success');
    }

    function importSettings(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importData = JSON.parse(e.target.result);

                if (importData.auConcept !== undefined) {
                    saveSetting('auConcept', importData.auConcept);
                    const conceptInput = document.getElementById('auwb-au-concept');
                    if (conceptInput) conceptInput.value = importData.auConcept;
                }
                if (importData.worldSetting !== undefined) {
                    saveSetting('worldSetting', importData.worldSetting);
                    const worldEl = document.getElementById('auwb-world-setting-content');
                    if (worldEl) worldEl.value = importData.worldSetting;
                }
                if (importData.characterSettings !== undefined) {
                    saveSetting('characterSettings', importData.characterSettings);
                    const charEl = document.getElementById('auwb-char-setting-content');
                    if (charEl) charEl.value = importData.characterSettings.char || '';
                    const userEl = document.getElementById('auwb-user-setting-content');
                    if (userEl) userEl.value = importData.characterSettings.user || '';
                }
                if (importData.clothingStyles !== undefined) {
                    saveSetting('clothingStyles', importData.clothingStyles);
                    const charStyleEl = document.getElementById('auwb-char-style-content');
                    if (charStyleEl) charStyleEl.value = importData.clothingStyles.char || '';
                    const userStyleEl = document.getElementById('auwb-user-style-content');
                    if (userStyleEl) userStyleEl.value = importData.clothingStyles.user || '';
                }
                if (importData.genrePrompt !== undefined) {
                    saveSetting('genrePrompt', importData.genrePrompt);
                    const genreEl = document.getElementById('auwb-genre-prompt');
                    if (genreEl) genreEl.value = importData.genrePrompt;
                }

                showStatus('Settings imported successfully!', 'success');
            } catch (error) {
                showStatus('Failed to import: Invalid JSON file', 'error');
                logError('Import failed', error);
            }
        };
        reader.readAsText(file);
    }

    function clearAllSettings() {
        if (!window.confirm('Are you sure you want to clear all AU World Builder settings? This cannot be undone.')) {
            return;
        }

        saveSetting('auConcept', '');
        saveSetting('worldSetting', '');
        saveSetting('characterSettings', { char: '', user: '' });
        saveSetting('clothingStyles', { char: '', user: '' });
        saveSetting('genrePrompt', '');

        const ids = [
            'auwb-au-concept',
            'auwb-world-setting-content',
            'auwb-char-setting-content',
            'auwb-user-setting-content',
            'auwb-char-style-content',
            'auwb-user-style-content',
            'auwb-genre-prompt',
        ];
        ids.forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        showStatus('All settings cleared!', 'success');
    }

    function bindUIEvents() {
        const popup = document.getElementById('au-world-builder-popup');
        if (!popup) return;

        const closeBtn = document.getElementById('auwb-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                popup.style.display = 'none';
            });
        }

        const overlay = popup.querySelector('.auwb-popup-overlay');
        if (overlay) {
            overlay.addEventListener('click', function () {
                popup.style.display = 'none';
            });
        }

        popup.querySelectorAll('.auwb-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const tabId = btn.getAttribute('data-tab');
                if (!tabId) return;

                popup.querySelectorAll('.auwb-tab-btn').forEach(function (b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');

                popup.querySelectorAll('.auwb-tab-content').forEach(function (content) {
                    content.style.display = content.id === 'auwb-tab-' + tabId ? 'block' : 'none';
                });
            });
        });

        const previewCloseBtn = document.getElementById('auwb-preview-close');
        if (previewCloseBtn) {
            previewCloseBtn.addEventListener('click', function () {
                const modal = document.getElementById('auwb-preview-modal');
                if (modal) modal.style.display = 'none';
            });
        }

        const previewOverlay = document.querySelector('#auwb-preview-modal .auwb-modal-overlay');
        if (previewOverlay) {
            previewOverlay.addEventListener('click', function () {
                const modal = document.getElementById('auwb-preview-modal');
                if (modal) modal.style.display = 'none';
            });
        }

        populateConnectionProfiles();

        const apiSourceSelect = document.getElementById('auwb-api-source');
        if (apiSourceSelect) {
            apiSourceSelect.addEventListener('change', function (e) {
                updateApiSettingsVisibility();
                saveSetting('apiSource', e.target.value);
            });
        }

        const testApiBtn = document.getElementById('auwb-test-api-btn');
        if (testApiBtn) {
            testApiBtn.addEventListener('click', async function () {
                testApiBtn.disabled = true;
                const origText = testApiBtn.innerHTML;
                testApiBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
                try {
                    await testApiConnection();
                    showStatus('API connection successful!', 'success');
                    checkApiStatus();
                } catch (error) {
                    showStatus('API test failed: ' + error.message, 'error');
                } finally {
                    testApiBtn.disabled = false;
                    testApiBtn.innerHTML = origText;
                }
            });
        }

        const generateBtn = document.getElementById('auwb-generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', async function () {
                const conceptInput = document.getElementById('auwb-au-concept');
                const concept = conceptInput && conceptInput.value ? conceptInput.value.trim() : '';
                if (!concept) {
                    showStatus('Please enter an AU concept first.', 'error');
                    return;
                }
                generateBtn.disabled = true;
                const origText = generateBtn.innerHTML;
                generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
                showStatus('Generating AU world...', 'info');
                try {
                    const result = await generateAUWorld(concept);
                    if (result) {
                        const parsed = parseGeneratedContent(result);

                        if (parsed.world) {
                            saveSetting('worldSetting', parsed.world);
                            const worldEl = document.getElementById('auwb-world-setting-content');
                            if (worldEl) worldEl.value = parsed.world;
                        }

                        const charSettings = {
                            char: parsed.charSetting || '',
                            user: parsed.userSetting || '',
                        };
                        saveSetting('characterSettings', charSettings);
                        const charEl = document.getElementById('auwb-char-setting-content');
                        if (charEl) charEl.value = parsed.charSetting || '';
                        const userEl = document.getElementById('auwb-user-setting-content');
                        if (userEl) userEl.value = parsed.userSetting || '';

                        const clothingStyles = {
                            char: parsed.charClothing || '',
                            user: parsed.userClothing || '',
                        };
                        saveSetting('clothingStyles', clothingStyles);
                        const charStyleEl = document.getElementById('auwb-char-style-content');
                        if (charStyleEl) charStyleEl.value = parsed.charClothing || '';
                        const userStyleEl = document.getElementById('auwb-user-style-content');
                        if (userStyleEl) userStyleEl.value = parsed.userClothing || '';

                        saveSetting('auConcept', concept);
                        showStatus('AU world generated and distributed!', 'success');
                    } else {
                        showStatus('Empty result from API', 'error');
                    }
                } catch (e) {
                    showStatus('Failed: ' + e.message, 'error');
                } finally {
                    generateBtn.disabled = false;
                    generateBtn.innerHTML = origText;
                }
            });
        }

        const genreBtn = document.getElementById('auwb-generate-genre-btn');
        if (genreBtn) {
            genreBtn.addEventListener('click', async function () {
                genreBtn.disabled = true;
                const origText = genreBtn.innerHTML;
                genreBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
                try {
                    const result = await generateGenrePromptText();
                    if (result) {
                        saveSetting('genrePrompt', result);
                        const genreEl = document.getElementById('auwb-genre-prompt');
                        if (genreEl) genreEl.value = result;
                        showStatus('Genre prompt generated!', 'success');
                    } else {
                        showStatus('Empty result', 'error');
                    }
                } catch (e) {
                    showStatus('Failed: ' + e.message, 'error');
                } finally {
                    genreBtn.disabled = false;
                    genreBtn.innerHTML = origText;
                }
            });
        }

        const manualUpdateBtn = document.getElementById('auwb-manual-update-btn');
        if (manualUpdateBtn) {
            manualUpdateBtn.addEventListener('click', async function () {
                const startEl = document.getElementById('auwb-update-start');
                const endEl = document.getElementById('auwb-update-end');
                const startIdx = startEl ? parseInt(startEl.value, 10) || 0 : 0;
                const endIdx = endEl ? parseInt(endEl.value, 10) || 0 : 0;

                if (endIdx < startIdx) {
                    showStatus('End index must be >= start index', 'error');
                    return;
                }

                manualUpdateBtn.disabled = true;
                const origText = manualUpdateBtn.innerHTML;
                manualUpdateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
                showStatus('Analyzing chat messages...', 'info');

                try {
                    const result = await updateFromRange(startIdx, endIdx);
                    if (result) {
                        const parsed = parseGeneratedContent(result);

                        if (parsed.world) {
                            saveSetting('worldSetting', parsed.world);
                            const worldEl = document.getElementById('auwb-world-setting-content');
                            if (worldEl) worldEl.value = parsed.world;
                        }

                        const charSettings = {
                            char: parsed.charSetting || '',
                            user: parsed.userSetting || '',
                        };
                        saveSetting('characterSettings', charSettings);
                        const charEl = document.getElementById('auwb-char-setting-content');
                        if (charEl) charEl.value = parsed.charSetting || '';
                        const userEl = document.getElementById('auwb-user-setting-content');
                        if (userEl) userEl.value = parsed.userSetting || '';

                        const clothingStyles = {
                            char: parsed.charClothing || '',
                            user: parsed.userClothing || '',
                        };
                        saveSetting('clothingStyles', clothingStyles);
                        const charStyleEl = document.getElementById('auwb-char-style-content');
                        if (charStyleEl) charStyleEl.value = parsed.charClothing || '';
                        const userStyleEl = document.getElementById('auwb-user-style-content');
                        if (userStyleEl) userStyleEl.value = parsed.userClothing || '';

                        const lastUpdate = document.getElementById('auwb-last-update');
                        if (lastUpdate) {
                            lastUpdate.textContent =
                                'Last updated: ' + new Date().toLocaleString() +
                                ' (messages #' + startIdx + '-#' + endIdx + ')';
                        }

                        showStatus('Updated from chat messages!', 'success');
                    } else {
                        showStatus('Empty result', 'error');
                    }
                } catch (e) {
                    showStatus('Failed: ' + e.message, 'error');
                } finally {
                    manualUpdateBtn.disabled = false;
                    manualUpdateBtn.innerHTML = origText;
                }
            });
        }

        const previewBtn = document.getElementById('auwb-preview-injection');
        if (previewBtn) {
            previewBtn.addEventListener('click', function () {
                const preview = getInjectionPreview();
                const previewContent = document.getElementById('auwb-preview-content');
                if (previewContent) previewContent.textContent = preview;
                const modal = document.getElementById('auwb-preview-modal');
                if (modal) modal.style.display = 'flex';
            });
        }

        const exportBtn = document.getElementById('auwb-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', function () {
                exportSettings();
            });
        }

        const importBtn = document.getElementById('auwb-import');
        const importFile = document.getElementById('auwb-import-file');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', function () {
                importFile.click();
            });
            importFile.addEventListener('change', function (e) {
                if (e.target.files && e.target.files[0]) {
                    importSettings(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        const clearBtn = document.getElementById('auwb-clear-all');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                clearAllSettings();
            });
        }

        const profileSelect = document.getElementById('auwb-connection-profile');
        if (profileSelect) {
            profileSelect.addEventListener('change', function (e) {
                saveSetting('connectionProfile', e.target.value);
            });
        }

        const saveWorldBtn = document.getElementById('auwb-save-world');
        if (saveWorldBtn) {
            saveWorldBtn.addEventListener('click', function () {
                const worldEl = document.getElementById('auwb-world-setting-content');
                saveSetting('worldSetting', worldEl ? worldEl.value || '' : '');
                showStatus('World setting saved!', 'success');
            });
        }

        const saveGenreBtn = document.getElementById('auwb-save-genre');
        if (saveGenreBtn) {
            saveGenreBtn.addEventListener('click', function () {
                const genreEl = document.getElementById('auwb-genre-prompt');
                saveSetting('genrePrompt', genreEl ? genreEl.value || '' : '');
                showStatus('Genre prompt saved!', 'success');
            });
        }

        const saveCharsBtn = document.getElementById('auwb-save-characters');
        if (saveCharsBtn) {
            saveCharsBtn.addEventListener('click', function () {
                const charEl = document.getElementById('auwb-char-setting-content');
                const userEl = document.getElementById('auwb-user-setting-content');
                const charSettings = {
                    char: charEl ? charEl.value || '' : '',
                    user: userEl ? userEl.value || '' : '',
                };
                saveSetting('characterSettings', charSettings);
                showStatus('Character settings saved!', 'success');
            });
        }

        const saveStylesBtn = document.getElementById('auwb-save-styles');
        if (saveStylesBtn) {
            saveStylesBtn.addEventListener('click', function () {
                const charEl = document.getElementById('auwb-char-style-content');
                const userEl = document.getElementById('auwb-user-style-content');
                const clothingStyles = {
                    char: charEl ? charEl.value || '' : '',
                    user: userEl ? userEl.value || '' : '',
                };
                saveSetting('clothingStyles', clothingStyles);
                showStatus('Clothing styles saved!', 'success');
            });
        }

        const enabledToggle = document.getElementById('auwb-enabled');
        if (enabledToggle) {
            enabledToggle.addEventListener('change', function (e) {
                saveSetting('enabled', e.target.checked);
            });
        }

        const autoUpdateToggle = document.getElementById('auwb-auto-update');
        if (autoUpdateToggle) {
            autoUpdateToggle.addEventListener('change', function (e) {
                saveSetting('autoUpdateEnabled', e.target.checked);
            });
        }

        const genreToggle = document.getElementById('auwb-genre-enabled');
        if (genreToggle) {
            genreToggle.addEventListener('change', function (e) {
                saveSetting('genrePromptEnabled', e.target.checked);
            });
        }

        const intervalInput = document.getElementById('auwb-update-interval');
        if (intervalInput) {
            intervalInput.addEventListener('change', function (e) {
                saveSetting('autoUpdateInterval', parseInt(e.target.value, 10) || 5);
            });
        }

        const debugToggle = document.getElementById('auwb-debug-mode');
        if (debugToggle) {
            debugToggle.addEventListener('change', function (e) {
                saveSetting('debugMode', e.target.checked);
            });
        }

        const outputLanguageSelect = document.getElementById('auwb-output-language');
        if (outputLanguageSelect) {
            outputLanguageSelect.addEventListener('change', function (e) {
                saveSetting('outputLanguage', e.target.value);
            });
        }

        const apiUrl = document.getElementById('auwb-api-url');
        if (apiUrl) {
            apiUrl.addEventListener('change', function (e) {
                saveSetting('customApiUrl', e.target.value);
            });
        }

        const apiKey = document.getElementById('auwb-api-key');
        if (apiKey) {
            apiKey.addEventListener('change', function (e) {
                saveSetting('customApiKey', e.target.value);
            });
        }

        const apiModel = document.getElementById('auwb-api-model');
        if (apiModel) {
            apiModel.addEventListener('change', function (e) {
                saveSetting('customApiModel', e.target.value);
            });
        }

        const apiMaxTokens = document.getElementById('auwb-api-max-tokens');
        if (apiMaxTokens) {
            apiMaxTokens.addEventListener('change', function (e) {
                saveSetting('customApiMaxTokens', parseInt(e.target.value, 10) || 4000);
            });
        }

        const apiTimeout = document.getElementById('auwb-api-timeout');
        if (apiTimeout) {
            apiTimeout.addEventListener('change', function (e) {
                saveSetting('customApiTimeout', parseInt(e.target.value, 10) || 120);
            });
        }

        // ========== PRESET EVENT HANDLERS ==========

        const savePresetBtn = document.getElementById('auwb-save-preset-btn');
        const presetNameInput = document.getElementById('auwb-preset-name');
        if (savePresetBtn && presetNameInput) {
            savePresetBtn.addEventListener('click', function () {
                var name = presetNameInput.value.trim();
                if (!name) {
                    showStatus('Please enter a preset name', 'error');
                    return;
                }
                try {
                    savePreset(name);
                    presetNameInput.value = '';
                    showStatus('Preset saved: ' + name, 'success');
                    renderPresetList();
                } catch (e) {
                    showStatus('Failed to save preset: ' + e.message, 'error');
                }
            });
        }

        const exportPresetsBtn = document.getElementById('auwb-export-presets');
        if (exportPresetsBtn) {
            exportPresetsBtn.addEventListener('click', function () {
                try {
                    exportPresets();
                    showStatus('Presets exported!', 'success');
                } catch (e) {
                    showStatus('Failed to export presets: ' + e.message, 'error');
                }
            });
        }

        const importPresetsBtn = document.getElementById('auwb-import-presets');
        const importPresetsFile = document.getElementById('auwb-import-presets-file');
        if (importPresetsBtn && importPresetsFile) {
            importPresetsBtn.addEventListener('click', function () {
                importPresetsFile.click();
            });
            importPresetsFile.addEventListener('change', function (e) {
                if (e.target.files && e.target.files[0]) {
                    var reader = new FileReader();
                    reader.onload = function (evt) {
                        try {
                            var count = importPresets(evt.target.result);
                            showStatus('Imported ' + count + ' presets!', 'success');
                            renderPresetList();
                        } catch (err) {
                            showStatus('Failed to import presets: ' + err.message, 'error');
                        }
                    };
                    reader.readAsText(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        // Render preset list when popup opens (call it here for initial load)
        renderPresetList();

        log('UI events bound successfully');
    }

    function addExtensionMenuButton() {
        const MAX_RETRIES = 20;

        function tryAdd(retryCount) {
            if (document.getElementById('au-world-builder-menu-item')) return;

            const extensionsMenu = document.getElementById('extensionsMenu');
            if (!extensionsMenu) {
                if (retryCount < MAX_RETRIES) {
                    setTimeout(function () { tryAdd(retryCount + 1); }, 500);
                } else {
                    logError('extensionsMenu not found after ' + MAX_RETRIES + ' retries');
                }
                return;
            }

            const menuItem = document.createElement('div');
            menuItem.id = 'au-world-builder-menu-item';
            menuItem.className = 'list-group-item flex-container flexGap5 interactable';
            menuItem.tabIndex = 0;
            menuItem.role = 'listitem';
            menuItem.innerHTML = '<div class="fa-solid fa-globe extensionsMenuExtensionButton"></div> AU World Builder';

            menuItem.addEventListener('click', function () {
                openPopup();
                jQuery('#extensionsMenu').hide();
            });

            extensionsMenu.appendChild(menuItem);
            log('Menu button added to extensionsMenu');
        }

        tryAdd(0);
    }

    async function init() {
        log('=== AU World Builder Initializing ===');
        try {
            getSettings();
            loadCSS();
            const popupLoaded = await loadPopupHTML();
            if (!popupLoaded) {
                logError('Popup HTML not loaded, continuing with menu button only');
            }
            addExtensionMenuButton();
            bindUIEvents();

            // Register prompt injection for auto-injection on send
            const registered = registerPromptInjection();
            if (registered) {
                // Initial update of extension prompt
                updateExtensionPrompt();
            } else {
                // Retry after a short delay if event system wasn't ready
                setTimeout(function() {
                    if (registerPromptInjection()) {
                        updateExtensionPrompt();
                    }
                }, 2000);
            }

            log('=== AU World Builder Initialized Successfully ===');
        } catch (error) {
            logError('Failed to initialize AU World Builder', error);
        }
    }

    jQuery(function () {
        log('jQuery ready, starting initialization...');
        init();
    });

    window.AUWorldBuilder = { openPopup: openPopup, init: init, getSettings: getSettings, saveSettings: saveSettings, updateExtensionPrompt: updateExtensionPrompt, buildInjectionText: buildInjectionText };
})();