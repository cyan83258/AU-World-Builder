/**
 * AU World Builder - UI Management
 */

import { extension_settings, getContext } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { extensionName, defaultSettings, API_SOURCE } from './constants.js';
import { log, logError, getSettings, isCurrentlyProcessing, setProcessing } from './state.js';
import {
    getAUData, updateWorldSetting, updateCharacterSettings, updateClothingStyles,
    updateGenrePrompt, clearAUData, exportAUData, importAUData,
    getCharacterName, getUserName, getChatLength
} from './storage.js';
import { testApiConnection, getApiStatus, getConnectionProfiles, loadModels } from './api.js';
import { generateAUWorld, updateAUWorld, generateGenrePrompt } from './generator.js';
import { injectAUContent, injectAUToPrompt, getInjectionPreview } from './injection.js';

export function openPopup() {
    const popup = document.getElementById('au-world-builder-popup');
    if (popup) {
        popup.style.display = 'flex';
        updateUIFromData();
        updateApiDisplay();
        log('Popup opened');
    }
}

export function closePopup() {
    const popup = document.getElementById('au-world-builder-popup');
    if (popup) {
        popup.style.display = 'none';
        log('Popup closed');
    }
}

export function updateUIFromData() {
    const data = getAUData();
    const charName = getCharacterName();
    const userName = getUserName();

    const conceptInput = document.getElementById('auwb-au-concept');
    if (conceptInput && data.auConcept) conceptInput.value = data.auConcept;

    const worldDisplay = document.getElementById('auwb-world-setting-content');
    if (worldDisplay) worldDisplay.value = data.worldSetting || '';

    const charDisplay = document.getElementById('auwb-char-setting-content');
    if (charDisplay) charDisplay.value = data.characterSettings.char || '';

    const userDisplay = document.getElementById('auwb-user-setting-content');
    if (userDisplay) userDisplay.value = data.characterSettings.user || '';

    const charStyleDisplay = document.getElementById('auwb-char-style-content');
    if (charStyleDisplay) charStyleDisplay.value = data.clothingStyles.char || '';

    const userStyleDisplay = document.getElementById('auwb-user-style-content');
    if (userStyleDisplay) userStyleDisplay.value = data.clothingStyles.user || '';

    const genreDisplay = document.getElementById('auwb-genre-prompt');
    if (genreDisplay) genreDisplay.value = data.genrePrompt || '';

    document.querySelectorAll('.auwb-char-name').forEach(el => { el.textContent = charName; });
    document.querySelectorAll('.auwb-user-name').forEach(el => { el.textContent = userName; });

    const lastUpdateEl = document.getElementById('auwb-last-update');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = data.lastUpdateIndex >= 0 
            ? `Last updated at message #${data.lastUpdateIndex}` : 'Not yet updated';
    }

    const chatLengthEl = document.getElementById('auwb-chat-length');
    if (chatLengthEl) chatLengthEl.textContent = getChatLength();
}

export function updateUIFromSettings() {
    const settings = getSettings();

    const enabledToggle = document.getElementById('auwb-enabled');
    if (enabledToggle) enabledToggle.checked = settings.enabled;

    const autoUpdateToggle = document.getElementById('auwb-auto-update');
    if (autoUpdateToggle) autoUpdateToggle.checked = settings.autoUpdateEnabled;

    const intervalInput = document.getElementById('auwb-update-interval');
    if (intervalInput) intervalInput.value = settings.autoUpdateInterval || 5;

    const genreToggle = document.getElementById('auwb-genre-enabled');
    if (genreToggle) genreToggle.checked = settings.genrePromptEnabled;

    const apiSourceSelect = document.getElementById('auwb-api-source');
    if (apiSourceSelect) apiSourceSelect.value = settings.apiSource;

    updateApiSettingsVisibility();

    const profileSelect = document.getElementById('auwb-connection-profile');
    if (profileSelect) {
        populateConnectionProfiles();
        profileSelect.value = settings.stConnectionProfile || '';
    }

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
}

function updateApiSettingsVisibility() {
    const settings = getSettings();
    const stSettings = document.getElementById('auwb-st-api-settings');
    const customSettings = document.getElementById('auwb-custom-api-settings');

    if (settings.apiSource === API_SOURCE.SILLYTAVERN) {
        if (stSettings) stSettings.style.display = 'block';
        if (customSettings) customSettings.style.display = 'none';
    } else {
        if (stSettings) stSettings.style.display = 'none';
        if (customSettings) customSettings.style.display = 'block';
    }
}

function populateConnectionProfiles() {
    const select = document.getElementById('auwb-connection-profile');
    if (!select) return;

    const profiles = getConnectionProfiles();
    select.innerHTML = '<option value="">Use current API connection</option>';
    profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name;
        select.appendChild(option);
    });
}

