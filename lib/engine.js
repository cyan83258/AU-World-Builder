/**
 * AU World Builder — Engine Module
 * API calls, parsing, generation, updates, history, diff, injection.
 */
(function (A) {
    'use strict';

    /* ══════════════════════════════════════════════
       Connection Profiles
       ══════════════════════════════════════════════ */
    A.getConnectionProfiles = function () {
        try {
            var ctx = SillyTavern.getContext();
            var cm  = ctx.extensionSettings && ctx.extensionSettings.connectionManager;
            return cm ? cm.profiles || [] : [];
        } catch (_) { return []; }
    };

    A.getCurrentProfileName = function () {
        try {
            var ctx = SillyTavern.getContext();
            var cm  = ctx.extensionSettings && ctx.extensionSettings.connectionManager;
            if (cm && cm.selectedProfile) {
                var p = cm.profiles.find(function (x) { return x.id === cm.selectedProfile; });
                return p ? p.name : null;
            }
        } catch (_) {}
        return null;
    };

    A.getProfileNameById = function (id) {
        try {
            var ctx = SillyTavern.getContext();
            var cm  = ctx.extensionSettings && ctx.extensionSettings.connectionManager;
            if (cm) {
                var p = cm.profiles.find(function (x) { return x.id === id; });
                return p ? p.name : null;
            }
        } catch (_) {}
        return null;
    };

    A.switchToProfile = async function (name) {
        if (!name) return false;
        try {
            var ctx = SillyTavern.getContext();
            var fn  = ctx.executeSlashCommandsWithOptions || ctx.executeSlashCommands;
            if (fn) {
                await fn('/profile ' + name);
                await new Promise(function (r) { setTimeout(r, 1500); });
                return true;
            }
        } catch (_) {}
        return false;
    };

    /* ══════════════════════════════════════════════
       API with Retry
       ══════════════════════════════════════════════ */
    A.callAPI = async function (prompt) {
        var settings    = A.getSettings();

        /* K: Custom OpenAI-compatible API */
        if (settings.apiSource === 'openai') {
            var url = settings.customApiUrl;
            if (!url) throw new Error('Custom API URL이 설정되지 않았습니다.');
            var headers = { 'Content-Type': 'application/json' };
            if (settings.customApiKey) headers['Authorization'] = 'Bearer ' + settings.customApiKey;
            var body = {
                model: settings.customApiModel || 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: settings.customApiMaxTokens || 4000,
            };
            var ctrl = new AbortController();
            var tid  = setTimeout(function () { ctrl.abort(); }, (settings.customApiTimeout || 120) * 1000);
            try {
                var resp = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal });
                clearTimeout(tid);
                if (!resp.ok) throw new Error('HTTP ' + resp.status + ': ' + (await resp.text()).substring(0, 200));
                var data = await resp.json();
                var result = '';
                if (data.choices && data.choices[0]) {
                    result = data.choices[0].message ? data.choices[0].message.content : (data.choices[0].text || '');
                }
                if (!result) throw new Error('Empty response from custom API');
                return result;
            } catch (e) { clearTimeout(tid); throw e; }
        }

        /* SillyTavern API */
        var selectedId  = settings.connectionProfile;
        var originalProfile = null, switched = false;

        try {
            /* Optionally switch connection profile */
            if (selectedId) {
                var targetName = A.getProfileNameById(selectedId);
                if (targetName) {
                    originalProfile = A.getCurrentProfileName();
                    if (originalProfile !== targetName) {
                        switched = await A.switchToProfile(targetName);
                    }
                }
            }

            var result = '';
            var ctx = SillyTavern.getContext();

            /* F13: Timeout for SillyTavern API */
            var stTimeout = (settings.customApiTimeout || 120) * 1000;
            function _withTimeout(p) {
                var tid;
                return Promise.race([
                    p,
                    new Promise(function (_, rej) {
                        tid = setTimeout(function () { rej(new Error('SillyTavern API 시간 초과 (' + Math.round(stTimeout / 1000) + '초)')); }, stTimeout);
                    }),
                ]).finally(function () { clearTimeout(tid); });
            }

            if (ctx.generateRaw) {
                result = await _withTimeout(ctx.generateRaw({
                    prompt: prompt, maxContext: null,
                    quietToLoud: false, skipWIAN: true, skipAN: true,
                }));
            } else if (ctx.generateQuietPrompt) {
                result = await _withTimeout(ctx.generateQuietPrompt(prompt, false, false));
            }

            if (!result && typeof generateQuietPrompt === 'function') {
                result = await _withTimeout(generateQuietPrompt(prompt, false, false));
            }

            if (!result) throw new Error('No API function available or empty result');
            return result;
        } finally {
            if (switched && originalProfile) await A.switchToProfile(originalProfile);
        }
    };

    A.callAPIWithRetry = async function (prompt, retries) {
        if (retries === undefined) retries = A.MAX_RETRIES;
        var lastErr;

        for (var attempt = 0; attempt < retries; attempt++) {
            try {
                return await A.callAPI(prompt);
            } catch (e) {
                lastErr = e;
                if (attempt < retries - 1) {
                    var delay = A.RETRY_BASE_MS * Math.pow(2, attempt);
                    A.log('Retry ' + (attempt + 1) + '/' + retries + ' in ' + delay + 'ms');
                    A.showStatus('API 재시도 중 (' + (attempt + 1) + '/' + retries + ')…', 'info');
                    await new Promise(function (r) { setTimeout(r, delay); });
                }
            }
        }
        throw lastErr;
    };

    A.testApiConnection = async function () {
        var r = await A.callAPIWithRetry("Test connection. Reply with 'OK'.", 1);
        if (r) return true;
        throw new Error('Empty');
    };

    /* ══════════════════════════════════════════════
       Robust Parsing (+ custom tags)
       ══════════════════════════════════════════════ */
    function hasAny(p) {
        return !!(p.world || p.worldLife || p.worldRules || p.charSetting || p.userSetting || p.charRelation || p.charHistory);
    }

    A.parseGeneratedContent = function (content) {
        if (!content) return {};
        var p;
        p = parseWithTags(content);       if (hasAny(p)) return p;
        p = parseWithMarkdown(content);    if (hasAny(p)) return p;
        p = parseWithSeparators(content);  if (hasAny(p)) return p;
        A.log('Parsing: fallback → entire response as world');
        return { world: content.trim() };
    };

    function parseWithTags(c) {
        var p = {}, m;

        m = c.match(/\[WORLD\]([\s\S]*?)\[\/WORLD\]/i);                 if (m) p.world = m[1].trim();
        m = c.match(/\[CHAR\]([\s\S]*?)\[\/CHAR\]/i);                   if (m) p.charSetting = m[1].trim();
        m = c.match(/\[USER\]([\s\S]*?)\[\/USER\]/i);                   if (m) p.userSetting = m[1].trim();
        m = c.match(/\[CHAR_CLOTHING\]([\s\S]*?)\[\/CHAR_CLOTHING\]/i); if (m) p.charClothing = m[1].trim();
        m = c.match(/\[USER_CLOTHING\]([\s\S]*?)\[\/USER_CLOTHING\]/i); if (m) p.userClothing = m[1].trim();

        /* New sub-sections */
        m = c.match(/\[WORLD_LIFE\]([\s\S]*?)\[\/WORLD_LIFE\]/i);               if (m) p.worldLife = m[1].trim();
        m = c.match(/\[WORLD_RULES\]([\s\S]*?)\[\/WORLD_RULES\]/i);             if (m) p.worldRules = m[1].trim();
        m = c.match(/\[CHAR_PERSONALITY\]([\s\S]*?)\[\/CHAR_PERSONALITY\]/i);   if (m) p.charPersonality = m[1].trim();
        m = c.match(/\[USER_PERSONALITY\]([\s\S]*?)\[\/USER_PERSONALITY\]/i);   if (m) p.userPersonality = m[1].trim();
        m = c.match(/\[CHAR_RELATION\]([\s\S]*?)\[\/CHAR_RELATION\]/i);           if (m) p.charRelation = m[1].trim();
        m = c.match(/\[CHAR_HISTORY\]([\s\S]*?)\[\/CHAR_HISTORY\]/i);             if (m) p.charHistory = m[1].trim();

        /* Alternative tag formats */
        if (!p.world) {
            m = c.match(/\[WORLD_SETTING\]([\s\S]*?)\[\/WORLD_SETTING\]/i);
            if (m) p.world = m[1].trim();
        }
        if (!p.charSetting) {
            m = c.match(/\[CHARACTER_CHAR\]([\s\S]*?)(?=\[CHARACTER_USER\]|\[STYLE_|\[|$)/i);
            if (m) p.charSetting = m[1].trim();
        }
        if (!p.userSetting) {
            m = c.match(/\[CHARACTER_USER\]([\s\S]*?)(?=\[STYLE_|\[|$)/i);
            if (m) p.userSetting = m[1].trim();
        }
        if (!p.charClothing) {
            m = c.match(/\[STYLE_CHAR\]([\s\S]*?)(?=\[STYLE_USER\]|\[|$)/i);
            if (m) p.charClothing = m[1].trim();
        }
        if (!p.userClothing) {
            m = c.match(/\[STYLE_USER\]([\s\S]*?)(?=\[|$)/i);
            if (m) p.userClothing = m[1].trim();
        }

        /* Custom section tags (feature D) */
        (A.getSettings().customSections || []).forEach(function (cs) {
            var tag = 'CUSTOM_' + cs.id.replace('custom_', '');
            var re  = new RegExp('\\[' + tag + '\\]([\\s\\S]*?)\\[\\/' + tag + '\\]', 'i');
            var cm  = c.match(re);
            if (cm) p[cs.id] = cm[1].trim();
        });

        return p;
    }

    function parseWithMarkdown(c) {
        var p  = {};
        var ci = A.getCharacterInfo();

        var wm = c.match(/#+\s*(?:World\s*Setting|세계관\s*설정|World\s*Overview)([\s\S]*?)(?=#+\s*(?:Character|캐릭터)|$)/i);
        if (wm) p.world = A.cleanSection(wm[1]);

        var charRe = new RegExp(
            '#+\\s*(?:' + A.escapeRegex(ci.charName) +
            '|\\{\\{char\\}\\})(?:\\s*(?:설정|Setting|Profile))?([\\s\\S]*?)(?=#+|$)', 'i'
        );
        var cm = c.match(charRe);
        if (cm) p.charSetting = A.cleanSection(cm[1]);

        var userRe = new RegExp(
            '#+\\s*(?:' + A.escapeRegex(ci.userName) +
            '|\\{\\{user\\}\\})(?:\\s*(?:설정|Setting|Profile))?([\\s\\S]*?)(?=#+|$)', 'i'
        );
        var um = c.match(userRe);
        if (um) p.userSetting = A.cleanSection(um[1]);

        return p;
    }

    function parseWithSeparators(c) {
        var p = {};
        var secs = c.split(/---+/).map(function (s) { return s.trim(); }).filter(Boolean);

        if (secs.length >= 2) {
            p.world       = A.cleanSection(secs[0]);
            p.charSetting = A.cleanSection(secs[1]);
            if (secs.length >= 3) p.userSetting  = A.cleanSection(secs[2]);
            if (secs.length >= 4) p.charClothing = A.cleanSection(secs[3]);
            if (secs.length >= 5) p.userClothing = A.cleanSection(secs[4]);
        }

        if (!hasAny(p)) {
            var numbered = c.split(/\n(?=\d+\.\s)/)
                .map(function (s) { return s.replace(/^\d+\.\s*/, '').trim(); })
                .filter(Boolean);
            if (numbered.length >= 2) {
                p.world        = numbered[0];
                p.charSetting  = numbered[1] || '';
                p.userSetting  = numbered[2] || '';
                p.charClothing = numbered[3] || '';
                p.userClothing = numbered[4] || '';
            }
        }
        return p;
    }

    /* ══════════════════════════════════════════════
       History & Diff (feature C)
       ══════════════════════════════════════════════ */
    A.getHistory = function () {
        return A.getChatData().history || [];
    };

    A.saveToHistory = function (type, snapshot) {
        var h = A.getChatData().history || [];
        h.unshift({
            id:        Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            timestamp: Date.now(),
            type:      type,
            snapshot:  snapshot,  /* P: snapshot already contains only non-empty values */
        });
        if (h.length > A.MAX_HISTORY) h = h.slice(0, A.MAX_HISTORY);
        A.saveChatData('history', h);
    };

    A.rollbackToVersion = function (hid) {
        var entry = A.getHistory().find(function (h) { return h.id === hid; });
        if (!entry) {
            A.showStatus('히스토리 항목을 찾을 수 없습니다.', 'error');
            return;
        }
        var snap = entry.snapshot;
        /* P: Clear all sections first, then apply snapshot (handles missing keys = empty) */
        A.getAllSections().forEach(function (sec) {
            A.setSectionContent(sec.id, snap[sec.id] || '');
        });
        if (snap.genrePrompt !== undefined) A.saveChatData('genrePrompt', snap.genrePrompt);
        else A.saveChatData('genrePrompt', '');
        A.loadChatDataToUI();
        A.updateExtensionPrompt();
        A.showStatus('버전이 복원되었습니다!', 'success');
    };

    A.computeSnapshotDiff = function (before, after) {
        var diffs = [];
        A.getAllSections().forEach(function (sec) {
            var o = before[sec.id] || '', n = after[sec.id] || '';
            if (o !== n) {
                diffs.push({ id: sec.id, label: sec.label, lines: A.diffLines(o, n) });
            }
        });
        if ((before.genrePrompt || '') !== (after.genrePrompt || '')) {
            diffs.push({
                id: 'genre', label: '장르/톤',
                lines: A.diffLines(before.genrePrompt || '', after.genrePrompt || ''),
            });
        }
        return diffs;
    };

    /* ══════════════════════════════════════════════
       Prompt & Generation Helpers
       ══════════════════════════════════════════════ */
    A.getPromptTemplate = function (key) {
        var cp = A.getSettings().customPrompts || {};
        var v  = cp[key];
        if (v && v.trim()) return v;
        return {
            initial:          A.DEFAULT_INITIAL_PROMPT,
            update:           A.DEFAULT_UPDATE_PROMPT,
            genre:            A.DEFAULT_GENRE_PROMPT,
            section:          A.DEFAULT_SECTION_PROMPT,
            smartAnalysis:    A.DEFAULT_SMART_ANALYSIS_PROMPT,
            brainstorm:       A.DEFAULT_BRAINSTORM_PROMPT,
            refine:           A.DEFAULT_REFINE_PROMPT,
            whatif:            A.DEFAULT_WHATIF_PROMPT,
            partialRegen:     A.DEFAULT_PARTIAL_REGEN_PROMPT,
            consistencyCheck: A.DEFAULT_CONSISTENCY_CHECK_PROMPT,
        }[key] || '';
    };

    A.buildGuidelines = function () {
        var s    = A.getSettings();
        var opts = s.genOptions || {};
        var ci   = A.getCharacterInfo();
        var g    = [];

        /* Cliche */
        g.push(opts.cliche === 'subvert'
            ? '- SUBVERT CLICHES: Twist expectations.'
            : '- CLICHES ALLOWED: Classic tropes are fine.');

        /* Original — 4 levels */
        var origMap = {
            break:  '- FULL REIMAGINING: Completely reinvent characters for this AU. Original traits are raw material to transform freely.',
            loose:  '- LOOSE INSPIRATION: Use the original characters as a mood/vibe reference. Keep the general "feel" (e.g., a warm-hearted character stays warm-hearted), but freely change specific traits, habits, and details. Do NOT copy individual characteristics verbatim.',
            core:   '- CORE TRAITS ONLY: Preserve the essential personality pillars (e.g., kind, stubborn, ambitious) but adapt surface details, habits, and quirks to fit the AU naturally. Avoid fixating on minor or physical traits.',
            keep:   '- FAITHFUL PRESERVATION: Keep all major character traits, relationships, and personality intact. Adapt only what the AU premise absolutely requires.',
        };
        g.push(origMap[opts.original] || origMap.loose);

        /* Relation — 5 levels (#4) */
        var relMap = {
            first:    '- FIRST MEETING: ' + ci.charName + ' and ' + ci.userName + ' are complete strangers.',
            acquaint: '- ACQUAINTANCES: They know of each other but are not close.',
            friend:   '- FRIENDS: They have an existing friendly relationship.',
            close:    '- CLOSE/INTIMATE: They share a deep bond or romantic connection.',
            complex:  '- COMPLEX HISTORY: They have a complicated, layered past (rivalry, ex-friends, etc.).',
        };
        g.push(relMap[opts.relation] || relMap.first);

        /* Mood — 3 options */
        var moodMap = {
            light:       '- LIGHT ATMOSPHERE: Bright, comedic, heartwarming.',
            dark:        '- DARK ATMOSPHERE: Serious, dramatic, intense.',
            bittersweet: '- BITTERSWEET: Mix of warmth and melancholy, nuanced emotions.',
        };
        g.push(moodMap[opts.mood] || moodMap.light);

        /* Conflict (#2) */
        var conflictMap = {
            none:    '',
            subtle:  '- SUBTLE TENSION: Weave underlying conflicts and unspoken tensions into settings.',
            central: '- CENTRAL CONFLICT: Build a clear driving conflict that shapes the AU world.',
        };
        if (opts.conflict && conflictMap[opts.conflict]) g.push(conflictMap[opts.conflict]);

        /* Detail Depth (#9) */
        var depthMap = {
            minimal:  '- CONCISE: Keep descriptions brief and essential.',
            normal:   '',
            detailed: '- RICH DETAIL: Add sensory details, hidden layers, and symbolic motifs.',
            extreme:  '- MAXIMUM DEPTH: Extremely detailed — subtext, micro-details, cultural nuances, interconnected symbolism.',
        };
        if (opts.detailDepth && depthMap[opts.detailDepth]) g.push(depthMap[opts.detailDepth]);

        /* Genre Tags (#3) */
        if (opts.genreTags && opts.genreTags.length) {
            g.push('- GENRE MIX: Blend these elements naturally — ' + opts.genreTags.join(', ') + '.');
        }

        /* Quality hints (— always included) */
        g.push('- DEPTH: Characters must have contradictions and unspoken motivations. Worlds must have hidden rules and consequences.');
        g.push('- SPECIFICITY: Replace every generic phrase with concrete, vivid, sensory details. No placeholders.');
        g.push('- HOOKS: Each section needs at least one surprising element — an unexpected rule, a hidden connection, a revealing habit, or a symbolic motif.');
        g.push('- COHERENCE: All sections must reference and reinforce each other. The AU should feel like one interconnected world, not isolated entries.');

        return g.join('\n');
    };

    A.getLangInstruction = function () {
        return A.getSettings().outputLanguage === 'korean'
            ? 'CRITICAL: Write ALL content in Korean (한국어). Be literary and evocative. Use natural Korean prose with rich vocabulary.'
            : 'CRITICAL: Write ALL content in English. Be literary and evocative. Use varied sentence structures and precise vocabulary.';
    };

    /** Output volume instruction based on user setting */
    A.getVolumeInstruction = function () {
        var vol = (A.getSettings().genOptions || {}).outputVolume || 'medium';
        var map = {
            compact: '## LENGTH DIRECTIVE\nWrite CONCISELY. Each section should be tight and focused (1–2 short paragraphs). Prioritize impact over length. No filler.',
            medium:  '',
            long:    '## LENGTH DIRECTIVE\nWrite GENEROUSLY. Develop each section with rich detail and layered prose (expand by ~50% beyond default). Add subplots, micro-details, and atmospheric texture. Every paragraph should earn its space.',
            very_long: '## LENGTH DIRECTIVE\nWrite EXTENSIVELY. Produce deeply detailed, immersive content for every section (expand by ~100–150% beyond default). Include embedded world lore, character micro-stories, sensory atmosphere, and interconnected symbolic motifs. Leave no section shallow.',
        };
        return map[vol] || '';
    };

    /** Dynamic OUTPUT_FORMAT based on enabled sections (feature D) + detail depth (#9)
     *  A: Optional filterIds array to limit which sections are included */
    A.buildOutputFormat = function (filterIds) {
        var ci   = A.getCharacterInfo();
        var opts = (A.getSettings().genOptions || {});
        var depth = opts.detailDepth || 'normal';
        var vol   = opts.outputVolume || 'medium';

        /* Base paragraph counts from detailDepth */
        var worldBase = { minimal: 1, normal: 3, detailed: 4, extreme: 5 }[depth] || 3;
        var charBase  = { minimal: 1, normal: 2, detailed: 3, extreme: 4 }[depth] || 2;
        var clothBase = { minimal: 1, normal: 1, detailed: 2, extreme: 2 }[depth] || 1;

        /* Volume multiplier */
        var volMul = { compact: 0.7, medium: 1, long: 1.5, very_long: 2 }[vol] || 1;
        var worldP = Math.max(1, Math.round(worldBase * volMul));
        var charP  = Math.max(1, Math.round(charBase  * volMul));
        var clothP = Math.max(1, Math.round(clothBase * volMul));

        var sections = A.getEnabledSections();
        if (filterIds && filterIds.length) {
            sections = sections.filter(function (s) { return filterIds.indexOf(s.id) !== -1; });
        }

        return sections.map(function (sec) {
            var desc;
            switch (sec.id) {
                case 'world':
                    desc = '(' + worldP + ' paragraphs: world setting overview — time period, core concept, geography & atmosphere, key tensions)';
                    break;
                case 'worldLife':
                    desc = '(' + Math.max(1, worldP - 1) + ' paragraphs: daily life & culture — social norms, customs, routines, how people interact in this world)';
                    break;
                case 'worldRules':
                    desc = '(' + Math.max(1, worldP - 1) + ' paragraphs: special rules & systems — magic/technology rules, power structures, unique mechanics, taboos & consequences)';
                    break;
                case 'charSetting':
                    desc = '(' + charP + ' paragraphs about ' + ci.charName + ': AU role, occupation, social position, reputation, daily routine & external circumstances)';
                    break;
                case 'charPersonality':
                    desc = '(' + charP + ' paragraphs about ' + ci.charName + ': personality, inner conflicts, contradictions, unspoken desires, fears, behavioral quirks & hidden depths)';
                    break;
                case 'userSetting':
                    desc = '(' + charP + ' paragraphs about ' + ci.userName + ': AU role, occupation, social position, what brought them into the story, external circumstances)';
                    break;
                case 'userPersonality':
                    desc = '(' + charP + ' paragraphs about ' + ci.userName + ': personality, private self, dynamic with ' + ci.charName + ', personal stakes & motivations)';
                    break;
                case 'charRelation':
                    desc = '(' + charP + ' paragraphs: the current relationship between ' + ci.charName + ' and ' + ci.userName + ' — dynamic, power balance, unspoken tensions, how they perceive each other, emotional distance or closeness, recurring friction & moments of connection)';
                    break;
                case 'charHistory':
                    desc = '(' + charP + ' paragraphs: shared past between ' + ci.charName + ' and ' + ci.userName + ' — how they met, pivotal events, misunderstandings or bonding moments, debts or promises, how history shapes their present interactions)';
                    break;
                case 'charClothing':
                    desc = "(" + clothP + " detailed paragraph(s): " + ci.charName + "'s signature look — colors, textures, accessories, what the style reveals about them)";
                    break;
                case 'userClothing':
                    desc = "(" + clothP + " detailed paragraph(s): " + ci.userName + "'s attire — style choices, comfort vs. presentation, distinctive details)";
                    break;
                default:
                    desc = '(Detailed content for: ' + sec.label + ')';
                    break;
            }
            return '[' + sec.tag + ']\n' + desc + '\n[/' + sec.tag + ']';
        }).join('\n\n');
    };

    /** EXISTING_SETTINGS for all enabled sections (feature D) */
    A.buildExistingSettings = function () {
        var lines = [];
        A.getEnabledSections().forEach(function (sec) {
            var c = A.getSectionContent(sec.id) || '(Not yet established)';
            lines.push('### ' + sec.label + ': ' + c);
        });

        var genreCfg = (A.getSettings().sectionConfig || {}).genre || A.newSectionCfg();
        if (genreCfg.enabled !== false) {
            var gp = A.getChatData().genrePrompt || '';
            if (gp) lines.push('### Genre/Tone: ' + gp);
        }
        return lines.join('\n');
    };

    /* ══════════════════════════════════════════════
       Content Generation (feature D-aware)
       ══════════════════════════════════════════════ */
    A.generateAUWorld = async function (concept, filterIds) {
        var ci  = A.getCharacterInfo();
        var cd  = A.getChatData();
        var ref = cd.reference || '';
        var rel = cd.relationship || '';

        return await A.callAPIWithRetry(A.fillTemplate(A.getPromptTemplate('initial'), {
            GUIDELINES:         A.buildGuidelines(),
            CONCEPT:            concept,
            REFERENCE_BLOCK:    ref ? '\n## Reference / Inspiration\n' + ref : '',
            RELATIONSHIP_BLOCK: rel ? '\n## Character Relationship\n' + rel : '',
            CHAR_NAME:          ci.charName,
            CHAR_DESC:          ci.charDescription || 'Not provided',
            CHAR_PERS:          ci.charPersonality || 'Not provided',
            CHAR_SCENE:         ci.charScenario    || 'Not provided',
            USER_NAME:          ci.userName,
            USER_PERSONA:       ci.personaDescription || 'Not provided',
            OUTPUT_FORMAT:      A.buildOutputFormat(filterIds),
            LANG_INSTRUCTION:   A.getLangInstruction(),
            VOLUME_INSTRUCTION: A.getVolumeInstruction(),
            EXISTING_SETTINGS:  '',
        }));
    };

    /** Regenerate a single section (checks if enabled — feature D) */
    A.regenerateSection = async function (sectionKey) {
        if (!A.isSectionEnabled(sectionKey)) {
            throw new Error('해당 섹션이 비활성화되어 있습니다.');
        }
        if (A.isSectionLocked(sectionKey)) {
            throw new Error('해당 섹션이 잠금 상태입니다. 잠금을 해제하고 다시 시도하세요.');
        }

        var ci  = A.getCharacterInfo();
        var sec = A.getAllSections().find(function (s) { return s.id === sectionKey; });
        if (!sec) throw new Error('Unknown section: ' + sectionKey);

        var cd      = A.getChatData();
        var tagPart = '[' + sec.tag + ']\n(Detailed content for: ' + sec.label + ')\n[/' + sec.tag + ']';

        var result = await A.callAPIWithRetry(A.fillTemplate(A.getPromptTemplate('section'), {
            SECTION_LABEL:     sec.label,
            CONCEPT:           cd.auConcept || '',
            CHAR_NAME:         ci.charName,
            CHAR_DESC:         ci.charDescription || '',
            USER_NAME:         ci.userName,
            USER_PERSONA:      ci.personaDescription || '',
            EXISTING_SETTINGS: A.buildExistingSettings(),
            SECTION_TAG:       tagPart,
            LANG_INSTRUCTION:  A.getLangInstruction(),
            VOLUME_INSTRUCTION: A.getVolumeInstruction(),
        }));

        if (!result) throw new Error('Empty response');
        var parsed = A.parseGeneratedContent(result);
        return {
            section: sectionKey,
            value:   parsed[sectionKey] || result.replace(/\[.*?\]/g, '').trim(),
        };
    };

    /** Partial regeneration — rewrite only selected text within a section */
    A.regenerateSectionPartial = async function (sectionKey, selectedText, instruction) {
        if (!A.isSectionEnabled(sectionKey)) throw new Error('해당 섹션이 비활성화되어 있습니다.');
        if (A.isSectionLocked(sectionKey))   throw new Error('해당 섹션이 잠금 상태입니다.');

        var sec = A.getAllSections().find(function (s) { return s.id === sectionKey; });
        if (!sec) throw new Error('Unknown section: ' + sectionKey);

        var fullContent = A.getSectionContent(sectionKey);
        var tpl = A.getPromptTemplate('partialRegen') || A.DEFAULT_PARTIAL_REGEN_PROMPT;
        var result = await A.callAPIWithRetry(A.fillTemplate(tpl, {
            SECTION_LABEL:    sec.label,
            FULL_CONTENT:     fullContent,
            SELECTED_TEXT:    selectedText,
            USER_INSTRUCTION: instruction || '이 부분을 더 풍부하고 세밀하게 개선해 주세요.',
            LANG_INSTRUCTION:  A.getLangInstruction(),
            VOLUME_INSTRUCTION: A.getVolumeInstruction(),
        }));

        if (!result) throw new Error('Empty response');
        var cleaned = result.replace(/\[.*?\]/g, '').trim();
        var newContent = fullContent.replace(selectedText, cleaned);
        return { section: sectionKey, value: newContent, partial: cleaned };
    };

    /** Consistency check across all sections */
    A.runConsistencyCheck = async function () {
        var tpl = A.getPromptTemplate('consistencyCheck') || A.DEFAULT_CONSISTENCY_CHECK_PROMPT;
        var result = await A.callAPIWithRetry(A.fillTemplate(tpl, {
            ALL_SETTINGS:       A.buildExistingSettings(),
            LANG_INSTRUCTION:   A.getLangInstruction(),
        }));
        if (!result) throw new Error('Empty response');
        return result;
    };

    /* ══════════════════════════════════════════════
       Update System (features D + C)
       ══════════════════════════════════════════════ */
    A.autoUpdateMessageCount = 0;
    A.isAutoUpdating = false;

    A.updateFromRange = async function (startIdx, endIdx) {
        var chat = A.getChatMessages(startIdx, endIdx);
        if (!chat) throw new Error('No messages in range.');

        var ci = A.getCharacterInfo();
        return await A.callAPIWithRetry(A.fillTemplate(A.getPromptTemplate('update'), {
            CHAR_NAME:         ci.charName,
            USER_NAME:         ci.userName,
            EXISTING_SETTINGS: A.buildExistingSettings(),
            START:             String(startIdx),
            END:               String(endIdx),
            MESSAGES:          chat,
            OUTPUT_FORMAT:     A.buildOutputFormat(),
            LANG_INSTRUCTION:  A.getLangInstruction(),
            VOLUME_INSTRUCTION: A.getVolumeInstruction(),
            /* compat for old custom prompts */
            CURRENT_WORLD:         A.getSectionContent('world')        || '(Not yet)',
            CURRENT_CHAR:          A.getSectionContent('charSetting')  || '(Not yet)',
            CURRENT_USER:          A.getSectionContent('userSetting')  || '(Not yet)',
            CURRENT_CHAR_CLOTHING: A.getSectionContent('charClothing') || '(Not yet)',
            CURRENT_USER_CLOTHING: A.getSectionContent('userClothing') || '(Not yet)',
        }));
    };

    A.shouldUpdate = async function (startIdx, endIdx) {
        var s = A.getSettings();
        if (!s.smartAutoUpdate) return true;

        try {
            var chat = A.getChatMessages(startIdx, endIdx);
            if (!chat) return false;

            var summary = A.buildExistingSettings().substring(0, 500);
            var res = await A.callAPIWithRetry(A.fillTemplate(A.getPromptTemplate('smartAnalysis'), {
                WORLD_SUMMARY: summary || '(no world yet)',
                START:         String(startIdx),
                END:           String(endIdx),
                MESSAGES:      chat,
            }), 1);

            if (res && res.toUpperCase().indexOf('NO_UPDATE_NEEDED') !== -1) {
                A.log('Smart: no update');
                return false;
            }
            return true;
        } catch (e) {
            A.log('Smart analysis failed: ' + e.message);
            return true;
        }
    };

    A.triggerAutoUpdate = async function (messageCount) {
        if (A.isAutoUpdating) return;
        A.isAutoUpdating = true;

        try {
            var total = A.getChatLength();
            if (!total) return;

            var s0 = Math.max(0, total - messageCount);
            var e0 = total - 1;

            if (!(await A.shouldUpdate(s0, e0))) {
                A.showStatus('스마트 분석: 업데이트 불필요', 'info');
                return;
            }

            var result = await A.updateFromRange(s0, e0);
            if (result) {
                A.applyUpdateResult(result, 'auto-update');
                A.showStatus('자동 업데이트 완료!', 'success');
            }
        } catch (e) {
            A.logError('Auto-update failed', e);
        } finally {
            A.isAutoUpdating = false;
        }
    };

    A.applyUpdateResult = function (result, type) {
        var before = A.getFullSnapshot();
        A.saveToHistory(type || 'update', before);

        var parsed     = A.parseGeneratedContent(result);
        var enabledIds = A.getEnabledSections().map(function (s) { return s.id; });

        Object.keys(parsed).forEach(function (k) {
            if (enabledIds.indexOf(k) === -1) return;
            if (!parsed[k]) return;
            /* Section lock — skip locked sections during updates */
            if (A.isSectionLocked(k)) return;
            A.setSectionContent(k, parsed[k]);
            A.setSectionTextareaValue(k, parsed[k]);
        });

        A.updateExtensionPrompt();
        A.updateTokenDisplay();
        A.renderHistoryList();

        /* Diff notification (feature C) */
        var after = A.getFullSnapshot();
        var diffs = A.computeSnapshotDiff(before, after);
        if (diffs.length) {
            A.showStatus(
                '업데이트 완료! 변경: ' + diffs.map(function (d) { return d.label; }).join(', '),
                'success'
            );
        }
    };

    /* ══════════════════════════════════════════════
       Genre Prompt
       ══════════════════════════════════════════════ */
    A.generateGenrePromptText = async function () {
        var w = A.getSectionContent('world');
        if (!w) throw new Error('세계관 설정을 먼저 생성해주세요.');
        return await A.callAPIWithRetry(A.fillTemplate(A.getPromptTemplate('genre'), {
            WORLD_SETTING:    w,
            LANG_INSTRUCTION: A.getLangInstruction(),
        }));
    };

    /* ══════════════════════════════════════════════
       Custom Prompts UI Helpers
       ══════════════════════════════════════════════ */
    A.loadCustomPromptsToUI = function () {
        var cp = A.getSettings().customPrompts || {};
        A.setVal('auwb-custom-initial-prompt',     cp.initial       || '');
        A.setVal('auwb-custom-update-prompt',      cp.update        || '');
        A.setVal('auwb-custom-genre-prompt',       cp.genre         || '');
        A.setVal('auwb-custom-section-prompt',     cp.section       || '');
        A.setVal('auwb-custom-analysis-prompt',    cp.smartAnalysis || '');
        A.setVal('auwb-custom-brainstorm-prompt',  cp.brainstorm    || '');
        A.setVal('auwb-custom-refine-prompt',      cp.refine        || '');
        A.setVal('auwb-custom-whatif-prompt',       cp.whatif         || '');
    };

    A.saveCustomPrompts = function () {
        var s = A.getSettings();
        s.customPrompts = {
            initial:       A.getElVal('auwb-custom-initial-prompt'),
            update:        A.getElVal('auwb-custom-update-prompt'),
            genre:         A.getElVal('auwb-custom-genre-prompt'),
            section:       A.getElVal('auwb-custom-section-prompt'),
            smartAnalysis: A.getElVal('auwb-custom-analysis-prompt'),
            brainstorm:    A.getElVal('auwb-custom-brainstorm-prompt'),
            refine:        A.getElVal('auwb-custom-refine-prompt'),
            whatif:        A.getElVal('auwb-custom-whatif-prompt'),
        };
        A.saveSettings();
        A.showStatus('프롬프트 저장됨!', 'success');
    };

    A.resetPromptTemplate = function (key) {
        var defaultMap = {
            initial:       A.DEFAULT_INITIAL_PROMPT,
            update:        A.DEFAULT_UPDATE_PROMPT,
            genre:         A.DEFAULT_GENRE_PROMPT,
            section:       A.DEFAULT_SECTION_PROMPT,
            smartAnalysis: A.DEFAULT_SMART_ANALYSIS_PROMPT,
            brainstorm:    A.DEFAULT_BRAINSTORM_PROMPT,
            refine:        A.DEFAULT_REFINE_PROMPT,
            whatif:        A.DEFAULT_WHATIF_PROMPT,
        };
        var inputMap = {
            initial:       'auwb-custom-initial-prompt',
            update:        'auwb-custom-update-prompt',
            genre:         'auwb-custom-genre-prompt',
            section:       'auwb-custom-section-prompt',
            smartAnalysis: 'auwb-custom-analysis-prompt',
            brainstorm:    'auwb-custom-brainstorm-prompt',
            refine:        'auwb-custom-refine-prompt',
            whatif:        'auwb-custom-whatif-prompt',
        };

        A.setVal(inputMap[key], defaultMap[key] || '');
        var s = A.getSettings();
        if (s.customPrompts) s.customPrompts[key] = '';
        A.saveSettings();
        A.showStatus('기본 템플릿으로 초기화됨', 'success');
    };

    /* ══════════════════════════════════════════════
       Injection System (feature J — per-section)
       ══════════════════════════════════════════════ */
    var _injPending = false;
    A.updateExtensionPrompt = function () {
        if (_injPending) return;
        _injPending = true;
        requestAnimationFrame(function () {
            _injPending = false;
            A._doUpdateExtensionPrompt();
        });
    };

    A._doUpdateExtensionPrompt = function () {
        try {
            var ctx = SillyTavern.getContext();
            if (!ctx || typeof ctx.setExtensionPrompt !== 'function') return;

            var s = A.getSettings();

            /* Per-section injection */
            A.getAllSections().forEach(function (sec) {
                var mid = A.MODULE_PREFIX + sec.id;
                var c   = A.getSectionContent(sec.id);

                if (s.enabled && sec.enabled && c && c.trim()) {
                    ctx.setExtensionPrompt(
                        mid,
                        '[' + sec.injHeader + ']\n' + c.trim(),
                        sec.injPos, sec.injDepth, true, sec.injRole
                    );
                } else {
                    ctx.setExtensionPrompt(mid, '', -1, 0);
                }
            });

            /* Genre prompt */
            var gc = (s.sectionConfig && s.sectionConfig.genre) || A.newSectionCfg();
            var gp = A.getChatData().genrePrompt || '';

            if (s.enabled && gc.enabled !== false && s.genrePromptEnabled && gp.trim()) {
                ctx.setExtensionPrompt(
                    A.MODULE_PREFIX + 'genre',
                    '[Genre/Tone Instructions]\n' + gp.trim(),
                    gc.injPos != null ? gc.injPos : 1,
                    gc.injDepth != null ? gc.injDepth : 4,
                    true, gc.injRole || 0
                );
            } else {
                ctx.setExtensionPrompt(A.MODULE_PREFIX + 'genre', '', -1, 0);
            }
        } catch (e) {
            A.logError('updateExtensionPrompt', e);
        }
    };

    A.getInjectionTokenInfo = function () {
        var total = 0;
        var s = A.getSettings();

        A.getAllSections().forEach(function (sec) {
            if (s.enabled && sec.enabled) {
                var c = A.getSectionContent(sec.id);
                if (c) total += A.estimateTokens('[' + sec.injHeader + ']\n' + c.trim());
            }
        });

        var gc = (s.sectionConfig && s.sectionConfig.genre) || A.newSectionCfg();
        if (s.enabled && gc.enabled !== false && s.genrePromptEnabled) {
            var gp = A.getChatData().genrePrompt || '';
            if (gp) total += A.estimateTokens('[Genre/Tone Instructions]\n' + gp.trim());
        }

        return { tokens: total };
    };

    A.getInjectionPreview = function () {
        var s = A.getSettings();
        var lines = ['=== AU World Builder 주입 미리보기 ===\n'];

        A.getAllSections().forEach(function (sec) {
            var c  = A.getSectionContent(sec.id);
            var st = !sec.enabled ? ' [비활성화]' : (!c ? ' [빈 섹션]' : '');

            if (c && sec.enabled) {
                lines.push(
                    '--- ' + sec.label +
                    ' (pos=' + sec.injPos +
                    ' depth=' + sec.injDepth +
                    ' role=' + ['Sys', 'Usr', 'Asst'][sec.injRole] +
                    ') ---\n' + c + '\n'
                );
            } else {
                lines.push('--- ' + sec.label + st + ' ---\n');
            }
        });

        var gc = (s.sectionConfig && s.sectionConfig.genre) || A.newSectionCfg();
        if (s.genrePromptEnabled && gc.enabled !== false) {
            var gp = A.getChatData().genrePrompt;
            if (gp) lines.push('--- 장르/톤 ---\n' + gp + '\n');
        }

        lines.push('\n--- 예상 토큰 수: ~' + A.getInjectionTokenInfo().tokens + ' tokens ---');
        return lines.join('\n');
    };

    /* ══════════════════════════════════════════════
       Brainstorm (#6)
       ══════════════════════════════════════════════ */
    A.generateBrainstorm = async function (concept) {
        var ci  = A.getCharacterInfo();
        var cd  = A.getChatData();
        var ref = cd.reference || '';

        var result = await A.callAPIWithRetry(A.fillTemplate(A.getPromptTemplate('brainstorm') || A.DEFAULT_BRAINSTORM_PROMPT, {
            CONCEPT:         concept,
            REFERENCE_BLOCK: ref ? '\n## Reference: ' + ref : '',
            CHAR_NAME:       ci.charName,
            CHAR_DESC:       ci.charDescription || 'Not provided',
            USER_NAME:       ci.userName,
            USER_PERSONA:    ci.personaDescription || 'Not provided',
            GUIDELINES:      A.buildGuidelines(),
            LANG_INSTRUCTION: A.getLangInstruction(),
        }));

        if (!result) return [];

        /* Parse [IDEA_N] blocks */
        var ideas = [];
        for (var i = 1; i <= 3; i++) {
            var re = new RegExp('\\[IDEA_' + i + '\\]([\\s\\S]*?)\\[\\/IDEA_' + i + '\\]', 'i');
            var m  = result.match(re);
            if (m) {
                var text  = m[1].trim();
                var title = '';
                var summary = text;
                var tMatch = text.match(/^Title:\s*(.+)/im);
                if (tMatch) title = tMatch[1].trim();
                var sMatch = text.match(/Summary:\s*([\s\S]+)/im);
                if (sMatch) summary = sMatch[1].trim();
                ideas.push({ title: title || ('Idea ' + i), summary: summary });
            }
        }

        /* Fallback: split by numbered lines */
        if (!ideas.length) {
            var parts = result.split(/\n(?=\d+[\.\)]\s)/);
            parts.forEach(function (p, idx) {
                if (idx > 2) return;
                var cleaned = p.replace(/^\d+[\.\)]\s*/, '').trim();
                if (cleaned) ideas.push({ title: 'Idea ' + (idx + 1), summary: cleaned.substring(0, 300) });
            });
        }

        return ideas;
    };

    /* ══════════════════════════════════════════════
       Refine Section (#7)
       ══════════════════════════════════════════════ */
    A.REFINE_DIRECTIONS = [
        { id: 'twist',    label: '반전 추가',    prompt: 'Add an unexpected twist or surprise element.' },
        { id: 'specific', label: '더 구체적으로', prompt: 'Make descriptions more specific and concrete with sensory details.' },
        { id: 'deepen',   label: '관계 심화',    prompt: 'Deepen the character relationships and emotional connections.' },
        { id: 'tension',  label: '긴장감 추가',  prompt: 'Add more underlying tension, conflict, or dramatic stakes.' },
        { id: 'expand',   label: '확장',         prompt: 'Expand and add more world details, background lore, or daily-life elements.' },
    ];

    /* H: Combined built-in + custom refine directions */
    A.getAllRefineDirections = function () {
        var dirs = A.REFINE_DIRECTIONS.slice();
        return dirs.concat(A.getSettings().customRefineDirections || []);
    };

    A.refineSection = async function (sectionKey, directionId) {
        if (!A.isSectionEnabled(sectionKey)) {
            throw new Error('해당 섹션이 비활성화되어 있습니다.');
        }

        var sec = A.getAllSections().find(function (s) { return s.id === sectionKey; });
        if (!sec) throw new Error('Unknown section: ' + sectionKey);

        var dir = A.getAllRefineDirections().find(function (d) { return d.id === directionId; });
        if (!dir) throw new Error('Unknown direction: ' + directionId);

        var content = A.getSectionContent(sectionKey);
        if (!content) throw new Error('섹션 내용이 비어있습니다. 먼저 생성해주세요.');

        var tagPart = '[' + sec.tag + ']\n(Refined content)\n[/' + sec.tag + ']';

        var result = await A.callAPIWithRetry(A.fillTemplate(A.getPromptTemplate('refine'), {
            SECTION_LABEL:     sec.label,
            DIRECTION:         dir.prompt,
            CURRENT_CONTENT:   content,
            EXISTING_SETTINGS: A.buildExistingSettings(),
            SECTION_TAG:       tagPart,
            LANG_INSTRUCTION:  A.getLangInstruction(),
        }));

        if (!result) throw new Error('Empty response');
        var parsed = A.parseGeneratedContent(result);
        return {
            section: sectionKey,
            value:   parsed[sectionKey] || result.replace(/\[.*?\]/g, '').trim(),
        };
    };

    /* ══════════════════════════════════════════════
       What-If Variation (#8)
       ══════════════════════════════════════════════ */
    A.generateWhatIf = async function (premise) {
        if (!premise || !premise.trim()) throw new Error('What-If 전제를 입력하세요.');

        var ci = A.getCharacterInfo();
        var result = await A.callAPIWithRetry(A.fillTemplate(A.getPromptTemplate('whatif'), {
            WHATIF_PREMISE:     premise,
            EXISTING_SETTINGS: A.buildExistingSettings(),
            CHAR_NAME:         ci.charName,
            CHAR_DESC:         ci.charDescription || '',
            USER_NAME:         ci.userName,
            USER_PERSONA:      ci.personaDescription || '',
            OUTPUT_FORMAT:     A.buildOutputFormat(),
            LANG_INSTRUCTION:  A.getLangInstruction(),
            VOLUME_INSTRUCTION: A.getVolumeInstruction(),
        }));

        if (!result) throw new Error('Empty response');
        return result;
    };

    /* F: A/B Test — generate two results in parallel */
    A.generateABTest = async function (concept, filterIds) {
        var ci  = A.getCharacterInfo();
        var cd  = A.getChatData();
        var ref = cd.reference || '';
        var rel = cd.relationship || '';
        var vars = {
            GUIDELINES:         A.buildGuidelines(),
            CONCEPT:            concept,
            REFERENCE_BLOCK:    ref ? '\n## Reference / Inspiration\n' + ref : '',
            RELATIONSHIP_BLOCK: rel ? '\n## Character Relationship\n' + rel : '',
            CHAR_NAME:          ci.charName,
            CHAR_DESC:          ci.charDescription || 'Not provided',
            CHAR_PERS:          ci.charPersonality || 'Not provided',
            CHAR_SCENE:         ci.charScenario    || 'Not provided',
            USER_NAME:          ci.userName,
            USER_PERSONA:       ci.personaDescription || 'Not provided',
            OUTPUT_FORMAT:      A.buildOutputFormat(filterIds),
            LANG_INSTRUCTION:   A.getLangInstruction(),
            VOLUME_INSTRUCTION: A.getVolumeInstruction(),
            EXISTING_SETTINGS:  '',
        };
        var prompt = A.fillTemplate(A.getPromptTemplate('initial'), vars);
        var results = await Promise.all([
            A.callAPIWithRetry(prompt),
            A.callAPIWithRetry(prompt),
        ]);
        return {
            a: A.parseGeneratedContent(results[0]),
            b: A.parseGeneratedContent(results[1]),
        };
    };

    /* G: What-If Branches */
    A.getWhatIfBranches = function () {
        return A.getChatData().whatIfBranches || [];
    };

    A.saveWhatIfBranch = function (name, premise, snapshot) {
        var branches = A.getWhatIfBranches();
        branches.unshift({
            id: 'wif_' + Date.now(),
            name: name,
            premise: premise,
            timestamp: Date.now(),
            snapshot: snapshot,
        });
        if (branches.length > 10) branches = branches.slice(0, 10);
        A.saveChatData('whatIfBranches', branches);
    };

    A.loadWhatIfBranch = function (branchId) {
        var branch = A.getWhatIfBranches().find(function (b) { return b.id === branchId; });
        if (!branch) return;
        A.saveToHistory('before-rollback', A.getFullSnapshot());
        var snap = branch.snapshot;
        A.getAllSections().forEach(function (sec) {
            A.setSectionContent(sec.id, snap[sec.id] || '');
        });
        if (snap.genrePrompt !== undefined) A.saveChatData('genrePrompt', snap.genrePrompt);
        A.loadChatDataToUI();
        A.updateExtensionPrompt();
    };

    A.deleteWhatIfBranch = function (branchId) {
        var branches = A.getWhatIfBranches().filter(function (b) { return b.id !== branchId; });
        A.saveChatData('whatIfBranches', branches);
    };

    /* ══════════════════════════════════════════════
       F7: Batch Section Regeneration
       ══════════════════════════════════════════════ */
    A.batchRegenerateSections = async function (sectionIds) {
        if (!sectionIds || !sectionIds.length) throw new Error('재생성할 섹션을 선택하세요.');
        var ci  = A.getCharacterInfo();
        var cd  = A.getChatData();
        var fmt = A.buildOutputFormat(sectionIds);
        var labels = A.getEnabledSections()
            .filter(function (s) { return sectionIds.indexOf(s.id) !== -1; })
            .map(function (s) { return s.label; })
            .join(', ');

        var result = await A.callAPIWithRetry(A.fillTemplate(A.getPromptTemplate('section'), {
            SECTION_LABEL:     labels,
            CONCEPT:           cd.auConcept || '',
            CHAR_NAME:         ci.charName,
            CHAR_DESC:         ci.charDescription || '',
            USER_NAME:         ci.userName,
            USER_PERSONA:      ci.personaDescription || '',
            EXISTING_SETTINGS: A.buildExistingSettings(),
            SECTION_TAG:       fmt,
            LANG_INSTRUCTION:  A.getLangInstruction(),
            VOLUME_INSTRUCTION: A.getVolumeInstruction(),
        }));

        if (!result) throw new Error('Empty response');
        return A.parseGeneratedContent(result);
    };

    /* ══════════════════════════════════════════════
       F10: What-If Branch Export / Import
       ══════════════════════════════════════════════ */
    A.exportWhatIfBranches = function () {
        var branches = A.getWhatIfBranches();
        if (!branches.length) { A.showStatus('내보낼 브랜치가 없습니다.', 'info'); return; }
        var blob = new Blob([JSON.stringify({
            type: 'au-world-builder-whatif-branches',
            version: '1.0',
            exportDate: new Date().toISOString(),
            branches: branches,
        }, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a   = document.createElement('a');
        a.href     = url;
        a.download = 'au-wb-whatif-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        A.showStatus('What-If 브랜치 내보내기 완료!', 'success');
    };

    A.importWhatIfBranches = function (fileContent) {
        var d = JSON.parse(fileContent);
        if (d.type !== 'au-world-builder-whatif-branches' || !Array.isArray(d.branches)) {
            throw new Error('잘못된 What-If 브랜치 파일');
        }
        var existing = A.getWhatIfBranches();
        var count    = 0;
        d.branches.forEach(function (b) {
            b.id   = 'wif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            b.name = b.name + ' (imported)';
            existing.unshift(b);
            count++;
        });
        if (existing.length > 10) existing = existing.slice(0, 10);
        A.saveChatData('whatIfBranches', existing);
        return count;
    };

})(window.AUWB);
