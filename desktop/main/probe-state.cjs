'use strict';
function nextMode(mode, event) {
  if (!['hidden','view','interact'].includes(mode)) throw Error('Invalid mode');
  switch(event) {
    case 'toggleOverlay': return mode === 'hidden' ? 'view' : 'hidden';
    case 'toggleInteraction': return mode === 'hidden' ? mode : mode === 'view' ? 'interact' : 'view';
    case 'blur': return mode === 'interact' ? 'view' : mode;
    case 'escape': return mode === 'interact' ? 'hidden' : mode;
    default: throw Error('Invalid event');
  }
}
module.exports={nextMode};
