'use strict';
'require view';
'require fs';
'require ui';
'require dom';
'require rpc';

var currentPath = '/';
var sortField = 'name';
var sortDirection = 'asc';
var configFilePath = '/etc/config/filemanager';
var config = {
    columnWidths: {
        'name': 150,
        'type': 100,
        'size': 100,
        'mtime': 150,
        'actions': 100
    },
    columnMinWidths: {
        'name': 100,
        'type': 80,
        'size': 80,
        'mtime': 120,
        'actions': 80
    },
    columnMaxWidths: {
        'name': 300,
        'type': 200,
        'size': 200,
        'mtime': 300,
        'actions': 200
    },
    padding: 10,
    paddingMin: 5,
    paddingMax: 20,
    currentDirectory: '/', // Added currentDirectory setting
    windowSizes: {          // Добавлено свойство windowSizes
        width: 800,
        height: 400
    },
    otherSettings: {
        // Add other default settings here
    }
};

// Подпрограмма для загрузки файла
function uploadFile(filename, filedata, onProgress) {
    return new Promise(function(resolve, reject) {
        var formData = new FormData();
        formData.append('sessionid', rpc.getSessionID());
        formData.append('filename', filename);
        formData.append('filedata', filedata);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', L.env.cgi_base + '/cgi-upload', true);

        xhr.upload.onprogress = function(event) {
            if (event.lengthComputable && onProgress) {
                var percent = (event.loaded / event.total) * 100;
                onProgress(percent);
            }
        };

        xhr.onload = function() {
            if (xhr.status === 200) {
                resolve(xhr.responseText);
            } else {
                reject(new Error(xhr.statusText));
            }
        };

        xhr.onerror = function() {
            reject(new Error('Network error'));
        };

        xhr.send(formData);
    });
}

// Function to load configuration from file
function loadConfig() {
    return fs.read(configFilePath).then(function(content) {
        var lines = content.trim().split('\n');

        // Process each line separately
        lines.forEach(function(line) {
            if (line.includes("option")) {
                // Check if the line contains multiple "option" sections and split them
                var splitLines = line.split("option").filter(Boolean);
                splitLines.forEach(function(subline) {
                    subline = "option " + subline.trim();  // Add "option" back to each subline

                    var parts = subline.match(/^option\s+(\S+)\s+'([^']+)'$/);
                    if (parts && parts.length === 3) {
                        var key = parts[1];
                        var value = parts[2];

                        if (key === 'columnWidths' || key === 'columnMinWidths' || key === 'columnMaxWidths') {
                            var widths = value.split(',');
                            widths.forEach(function(widthStr) {
                                var widthParts = widthStr.split(':');
                                if (widthParts.length === 2) {
                                    config[key][widthParts[0]] = parseInt(widthParts[1], 10);
                                }
                            });
                        } else if (key === 'currentDirectory') {
                            config.currentDirectory = value;
                        } else if (key === 'windowSizes') {
                            var sizes = value.split(',');
                            sizes.forEach(function(sizeStr) {
                                var sizeParts = sizeStr.split(':');
                                if (sizeParts.length === 2) {
                                    var sizeKey = sizeParts[0];
                                    var sizeValue = parseInt(sizeParts[1], 10);
                                    if (!isNaN(sizeValue)) {
                                        config.windowSizes[sizeKey] = sizeValue;
                                    }
                                }
                            });
                        } else {
                            config[key] = value;
                        }
                    }
                });
            }
        });
    }).catch(function(err) {
        console.error("Failed to load config: " + err);  // Log error if reading the config file fails
    });
}

// Function to save configuration to file
function saveConfig() {
    var configLines = [
        'config filemanager',
        '\toption columnWidths \'' + Object.keys(config.columnWidths).map(function(field) {
            return field + ':' + config.columnWidths[field];
        }).join(',') + '\'',
        '\toption columnMinWidths \'' + Object.keys(config.columnMinWidths).map(function(field) {
            return field + ':' + config.columnMinWidths[field];
        }).join(',') + '\'',
        '\toption columnMaxWidths \'' + Object.keys(config.columnMaxWidths).map(function(field) {
            return field + ':' + config.columnMaxWidths[field];
        }).join(',') + '\'',
        '\toption padding \'' + config.padding + '\'',
        '\toption paddingMin \'' + config.paddingMin + '\'',
        '\toption paddingMax \'' + config.paddingMax + '\'',
        '\toption currentDirectory \'' + config.currentDirectory + '\'',
        '\toption windowSizes \'' + Object.keys(config.windowSizes).map(function(key) {
            return key + ':' + config.windowSizes[key];
        }).join(',') + '\''
    ];
    // Add other settings
    Object.keys(config.otherSettings).forEach(function(key) {
        configLines.push('\toption ' + key + ' \'' + config.otherSettings[key] + '\'');
    });
    var configContent = configLines.join('\n') + '\n';
    return fs.write(configFilePath, configContent).then(function() {
        return Promise.resolve();
    }).catch(function(err) {
        return Promise.reject(new Error('Failed to save configuration: ' + err.message));
    });
}


// Function to join paths
function joinPath(path, name) {
    return path.endsWith('/') ? path + name : path + '/' + name;
}

// Function to convert symbolic permissions to numeric
function symbolicToNumeric(permissions) {
    var specialPerms = 0;
    var permMap = { 'r': 4, 'w': 2, 'x': 1, '-': 0 };
    var numeric = '';

    for (var i = 0; i < permissions.length; i += 3) {
        var subtotal = 0;
        for (var j = 0; j < 3; j++) {
            var char = permissions[i + j];

            // Handle special permissions
            if (char === 's' || char === 'S') {
                if (i === 0) {
                    specialPerms += 4;
                } else if (i === 3) {
                    specialPerms += 2;
                }
                subtotal += permMap['x'];
            } else if (char === 't' || char === 'T') {
                if (i === 6) {
                    specialPerms += 1;
                }
                subtotal += permMap['x'];
            } else {
                subtotal += permMap[char] !== undefined ? permMap[char] : 0;
            }
        }
        numeric += subtotal.toString();
    }

    if (specialPerms > 0) {
        numeric = specialPerms.toString() + numeric;
    }

    return numeric;
}

