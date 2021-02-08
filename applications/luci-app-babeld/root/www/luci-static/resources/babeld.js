function ubus_call(command, argument, params) {
    var request_data = {};
    request_data.jsonrpc = "2.0";
    request_data.method = "call";
    request_data.params = [data.ubus_rpc_session, command, argument, params]
    var request_json = JSON.stringify(request_data);
    var request = new XMLHttpRequest();
    request.open("POST", ubus_url, false);
    request.setRequestHeader("Content-type", "application/json");
    request.send(request_json);
    if (request.status === 200) {
        var response = JSON.parse(request.responseText)
        if (!("error" in response) && "result" in response) {
            if (response.result.length === 2) {
                return response.result[1];
            }
        } else {
            console.err("Failed query ubus!");
        }
    }
}
