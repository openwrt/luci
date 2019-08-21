var loader = '<img src="/luci-static/resources/icons/loading.gif" alt="Loading" style="vertical-align:middle; width: 20px">';
var deviceInfo = {};
var remoteVersions = [];
var UNEXPECTED_ERROR = 'Unexpected error occurred. For more, check browser logs.';
var newerVersion = '';
var newerVersionAvailable = false;
var buildStatusCheckInterval = 3600;
var multipleNewMajorVersionsAvailable = false;
var asu = 'https://cors-anywhere.herokuapp.com/https://aparcar.stephen304.com/';
var imageURL;
var pingMax;


const sleep = m => new Promise(r => setTimeout(r, m));

function $(s) {
    return document.getElementById(s.substring(1));
}

function showInfo(html) {
    clearLoggers();
    $('#info').style.display = 'block';
    $('#info').innerHTML = html;
}

function showError(html) {
    clearLoggers();
    $('#error').style.display = 'block';
    $('#error').innerHTML = html;
}

function showSuccess(html) {
    clearLoggers();
    $('#success').style.display = 'block';
    $('#success').innerHTML = html;
}

function hideInfo() {
    $('#info').style.display = 'none';
}

function hideError() {
    $('#error').style.display = 'none';
}

function hideSuccess() {
    $('#success').style.display = 'none';
}

function clearLoggers() {
    hideInfo();
    hideError();
    hideSuccess();
}

function showUpdateControls() {
    $('#download').style.display = 'block';
}

function unexpectedError(err) {
    showError(UNEXPECTED_ERROR);
    console.log(err);
}

function toggleRetainPackageWarning() {
    if ($('#packages').checked) {
        $('#packages-warning').style.display = 'none';
    } else {
        $('#packages-warning').style.display = 'block';
    }
}

function toggleRetainSettingsWarning() {
    if ($('#keep').checked) {
        $('#keep-warning').style.display = 'none';
    } else {
        $('#keep-warning').style.display = 'block';
    }
}

function serverRequest(url, method = 'GET', data = {}, sendResponseOnly = true) {
    return new Promise(async function(resolve, reject) {
        var requestOptions = {
            method,
        };
        if (method === 'POST') {
            requestOptions.headers = {
                'Content-type': 'application/json',
            };
            requestOptions.body = JSON.stringify(data);
        }
        var request = await fetch(url, requestOptions);
        if (sendResponseOnly) {
            var response = await request.json();
            if (request.status >= 200 && request.status < 400) {
                if (sendResponseOnly) {
                    resolve(response);
                } else {
                    resolve(request);
                }
            } else {
                reject(request);
            }   
        } else {
            resolve(request);
        }
    });
}

function ubusCall(command, argument, params = {}) {
    return new Promise(async function(resolve, reject) {
        var request = await fetch(ubusURL, {
            method: 'POST',
            headers: {
                'Content-type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: [ubusRpcSession, command, argument, params]
            })
        });
        var response = await request.json();
        if (request.ok) {
            if (!('error' in response) && 'result' in response) {
                if (response.result.length === 2) {
                    if (command === "uci") {
                        resolve(response.result[1].value);
                    } else {
                        resolve(response.result[1]);
                    }
                }
            } else {
                reject(request);
            }
        } else {
            reject(request);
        }
    });
}

async function getDeviceInfo() {
    showInfo(loader + ' Loading device information...');
    try {
        deviceInfo = await ubusCall('system', 'board');
        clearLoggers();
        deviceInfo.release.revision_id = deviceInfo.release.revision.split('-')[0];
        deviceInfo.board_name = deviceInfo.board_name.replace(',', '_');
        var packages = await ubusCall('rpc-sys', 'packagelist');
        deviceInfo.packages = packages['packages'];
        $('#device-info').innerHTML = `
            Current System: <b>${deviceInfo.release.version}</b><small>/${deviceInfo.release.revision}</small>
        `;
    } catch (errRequest) {
        unexpectedError(errRequest);
    }
}

async function getVersionsFromOpenwrtServer() {
    showInfo(loader + ' Looking for available updates...');
    try {
        var versionsResponse = await serverRequest(openwrtServer + 'versions.json');
        clearLoggers();
        remoteVersions = versionsResponse['versions'];
        for(var i = 0; i < remoteVersions.length; i++) {
            var revisionId = remoteVersions[i].revision.split('-')[0];
            if (deviceInfo.release.version.toLowerCase() === 'snapshot') {
                if (remoteVersions[i].name.toLowerCase() === 'snapshot') {
                    if (revisionId > deviceInfo.release.revision_id) {
                        newerVersion = remoteVersions[i];
                        newerVersionAvailable = true;
                        break;
                    }
                }
            } else if (remoteVersions[i].name.toLowerCase() !== 'snapshot') {
                var majorVersionDiff = parseInt(remoteVersions[i].name.split('.')[0]) - parseInt(deviceInfo.release.version.split('.')[0]);
                if (majorVersionDiff <= 1) {
                    if (!newerVersionAvailable) {
                        newerVersion = remoteVersions[i];
                        newerVersionAvailable = true;
                    } else if (remoteVersions[i].name > newerVersion.name) {
                        newerVersion = remoteVersions[i];
                    }
                } else {
                    multipleNewMajorVersionsAvailable = true;
                }
            }
        }
    } catch (errRequest) {
        unexpectedError(errRequest);
    }
}