// Function to get file list using fs.exec()
function getFileList(path) {
    return fs.exec('/bin/ls', ['-lA', '--full-time', path]).then(function(res) {
        if (res.code !== 0) {
            var errorMessage = res.stderr ? res.stderr.trim() : 'Unknown error';
            return Promise.reject(new Error('Failed to list directory: ' + errorMessage));
        }

        // Проверяем, определено ли res.stdout, и устанавливаем пустую строку по умолчанию
        var stdout = res.stdout || '';
        var lines = stdout.trim().split('\n');
        var files = [];

        // Если директория пуста, lines будет содержать пустой массив, и мы просто вернем пустой список файлов
        lines.forEach(function(line) {
            if (line.startsWith('total') || !line.trim()) return;

            var parts = line.match(/^([\-dl])[rwx\-]{2}[rwx\-Ss]{1}[rwx\-]{2}[rwx\-Ss]{1}[rwx\-]{2}[rwx\-Tt]{1}\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+([\d\-]+\s+[\d\:\.]{8,12}\s+\+\d{4})\s+(.+)$/);
            if (!parts || parts.length < 7) {
                console.warn('Failed to parse line:', line);
                return;
            }
            var typeChar = parts[1];
            var permissions = line.substring(0, 10);
            var owner = parts[2];
            var group = parts[3];
            var size = parseInt(parts[4], 10);
            var dateStr = parts[5];
            var name = parts[6];

            var type = '';
            var target = null;
            if (typeChar === 'd') {
                type = 'directory';
            } else if (typeChar === '-') {
                type = 'file';
            } else if (typeChar === 'l') {
                type = 'symlink';
                var linkParts = name.split(' -> ');
                name = linkParts[0];
                target = linkParts[1] || '';
            } else {
                type = 'unknown';
            }

            var mtime = Date.parse(dateStr);

            if (type === 'symlink' && target && size === 4096) {
                size = -1;
            }

            files.push({
                name: name,
                type: type,
                size: size,
                mtime: mtime / 1000,
                owner: owner,
                group: group,
                permissions: permissions.substring(1),
                numericPermissions: symbolicToNumeric(permissions.substring(1)),
                target: target
            });
        });
        return files;
    });
}

