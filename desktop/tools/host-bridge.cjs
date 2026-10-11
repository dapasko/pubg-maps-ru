'use strict';
// Cross-build only: resolve Node-API symbols in this Electron process, not node.exe.
// The normal MSVC/node-gyp build uses its standard delay-load hook instead.
function generateHostBridge(source, headers){
 const names=[...new Set([...source.matchAll(/\b(napi_\w+)\s*\(/g)].map(m=>m[1]))].sort();
 const declarations=headers.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const functions=names.map(name=>{
  const match=declarations.match(new RegExp(`NAPI_EXTERN\\s+napi_status\\s+NAPI_CDECL\\s+${name}\\s*\\(([^;]*?)\\);`));
  if(!match)throw Error(`Missing header signature for ${name}`);
  const args=match[1].replace(/\s+/g,' ').trim();
  const parameters=args.split(',').map(part=>{const m=part.trim().match(/([A-Za-z_]\w*)\s*$/);if(!m)throw Error(`Unsupported parameter in ${name}`);return m[1];});
  return `extern "C" napi_status NAPI_CDECL ${name}(${args}) {\n  static auto hostFunction = reinterpret_cast<decltype(&${name})>(GetProcAddress(GetModuleHandleW(nullptr), "${name}"));\n  if (!hostFunction) return napi_generic_failure;\n  return hostFunction(${parameters.join(', ')});\n}`;
 });
 return '#include <windows.h>\n#include <node_api.h>\n\n'+functions.join('\n\n')+'\n';
}
module.exports={generateHostBridge};
