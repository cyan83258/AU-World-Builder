/**
 * AU World Builder — Core Module
 * Constants, prompt templates, utilities, settings management.
 */
(function (A) {
    'use strict';

    /* ══════════════════════════════════════════════
       Constants
       ══════════════════════════════════════════════ */
    A.extensionName = 'AU-World-Builder';
    A.MODULE_PREFIX = 'au_wb_';
    A.MAX_HISTORY   = 20;
    A.MAX_RETRIES   = 3;
    A.RETRY_BASE_MS = 1500;

    /* Built-in section definitions */
    A.BUILTIN_SECTIONS = [
        { id: 'world',        label: '세계관',          tag: 'WORLD',         injHeader: 'AU World Setting' },
        { id: 'charSetting',  label: '{{char}} 설정',  tag: 'CHAR',          injHeader: '{{char}} - AU Character Setting' },
        { id: 'userSetting',  label: '{{user}} 설정',  tag: 'USER',          injHeader: '{{user}} - AU Character Setting' },
        { id: 'charClothing', label: '{{char}} 복장',  tag: 'CHAR_CLOTHING', injHeader: '{{char}} - Current Clothing/Appearance' },
        { id: 'userClothing', label: '{{user}} 복장',  tag: 'USER_CLOTHING', injHeader: '{{user}} - Current Clothing/Appearance' },
    ];

    /* ══════════════════════════════════════════════
       Prompt Templates
       ══════════════════════════════════════════════ */
    A.DEFAULT_INITIAL_PROMPT = [
        'You are a master-class creative writer, worldbuilder, and narrative designer.',
        'Your task is to craft a deeply immersive, internally consistent AU (Alternate Universe) that feels like a living, breathing world—not a generic outline.',
        '',
        '## CREATIVE DIRECTIVES',
        '{{GUIDELINES}}',
        '',
        '## QUALITY STANDARDS',
        '- Every section must read like polished creative writing, not a wiki summary.',
        '- Use vivid sensory language: sights, sounds, textures, smells, atmosphere.',
        '- Give characters contradictions, unspoken desires, and behavioral quirks that make them feel real.',
        '- The world must have internal logic—rules, social dynamics, and consequences that connect across sections.',
        '- Avoid generic placeholder phrases (e.g., "a mysterious past", "a complex personality"). Be SPECIFIC.',
        '- Each section should contain at least one unexpected detail, hidden connection, or narrative hook.',
        '- Show, don\'t tell: instead of saying "they are close," describe the habits and rituals that reveal closeness.',
        '',
        '{{VOLUME_INSTRUCTION}}',
        '',
        '## AU Concept',
        '{{CONCEPT}}',
        '{{REFERENCE_BLOCK}}',
        '{{RELATIONSHIP_BLOCK}}',
        '',
        '## Source Character Information',
        '- Name: {{CHAR_NAME}}',
        '- Description: {{CHAR_DESC}}',
        '- Personality: {{CHAR_PERS}}',
        '- Scenario: {{CHAR_SCENE}}',
        '',
        '## Source User Information',
        '- Name: {{USER_NAME}}',
        '- Persona: {{USER_PERSONA}}',
        '',
        '## OUTPUT FORMAT — Follow EXACTLY with these markers',
        '',
        '{{OUTPUT_FORMAT}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_UPDATE_PROMPT = [
        'You are a skilled AU narrative editor with a keen eye for meaningful story evolution.',
        '',
        '## YOUR TASK',
        'Analyze the recent chat messages and update the AU settings to reflect significant developments.',
        '',
        '## UPDATE PRINCIPLES',
        '- PRESERVE the existing voice, tone, and writing quality — do not flatten or simplify.',
        '- Only MODIFY content when chat messages reveal genuine changes (e.g., relationship shifts, world-state changes, appearance updates).',
        '- ADD new details that emerged organically from the story.',
        '- Do NOT rewrite sections that had no relevant changes — reproduce them exactly.',
        '- Maintain internal consistency: if one section changes, ensure related sections still make sense.',
        '- Keep the same literary quality and sensory detail level as the originals.',
        '',
        '{{VOLUME_INSTRUCTION}}',
        '',
        '## Character Names',
        '- Character: {{CHAR_NAME}}',
        '- User: {{USER_NAME}}',
        '',
        '## EXISTING AU SETTINGS',
        '{{EXISTING_SETTINGS}}',
        '',
        '## RECENT CHAT MESSAGES (#{{START}} – #{{END}})',
        '{{MESSAGES}}',
        '',
        '## OUTPUT — Use the same tag format',
        '{{OUTPUT_FORMAT}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_GENRE_PROMPT = [
        'You are a literary analyst and creative writing coach.',
        'Analyze the AU world setting below and produce a precise genre/tone directive.',
        '',
        '## World Setting',
        '{{WORLD_SETTING}}',
        '',
        '## INSTRUCTIONS',
        'Write 2–4 sentences that capture:',
        '- Primary and secondary genres (e.g., slice-of-life romance with noir undertones)',
        '- Dominant mood and atmospheric texture (e.g., "warm summer haze with an undercurrent of dread")',
        '- Prose style direction (e.g., lyrical interior monologue, punchy dialogue-driven, atmospheric slow-burn)',
        '- Core thematic tensions (e.g., freedom vs. duty, intimacy vs. self-preservation)',
        '',
        'Be specific and evocative — this will guide all future writing in this AU.',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_SECTION_PROMPT = [
        'You are a master AU worldbuilder and creative writer.',
        'Regenerate ONLY the {{SECTION_LABEL}} section for this AU with fresh, higher-quality content.',
        '',
        '## REGENERATION STANDARDS',
        '- Write as polished creative prose, not a summary or outline.',
        '- Use vivid sensory details and specific, concrete descriptions.',
        '- Include at least one unexpected element, hidden connection, or narrative hook.',
        '- MUST remain internally consistent with all other existing sections.',
        '- If the section describes a character, give them contradictions and behavioral quirks.',
        '- If the section describes a world/setting, include social dynamics and atmosphere.',
        '',
        '{{VOLUME_INSTRUCTION}}',
        '',
        '## AU Concept: {{CONCEPT}}',
        '## Character: {{CHAR_NAME}} — {{CHAR_DESC}}',
        '## User: {{USER_NAME}} — {{USER_PERSONA}}',
        '',
        '## Current AU Settings (context — preserve consistency with these)',
        '{{EXISTING_SETTINGS}}',
        '',
        'Now regenerate ONLY the section below. Output the result wrapped in the tag markers.',
        '{{SECTION_TAG}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_SMART_ANALYSIS_PROMPT = [
        'You are a precise narrative analyst. Your job is to determine whether recent chat messages contain developments that require AU world settings to be updated.',
        '',
        '## Current AU Summary',
        '{{WORLD_SUMMARY}}',
        '',
        '## Recent Messages (#{{START}} – #{{END}})',
        '{{MESSAGES}}',
        '',
        '## ANALYSIS CRITERIA',
        'An update is NEEDED only if messages contain:',
        '- A significant relationship shift (confession, betrayal, new alliance)',
        '- A world-state change (location destroyed, new rule established, season changed)',
        '- A character revelation (hidden identity revealed, power awakened, major decision)',
        '- A permanent appearance change (new outfit established, injury, transformation)',
        '',
        'An update is NOT needed for:',
        '- Normal dialogue or emotional reactions within existing dynamics',
        '- Temporary actions that don\'t change the status quo',
        '- Internal thoughts that don\'t lead to external change',
        '',
        'Reply with EXACTLY one of:',
        '- UPDATE_NEEDED: <brief reason>',
        '- NO_UPDATE_NEEDED',
    ].join('\n');

    A.DEFAULT_BRAINSTORM_PROMPT = [
        'You are a visionary creative director specializing in alternate universe concepts.',
        'Based on the seed idea below, propose EXACTLY 3 wildly different AU directions.',
        '',
        '## BRAINSTORM RULES',
        '- Each idea MUST be genuinely distinct in genre, tone, or premise — not variations of the same theme.',
        '- Each idea must have a clear narrative hook: a central tension, mystery, or dramatic question.',
        '- Ideas should leverage the characters\' unique traits in surprising ways.',
        '- Avoid generic setups (e.g., "coffee shop AU" without a twist). Every concept needs a unique angle.',
        '',
        '## Seed Concept',
        '{{CONCEPT}}',
        '{{REFERENCE_BLOCK}}',
        '',
        '## Characters',
        '- {{CHAR_NAME}}: {{CHAR_DESC}}',
        '- {{USER_NAME}}: {{USER_PERSONA}}',
        '',
        '{{GUIDELINES}}',
        '',
        'For each concept, output in this EXACT format:',
        '[IDEA_1]',
        'Title: (short evocative title that captures the AU\'s essence)',
        'Summary: (2-4 sentences: the world premise, the central dramatic hook, and the unique dynamic between the characters)',
        '[/IDEA_1]',
        '',
        '[IDEA_2]',
        'Title: ...',
        'Summary: ...',
        '[/IDEA_2]',
        '',
        '[IDEA_3]',
        'Title: ...',
        'Summary: ...',
        '[/IDEA_3]',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_REFINE_PROMPT = [
        'You are a senior creative editor with a gift for elevating prose.',
        'Refine ONLY the {{SECTION_LABEL}} section, applying the direction below.',
        '',
        '## REFINEMENT STANDARDS',
        '- Upgrade the writing quality: stronger verbs, more precise imagery, better rhythm.',
        '- Preserve the original meaning, tone, and factual content unless the direction asks otherwise.',
        '- Maintain perfect consistency with all other AU sections.',
        '- The refined version should feel like a natural evolution, not a rewrite from scratch.',
        '- Preserve the approximate length unless the direction asks to expand or condense.',
        '',
        '## Refinement Direction',
        '{{DIRECTION}}',
        '',
        '## Current Content',
        '{{CURRENT_CONTENT}}',
        '',
        '## Full AU Context (for consistency)',
        '{{EXISTING_SETTINGS}}',
        '',
        'Output ONLY the refined content, wrapped in:',
        '{{SECTION_TAG}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_WHATIF_PROMPT = [
        'You are a master of alternate scenarios and butterfly-effect storytelling.',
        'Transform the existing AU based on a "What-If" divergence point.',
        '',
        '## WHAT-IF PRINCIPLES',
        '- Trace the ripple effects of the premise logically through every section.',
        '- Characters should still be recognizable but authentically changed by the altered circumstances.',
        '- The world should feel like a coherent alternate reality, not a random reshuffle.',
        '- Preserve the literary quality and sensory detail of the originals.',
        '- Highlight what\'s eerily similar AND what\'s dramatically different.',
        '',
        '{{VOLUME_INSTRUCTION}}',
        '',
        '## What-If Premise',
        '{{WHATIF_PREMISE}}',
        '',
        '## Current AU Settings (the baseline to diverge from)',
        '{{EXISTING_SETTINGS}}',
        '',
        '## Characters',
        '- {{CHAR_NAME}}: {{CHAR_DESC}}',
        '- {{USER_NAME}}: {{USER_PERSONA}}',
        '',
        '## OUTPUT FORMAT',
        '{{OUTPUT_FORMAT}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    /* ══════════════════════════════════════════════
       Default Settings
       ══════════════════════════════════════════════ */
    A.newSectionCfg = function () {
        return { enabled: true, injPos: 1, injDepth: 4, injRole: 0 };
    };

    A.defaultSettings = {
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
        smartAutoUpdate: true,
        genrePromptEnabled: false,
        debugMode: false,
        outputLanguage: 'korean',
        presets: [],
        chatData: {},
        genOptions: {
            cliche: 'allow', relation: 'first', original: 'break', mood: 'light',
            detailDepth: 'normal', conflict: 'subtle', outputVolume: 'medium',
            genreTags: [], customGenres: [],
        },
        sectionConfig: {
            world:        A.newSectionCfg(),
            charSetting:  A.newSectionCfg(),
            userSetting:  A.newSectionCfg(),
            charClothing: A.newSectionCfg(),
            userClothing: A.newSectionCfg(),
            genre:        A.newSectionCfg(),
        },
        customSections: [],
        customPrompts: { initial: '', update: '', genre: '', section: '', smartAnalysis: '', brainstorm: '', refine: '', whatif: '' },
        customRefineDirections: [],
        sectionOrder: [],
    };

    /* ══════════════════════════════════════════════
       Utility Helpers
       ══════════════════════════════════════════════ */
    A.log = function () {
        console.log('[' + A.extensionName + ']', ...arguments);
    };

    A.logError = function () {
        console.error('[' + A.extensionName + ']', ...arguments);
    };

    var _escDiv = document.createElement('div');
    A.escapeHtml = function (text) {
        _escDiv.textContent = text;
        return _escDiv.innerHTML;
    };

    A.debounce = function (fn, delay) {
        var tid;
        return function () {
            var ctx = this, args = arguments;
            clearTimeout(tid);
            tid = setTimeout(function () { fn.apply(ctx, args); }, delay);
        };
    };

    A.estimateTokens = function (text) {
        if (!text) return 0;
        var cjk = (text.match(/[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/g) || []).length;
        return Math.ceil(cjk * 0.7 + (text.length - cjk) / 4);
    };

    A.escapeRegex = function (s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    A.cleanSection = function (text) {
        return (text || '').replace(/^#+\s*.+$/m, '').replace(/^---+$/gm, '').trim();
    };

    A.fillTemplate = function (tmpl, vars) {
        for (var k in vars) {
            tmpl = tmpl.split('{{' + k + '}}').join(vars[k] || '');
        }
        return tmpl;
    };

    /**
     * Line-level LCS diff (feature C).
     * Returns array of { type:'same'|'added'|'removed', text:string }.
     */
    /**
     * Optimized line-level diff.
     * Trims common prefix/suffix before running LCS on the (smaller) middle.
     * Safety cap prevents huge DP allocations.
     */
    A.diffLines = function (oldText, newText) {
        if (oldText === newText) {
            return oldText ? oldText.split('\n').map(function (l) { return { type: 'same', text: l }; }) : [];
        }
        var oL = (oldText || '').split('\n');
        var nL = (newText || '').split('\n');

        /* Trim common prefix */
        var pLen = 0, mn = Math.min(oL.length, nL.length);
        while (pLen < mn && oL[pLen] === nL[pLen]) pLen++;

        /* Trim common suffix */
        var sLen = 0;
        while (sLen < (oL.length - pLen) && sLen < (nL.length - pLen)
               && oL[oL.length - 1 - sLen] === nL[nL.length - 1 - sLen]) sLen++;

        var same = function (l) { return { type: 'same', text: l }; };
        var prefix = oL.slice(0, pLen).map(same);
        var suffix = sLen ? oL.slice(oL.length - sLen).map(same) : [];
        var mO = oL.slice(pLen, oL.length - sLen);
        var mN = nL.slice(pLen, nL.length - sLen);

        if (!mO.length && !mN.length) return prefix.concat(suffix);
        if (!mO.length) return prefix.concat(mN.map(function (l) { return { type: 'added', text: l }; }), suffix);
        if (!mN.length) return prefix.concat(mO.map(function (l) { return { type: 'removed', text: l }; }), suffix);

        var m = mO.length, n = mN.length;
        /* Safety cap — very large diffs use simple remove+add */
        if (m * n > 250000) {
            return prefix
                .concat(mO.map(function (l) { return { type: 'removed', text: l }; }))
                .concat(mN.map(function (l) { return { type: 'added', text: l }; }))
                .concat(suffix);
        }

        /* LCS on trimmed middle */
        var dp = new Array(m + 1);
        for (var i = 0; i <= m; i++) dp[i] = new Uint16Array(n + 1);
        for (var i = 1; i <= m; i++) {
            for (var j = 1; j <= n; j++) {
                dp[i][j] = mO[i - 1] === mN[j - 1]
                    ? dp[i - 1][j - 1] + 1
                    : (dp[i - 1][j] > dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1]);
            }
        }
        var mid = [], ii = m, jj = n;
        while (ii > 0 || jj > 0) {
            if (ii > 0 && jj > 0 && mO[ii - 1] === mN[jj - 1]) {
                mid.unshift({ type: 'same', text: mO[ii - 1] }); ii--; jj--;
            } else if (jj > 0 && (!ii || dp[ii][jj - 1] >= dp[ii - 1][jj])) {
                mid.unshift({ type: 'added', text: mN[jj - 1] }); jj--;
            } else {
                mid.unshift({ type: 'removed', text: mO[ii - 1] }); ii--;
            }
        }
        return prefix.concat(mid, suffix);
    };

    /* ══════════════════════════════════════════════
       Settings Management
       ══════════════════════════════════════════════ */
    var _settingsCache = null;
    var _migrationDone = false;

    A.getSettings = function () {
        if (_settingsCache) return _settingsCache;

        var ext;
        try {
            var ctx = SillyTavern.getContext();
            ext = ctx && ctx.extensionSettings;
        } catch (_) {}
        ext = ext || window.extension_settings || {};
        window.extension_settings = ext;

        if (!ext[A.extensionName]) ext[A.extensionName] = {};
        var s = ext[A.extensionName];

        for (var k in A.defaultSettings) {
            if (s[k] === undefined) {
                s[k] = (typeof A.defaultSettings[k] === 'object' && A.defaultSettings[k] !== null)
                    ? JSON.parse(JSON.stringify(A.defaultSettings[k]))
                    : A.defaultSettings[k];
            }
        }

        if (!_migrationDone) {
            A.migrateV2(s);
            _migrationDone = true;
        }

        _settingsCache = s;
        return s;
    };

    /** Invalidate settings cache (called when context might change) */
    A.invalidateSettingsCache = function () { _settingsCache = null; };

    /**
     * Migrate from v2.0 (sectionToggles + global injection) → v2.1 (per-section config).
     */
    A.migrateV2 = function (s) {
        if (s.sectionToggles && !s._mig21) {
            var ot  = s.sectionToggles;
            var pos = s.injectionPosition != null ? s.injectionPosition : 1;
            var dep = s.injectionDepth    != null ? s.injectionDepth    : 4;
            var rol = s.injectionRole     != null ? s.injectionRole     : 0;

            if (!s.sectionConfig) s.sectionConfig = {};

            ['world', 'charSetting', 'userSetting', 'charClothing', 'userClothing', 'genre'].forEach(function (k) {
                if (!s.sectionConfig[k]) s.sectionConfig[k] = {};
                s.sectionConfig[k].enabled  = ot[k] !== false;
                s.sectionConfig[k].injPos   = pos;
                s.sectionConfig[k].injDepth = dep;
                s.sectionConfig[k].injRole  = rol;
            });

            delete s.sectionToggles;
            delete s.injectionPosition;
            delete s.injectionDepth;
            delete s.injectionRole;
            s._mig21 = true;
        }

        /* Clear legacy single-module prompt (once) */
        if (!s._legacyCleared) {
            try { SillyTavern.getContext().setExtensionPrompt('au_world_builder_injection', '', -1, 0); } catch (_) {}
            s._legacyCleared = true;
        }

        if (!s.customSections) s.customSections = [];
        if (!s.sectionConfig)  s.sectionConfig  = {};

        if (!s._secCfgReady) {
            ['world', 'charSetting', 'userSetting', 'charClothing', 'userClothing', 'genre'].forEach(function (k) {
                if (!s.sectionConfig[k]) s.sectionConfig[k] = A.newSectionCfg();
            });
            s._secCfgReady = true;
        }

        /* v2.2 migration: expand genOptions with new defaults */
        if (s.genOptions) {
            if (s.genOptions.relation === 'known') s.genOptions.relation = 'friend';
            if (s.genOptions.detailDepth === undefined) s.genOptions.detailDepth = 'normal';
            if (s.genOptions.conflict === undefined)    s.genOptions.conflict = 'subtle';
            if (s.genOptions.outputVolume === undefined) s.genOptions.outputVolume = 'medium';
            if (!Array.isArray(s.genOptions.genreTags))  s.genOptions.genreTags = [];
            if (!Array.isArray(s.genOptions.customGenres)) s.genOptions.customGenres = [];
            /* Rename legacy tag */
            ['genreTags', 'customGenres'].forEach(function (k) {
                var idx = s.genOptions[k].indexOf('앙스트');
                if (idx !== -1) s.genOptions[k][idx] = '앵스트';
            });
        }

        /* v2.3 migration */
        if (!Array.isArray(s.customRefineDirections)) s.customRefineDirections = [];
        if (!Array.isArray(s.sectionOrder)) s.sectionOrder = [];
    };

    var _saveQueued = false;
    A.saveSettings = function () {
        if (_saveQueued) return;
        _saveQueued = true;
        requestAnimationFrame(function () {
            _saveQueued = false;
            try {
                var ctx = SillyTavern.getContext();
                if (ctx && ctx.saveSettingsDebounced) { ctx.saveSettingsDebounced(); return; }
            } catch (_) {}
            if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
        });
    };

    /* ══════════════════════════════════════════════
       Chat-Data Helpers
       ══════════════════════════════════════════════ */
    A.chatSpecificKeys = [
        'worldSetting', 'characterSettings', 'clothingStyles',
        'genrePrompt', 'auConcept', 'history', 'customSectionData',
        'reference', 'relationship', 'whatIfBranches',
    ];

    A.getCurrentChatId = function () {
        try {
            var ctx = SillyTavern.getContext();
            if (ctx.chatId) return ctx.chatId;
            if (ctx.chat_metadata && ctx.chat_metadata.chat_id) return ctx.chat_metadata.chat_id;
            if (ctx.characters && ctx.characterId != null) {
                return (ctx.characters[ctx.characterId]?.name || 'unk') + '_' + (ctx.chatId || 'def');
            }
        } catch (_) {}
        return null;
    };

    A.getChatData = function () {
        var id = A.getCurrentChatId();
        if (!id) return {};
        var s = A.getSettings();
        return (s.chatData && s.chatData[id]) || {};
    };

    A.saveChatData = function (key, value) {
        var id = A.getCurrentChatId();
        if (!id) return;
        var s = A.getSettings();
        if (!s.chatData)     s.chatData = {};
        if (!s.chatData[id]) s.chatData[id] = {};
        s.chatData[id][key] = value;
        A.saveSettings();
    };

    /* Keys that affect prompt injection — only these trigger updateExtensionPrompt */
    var _injKeys = [
        'enabled', 'genrePromptEnabled', 'sectionConfig',
        'worldSetting', 'characterSettings', 'clothingStyles',
        'genrePrompt', 'customSectionData',
    ];

    A.saveSetting = function (key, value) {
        if (A.chatSpecificKeys.indexOf(key) !== -1) {
            A.saveChatData(key, value);
        } else {
            A.getSettings()[key] = value;
            A.saveSettings();
        }
        if (_injKeys.indexOf(key) !== -1) {
            A.updateExtensionPrompt();
        }
    };

    /* ══════════════════════════════════════════════
       DOM Helpers
       ══════════════════════════════════════════════ */
    A.setVal = function (id, v) {
        var el = document.getElementById(id);
        if (el) el.value = v;
    };

    A.getElVal = function (id) {
        var el = document.getElementById(id);
        return el ? el.value : '';
    };

    A.setChecked = function (id, v) {
        var el = document.getElementById(id);
        if (el) el.checked = !!v;
    };

    A.setSelectVal = function (id, v) {
        var el = document.getElementById(id);
        if (el) el.value = v;
    };

})(window.AUWB);