return view.extend({
    load: function() {
        var self = this;
        return loadConfig().then(function() {
            currentPath = config.currentDirectory || '/'; // Set currentPath to the loaded currentDirectory
            return getFileList(currentPath);
        });
    },
    render: function(data) {
        var self = this;

        var viewContainer = E('div', { 'id': 'file-manager-container' }, [
            E('div', { 'class': 'file-manager-header' }, [
                E('h2', {}, _('File Manager: ')),
                E('input', { 'type': 'text', 'id': 'path-input', 'value': currentPath, 'style': 'margin-left: 10px; ' }),
                E('button', { 'id': 'go-button', 'click': this.handleGoButtonClick.bind(this), 'style': 'margin-left: 10px;' }, _('Go'))
            ]),
            E('style', {},
                '.cbi-button-apply, .cbi-button-reset, .cbi-button-save:not(.custom-save-button) { display: none !important; }' +
                '.cbi-page-actions { background: none !important; border: none !important; padding: ' + config.padding + 'px 0 !important; margin: 0 !important; }' +
                '.cbi-tabmenu { background: none !important; border: none !important; margin: 0 !important; padding: 0 !important; }' +
                '.cbi-tabmenu li { display: inline-block; margin-right: 10px; }' +
                '#file-list-container { margin-top: 30px !important; overflow-y: auto; overflow-x: auto; border: 1px solid #ccc; padding: 0; min-width: 600px; position: relative; }' +
                '#content-editor { margin-top: 30px !important; }' +
                '#editor-container textarea { ' +
                'min-width: 300px !important; ' +
                'max-width: 100% !important; ' +
                'min-height: 200px !important; ' +
                'max-height: 80vh !important; ' +
                'resize: both !important; ' +
                'overflow: auto !important; ' +
                'font-family: monospace !important; ' +
                'white-space: pre !important; ' +
                'overflow-x: auto !important; ' +
                'word-wrap: normal !important; ' +
                '}' +
                'th { text-align: left !important; position: sticky; top: 0; border-right: 1px solid #ddd; box-sizing: border-box; padding-right: 30px; white-space: nowrap; min-width: 100px; background-color: #fff; z-index: 2; }' +
                'td { text-align: left !important; border-right: 1px solid #ddd; box-sizing: border-box; white-space: nowrap; min-width: 100px; overflow: hidden; text-overflow: ellipsis; }' +
                'tr:hover { background-color: #f0f0f0 !important; }' +
                '.download-button { color: green; cursor: pointer; margin-left: 5px; }' +
                '.delete-button { color: red; cursor: pointer; margin-left: 5px; }' +
                '.edit-button { color: blue; cursor: pointer; margin-left: 5px; }' +
                '.symlink { color: green; }' +
                '.status-link { color: blue; text-decoration: underline; cursor: pointer; }' +
                '.action-button { margin-right: 10px; cursor: pointer; }' +
                '.size-cell { text-align: right; font-family: monospace; box-sizing: border-box; white-space: nowrap; display: flex; justify-content: flex-end; align-items: center; }' +
                '.size-number { display: inline-block; width: 8ch; text-align: right; }' +
                '.size-unit { display: inline-block; width: 4ch; text-align: right; margin-left: 0.5ch; }' +
                '.table { table-layout: fixed; border-collapse: collapse; white-space: nowrap; width: 100%; }' +
                '.table th:nth-child(3), .table td:nth-child(3) { width: 100px; min-width: 100px; max-width: 500px; }' +
                '.table th:nth-child(3) + th, .table td:nth-child(3) + td { padding-left: 10px; }' +
                '.resizer { position: absolute; right: 0; top: 0; width: 5px; height: 100%; cursor: col-resize; user-select: none; z-index: 3; }' +
                '.resizer::after { content: ""; position: absolute; right: 2px; top: 0; width: 1px; height: 100%; background: #aaa; }' +
                '#file-list-container.resizable { resize: both; overflow: auto; }' +
                '.sort-button { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0; font-size: 12px; }' +
                '.sort-button:focus { outline: none; }' +
                '#status-bar { margin-top: 10px; padding: 10px; background-color: #f9f9f9; border: 1px solid #ccc; min-height: 40px; display: flex; align-items: center; justify-content: space-between; }' +
                '#status-info { font-weight: bold; display: flex; align-items: center; }' +
                '#status-progress { width: 50%; }' +
                '.cbi-progressbar { width: 100%; background-color: #e0e0e0; border-radius: 5px; overflow: hidden; height: 10px; }' +
                '.cbi-progressbar div { height: 100%; background-color: #76c7c0; width: 0%; transition: width 0.2s; }'+
                '.file-manager-header { display: flex; align-items: center; }' +
                '.file-manager-header h2 { margin: 0; }' +
                '.file-manager-header input { margin-left: 10px; width: 100%; max-width: 700px; font-size: 18px; }' +
                '.file-manager-header button { margin-left: 10px; font-size: 18px; }'
            ),
            E('div', { 'class': 'cbi-tabcontainer', 'id': 'tab-group' }, [
                E('ul', { 'class': 'cbi-tabmenu' }, [
                    E('li', { 'class': 'cbi-tab cbi-tab-active', 'id': 'tab-filemanager' }, [
                        E('a', { 'href': '#', 'click': this.switchToTab.bind(this, 'filemanager') }, _('File Manager'))
                    ]),
                    E('li', { 'class': 'cbi-tab', 'id': 'tab-editor' }, [
                        E('a', { 'href': '#', 'click': this.switchToTab.bind(this, 'editor') }, _('Editor'))
                    ]),
                    E('li', { 'class': 'cbi-tab', 'id': 'tab-settings' }, [
                        E('a', { 'href': '#', 'click': this.switchToTab.bind(this, 'settings') }, _('Settings'))
                    ])
                ])
            ]),
            E('div', { 'class': 'cbi-tabcontainer-content' }, [
                E('div', { 'id': 'content-filemanager', 'class': 'cbi-tab', 'style': 'display:block;' }, [
                    E('div', { 'id': 'file-list-container','class': 'resizable', 'style': 'width: ' + config.windowSizes.width + 'px; height: ' + config.windowSizes.height + 'px;' }, [
                        E('table', { 'class': 'table', 'id': 'file-table' }, [
                            E('thead', {}, [
                                E('tr', {}, [
                                    E('th', { 'data-field': 'name' }, [
                                        _('Name'),
                                        E('button', { 'class': 'sort-button', 'data-field': 'name', 'title': 'Sort by Name' }, '↕'),
                                        E('div', { 'class': 'resizer' })
                                    ]),
                                    E('th', { 'data-field': 'type' }, [
                                        _('Type'),
                                        E('button', { 'class': 'sort-button', 'data-field': 'type', 'title': 'Sort by Type' }, '↕'),
                                        E('div', { 'class': 'resizer' })
                                    ]),
                                    E('th', { 'data-field': 'size' }, [
                                        _('Size'),
                                        E('button', { 'class': 'sort-button', 'data-field': 'size', 'title': 'Sort by Size' }, '↕'),
                                        E('div', { 'class': 'resizer' })
                                    ]),
                                    E('th', { 'data-field': 'mtime' }, [
                                        _('Last Modified'),
                                        E('button', { 'class': 'sort-button', 'data-field': 'mtime', 'title': 'Sort by Last Modified' }, '↕'),
                                        E('div', { 'class': 'resizer' })
                                    ]),
                                    E('th', {}, _('Actions'))
                                ])
                            ]),
                            E('tbody', { 'id': 'file-list' })
                        ])
                    ]),
                    E('div', { 'id': 'status-bar' }, [
                        E('div', { 'id': 'status-info' }, _('No file selected.')),
                        E('div', { 'id': 'status-progress' })
                    ]),
                    E('div', { 'class': 'cbi-page-actions' }, [
                        E('button', { 'class': 'btn action-button', 'click': this.handleUploadClick.bind(this) }, _('Upload File')),
                        E('button', { 'class': 'btn action-button', 'click': this.handleMakeDirectoryClick.bind(this) }, _('Make Directory')),
                        E('button', { 'class': 'btn action-button', 'click': this.handleCreateFileClick.bind(this) }, _('Create File')) // Новая кнопка
                    ])
                ]),
                E('div', { 'id': 'content-editor', 'class': 'cbi-tab', 'style': 'display:none;' }, [
                    E('p', {}, _('Select a file from the list to edit it here.')),
                    E('div', { 'id': 'editor-container' })
                ]),
                E('div', { 'id': 'content-settings', 'class': 'cbi-tab', 'style': 'display:none;' }, [
                    E('div', { 'style': 'margin-top: 20px;' }, [
                        E('h3', {}, _('Interface Settings')),
                        E('div', { 'id': 'settings-container' }, [
                            E('form', { 'id': 'settings-form' }, [
                                E('div', {}, [
                                    E('label', {}, _('Window Width:')),
                                    E('input', {
                                        'type': 'number',
                                        'id': 'window-width-input',
                                        'value': config.windowSizes.width,
                                        'style': 'width:100%; margin-bottom:10px;'
                                    })
                                ]),
                                E('div', {}, [
                                    E('label', {}, _('Window Height:')),
                                    E('input', {
                                        'type': 'number',
                                        'id': 'window-height-input',
                                        'value': config.windowSizes.height,
                                        'style': 'width:100%; margin-bottom:10px;'
                                    })
                                ]),
                                E('div', {}, [
                                    E('label', {}, _('Column Widths (format: name:width,type:width,...):')),
                                    E('input', {
                                        'type': 'text',
                                        'id': 'column-widths-input',
                                        'value': Object.keys(config.columnWidths).map(function(field) {
                                            return field + ':' + config.columnWidths[field];
                                        }).join(','),
                                        'style': 'width:100%; margin-bottom:10px;'
                                    })
                                ]),
                                E('div', {}, [
                                    E('label', {}, _('Column Min Widths (format: name:minWidth,type:minWidth,...):')),
                                    E('input', {
                                        'type': 'text',
                                        'id': 'column-min-widths-input',
                                        'value': Object.keys(config.columnMinWidths).map(function(field) {
                                            return field + ':' + config.columnMinWidths[field];
                                        }).join(','),
                                        'style': 'width:100%; margin-bottom:10px;'
                                    })
                                ]),
                                E('div', {}, [
                                    E('label', {}, _('Column Max Widths (format: name:maxWidth,type:maxWidth,...):')),
                                    E('input', {
                                        'type': 'text',
                                        'id': 'column-max-widths-input',
                                        'value': Object.keys(config.columnMaxWidths).map(function(field) {
                                            return field + ':' + config.columnMaxWidths[field];
                                        }).join(','),
                                        'style': 'width:100%; margin-bottom:10px;'
                                    })
                                ]),
                                E('div', {}, [
                                    E('label', {}, _('Padding:')),
                                    E('input', {
                                        'type': 'number',
                                        'id': 'padding-input',
                                        'value': config.padding,
                                        'style': 'width:100%; margin-bottom:10px;'
                                    })
                                ]),
                                E('div', {}, [
                                    E('label', {}, _('Padding Min:')),
                                    E('input', {
                                        'type': 'number',
                                        'id': 'padding-min-input',
                                        'value': config.paddingMin,
                                        'style': 'width:100%; margin-bottom:10px;'
                                    })
                                ]),
                                E('div', {}, [
                                    E('label', {}, _('Padding Max:')),
                                    E('input', {
                                        'type': 'number',
                                        'id': 'padding-max-input',
                                        'value': config.paddingMax,
                                        'style': 'width:100%; margin-bottom:10px;'
                                    })
                                ]),
                                E('div', {}, [ // Added current directory input field
                                    E('label', {}, _('Current Directory:')),
                                    E('input', {
                                        'type': 'text',
                                        'id': 'current-directory-input',
                                        'value': config.currentDirectory,
                                        'style': 'width:100%; margin-bottom:10px;'
                                    })
                                ]),
                                // Add other settings fields here
                                E('div', { 'class': 'cbi-page-actions' }, [
                                    E('button', {
                                        'class': 'btn cbi-button-save custom-save-button',
                                        'click': this.handleSaveSettings.bind(this)
                                    }, _('Save'))
                                ])
                            ])
                        ])
                    ])
                ])
            ])
        ]);

        var sortButtons = viewContainer.querySelectorAll('.sort-button[data-field]');
        sortButtons.forEach(function(button) {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                var field = button.getAttribute('data-field');
                if (field) {
                    self.sortBy(field);
                }
            });
        });

        this.loadFileList(currentPath).then(function() {
            self.initResizableColumns();
            // Добавляем наблюдатель за изменением размера окна
            var fileListContainer = document.getElementById('file-list-container');
            if (fileListContainer && typeof ResizeObserver !== 'undefined') {
                var resizeObserver = new ResizeObserver(function(entries) {
                    for (var entry of entries) {
                        var newWidth = entry.contentRect.width;
                        var newHeight = entry.contentRect.height;
                        config.windowSizes.width = newWidth;
                        config.windowSizes.height = newHeight;
                    }
                });
                resizeObserver.observe(fileListContainer);
            }
        });
        return viewContainer;
    },
