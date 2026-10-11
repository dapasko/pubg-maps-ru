module.exports = {
  packagerConfig: {
    name: 'PUBG Marker Overlay Probe',
    executableName: 'pubg-marker-overlay-probe',
    asar: { unpack: '**/raw_input.node' },
    ignore: [/^\/native\/(?:.*\.cc|binding\.gyp$)/, /^\/native\/build\/(?!Release(?:\/|$))/, /^\/native\/build\/Release\/(?!raw_input\.node$)/, /^\/tests(?:\/|$)/, /^\/tools(?:\/|$)/, /^\/ui(?:\/|$)/, /^\/work(?:\/|$)/, /^\/out(?:\/|$)/, /^\/node_modules(?:\/|$)/],
  },
  makers: [{name:'@electron-forge/maker-zip',platforms:['win32']}],
};
