// SPDX-License-Identifier: GPL-3.0-or-later
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {ensureActorVisibleInScrollView} from 'resource:///org/gnome/shell/misc/animationUtils.js';
import {parseQuery, describeQuery, SEARCH_EXAMPLES} from './query.js';
import {searchIndex} from './indexedSearch.js';

export class ScopedSearch {
    constructor(popup, entry, resultsView) {
        this._popup = popup;
        this._entry = entry;
        this._resultsView = resultsView;
        this._enabled = false;
        this._generation = 0;
        this._timeoutId = 0;
        this._cancellable = null;
        this._buttons = [];
        this._selected = 0;
        this.active = false;
        this.actor = new St.BoxLayout({vertical: true, style_class: 'spotlight-search-tools'});
        const header = new St.BoxLayout({style_class: 'spotlight-search-header'});
        this._description = new St.Label({x_expand: true, y_align: Clutter.ActorAlign.CENTER, style_class: 'spotlight-search-description'});
        this._description.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        const helpButton = new St.Button({label: 'Search tips', can_focus: true, style_class: 'spotlight-help-button'});
        helpButton.connect('clicked', () => this._toggleHelp());
        header.add_child(this._description);
        header.add_child(helpButton);
        this.actor.add_child(header);
        this._help = new St.BoxLayout({vertical: true, visible: false, style_class: 'spotlight-search-help'});
        for (const [example, description] of SEARCH_EXAMPLES) {
            const button = new St.Button({can_focus: true, x_align: Clutter.ActorAlign.FILL, style_class: 'spotlight-help-example'});
            const label = new St.Label({text: `${example} — ${description}`});
            label.clutter_text.line_wrap = true;
            button.set_child(label);
            button.connect('clicked', () => {
                this._help.hide();
                this._scroll.visible = this._buttons.length > 0;
                entry.set_text(example);
                entry.grab_key_focus();
            });
            this._help.add_child(button);
        }
        const note = new St.Label({text: 'Filters search the local index only. Unindexed files and unextracted contents will not appear.', style_class: 'spotlight-index-note'});
        note.clutter_text.line_wrap = true;
        this._help.add_child(note);
        this.actor.add_child(this._help);
        this._status = new St.Label({visible: false, style_class: 'spotlight-search-description'});
        this._status.clutter_text.line_wrap = true;
        this.actor.add_child(this._status);
        this._rows = new St.BoxLayout({vertical: true});
        this._scroll = new St.ScrollView({visible: false, style_class: 'spotlight-index-results', overlay_scrollbars: true});
        this._scroll.set_child(this._rows);
        this.actor.add_child(this._scroll);
        popup._content.add_child(this.actor);

        // Keep scoped searches out of unrelated providers, and restore their routing on disable.
        this._originalSetTerms = resultsView.setTerms;
        resultsView.setTerms = terms => {
            if (!this._enabled)
                return this._originalSetTerms.call(resultsView, terms);
            this._update();
            return this._originalSetTerms.call(resultsView, this.active ? [] : terms);
        };
        entry.connectObject('captured-event', (_actor, event) => this._onKey(event), this.actor);
    }

    open() {
        this._enabled = true;
        this.actor.show();
        this._update();
    }

    close() {
        this._enabled = false;
        this._cancel();
        this.active = false;
        this._resultsView.show();
        this._help.hide();
        this.actor.hide();
    }

    _toggleHelp() {
        this._help.visible = !this._help.visible;
        this._scroll.visible = !this._help.visible && this._buttons.length > 0;
    }

    _cancel() {
        this._generation++;
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
    }