switchToTab: function(tab) {
    var fileManagerContent = document.getElementById('content-filemanager');
    var editorContent = document.getElementById('content-editor');
    var settingsContent = document.getElementById('content-settings');
    var tabFileManager = document.getElementById('tab-filemanager');
    var tabEditor = document.getElementById('tab-editor');
    var tabSettings = document.getElementById('tab-settings');

    if (fileManagerContent && editorContent && settingsContent && tabFileManager && tabEditor && tabSettings) {
        fileManagerContent.style.display = (tab === 'filemanager') ? 'block' : 'none';
        editorContent.style.display = (tab === 'editor') ? 'block' : 'none';
        settingsContent.style.display = (tab === 'settings') ? 'block' : 'none';
        tabFileManager.className = (tab === 'filemanager') ? 'cbi-tab cbi-tab-active' : 'cbi-tab';
        tabEditor.className = (tab === 'editor') ? 'cbi-tab cbi-tab-active' : 'cbi-tab';
        tabSettings.className = (tab === 'settings') ? 'cbi-tab cbi-tab-active' : 'cbi-tab';

        if (tab === 'settings') {
            this.loadSettings(); // Загружаем настройки при переходе на закладку
        }
    }
},
handleGoButtonClick: function() {
    var self = this;
    var pathInput = document.getElementById('path-input');
    if (pathInput) {
        var newPath = pathInput.value.trim() || '/';
        // Проверяем, существует ли путь и является ли он директорией
        fs.stat(newPath).then(function(stat) {
            if (stat.type === 'directory') {
                currentPath = newPath;
                pathInput.value = currentPath;
                self.loadFileList(currentPath).then(function() {
                    self.initResizableColumns();
                });
            } else {
                ui.addNotification(null, E('p', _('Указанный путь не является директорией.')), 'error');
            }
        }).catch(function(err) {
            ui.addNotification(null, E('p', _('Не удалось получить доступ к указанному пути: %s').format(err.message)), 'error');
        });
    }
},
    handleUploadClick: function(ev) {
        var self = this;
        var directoryPath = currentPath;

        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';

        document.body.appendChild(fileInput);

        fileInput.onchange = function(event) {
            var file = event.target.files[0];

            if (!file) {
                ui.addNotification(null, E('p', _('No file selected.')), 'error');
                return;
            }

            var fullFilePath = joinPath(directoryPath, file.name);

            var statusInfo = document.getElementById('status-info');
            var statusProgress = document.getElementById('status-progress');

            if (statusInfo) {
                statusInfo.textContent = _('Uploading: ') + file.name;
            }
            if (statusProgress) {
                statusProgress.innerHTML = '';
                var progressBarContainer = E('div', { 'class': 'cbi-progressbar', 'title': '0%' }, [
                    E('div', { 'style': 'width:0%' })
                ]);
                statusProgress.appendChild(progressBarContainer);
            }

            uploadFile(fullFilePath, file, function(percent) {
                if (statusProgress) {
                    var progressBar = statusProgress.querySelector('.cbi-progressbar div');
                    if (progressBar) {
                        progressBar.style.width = percent.toFixed(2) + '%';
                        statusProgress.querySelector('.cbi-progressbar').setAttribute('title', percent.toFixed(2) + '%');
                    }
                }
            }).then(function() {
                if (statusProgress) {
                    statusProgress.innerHTML = '';
                }
                if (statusInfo) {
                    statusInfo.textContent = _('File uploaded successfully: ') + file.name;
                }
                ui.addNotification(null, E('p', _('File uploaded successfully.')), 'info');
                self.loadFileList(currentPath).then(function() {
                    self.initResizableColumns();
                });
            }).catch(function(err) {
                if (statusProgress) {
                    statusProgress.innerHTML = '';
                }
                if (statusInfo) {
                    statusInfo.textContent = _('Upload failed: ') + err.message;
                }
                ui.addNotification(null, E('p', _('Upload failed: ') + err.message), 'error');
            });
        };

        fileInput.click();
    },
    handleMakeDirectoryClick: function(ev) {
        var self = this;
        var statusInfo = document.getElementById('status-info');
        var statusProgress = document.getElementById('status-progress');

        if (statusInfo && statusProgress) {
            statusInfo.innerHTML = '';
            statusProgress.innerHTML = '';

            var dirNameInput = E('input', {
                'type': 'text',
                'placeholder': _('Directory Name'),
                'style': 'margin-right: 10px;'
            });

            var saveButton = E('button', {
                'class': 'btn',
                'disabled': true,
                'click': function() {
                    self.createDirectory(dirNameInput.value);
                }
            }, _('Save'));

            dirNameInput.addEventListener('input', function() {
                if (dirNameInput.value.trim()) {
                    saveButton.disabled = false;
                } else {
                    saveButton.disabled = true;
                }
            });

            statusInfo.appendChild(E('span', {}, _('Create Directory: ')));
            statusInfo.appendChild(dirNameInput);
            statusProgress.appendChild(saveButton);
        }
    },
    createDirectory: function(dirName) {
        var self = this;
        var dirPath = joinPath(currentPath, dirName.trim());

        fs.exec('mkdir', [dirPath]).then(function(res) {
            if (res.code !== 0) {
                return Promise.reject(new Error(res.stderr.trim()));
            }

            ui.addNotification(null, E('p', _('Directory created successfully.')), 'info');
            self.loadFileList(currentPath).then(function() {
                self.initResizableColumns();
            });

            var statusInfo = document.getElementById('status-info');
            var statusProgress = document.getElementById('status-progress');
            if (statusInfo) statusInfo.textContent = _('No file selected.');
            if (statusProgress) statusProgress.innerHTML = '';
        }).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to create directory: %s').format(err.message)), 'error');
        });
    },
    handleCreateFileClick: function(ev) { // Новый метод
        var self = this;
        var statusInfo = document.getElementById('status-info');
        var statusProgress = document.getElementById('status-progress');

        if (statusInfo && statusProgress) {
            // Очистка предыдущих уведомлений
            statusInfo.innerHTML = '';
            statusProgress.innerHTML = '';

            // Создание поля ввода для имени файла
            var fileNameInput = E('input', {
                'type': 'text',
                'placeholder': _('File Name'),
                'style': 'margin-right: 10px;'
            });

            // Создание кнопки "Создать"
            var createButton = E('button', {
                'class': 'btn',
                'disabled': true,
                'click': function() {
                    self.createFile(fileNameInput.value);
                }
            }, _('Create'));

            // Включение кнопки при вводе имени файла
            fileNameInput.addEventListener('input', function() {
                if (fileNameInput.value.trim()) {
                    createButton.disabled = false;
                } else {
                    createButton.disabled = true;
                }
            });

            // Добавление элементов в интерфейс
            statusInfo.appendChild(E('span', {}, _('Create File: ')));
            statusInfo.appendChild(fileNameInput);
            statusProgress.appendChild(createButton);
        }
    },
    createFile: function(fileName) { // Новый метод
        var self = this;
        var filePath = joinPath(currentPath, fileName.trim());

        fs.exec('touch', [filePath]).then(function(res) {
            if (res.code !== 0) {
                return Promise.reject(new Error(res.stderr.trim()));
            }

            ui.addNotification(null, E('p', _('File created successfully.')), 'info');
            self.loadFileList(currentPath).then(function() {
                self.initResizableColumns();
            });

            // Очистка уведомлений
            var statusInfo = document.getElementById('status-info');
            var statusProgress = document.getElementById('status-progress');
            if (statusInfo) statusInfo.textContent = _('No file selected.');
            if (statusProgress) statusProgress.innerHTML = '';
        }).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to create file: %s').format(err.message)), 'error');
        });
    },
    loadFileList: function(path) {
        var self = this;
        return getFileList(path).then(function(files) {
            var fileList = document.getElementById('file-list');
            if (!fileList) {
                ui.addNotification(null, E('p', _('Failed to find the file list container.')), 'error');
                return;
            }
            fileList.innerHTML = '';
            files.sort(self.compareFiles.bind(self));

            if (path !== '/') {
                var parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
                var listItemUp = E('tr', { 'data-file-path': parentPath, 'data-file-type': 'directory' }, [
                    E('td', { 'colspan': 5 }, [
                        E('a', { 'href': '#', 'click': function() { self.handleDirectoryClick(parentPath); } }, '.. (Parent Directory)')
                    ])
                ]);
                fileList.appendChild(listItemUp);
            }

            files.forEach(function(file) {
                var listItem;
                var displaySize = (file.type === 'directory' || (file.type === 'symlink' && file.size === -1)) ? -1 : file.size;

                if (file.type === 'directory') {
                    listItem = E('tr', {
                        'data-file-path': joinPath(path, file.name),
                        'data-file-type': 'directory',
                        'data-permissions': file.permissions,
                        'data-numeric-permissions': file.numericPermissions,
                        'data-owner': file.owner,
                        'data-group': file.group,
                        'data-size': -1
                    }, [
                        E('td', {}, [
                            E('a', {
                                'href': '#',
                                'style': 'color:blue;',
                                'click': function() {
                                    self.handleDirectoryClick(joinPath(path, file.name));
                                }
                            }, file.name)
                        ]),
                        E('td', {}, _('Directory')),
                        E('td', { 'class': 'size-cell' }, [
                            E('span', { 'class': 'size-number' }, '-'),
                            E('span', { 'class': 'size-unit' }, '')
                        ]),
                        E('td', {}, new Date(file.mtime * 1000).toLocaleString()),
                        E('td', {}, [
                            E('span', {
                                'class': 'edit-button',
                                'click': function() {
                                    self.handleEditFile(joinPath(path, file.name), file);
                                }
                            }, '✏️'),
                            E('span', {
                                'class': 'delete-button',
                                'click': function() {
                                    self.handleDeleteFile(joinPath(path, file.name));
                                }
                            }, '🗑️')
                        ])
                    ]);
                } else if (file.type === 'file') {
                    listItem = E('tr', {
                        'data-file-path': joinPath(path, file.name),
                        'data-file-type': 'file',
                        'data-permissions': file.permissions,
                        'data-numeric-permissions': file.numericPermissions,
                        'data-owner': file.owner,
                        'data-group': file.group,
                        'data-size': file.size
                    }, [
                        E('td', {}, [
                            E('a', {
                                'href': '#',
                                'style': 'color:black;',
                                'click': function() {
                                    self.handleFileClick(joinPath(path, file.name));
                                }
                            }, file.name)
                        ]),
                        E('td', {}, _('File')),
                        E('td', { 'class': 'size-cell' }, [
                            E('span', { 'class': 'size-number' }, self.getFormattedSize(file.size).number),
                            E('span', { 'class': 'size-unit' }, self.getFormattedSize(file.size).unit)
                        ]),
                        E('td', {}, new Date(file.mtime * 1000).toLocaleString()),
                        E('td', {}, [
                            E('span', {
                                'class': 'edit-button',
                                'click': function() {
                                    self.handleEditFile(joinPath(path, file.name), file);
                                }
                            }, '✏️'),
                            E('span', {
                                'class': 'delete-button',
                                'click': function() {
                                    self.handleDeleteFile(joinPath(path, file.name));
                                }
                            }, '🗑️'),
                            E('span', {
                                'class': 'download-button',
                                'click': function() {
                                    self.handleDownloadFile(joinPath(path, file.name));
                                }
                            }, '⬇️')
                        ])
                    ]);
                } else if (file.type === 'symlink') {
                    var symlinkName = file.name + ' -> ' + file.target;
                    var symlinkSize = (file.size === -1) ? -1 : file.size;

                    var sizeContent;
                    if (symlinkSize >= 0) {
                        var formattedSize = self.getFormattedSize(symlinkSize);
                        sizeContent = [
                            E('span', { 'class': 'size-number' }, formattedSize.number),
                            E('span', { 'class': 'size-unit' }, formattedSize.unit)
                        ];
                    } else {
                        sizeContent = [
                            E('span', { 'class': 'size-number' }, '-'),
                            E('span', { 'class': 'size-unit' }, '')
                        ];
                    }

                    listItem = E('tr', {
                        'data-file-path': joinPath(path, file.name),
                        'data-file-type': 'symlink',
                        'data-symlink-target': file.target,
                        'data-permissions': file.permissions,
                        'data-numeric-permissions': file.numericPermissions,
                        'data-owner': file.owner,
                        'data-group': file.group,
                        'data-size': symlinkSize
                    }, [
                        E('td', {}, [
                            E('a', {
                                'href': '#',
                                'class': 'symlink-name',
                                'click': function() {
                                    self.handleSymlinkClick(joinPath(path, file.name), file.target);
                                }
                            }, symlinkName)
                        ]),
                        E('td', {}, _('Symlink')),
                        E('td', { 'class': 'size-cell' }, sizeContent),
                        E('td', {}, new Date(file.mtime * 1000).toLocaleString()),
                        E('td', {}, [
                            E('span', {
                                'class': 'edit-button',
                                'click': function() {
                                    self.handleEditFile(joinPath(path, file.name), file);
                                }
                            }, '✏️'),
                            E('span', {
                                'class': 'delete-button',
                                'click': function() {
                                    self.handleDeleteFile(joinPath(path, file.name));
                                }
                            }, '🗑️')
                        ])
                    ]);
                } else {
                    listItem = E('tr', { 'data-file-path': joinPath(path, file.name), 'data-file-type': 'unknown' }, [
                        E('td', {}, file.name),
                        E('td', {}, _('Unknown')),
                        E('td', { 'class': 'size-cell' }, [
                            E('span', { 'class': 'size-number' }, '-'),
                            E('span', { 'class': 'size-unit' }, '')
                        ]),
                        E('td', {}, '-'),
                        E('td', {}, '-')
                    ]);
                }

                if (listItem && listItem instanceof Node) {
                    fileList.appendChild(listItem);
                } else {
                    console.error('listItem is not a Node:', listItem);
                }
            });

            self.setInitialColumnWidths();

            var statusInfo = document.getElementById('status-info');
            var statusProgress = document.getElementById('status-progress');
            if (statusInfo) {
                statusInfo.textContent = _('No file selected.');
            }
            if (statusProgress) {
                statusProgress.innerHTML = '';
            }

            return Promise.resolve();
        }).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to load file list: %s').format(err.message)), 'error');
            return Promise.reject(err);
        });
    },
    getFormattedSize: function(size) {
        var units = [' ', 'k', 'M', 'G'];
        var unitIndex = 0;
        var formattedSize = size;

        while (formattedSize >= 1024 && unitIndex < units.length - 1) {
            formattedSize /= 1024;
            unitIndex++;
        }

        formattedSize = formattedSize.toFixed(2);

        if (size === 0) {
            formattedSize = '0.00';
            unitIndex = 0;
        }

        formattedSize = formattedSize.toString().padStart(6, ' ');

        return {
            number: formattedSize,
            unit: ' ' + units[unitIndex] + 'B'
        };
    },
    sortBy: function(field) {
        if (sortField === field) {
            sortDirection = (sortDirection === 'asc') ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'asc';
        }
        this.loadFileList(currentPath);
    },
    compareFiles: function(a, b) {
        var order = (sortDirection === 'asc') ? 1 : -1;
        var aValue = a[sortField];
        var bValue = b[sortField];

        if (sortField === 'size') {
            aValue = (a.type === 'directory' || (a.type === 'symlink' && a.size === -1)) ? -1 : a.size;
            bValue = (b.type === 'directory' || (b.type === 'symlink' && b.size === -1)) ? -1 : b.size;
        }

        if (aValue < bValue) return -1 * order;
        if (aValue > bValue) return 1 * order;
        return 0;
    },
    setInitialColumnWidths: function() {
        var table = document.getElementById('file-table');
        if (!table) {
            return;
        }
        var headers = table.querySelectorAll('th');
        headers.forEach(function(header, index) {
            var field = header.getAttribute('data-field');
            if (field && config.columnWidths[field]) {
                var width = config.columnWidths[field];
                var minWidth = config.columnMinWidths[field] || 50;
                var maxWidth = config.columnMaxWidths[field] || 500;
                header.style.width = width + 'px';
                header.style.minWidth = minWidth + 'px';
                header.style.maxWidth = maxWidth + 'px';
                var rows = table.querySelectorAll('tr');
                rows.forEach(function(row, rowIndex) {
                    var cell = row.children[index];
                    if (cell) {
                        cell.style.width = width + 'px';
                        cell.style.minWidth = minWidth + 'px';
                        cell.style.maxWidth = maxWidth + 'px';
                    }
                });
            }
        });
    },
