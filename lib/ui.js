/**
 * AU World Builder — UI Module
 * Rendering, event binding, presets, lorebook, import/export.
 */
(function (A) {
    'use strict';

    /* ══════════════════════════════════════════════
       Status & Display
       ══════════════════════════════════════════════ */

    /* F12: Custom Confirm / Prompt modals (replaces native dialogs) */
    A.showConfirm = function (msg) {
        return new Promise(function (resolve) {
            var modal = document.getElementById('auwb-confirm-modal');
            if (!modal) { resolve(confirm(msg)); return; }
            var msgEl = document.getElementById('auwb-confirm-msg');
            msgEl.textContent = msg;
            modal.style.display = 'flex';
            function done(r) { modal.style.display = 'none'; ok.onclick = null; ca.onclick = null; resolve(r); }
            var ok = document.getElementById('auwb-confirm-ok');
            var ca = document.getElementById('auwb-confirm-cancel');
            ok.onclick = function () { done(true); };
            ca.onclick = function () { done(false); };
        });
    };

    A.showPrompt = function (msg, placeholder) {
        return new Promise(function (resolve) {
            var modal = document.getElementById('auwb-prompt-modal');
            if (!modal) { resolve(prompt(msg)); return; }
            var msgEl = document.getElementById('auwb-prompt-msg');
            var inp   = document.getElementById('auwb-prompt-input');
            msgEl.textContent = msg;
            inp.value = '';
            inp.placeholder = placeholder || '';
            modal.style.display = 'flex';
            inp.focus();
            function done(v) { modal.style.display = 'none'; ok.onclick = null; ca.onclick = null; inp.onkeydown = null; resolve(v); }
            var ok = document.getElementById('auwb-prompt-ok');
            var ca = document.getElementById('auwb-prompt-cancel');
            ok.onclick = function () { done(inp.value); };
            ca.onclick = function () { done(null); };
            inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); done(inp.value); } };
        });
    };

    A.showStatus = function (msg, type) {
        var el = document.getElementById('auwb-status-message');
        if (el) {
            el.textContent = msg;
            el.className   = 'auwb-status-message ' + type;
            el.style.display = 'block';
            if (type !== 'error') {
                setTimeout(function () { el.style.display = 'none'; }, 5000);
            }
        }
        try {
            if (typeof toastr !== 'undefined') {
                if (type === 'error')        toastr.error(msg);
                else if (type === 'success') toastr.success(msg);
                else                          toastr.info(msg);
            }
        } catch (_) {}
    };

    A.updateCharacterNames = function () {
        var ci = A.getCharacterInfo();
        document.querySelectorAll('.auwb-char-name').forEach(function (el) { el.textContent = ci.charName; });
        document.querySelectorAll('.auwb-user-name').forEach(function (el) { el.textContent = ci.userName; });
        try {
            var len = A.getChatLength();
            var le  = document.getElementById('auwb-chat-length');
            if (le) le.textContent = String(len);
            var ei = document.getElementById('auwb-update-end');
            if (ei && len > 0) ei.value = String(len - 1);
        } catch (_) {}
    };

    A.updateTokenDisplay = A.debounce(function () {
        var el = document.getElementById('auwb-token-display');
        if (el) el.textContent = '~' + A.getInjectionTokenInfo().tokens + ' tokens';
    }, 150);

    /* ══════════════════════════════════════════════
       Load Data to UI
       ══════════════════════════════════════════════ */
    A.loadChatDataToUI = function () {
        var cd = A.getChatData();
        A.setVal('auwb-au-concept', cd.auConcept || '');
        A.setVal('auwb-reference', cd.reference || '');
        A.setVal('auwb-relationship', cd.relationship || '');
        A.BUILTIN_SECTIONS.forEach(function (bs) {
            if (A._biTextareaMap[bs.id]) A.setVal(A._biTextareaMap[bs.id], A.getSectionContent(bs.id));
        });
        A.setVal('auwb-genre-prompt', cd.genrePrompt || '');
        A.updateExtensionPrompt();
        A.renderHistoryList();
        A.renderCustomSectionContent();
        A.updateSectionDisabledVisuals();
    };

    A.loadSettingsToUI = function () {
        var s = A.getSettings();
        A.loadChatDataToUI();

        A.setChecked('auwb-enabled', s.enabled);
        A.setChecked('auwb-auto-update', s.autoUpdateEnabled);
        A.setChecked('auwb-smart-auto-update', s.smartAutoUpdate !== false);
        A.setChecked('auwb-genre-enabled', s.genrePromptEnabled);
        A.setChecked('auwb-debug-mode', s.debugMode);
        A.setVal('auwb-update-interval', s.autoUpdateInterval || 5);
        A.setSelectVal('auwb-api-source', s.apiSource || 'sillytavern');
        A.setSelectVal('auwb-output-language', s.outputLanguage || 'korean');
        A.setVal('auwb-api-url', s.customApiUrl || '');
        A.setVal('auwb-api-key', s.customApiKey || '');
        A.setVal('auwb-api-model', s.customApiModel || '');
        A.setVal('auwb-api-max-tokens', s.customApiMaxTokens || 4000);
        A.setVal('auwb-api-timeout', s.customApiTimeout || 120);

        updateApiSettingsVisibility();
        A.populateConnectionProfiles();
        A.updateCharacterNames();
        A.loadCustomPromptsToUI();
        A.updateTokenDisplay();
        A.renderSectionManager();
        A.updateDataStats();
    };

    function updateApiSettingsVisibility() {
        var src = A.getElVal('auwb-api-source');
        var st  = document.getElementById('auwb-st-api-settings');
        var cu  = document.getElementById('auwb-custom-api-settings');
        if (st) st.style.display = src === 'sillytavern' ? 'block' : 'none';
        if (cu) cu.style.display = src !== 'sillytavern' ? 'block' : 'none';
    }

    A.populateConnectionProfiles = function () {
        var sel = document.getElementById('auwb-connection-profile');
        if (!sel) return;

        var ps = A.getConnectionProfiles();
        sel.innerHTML = '<option value="">현재 API 연결 사용</option>';
        ps.forEach(function (p) {
            var o = document.createElement('option');
            o.value       = p.id;
            o.textContent = p.name || p.id;
            sel.appendChild(o);
        });

        var s = A.getSettings();
        if (s.connectionProfile) sel.value = s.connectionProfile;
    };

    A.checkApiStatus = async function () {
        var el = document.getElementById('auwb-api-status');
        if (!el) return;
        el.innerHTML = '<span class="auwb-status-indicator checking"></span><span>확인 중…</span>';
        try {
            var ctx = SillyTavern.getContext();
            var ok  = !!(ctx.generateRaw || ctx.generateQuietPrompt);
            el.innerHTML = ok
                ? '<span class="auwb-status-indicator connected"></span><span>Connected</span>'
                : '<span class="auwb-status-indicator disconnected"></span><span>No API</span>';
        } catch (_) {
            el.innerHTML = '<span class="auwb-status-indicator disconnected"></span><span>Error</span>';
        }
    };

    /* ══════════════════════════════════════════════
       Section Manager (features D + J)
       ══════════════════════════════════════════════ */
    A.renderSectionManager = function () {
        var container = document.getElementById('auwb-section-manager');
        if (!container) return;

        var s     = A.getSettings();
        var items = [];

        A.getAllSections().forEach(function (sec) {
            items.push({
                id: sec.id, label: sec.label, isBuiltIn: sec.isBuiltIn,
                enabled: sec.enabled, injPos: sec.injPos, injDepth: sec.injDepth, injRole: sec.injRole,
            });
        });

        /* Genre row */
        var gc = (s.sectionConfig && s.sectionConfig.genre) || A.newSectionCfg();
        items.push({
            id: 'genre', label: '장르/톤', isBuiltIn: true,
            enabled:  gc.enabled !== false,
            injPos:   gc.injPos   != null ? gc.injPos   : 1,
            injDepth: gc.injDepth != null ? gc.injDepth : 4,
            injRole:  gc.injRole || 0,
        });

        var html = '';
        items.forEach(function (it) {
            var isDraggable = it.id !== 'genre';
            html += '<div class="auwb-secmgr-item" data-sec-id="' + it.id + '"' + (isDraggable ? ' draggable="true"' : '') + '>'
                + '<div class="auwb-secmgr-header">'
                + (isDraggable ? '<i class="fa-solid fa-grip-vertical auwb-secmgr-drag"></i>' : '')
                + '<label class="auwb-toggle auwb-toggle-sm">'
                + '<input type="checkbox" class="auwb-secmgr-toggle" ' + (it.enabled ? 'checked' : '') + '>'
                + '<span class="auwb-toggle-slider"></span></label>'
                + '<span class="auwb-secmgr-label">' + A.escapeHtml(it.label) + '</span>';

            if (!it.isBuiltIn) {
                html += '<button class="auwb-preset-btn delete auwb-secmgr-delete" title="삭제">'
                    + '<i class="fa-solid fa-trash"></i></button>';
            }

            html += '<button class="auwb-secmgr-expand auwb-preset-btn" title="주입 설정">'
                + '<i class="fa-solid fa-chevron-down"></i></button>'
                + '</div>'
                + '<div class="auwb-secmgr-body" style="display:none;">'
                + '<div class="auwb-input-row">'
                + '<div class="auwb-input-group auwb-third"><label>위치</label>'
                + '<select class="auwb-select auwb-secmgr-pos">'
                + '<option value="0"' + (it.injPos === 0 ? ' selected' : '') + '>Before Main</option>'
                + '<option value="1"' + (it.injPos === 1 ? ' selected' : '') + '>In-Chat</option>'
                + '<option value="2"' + (it.injPos === 2 ? ' selected' : '') + '>After Main</option>'
                + '</select></div>'
                + '<div class="auwb-input-group auwb-third"><label>Depth</label>'
                + '<input type="number" class="auwb-input auwb-secmgr-depth" value="' + it.injDepth + '" min="0" max="999"></div>'
                + '<div class="auwb-input-group auwb-third"><label>Role</label>'
                + '<select class="auwb-select auwb-secmgr-role">'
                + '<option value="0"' + (it.injRole === 0 ? ' selected' : '') + '>System</option>'
                + '<option value="1"' + (it.injRole === 1 ? ' selected' : '') + '>User</option>'
                + '<option value="2"' + (it.injRole === 2 ? ' selected' : '') + '>Assistant</option>'
                + '</select></div>'
                + '</div></div></div>';
        });

        container.innerHTML = html;
    };

    A.updateSectionDisabledVisuals = function () {
        A.BUILTIN_SECTIONS.forEach(function (bs) {
            var el = document.getElementById(A._biTextareaMap[bs.id]);
            if (!el) return;
            var sec = el.closest('.auwb-section');
            if (!sec) return;
            if (!A.isSectionEnabled(bs.id)) sec.classList.add('auwb-section-disabled');
            else sec.classList.remove('auwb-section-disabled');
        });
    };

    /* ══════════════════════════════════════════════
       Custom Section Content (feature D)
       ══════════════════════════════════════════════ */
    A.renderCustomSectionContent = function () {
        var container = document.getElementById('auwb-custom-sections-content');
        if (!container) return;

        var customs = A.getSettings().customSections || [];
        if (!customs.length) { container.innerHTML = ''; return; }

        var html = '';
        customs.forEach(function (cs) {
            var content = A.getSectionContent(cs.id);
            var dis     = cs.enabled === false;

            html += '<div class="auwb-section' + (dis ? ' auwb-section-disabled' : '') + '">'
                + '<h4><i class="fa-solid fa-puzzle-piece"></i> ' + A.escapeHtml(cs.label)
                + (dis ? ' <span class="auwb-disabled-badge">비활성화</span>' : '') + '</h4>'
                + '<textarea class="auwb-textarea" rows="6" data-custom-section-id="' + cs.id
                + '" placeholder="' + A.escapeHtml(cs.label) + ' 내용...">' + A.escapeHtml(content) + '</textarea>'
                + '<div class="auwb-btn-group">'
                + '<button class="auwb-btn auwb-btn-primary auwb-btn-sm auwb-save-csec" data-sid="' + cs.id + '">'
                + '<i class="fa-solid fa-floppy-disk"></i> 저장</button>'
                + '<button class="auwb-btn auwb-btn-secondary auwb-btn-sm auwb-regen-csec" data-sid="' + cs.id + '"'
                + (dis ? ' disabled' : '') + '>'
                + '<i class="fa-solid fa-rotate"></i> 재생성</button>'
                + '</div></div>';
        });

        container.innerHTML = html;
    };

    /* ══════════════════════════════════════════════
       Diff View (feature C)
       ══════════════════════════════════════════════ */
    A.showDiffView = function (before, after) {
        var diffs = A.computeSnapshotDiff(before, after);
        var el = document.getElementById('auwb-diff-content');
        if (!el) return;

        if (!diffs.length) {
            el.innerHTML = '<p style="text-align:center;color:var(--auwb-text-muted);">변경 사항이 없습니다.</p>';
        } else {
            var html = '';
            diffs.forEach(function (d) {
                html += '<div class="auwb-diff-section"><h4>' + A.escapeHtml(d.label) + '</h4>'
                    + '<div class="auwb-diff-lines">';
                d.lines.forEach(function (l) {
                    var cls    = l.type === 'added' ? 'auwb-diff-added'
                               : l.type === 'removed' ? 'auwb-diff-removed' : 'auwb-diff-same';
                    var prefix = l.type === 'added' ? '+ ' : l.type === 'removed' ? '- ' : '  ';
                    html += '<div class="' + cls + '">' + prefix + A.escapeHtml(l.text) + '</div>';
                });
                html += '</div></div>';
            });
            el.innerHTML = html;
        }

        var modal = document.getElementById('auwb-diff-modal');
        if (modal) modal.style.display = 'flex';
    };

    /* ══════════════════════════════════════════════
       Data Stats & Cleanup (feature H)
       ══════════════════════════════════════════════ */
    A.getChatDataStats = function () {
        var s    = A.getSettings();
        var d    = s.chatData || {};
        var keys = Object.keys(d);
        /* Estimate size without full JSON.stringify — count key lengths + rough value sizes */
        var approx = 2; /* {} */
        for (var i = 0; i < keys.length; i++) {
            var v = d[keys[i]];
            approx += keys[i].length + 4; /* key + quotes + colon + comma */
            if (typeof v === 'string') approx += v.length + 2;
            else if (v && typeof v === 'object') {
                var ks = Object.keys(v);
                for (var j = 0; j < ks.length; j++) {
                    var val = v[ks[j]];
                    approx += ks[j].length + 4;
                    approx += typeof val === 'string' ? val.length + 2 : 10;
                }
            } else approx += 10;
        }
        return {
            totalEntries:  keys.length,
            currentChatId: A.getCurrentChatId(),
            sizeBytes:     approx,
            keys:          keys,
        };
    };

    A.cleanupChatData = function (keepCurrent) {
        var s = A.getSettings();
        if (!s.chatData) return 0;

        var cid  = A.getCurrentChatId();
        var keys = Object.keys(s.chatData);
        var rm   = 0;

        keys.forEach(function (k) {
            if (keepCurrent && k === cid) return;
            delete s.chatData[k];
            rm++;
        });

        A.saveSettings();
        return rm;
    };

    A.updateDataStats = function () {
        var el = document.getElementById('auwb-data-stats');
        if (!el) return;
        var st = A.getChatDataStats();
        el.innerHTML = '<div class="auwb-api-status">'
            + '<span>저장된 채팅 데이터: <strong>' + st.totalEntries + '</strong>개 '
            + '(~' + (st.sizeBytes / 1024).toFixed(1) + 'KB)</span></div>';
    };

    /* ══════════════════════════════════════════════
       History Rendering (feature C — diff button)
       ══════════════════════════════════════════════ */
    var typeMap = {
        'initial': '초기 생성', 'auto-update': '자동 업데이트',
        'manual-update': '수동 업데이트', 'regen': '섹션 재생성',
        'preset-load': '프리셋 로드', 'update': '업데이트',
        'before-rollback': '롤백 전', 'before-import': '가져오기 전',
        'before-clear': '초기화 전',
    };

    A.renderHistoryList = function (filterText) {
        var el = document.getElementById('auwb-history-list');
        if (!el) return;

        var h = A.getHistory();
        if (!h.length) {
            el.innerHTML = '<div class="auwb-preset-empty">히스토리가 없습니다.</div>';
            return;
        }

        var ft = (filterText || '').toLowerCase();
        var html = '';
        h.forEach(function (e) {
            var label = typeMap[e.type] || e.type;
            var dateStr = new Date(e.timestamp).toLocaleString();
            if (ft && (label + ' ' + dateStr).toLowerCase().indexOf(ft) === -1) return;
            html += '<div class="auwb-history-item" data-hid="' + e.id + '">'
                + '<div class="auwb-history-info">'
                + '<span class="auwb-history-type">' + A.escapeHtml(label) + '</span>'
                + '<span class="auwb-history-date">' + dateStr + '</span>'
                + '</div>'
                + '<div class="auwb-preset-actions">'
                + '<button class="auwb-preset-btn auwb-hist-diff" title="현재와 비교"><i class="fa-solid fa-code-compare"></i></button>'
                + '<button class="auwb-preset-btn auwb-hist-view" title="미리보기"><i class="fa-solid fa-eye"></i></button>'
                + '<button class="auwb-preset-btn auwb-hist-rollback" title="복원"><i class="fa-solid fa-rotate-left"></i></button>'
                + '</div></div>';
        });

        el.innerHTML = html || '<div class="auwb-preset-empty">검색 결과 없음</div>';
    };

    function viewHistoryEntry(hid) {
        var entry = A.getHistory().find(function (h) { return h.id === hid; });
        if (!entry) return;

        var snap = entry.snapshot;
        var text = '=== 히스토리 스냅샷 ===\n시간: ' + new Date(entry.timestamp).toLocaleString()
                 + '\n유형: ' + entry.type + '\n\n';

        A.getAllSections().forEach(function (sec) {
            text += '--- ' + sec.label + ' ---\n' + (snap[sec.id] || '(없음)') + '\n\n';
        });
        if (snap.genrePrompt) text += '--- 장르/톤 ---\n' + snap.genrePrompt + '\n';

        var c = document.getElementById('auwb-preview-content');
        if (c) c.textContent = text;
        var m = document.getElementById('auwb-preview-modal');
        if (m) m.style.display = 'flex';
    }

    /* ══════════════════════════════════════════════
       Section Select for Generation (A)
       ══════════════════════════════════════════════ */
    A.renderGenSectionSelect = function () {
        var el = document.getElementById('auwb-gen-section-select');
        if (!el) return;
        var sections = A.getEnabledSections();
        if (!sections.length) { el.innerHTML = ''; return; }
        var html = '';
        sections.forEach(function (sec) {
            var hasContent = !!A.getSectionContent(sec.id);
            html += '<label class="auwb-gen-section-check">'
                + '<input type="checkbox" value="' + sec.id + '" checked>'
                + '<span>' + A.escapeHtml(sec.label)
                + (hasContent ? ' <span class="auwb-content-dot has">\u25CF</span>' : ' <span class="auwb-content-dot empty">\u25CB</span>')
                + '</span></label>';
        });
        el.innerHTML = html;
    };

    /* ══════════════════════════════════════════════
       Custom Refine Directions (H)
       ══════════════════════════════════════════════ */
    A.renderCustomRefineList = function () {
        var el = document.getElementById('auwb-custom-refine-list');
        if (!el) return;
        var dirs = A.getSettings().customRefineDirections || [];
        if (!dirs.length) {
            el.innerHTML = '<div class="auwb-preset-empty">커스텀 리파인 방향이 없습니다.</div>';
            return;
        }
        var html = '';
        dirs.forEach(function (d) {
            html += '<div class="auwb-custom-refine-item" data-rid="' + d.id + '">'
                + '<div class="auwb-custom-refine-info">'
                + '<div class="auwb-custom-refine-label">' + A.escapeHtml(d.label) + '</div>'
                + '<div class="auwb-custom-refine-prompt">' + A.escapeHtml(d.prompt) + '</div>'
                + '</div>'
                + '<button class="auwb-preset-btn delete auwb-del-custom-refine" title="삭제">'
                + '<i class="fa-solid fa-trash"></i></button></div>';
        });
        el.innerHTML = html;
    };

    function rebuildRefineMenus() {
        document.querySelectorAll('.auwb-refine-menu').forEach(function (menu) {
            var secKey = '';
            var opt = menu.querySelector('.auwb-refine-option');
            if (opt) secKey = opt.getAttribute('data-section') || '';
            var html = '';
            A.getAllRefineDirections().forEach(function (dir) {
                html += '<button class="auwb-refine-option" data-dir="' + dir.id + '" data-section="' + secKey + '">'
                    + A.escapeHtml(dir.label) + '</button>';
            });
            menu.innerHTML = html;
        });
    }

    /* ══════════════════════════════════════════════
       What-If Branches (G)
       ══════════════════════════════════════════════ */
    A.renderWhatIfBranches = function () {
        var container = document.getElementById('auwb-whatif-branch-list');
        var section   = document.getElementById('auwb-whatif-branches');
        if (!container) return;
        var branches = A.getWhatIfBranches();
        if (!branches.length) {
            if (section) section.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        if (section) section.style.display = 'block';
        var html = '';
        branches.forEach(function (b) {
            html += '<div class="auwb-whatif-branch-item" data-bid="' + b.id + '">'
                + '<div class="auwb-whatif-branch-info">'
                + '<div class="auwb-whatif-branch-name">' + A.escapeHtml(b.name) + '</div>'
                + '<div class="auwb-whatif-branch-date">' + new Date(b.timestamp).toLocaleString() + '</div>'
                + '</div>'
                + '<div class="auwb-preset-actions">'
                + '<button class="auwb-preset-btn load auwb-wif-load" title="로드"><i class="fa-solid fa-upload"></i></button>'
                + '<button class="auwb-preset-btn delete auwb-wif-del" title="삭제"><i class="fa-solid fa-trash"></i></button>'
                + '</div></div>';
        });
        container.innerHTML = html;
    };

    /* ══════════════════════════════════════════════
       Presets
       ══════════════════════════════════════════════ */
    function genPresetId() {
        return 'preset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    A.getPresets = function () {
        return A.getSettings().presets || [];
    };

    A.savePreset = function (name) {
        if (!name || !name.trim()) throw new Error('Name required');
        var data = A.getFullSnapshot();
        var ci   = A.getCharacterInfo();
        var preset = {
            id: genPresetId(), name: name.trim(),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            characterName: ci.charName, data: data,
        };
        var s = A.getSettings();
        if (!s.presets) s.presets = [];
        s.presets.push(preset);
        A.saveSettings();
        return preset;
    };

    A.loadPreset = function (presetId) {
        var p = A.getPresets().find(function (x) { return x.id === presetId; });
        if (!p) throw new Error('Not found');
        A.saveToHistory('preset-load', A.getFullSnapshot());
        var d = p.data;
        Object.keys(d).forEach(function (k) {
            if (k === 'genrePrompt') { A.saveChatData('genrePrompt', d[k] || ''); return; }
            A.setSectionContent(k, d[k] || '');
        });
        A.loadChatDataToUI();
        return p;
    };

    A.renamePreset = function (pid, newName) {
        var s = A.getSettings();
        var p = s.presets.find(function (x) { return x.id === pid; });
        if (!p) throw new Error('Not found');
        p.name      = newName.trim();
        p.updatedAt = new Date().toISOString();
        A.saveSettings();
    };

    A.deletePreset = function (pid) {
        var s = A.getSettings();
        var i = s.presets.findIndex(function (x) { return x.id === pid; });
        if (i === -1) throw new Error('Not found');
        s.presets.splice(i, 1);
        A.saveSettings();
    };

    A.exportPresets = function () {
        downloadJSON({
            version: '1.0', exportDate: new Date().toISOString(),
            type: 'au-world-builder-presets', presets: A.getPresets(),
        }, 'au-wb-presets-' + Date.now() + '.json');
    };

    A.importPresets = function (fileContent) {
        var d = JSON.parse(fileContent);
        if (d.type !== 'au-world-builder-presets' || !Array.isArray(d.presets)) throw new Error('Invalid');
        var s = A.getSettings();
        if (!s.presets) s.presets = [];
        var count = 0;
        d.presets.forEach(function (p) {
            p.id   = genPresetId();
            p.name = p.name + ' (imported)';
            s.presets.push(p);
            count++;
        });
        A.saveSettings();
        return count;
    };

    A.renderPresetList = function (filterText) {
        var el = document.getElementById('auwb-preset-list');
        if (!el) return;

        var ps = A.getPresets();
        if (!ps.length) {
            el.innerHTML = '<div class="auwb-preset-empty">저장된 프리셋이 없습니다.</div>';
            return;
        }

        var ft = (filterText || '').toLowerCase();
        var html = '';
        ps.forEach(function (p) {
            if (ft && p.name.toLowerCase().indexOf(ft) === -1) return;
            html += '<div class="auwb-preset-item" data-pid="' + p.id + '">'
                + '<span class="auwb-preset-name">' + A.escapeHtml(p.name) + '</span>'
                + '<span class="auwb-preset-date">' + new Date(p.createdAt).toLocaleDateString() + '</span>'
                + '<div class="auwb-preset-actions">'
                + '<button class="auwb-preset-btn load" title="Load"><i class="fa-solid fa-download"></i></button>'
                + '<button class="auwb-preset-btn rename" title="Rename"><i class="fa-solid fa-pen"></i></button>'
                + '<button class="auwb-preset-btn delete" title="Delete"><i class="fa-solid fa-trash"></i></button>'
                + '</div></div>';
        });

        el.innerHTML = html || '<div class="auwb-preset-empty">검색 결과 없음</div>';
    };

    function startRenamePreset(itemEl, pid) {
        var nameEl      = itemEl.querySelector('.auwb-preset-name');
        var currentName = nameEl.textContent;

        var inp       = document.createElement('input');
        inp.type      = 'text';
        inp.className = 'auwb-preset-name-input';
        inp.value     = currentName;

        nameEl.style.display = 'none';
        itemEl.insertBefore(inp, nameEl);
        inp.focus();
        inp.select();

        function finish() {
            var n = inp.value.trim();
            if (n && n !== currentName) {
                try { A.renamePreset(pid, n); A.showStatus('이름 변경됨', 'success'); }
                catch (_) {}
            }
            A.renderPresetList();
        }

        inp.addEventListener('blur', finish);
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter')       { e.preventDefault(); finish(); }
            else if (e.key === 'Escape') A.renderPresetList();
        });
    }

    /* ══════════════════════════════════════════════
       Lorebook / World Info Export
       ══════════════════════════════════════════════ */
    A.exportToLorebook = function () {
        var ci = A.getCharacterInfo();
        var cd = A.getChatData();
        var entries = {}, uid = 0;

        function add(kw, cmt, ct) {
            if (!ct || !ct.trim()) return;
            entries[uid] = {
                uid: uid, key: kw, keysecondary: [],
                comment: cmt, content: ct.trim(),
                constant: false, selective: false, selectiveLogic: 0,
                addMemo: true, order: 100 + uid, position: 0, disable: false,
                excludeRecursion: false, preventRecursion: false,
                delayUntilRecursion: false, probability: 100, useProbability: true,
                depth: 4, group: 'AU World Builder', groupOverride: false,
                groupWeight: 100, scanDepth: null, caseSensitive: false,
                matchWholeWords: false, automationId: '', role: null,
                sticky: null, cooldown: null, delay: null,
            };
            uid++;
        }

        A.getAllSections().forEach(function (sec) {
            add([sec.label.toLowerCase(), 'au'], 'AU: ' + sec.label, A.getSectionContent(sec.id));
        });

        var gp = cd.genrePrompt;
        if (gp) add(['au genre', 'au tone'], 'AU Genre/Tone', gp);

        downloadJSON({ entries: entries }, 'AU-WorldInfo-' + (ci.charName || 'export') + '-' + Date.now() + '.json');
        A.showStatus('Lorebook JSON 내보내기 완료!', 'success');
    };

    A.exportToLorebookDirect = async function () {
        try {
            var ctx  = SillyTavern.getContext();
            var exec = ctx.executeSlashCommandsWithOptions || ctx.executeSlashCommands;
            if (!exec) throw 0;

            var n = 0;
            var sections = A.getEnabledSections();
            for (var i = 0; i < sections.length; i++) {
                var sec = sections[i];
                var c   = A.getSectionContent(sec.id);
                if (!c) continue;
                await exec('/wi create key="' + sec.label.toLowerCase() + ', au" ' + c.replace(/\n/g, ' ').substring(0, 2000));
                n++;
            }
            A.showStatus(n + '개 WI 항목 생성!', 'success');
        } catch (_) {
            A.exportToLorebook();
        }
    };

    /* ══════════════════════════════════════════════
       Import / Export / Clear
       ══════════════════════════════════════════════ */
    function downloadJSON(data, filename) {
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    A.exportSettings = function () {
        var snap = A.getFullSnapshot();
        var ci   = A.getCharacterInfo();
        downloadJSON({
            version: '2.1', exportDate: new Date().toISOString(),
            characterName: ci.charName, userName: ci.userName,
            auConcept: A.getChatData().auConcept || '', data: snap,
        }, 'au-wb-' + (ci.charName || 'export') + '-' + Date.now() + '.json');
        A.showStatus('내보내기 완료!', 'success');
    };

    A.importSettings = function (file) {
        var reader = new FileReader();
        reader.onload = function (ev) {
            try {
                var d   = JSON.parse(ev.target.result);
                A.saveToHistory('before-import', A.getFullSnapshot());
                var imp = d.data || d;

                if (d.auConcept != null) {
                    A.saveChatData('auConcept', d.auConcept);
                    A.setVal('auwb-au-concept', d.auConcept);
                }
                if (imp.auConcept != null) {
                    A.saveChatData('auConcept', imp.auConcept);
                    A.setVal('auwb-au-concept', imp.auConcept);
                }

                Object.keys(imp).forEach(function (k) {
                    if (k === 'genrePrompt') {
                        A.saveChatData('genrePrompt', imp[k]);
                        A.setVal('auwb-genre-prompt', imp[k]);
                        return;
                    }
                    if (k === 'auConcept') return;
                    if (k === 'worldSetting') { A.setSectionContent('world', imp[k]); return; }
                    if (k === 'characterSettings') {
                        if (imp[k].char) A.setSectionContent('charSetting', imp[k].char);
                        if (imp[k].user) A.setSectionContent('userSetting', imp[k].user);
                        return;
                    }
                    if (k === 'clothingStyles') {
                        if (imp[k].char) A.setSectionContent('charClothing', imp[k].char);
                        if (imp[k].user) A.setSectionContent('userClothing', imp[k].user);
                        return;
                    }
                    A.setSectionContent(k, imp[k]);
                });

                A.loadChatDataToUI();
                A.showStatus('가져오기 완료!', 'success');
                A.renderHistoryList();
            } catch (_) {
                A.showStatus('가져오기 실패: 잘못된 JSON', 'error');
            }
        };
        reader.readAsText(file);
    };

    A.clearAllSettings = async function () {
        if (!await A.showConfirm('모든 AU World Builder 설정을 초기화하시겠습니까?')) return;
        A.saveToHistory('before-clear', A.getFullSnapshot());
        A.getAllSections().forEach(function (sec) {
            A.setSectionContent(sec.id, '');
            A.setSectionTextareaValue(sec.id, '');
        });
        A.saveChatData('genrePrompt', '');
        A.saveChatData('auConcept', '');
        A.setVal('auwb-au-concept', '');
        A.setVal('auwb-genre-prompt', '');
        A.showStatus('모든 설정 초기화됨!', 'success');
        A.renderHistoryList();
    };

    /* ══════════════════════════════════════════════
       Event Binding Helpers
       ══════════════════════════════════════════════ */
    function btnLoading(btn, asyncFn) {
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        var orig = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 처리 중…';
        asyncFn()
            .catch(function (e) { A.showStatus('실패: ' + e.message, 'error'); })
            .finally(function () { btn.disabled = false; btn.innerHTML = orig; });
    }

    function withLoading(btnId, asyncFn) {
        return async function () {
            var btn = document.getElementById(btnId);
            if (!btn || btn.disabled) return;
            btn.disabled = true;
            var orig = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 처리 중…';
            try { await asyncFn(); }
            catch (e) { A.showStatus('실패: ' + e.message, 'error'); }
            finally { btn.disabled = false; btn.innerHTML = orig; }
        };
    }

    A.openPopup = function () {
        var p = document.getElementById('au-world-builder-popup');
        if (p) {
            p.style.display = 'flex';
            A.loadSettingsToUI();
            A.checkApiStatus();
            A.renderPresetList();
            A.renderGenSectionSelect();
            A.renderCustomRefineList();
            A.renderWhatIfBranches();
        }
    };

    function bindClick(id, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    }

    function bindChange(id, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', function () { fn(el.checked); });
    }

    function bindInputChange(id, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', function () { fn(el.value); });
    }

    /* ══════════════════════════════════════════════
       Event Delegation (bound once, handles dynamic content)
       ══════════════════════════════════════════════ */
    function _initDelegation() {
        /* Section Manager */
        var secMgr = document.getElementById('auwb-section-manager');
        if (secMgr) {
            secMgr.addEventListener('change', function (e) {
                var item = e.target.closest('.auwb-secmgr-item');
                if (!item) return;
                var sid = item.getAttribute('data-sec-id');
                if (e.target.classList.contains('auwb-secmgr-toggle')) {
                    A.updateSectionConfig(sid, 'enabled', e.target.checked);
                    A.updateTokenDisplay();
                    A.renderCustomSectionContent();
                    A.updateSectionDisabledVisuals();
                } else if (e.target.classList.contains('auwb-secmgr-pos')) {
                    A.updateSectionConfig(sid, 'injPos', parseInt(e.target.value));
                } else if (e.target.classList.contains('auwb-secmgr-depth')) {
                    A.updateSectionConfig(sid, 'injDepth', parseInt(e.target.value) || 4);
                } else if (e.target.classList.contains('auwb-secmgr-role')) {
                    A.updateSectionConfig(sid, 'injRole', parseInt(e.target.value));
                }
            });
            secMgr.addEventListener('click', async function (e) {
                var item = e.target.closest('.auwb-secmgr-item');
                if (!item) return;
                var sid = item.getAttribute('data-sec-id');
                if (e.target.closest('.auwb-secmgr-expand')) {
                    var body = item.querySelector('.auwb-secmgr-body');
                    var icon = e.target.closest('.auwb-secmgr-expand').querySelector('i');
                    body.style.display = body.style.display === 'none' ? 'block' : 'none';
                    icon.className = body.style.display === 'none'
                        ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
                }
                if (e.target.closest('.auwb-secmgr-delete')) {
                    var label = item.querySelector('.auwb-secmgr-label').textContent;
                    if (!await A.showConfirm('커스텀 섹션 "' + label + '"을(를) 삭제하시겠습니까?')) return;
                    A.removeCustomSection(sid);
                    A.renderSectionManager();
                    A.renderCustomSectionContent();
                    A.updateExtensionPrompt();
                    A.showStatus('섹션 삭제됨', 'success');
                }
            });

            /* C: Drag reorder */
            var dragSrc = null;
            secMgr.addEventListener('dragstart', function (e) {
                var item = e.target.closest('.auwb-secmgr-item');
                if (!item || item.getAttribute('data-sec-id') === 'genre') return;
                dragSrc = item;
                item.classList.add('auwb-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            secMgr.addEventListener('dragover', function (e) {
                e.preventDefault();
                var item = e.target.closest('.auwb-secmgr-item');
                if (!item || item === dragSrc || item.getAttribute('data-sec-id') === 'genre') return;
                e.dataTransfer.dropEffect = 'move';
                secMgr.querySelectorAll('.auwb-secmgr-item').forEach(function (it) { it.classList.remove('auwb-drag-over'); });
                item.classList.add('auwb-drag-over');
            });
            secMgr.addEventListener('drop', function (e) {
                e.preventDefault();
                var target = e.target.closest('.auwb-secmgr-item');
                if (!target || !dragSrc || target === dragSrc || target.getAttribute('data-sec-id') === 'genre') return;
                secMgr.insertBefore(dragSrc, target);
                var order = [];
                secMgr.querySelectorAll('.auwb-secmgr-item').forEach(function (it) {
                    var sid = it.getAttribute('data-sec-id');
                    if (sid !== 'genre') order.push(sid);
                });
                A.saveSetting('sectionOrder', order);
            });
            secMgr.addEventListener('dragend', function () {
                if (dragSrc) dragSrc.classList.remove('auwb-dragging');
                dragSrc = null;
                secMgr.querySelectorAll('.auwb-secmgr-item').forEach(function (it) {
                    it.classList.remove('auwb-drag-over');
                });
            });
        }

        /* History List */
        var histList = document.getElementById('auwb-history-list');
        if (histList) {
            histList.addEventListener('click', async function (e) {
                var item = e.target.closest('.auwb-history-item');
                if (!item) return;
                var hid = item.getAttribute('data-hid');
                if (e.target.closest('.auwb-hist-diff')) {
                    var ent = A.getHistory().find(function (h) { return h.id === hid; });
                    if (ent) A.showDiffView(ent.snapshot, A.getFullSnapshot());
                } else if (e.target.closest('.auwb-hist-view')) {
                    viewHistoryEntry(hid);
                } else if (e.target.closest('.auwb-hist-rollback')) {
                    if (!await A.showConfirm('이 버전으로 복원하시겠습니까?')) return;
                    A.saveToHistory('before-rollback', A.getFullSnapshot());
                    A.rollbackToVersion(hid);
                    A.renderHistoryList();
                }
            });
        }

        /* Preset List */
        var presetList = document.getElementById('auwb-preset-list');
        if (presetList) {
            presetList.addEventListener('click', async function (e) {
                var item = e.target.closest('.auwb-preset-item');
                if (!item) return;
                var pid = item.getAttribute('data-pid');
                if (e.target.closest('.load')) {
                    try {
                        A.loadPreset(pid);
                        A.showStatus('프리셋 로드 완료!', 'success');
                        A.renderPresetList();
                    } catch (err) { A.showStatus('로드 실패: ' + err.message, 'error'); }
                } else if (e.target.closest('.rename')) {
                    startRenamePreset(item, pid);
                } else if (e.target.closest('.delete')) {
                    if (!await A.showConfirm('삭제?')) return;
                    try {
                        A.deletePreset(pid);
                        A.showStatus('삭제됨', 'success');
                        A.renderPresetList();
                    } catch (err) { A.showStatus(err.message, 'error'); }
                }
            });
        }

        /* Custom Section Content */
        var csecCont = document.getElementById('auwb-custom-sections-content');
        if (csecCont) {
            csecCont.addEventListener('click', function (e) {
                var saveBtn = e.target.closest('.auwb-save-csec');
                if (saveBtn) {
                    var sid = saveBtn.getAttribute('data-sid');
                    var ta = csecCont.querySelector('[data-custom-section-id="' + sid + '"]');
                    if (ta) {
                        A.setSectionContent(sid, ta.value);
                        A.updateExtensionPrompt();
                        A.updateTokenDisplay();
                        A.showStatus('커스텀 섹션 저장됨!', 'success');
                    }
                    return;
                }
                var regenBtn = e.target.closest('.auwb-regen-csec');
                if (regenBtn) {
                    var sid2 = regenBtn.getAttribute('data-sid');
                    btnLoading(regenBtn, async function () {
                        A.showStatus('섹션 재생성 중…', 'info');
                        A.saveToHistory('regen', A.getFullSnapshot());
                        var res = await A.regenerateSection(sid2);
                        if (res && res.value) {
                            A.commitSectionChange(sid2, res.value);
                            A.showStatus('재생성 완료!', 'success');
                        }
                    });
                    return;
                }
            });
        }

        /* H: Custom Refine Directions delegation */
        var refineList = document.getElementById('auwb-custom-refine-list');
        if (refineList) {
            refineList.addEventListener('click', async function (e) {
                var delBtn = e.target.closest('.auwb-del-custom-refine');
                if (!delBtn) return;
                var item = delBtn.closest('.auwb-custom-refine-item');
                if (!item) return;
                var rid = item.getAttribute('data-rid');
                if (!await A.showConfirm('이 커스텀 리파인 방향을 삭제하시겠습니까?')) return;
                var s = A.getSettings();
                s.customRefineDirections = (s.customRefineDirections || []).filter(function (d) { return d.id !== rid; });
                A.saveSetting('customRefineDirections', s.customRefineDirections);
                A.renderCustomRefineList();
                rebuildRefineMenus();
                A.showStatus('삭제됨', 'success');
            });
        }

        /* G: What-If Branch delegation */
        var wifList = document.getElementById('auwb-whatif-branch-list');
        if (wifList) {
            wifList.addEventListener('click', async function (e) {
                var item = e.target.closest('.auwb-whatif-branch-item');
                if (!item) return;
                var bid = item.getAttribute('data-bid');
                if (e.target.closest('.auwb-wif-load')) {
                    if (!await A.showConfirm('이 브랜치를 로드하시겠습니까? 현재 상태는 히스토리에 저장됩니다.')) return;
                    A.loadWhatIfBranch(bid);
                    A.renderHistoryList();
                    A.showStatus('브랜치 로드 완료!', 'success');
                } else if (e.target.closest('.auwb-wif-del')) {
                    if (!await A.showConfirm('삭제하시겠습니까?')) return;
                    A.deleteWhatIfBranch(bid);
                    A.renderWhatIfBranches();
                    A.showStatus('삭제됨', 'success');
                }
            });
        }
    }

    /* ══════════════════════════════════════════════
       Generation Options (toggle buttons) — expanded
       ══════════════════════════════════════════════ */
    function initGenOptions() {
        var maps = [
            { prefix: 'auwb-opt-cliche',      key: 'cliche',      vals: ['allow', 'subvert'] },
            { prefix: 'auwb-opt-relation',     key: 'relation',    vals: ['first', 'acquaint', 'friend', 'close', 'complex'] },
            { prefix: 'auwb-opt-original',     key: 'original',    vals: ['break', 'keep'] },
            { prefix: 'auwb-opt-mood',         key: 'mood',        vals: ['light', 'dark', 'bittersweet'] },
            { prefix: 'auwb-opt-conflict',     key: 'conflict',    vals: ['none', 'subtle', 'central'] },
            { prefix: 'auwb-opt-detailDepth',  key: 'detailDepth', vals: ['minimal', 'normal', 'detailed', 'extreme'] },
            { prefix: 'auwb-opt-outputVolume',  key: 'outputVolume', vals: ['compact', 'medium', 'long', 'very_long'] },
        ];
        var opts = A.getSettings().genOptions || {};

        maps.forEach(function (m) {
            m.vals.forEach(function (v) {
                var b = document.getElementById(m.prefix + '-' + v);
                if (!b) return;

                if (opts[m.key] === v) b.classList.add('active');
                else b.classList.remove('active');

                b.addEventListener('click', function () {
                    m.vals.forEach(function (vv) {
                        var bb = document.getElementById(m.prefix + '-' + vv);
                        if (bb) bb.classList.remove('active');
                    });
                    b.classList.add('active');
                    var s = A.getSettings();
                    if (!s.genOptions) s.genOptions = {};
                    s.genOptions[m.key] = v;
                    A.saveSetting('genOptions', s.genOptions);
                });
            });
        });

        /* Genre tags (#3) — multi-select */
        initGenreTags();
    }

    var BUILTIN_GENRES = ['로맨스','코미디','앵스트','판타지','SF','미스터리','일상','액션','호러','힐링','느와르','역사'];

    function initGenreTags() {
        renderGenreTags();

        /* Add custom tag */
        bindClick('auwb-add-genre-tag', function () {
            var inp = document.getElementById('auwb-custom-genre-input');
            if (!inp) return;
            var val = inp.value.trim();
            if (!val) return;

            var s = A.getSettings();
            if (!s.genOptions) s.genOptions = {};
            var custom = s.genOptions.customGenres || [];
            if (BUILTIN_GENRES.indexOf(val) !== -1 || custom.indexOf(val) !== -1) {
                A.showStatus('이미 존재하는 태그입니다.', 'info');
                return;
            }
            custom.push(val);
            s.genOptions.customGenres = custom;
            A.saveSetting('genOptions', s.genOptions);
            inp.value = '';
            renderGenreTags();
        });

        /* Enter key to add */
        var inp = document.getElementById('auwb-custom-genre-input');
        if (inp) inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); document.getElementById('auwb-add-genre-tag').click(); }
        });
    }

    function renderGenreTags() {
        var container = document.getElementById('auwb-genre-tags');
        if (!container) return;

        var s    = A.getSettings();
        var opts = s.genOptions || {};
        var selected = opts.genreTags || [];
        var custom   = opts.customGenres || [];
        var allGenres = BUILTIN_GENRES.concat(custom);

        var html = '';
        allGenres.forEach(function (g) {
            var isActive  = selected.indexOf(g) !== -1;
            var isCustom  = custom.indexOf(g) !== -1;
            html += '<button class="auwb-genre-tag' + (isActive ? ' active' : '') + '" data-genre="' + A.escapeHtml(g) + '">'
                + A.escapeHtml(g)
                + (isCustom ? ' <i class="fa-solid fa-xmark auwb-genre-tag-del"></i>' : '')
                + '</button>';
        });
        container.innerHTML = html;

        /* Bind clicks via delegation */
        container.onclick = function (e) {
            /* Delete custom tag */
            if (e.target.closest('.auwb-genre-tag-del')) {
                var btn = e.target.closest('.auwb-genre-tag');
                var genre = btn.getAttribute('data-genre');
                var gs = A.getSettings();
                if (!gs.genOptions) return;
                gs.genOptions.customGenres = (gs.genOptions.customGenres || []).filter(function (g) { return g !== genre; });
                gs.genOptions.genreTags   = (gs.genOptions.genreTags || []).filter(function (g) { return g !== genre; });
                A.saveSetting('genOptions', gs.genOptions);
                renderGenreTags();
                return;
            }
            /* Toggle tag */
            var tag = e.target.closest('.auwb-genre-tag');
            if (!tag) return;
            var genre = tag.getAttribute('data-genre');
            tag.classList.toggle('active');
            var gs = A.getSettings();
            if (!gs.genOptions) gs.genOptions = {};
            var cur = gs.genOptions.genreTags || [];
            var idx = cur.indexOf(genre);
            if (idx !== -1) cur.splice(idx, 1);
            else cur.push(genre);
            gs.genOptions.genreTags = cur;
            A.saveSetting('genOptions', gs.genOptions);
        };
    }

    /* ══════════════════════════════════════════════
       Collapsible Sections
       ══════════════════════════════════════════════ */
    function initCollapsibles() {
        document.querySelectorAll('.auwb-collapse-trigger').forEach(function (header) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', function () {
                var targetId = header.getAttribute('data-target');
                var body = document.getElementById(targetId);
                if (!body) return;
                var icon = header.querySelector('.auwb-collapse-icon');
                if (body.style.display === 'none') {
                    body.style.display = 'block';
                    if (icon) icon.className = 'fa-solid fa-chevron-up auwb-collapse-icon';
                } else {
                    body.style.display = 'none';
                    if (icon) icon.className = 'fa-solid fa-chevron-down auwb-collapse-icon';
                }
            });
        });
    }

    /* ══════════════════════════════════════════════
       Refine Dropdown (#7)
       ══════════════════════════════════════════════ */
    function initRefineDropdowns() {
        document.querySelectorAll('.auwb-refine-trigger').forEach(function (trigger) {
            var dropdown = trigger.closest('.auwb-refine-dropdown');
            var menu     = dropdown.querySelector('.auwb-refine-menu');
            var secKey   = trigger.getAttribute('data-section');

            /* Build menu from REFINE_DIRECTIONS */
            var html = '';
            A.getAllRefineDirections().forEach(function (dir) {
                html += '<button class="auwb-refine-option" data-dir="' + dir.id + '" data-section="' + secKey + '">'
                    + A.escapeHtml(dir.label) + '</button>';
            });
            menu.innerHTML = html;

            /* Portal menu to body so it escapes contain:strict on .auwb-content */
            document.body.appendChild(menu);

            trigger.addEventListener('click', function (e) {
                e.stopPropagation();
                var isOpen = menu.style.display !== 'none';
                /* Close all refine menus first */
                document.querySelectorAll('.auwb-refine-menu').forEach(function (m) { m.style.display = 'none'; });
                if (!isOpen) {
                    /* Position fixed menu above the trigger button */
                    var rect = trigger.getBoundingClientRect();
                    menu.style.display = 'flex';
                    var menuH = menu.offsetHeight;
                    menu.style.left = rect.left + 'px';
                    menu.style.top  = (rect.top - menuH - 4) + 'px';
                    /* If menu goes above viewport, show below instead */
                    if (rect.top - menuH - 4 < 0) {
                        menu.style.top = (rect.bottom + 4) + 'px';
                    }
                }
            });
        });

        /* Close on outside click */
        document.addEventListener('click', function () {
            document.querySelectorAll('.auwb-refine-menu').forEach(function (m) { m.style.display = 'none'; });
        });

        /* Close on scroll (fixed-position menu won't follow scroll) */
        var contentEl = document.querySelector('#au-world-builder-popup .auwb-content');
        if (contentEl) {
            contentEl.addEventListener('scroll', function () {
                document.querySelectorAll('.auwb-refine-menu').forEach(function (m) { m.style.display = 'none'; });
            }, { passive: true });
        }

        /* Handle refine option click via delegation */
        document.addEventListener('click', function (e) {
            var opt = e.target.closest('.auwb-refine-option');
            if (!opt) return;
            var secKey = opt.getAttribute('data-section');
            var dirId  = opt.getAttribute('data-dir');
            opt.closest('.auwb-refine-menu').style.display = 'none';

            btnLoading(opt, async function () {
                A.showStatus('리파인 중…', 'info');
                A.saveToHistory('regen', A.getFullSnapshot());
                var res = await A.refineSection(secKey, dirId);
                if (res && res.value) {
                    A.commitSectionChange(secKey, res.value);
                    A.showStatus('리파인 완료!', 'success');
                }
            });
        });
    }

    /* ══════════════════════════════════════════════
       Main UI Event Binding
       ══════════════════════════════════════════════ */
    A.bindUIEvents = function () {
        var popup = document.getElementById('au-world-builder-popup');
        if (!popup) return;

        /* Close */
        bindClick('auwb-close', function () {
            popup.style.display = 'none';
            /* M: Cleanup portaled refine menus */
            document.querySelectorAll('.auwb-refine-menu').forEach(function (m) { m.style.display = 'none'; });
        });
        var ov = popup.querySelector('.auwb-popup-overlay');
        if (ov) ov.addEventListener('click', function () {
            popup.style.display = 'none';
            document.querySelectorAll('.auwb-refine-menu').forEach(function (m) { m.style.display = 'none'; });
        });

        /* Tabs */
        popup.querySelectorAll('.auwb-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tid = btn.getAttribute('data-tab');
                popup.querySelectorAll('.auwb-tab-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                popup.querySelectorAll('.auwb-tab-content').forEach(function (c) {
                    c.style.display = c.id === 'auwb-tab-' + tid ? 'block' : 'none';
                });
            });
        });

        /* Modals */
        bindClick('auwb-preview-close', function () {
            document.getElementById('auwb-preview-modal').style.display = 'none';
        });
        var pov = document.querySelector('#auwb-preview-modal .auwb-modal-overlay');
        if (pov) pov.addEventListener('click', function () {
            document.getElementById('auwb-preview-modal').style.display = 'none';
        });
        bindClick('auwb-diff-close', function () {
            document.getElementById('auwb-diff-modal').style.display = 'none';
        });
        var dov = document.querySelector('#auwb-diff-modal .auwb-modal-overlay');
        if (dov) dov.addEventListener('click', function () {
            document.getElementById('auwb-diff-modal').style.display = 'none';
        });

        initGenOptions();

        /* ── Generate Tab ── */
        bindClick('auwb-generate-btn', withLoading('auwb-generate-btn', async function () {
            var concept = A.getElVal('auwb-au-concept').trim();
            if (!concept) { A.showStatus('AU 컨셉을 입력하세요.', 'error'); return; }

            /* Save reference & relationship to chatData */
            var ref = A.getElVal('auwb-reference').trim();
            var rel = A.getElVal('auwb-relationship').trim();
            if (ref) A.saveChatData('reference', ref);
            if (rel) A.saveChatData('relationship', rel);

            /* A: Read selected sections */
            var filterIds = [];
            document.querySelectorAll('#auwb-gen-section-select input[type="checkbox"]:checked').forEach(function (cb) {
                filterIds.push(cb.value);
            });
            if (!filterIds.length) filterIds = null;

            A.showStatus('AU 세계 생성 중…', 'info');
            A.saveToHistory('initial', A.getFullSnapshot());

            var result = await A.generateAUWorld(concept, filterIds);
            if (!result) { A.showStatus('API 응답이 비어있습니다.', 'error'); return; }

            var parsed = A.parseGeneratedContent(result);
            var eids   = filterIds || A.getEnabledSections().map(function (s) { return s.id; });

            Object.keys(parsed).forEach(function (k) {
                if (eids.indexOf(k) === -1) return;
                A.setSectionContent(k, parsed[k] || '');
                A.setSectionTextareaValue(k, parsed[k] || '');
            });

            A.saveChatData('auConcept', concept);
            A.updateExtensionPrompt();
            A.updateTokenDisplay();
            A.renderHistoryList();
            A.renderCustomSectionContent();
            A.showStatus('AU 세계 생성 완료!', 'success');
        }));

        /* #6 Brainstorm */
        bindClick('auwb-brainstorm-btn', withLoading('auwb-brainstorm-btn', async function () {
            var concept = A.getElVal('auwb-au-concept').trim();
            if (!concept) { A.showStatus('AU 컨셉을 입력하세요.', 'error'); return; }

            /* Save reference */
            var ref = A.getElVal('auwb-reference').trim();
            if (ref) A.saveChatData('reference', ref);

            A.showStatus('브레인스톰 중…', 'info');
            var ideas = await A.generateBrainstorm(concept);
            if (!ideas || !ideas.length) {
                A.showStatus('아이디어를 생성하지 못했습니다.', 'error');
                return;
            }

            var area  = document.getElementById('auwb-brainstorm-area');
            var cards = document.getElementById('auwb-brainstorm-cards');
            if (!area || !cards) return;

            var html = '';
            ideas.forEach(function (idea, idx) {
                html += '<div class="auwb-brainstorm-card" data-idx="' + idx + '">'
                    + '<div class="auwb-brainstorm-title">' + A.escapeHtml(idea.title) + '</div>'
                    + '<div class="auwb-brainstorm-summary">' + A.escapeHtml(idea.summary) + '</div>'
                    + '</div>';
            });
            cards.innerHTML = html;
            area.style.display = 'block';
            area._ideas = ideas;
            A.showStatus('3개 컨셉이 생성되었습니다. 선택하세요!', 'success');
        }));

        /* Brainstorm card click — delegate */
        var bArea = document.getElementById('auwb-brainstorm-area');
        if (bArea) {
            bArea.addEventListener('click', function (e) {
                var card = e.target.closest('.auwb-brainstorm-card');
                if (!card) return;
                var idx   = parseInt(card.getAttribute('data-idx'));
                var ideas = bArea._ideas;
                if (!ideas || !ideas[idx]) return;

                /* Set concept to chosen idea and generate */
                var chosen = ideas[idx];
                var newConcept = A.getElVal('auwb-au-concept').trim() + '\n\n[선택된 방향] ' + chosen.title + ': ' + chosen.summary;
                A.setVal('auwb-au-concept', newConcept);
                bArea.style.display = 'none';

                /* Trigger generate */
                var genBtn = document.getElementById('auwb-generate-btn');
                if (genBtn) genBtn.click();
            });
        }

        /* #8 What-If */
        bindClick('auwb-whatif-btn', withLoading('auwb-whatif-btn', async function () {
            var premise = A.getElVal('auwb-whatif-premise').trim();
            if (!premise) { A.showStatus('What-If 전제를 입력하세요.', 'error'); return; }

            var existing = A.buildExistingSettings();
            if (!existing || existing.indexOf('Not yet') !== -1) {
                A.showStatus('먼저 AU를 생성해주세요.', 'error');
                return;
            }

            A.showStatus('What-If 변형 생성 중…', 'info');
            A.saveToHistory('initial', A.getFullSnapshot());

            var result = await A.generateWhatIf(premise);
            if (!result) { A.showStatus('API 응답이 비어있습니다.', 'error'); return; }

            /* Show diff before applying */
            var before = A.getFullSnapshot();
            var parsed = A.parseGeneratedContent(result);
            var eids   = A.getEnabledSections().map(function (s) { return s.id; });

            Object.keys(parsed).forEach(function (k) {
                if (eids.indexOf(k) === -1) return;
                A.setSectionContent(k, parsed[k] || '');
                A.setSectionTextareaValue(k, parsed[k] || '');
            });

            A.updateExtensionPrompt();
            A.updateTokenDisplay();
            A.renderHistoryList();
            A.renderCustomSectionContent();

            var after = A.getFullSnapshot();
            A.showDiffView(before, after);

            /* G: Save What-If branch */
            var branchName = await A.showPrompt('What-If 브랜치 이름 (저장하려면 입력, 취소 시 건너뜀):');
            if (branchName && branchName.trim()) {
                A.saveWhatIfBranch(branchName.trim(), premise, after);
                A.renderWhatIfBranches();
            }

            A.showStatus('What-If 변형 완료! 변경사항을 확인하세요.', 'success');
        }));

        bindClick('auwb-manual-update-btn', withLoading('auwb-manual-update-btn', async function () {
            var s = parseInt(A.getElVal('auwb-update-start')) || 0;
            var e = parseInt(A.getElVal('auwb-update-end'))   || 0;
            if (e < s) { A.showStatus('종료 인덱스가 시작보다 커야 합니다.', 'error'); return; }

            A.showStatus('메시지 분석 중…', 'info');
            var result = await A.updateFromRange(s, e);
            if (result) {
                A.applyUpdateResult(result, 'manual-update');
                var lu = document.getElementById('auwb-last-update');
                if (lu) lu.textContent = '마지막: ' + new Date().toLocaleString() + ' (#' + s + '–#' + e + ')';
            }
        }));

        bindClick('auwb-generate-genre-btn', withLoading('auwb-generate-genre-btn', async function () {
            A.showStatus('장르 프롬프트 생성 중…', 'info');
            var r = await A.generateGenrePromptText();
            if (r) {
                A.saveChatData('genrePrompt', r);
                A.setVal('auwb-genre-prompt', r);
                A.showStatus('장르 프롬프트 생성 완료!', 'success');
            }
        }));

        /* Selective regen (built-in sections) */
        [
            { b: 'auwb-regen-world',         k: 'world' },
            { b: 'auwb-regen-char',           k: 'charSetting' },
            { b: 'auwb-regen-user',           k: 'userSetting' },
            { b: 'auwb-regen-char-clothing',  k: 'charClothing' },
            { b: 'auwb-regen-user-clothing',  k: 'userClothing' },
        ].forEach(function (x) {
            bindClick(x.b, withLoading(x.b, async function () {
                A.showStatus('섹션 재생성 중…', 'info');
                A.saveToHistory('regen', A.getFullSnapshot());
                var res = await A.regenerateSection(x.k);
                if (res && res.value) {
                    A.commitSectionChange(x.k, res.value);
                    A.showStatus('재생성 완료!', 'success');
                }
            }));
        });

        /* World tab save */
        bindClick('auwb-save-world', function () {
            A.setSectionContent('world', A.getElVal('auwb-world-setting-content'));
            A.updateExtensionPrompt();
            A.updateTokenDisplay();
            A.showStatus('세계관 저장됨!', 'success');
        });

        /* Characters tab save */
        bindClick('auwb-save-characters', function () {
            A.setSectionContent('charSetting', A.getElVal('auwb-char-setting-content'));
            A.setSectionContent('userSetting', A.getElVal('auwb-user-setting-content'));
            A.updateExtensionPrompt();
            A.updateTokenDisplay();
            A.showStatus('캐릭터 설정 저장됨!', 'success');
        });

        bindClick('auwb-save-styles', function () {
            A.setSectionContent('charClothing', A.getElVal('auwb-char-style-content'));
            A.setSectionContent('userClothing', A.getElVal('auwb-user-style-content'));
            A.updateExtensionPrompt();
            A.updateTokenDisplay();
            A.showStatus('복장 스타일 저장됨!', 'success');
        });

        /* Settings toggles */
        bindChange('auwb-enabled',           function (v) { A.saveSetting('enabled', v); });
        bindChange('auwb-auto-update',       function (v) { A.saveSetting('autoUpdateEnabled', v); });
        bindChange('auwb-smart-auto-update', function (v) { A.saveSetting('smartAutoUpdate', v); });
        bindChange('auwb-genre-enabled',     function (v) { A.saveSetting('genrePromptEnabled', v); });
        bindChange('auwb-debug-mode',        function (v) { A.saveSetting('debugMode', v); });

        bindInputChange('auwb-update-interval',    function (v) { A.saveSetting('autoUpdateInterval', parseInt(v) || 5); });
        bindInputChange('auwb-output-language',     function (v) { A.saveSetting('outputLanguage', v); });
        bindInputChange('auwb-api-source',          function (v) { A.saveSetting('apiSource', v); updateApiSettingsVisibility(); });
        bindInputChange('auwb-connection-profile',  function (v) { A.saveSetting('connectionProfile', v); });
        bindInputChange('auwb-api-url',             function (v) { A.saveSetting('customApiUrl', v); });
        bindInputChange('auwb-api-key',             function (v) { A.saveSetting('customApiKey', v); });
        bindInputChange('auwb-api-model',           function (v) { A.saveSetting('customApiModel', v); });
        bindInputChange('auwb-api-max-tokens',      function (v) { A.saveSetting('customApiMaxTokens', parseInt(v) || 4000); });
        bindInputChange('auwb-api-timeout',         function (v) { A.saveSetting('customApiTimeout', parseInt(v) || 120); });

        /* Add custom section (feature D) */
        bindClick('auwb-add-custom-section', async function () {
            var n = await A.showPrompt('새 섹션 이름을 입력하세요:');
            if (!n || !n.trim()) return;
            A.addCustomSection(n);
            A.renderSectionManager();
            A.renderCustomSectionContent();
            A.showStatus('커스텀 섹션 추가: ' + n, 'success');
        });

        /* Cleanup (feature H) */
        bindClick('auwb-cleanup-chatdata', async function () {
            var st = A.getChatDataStats();
            if (st.totalEntries <= 1) { A.showStatus('정리할 데이터가 없습니다.', 'info'); return; }
            if (!await A.showConfirm('현재 채팅을 제외한 ' + (st.totalEntries - 1) + '개의 채팅 데이터를 삭제하시겠습니까?')) return;
            var rm = A.cleanupChatData(true);
            A.updateDataStats();
            A.showStatus(rm + '개 채팅 데이터 정리됨!', 'success');
        });

        /* API test */
        bindClick('auwb-test-api-btn', withLoading('auwb-test-api-btn', async function () {
            A.showStatus('API 테스트 중…', 'info');
            await A.testApiConnection();
            A.showStatus('API 연결 성공!', 'success');
            A.checkApiStatus();
        }));

        /* Actions */
        bindClick('auwb-preview-injection', function () {
            var c = document.getElementById('auwb-preview-content');
            if (c) c.textContent = A.getInjectionPreview();
            var m = document.getElementById('auwb-preview-modal');
            if (m) m.style.display = 'flex';
        });

        bindClick('auwb-export', A.exportSettings);

        var impF = document.getElementById('auwb-import-file');
        bindClick('auwb-import', function () { if (impF) impF.click(); });
        if (impF) impF.addEventListener('change', function (e) {
            if (e.target.files && e.target.files[0]) {
                A.importSettings(e.target.files[0]);
                e.target.value = '';
            }
        });

        bindClick('auwb-clear-all', function () { A.clearAllSettings(); });
        bindClick('auwb-export-lorebook', A.exportToLorebook);
        bindClick('auwb-export-lorebook-direct', A.exportToLorebookDirect);

        bindClick('auwb-save-genre', function () {
            A.saveChatData('genrePrompt', A.getElVal('auwb-genre-prompt'));
            A.updateExtensionPrompt();
            A.updateTokenDisplay();
            A.showStatus('장르 프롬프트 저장됨!', 'success');
        });

        /* Presets */
        bindClick('auwb-save-preset-btn', function () {
            var n = A.getElVal('auwb-preset-name').trim();
            if (!n) { A.showStatus('이름 필요', 'error'); return; }
            try {
                A.savePreset(n);
                A.setVal('auwb-preset-name', '');
                A.showStatus('프리셋 저장: ' + n, 'success');
                A.renderPresetList();
            } catch (e) { A.showStatus(e.message, 'error'); }
        });

        bindClick('auwb-export-presets', function () {
            A.exportPresets();
            A.showStatus('프리셋 내보내기 완료!', 'success');
        });

        var ipF = document.getElementById('auwb-import-presets-file');
        bindClick('auwb-import-presets', function () { if (ipF) ipF.click(); });
        if (ipF) ipF.addEventListener('change', function (e) {
            if (e.target.files && e.target.files[0]) {
                var r = new FileReader();
                r.onload = function (ev) {
                    try {
                        var c = A.importPresets(ev.target.result);
                        A.showStatus(c + '개 프리셋 가져옴!', 'success');
                        A.renderPresetList();
                    } catch (err) {
                        A.showStatus(err.message, 'error');
                    }
                };
                r.readAsText(e.target.files[0]);
                e.target.value = '';
            }
        });

        /* Custom prompts */
        bindClick('auwb-save-custom-prompts', A.saveCustomPrompts);
        bindClick('auwb-reset-initial-prompt',    function () { A.resetPromptTemplate('initial'); });
        bindClick('auwb-reset-update-prompt',     function () { A.resetPromptTemplate('update'); });
        bindClick('auwb-reset-genre-prompt-tmpl', function () { A.resetPromptTemplate('genre'); });
        bindClick('auwb-reset-section-prompt',    function () { A.resetPromptTemplate('section'); });
        bindClick('auwb-reset-analysis-prompt',   function () { A.resetPromptTemplate('smartAnalysis'); });

        /* Load models */
        bindClick('auwb-load-models', async function () {
            try {
                var s   = A.getSettings();
                var url = (s.customApiUrl || '').replace(/\/chat\/completions\/?$/, '/models');
                var hd  = {};
                if (s.customApiKey) hd.Authorization = 'Bearer ' + s.customApiKey;

                var resp = await fetch(url, { headers: hd });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);

                var d      = await resp.json();
                var models = (d.data || d.models || []).map(function (m) { return m.id || m.name || m; });

                var dl = document.getElementById('auwb-models-list') || document.createElement('datalist');
                dl.id        = 'auwb-models-list';
                dl.innerHTML = models.map(function (m) { return '<option value="' + m + '">'; }).join('');
                if (!document.getElementById('auwb-models-list')) document.body.appendChild(dl);

                var mi = document.getElementById('auwb-api-model');
                if (mi) mi.setAttribute('list', 'auwb-models-list');

                A.showStatus(models.length + '개 모델 로드됨', 'success');
            } catch (e) {
                A.showStatus('모델 로드 실패: ' + e.message, 'error');
            }
        });

        /* J: Full prompt preview */
        bindClick('auwb-preview-full-prompt', function () {
            var concept = A.getElVal('auwb-au-concept').trim() || '(컨셉 미입력)';
            var ci = A.getCharacterInfo();
            var cd = A.getChatData();
            var ref = cd.reference || '';
            var rel = cd.relationship || '';
            var tpl = A.fillTemplate(A.getPromptTemplate('initial'), {
                GUIDELINES: A.buildGuidelines(),
                CONCEPT: concept,
                REFERENCE_BLOCK: ref ? '\n## Reference / Inspiration\n' + ref : '',
                RELATIONSHIP_BLOCK: rel ? '\n## Character Relationship\n' + rel : '',
                CHAR_NAME: ci.charName,
                CHAR_DESC: ci.charDescription || 'Not provided',
                CHAR_PERS: ci.charPersonality || 'Not provided',
                CHAR_SCENE: ci.charScenario || 'Not provided',
                USER_NAME: ci.userName,
                USER_PERSONA: ci.personaDescription || 'Not provided',
                OUTPUT_FORMAT: A.buildOutputFormat(),
                LANG_INSTRUCTION: A.getLangInstruction(),
                EXISTING_SETTINGS: A.buildExistingSettings(),
            });
            var c = document.getElementById('auwb-preview-content');
            if (c) c.textContent = '=== 초기 생성 프롬프트 미리보기 ===\n\n' + tpl + '\n\n=== 예상 토큰: ~' + A.estimateTokens(tpl) + ' ===';
            var m = document.getElementById('auwb-preview-modal');
            if (m) m.style.display = 'flex';
        });

        /* H: Add custom refine direction */
        bindClick('auwb-add-custom-refine', async function () {
            var label = await A.showPrompt('리파인 방향 이름:');
            if (!label || !label.trim()) return;
            var prmpt = await A.showPrompt('리파인 프롬프트 (지시 내용):');
            if (!prmpt || !prmpt.trim()) return;
            var s = A.getSettings();
            var dirs = s.customRefineDirections || [];
            dirs.push({ id: 'cref_' + Date.now(), label: label.trim(), prompt: prmpt.trim() });
            A.saveSetting('customRefineDirections', dirs);
            A.renderCustomRefineList();
            rebuildRefineMenus();
            A.showStatus('커스텀 리파인 방향 추가됨!', 'success');
        });

        /* F: A/B test generation */
        bindClick('auwb-ab-test-btn', withLoading('auwb-ab-test-btn', async function () {
            var concept = A.getElVal('auwb-au-concept').trim();
            if (!concept) { A.showStatus('AU 컨셉을 입력하세요.', 'error'); return; }
            var ref = A.getElVal('auwb-reference').trim();
            var rel = A.getElVal('auwb-relationship').trim();
            if (ref) A.saveChatData('reference', ref);
            if (rel) A.saveChatData('relationship', rel);

            var filterIds = [];
            document.querySelectorAll('#auwb-gen-section-select input[type="checkbox"]:checked').forEach(function (cb) {
                filterIds.push(cb.value);
            });
            if (!filterIds.length) filterIds = null;

            A.showStatus('A/B 비교 생성 중… (2개 동시 생성)', 'info');
            A.saveToHistory('initial', A.getFullSnapshot());

            var results = await Promise.all([
                A.generateAUWorld(concept, filterIds),
                A.generateAUWorld(concept, filterIds),
            ]);
            if (!results[0] && !results[1]) { A.showStatus('API 응답이 비어있습니다.', 'error'); return; }

            var parsedA = A.parseGeneratedContent(results[0] || '');
            var parsedB = A.parseGeneratedContent(results[1] || '');
            var sections = A.getEnabledSections();

            var html = '';
            sections.forEach(function (sec) {
                var cA = parsedA[sec.id] || '';
                var cB = parsedB[sec.id] || '';
                if (!cA && !cB) return;
                html += '<div class="auwb-ab-section" data-sec-id="' + sec.id + '">'
                    + '<div class="auwb-ab-header">' + A.escapeHtml(sec.label)
                    + ' <button class="auwb-ab-diff-toggle auwb-btn auwb-btn-sm" style="margin-left:8px;font-size:11px;"><i class="fa-solid fa-code-compare"></i> 차이점</button>'
                    + '</div>'
                    + '<div class="auwb-ab-choices">'
                    + '<div class="auwb-ab-choice selected" data-choice="a"><div class="auwb-ab-label">A</div>'
                    + '<div class="auwb-ab-text">' + A.escapeHtml(cA || '(없음)') + '</div></div>'
                    + '<div class="auwb-ab-choice" data-choice="b"><div class="auwb-ab-label">B</div>'
                    + '<div class="auwb-ab-text">' + A.escapeHtml(cB || '(없음)') + '</div></div>'
                    + '</div></div>';
            });

            var cont = document.getElementById('auwb-ab-content');
            if (cont) cont.innerHTML = html;
            var modal = document.getElementById('auwb-ab-modal');
            if (modal) modal.style.display = 'flex';
            A.showStatus('A/B 비교 준비됨! 각 섹션에서 선택하세요.', 'success');
        }));

        /* A/B modal controls */
        bindClick('auwb-ab-close', function () {
            var m = document.getElementById('auwb-ab-modal');
            if (m) m.style.display = 'none';
        });
        var abOv = document.querySelector('#auwb-ab-modal .auwb-modal-overlay');
        if (abOv) abOv.addEventListener('click', function () {
            document.getElementById('auwb-ab-modal').style.display = 'none';
        });

        /* A/B choice click */
        var abCont = document.getElementById('auwb-ab-content');
        if (abCont) {
            abCont.addEventListener('click', function (e) {
                var choice = e.target.closest('.auwb-ab-choice');
                if (!choice) return;
                var section = choice.closest('.auwb-ab-section');
                section.querySelectorAll('.auwb-ab-choice').forEach(function (c) { c.classList.remove('selected'); });
                choice.classList.add('selected');
            });
        }

        /* A/B apply */
        bindClick('auwb-ab-apply', function () {
            document.querySelectorAll('#auwb-ab-content .auwb-ab-section').forEach(function (sec) {
                var sid = sec.getAttribute('data-sec-id');
                var selected = sec.querySelector('.auwb-ab-choice.selected');
                if (!selected) return;
                var text = selected.querySelector('.auwb-ab-text').textContent;
                if (text === '(없음)') return;
                A.setSectionContent(sid, text);
                A.setSectionTextareaValue(sid, text);
            });
            A.updateExtensionPrompt();
            A.updateTokenDisplay();
            A.renderHistoryList();
            A.renderCustomSectionContent();
            document.getElementById('auwb-ab-modal').style.display = 'none';
            A.showStatus('A/B 선택 적용 완료!', 'success');
        });

        /* F5: Prompt reset buttons for brainstorm/refine/whatif */
        bindClick('auwb-reset-brainstorm-prompt', function () { A.resetPromptTemplate('brainstorm'); });
        bindClick('auwb-reset-refine-prompt',     function () { A.resetPromptTemplate('refine'); });
        bindClick('auwb-reset-whatif-prompt',      function () { A.resetPromptTemplate('whatif'); });

        /* F7: Batch regenerate selected sections */
        bindClick('auwb-batch-regen-btn', withLoading('auwb-batch-regen-btn', async function () {
            var filterIds = [];
            document.querySelectorAll('#auwb-gen-section-select input[type="checkbox"]:checked').forEach(function (cb) {
                filterIds.push(cb.value);
            });
            if (!filterIds.length) { A.showStatus('재생성할 섹션을 선택하세요.', 'error'); return; }
            A.showStatus('선택 섹션 일괄 재생성 중…', 'info');
            A.saveToHistory('batch-regen', A.getFullSnapshot());
            var result = await A.batchRegenerateSections(filterIds);
            if (!result) { A.showStatus('API 응답이 비어있습니다.', 'error'); return; }
            var parsed = (typeof result === 'string') ? A.parseGeneratedContent(result) : result;
            Object.keys(parsed).forEach(function (k) {
                if (filterIds.indexOf(k) === -1) return;
                A.setSectionContent(k, parsed[k] || '');
                A.setSectionTextareaValue(k, parsed[k] || '');
            });
            A.updateExtensionPrompt();
            A.updateTokenDisplay();
            A.renderHistoryList();
            A.renderCustomSectionContent();
            A.renderGenSectionSelect();
            A.showStatus('일괄 재생성 완료!', 'success');
        }));

        /* F10: What-If branch export / import */
        bindClick('auwb-export-whatif', function () {
            A.exportWhatIfBranches();
            A.showStatus('What-If 브랜치 내보내기 완료!', 'success');
        });
        var wifImpF = document.getElementById('auwb-import-whatif-file');
        bindClick('auwb-import-whatif', function () { if (wifImpF) wifImpF.click(); });
        if (wifImpF) wifImpF.addEventListener('change', function (e) {
            if (e.target.files && e.target.files[0]) {
                var r = new FileReader();
                r.onload = function (ev) {
                    try {
                        var c = A.importWhatIfBranches(ev.target.result);
                        A.showStatus(c + '개 브랜치 가져옴!', 'success');
                        A.renderWhatIfBranches();
                    } catch (err) { A.showStatus(err.message, 'error'); }
                };
                r.readAsText(e.target.files[0]);
                e.target.value = '';
            }
        });

        /* F11: Search filters for presets & history */
        (function () {
            var pSearch = document.getElementById('auwb-preset-search');
            if (pSearch) pSearch.addEventListener('input', function () { A.renderPresetList(pSearch.value); });
            var hSearch = document.getElementById('auwb-history-search');
            if (hSearch) hSearch.addEventListener('input', function () { A.renderHistoryList(hSearch.value); });
        })();

        /* F3: Auto-save (debounced) for section textareas */
        (function () {
            var _autoTid = 0;
            function autoSave(secId, value) {
                clearTimeout(_autoTid);
                _autoTid = setTimeout(function () {
                    A.setSectionContent(secId, value);
                    A.updateExtensionPrompt();
                    A.updateTokenDisplay();
                }, 2000);
            }
            /* Built-in section textareas */
            var builtinMap = {
                'auwb-world-setting-content': 'world',
                'auwb-char-setting-content':  'charSetting',
                'auwb-user-setting-content':  'userSetting',
                'auwb-char-style-content':    'charClothing',
                'auwb-user-style-content':    'userClothing',
            };
            Object.keys(builtinMap).forEach(function (elId) {
                var el = document.getElementById(elId);
                if (el) el.addEventListener('input', function () { autoSave(builtinMap[elId], el.value); });
            });
            /* Genre prompt */
            var genreEl = document.getElementById('auwb-genre-prompt');
            if (genreEl) genreEl.addEventListener('input', function () {
                clearTimeout(_autoTid);
                _autoTid = setTimeout(function () {
                    A.saveChatData('genrePrompt', genreEl.value);
                    A.updateExtensionPrompt();
                    A.updateTokenDisplay();
                }, 2000);
            });
            /* AU Concept */
            var conceptEl = document.getElementById('auwb-au-concept');
            if (conceptEl) conceptEl.addEventListener('input', function () {
                clearTimeout(_autoTid);
                _autoTid = setTimeout(function () {
                    A.saveChatData('auConcept', conceptEl.value);
                }, 2000);
            });
            /* Custom section textareas (delegated) */
            var csec = document.getElementById('auwb-custom-sections-content');
            if (csec) csec.addEventListener('input', function (e) {
                var ta = e.target.closest('[data-custom-section-id]');
                if (!ta) return;
                autoSave(ta.getAttribute('data-custom-section-id'), ta.value);
            });
        })();

        /* F6: A/B diff toggle — add diff button after A/B content rendered */
        (function () {
            var abCont2 = document.getElementById('auwb-ab-content');
            if (!abCont2) return;
            abCont2.addEventListener('click', function (e) {
                var diffBtn = e.target.closest('.auwb-ab-diff-toggle');
                if (!diffBtn) return;
                var sec = diffBtn.closest('.auwb-ab-section');
                if (!sec) return;
                var panel = sec.querySelector('.auwb-ab-diff-panel');
                if (panel) {
                    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    return;
                }
                /* Build diff */
                var choices = sec.querySelectorAll('.auwb-ab-text');
                if (choices.length < 2) return;
                var textA = choices[0].textContent;
                var textB = choices[1].textContent;
                var diff = A.diffLines(textA, textB);
                var html = '<div class="auwb-ab-diff-panel">';
                diff.forEach(function (d) {
                    var cls = d.type === 'add' ? 'auwb-diff-add' : d.type === 'remove' ? 'auwb-diff-remove' : '';
                    var prefix = d.type === 'add' ? '+ ' : d.type === 'remove' ? '- ' : '  ';
                    html += '<div class="' + cls + '">' + prefix + A.escapeHtml(d.value) + '</div>';
                });
                html += '</div>';
                sec.insertAdjacentHTML('beforeend', html);
            });
        })();

        /* Initial render + event delegation */
        _initDelegation();
        initCollapsibles();
        initRefineDropdowns();
        /* Skip redundant renders — popup starts hidden;
           openPopup() → loadSettingsToUI() will render everything. */
        A.log('UI events bound');
    };

    /* ══════════════════════════════════════════════
       Event Registration & Init Helpers
       ══════════════════════════════════════════════ */
    A.registerPromptInjection = function () {
        try {
            var ctx = SillyTavern.getContext();
            if (!ctx || !ctx.eventSource || !ctx.event_types) return false;

            ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, function () {
                A.log('Chat changed');
                A.autoUpdateMessageCount = 0;
                A.invalidateSettingsCache();
                A.invalidateCharInfoCache();
                A.invalidateSectionCache();
                A.loadChatDataToUI();
            });

            ctx.eventSource.on(ctx.event_types.GENERATION_STARTED, function () {
                A.updateExtensionPrompt();
            });

            ctx.eventSource.on(ctx.event_types.CHARACTER_MESSAGE_RENDERED, function () {
                A.updateExtensionPrompt();
                var s = A.getSettings();
                if (!s.autoUpdateEnabled) return;

                A.autoUpdateMessageCount++;
                if (A.autoUpdateMessageCount >= (s.autoUpdateInterval || 5)) {
                    A.autoUpdateMessageCount = 0;
                    A.triggerAutoUpdate(s.autoUpdateInterval || 5);
                }
            });

            A.log('Event listeners registered');
            return true;
        } catch (e) {
            A.logError('registerPromptInjection', e);
            return false;
        }
    };

    A.loadPopupHTML = async function () {
        var base  = A._basePath;
        var paths = [
            base + '/popup.html',
            'scripts/extensions/third-party/AU-World-Builder/popup.html',
            'data/default-user/extensions/AU-World-Builder/popup.html',
        ];
        for (var i = 0; i < paths.length; i++) {
            try {
                var html = await $.get(paths[i]);
                $('body').append(html);
                A.log('Popup loaded: ' + paths[i]);
                return true;
            } catch (_) {}
        }
        A.logError('Failed to load popup.html');
        return false;
    };

    A.loadCSS = function () {
        var base  = A._basePath;
        var paths = [
            base + '/style.css',
            'scripts/extensions/third-party/AU-World-Builder/style.css',
            'data/default-user/extensions/AU-World-Builder/style.css',
        ];
        function tryLoad(idx) {
            if (idx >= paths.length) return;
            var link = document.createElement('link');
            link.rel  = 'stylesheet';
            link.href = paths[idx];
            link.onerror = function () {
                document.head.removeChild(link);
                tryLoad(idx + 1);
            };
            document.head.appendChild(link);
        }
        tryLoad(0);
    };

    A.addExtMenuButton = function () {
        var retries = 0;
        function tryAdd() {
            if (document.getElementById('au-world-builder-menu-item')) return;
            var menu = document.getElementById('extensionsMenu');
            if (!menu) { if (retries++ < 20) setTimeout(tryAdd, 500); return; }

            var item       = document.createElement('div');
            item.id        = 'au-world-builder-menu-item';
            item.className = 'list-group-item flex-container flexGap5 interactable';
            item.tabIndex  = 0;
            item.role      = 'listitem';
            item.innerHTML = '<div class="fa-solid fa-globe extensionsMenuExtensionButton"></div> AU World Builder';

            item.addEventListener('click', function () {
                A.openPopup();
                jQuery('#extensionsMenu').hide();
            });
            menu.appendChild(item);
        }
        tryAdd();
    };

})(window.AUWB);