async function checkForUpdates() {
    newerVersionAvailable = false;
    await getVersionsFromOpenwrtServer();
    if (newerVersionAvailable) {
        if (multipleNewMajorVersionsAvailable) {
            showSuccess('There are multiple major updates availble for the system. By clicking the Download and Update button, your system will be updated to ' + newerVersion.name + ' only. <br /> If you require to update to the latest version, please repeat the steps after this update.');
        }
        else {
            showSuccess(`
                A new version (<b>${newerVersion.name}</b><small>/${newerVersion.revision}</small>) is available!
            `);
        }
        showUpdateControls();
    } else {
        showSuccess('Your device is already upto date!');
    }
}

async function downloadAndApplyImage() {
    try {
        if ($('#packages').checked) {
            await buildImage();
        }
        await downloadImage();
        await flashImage();
    } catch (errRequest) {
        unexpectedError(errRequest);
    }
}

async function buildImage() {
    return new Promise(async function(resolve, reject) {
        showInfo(loader + ' Building Image...')
        try {
            var buildRequest = await serverRequest(asu + 'api/build-request', 'POST', {
                profile: deviceInfo.board_name,
                defaults: '',
                distro: 'openwrt',
                packages: deviceInfo.packages,
                target: deviceInfo.release.target,
                version: newerVersion.name.toLowerCase(),
            }, false);
            var response = await buildRequest.json();
            if (buildRequest.status === 202 && 'request_hash' in response) {
                await sleep(buildStatusCheckInterval);
                await checkBuildStatus(response['request_hash']);
                resolve();
            } else if (buildRequest.status === 200) {
                response.images.forEach(image => {
                    if (image.type === 'sysupgrade') {
                        imageURL = asu + response.image_folder + '/' + image.name;
                    }
                });
                resolve();
            }
        } catch (errRequest) {
            reject(errRequest);
        }
    });
}

async function checkBuildStatus(requestHash) {
    return new Promise(async function(resolve, reject) {
        try {
            var buildCheckRequest = await serverRequest(asu + 'api/build-request/' + requestHash, 'GET', {}, false);
            var response = await buildCheckRequest.json();
            if (buildCheckRequest.status === 202) {
                await sleep(buildStatusCheckInterval);
                await checkBuildStatus(requestHash);
                resolve();
            } else if (buildCheckRequest.status === 200) {
                response.images.forEach(image => {
                    if (image.type === 'sysupgrade') {
                        imageURL = asu + response.image_folder + '/' + image.name;
                    }
                });
                resolve();
            }
        } catch (errRequest) {
            reject(errRequest);
        }
    });
}

function downloadImage() {
    showInfo(loader + ' Downloading image onto your device...');
    return new Promise(function(resolve, reject) {
        var downloadRequest = new XMLHttpRequest();
        downloadRequest.open("GET", imageURL);
        downloadRequest.responseType = "arraybuffer";

        downloadRequest.onload = function() {
            if (this.status === 200) {
                var blob = new Blob([downloadRequest.response], {
                    type: "application/octet-stream"
                });
                var uploadRequest = new XMLHttpRequest();
                var formData = new FormData();

                formData.append("sessionid", ubusRpcSession)
                formData.append("filename", "/tmp/firmware.bin")
                formData.append("filemode", 755) // insecure?
                formData.append("filedata", blob)

                uploadRequest.onload = function() {
                    var requestJson = JSON.parse(uploadRequest.responseText);
                    resolve(requestJson);
                };

                uploadRequest.onerror = function() {
                    reject(uploadRequest.responseText);
                };

                uploadRequest.open('POST', origin + '/cgi-bin/cgi-upload');
                uploadRequest.send(formData);
            }
        };
        downloadRequest.onerror = function() {
            reject(downloadRequest.responseText);
        };
        downloadRequest.send();
    });
}

async function flashImage() {
    return new Promise(async function(resolve, reject) {
        showInfo(loader + ' Flashing firmware. Don\'t unpower device');
        try {
            await ubusCall('rpc-sys', 'upgrade_start', {
                'keep': $('#keep').checked
            });
            pingMax = 3600;
            await sleep(10000);
            await pingUbus();
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

function pingUbus() {
    return new Promise(async function(resolve, reject) {
        if (pingMax > 0) {
            pingMax--;
            var request = new XMLHttpRequest();
            request.open("GET", ubusURL, true);
            request.onload = async function(event) {
                showSuccess('Successfully updated your device!');
                await getDeviceInfo();
            };
            request.onerror = function() {
                showInfo(loader + ' Rebooting device - please wait!');
                sleep(5000);
                pingUbus();
            };
            request.send();
        } else {
            showError('Web interface could not reconnect to your device. Please reload web interface or check device manually');
        }
    });
}

document.onload = init(); 
function init() {
    getDeviceInfo();
};
