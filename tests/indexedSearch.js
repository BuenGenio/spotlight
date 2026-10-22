// SPDX-License-Identifier: GPL-3.0-or-later
// Run manually with gjs -m tests/indexedSearch.js against an available LocalSearch index.
import System from 'system';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {searchIndex} from '../lib/search/indexedSearch.js';
import {parseQuery} from '../lib/search/query.js';

const loop = new GLib.MainLoop(null, false);
let failed = false;
async function run() {
    for (const input of ['files:spotlight', 'folders:', 'type:pdf', 'type:image', 'content:spotlight']) {
        const uris = await searchIndex(parseQuery(input), new Gio.Cancellable());
        if (uris.some(uri => !uri.startsWith('file://')) || new Set(uris).size !== uris.length || uris.length > 12)
            throw new Error(`Invalid result set for ${input}`);
        if (input === 'type:pdf' && uris.some(uri => !uri.toLowerCase().endsWith('.pdf')))
            throw new Error('Extension filter returned another file type.');
        if (input === 'files:spotlight' && uris.some(uri => !Gio.File.new_for_uri(uri).get_basename().toLowerCase().includes('spotlight')))
            throw new Error('Filename filter returned a non-matching name.');
        if (input === 'folders:' && uris.some(uri => Gio.File.new_for_uri(uri).query_file_type(Gio.FileQueryInfoFlags.NONE, null) !== Gio.FileType.DIRECTORY))
            throw new Error('Folder filter returned a non-directory.');
        if (input === 'files:spotlight' && uris.some(uri => Gio.File.new_for_uri(uri).query_file_type(Gio.FileQueryInfoFlags.NONE, null) === Gio.FileType.DIRECTORY))
            throw new Error('File filter returned a directory.');
        print(`${input}: ${uris.length} results; constraints passed`);
    }
    const cancelled = new Gio.Cancellable();
    const pending = searchIndex(parseQuery('files:cancel-test'), cancelled);
    cancelled.cancel();
    let rejected = false;
    try {
        await pending;
    } catch (_error) {
        rejected = true;
    }
    if (!rejected)
        throw new Error('Cancelled search completed instead of rejecting.');
    print('Cancellation passed');
}
run().catch(error => { printerr(error.stack); failed = true; }).finally(() => loop.quit());
loop.run();
if (failed)
    System.exit(1);
