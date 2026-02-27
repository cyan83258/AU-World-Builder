/**
 * AU World Builder v2.3 — Entry Point
 *
 * Loads all modules from lib/ in dependency order, then initializes.
 * Module architecture:
 *   lib/core.js      — Constants, prompts, utilities, settings
 *   lib/sections.js  — Section management, character info
 *   lib/engine.js    — API, parsing, generation, updates, injection
 *   lib/ui.js        — UI rendering, events, presets, lorebook
 */
(function () {
    'use strict';

    /* Determine the extension's base path from the current script URL */
    function getBasePath() {
        try {
            var s = document.currentScript;
            if (s && s.src) {
                return s.src.split('?')[0].split('#')[0].replace(/\/[^/]*$/, '');
            }
        } catch (_) {}
        return 'data/default-user/extensions/AU-World-Builder';
    }

    var basePath = getBasePath();

    /* Shared namespace for all modules */
    window.AUWB = { _basePath: basePath };

    /**
     * Load a JS module by fetching its source with $.get (same mechanism
     * used for popup.html) and evaluating it in global scope.
     * Tries multiple URL paths as fallback.
     */
    async function loadScript(name) {
        var file  = 'lib/' + name + '.js';
        var paths = [
            basePath + '/' + file,
            'scripts/extensions/third-party/AU-World-Builder/' + file,
            'data/default-user/extensions/AU-World-Builder/' + file,
        ];

        for (var i = 0; i < paths.length; i++) {
            try {
                var code = await $.get(paths[i]);
                (0, eval)(code);                       // indirect eval → global scope
                console.log('[AU-World-Builder] Loaded: ' + paths[i]);
                return;
            } catch (_) {
                console.log('[AU-World-Builder] Path failed: ' + paths[i]);
            }
        }
        throw new Error('Cannot load module: ' + name);
    }

    /**
     * Load all modules sequentially (order matters), then initialize.
     */
    async function boot() {
        console.log('[AU-World-Builder] === v2.1 Initializing ===');
        try {
            /* Load modules in dependency order */
            await loadScript('core');
            await loadScript('sections');
            await loadScript('engine');
            await loadScript('ui');

            var A = window.AUWB;

            /* Initialize settings & load UI */
            A.getSettings();
            A.loadCSS();
            await A.loadPopupHTML();
            A.addExtMenuButton();
            A.bindUIEvents();

            /* Register SillyTavern event listeners */
            var ok = A.registerPromptInjection();
            if (ok) {
                A.updateExtensionPrompt();
            } else {
                setTimeout(function () {
                    if (A.registerPromptInjection()) A.updateExtensionPrompt();
                }, 2000);
            }

            console.log('[AU-World-Builder] === Initialization Complete ===');
        } catch (e) {
            console.error('[AU-World-Builder] Init failed', e);
        }
    }

    jQuery(function () { boot(); });

    /* Public API (delegates to namespace after modules load) */
    window.AUWorldBuilder = {
        openPopup:             function () { window.AUWB.openPopup(); },
        getSettings:           function () { return window.AUWB.getSettings(); },
        updateExtensionPrompt: function () { window.AUWB.updateExtensionPrompt(); },
    };
})();
