{
  "targets": [{
    "target_name": "raw_input",
    "sources": ["raw-input.cc"],
    "defines": ["NAPI_VERSION=8", "WIN32_LEAN_AND_MEAN", "NOMINMAX"],
    "conditions": [["OS=='win'", {"libraries": ["user32.lib"]}]],
    "msvs_settings": {"VCCLCompilerTool": {"AdditionalOptions": ["/std:c++17", "/W4"]}}
  }]
}