    _update() {
        this._cancel();
        const query = parseQuery(this._entry.get_text());
        this.active = query.scoped;
        this._resultsView.visible = !this.active;
        this._description.set_text(describeQuery(query));
        this._buttons = [];
        this._rows.destroy_all_children();
        this._scroll.hide();
        this._status.visible = this.active;
        if (!this.active)
            return;

        if (query.error) {
            this._status.set_text('Edit the query, or choose an example from Search tips.');
            return;
        }
        if (query.mode === 'content' && !query.text) {
            this._status.set_text('Enter text after content: to search indexed file contents.');
            return;
        }
        this._status.set_text('Searching the local index…');
        const generation = this._generation;
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 180, () => {
            this._timeoutId = 0;
            this._run(query, generation);
            return GLib.SOURCE_REMOVE;
        });
    }

    async _run(query, generation) {
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        try {
            const uris = await searchIndex(query, cancellable);
            if (generation !== this._generation)
                return;
            this._status.set_text(uris.length ? `Showing ${uris.length === 12 ? 'up to ' : ''}${uris.length} indexed results · ↑/↓ to select, Enter to open` : 'No indexed matches. Check the query and your GNOME Search indexing locations.');
            for (const uri of uris) {
                const file = Gio.File.new_for_uri(uri);
                const button = new St.Button({can_focus: true, style_class: 'spotlight-file-result', x_expand: true});
                const row = new St.BoxLayout({style_class: 'spotlight-file-row'});
                row.add_child(new St.Icon({icon_name: query.mode === 'folders' ? 'folder-symbolic' : 'text-x-generic-symbolic', icon_size: 24, y_align: Clutter.ActorAlign.CENTER}));
                const text = new St.BoxLayout({vertical: true, x_expand: true});
                const name = new St.Label({text: file.get_basename(), style_class: 'spotlight-file-name'});
                name.clutter_text.ellipsize = Pango.EllipsizeMode.END;
                const parent = file.get_parent();
                const path = new St.Label({text: parent ? parent.get_path() : uri, style_class: 'spotlight-file-path'});
                path.clutter_text.ellipsize = Pango.EllipsizeMode.MIDDLE;
                text.add_child(name);
                text.add_child(path);
                row.add_child(text);
                button.set_child(row);
                button.connect('clicked', () => this._activate(uri));
                this._rows.add_child(button);
                this._buttons.push({button, uri});
            }
            this._scroll.visible = uris.length > 0 && !this._help.visible;
            this._select(0);
        } catch (error) {
            if (generation === this._generation && !cancellable.is_cancelled())
                this._status.set_text(error.message);
        } finally {
            if (this._cancellable === cancellable)
                this._cancellable = null;
        }
    }

    _select(index) {
        if (!this._buttons.length)
            return;
        this._buttons[this._selected]?.button.remove_style_pseudo_class('selected');
        this._selected = (index + this._buttons.length) % this._buttons.length;
        this._buttons[this._selected].button.add_style_pseudo_class('selected');
    }

    _onKey(event) {
        if (!this._enabled || event.type() !== Clutter.EventType.KEY_PRESS)
            return Clutter.EVENT_PROPAGATE;
        const key = event.get_key_symbol();
        if (key === Clutter.KEY_F1) {
            this._toggleHelp();
            return Clutter.EVENT_STOP;
        }
        if (!this.active)
            return Clutter.EVENT_PROPAGATE;
        if (key === Clutter.KEY_Down || key === Clutter.KEY_Up) {
            this._select(this._selected + (key === Clutter.KEY_Down ? 1 : -1));
            if (this._buttons.length && this._scroll.visible)
                ensureActorVisibleInScrollView(this._scroll, this._buttons[this._selected].button);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
            if (this._buttons.length)
                this._activate(this._buttons[this._selected].uri);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _activate(uri) {
        this._popup.close();
        Gio.AppInfo.launch_default_for_uri_async(uri, global.create_app_launch_context(0, -1), null, (_object, result) => {
            try {
                Gio.AppInfo.launch_default_for_uri_finish(result);
            } catch (error) {
                Main.notifyError('Could not open search result', error.message);
            }
        });
    }

    destroy() {
        this.close();
        this._resultsView.setTerms = this._originalSetTerms;
        this._entry.disconnectObject(this.actor);
        this.actor.destroy();
    }
}
