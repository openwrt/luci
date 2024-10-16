'use strict';
'require view';
'require fs';
'require ui';
'require dom';

var currentPath = '/';  // Изначально корневой каталог
var sortField = 'name';  // Поле для сортировки по умолчанию
var sortDirection = 'asc';  // Направление сортировки по умолчанию (asc - по возрастанию)

return view.extend({
    load: function() {
        return fs.list(currentPath);  // Загрузить список файлов в текущем каталоге
    },

    render: function(data) {
        var files = data;

        // Создаем контейнер для вкладок
        var viewContainer = E('div', {}, [
            E('h2', {}, _('File Browser: ') + currentPath),
            E('style', {}, 
                /* Скрываем встроенные кнопки Apply, Reset и ненужную кнопку Save */
                '.cbi-button-apply, .cbi-button-reset, .cbi-button-save:not(.custom-save-button) { display: none !important; }' +
                /* Убираем фон и границы под кнопками, но оставляем сами кнопки, добавляем отступы */
                '.cbi-page-actions { background: none !important; border: none !important; padding: 10px 0 !important; margin: 0 !important; }' +
               /* Убираем контуры и фон элемента cbi-tabmenu */
                '.cbi-tabmenu { background: none !important; border: none !important; height: 0 !important; margin: 0 !important; padding: 0 !important; }' +
                /* Добавляем отступ для области прокрутки */
                '#file-list-container { margin-top: 30px !important; max-height: 400px; overflow-y: auto; }' +
                /* Добавляем отступ для редактора */
                '#content-editor { margin-top: 30px !important; }' +
                /* Делаем размер редактора по вертикали динамическим */
                '#editor-container textarea { height: calc(100vh - 300px) !important; max-height: 500px !important; width: 100% !important; }' +
                /* Выровнять заголовки колонок по левому краю */
                'th { text-align: left !important; }' +
                /* Выровнять содержимое ячеек по левому краю, если это необходимо */
                'td { text-align: left !important; }' +
                /* Подсвечиваем всю строку при наведении курсора */
                'tr:hover { background-color: #f0f0f0 !important; }' +
                /* Закрепляем заголовки колонок при прокрутке */
                'thead th { position: sticky; top: 0; background-color: #fff; z-index: 1; }' +
                 /* Стили для кнопок действий */
                '.download-button { color: green; cursor: pointer; margin-left: 5px; }' +
                '.delete-button { color: red; cursor: pointer; margin-left: 5px; }' +
                /* Стиль для символических ссылок */
                '.symlink { color: green; }' +
                /* Область прокрутки для списка файлов */
                '#file-list-container { max-height: 400px; overflow-y: auto; }' +
                'th { cursor: pointer; }' +
                /* Кнопки Upload */
                '.action-button { margin-right: 10px; cursor: pointer; }'
            ),
            E('div', {
                'class': 'cbi-tabcontainer',
                'id': 'tab-group'
            }, [
                E('ul', { 'class': 'cbi-tabmenu' }, [
                    E('li', { 'class': 'cbi-tab cbi-tab-active', 'id': 'tab-filebrowser' }, [
                        E('a', { 'href': '#', 'click': this.switchToTab.bind(this, 'filebrowser') }, _('File Browser'))
                    ]),
                    E('li', { 'class': 'cbi-tab', 'id': 'tab-editor' }, [
                        E('a', { 'href': '#', 'click': this.switchToTab.bind(this, 'editor') }, _('Editor'))
                    ])
                ]),
                E('div', { 'class': 'cbi-tabcontainer-content' }, [
                    E('div', { 'id': 'content-filebrowser', 'class': 'cbi-tab', 'style': 'display:block;' }, [
                        // Область прокрутки для таблицы файлов
                        E('div', { 'id': 'file-list-container' }, [
                            E('table', { 'class': 'table' }, [
                                E('thead', {}, [
                                    E('tr', {}, [
                                        E('th', { 'click': this.sortBy.bind(this, 'name') }, _('Name')),
                                        E('th', { 'click': this.sortBy.bind(this, 'type') }, _('Type')),
                                        E('th', { 'click': this.sortBy.bind(this, 'size') }, _('Size')),
                                        E('th', { 'click': this.sortBy.bind(this, 'mtime') }, _('Last Modified')),
                                        E('th', {}, _('Actions'))
                                    ])
                                ]),
                                E('tbody', { 'id': 'file-list' })
                            ])
                        ]),
                        // Область действий: Upload
                        E('div', { 'class': 'cbi-page-actions' }, [
                            E('button', { 
                                'class': 'btn action-button',
                                'click': this.handleUploadClick.bind(this) 
                            }, _('Upload File'))
                        ])
                    ]),
                    E('div', { 'id': 'content-editor', 'class': 'cbi-tab', 'style': 'display:none;' }, [
                        E('p', {}, _('Select a file from the list to edit it here.')),
                        E('div', { 'id': 'editor-container' })  // Здесь будет редактор файлов
                    ])
                ])
            ])
        ]);

        this.loadFileList(currentPath);

        ui.tabs.initTabGroup(viewContainer.lastElementChild.childNodes);
        return viewContainer;
    },

    switchToTab: function(tab) {
        document.getElementById('content-filebrowser').style.display = (tab === 'filebrowser') ? 'block' : 'none';
        document.getElementById('content-editor').style.display = (tab === 'editor') ? 'block' : 'none';

        document.getElementById('tab-filebrowser').classList.toggle('cbi-tab-active', tab === 'filebrowser');
        document.getElementById('tab-editor').classList.toggle('cbi-tab-active', tab === 'editor');
    },

    handleUploadClick: function(ev) {
        var uploadInput = document.getElementById('file-upload');
        if (!uploadInput) {
            uploadInput = document.createElement('input');
            uploadInput.type = 'file';
            uploadInput.style.display = 'none';
            uploadInput.id = 'file-upload';
            document.body.appendChild(uploadInput);
        }

        uploadInput.click();

        uploadInput.onchange = function() {
            var file = uploadInput.files[0];
            if (file) {
                // Проверка размера файла (например, 10 MB)
                var maxFileSize = 10 * 1024 * 1024; // 10 MB
                if (file.size > maxFileSize) {
                    ui.addNotification(null, E('p', _('File size exceeds the maximum allowed size of 10 MB.')), 'error');
                    return;
                }

                var reader = new FileReader();
                reader.onload = function(e) {
                    var content = e.target.result;
                    var filePath = currentPath.endsWith('/') ? currentPath + file.name : currentPath + '/' + file.name;

                    // Используем fs.write для записи файла
                    fs.write(filePath, content).then(function() {
                        ui.addNotification(null, E('p', _('File uploaded successfully.')), 'info');
                        this.loadFileList(currentPath);
                    }.bind(this)).catch(function(err) {
                        ui.addNotification(null, E('p', _('Failed to upload file: %s').format(err.message)));
                    });
                }.bind(this);
                reader.onerror = function() {
                    ui.addNotification(null, E('p', _('Failed to read the file.')));
                };
                reader.readAsText(file);  // Используем readAsText для текстовых файлов
            }
        }.bind(this);
    },

    loadFileList: function(path) {
        fs.list(path).then(function(files) {
            var fileList = document.getElementById('file-list');
            fileList.innerHTML = '';

            // Сортировка файлов
            files.sort(this.compareFiles.bind(this));

            if (path !== '/') {
                var parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
                var listItemUp = E('tr', {}, [
                    E('td', { colspan: 5 }, [
                        E('a', {
                            'href': '#',
                            'click': function() {
                                this.handleDirectoryClick(parentPath);
                            }.bind(this)
                        }, '.. (Parent Directory)')
                    ])
                ]);
                fileList.appendChild(listItemUp);
            }

            files.forEach(function(file) {
                var listItem;

                if (file.type === 'directory') {
                    // Создание строки для директории
                    listItem = E('tr', {}, [
                        E('td', {}, [
                            E('a', {
                                'href': '#',
                                'style': 'color:blue;',
                                'click': function() {
                                    this.handleDirectoryClick(path.endsWith('/') ? path + file.name : path + '/' + file.name);
                                }.bind(this)
                            }, file.name)
                        ]),
                        E('td', {}, _('Directory')),
                        E('td', {}, '-'),
                        E('td', {}, new Date(file.mtime * 1000).toLocaleString()),
                        E('td', {}, [
                            E('span', { 'class': 'delete-button', 'click': this.handleDeleteFile.bind(this, path.endsWith('/') ? path + file.name : path + '/' + file.name) }, '🗑️')
                        ])  // Без кнопки download для директорий
                    ]);
                } else if (file.type === 'file') {
                    // Создание строки для обычного файла
                    listItem = E('tr', {}, [
                        E('td', {}, [
                            E('a', {
                                'href': '#',
                                'style': 'color:black;',
                                'click': function() {
                                    this.handleFileClick(path.endsWith('/') ? path + file.name : path + '/' + file.name);
                                }.bind(this)
                            }, file.name)
                        ]),
                        E('td', {}, _('File')),
                        E('td', {}, this.formatFileSize(file.size)),
                        E('td', {}, new Date(file.mtime * 1000).toLocaleString()),
                        E('td', {}, [
                            E('span', { 'class': 'delete-button', 'click': this.handleDeleteFile.bind(this, path.endsWith('/') ? path + file.name : path + '/' + file.name) }, '🗑️'),
                            E('span', { 'class': 'download-button', 'click': this.handleDownloadFile.bind(this, path.endsWith('/') ? path + file.name : path + '/' + file.name) }, '⬇️')  // Кнопка download для файлов
                        ])
                    ]);
                }

                fileList.appendChild(listItem);
            }.bind(this));
        }.bind(this)).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to load file list: %s').format(err.message)));
        });
    },

    formatFileSize: function(size) {
        if (size == null || size === '-') return '-';
        var i = Math.floor(Math.log(size) / Math.log(1024));
        return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
    },

    sortBy: function(field) {
        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'asc';
        }
        this.loadFileList(currentPath);
    },

    compareFiles: function(a, b) {
        var valueA = a[sortField] || '';
        var valueB = b[sortField] || '';

        if (sortField === 'name') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
        }

        if (sortDirection === 'asc') {
            return valueA > valueB ? 1 : (valueA < valueB ? -1 : 0);
        } else {
            return valueA < valueB ? 1 : (valueA > valueB ? -1 : 0);
        }
    },

    handleDirectoryClick: function(newPath) {
        currentPath = newPath || '/';
        document.querySelector('h2').textContent = _('File Browser: ') + currentPath;
        this.loadFileList(currentPath);
    },

    handleFileClick: function(filePath) {
        fs.read(filePath).then(function(content) {
            var editorContainer = document.getElementById('editor-container');
            editorContainer.innerHTML = '';

            var editor = E('div', {}, [
                E('h3', {}, _('Editing: ') + filePath),
                E('textarea', {
                    'style': 'width:100%;height:80vh;',
                    'rows': 20
                }, [content != null ? content : '']),
                E('div', { 'class': 'cbi-page-actions' }, [
                    E('button', {
                        'class': 'btn cbi-button-save custom-save-button',
                        'click': this.handleSaveFile.bind(this, filePath)
                    }, _('Save'))
                ])
            ]);

            editorContainer.appendChild(editor);

            this.switchToTab('editor');
        }.bind(this)).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to open file: %s').format(err.message)));
        });
    },

    handleDownloadFile: function(filePath) {
        // Чтение содержимого файла с помощью fs.read
        fs.read(filePath).then(function(content) {
            var blob = new Blob([content], { type: 'application/octet-stream' });
            var downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = filePath.split('/').pop();
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }.bind(this)).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to download file: %s').format(err.message)));
        });
    },

    handleDeleteFile: function(filePath) {
        if (confirm(_('Are you sure you want to delete this file or directory?'))) {
            // Используем fs.remove для удаления файла или директории
            fs.remove(filePath).then(function() {
                ui.addNotification(null, E('p', _('File or directory deleted successfully.')), 'info');
                this.loadFileList(currentPath);
            }.bind(this)).catch(function(err) {
                ui.addNotification(null, E('p', _('Failed to delete file or directory: %s').format(err.message)));
            });
        }
    },

    handleSaveFile: function(filePath) {
        var content = document.querySelector('textarea').value;
        // Используем fs.write для записи содержимого файла
        fs.write(filePath, content).then(function() {
            ui.addNotification(null, E('p', _('File saved successfully.')), 'info');
            this.loadFileList(currentPath);
        }.bind(this)).catch(function(err) {
            ui.addNotification(null, E('p', _('Failed to save file: %s').format(err.message)));
        });
    }
});

