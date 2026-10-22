// Spotlight: appearance preferences page
// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

// Theme options. Default follows the system style, dark and light force a specific appearance.
const THEMES = [
    { value: 'default', label: 'Default', subtitle: 'Follow GNOME system style' },
    { value: 'dark', label: 'Dark', subtitle: 'Always use dark appearance' },
    { value: 'light', label: 'Light', subtitle: 'Always use light appearance' },
];

export function buildAppearancePage(settings) {
    const group = new Adw.PreferencesGroup({
        title: 'Appearance',
        description: 'Choose the visual style',
    });

    const themeRow = new Adw.ComboRow({
        title: 'Theme',
        subtitle: 'Dark, light, or follow system',
    });

    const list = new Gtk.StringList();
    for (const t of THEMES)
        list.append(t.label);
    themeRow.set_model(list);

    const current = settings.get_string('theme-preference');
    themeRow.set_selected(themeValueToIndex(current));

    themeRow.connect('notify::selected', () => {
        settings.set_string(
            'theme-preference',
            themeIndexToValue(themeRow.get_selected()),
        );
    });

    group.add(themeRow);
    const widthRow = new Adw.SpinRow({
        title: 'Dialog width',
        subtitle: 'Pixels; capped at 85% of the monitor width',
        adjustment: new Gtk.Adjustment({lower: 400, upper: 2400, step_increment: 20, page_increment: 100}),
        digits: 0,
    });
    settings.bind('popup-width', widthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    group.add(widthRow);

    const radiusRow = new Adw.SpinRow({
        title: 'Corner radius',
        subtitle: 'Pixels; 0 gives square corners',
        adjustment: new Gtk.Adjustment({lower: 0, upper: 48, step_increment: 1, page_increment: 8}),
        digits: 0,
    });
    settings.bind('corner-radius', radiusRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    group.add(radiusRow);
    return group;
}

function themeValueToIndex(value) {
    for (let i = 0; i < THEMES.length; i++) {
        if (THEMES[i].value === value)
            return i;
    }
    return 0;
}

function themeIndexToValue(idx) {
    if (idx >= 0 && idx < THEMES.length)
        return THEMES[idx].value;
    return 'default';
}
