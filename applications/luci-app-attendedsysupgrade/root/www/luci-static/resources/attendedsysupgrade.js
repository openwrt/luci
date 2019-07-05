function $(s) {
    return document.getElementById(s.substring(1));
}


function show(s) {
    $(s).style.display = 'block';
}

function hide(s) {
    $(s).style.display = 'none';
}

function set_server() {
    hide("#status_box");
    data.url = $("#server").value;
    ubus_call("uci", "set", {
        "config": "attendedsysupgrade",
        "section": "server",
        values: {
            "url": data.url
        }
    })
    ubus_call("uci", "commit", {
        "config": "attendedsysupgrade"
    })
    var server_button = $("#server")
    server_button.type = 'button';
    server_button.className = 'cbi-button cbi-button-edit';
    server_button.parentElement.removeChild($("#button_set"));
    server_button.onclick = edit_server;
}

function edit_server() {
    $("#server").type = 'text';
    $("#server").onkeydown = function(event) {
        if (event.key === 'Enter') {
            set_server();
            return false;
        }
    }
    $("#server").className = '';
    $("#server").onclick = null;

    var button_set = document.createElement("input");
    button_set.type = "button";
    button_set.value = "Save";
    button_set.name = "button_set";
    button_set.id = "button_set";
    button_set.className = 'cbi-button cbi-button-save';
    button_set.onclick = set_server
    $("#server").parentElement.appendChild(button_set);
}

function edit_packages() {
    data.edit_packages = true
    hide("#edit_button");
    $("#edit_packages").value = data.packages.join("\n");
    show("#edit_packages");
}

// requests to the upgrade server
function server_request(path) {
    return fetch(data.url + "/" + path, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data.request_dict)
        })
        .then(function(response) {
            switch (response.status) {
                case 200:
                case 202:
                case 204:
                    return response
                case 400:
                    var error = new Error(response.statusText)
                    error.response = response
                    throw error

                case 409:
                    var error = new Error("Incompatible package selection. See build log for details")
                    error.response = response
                    throw error

                case 412:
                    var error = new Error("Unsupported device, release, target, subtraget or board")
                    error.response = response
                    throw error

                case 413:
                    var error = new Error("No firmware created due to image size. Try again with less packages selected.")
                    error.response = response
                    throw error

                case 422:
                    var package_missing = response.headers.get("X-Unknown-Package") || "Unknown";
                    console.log(response.headers)
                    var error = new Error(`Unknown package in request: ${package_missing}`)
                    error.response = response
                    throw error

                case 500:
                    var error = new Error(response.statusText)
                    error.response = response
                    throw error

                case 501:
                    var error = new Error("No sysupgrade file produced, may not supported by model.")
                    error.response = response
                    throw error

                case 502:
                    // python part offline
                    var error = new Error("Server down (for maintenance)")
                    error.response = response
                    throw error

                case 503:
                    var error = new Error("Server overloaded")
                    error.response = response
                    throw error
            }
        })
}

// initial setup, get system information
function setup() {
    uci_get("attendedsysupgrade", "server", "url")
        .then(function(response) {
            data.url = response
            show("#upgrade_button");
            show("#server_div");
            $("#server").value = data.url;
        })
    uci_get("attendedsysupgrade", "client", "upgrade_packages")
        .then(response => data.upgrade_packages = response)
    uci_get("attendedsysupgrade", "client", "advanced_mode")
        .then(response => data.advanced_mode = response)
    uci_get("attendedsysupgrade", "client", "auto_search")
        .then(response => data.auto_search = response)

    data.request_dict = {}
    ubus_call("rpc-sys", "packagelist", {})
        .then(response => data.request_dict.installed = response.packages)

    ubus_call("system", "board", {})
        .then(function(response) {
            data.request_dict.distro = response.release.distribution;
            data.request_dict.version = response.release.version;
            data.request_dict.revision = response.release.revision;
            data.request_dict.target = response.release.target;
            data.request_dict.board_name = response.board_name
            data.request_dict.board = data.request_dict.board_name
            data.request_dict.model = response.model
        })
}

function uci_get(config, section, option) {
    // simple wrapper to get a uci value store in data.<option>
    return ubus_call("uci", "get", {
            "config": config,
            "section": section,
            "option": option,
        })
        .then(response => response.value)
}

ubus_counter = 0

function ubus_call(command, argument, params) {
    var call = {}
    call.jsonrpc = "2.0";
    call.id = ubus_counter;
    call.method = "call";
    call.params = [data.ubus_rpc_session, command, argument, params]
    ubus_counter++
    return fetch(ubus_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(call)
        })
        .then(response => response.json())
        .then(response => response.result[1])
        .catch(function(error) {
            set_status("danger",
                `<h3>Ubus call failed:</h3>
                <p>Request: ${request_dict}</p>
                <p>Response: ${JSON.stringify(response)}</p>`
            )
        })
}

function set_status(type, message, loading, show_log) {
    $("#status_box").className = "alert-message " + type;
    var loading_image = '';
    if (loading) {
        loading_image = '<img src="/luci-static/resources/icons/loading.gif" alt="Loading" style="vertical-align:middle"> ';
    }
    if (data.log) {
        message += `<p><a target="_blank" href="${data.url}${data.log}">Build log</a></p>`
    }
    $("#status_box").innerHTML = loading_image + message;
    show("#status_box")
}

