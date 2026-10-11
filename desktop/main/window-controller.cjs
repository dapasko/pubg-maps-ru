'use strict';
function createWindowController({ window, native, onFocusError = () => {} }) {
  let mode = 'hidden';
  let previousForeground = null;
  let disposed = false;
  function restore() {
    if (!previousForeground) return;
    const handle = previousForeground;
    previousForeground = null;
    try { if (!native.restoreForegroundWindow(handle)) onFocusError(new Error('Windows did not restore foreground focus')); }
    catch (error) { onFocusError(error); }
  }
  return {
    get mode() { return mode; },
    applyMode(next, { restoreFocus = true } = {}) {
      if (disposed) throw Error('Window controller disposed');
      if (!['hidden', 'view', 'interact'].includes(next)) throw Error('Invalid overlay mode');
      if (mode === next) return;
      const wasInteraction = mode === 'interact';
      try {
        if (next === 'interact') {
          previousForeground = native.getForegroundWindow();
          window.setFocusable(true);
          window.setIgnoreMouseEvents(false);
          mode = next;
          window.show();
          window.focus();
        } else {
          window.setIgnoreMouseEvents(true);
          window.setFocusable(false);
          mode = next;
          if (next === 'view') window.showInactive(); else window.hide();
          if (wasInteraction) { if (restoreFocus) restore(); else previousForeground = null; }
        }
      } catch (error) {
        mode = 'hidden';
        window.hide();
        restore();
        throw error;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restore();
      mode = 'hidden';
      if (!window.isDestroyed()) window.destroy();
    },
  };
}
module.exports = { createWindowController };
