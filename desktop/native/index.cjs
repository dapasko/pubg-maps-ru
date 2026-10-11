'use strict';
if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Raw Input requires Windows x64');
try { module.exports = require('./build/Release/raw_input.node'); }
catch (error) { throw new Error('Windows input module is missing. Build with npm run native:build before launching.', { cause: error }); }