handleDirectoryClick: function(newPath) {
    var self = this;
    currentPath = newPath || '/';
    var pathInput = document.getElementById('path-input');
    if (pathInput) {
        pathInput.value = currentPath;
    }
    this.loadFileList(currentPath).then(function() {
        self.initResizableColumns();
    });
},
handleFileClick: function(filePath) {
    var self = this;
    var fileRow = document.querySelector("tr[data-file-path='" + filePath + "']");
    if (fileRow) {
        // Получение сохраненных прав доступа
        var permissions = fileRow.getAttribute('data-numeric-permissions');
        self.originalFilePermissions = permissions;
    } else {
        // По умолчанию 644, если права доступа не найдены
        self.originalFilePermissions = '644';
    }

    // Используем fs.exec с командой 'cat' для чтения файла
    fs.exec('cat', [filePath]).then(function(res) {
        if (res.code !== 0) {
            // Если код возврата не 0, проверяем, является ли файл пустым
            if (res.stderr.trim() === '') {
                // Файл пустой, продолжаем с пустым содержимым
                var content = '';
            } else {
                // Другие ошибки
                return Promise.reject(new Error(res.stderr.trim()));
            }
        } else {
            var content = res.stdout || '';
        }

        var editorContainer = document.getElementById('editor-container');
        if (!editorContainer) {
            ui.addNotification(null, E('p', _('Editor container not found.')), 'error');
            return;
        }
        editorContainer.innerHTML = '';
        var editor = E('div', {}, [
            E('h3', {}, _('Editing: ') + filePath),
            E('textarea', {
                'wrap': 'off',
                'style': 'width:100%;',
                'rows': 20
            }, [content]),
            E('div', { 'class': 'cbi-page-actions' }, [
                E('button', {
                    'class': 'btn cbi-button-save custom-save-button',
                    'click': function() { self.handleSaveFile(filePath); }
                }, _('Save'))
            ])
        ]);
        editorContainer.appendChild(editor);
        self.switchToTab('editor');

        var statusInfo = document.getElementById('status-info');
        if (statusInfo) {
            statusInfo.textContent = _('Editing: ') + filePath;
        }
        var statusProgress = document.getElementById('status-progress');
        if (statusProgress) {
            statusProgress.innerHTML = '';
        }
    }).catch(function(err) {
        ui.addNotification(null, E('p', _('Failed to open file: %s').format(err.message)), 'error');
    });
},
    handleDownloadFile: function(filePath) {
        var self = this;
        fs.read(filePath, { binary: true }).then(function(content) {
            var blob = new Blob([content], { type: 'application/octet-stream' });
            var downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = filePath.split('/').pop();
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            var statusInfo = document.getElementById('status-info');
            if (statusInfo) {
                statusInfo.textContent = _('Downloaded: ') + filePath.split('/').pop();
            }
        }).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to download file: %s').format(err.message)), 'error');
        });
    },
    handleDeleteFile: function(filePath) {
        var self = this;
        if (confirm(_('Are you sure you want to delete this file or directory?'))) {
            fs.remove(filePath).then(function() {
                ui.addNotification(null, E('p', _('File or directory deleted successfully.')), 'info');
                self.loadFileList(currentPath).then(function() {
                    self.initResizableColumns();
                });

                var statusInfo = document.getElementById('status-info');
                if (statusInfo) {
                    statusInfo.textContent = _('Deleted: ') + filePath.split('/').pop();
                }
            }).catch(function(err) {
                ui.addNotification(null, E('p', _('Failed to delete file or directory: %s').format(err.message)), 'error');
            });
        }
    },
    handleSaveFile: function(filePath) {
        var self = this;
        var textarea = document.querySelector('#editor-container textarea');
        if (!textarea) {
            ui.addNotification(null, E('p', _('Editor textarea not found.')), 'error');
            return;
        }
        var content = textarea.value;

        var blob = new Blob([content], { type: 'text/plain' });

        var statusInfo = document.getElementById('status-info');
        var statusProgress = document.getElementById('status-progress');

        if (statusInfo) {
            statusInfo.textContent = _('Saving: ') + filePath;
        }
        if (statusProgress) {
            statusProgress.innerHTML = '';
            var progressBarContainer = E('div', { 'class': 'cbi-progressbar', 'title': '0%' }, [
                E('div', { 'style': 'width:0%' })
            ]);
            statusProgress.appendChild(progressBarContainer);
        }

        uploadFile(filePath, blob, function(percent) {
            if (statusProgress) {
                var progressBar = statusProgress.querySelector('.cbi-progressbar div');
                if (progressBar) {
                    progressBar.style.width = percent.toFixed(2) + '%';
                    statusProgress.querySelector('.cbi-progressbar').setAttribute('title', percent.toFixed(2) + '%');
                }
            }
        }).then(function() {
            // File uploaded successfully, now restore original permissions
            var permissions = self.originalFilePermissions;
            if (permissions !== undefined) {
                return fs.exec('chmod', [permissions, filePath]).then(function(res) {
                    if (res.code !== 0) {
                        throw new Error(res.stderr.trim());
                    }
                }).then(function() {
                    if (statusInfo) {
                        statusInfo.textContent = _('File saved successfully: ') + filePath;
                    }
                    ui.addNotification(null, E('p', _('File saved successfully.')), 'info');
                    return self.loadFileList(currentPath).then(function() {
                        self.initResizableColumns();
                    });
                }).then(function() {
                    // Reset the stored permissions
                    self.originalFilePermissions = undefined;
                }).catch(function(err) {
                    ui.addNotification(null, E('p', _('Failed to restore file permissions: %s').format(err.message)), 'error');
                });
            } else {
                if (statusInfo) {
                    statusInfo.textContent = _('File saved successfully: ') + filePath;
                }
                ui.addNotification(null, E('p', _('File saved successfully.')), 'info');
                return self.loadFileList(currentPath).then(function() {
                    self.initResizableColumns();
                });
            }
        }).catch(function(err) {
            if (statusProgress) {
                statusProgress.innerHTML = '';
            }
            if (statusInfo) {
                statusInfo.textContent = _('Save failed: ') + err.message;
            }
            ui.addNotification(null, E('p', _('Save failed: ') + err.message), 'error');
        });
    },
    handleSymlinkClick: function(linkPath, targetPath) {
        var self = this;
        if (!targetPath.startsWith('/')) {
            targetPath = joinPath(currentPath, targetPath);
        }
        fs.stat(targetPath).then(function(stat) {
            if (stat.type === 'directory') {
                self.handleDirectoryClick(targetPath);
            } else if (stat.type === 'file') {
                self.handleFileClick(targetPath);
            } else {
                ui.addNotification(null, E('p', _('The symlink points to an unsupported type.')), 'error');
            }
        }).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to access symlink target: %s').format(err.message)), 'error');
        });

        var statusInfo = document.getElementById('status-info');
        if (statusInfo) {
            statusInfo.textContent = _('Symlink: ') + linkPath + ' -> ' + targetPath;
        }
    },
    initResizableColumns: function() {
        var self = this;
        var table = document.getElementById('file-table');
        if (!table) {
            return;
        }
        var headers = table.querySelectorAll('th');
        headers.forEach(function(header, index) {
            var resizer = header.querySelector('.resizer');
            if (resizer) {
                resizer.removeEventListener('mousedown', header.resizeHandler);
                header.resizeHandler = function(e) {
                    e.preventDefault();
                    var startX = e.pageX;
                    var startWidth = header.offsetWidth;
                    var field = header.getAttribute('data-field');
                    var minWidth = config.columnMinWidths[field] || 50;
                    var maxWidth = config.columnMaxWidths[field] || 500;

                    function doDrag(e) {
                        var currentX = e.pageX;
                        var newWidth = startWidth + (currentX - startX);
                        if (newWidth >= minWidth && newWidth <= maxWidth) {
                            header.style.width = newWidth + 'px';
                            if (field) {
                                config.columnWidths[field] = newWidth;
                            }
                            var rows = table.querySelectorAll('tr');
                            rows.forEach(function(row, rowIndex) {
                                var cell = row.children[index];
                                if (cell) {
                                    cell.style.width = newWidth + 'px';
                                }
                            });
                        }
                    }

                    function stopDrag() {
                        document.removeEventListener('mousemove', doDrag, false);
                        document.removeEventListener('mouseup', stopDrag, false);
                        saveConfig(); // Save the new widths
                    }

                    document.addEventListener('mousemove', doDrag, false);
                    document.addEventListener('mouseup', stopDrag, false);
                };
                resizer.addEventListener('mousedown', header.resizeHandler, false);
            }
        });
    },
    handleEditFile: function(filePath, fileInfo) {
        var self = this;

        var statusInfo = document.getElementById('status-info');
        var statusProgress = document.getElementById('status-progress');

        if (statusInfo && statusProgress) {
            statusInfo.innerHTML = '';
            statusProgress.innerHTML = '';

            var nameInput = E('input', {
                'type': 'text',
                'value': fileInfo.name,
                'placeholder': fileInfo.name,
                'style': 'margin-right: 10px;'
            });
            var permsInput = E('input', {
                'type': 'text',
                'placeholder': fileInfo.numericPermissions,
                'style': 'margin-right: 10px; width: 80px;'
            });
            var ownerInput = E('input', {
                'type': 'text',
                'placeholder': fileInfo.owner,
                'style': 'margin-right: 10px; width: 100px;'
            });
            var groupInput = E('input', {
                'type': 'text',
                'placeholder': fileInfo.group,
                'style': 'margin-right: 10px; width: 100px;'
            });

            var saveButton = E('button', {
                'class': 'btn',
                'disabled': true,
                'click': function() {
                    self.saveFileChanges(filePath, fileInfo, nameInput.value, permsInput.value, ownerInput.value, groupInput.value);
                }
            }, _('Save'));

            [nameInput, permsInput, ownerInput, groupInput].forEach(function(input) {
                input.addEventListener('input', function() {
                    if (nameInput.value !== fileInfo.name || permsInput.value || ownerInput.value || groupInput.value) {
                        saveButton.disabled = false;
                    } else {
                        saveButton.disabled = true;
                    }
                });
            });

            statusInfo.appendChild(E('span', {}, _('Editing: ')));
            statusInfo.appendChild(nameInput);
            statusInfo.appendChild(permsInput);
            statusInfo.appendChild(ownerInput);
            statusInfo.appendChild(groupInput);
            statusProgress.appendChild(saveButton);
        }
    },
    saveFileChanges: function(filePath, fileInfo, newName, newPerms, newOwner, newGroup) {
        var self = this;
        var commands = [];

        var originalPath = filePath;

        if (newName && newName !== fileInfo.name) {
            var newPath = joinPath(currentPath, newName);
            commands.push(['mv', [filePath, newPath]]);
            filePath = newPath;
        }

        if (newPerms) {
            commands.push(['chmod', [newPerms, filePath]]);
        }

        if (newOwner || newGroup) {
            var ownerGroup = '';
            if (newOwner) {
                ownerGroup += newOwner;
            } else {
                ownerGroup += fileInfo.owner;
            }
            ownerGroup += ':';
            if (newGroup) {
                ownerGroup += newGroup;
            } else {
                ownerGroup += fileInfo.group;
            }
            commands.push(['chown', [ownerGroup, filePath]]);
        }

        var promise = Promise.resolve();
        commands.forEach(function(cmd) {
            promise = promise.then(function() {
                return fs.exec(cmd[0], cmd[1]).then(function(res) {
                    if (res.code !== 0) {
                        return Promise.reject(new Error(res.stderr.trim()));
                    }
                });
            });
        });

        promise.then(function() {
            ui.addNotification(null, E('p', _('Changes saved successfully.')), 'info');
            self.loadFileList(currentPath).then(function() {
                self.initResizableColumns();
            });

            var statusInfo = document.getElementById('status-info');
            var statusProgress = document.getElementById('status-progress');
            if (statusInfo) statusInfo.textContent = _('No file selected.');
            if (statusProgress) statusProgress.innerHTML = '';
        }).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to save changes: %s').format(err.message)), 'error');
        });
    },
