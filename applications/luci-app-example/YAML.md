# Processing YAML in Lua

You may need to deal with YAML data in your Lua code.

## root/usr/libexec/rpcd/luci.example
These are the changes you would need in the `usr/libexec/rpcd/luci.example` file.

First, declare that you want YAML libraries:

```
-- If you need to process YAML, opkg install lyaml
local lyaml = require "lyaml"
```

Then, declare a function to handle the YAML data, and a helper to read the file

```
local function readfile(path)
    local s = fs.readfile(path)
    return s and (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function reading_from_yaml()
    -- Use the locally declared readfile() function to read in the
    -- sample YAML file that ships with this package.
    local example_config = readfile("/etc/luci.example.yaml")

    -- Map that string to a Lua table via lyaml's load() method
    local example_table = lyaml.load(example_config)

    -- Convert the table to JSON
    local example_json = jsonc.stringify(example_table)

    -- Pass the JSON back
    return example_json
end
```

Declare the method in the `methods` table

```
    -- Converts the AGH YAML configuration into JSON for consumption by
    -- the LuCI app.
    get_yaml_file_sample = {
        -- A special key of 'call' points to a function definition for execution.
        call = function()

            local r = {}
            r.result = reading_from_yaml()
            -- The 'call' handler will refer to '.code', but also defaults if not found.
            r.code = 0
            -- Return the table object; the call handler will access the attributes
            -- of the table.
            return r
        end
    },
```

## htdocs/luci-static/resources/view/example/rpc.js

These are the changes you need in the `rpc.js` file.

Declare the RPC call

```
var load_sample_yaml = rpc.declare({
    object: 'luci.example',
    method: 'get_yaml_file_sample'
});
```

Add this declaration to the `view.extend()` call

```
    render_sample_yaml: function(sample) {
        console.log('render_sample_yaml()');
        console.log(sample);

        if (sample.error) {
            return this.generic_failure(sample.error)
        }
        // Basically, a fully static table declaration.
        var table = E('table', { 'class': 'table', 'id': 'sample-yaml' }, [
            E('tr', {}, [
                E('td', { 'class': 'td left', 'width': '33%' }, _("Top Level Int")),
                E('td', { 'class': 'td left' }, sample.top_level_int),
            ]),
            E('tr', {}, [
                E('td', { 'class': 'td left', 'width': '33%' }, _("Top Level String")),
                E('td', { 'class': 'td left' }, sample.top_level_string),
            ])
        ]);
        return table;
    },
```

Add a call to the `load` function in `view.extend()`

```
    load: function () {
        return Promise.all([
            load_sample_yaml(),
            load_sample1()
        ]);
    },
```

Add this code to the `render` function in `view.extend()`

```
                E('div', { 'class': 'cbi-section', 'id': 'cbi-sample-yaml' }, [
                    E('div', { 'class': 'left' }, [
                        E('h3', _('Sample YAML via RPC')),
                        E('div', {}), _("YAML transformed to JSON, table built explicitly"),
                        this.render_sample_yaml(sample_yaml),
                    ]),
                ]),
```

## root/usr/share/rpcd/acl.d/luci-app-example.json

Allow access to the new RPC API

```
    "read": {
      "ubus": {
        "luci.example": [
          "get_yaml_file_sample",
          "get_sample1",
          "get_sample2"
        ]
      },
```

## root/etc/luci.example.yaml

Set up the sample YAML file, by placing it either in `root/etc` of the development tree, or directly
in `/etc` on the target machine and call it `luci.example.yaml` to match up to the `reading_from_yaml`
function's expectations.

```
top_level_string: example
top_level_int: 8080
top_level:
  list_elements:
  - foo
  - bar
```

That's it. Don't forget to also update the `LUCI_DEPENDS` segment of the `Makefile` to include
`+lyaml` so that the packaging system knows your code needs the YAML parsing package.
