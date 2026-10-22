// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {buildQuery, parseResults} from './query.js';

export function searchIndex(query, cancellable) {
    const command = GLib.find_program_in_path('tinysparql');
    if (!command)
        return Promise.reject(new Error('Install TinySPARQL (tinysparql) to search the local file index.'));
    const process = Gio.Subprocess.new(
        [command, 'query', '--dbus-service', 'org.freedesktop.LocalSearch3', '--query', buildQuery(query)],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    );
    const cancelId = cancellable.connect(() => process.force_exit());
    let timedOut = false;
    const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 8000, () => {
        timedOut = true;
        process.force_exit();
        return GLib.SOURCE_REMOVE;
    });
    return new Promise((resolve, reject) => {
        process.communicate_utf8_async(null, cancellable, (proc, result) => {
            if (!timedOut)
                GLib.source_remove(timeoutId);
            cancellable.disconnect(cancelId);
            try {
                const [, output, errors] = proc.communicate_utf8_finish(result);
                if (timedOut)
                    throw new Error('The local index took too long. Refine the query and try again.');
                if (!proc.get_successful())
                    throw new Error(errors.trim() || 'The LocalSearch index is unavailable.');
                resolve(parseResults(output));
            } catch (error) {
                reject(error);
            }
        });
    });
}
