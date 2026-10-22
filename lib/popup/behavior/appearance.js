// SPDX-License-Identifier: GPL-3.0-or-later
export function popupWidth(requested, monitorWidth) {
    return Math.min(requested, Math.floor(monitorWidth * 0.85));
}

export function applyCorners(content, settings) {
    if (content._spotlightCornerClass)
        content.remove_style_class_name(content._spotlightCornerClass);
    content._spotlightCornerClass = `spotlight-radius-${settings.get_int('corner-radius')}`;
    content.add_style_class_name(content._spotlightCornerClass);
}
