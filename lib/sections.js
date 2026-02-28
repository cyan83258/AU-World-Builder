/**
 * AU World Builder — Sections Module
 * Section management, character info, and content access.
 */
(function (A) {
    'use strict';

    /* Textarea ID map for built-in sections */
    var biTextareaMap = {
        world:           'auwb-world-setting-content',
        worldLife:       'auwb-world-life-content',
        worldRules:      'auwb-world-rules-content',
        charSetting:     'auwb-char-setting-content',
        charPersonality: 'auwb-char-personality-content',
        userSetting:     'auwb-user-setting-content',
        userPersonality: 'auwb-user-personality-content',
        charRelation:    'auwb-char-relation-content',
        charHistory:     'auwb-char-history-content',
        charClothing:    'auwb-char-style-content',
        userClothing:    'auwb-user-style-content',
    };
    A._biTextareaMap = biTextareaMap;

    /* ══════════════════════════════════════════════
       Character & Chat Info
       ══════════════════════════════════════════════ */
    var _ciCache = null, _ciExpiry = 0;
    A.getCharacterInfo = function () {
        var now = Date.now();
        if (_ciCache && now < _ciExpiry) return _ciCache;
        try {
            var ctx = SillyTavern.getContext();
            var cn = ctx.name2 || '{{char}}';
            var un = ctx.name1 || '{{user}}';
            var desc = '', pers = '', scen = '', persona = '';

            if (ctx.getCharacterCardFields) {
                var f = ctx.getCharacterCardFields();
                desc    = f.description || '';
                pers    = f.personality || '';
                scen    = f.scenario    || '';
                persona = f.persona     || '';
            }

            if (!desc && ctx.characters && ctx.characterId != null) {
                var c = ctx.characters[ctx.characterId];
                if (c) {
                    desc = c.description || '';
                    pers = c.personality || '';
                    scen = c.scenario    || '';
                    cn   = c.name || cn;
                }
            }

            var result = {
                charName: cn, userName: un,
                charDescription: desc, charPersonality: pers,
                charScenario: scen, personaDescription: persona,
            };
            _ciCache = result;
            _ciExpiry = Date.now() + 2000;
            return result;
        } catch (_) {}

        var fallback = {
            charName: '{{char}}', userName: '{{user}}',
            charDescription: '', charPersonality: '',
            charScenario: '', personaDescription: '',
        };
        _ciCache = fallback;
        _ciExpiry = Date.now() + 2000;
        return fallback;
    };

    /** Invalidate character info cache (on chat change) */
    A.invalidateCharInfoCache = function () { _ciCache = null; _ciExpiry = 0; };

    A.getChatMessages = function (startIdx, endIdx) {
        try {
            var ctx = SillyTavern.getContext();
            if (!ctx.chat || !Array.isArray(ctx.chat)) return '';

            var s = Math.max(0, startIdx);
            var e = Math.min(ctx.chat.length - 1, endIdx);
            var msgs = [];

            for (var i = s; i <= e; i++) {
                var m = ctx.chat[i];
                if (m && m.mes) {
                    var name = m.is_user ? (ctx.name1 || 'User') : (ctx.name2 || 'Character');
                    msgs.push(name + ': ' + m.mes);
                }
            }
            return msgs.join('\n\n');
        } catch (_) {}
        return '';
    };

    A.getChatLength = function () {
        try { return SillyTavern.getContext().chat.length; }
        catch (_) { return 0; }
    };

    /* ══════════════════════════════════════════════
       Section Listing
       ══════════════════════════════════════════════ */
    var _secCache = null, _secDirty = true;

    /** Mark sections cache dirty (call when sections/config change) */
    A.invalidateSectionCache = function () { _secCache = null; _secDirty = true; };

    A.getAllSections = function () {
        if (_secCache && !_secDirty) return _secCache;
        var s  = A.getSettings();
        var ci = A.getCharacterInfo();
        var out = [];

        A.BUILTIN_SECTIONS.forEach(function (bs) {
            var cfg = (s.sectionConfig && s.sectionConfig[bs.id]) || A.newSectionCfg();
            out.push({
                id:        bs.id,
                tag:       bs.tag,
                isBuiltIn: true,
                label:     bs.label.replace('{{char}}', ci.charName).replace('{{user}}', ci.userName),
                injHeader: bs.injHeader.replace('{{char}}', ci.charName).replace('{{user}}', ci.userName),
                enabled:   cfg.enabled !== false,
                injPos:    cfg.injPos   != null ? cfg.injPos   : 1,
                injDepth:  cfg.injDepth != null ? cfg.injDepth : 4,
                injRole:   cfg.injRole  != null ? cfg.injRole  : 0,
            });
        });

        (s.customSections || []).forEach(function (cs) {
            out.push({
                id:        cs.id,
                tag:       'CUSTOM_' + cs.id.replace('custom_', ''),
                isBuiltIn: false,
                label:     cs.label,
                injHeader: 'AU ' + cs.label,
                enabled:   cs.enabled !== false,
                injPos:    cs.injPos   != null ? cs.injPos   : 1,
                injDepth:  cs.injDepth != null ? cs.injDepth : 4,
                injRole:   cs.injRole  != null ? cs.injRole  : 0,
            });
        });

        /* C: Respect user-defined section order */
        var order = s.sectionOrder;
        if (order && order.length) {
            out.sort(function (a, b) {
                var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
                if (ia === -1) ia = 9999;
                if (ib === -1) ib = 9999;
                return ia - ib;
            });
        }

        _secCache = out;
        _secDirty = false;
        return out;
    };

    A.getEnabledSections = function () {
        return A.getAllSections().filter(function (s) { return s.enabled; });
    };

    /* ══════════════════════════════════════════════
       Section Content Get / Set
       ══════════════════════════════════════════════ */
    A.getSectionContent = function (sid) {
        var cd = A.getChatData();
        switch (sid) {
            case 'world':           return cd.worldSetting || '';
            case 'worldLife':       return (cd.worldSubSections && cd.worldSubSections.life) || '';
            case 'worldRules':      return (cd.worldSubSections && cd.worldSubSections.rules) || '';
            case 'charSetting':     return (cd.characterSettings && cd.characterSettings.char) || '';
            case 'charPersonality': return (cd.characterSub && cd.characterSub.charPersonality) || '';
            case 'userSetting':     return (cd.characterSettings && cd.characterSettings.user) || '';
            case 'userPersonality': return (cd.characterSub && cd.characterSub.userPersonality) || '';
            case 'charRelation':    return (cd.relationData && cd.relationData.relation) || '';
            case 'charHistory':     return (cd.relationData && cd.relationData.history) || '';
            case 'charClothing':    return (cd.clothingStyles && cd.clothingStyles.char) || '';
            case 'userClothing':    return (cd.clothingStyles && cd.clothingStyles.user) || '';
            default:                return (cd.customSectionData && cd.customSectionData[sid]) || '';
        }
    };

    A.setSectionContent = function (sid, val) {
        var cd = A.getChatData();
        switch (sid) {
            case 'world':
                A.saveChatData('worldSetting', val);
                break;
            case 'worldLife': {
                var wl = cd.worldSubSections || { life: '', rules: '' };
                wl.life = val;
                A.saveChatData('worldSubSections', wl);
                break;
            }
            case 'worldRules': {
                var wr = cd.worldSubSections || { life: '', rules: '' };
                wr.rules = val;
                A.saveChatData('worldSubSections', wr);
                break;
            }
            case 'charSetting': {
                var cs = cd.characterSettings || { char: '', user: '' };
                cs.char = val;
                A.saveChatData('characterSettings', cs);
                break;
            }
            case 'charPersonality': {
                var cp = cd.characterSub || { charPersonality: '', userPersonality: '' };
                cp.charPersonality = val;
                A.saveChatData('characterSub', cp);
                break;
            }
            case 'userSetting': {
                var us = cd.characterSettings || { char: '', user: '' };
                us.user = val;
                A.saveChatData('characterSettings', us);
                break;
            }
            case 'userPersonality': {
                var up = cd.characterSub || { charPersonality: '', userPersonality: '' };
                up.userPersonality = val;
                A.saveChatData('characterSub', up);
                break;
            }
            case 'charRelation': {
                var cr = cd.relationData || { relation: '', history: '' };
                cr.relation = val;
                A.saveChatData('relationData', cr);
                break;
            }
            case 'charHistory': {
                var ch = cd.relationData || { relation: '', history: '' };
                ch.history = val;
                A.saveChatData('relationData', ch);
                break;
            }
            case 'charClothing': {
                var cc = cd.clothingStyles || { char: '', user: '' };
                cc.char = val;
                A.saveChatData('clothingStyles', cc);
                break;
            }
            case 'userClothing': {
                var uc = cd.clothingStyles || { char: '', user: '' };
                uc.user = val;
                A.saveChatData('clothingStyles', uc);
                break;
            }
            default: {
                var csd = cd.customSectionData || {};
                csd[sid] = val;
                A.saveChatData('customSectionData', csd);
                break;
            }
        }
    };

    A.getSectionTextareaValue = function (sid) {
        if (biTextareaMap[sid]) return A.getElVal(biTextareaMap[sid]);
        var el = document.querySelector('[data-custom-section-id="' + sid + '"]');
        return el ? el.value : '';
    };

    A.setSectionTextareaValue = function (sid, val) {
        if (biTextareaMap[sid]) { A.setVal(biTextareaMap[sid], val); return; }
        var el = document.querySelector('[data-custom-section-id="' + sid + '"]');
        if (el) el.value = val;
    };

    /* ══════════════════════════════════════════════
       Section CRUD & Config
       ══════════════════════════════════════════════ */
    A.addCustomSection = function (label) {
        var s  = A.getSettings();
        var id = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        var sec = { id: id, label: label.trim(), enabled: true, injPos: 1, injDepth: 4, injRole: 0 };
        s.customSections.push(sec);
        A.invalidateSectionCache();
        A.saveSettings();
        return sec;
    };

    A.removeCustomSection = function (sid) {
        var s = A.getSettings();
        s.customSections = (s.customSections || []).filter(function (c) { return c.id !== sid; });
        A.invalidateSectionCache();
        A.saveSettings();

        var cd = A.getChatData();
        if (cd.customSectionData && cd.customSectionData[sid]) {
            delete cd.customSectionData[sid];
            A.saveChatData('customSectionData', cd.customSectionData);
        }

        try { SillyTavern.getContext().setExtensionPrompt(A.MODULE_PREFIX + sid, '', -1, 0); }
        catch (_) {}
    };

    A.updateSectionConfig = function (sid, key, value) {
        var s = A.getSettings();
        if (s.sectionConfig[sid]) {
            s.sectionConfig[sid][key] = value;
        } else {
            var cs = (s.customSections || []).find(function (c) { return c.id === sid; });
            if (cs) cs[key] = value;
        }
        A.invalidateSectionCache();
        A.saveSettings();
        A.updateExtensionPrompt();
    };

    A.isSectionEnabled = function (sid) {
        var s = A.getSettings();
        if (s.sectionConfig[sid]) return s.sectionConfig[sid].enabled !== false;
        var cs = (s.customSections || []).find(function (c) { return c.id === sid; });
        return cs ? cs.enabled !== false : true;
    };

    A.isSectionLocked = function (sid) {
        var s = A.getSettings();
        if (s.sectionConfig[sid]) return !!s.sectionConfig[sid].locked;
        var cs = (s.customSections || []).find(function (c) { return c.id === sid; });
        return cs ? !!cs.locked : false;
    };

    /* ══════════════════════════════════════════════
       Full Snapshot
       ══════════════════════════════════════════════ */
    A.getFullSnapshot = function () {
        var snap = {};
        A.getAllSections().forEach(function (sec) {
            var v = A.getSectionTextareaValue(sec.id) || A.getSectionContent(sec.id);
            if (v) snap[sec.id] = v;  /* P: skip empty sections */
        });
        snap.genrePrompt = A.getElVal('auwb-genre-prompt') || A.getChatData().genrePrompt || '';
        if (!snap.genrePrompt) delete snap.genrePrompt;
        return snap;
    };

    /* N: Unified section change commit */
    A.commitSectionChange = function (key, value) {
        A.setSectionContent(key, value);
        A.setSectionTextareaValue(key, value);
        A.updateExtensionPrompt();
        A.updateTokenDisplay();
        A.renderHistoryList();
    };

})(window.AUWB);
