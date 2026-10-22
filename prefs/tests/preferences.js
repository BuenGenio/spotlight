// SPDX-License-Identifier: GPL-3.0-or-later
// Run with GSETTINGS_BACKEND=memory gjs -m prefs/tests/preferences.js.
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {buildAppearancePage} from '../appearancePage.js';

Adw.init();
const source = Gio.SettingsSchemaSource.new_from_directory(`${GLib.get_current_dir()}/schemas`, Gio.SettingsSchemaSource.get_default(), false);
const schema = source.lookup('org.gnome.shell.extensions.spotlight', false);
const settings = new Gio.Settings({settings_schema: schema});
const group = buildAppearancePage(settings);
const rows = [];
function visit(widget) {
    if (widget instanceof Adw.SpinRow)
        rows.push(widget);
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
        visit(child);
}
visit(group);
const width = rows.find(row => row.title === 'Dialog width');
const radius = rows.find(row => row.title === 'Corner radius');
if (!width || !radius || width.value !== 900 || radius.value !== 24)
    throw new Error('Appearance defaults did not bind.');
width.value = 1200;
radius.value = 0;
if (settings.get_int('popup-width') !== 1200 || settings.get_int('corner-radius') !== 0)
    throw new Error('Preference edits did not reach settings.');
settings.set_int('popup-width', 1000);
settings.set_int('corner-radius', 48);
if (width.value !== 1000 || radius.value !== 48)
    throw new Error('Settings changes did not reach preferences.');
if (schema.get_key('popup-width').range_check(new GLib.Variant('i', 300)))
    throw new Error('Width schema accepted an out-of-range value.');
print('GTK preferences: defaults, two-way bindings, and schema range passed');
group.run_dispose();
