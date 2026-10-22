#!/usr/bin/env bash
# Build and install this checkout rather than downloading an upstream release.
set -euo pipefail

SPOTLIGHT_SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
SPOTLIGHT_PACKAGE=$(mktemp -d /tmp/spotlight-build.XXXXXX)
trap 'rm -rf -- "$SPOTLIGHT_PACKAGE"' EXIT

cd -- "$SPOTLIGHT_SOURCE"
glib-compile-schemas --strict schemas/
gnome-extensions pack --force --out-dir "$SPOTLIGHT_PACKAGE" --extra-source=lib --extra-source=prefs

SPOTLIGHT_INSTALLED="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/spotlight@nin"
if [[ -d "$SPOTLIGHT_INSTALLED" ]]; then
    SPOTLIGHT_BACKUP="${XDG_DATA_HOME:-$HOME/.local/share}/spotlight-backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p -- "$SPOTLIGHT_BACKUP"
    cp -a -- "$SPOTLIGHT_INSTALLED" "$SPOTLIGHT_BACKUP/"
    echo "Previous extension saved to $SPOTLIGHT_BACKUP/spotlight@nin"
fi

gnome-extensions install --force "$SPOTLIGHT_PACKAGE/spotlight@nin.shell-extension.zip"
echo 'Fork installed. Log out and back in on Wayland to load the new code and schema.'
echo 'Then enable spotlight@nin and open its preferences to adjust Appearance.'
