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

// initial setup, get system information
function setup() {
    ubus_call("rpc-sys", "packagelist", {}, "packages");
    ubus_call("system", "board", {}, "release");
    ubus_call("system", "board", {}, "board_name");
    ubus_call("system", "board", {}, "model");
    ubus_call("system", "info", {}, "memory");
    uci_get({
        "config": "attendedsysupgrade",
        "section": "server",
        "option": "url"
    })
    uci_get({
        "config": "attendedsysupgrade",
        "section": "client",
        "option": "upgrade_packages"
    })
    uci_get({
        "config": "attendedsysupgrade",
        "section": "client",
        "option": "advanced_mode"
    })
    uci_get({
        "config": "attendedsysupgrade",
        "section": "client",
        "option": "auto_search"
    })
    setup_ready();
}

function setup_ready() {
    // checks if a async ubus calls have finished
    if (ubus_counter != ubus_closed) {
        setTimeout(setup_ready, 300)
    } else {
        if (data.auto_search == 1) {
            upgrade_check();
        } else {
            show("#upgrade_button");
            show("#server_div");
            $("#server").value = data.url;
        }
    }
}

function uci_get(option) {
    // simple wrapper to get a uci value store in data.<option>
    ubus_call("uci", "get", option, option["option"])
}

ubus_counter = 0;
ubus_closed = 0;

function ubus_call(command, argument, params, variable) {
    var request_data = {};
    request_data.jsonrpc = "2.0";
    request_data.id = ubus_counter;
    request_data.method = "call";
    request_data.params = [data.ubus_rpc_session, command, argument, params]
    var request_json = JSON.stringify(request_data)
    ubus_counter++;
    var request = new XMLHttpRequest();
    request.open("POST", ubus_url, true);
    request.setRequestHeader("Content-type", "application/json");
    request.onload = function(event) {
        if (request.status === 200) {
            var response = JSON.parse(request.responseText)
            if (!("error" in response) && "result" in response) {
                if (response.result.length === 2) {
                    if (command === "uci") {
                        data[variable] = response.result[1].value
                    } else {
                        data[variable] = response.result[1][variable]
                    }
                }
            } else {
                set_status("danger", "<b>Ubus call failed:</b><br />Request: " + request_json + "<br />Response: " + JSON.stringify(response))
            }
            ubus_closed++;
        }
    }
    request.send(request_json);
}

function set_status(type, message, loading, show_log) {
    $("#status_box").className = "alert-message " + type;
    var loading_image = '';
    if (loading) {
        loading_image = '<img src="/luci-static/resources/icons/loading.gif" alt="Loading" style="vertical-align:middle"> ';
    }
    if (data.buildlog_url && show_log) {
        message += ' <p><a target="_blank" href="' + data.buildlog_url + '">Build log</a></p>'
    }
    $("#status_box").innerHTML = loading_image + message;
    show("#status_box")
}

function upgrade_check() {
    var current_version = data.release.version.toLowerCase();
    var current_branch = current_version.split('.').slice(0, 2).join('.')
    var candidates = []
    hide("#status_box");
    hide("#server_div");
    set_status("info", "Searching for upgrades", true);
    fetch(data.url + "/api/versions")
        .then(response => response.json())
        .then(response => {
            var branches = response["branches"]
            for (i in branches) {
                // handle snapshots in a special way - as always
                if (current_version == "snapshot" && branches[i]["latest"] == "snapshot") {
                    candidates.unshift(branches[i])
                    break
                }

                if (current_version == branches[i]["latest"]) {
                    break
                }
                if (current_branch != branches[i]["name"]) {
                    branches[i]["warn_branch_jump"] = true
                }
                candidates.unshift(branches[i])
                if (current_branch == branches[i]["name"]) {
                    // don't offer branches older than the current
                    break
                }
            }

            if (candidates.length > 0) {
                var info_output = "<h3>New release <b>" + candidates[0].latest + "</b> available</h3>"
                info_output += "Installed version: " + data.release.version

                // tell server the currently installed version
                request_dict.current_version = request_dict.version;
                // tell server what version to install
                request_dict.version = candidates[0].latest;
                // tell server to diff the requested packages with the default packages
                // this allows to not automatically re-install default packages which
                // where dropped in later releases
                request_dict.diff_packages = true;

                set_status("success", info_output)

                if (data.advanced_mode == 1) {
                    show("#edit_button");
                }
                var upgrade_button = $("#upgrade_button")
                upgrade_button.value = "Request firmware";
                upgrade_button.style.display = "block";
                upgrade_button.disabled = false;
                upgrade_button.onclick = upgrade_request;

            } else {
                set_status("success", "No upgrades available")

            }
        });

}

