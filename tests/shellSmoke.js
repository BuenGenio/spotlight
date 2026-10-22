// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const {default: Spotlight} = await import(`${GLib.getenv('SPOTLIGHT_SOURCE_URI')}/extension.js`);
export default class SmokeTest extends Spotlight {
    enable() {
        const output = Gio.File.new_for_path(GLib.getenv('SPOTLIGHT_TEST_RESULT'));
        const report = {};
        const save = error => output.replace_contents(new TextEncoder().encode(JSON.stringify({...report, error: error ? String(error) + error.stack : null})), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        const check = (test, message) => { if (!test) throw new Error(message); };
        try {
            super.enable();
        } catch (error) { save(error); return; }
        let step = -1;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            try {
                const popup = this._popup;
                if (step === -1) {
                    if (Main.layoutManager._startingUp)
                        return GLib.SOURCE_CONTINUE;
                    popup.open();
                } else if (step === 0) {
                    check(popup._visible, 'Popup did not open');
                    check(popup.width === 900, `Initial width was ${popup.width}`);
                    report.defaultWidth = popup.width;
                    this._settings.set_int('popup-width', 1200);
                    this._settings.set_int('corner-radius', 0);
                    popup._stealer.entry.set_text('files:"unfinished');
                } else if (step === 1) {
                    check(popup.width === 1190, `Monitor width cap was ${popup.width}`);
                    check(popup._content.has_style_class_name('spotlight-radius-0'), 'Radius did not update');
                    check(popup._scopedSearch.active, `Scoped routing inactive: visible=${popup._visible}, enabled=${popup._scopedSearch._enabled}, text=${popup._stealer.entry.get_text()}`);
                    check(popup._stealer.searchResults._terms.length === 0, 'Scoped query reached native providers');
                    check(popup._scopedSearch._description.text.includes('Close the quoted'), 'Query explanation missing');
                    report.widthCap = popup.width;
                    report.radiusAndRouting = true;
                    popup._scopedSearch._toggleHelp();
                    check(popup._scopedSearch._help.visible, 'Help did not expand');
                    check(popup._scopedSearch._help.get_n_children() === 6, 'Examples missing');
                    popup._scopedSearch._toggleHelp();
                    popup._stealer.entry.set_text('files:example');
                } else if (step === 2) {
                    check(popup._stealer.entry.get_text() === 'files:example', 'Scoped text was cleared');
                    check(popup._scopedSearch._buttons.length === 1, 'Indexed result row did not render');
                    check(popup._scopedSearch._scroll.visible, 'Indexed result list is hidden');
                    report.renderedResults = true;
                    popup._stealer.entry.set_text('calculator');
                } else if (step === 3) {
                    check(!popup._scopedSearch.active, 'Normal routing not restored');
                    report.helpAndNormalSearch = true;
                    popup.close();
                } else if (step === 4) {
                    check(!popup._visible, 'Popup did not close');
                    const view = popup._stealer.searchResults;
                    const original = popup._scopedSearch._originalSetTerms;
                    super.disable();
                    check(view.setTerms === original, 'Search method was not restored');
                    super.enable();
                    this._popup.open();
                    report.disableEnable = true;
                } else {
                    check(popup._visible, 'Popup did not reopen');
                    this._popup.close();
                    report.reopen = true;
                    save(null);
                    return GLib.SOURCE_REMOVE;
                }
                step++;
            } catch (error) { save(error); return GLib.SOURCE_REMOVE; }
            return GLib.SOURCE_CONTINUE;
        });
    }
}