handleSaveSettings: function(ev) {
    ev.preventDefault();
    var self = this;

    var columnWidthsInput = document.getElementById('column-widths-input');
    var columnMinWidthsInput = document.getElementById('column-min-widths-input');
    var columnMaxWidthsInput = document.getElementById('column-max-widths-input');
    var paddingInput = document.getElementById('padding-input');
    var paddingMinInput = document.getElementById('padding-min-input');
    var paddingMaxInput = document.getElementById('padding-max-input');
    var currentDirectoryInput = document.getElementById('current-directory-input'); // Get the current directory input
    var windowWidthInput = document.getElementById('window-width-input');
    var windowHeightInput = document.getElementById('window-height-input');

    if (columnWidthsInput && paddingInput) {
        var columnWidthsValue = columnWidthsInput.value.trim();
        var columnMinWidthsValue = columnMinWidthsInput.value.trim();
        var columnMaxWidthsValue = columnMaxWidthsInput.value.trim();
        var paddingValue = parseInt(paddingInput.value.trim(), 10);
        var paddingMinValue = parseInt(paddingMinInput.value.trim(), 10);
        var paddingMaxValue = parseInt(paddingMaxInput.value.trim(), 10);

        if (columnWidthsValue) {
            var widths = columnWidthsValue.split(',');
            widths.forEach(function(widthStr) {
                var widthParts = widthStr.split(':');
                if (widthParts.length === 2) {
                    var field = widthParts[0];
                    var width = parseInt(widthParts[1], 10);
                    if (!isNaN(width)) {
                        config.columnWidths[field] = width;
                    }
                }
            });
        }

        if (columnMinWidthsValue) {
            var minWidths = columnMinWidthsValue.split(',');
            minWidths.forEach(function(widthStr) {
                var widthParts = widthStr.split(':');
                if (widthParts.length === 2) {
                    var field = widthParts[0];
                    var minWidth = parseInt(widthParts[1], 10);
                    if (!isNaN(minWidth)) {
                        config.columnMinWidths[field] = minWidth;
                    }
                }
            });
        }

        if (columnMaxWidthsValue) {
            var maxWidths = columnMaxWidthsValue.split(',');
            maxWidths.forEach(function(widthStr) {
                var widthParts = widthStr.split(':');
                if (widthParts.length === 2) {
                    var field = widthParts[0];
                    var maxWidth = parseInt(widthParts[1], 10);
                    if (!isNaN(maxWidth)) {
                        config.columnMaxWidths[field] = maxWidth;
                    }
                }
            });
        }

        if (!isNaN(paddingValue)) {
            config.padding = paddingValue;
        }
        if (!isNaN(paddingMinValue)) {
            config.paddingMin = paddingMinValue;
        }
        if (!isNaN(paddingMaxValue)) {
            config.paddingMax = paddingMaxValue;
        }

        if (currentDirectoryInput) { // Update currentDirectory in config
            var currentDirectoryValue = currentDirectoryInput.value.trim();
            if (currentDirectoryValue) {
                config.currentDirectory = currentDirectoryValue;
            }
        }

        if (windowWidthInput && windowHeightInput) {
            var windowWidthValue = parseInt(windowWidthInput.value.trim(), 10);
            var windowHeightValue = parseInt(windowHeightInput.value.trim(), 10);

            if (!isNaN(windowWidthValue)) {
                config.windowSizes.width = windowWidthValue;
            }
            if (!isNaN(windowHeightValue)) {
                config.windowSizes.height = windowHeightValue;
            }
        }

        saveConfig().then(function() {
            ui.addNotification(null, E('p', _('Settings saved successfully.')), 'info');
            self.setInitialColumnWidths();
            // Update styles that depend on padding
            var styleElement = document.querySelector('style');
            if (styleElement) {
                styleElement.textContent = styleElement.textContent.replace(/padding: \d+px/g, 'padding: ' + config.padding + 'px');
            }
            // Update window sizes
            var fileListContainer = document.getElementById('file-list-container');
            if (fileListContainer) {
                fileListContainer.style.width = config.windowSizes.width + 'px';
                fileListContainer.style.height = config.windowSizes.height + 'px';
            }
            // Reload the file list with the new current directory
            currentPath = config.currentDirectory || '/';
            var pathInput = document.getElementById('path-input');
            if (pathInput) {
                pathInput.value = currentPath;
            }
            self.loadFileList(currentPath).then(function() {
                self.initResizableColumns();
            });
        }).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to save settings: %s').format(err.message)), 'error');
        });
    }
},