function upgrade_request() {
    // Request firmware using the following parameters
    // distro, version, target, board_name/model, packages
    $("#upgrade_button").disabled = true;
    hide("#edit_packages");
    hide("#edit_button");
    hide("#keep_container");

    // add board info to let server determine profile
    request_dict.profile = data.board_name

    if (data.edit_packages == true) {
        request_dict.packages = $("#edit_packages").value.split("\n")
    } else {
        request_dict.packages = Object.keys(data.packages);
    }
    server_request()
}

function upgrade_request_callback(response) {
    var sysupgrade_file = "";
    console.log(response)
    for (i in response.images) {
        if (response.images[i].type == "sysupgrade") {
            sysupgrade_file = response.images[i].name;
        }
    }
    if (sysupgrade_file != "") {
        data.sysupgrade_url = data.url + '/store/' + response.bin_dir + '/' + sysupgrade_file
        var info_output = '<h3>Firmware created</h3><p>Created file: <a href="' + data.sysupgrade_url + '">' + sysupgrade_file + '</p></a>'
        set_status("success", info_output, false, true);

        show("#keep_container");
        var upgrade_button = $("#upgrade_button")
        upgrade_button.disabled = false;
        upgrade_button.style.display = "block";
        upgrade_button.value = "Flash firmware";
        upgrade_button.onclick = download_image;
    } else {
        set_status("danger", "Firmware build successfull but device not sysupgrade compatible!")
    }
}

function flash_image() {
    // Flash image via rpc-sys upgrade_start
    set_status("warning", "Flashing firmware. Don't unpower device", true)
    ubus_call("rpc-sys", "upgrade_start", {
        "keep": $("#keep").checked
    }, 'message');
    ping_max = 3600; // in seconds
    setTimeout(ping_ubus, 10000)
}

function ping_ubus() {
    // Tries to connect to ubus. If the connection fails the device is likely still rebooting.
    // If more time than ping_max passes update may failed
    if (ping_max > 0) {
        ping_max--;
        var request = new XMLHttpRequest();
        request.open("GET", ubus_url, true);
        request.addEventListener('error', function(event) {
            set_status("warning", "Rebooting device - please wait!", true);
            setTimeout(ping_ubus, 5000)
        });
        request.addEventListener('load', function(event) {
            set_status("success", "Success! Please reload web interface");
            $("#upgrade_button").value = "Reload page";
            show("#upgrade_button");
            $("#upgrade_button").disabled = false;
            $("#upgrade_button").onclick = function() {
                location.reload();
            }
        });
        request.send();
    } else {
        set_status("danger", "Web interface could not reconnect to your device. Please reload web interface or check device manually")
    }
}

function upload_image(blob) {
    // Uploads received blob data to the server using cgi-io
    set_status("info", "Uploading firmware to device", true);
    var request = new XMLHttpRequest();
    var form_data = new FormData();

    form_data.append("sessionid", data.ubus_rpc_session)
    form_data.append("filename", "/tmp/firmware.bin")
    form_data.append("filemode", 755) // insecure?
    form_data.append("filedata", blob)

    request.addEventListener('load', function(event) {
        request_json = JSON.parse(request.responseText)
        flash_image();
    });

    request.addEventListener('error', function(event) {
        set_status("danger", "Upload of firmware failed, please retry by reloading web interface")
    });

    request.open('POST', origin + '/cgi-bin/cgi-upload');
    request.send(form_data);
}


function download_image() {
    // Download image from server once the url was received by upgrade_request
    hide("#keep_container");
    hide("#upgrade_button");
    var download_request = new XMLHttpRequest();
    download_request.open("GET", data.sysupgrade_url);
    download_request.responseType = "arraybuffer";

    download_request.onload = function() {
        if (this.status === 200) {
            var blob = new Blob([download_request.response], {
                type: "application/octet-stream"
            });
            upload_image(blob)
        }
    };
    set_status("info", "Downloading firmware to web browser memory", true);
    download_request.send();
}

function server_request() {
    fetch(data.url + "/api/build", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request_dict)
        })
        .then(response => {
            switch (response.status) {
                case 200:
                    response.json()
                        .then(response => {
                            upgrade_request_callback(response)
                        });
                    break;
                case 202:
                    set_status("info", "Processing request", true);
                    setTimeout(function() {
                        server_request()
                    }, 5000)
                    break;
                case 400: // bad request
                case 422: // bad package
                case 500: // build failed
                    console.log('error (' + response.status + ')');
                    response.json()
                        .then(response => {
                            if (response.buildlog) {
                                data.buildlog_url = data.url + '/' + response.bin_dir + '/buildlog.txt';
                            }
                            set_status("danger", response.message);
                        });
                    break;
            }
        });
}

request_dict = {}
document.onload = setup()
