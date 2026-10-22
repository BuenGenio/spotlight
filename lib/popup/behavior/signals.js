// Spotlight: global signal connections
// SPDX-License-Identifier: GPL-3.0-or-later
import Shell from 'gi://Shell';
import {applyTheme} from './theme.js';
import {applyCorners} from './appearance.js';

// Connects global signals that live for the entire popup lifetime, across
// open and close cycles. Uses plain connect with explicit IDs so defense
// uninstall cannot accidentally wipe these.
export function connectGlobalSignals(popup, settings, ifaceSettings) {
    popup._windowCreatedId = global.display.connect(
        'window-created', () => { if (popup._visible) popup.close(); },
    );
    popup._appStateChangedId = Shell.AppSystem.get_default().connect(
        'app-state-changed', () => { if (popup._visible) popup.close(); },
    );
    settings.connectObject(
        'changed::popup-width', () => { if (popup._visible) popup._positioner.updateSize(); },
        'changed::corner-radius', () => applyCorners(popup._content, settings),
        'changed::theme-preference', () => applyTheme(popup._content, settings, ifaceSettings),
        popup,
    );
    ifaceSettings.connectObject(
        'changed::color-scheme', () => {
            if (popup._visible &&
                settings.get_string('theme-preference') === 'default')
                applyTheme(popup._content, settings, ifaceSettings);
        },
        popup,
    );
}

// Disconnects the global signals. Plain-connect IDs are cleaned explicitly,
// ifaceSettings uses connectObject and is cleaned via disconnectObject.
export function disconnectGlobalSignals(popup) {
    if (popup._windowCreatedId) {
        global.display.disconnect(popup._windowCreatedId);
        popup._windowCreatedId = 0;
    }
    if (popup._appStateChangedId) {
        Shell.AppSystem.get_default().disconnect(popup._appStateChangedId);
        popup._appStateChangedId = 0;
    }
    popup._ifaceSettings.disconnectObject(popup);
    popup._settings.disconnectObject(popup);
}