loadSettings: function() {
    var columnWidthsInput = document.getElementById('column-widths-input');
    var columnMinWidthsInput = document.getElementById('column-min-widths-input');
    var columnMaxWidthsInput = document.getElementById('column-max-widths-input');
    var paddingInput = document.getElementById('padding-input');
    var paddingMinInput = document.getElementById('padding-min-input');
    var paddingMaxInput = document.getElementById('padding-max-input');
    var currentDirectoryInput = document.getElementById('current-directory-input'); // Получаем поле ввода для текущей директории
    var windowWidthInput = document.getElementById('window-width-input');
    var windowHeightInput = document.getElementById('window-height-input');

    if (columnWidthsInput && paddingInput) {
        columnWidthsInput.value = Object.keys(config.columnWidths).map(function(field) {
            return field + ':' + config.columnWidths[field];
        }).join(',');
        columnMinWidthsInput.value = Object.keys(config.columnMinWidths).map(function(field) {
            return field + ':' + config.columnMinWidths[field];
        }).join(',');
        columnMaxWidthsInput.value = Object.keys(config.columnMaxWidths).map(function(field) {
            return field + ':' + config.columnMaxWidths[field];
        }).join(',');
        paddingInput.value = config.padding;
        paddingMinInput.value = config.paddingMin;
        paddingMaxInput.value = config.paddingMax;
        if (currentDirectoryInput) {
            currentDirectoryInput.value = currentPath; // Устанавливаем значение текущей директории
        }
        if (windowWidthInput && windowHeightInput) {
            windowWidthInput.value = config.windowSizes.width;
            windowHeightInput.value = config.windowSizes.height;
        }
    }
}

});