export function updateApiDisplay() {
    const status = getApiStatus();
    const displayEl = document.getElementById('auwb-api-status');

    if (displayEl) {
        const statusClass = status.connected ? 'connected' : 'disconnected';
        displayEl.innerHTML = `<span class="auwb-status-indicator ${statusClass}"></span><span>${status.displayName}</span>`;
    }
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('auwb-status-message');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `auwb-status-message ${type}`;
        statusEl.style.display = 'block';
        if (type !== 'error') {
            setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
        }
    }
}

function setLoading(isLoading, buttonId = null) {
    document.querySelectorAll('.auwb-btn').forEach(btn => { btn.disabled = isLoading; });

    if (buttonId) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            if (isLoading) {
                btn.dataset.originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            } else if (btn.dataset.originalText) {
                btn.innerHTML = btn.dataset.originalText;
            }
        }
    }
}

async function handleGenerate() {
    const conceptInput = document.getElementById('auwb-au-concept');
    const concept = conceptInput?.value?.trim();

    if (!concept) {
        showStatus('Please enter an AU concept first.', 'error');
        return;
    }

    setLoading(true, 'auwb-generate-btn');
    showStatus('Generating AU world...', 'info');

    try {
        const result = await generateAUWorld(concept);
        if (result.success) {
            showStatus('AU world generated successfully!', 'success');
            updateUIFromData();
            await injectAUToPrompt();
        } else {
            showStatus(`Generation failed: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        setLoading(false, 'auwb-generate-btn');
    }
}

async function handleManualUpdate() {
    const startInput = document.getElementById('auwb-update-start');
    const endInput = document.getElementById('auwb-update-end');
    const start = parseInt(startInput?.value) || 0;
    const end = parseInt(endInput?.value) || getChatLength() - 1;

    if (start > end) {
        showStatus('Start index must be less than or equal to end index.', 'error');
        return;
    }

    setLoading(true, 'auwb-manual-update-btn');
    showStatus(`Updating from message #${start} to #${end}...`, 'info');

    try {
        const result = await updateAUWorld(start, end);
        if (result.success) {
            showStatus('AU world updated successfully!', 'success');
            updateUIFromData();
            await injectAUToPrompt();
        } else {
            showStatus(`Update failed: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        setLoading(false, 'auwb-manual-update-btn');
    }
}

async function handleGenerateGenre() {
    setLoading(true, 'auwb-generate-genre-btn');
    showStatus('Generating genre/tone prompt...', 'info');

    try {
        const result = await generateGenrePrompt();
        if (result.success) {
            showStatus('Genre prompt generated!', 'success');
            updateUIFromData();
        } else {
            showStatus(`Generation failed: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        setLoading(false, 'auwb-generate-genre-btn');
    }
}

async function handleTestApi() {
    setLoading(true, 'auwb-test-api-btn');
    showStatus('Testing API connection...', 'info');

    try {
        await testApiConnection();
        showStatus('API connection successful!', 'success');
    } catch (error) {
        showStatus(`API test failed: ${error.message}`, 'error');
    } finally {
        setLoading(false, 'auwb-test-api-btn');
    }
}

function handleSaveWorld() {
    const content = document.getElementById('auwb-world-setting-content')?.value || '';
    updateWorldSetting(content);
    showStatus('World setting saved!', 'success');
    injectAUToPrompt();
}

function handleSaveCharacters() {
    const charContent = document.getElementById('auwb-char-setting-content')?.value || '';
    const userContent = document.getElementById('auwb-user-setting-content')?.value || '';
    updateCharacterSettings(charContent, userContent);
    showStatus('Character settings saved!', 'success');
    injectAUToPrompt();
}

function handleSaveStyles() {
    const charStyle = document.getElementById('auwb-char-style-content')?.value || '';
    const userStyle = document.getElementById('auwb-user-style-content')?.value || '';
    updateClothingStyles(charStyle, userStyle);
    showStatus('Clothing styles saved!', 'success');
    injectAUToPrompt();
}

function handleSaveGenre() {
    const prompt = document.getElementById('auwb-genre-prompt')?.value || '';
    updateGenrePrompt(prompt);
    showStatus('Genre prompt saved!', 'success');
    injectAUToPrompt();
}

function handleClearAll() {
    if (confirm('Are you sure you want to clear all AU data? This cannot be undone.')) {
        clearAUData();
        updateUIFromData();
        injectAUToPrompt();
        showStatus('All AU data cleared.', 'success');
    }
}

function handleExport() {
    const data = exportAUData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `au-world-${getCharacterName()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Data exported!', 'success');
}

function handleImport() {
    const input = document.getElementById('auwb-import-file');
    if (input) input.click();
}

function handleFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
            if (importAUData(content)) {
                showStatus('Data imported successfully!', 'success');
                updateUIFromData();
                injectAUToPrompt();
            } else {
                showStatus('Failed to import data. Invalid format.', 'error');
            }
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function handlePreviewInjection() {
    const preview = getInjectionPreview();
    const modal = document.getElementById('auwb-preview-modal');
    const content = document.getElementById('auwb-preview-content');
    if (modal && content) {
        content.textContent = preview;
        modal.style.display = 'flex';
    }
}

function saveSetting(key, value) {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = { ...defaultSettings };
    }
    extension_settings[extensionName][key] = value;
    saveSettingsDebounced();
}

export function bindUIEvents() {
    document.getElementById('auwb-close')?.addEventListener('click', closePopup);
    document.querySelector('#au-world-builder-popup .auwb-popup-overlay')?.addEventListener('click', closePopup);

    document.querySelectorAll('.auwb-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.auwb-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.auwb-tab-content').forEach(content => {
                content.style.display = content.id === `auwb-tab-${tabId}` ? 'block' : 'none';
            });
        });
    });

    document.getElementById('auwb-enabled')?.addEventListener('change', (e) => {
        saveSetting('enabled', e.target.checked);
        if (e.target.checked) injectAUToPrompt();
    });

    document.getElementById('auwb-auto-update')?.addEventListener('change', (e) => {
        saveSetting('autoUpdateEnabled', e.target.checked);
    });

    document.getElementById('auwb-update-interval')?.addEventListener('change', (e) => {
        saveSetting('autoUpdateInterval', parseInt(e.target.value) || 5);
    });

    document.getElementById('auwb-genre-enabled')?.addEventListener('change', (e) => {
        saveSetting('genrePromptEnabled', e.target.checked);
        injectAUToPrompt();
    });

    document.getElementById('auwb-generate-btn')?.addEventListener('click', handleGenerate);
    document.getElementById('auwb-manual-update-btn')?.addEventListener('click', handleManualUpdate);
    document.getElementById('auwb-generate-genre-btn')?.addEventListener('click', handleGenerateGenre);

    document.getElementById('auwb-save-world')?.addEventListener('click', handleSaveWorld);
    document.getElementById('auwb-save-characters')?.addEventListener('click', handleSaveCharacters);
    document.getElementById('auwb-save-styles')?.addEventListener('click', handleSaveStyles);
    document.getElementById('auwb-save-genre')?.addEventListener('click', handleSaveGenre);

    document.getElementById('auwb-clear-all')?.addEventListener('click', handleClearAll);
    document.getElementById('auwb-export')?.addEventListener('click', handleExport);
    document.getElementById('auwb-import')?.addEventListener('click', handleImport);
    document.getElementById('auwb-import-file')?.addEventListener('change', handleFileImport);

    document.getElementById('auwb-preview-injection')?.addEventListener('click', handlePreviewInjection);
    document.getElementById('auwb-preview-close')?.addEventListener('click', () => {
        document.getElementById('auwb-preview-modal').style.display = 'none';
    });

    document.getElementById('auwb-api-source')?.addEventListener('change', (e) => {
        saveSetting('apiSource', e.target.value);
        updateApiSettingsVisibility();
        updateApiDisplay();
    });

    document.getElementById('auwb-connection-profile')?.addEventListener('change', (e) => {
        saveSetting('stConnectionProfile', e.target.value);
        updateApiDisplay();
    });

    document.getElementById('auwb-api-url')?.addEventListener('change', (e) => {
        saveSetting('customApiUrl', e.target.value);
        updateApiDisplay();
    });

    document.getElementById('auwb-api-key')?.addEventListener('change', (e) => {
        saveSetting('customApiKey', e.target.value);
    });

    document.getElementById('auwb-api-model')?.addEventListener('change', (e) => {
        saveSetting('customApiModel', e.target.value);
        updateApiDisplay();
    });

    document.getElementById('auwb-api-max-tokens')?.addEventListener('change', (e) => {
        saveSetting('customApiMaxTokens', parseInt(e.target.value) || 4000);
    });

    document.getElementById('auwb-api-timeout')?.addEventListener('change', (e) => {
        saveSetting('customApiTimeout', parseInt(e.target.value) || 120);
    });

    document.getElementById('auwb-load-models')?.addEventListener('click', async () => {
        try {
            const models = await loadModels();
            const select = document.getElementById('auwb-api-model');
            if (select && models.length > 0) {
                const datalist = document.getElementById('auwb-models-list') || document.createElement('datalist');
                datalist.id = 'auwb-models-list';
                datalist.innerHTML = models.map(m => `<option value="${m}">`).join('');
                if (!document.getElementById('auwb-models-list')) document.body.appendChild(datalist);
                select.setAttribute('list', 'auwb-models-list');
                showStatus(`Loaded ${models.length} models`, 'success');
            }
        } catch (error) {
            showStatus(`Failed to load models: ${error.message}`, 'error');
        }
    });

    document.getElementById('auwb-test-api-btn')?.addEventListener('click', handleTestApi);

    document.getElementById('auwb-debug-mode')?.addEventListener('change', (e) => {
        saveSetting('debugMode', e.target.checked);
    });

    log('UI events bound');
}

export function updateStatusDisplay() {
    updateUIFromData();
}