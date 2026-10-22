#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Run popup lifecycle checks in a separate headless GNOME session."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

REPO = Path(__file__).resolve().parents[1]


def run_session(root):
    for name in ('config', 'data', 'cache', 'runtime', 'system'):
        (root / name).mkdir(mode=0o700)
    env = os.environ.copy()
    env.update(
        XDG_CONFIG_HOME=str(root / 'config'),
        XDG_DATA_HOME=str(root / 'data'),
        XDG_DATA_DIRS=f"{root / 'system'}:/usr/local/share:/usr/share",
        XDG_CACHE_HOME=str(root / 'cache'),
        XDG_RUNTIME_DIR=str(root / 'runtime'),
        GSETTINGS_BACKEND='memory',
        LIBGL_ALWAYS_SOFTWARE='1',
        SPOTLIGHT_SOURCE_URI=REPO.as_uri(),
        SPOTLIGHT_TEST_RESULT=str(root / 'result.json'),
    )
    # A fixed backend result isolates actor rendering from the user's index contents.
    fixture = root / 'Example document.txt'
    fixture.write_text('Example search fixture')
    commands = root / 'bin'
    commands.mkdir()
    command = commands / 'tinysparql'
    output = f'Results:\n  {fixture.as_uri()}\n'
    command.write_text(f'#!{sys.executable}\nprint({output!r})\n')
    command.chmod(0o755)
    env['PATH'] = f"{commands}:{env['PATH']}"
    ext = root / 'system/gnome-shell/extensions/spotlight@nin'
    ext.mkdir(parents=True)
    for name in ('lib', 'schemas', 'prefs'):
        shutil.copytree(REPO / name, ext / name)
    subprocess.run(['glib-compile-schemas', '--strict', str(ext / 'schemas')], check=True)
    shutil.copy(REPO / 'stylesheet.css', ext / 'stylesheet.css')
    shutil.copy(REPO / 'tests/shellSmoke.js', ext / 'extension.js')
    metadata = json.loads((REPO / 'metadata.json').read_text())
    metadata['session-modes'] = ['spotlight-test', 'user']
    (ext / 'metadata.json').write_text(json.dumps(metadata))
    modes = root / 'system/gnome-shell/modes'
    modes.mkdir(parents=True)
    (modes / 'spotlight-test.json').write_text(json.dumps({
        'parentMode': 'user', 'isPrimary': True,
        'enabledExtensions': ['spotlight@nin'],
    }))
    with (root / 'shell.log').open('w') as log:
        proc = subprocess.Popen([
            'gnome-shell', '--headless', '--wayland', '--virtual-monitor',
            '1400x900', '--no-x11', '--mode', 'spotlight-test',
        ], env=env, stdout=log, stderr=log)
        try:
            for _ in range(60):
                if (root / 'result.json').exists():
                    return 0
                if proc.poll() is not None:
                    raise RuntimeError('Headless shell exited before verification.')
                time.sleep(0.5)
            raise RuntimeError('Timed out waiting for the headless smoke test.')
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--session':
        sys.exit(run_session(Path(sys.argv[2])))
    root = Path(tempfile.mkdtemp(prefix='spotlight-smoke-'))
    with (root / 'session.log').open('w') as log:
        run = subprocess.run([
            'dbus-run-session', '--', sys.executable, str(Path(__file__).resolve()),
            '--session', str(root),
        ], stdout=log, stderr=log)
    result = json.loads((root / 'result.json').read_text()) if (root / 'result.json').exists() else {'error': 'No result from shell.'}
    print(json.dumps(result))
    print(f'Isolated-session logs: {root}')
    sys.exit(1 if run.returncode or result.get('error') else 0)