function upgrade_check() {
    // Asks server for new firmware
    // If data.upgrade_packages is set to true search for new package versions as well
    hide("#status_box");
    hide("#server_div");
    set_status("info", "Searching for upgrades", true);
    data.request_dict.upgrade_packages = data.upgrade_packages
    server_request("api/upgrade-check")
        .then(function(response) {
            switch (response.status) {
                case 200:
                    response.json()
                        .then(function(response) {
                            // create output to tell user what's going to be upgrade (release/packages)
                            var info_output = ""
                            if (response.version) {
                                info_output += `<h3>New release ${response.version} available</h3>`
                                info_output += `Installed version:  ${data.request_dict.version}`
                                data.request_dict.version = response.version;
                            }
                            if (response.upgrades) {
                                if (response.upgrades != {}) {
                                    info_output += "<h3>Package upgrades available</h3>"
                                    // sort upgrades alphabetically
                                    Object.keys(response.upgrades).sort().map(function(upgrade) {
                                        info_output += `
                            <b>${upgrade}</b>:
                                ${response.upgrades[upgrade][1]} to ${response.upgrades[upgrade][0]}<br />`
                                    })
                                }
                            }
                            data.packages = response.packages
                            set_status("success", info_output)

                            if (data.advanced_mode == 1) {
                                show("#edit_button");
                            }
                            var upgrade_button = $("#upgrade_button")
                            upgrade_button.value = "Request firmware";
                            upgrade_button.style.display = "block";
                            upgrade_button.disabled = false;
                            upgrade_button.onclick = build_request;
                        })
                    break
                case 204:
                    // no upgrades available
                    set_status("success", "<h3>No upgrades available</h3>Your system is up to date!")
                    break
            }
        })
        .catch(function(error) {
            set_status("danger",
                `<h3>Upgrade check failed:</h3>
                    <p>${error}</p>`
            )
        })
}

function build_request() {
    // Request firmware using the following parameters
    // distro, version, target, board_name/model, packages
    $("#upgrade_button").disabled = true;
    hide("#edit_packages");
    hide("#edit_button");
    hide("#keep_container");

    // remove "installed" entry as unused by build requests
    delete data.request_dict.installed

    if (data.edit_packages == true) {
        data.request_dict.packages = $("#edit_packages").value.split("\n")
    } else {
        data.request_dict.packages = data.packages;
    }
    server_request("api/build-request")
        .then(function(response) {
            switch (response.status) {
                case 200:
                    response.json()
                        .then(function(response) {
                            // ready to download
                            data.files = response.files
                            data.sysupgrade = response.sysupgrade
                            data.log = response.log

                            var info_output = `
                            <h3>Firmware created</h3>
                            <p>Created file: <a href="${data.url}${data.files}${data.sysupgrade}">${data.sysupgrade}</p></a> `
                            set_status("success", info_output, false, true);

                            show("#keep_container");
                            var upgrade_button = $("#upgrade_button")
                            upgrade_button.disabled = false;
                            upgrade_button.style.display = "block";
                            upgrade_button.value = "Flash firmware";
                            upgrade_button.onclick = transfer_image;
                        })
                    break

                case 202:
                    var imagebuilder = response.headers.get("X-Imagebuilder-Status");
                    if (imagebuilder === "queue") {
                        // in queue
                        var queue = response.headers.get("X-Build-Queue-Position");
                        set_status("info", "In build queue position " + queue, true)
                        console.log("queued");
                    } else if (imagebuilder === "building") {
                        set_status("info", "Building image", true);
                        console.log("building");
                    } else {
                        // fallback if for some reasons the headers are missing e.g. browser blocks access
                        set_status("info", "Processing request", true);
                        console.log(imagebuilder)
                    }
                    setTimeout(function() {
                        server_request("api/build-request")
                    }, 5000)
                    break
            }
        })
        .catch(function(error) {
            error.response.json().then(function(response) {
                data.log = response.log
                set_status("danger",
                    `<h3>Build request failed:</h3>
                    <p>${error}</p>`
                )
            })
        })
}

function ping_ubus() {
    // Tries to connect to ubus. If the connection fails the device is likely still rebooting.
    // If more time than ping_max passes update may failed
    if (ping_max > 0) {
        ping_max--;
        fetch(ubus_url)
            .then(function(response) {
                set_status("success", "Success! Please reload web interface");
                $("#upgrade_button").value = "Reload page";
                show("#upgrade_button");
                $("#upgrade_button").disabled = false;
                $("#upgrade_button").onclick = function() {
                    location.reload();
                }
            })
            .catch(function(error) {
                set_status("warning", "Rebooting device - please wait!", true);
                setTimeout(ping_ubus, 5000)
            })
    } else {
        set_status("danger", "Web interface could not reconnect to your device. Please reload web interface or check device manually")
    }
}

function transfer_image() {
    // Download image from server once the url was received by build_request
    set_status("info", "Downloading firmware to web browser memory", true);
    hide("#keep_container");
    hide("#upgrade_button");
    fetch(data.url + data.files + data.sysupgrade)
        .then(response => response.blob())
        .then(function(response) {
            // Uploads received blob data to the server using cgi-io
            set_status("info", "Uploading firmware to device", true);

            var form_data = new FormData();
            form_data.append("sessionid", data.ubus_rpc_session)
            form_data.append("filename", "/tmp/firmware.bin")
            form_data.append("filemode", 755) // insecure?
            form_data.append("filedata", response)

            fetch(origin + "/cgi-bin/cgi-upload", {
                    method: "POST",
                    body: form_data,
                })
                .then(function() {
                    // Flash image via rpc-sys upgrade_start
                    set_status("warning", "Flashing firmware. Don't unpower device", true)
                    ubus_call("rpc-sys", "upgrade_start", {
                        "keep": $("#keep").checked
                    });
                    ping_max = 3600; // in seconds
                    setTimeout(ping_ubus, 10000)
                })
                .catch(function(error) {
                    set_status("danger", "Upload of firmware failed, please retry by reloading web interface")
                })

        })
}

document.onload = setup()
