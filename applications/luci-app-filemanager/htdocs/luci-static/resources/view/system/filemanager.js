'use strict';
'require view';
'require fs';
'require ui';
'require dom';
'require rpc';
'require view.system.filemanager.md as md';
'require view.system.filemanager.md_help as md_help';
'require view.system.filemanager.HexEditor as HE';


function pop(a, message, severity) {
	ui.addNotification(a, message, severity)
}

function popTimeout(a, message, timeout, severity) {
	ui.addTimeLimitedNotification(a, message, timeout, severity)
}

// Initialize global variables
var currentPath = '/'; // Current path in the filesystem
var selectedItems = new Set(); // Set of selected files/directories
var sortField = 'name'; // Field to sort files by
var sortDirection = 'asc'; // Sort direction (ascending/descending)
var configFilePath = '/etc/config/filemanager'; // Path to the configuration file

// Initialize drag counter
var dragCounter = 0;

// Configuration object to store interface settings
var config = {
	// Column widths in the file table
	columnWidths: {
		'name': 150,
		'type': 100,
		'size': 100,
		'mtime': 150,
		'actions': 100
	},

	// Minimum column widths
	columnMinWidths: {
		'name': 100,
		'type': 80,
		'size': 80,
		'mtime': 120,
		'actions': 80
	},

	// Maximum column widths
	columnMaxWidths: {
		'name': 300,
		'type': 200,
		'size': 200,
		'mtime': 300,
		'actions': 200
	},

	// Padding and window sizes
	padding: 10,
	paddingMin: 5,
	paddingMax: 20,
	currentDirectory: '/', // Current directory
	windowSizes: {
		width: 800,
		height: 400
	},

	editorContainerSizes: {
		text: {
			width: 850,
			height: 550
		},
		hex: {
			width: 850,
			height: 550
		}
	},

	otherSettings: {} // Additional settings
};

// Function to upload a file to the server
function uploadFile(filename, filedata, onProgress) {
	return new Promise(function(resolve, reject) {
		var formData = new FormData();
		formData.append('sessionid', rpc.getSessionID()); // Add session ID
		formData.append('filename', filename); // File name including path
		formData.append('filedata', filedata); // File data

		var xhr = new XMLHttpRequest();
		xhr.open('POST', L.env.cgi_base + '/cgi-upload', true); // Configure the request

		// Monitor upload progress
		xhr.upload.onprogress = function(event) {
			if (event.lengthComputable && onProgress) {
				var percent = (event.loaded / event.total) * 100;
				onProgress(percent); // Call the progress callback with percentage
			}
		};

		// Handle request completion
		xhr.onload = function() {
			if (xhr.status === 200) {
				resolve(xhr.responseText); // Upload successful
			} else {
				reject(new Error(xhr.statusText)); // Upload error
			}
		};

		// Handle network errors
		xhr.onerror = function() {
			reject(new Error('Network error'));
		};

		xhr.send(formData); // Send the request
	});
}


// Function to load settings from the configuration file

function parseKeyValuePairs(input, delimiter, callback) {
	const pairs = input.split(',');
	pairs.forEach((pair) => {
		const [key, value] = pair.split(delimiter);
		if (key && value) callback(key.trim(), value.trim());
	});
}

async function loadConfig() {
	try {
		const content = await fs.read(configFilePath);
		const lines = content.trim().split('\n');

		lines.forEach((line) => {
			if (!line.includes('option')) return;

			const splitLines = line.split('option').filter(Boolean);

			splitLines.forEach((subline) => {
				const formattedLine = "option " + subline.trim();
				const match = formattedLine.match(/^option\s+(\S+)\s+'([^']+)'$/);

				if (!match) return;

				const [, key, value] = match;

				switch (key) {
					case 'columnWidths':
					case 'columnMinWidths':
					case 'columnMaxWidths':
						parseKeyValuePairs(value, ':', (k, v) => {
							config[key] = config[key] || {};
							config[key][k] = parseInt(v, 10);
						});
						break;

					case 'currentDirectory':
						config.currentDirectory = value;
						break;

					case 'windowSizes':
						parseKeyValuePairs(value, ':', (k, v) => {
							config.windowSizes = config.windowSizes || {};
							const sizeValue = parseInt(v, 10);
							if (!isNaN(sizeValue)) {
								config.windowSizes[k] = sizeValue;
							}
						});
						break;
					case 'editorContainerSizes':
						parseKeyValuePairs(value, ':', (mode, sizeStr) => {
							const [widthStr, heightStr] = sizeStr.split('x');
							const width = parseInt(widthStr, 10);
							const height = parseInt(heightStr, 10);
							if (!isNaN(width) && !isNaN(height)) {
								config.editorContainerSizes[mode] = {
									width: width,
									height: height
								};
							}
						});
						break;
					default:
						config[key] = value;
				}
			});
		});
	} catch (err) {
		console.error('Failed to load config: ' + err.message);
	}
}

// Function to save settings to the configuration file
function saveConfig() {
	// Before saving, ensure sizes are valid
	['text', 'hex'].forEach(function(mode) {
		var sizes = config.editorContainerSizes[mode];
		if (!sizes || isNaN(sizes.width) || isNaN(sizes.height) || sizes.width <= 0 || sizes.height <= 0) {
			// Use default sizes if invalid
			config.editorContainerSizes[mode] = {
				width: 850,
				height: 550
			};
		}
	});

	var configLines = ['config filemanager',
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
		}).join(',') + '\'',
		'\toption editorContainerSizes \'' + Object.keys(config.editorContainerSizes).map(function(mode) {
			var sizes = config.editorContainerSizes[mode];
			return mode + ':' + sizes.width + 'x' + sizes.height;
		}).join(',') + '\''
	];

	// Add additional settings
	Object.keys(config.otherSettings).forEach(function(key) {
		configLines.push('\toption ' + key + ' \'' + config.otherSettings[key] + '\'');
	});

	var configContent = configLines.join('\n') + '\n';

	// Write settings to file
	return fs.write(configFilePath, configContent).then(function() {
		return Promise.resolve();
	}).catch(function(err) {
		return Promise.reject(new Error('Failed to save configuration: ' + err.message));
	});
}

// Function to correctly join paths
function joinPath(path, name) {
	return path.endsWith('/') ? path + name : path + '/' + name;
}

// Function to convert symbolic permissions to numeric format
function symbolicToNumeric(permissions) {
	var specialPerms = 0;
	var permMap = {
		'r': 4,
		'w': 2,
		'x': 1,
		'-': 0
	};
	var numeric = '';
	for (var i = 0; i < permissions.length; i += 3) {
		var subtotal = 0;
		for (var j = 0; j < 3; j++) {
			var char = permissions[i + j];
			if (char === 's' || char === 'S') {
				// Special setuid and setgid bits
				if (i === 0) {
					specialPerms += 4;
				} else if (i === 3) {
					specialPerms += 2;
				}
				subtotal += permMap['x'];
			} else if (char === 't' || char === 'T') {
				// Special sticky bit
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

// Function to get a list of files in a directory
function getFileList(path) {
	return fs.exec('/bin/ls', ['-lA', '--full-time', path]).then(function(res) {
		// If there is an error and no any info about files, reject
		if (res.code !== 0 && (!res.stdout || !res.stdout.trim())) {
			var errorMessage = res.stderr ? res.stderr.trim() : 'Unknown error';
			return Promise.reject(new Error('Failed to list directory: ' + errorMessage));
		}
		var stdout = res.stdout || '';
		var lines = stdout.trim().split('\n');
		var files = [];
		lines.forEach(function(line) {
			if (line.startsWith('total') || !line.trim()) return;
			// Ignore ls error lines (common in /proc)
    		if (line.startsWith('ls:')) return;
			// Parse the output line from 'ls' command
			var parts = line.match(/^([\-dlpscbD])([rwxstST-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+(?:,\s*\d+)?)\s+([\d]{4}-[\d]{2}-[\d]{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?\s+[+-]\d{4})\s+(.+)$/);
			if (!parts || parts.length < 7) {
				console.warn('Failed to parse line:', line);
				return;
			}
			var typeChar = parts[1];
			var permissions = line.substring(0, 10);
			var owner = parts[3];
			var group = parts[4];
			var size = parseInt(parts[5], 10);
			var dateStr = parts[6];
			var name = parts[7];
			var type = '';
			var target = null;
			if (typeChar === 'd') {
				type = 'directory'; // Directory
			} else if (typeChar === '-') {
				type = 'file'; // File
			} else if (typeChar === 'l') {
				type = 'symlink';
				const idx = name.indexOf(' -> ');
				if (idx >= 0) {
					target = name.slice(idx + 4);
					name = name.slice(0, idx);
				}
				else {
					// SYMLINK WITHOUT TARGET (case /proc/<pid>/exe)
					target = null;
				}
			} else if (typeChar === 'c') {
				type = 'character device'; // Character device
			} else if (typeChar === 'b') {
				type = 'block device'; // Block device
			} else if (typeChar === 'p') {
				type = 'named pipe'; // Named pipe
			} else if (typeChar === 's') {
				type = 'socket'; // Socket
			} else {
				type = 'unknown'; // Unknown type
			}
			var mtime = Date.parse(dateStr);
			if (type === 'symlink' && target && size === 4096) {
				size = -1; // Size for symlinks may be incorrect
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

// Function to insert CSS styles into the document
function insertCss(cssContent) {
	var styleElement = document.createElement('style');
	styleElement.type = 'text/css';
	styleElement.appendChild(document.createTextNode(cssContent));
	document.head.appendChild(styleElement);
}

// CSS styles for the file manager interface
var cssContent = `
.cbi-button-apply, .cbi-button-reset, .cbi-button-save:not(.custom-save-button) {
  display: none !important;
}
.cbi-page-actions {
  background: none !important;
  border: none !important;
  padding: ${config.padding}px 0 !important;
  margin: 0 !important;
  display: flex;
  justify-content: flex-start;
  margin-top: 10px;
}
.cbi-tabmenu {
  background: none !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
}
.cbi-tabmenu li {
  display: inline-block;
  margin-right: 10px;
}
#file-list-container {
  margin-top: 30px !important;
  overflow: auto;
  border: 1px solid #ccc;
  padding: 0;
  min-width: 600px;
  position: relative;
  resize: both;
}
#file-list-container.drag-over {
    border: 2px dashed #00BFFF;
    background-color: rgba(0, 191, 255, 0.1);
}
/* Add extra space to the left of the Name and Type columns */
.table th:nth-child(1), .table td:nth-child(1),  /* Name column */
.table th:nth-child(2), .table td:nth-child(2) { /* Type column */
    padding-left: 5px; /* Adjust this value for the desired spacing */
}
/* Add extra space to the right of the Size column */
.table th:nth-child(3), .table td:nth-child(3) { /* Size column */
    padding-right: 5px; /* Adjust this value for the desired spacing */
}
/* Add extra space to the left of the Size column header */
.table th:nth-child(3) { /* Size column header */
    padding-left: 15px; /* Adjust this value for the desired spacing */
}

#drag-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 191, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #00BFFF;
    z-index: 10;
    pointer-events: none;
}
#content-editor {
  margin-top: 30px !important;
}
.editor-container {
  display: flex;
  flex-direction: column;
  resize: both;
  overflow: hidden;
}
.editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.line-numbers {
  width: 50px;
  background-color: #f0f0f0;
  text-align: right;
  padding-right: 5px;
  user-select: none;
  border-right: 1px solid #ccc;
  overflow: hidden;
  flex-shrink: 0;
  -ms-overflow-style: none; /* Hide scrollbar in IE и Edge */
  scrollbar-width: none; /* Hide scrollbar in Firefox */
}
.line-numbers::-webkit-scrollbar {
  display: none; /* Hide scrollbar in Chrome, Safari и Opera */
}
.line-numbers div {
  font-family: monospace;
  font-size: 14px;
  line-height: 1.2em;
  height: 1.2em;
}
#editor-message {
    font-size: 18px;
    font-weight: bold;
}
#editor-textarea {
  flex: 1;
  resize: none;
  border: none;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.2em;
  padding: 0;
  margin: 0;
  overflow: auto;
  box-sizing: border-box;
}
#editor-textarea, .line-numbers {
  overflow-y: scroll;
}
th {
  text-align: left !important;
  position: sticky;
  top: 0;
  border-right: 1px solid #ddd;
  box-sizing: border-box;
  padding-right: 30px;
  white-space: nowrap;
  min-width: 100px;
  background-color: #fff;
  z-index: 2;
}
td {
  text-align: left !important;
  border-right: 1px solid #ddd;
  box-sizing: border-box;
  white-space: nowrap;
  min-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}
tr:hover {
  background-color: #f0f0f0 !important;
}
.download-button {
  color: green;
  cursor: pointer;
  margin-left: 5px;
}
.delete-button {
  color: red;
  cursor: pointer;
  margin-left: 5px;
}
.edit-button {
  color: blue;
  cursor: pointer;
  margin-left: 5px;
}
.duplicate-button {
  color: orange;
  cursor: pointer;
  margin-left: 5px;
}
.symlink {
  color: green;
}
.status-link {
  color: blue;
  text-decoration: underline;
  cursor: pointer;
}
.action-button {
  margin-right: 10px;
  cursor: pointer;
}
.size-cell {
  text-align: right;
  font-family: monospace;
  box-sizing: border-box;
  white-space: nowrap;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
.size-number {
  display: inline-block;
  width: 8ch;
  text-align: right;
}
.size-unit {
  display: inline-block;
  width: 4ch;
  text-align: right;
  margin-left: 0.5ch;
}
.table {
  table-layout: fixed;
  border-collapse: collapse;
  white-space: nowrap;
  width: 100%;
}
.table th:nth-child(3), .table td:nth-child(3) {
  width: 100px;
  min-width: 100px;
  max-width: 500px;
}
.table th:nth-child(3) + th, .table td:nth-child(3) + td {
  padding-left: 10px;
}
.resizer {
  position: absolute;
  right: 0;
  top: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  user-select: none;
  z-index: 3;
}
.resizer::after {
  content: "";
  position: absolute;
  right: 2px;
  top: 0;
  width: 1px;
  height: 100%;
  background: #aaa;
}
#file-list-container.resizable {
  resize: both;
  overflow: auto;
}
.sort-button {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: 1px solid #ccc; /* Add a visible border */
  color: #fff; /* White text color for better contrast on dark backgrounds */
  cursor: pointer;
  padding: 2px 5px; /* Add padding for better clickability */
  font-size: 12px; /* Set font size */
  border-radius: 4px; /* Rounded corners for a better appearance */
  background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent black background */
  transition: background-color 0.3s, color 0.3s; /* Smooth transition effects for hover */
}

.sort-button:hover {
  background-color: #fff; /* Change background to white on hover */
  color: #000; /* Change text color to black on hover */
  border-color: #fff; /* White border on hover */
}
.sort-button:focus {
  outline: none;
}
#status-bar {
  margin-top: 10px;
  padding: 10px;
  background-color: #f9f9f9;
  border: 1px solid #ccc;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
#status-info {
  font-weight: bold;
  display: flex;
  align-items: center;
}
#status-progress {
  width: 50%;
}
.cbi-progressbar {
  width: 100%;
  background-color: #e0e0e0;
  border-radius: 5px;
  overflow: hidden;
  height: 10px;
}
.cbi-progressbar div {
  height: 100%;
  background-color: #76c7c0;
  width: 0%;
  transition: width 0.2s;
}
.file-manager-header {
  display: flex;
  align-items: center;
}
.file-manager-header h2 {
  margin: 0;
}
.file-manager-header input {
  margin-left: 10px;
  width: 100%;
  max-width: 700px;
  font-size: 18px;
}
.file-manager-header button {
  margin-left: 10px;
  font-size: 18px;
}
.directory-link {
    /* Choose a color with good contrast or let the theme decide */
    color: #00BFFF; /* DeepSkyBlue */
    font-weight: bold;
}

.file-link {
    color: inherit; /* Use the default text color */
}
`;


// Main exported view module
return view.extend({
	editorMode: 'text',
	hexEditorInstance: null,
	// Method called when the view is loaded
	load: function() {
		var self = this;
		return loadConfig().then(function() {
			currentPath = config.currentDirectory || '/';
			return getFileList(currentPath); // Load the file list for the current directory
		});
	},

	// Method to render the interface
	render: function(data) {
		var self = this;
		insertCss(cssContent); // Insert CSS styles
		//		insertCss(hexeditCssContent); // Insert hexedit CSS styles
		var viewContainer = E('div', {
			'id': 'file-manager-container'
		}, [
			// File Manager Header
			E('div', {
				'class': 'file-manager-header'
			}, [
				E('h2', {}, _('File Manager: ')),
				E('input', {
					'type': 'text',
					'id': 'path-input',
					'value': currentPath,
					'style': 'margin-left: 10px;',
					'keydown': function(event) {
						if (event.key === 'Enter') {
							self.handleGoButtonClick(); // Trigger directory navigation on Enter
						}
					}
				}),
				E('button', {
					'id': 'go-button',
					'click': this.handleGoButtonClick.bind(this),
					'style': 'margin-left: 10px;'
				}, _('Go'))
			]),

			// Tab Panels
			E('div', {
				'class': 'cbi-tabcontainer',
				'id': 'tab-group'
			}, [
				E('ul', {
					'class': 'cbi-tabmenu'
				}, [
					E('li', {
						'class': 'cbi-tab cbi-tab-active',
						'id': 'tab-filemanager'
					}, [
						E('a', {
							'href': '#',
							'click': this.switchToTab.bind(this, 'filemanager')
						}, _('File Manager'))
					]),
					E('li', {
						'class': 'cbi-tab',
						'id': 'tab-editor'
					}, [
						E('a', {
							'href': '#',
							'click': this.switchToTab.bind(this, 'editor')
						}, _('Editor'))
					]),
					E('li', {
						'class': 'cbi-tab',
						'id': 'tab-settings'
					}, [
						E('a', {
							'href': '#',
							'click': this.switchToTab.bind(this, 'settings')
						}, _('Settings'))
					]),
					// Help Tab
					E('li', {
						'class': 'cbi-tab',
						'id': 'tab-help'
					}, [
						E('a', {
							'href': '#',
							'click': this.switchToTab.bind(this, 'help')
						}, _('Help'))
					])
				])
			]),

			// Tab Contents
			E('div', {
				'class': 'cbi-tabcontainer-content'
			}, [
				// File Manager Content
				E('div', {
					'id': 'content-filemanager',
					'class': 'cbi-tab',
					'style': 'display:block;'
				}, [
					// File List Container with Drag-and-Drop
					(function() {
						// Create the container for the file list and drag-and-drop functionality
						var fileListContainer = E('div', {
							'id': 'file-list-container',
							'class': 'resizable',
							'style': 'width: ' + config.windowSizes.width + 'px; height: ' + config.windowSizes.height + 'px;'
						}, [
							E('table', {
								'class': 'table',
								'id': 'file-table'
							}, [
								E('thead', {}, [
									E('tr', {}, [
										E('th', {
											'data-field': 'name'
										}, [
											_('Name'),
											E('button', {
												'class': 'sort-button',
												'data-field': 'name',
												'title': _('Sort by Name')
											}, '↕'),
											E('div', {
												'class': 'resizer'
											})
										]),
										E('th', {
											'data-field': 'type'
										}, [
											_('Type'),
											E('button', {
												'class': 'sort-button',
												'data-field': 'type',
												'title': _('Sort by Type')
											}, '↕'),
											E('div', {
												'class': 'resizer'
											})
										]),
										E('th', {
											'data-field': 'size'
										}, [
											_('Size'),
											E('button', {
												'class': 'sort-button',
												'data-field': 'size',
												'title': _('Sort by Size')
											}, '↕'),
											E('div', {
												'class': 'resizer'
											})
										]),
										E('th', {
											'data-field': 'mtime'
										}, [
											_('Last Modified'),
											E('button', {
												'class': 'sort-button',
												'data-field': 'mtime',
												'title': _('Sort by Last Modified')
											}, '↕'),
											E('div', {
												'class': 'resizer'
											})
										]),
										E('th', {}, [
											E('input', {
												'type': 'checkbox',
												'id': 'select-all-checkbox',
												'style': 'margin-right: 5px;',
												'change': this.handleSelectAllChange.bind(this),
												'click': this.handleSelectAllClick.bind(this)
											}),
											_('Actions')
										])
									])
								]),
								E('tbody', {
									'id': 'file-list'
								})
							]),
							E('div', {
								'id': 'drag-overlay',
								'style': 'display:none;'
							}, _('Drop files here to upload'))
						]);

						// Attach drag-and-drop event listeners
						fileListContainer.addEventListener('dragenter', this.handleDragEnter.bind(this));
						fileListContainer.addEventListener('dragover', this.handleDragOver.bind(this));
						fileListContainer.addEventListener('dragleave', this.handleDragLeave.bind(this));
						fileListContainer.addEventListener('drop', this.handleDrop.bind(this));

						return fileListContainer;
					}).call(this), // Ensure 'this' context is preserved

					// Status Bar
					E('div', {
						'id': 'status-bar'
					}, [
						E('div', {
							'id': 'status-info'
						}, _('No file selected.')),
						E('div', {
							'id': 'status-progress'
						})
					]),

					// Page Actions
					E('div', {
						'class': 'cbi-page-actions'
					}, [
						E('button', {
							'class': 'btn action-button',
							'click': this.handleUploadClick.bind(this)
						}, _('Upload File')),
						E('button', {
							'class': 'btn action-button',
							'click': this.handleMakeDirectoryClick.bind(this)
						}, _('Create Folder')),
						E('button', {
							'class': 'btn action-button',
							'click': this.handleCreateFileClick.bind(this)
						}, _('Create File')),
						E('button', {
							'id': 'delete-selected-button',
							'class': 'btn action-button',
							'style': 'display: none;',
							'click': this.handleDeleteSelected.bind(this)
						}, _('Delete Selected'))
					])
				]),

				// Editor Content
				E('div', {
					'id': 'content-editor',
					'class': 'cbi-tab',
					'style': 'display:none;'
				}, [
					E('p', {
						'id': 'editor-message'
					}, _('Select a file from the list to edit it here.')),
					E('div', {
						'id': 'editor-container'
					})
				]),
				// Help Content
				E('div', {
					'id': 'content-help',
					'class': 'cbi-tab',
					'style': 'display:none; padding: 10px; overflow:auto; width: 650px; height: 600px; resize: both; border: 1px solid #ccc; box-sizing: border-box;'
				}, [
					// The content will be dynamically inserted by renderHelp()
				]),

				// Settings Content
				E('div', {
					'id': 'content-settings',
					'class': 'cbi-tab',
					'style': 'display:none;'
				}, [
					E('div', {
						'style': 'margin-top: 20px;'
					}, [
						E('h3', {}, _('Interface Settings')),
						E('div', {
							'id': 'settings-container'
						}, [
							E('form', {
								'id': 'settings-form'
							}, [
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
									E('label', {}, _('Text Editor Width:')),
									E('input', {
										'type': 'number',
										'id': 'editor-text-width-input',
										'value': config.editorContainerSizes.text.width,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Text Editor Height:')),
									E('input', {
										'type': 'number',
										'id': 'editor-text-height-input',
										'value': config.editorContainerSizes.text.height,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Hex Editor Width:')),
									E('input', {
										'type': 'number',
										'id': 'editor-hex-width-input',
										'value': config.editorContainerSizes.hex.width,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Hex Editor Height:')),
									E('input', {
										'type': 'number',
										'id': 'editor-hex-height-input',
										'value': config.editorContainerSizes.hex.height,
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
								E('div', {}, [
									E('label', {}, _('Current Directory:')),
									E('input', {
										'type': 'text',
										'id': 'current-directory-input',
										'value': config.currentDirectory,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {
									'class': 'cbi-page-actions'
								}, [
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
		// Add event listeners
		var sortButtons = viewContainer.querySelectorAll('.sort-button[data-field]');
		sortButtons.forEach(function(button) {
			button.addEventListener('click', function(event) {
				event.preventDefault();
				var field = button.getAttribute('data-field');
				if (field) {
					self.sortBy(field); // Sort the file list by the selected field
				}
			});
		});
		// Load the file list and initialize resizable columns
		this.loadFileList(currentPath).then(function() {
			self.initResizableColumns();
			var fileListContainer = document.getElementById('file-list-container');
			if (fileListContainer && typeof ResizeObserver !== 'undefined') {
				// Initialize ResizeObserver only once
				if (!self.fileListResizeObserver) {
					self.fileListResizeObserver = new ResizeObserver(function(entries) {
						for (var entry of entries) {
							var newWidth = entry.contentRect.width;
							var newHeight = entry.contentRect.height;

							// Update config only if newWidth and newHeight are greater than 0
							if (newWidth > 0 && newHeight > 0) {
								config.windowSizes.width = newWidth;
								config.windowSizes.height = newHeight;
							}
						}
					});
					self.fileListResizeObserver.observe(fileListContainer);
				}
			}
		});
		return viewContainer;
	},

	// Handler for the "Select All" checkbox click
	handleSelectAllClick: function(ev) {
		if (ev.altKey) {
			ev.preventDefault(); // Prevent the default checkbox behavior
			this.handleInvertSelection();
		} else {
			// Proceed with normal click handling; the 'change' event will be triggered
		}
	},

	// Function to invert selection
	handleInvertSelection: function() {
		var allCheckboxes = document.querySelectorAll('.select-checkbox');
		allCheckboxes.forEach(function(checkbox) {
			checkbox.checked = !checkbox.checked;
			var filePath = checkbox.getAttribute('data-file-path');
			if (checkbox.checked) {
				selectedItems.add(filePath);
			} else {
				selectedItems.delete(filePath);
			}
		});
		// Update the "Select All" checkbox state
		this.updateSelectAllCheckbox();
		// Update the "Delete Selected" button visibility
		this.updateDeleteSelectedButton();
	},

	/**
	 * Switches the active tab in the interface and performs necessary actions based on the selected tab.
	 *
	 * @param {string} tab - The identifier of the tab to switch to ('filemanager', 'editor', 'settings', or 'help').
	 */
	switchToTab: function(tab) {
		// Retrieve the content containers for each tab
		var fileManagerContent = document.getElementById('content-filemanager');
		var editorContent = document.getElementById('content-editor');
		var settingsContent = document.getElementById('content-settings');
		var helpContent = document.getElementById('content-help');

		// Retrieve the tab elements
		var tabFileManager = document.getElementById('tab-filemanager');
		var tabEditor = document.getElementById('tab-editor');
		var tabSettings = document.getElementById('tab-settings');
		var tabHelp = document.getElementById('tab-help');

		// Ensure all necessary elements are present
		if (fileManagerContent && editorContent && settingsContent && helpContent && tabFileManager && tabEditor && tabSettings && tabHelp) {
			// Display the selected tab's content and hide the others
			fileManagerContent.style.display = (tab === 'filemanager') ? 'block' : 'none';
			editorContent.style.display = (tab === 'editor') ? 'block' : 'none';
			settingsContent.style.display = (tab === 'settings') ? 'block' : 'none';
			helpContent.style.display = (tab === 'help') ? 'block' : 'none';

			// Update the active tab's styling
			tabFileManager.className = (tab === 'filemanager') ? 'cbi-tab cbi-tab-active' : 'cbi-tab';
			tabEditor.className = (tab === 'editor') ? 'cbi-tab cbi-tab-active' : 'cbi-tab';
			tabSettings.className = (tab === 'settings') ? 'cbi-tab cbi-tab-active' : 'cbi-tab';
			tabHelp.className = (tab === 'help') ? 'cbi-tab cbi-tab-active' : 'cbi-tab';

			// Perform actions based on the selected tab
			if (tab === 'filemanager') {
				// Reload and display the updated file list when the File Manager tab is activated
				this.loadFileList(currentPath)
					.then(() => {
						// Initialize resizable columns after successfully loading the file list
						this.initResizableColumns();
					})
					.catch((err) => {
						// Display an error notification if loading the file list fails
						pop(null, E('p', _('Failed to update file list: %s').format(err.message)), 'error');
					});
			} else if (tab === 'settings') {
				// Load and display settings when the Settings tab is activated
				this.loadSettings();
			} else if (tab === 'help') {
				// Render the Help content when the Help tab is activated
				this.renderHelp();
			}
			// No additional actions are required for the Editor tab in this context
		}
	},

	/**
	 * Renders the Help content by converting Markdown to HTML and inserting it into the Help container.
	 */
	renderHelp: function() {
		var self = this;

		// Convert Markdown to HTML

		var helpContentHTML = md.parseMarkdown(md_help.helpContentMarkdown);


		// Get the Help content container
		var helpContent = document.getElementById('content-help');

		if (helpContent) {
			// Insert the converted HTML into the Help container
			helpContent.innerHTML = helpContentHTML;

			// Initialize resizable functionality for the Help window
			self.initResizableHelp();
		} else {
			console.error('Help content container not found.');
			pop(null, E('p', _('Failed to render Help content: Container not found.')), 'error');
		}
	},

	/**
	 * Initializes the resizable functionality for the Help window.
	 */
	initResizableHelp: function() {
		var helpContent = document.getElementById('content-help');

		if (helpContent) {
			// Set initial dimensions
			helpContent.style.width = '700px';
			helpContent.style.height = '600px';
			helpContent.style.resize = 'both';
			helpContent.style.overflow = 'auto';
			helpContent.style.border = '1px solid #ccc';
			helpContent.style.padding = '10px';
			helpContent.style.boxSizing = 'border-box';

			// Optional: Add a drag handle for better user experience
			/*
			var dragHandle = E('div', {
			    'class': 'resize-handle',
			    'style': 'width: 10px; height: 10px; background: #ccc; position: absolute; bottom: 0; right: 0; cursor: se-resize;'
			});
			helpContent.appendChild(dragHandle);
			*/
		} else {
			console.error('Help content container not found for resizing.');
		}
	},

	// Handler for the "Go" button click to navigate to a directory
	handleGoButtonClick: function() {
		// Logic to navigate to the specified directory and update the file list
		var self = this;
		var pathInput = document.getElementById('path-input');
		if (pathInput) {
			var newPath = pathInput.value.trim() || '/';
			fs.stat(newPath).then(function(stat) {
				if (stat.type === 'directory') {
					currentPath = newPath;
					pathInput.value = currentPath;
					self.loadFileList(currentPath).then(function() {
						self.initResizableColumns();
					});
				} else {
					pop(null, E('p', _('The specified path does not appear to be a directory.')), 'error');
				}
			}).catch(function(err) {
				pop(null, E('p', _('Failed to access the specified path: %s').format(err.message)), 'error');
			});
		}
	},

	// Handler for dragging files over the drop zone
	handleDragEnter: function(event) {
		event.preventDefault();
		event.stopPropagation();
		dragCounter++;
		var fileListContainer = document.getElementById('file-list-container');
		var dragOverlay = document.getElementById('drag-overlay');
		if (fileListContainer && dragOverlay) {
			fileListContainer.classList.add('drag-over');
			dragOverlay.style.display = 'flex';
		}
	},

	// Handler for when files are over the drop zone
	handleDragOver: function(event) {
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = 'copy'; // Indicate copy action
	},

	// Handler for leaving the drop zone
	handleDragLeave: function(event) {
		event.preventDefault();
		event.stopPropagation();
		dragCounter--;
		if (dragCounter === 0) {
			var fileListContainer = document.getElementById('file-list-container');
			var dragOverlay = document.getElementById('drag-overlay');
			if (fileListContainer && dragOverlay) {
				fileListContainer.classList.remove('drag-over');
				dragOverlay.style.display = 'none';
			}
		}
	},

	// Handler for dropping files into the drop zone
	handleDrop: function(event) {
		event.preventDefault();
		event.stopPropagation();
		dragCounter = 0; // Reset counter
		var self = this;
		var files = event.dataTransfer.files;
		var fileListContainer = document.getElementById('file-list-container');
		var dragOverlay = document.getElementById('drag-overlay');
		if (fileListContainer && dragOverlay) {
			fileListContainer.classList.remove('drag-over');
			dragOverlay.style.display = 'none';
		}
		if (files.length > 0) {
			self.uploadFiles(files);
		}
	},

	// Handler for uploading a file
	handleUploadClick: function(ev) {
		var self = this;
		var fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.multiple = true; // Allow selecting multiple files
		fileInput.style.display = 'none';
		document.body.appendChild(fileInput);
		fileInput.onchange = function(event) {
			var files = event.target.files;
			if (!files || files.length === 0) {
				pop(null, E('p', _('No file selected.')), 'error');
				return;
			}
			self.uploadFiles(files); // Use the shared upload function
		};
		fileInput.click();
	},

	uploadFiles: function(files) {
		var self = this;
		var directoryPath = currentPath;
		var statusInfo = document.getElementById('status-info');
		var statusProgress = document.getElementById('status-progress');
		var totalFiles = files.length;
		var uploadedFiles = 0;

		function uploadNextFile(index) {
			if (index >= totalFiles) {
				self.loadFileList(currentPath).then(function() {
					self.initResizableColumns();
				});
				return;
			}

			var file = files[index];
			var fullFilePath = joinPath(directoryPath, file.name);
			if (statusInfo) {
				statusInfo.textContent = _('Uploading: "%s"...').format(file.name);
			}
			if (statusProgress) {
				statusProgress.innerHTML = '';
				var progressBarContainer = E('div', {
					'class': 'cbi-progressbar',
					'title': '0%'
				}, [E('div', {
					'style': 'width:0%'
				})]);
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
					statusInfo.textContent = _('File "%s" uploaded successfully.').format(file.name);
				}
				popTimeout(null, E('p', _('File "%s" uploaded successfully.').format(file.name)), 5000, 'info');
				uploadedFiles++;
				uploadNextFile(index + 1);
			}).catch(function(err) {
				if (statusProgress) {
					statusProgress.innerHTML = '';
				}
				if (statusInfo) {
					statusInfo.textContent = _('Upload failed for file "%s": %s').format(file.name, err.message);
				}
				pop(null, E('p', _('Upload failed for file "%s": %s').format(file.name, err.message)), 'error');
				uploadNextFile(index + 1);
			});
		}
		uploadNextFile(0);
	},

	// Handler for creating a directory
	handleMakeDirectoryClick: function(ev) {
		// Logic to create a new directory
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

	// Function to create a directory
	createDirectory: function(dirName) {
		// Execute the 'mkdir' command and update the interface
		var self = this;
		var trimmedDirName = dirName.trim();
		var dirPath = joinPath(currentPath, trimmedDirName);
		fs.exec('mkdir', [dirPath]).then(function(res) {
			if (res.code !== 0) {
				return Promise.reject(new Error(res.stderr.trim()));
			}
			popTimeout(null, E('p', _('Directory "%s" created successfully.').format(trimmedDirName)), 5000, 'info');
			self.loadFileList(currentPath).then(function() {
				self.initResizableColumns();
			});
			var statusInfo = document.getElementById('status-info');
			var statusProgress = document.getElementById('status-progress');
			if (statusInfo) statusInfo.textContent = _('No directory selected.');
			if (statusProgress) statusProgress.innerHTML = '';
		}).catch(function(err) {
			pop(null, E('p', _('Failed to create directory "%s": %s').format(trimmedDirName, err.message)), 'error');
		});
	},

	// Handler for creating a file
	handleCreateFileClick: function(ev) {
		// Logic to create a new file
		var self = this;
		var statusInfo = document.getElementById('status-info');
		var statusProgress = document.getElementById('status-progress');
		if (statusInfo && statusProgress) {
			statusInfo.innerHTML = '';
			statusProgress.innerHTML = '';
			var fileNameInput = E('input', {
				'type': 'text',
				'placeholder': _('File Name'),
				'style': 'margin-right: 10px;'
			});
			var createButton = E('button', {
				'class': 'btn',
				'disabled': true,
				'click': function() {
					self.createFile(fileNameInput.value);
				}
			}, _('Create'));
			fileNameInput.addEventListener('input', function() {
				if (fileNameInput.value.trim()) {
					createButton.disabled = false;
				} else {
					createButton.disabled = true;
				}
			});
			statusInfo.appendChild(E('span', {}, _('Create File: ')));
			statusInfo.appendChild(fileNameInput);
			statusProgress.appendChild(createButton);
		}
	},

	// Function to create a file
	createFile: function(fileName) {
		// Execute the 'touch' command and update the interface
		var self = this;
		var trimmedFileName = fileName.trim();
		var filePath = joinPath(currentPath, trimmedFileName);
		fs.exec('touch', [filePath]).then(function(res) {
			if (res.code !== 0) {
				return Promise.reject(new Error(res.stderr.trim()));
			}
			popTimeout(null, E('p', _('File "%s" created successfully.').format(trimmedFileName)), 5000, 'info');
			self.loadFileList(currentPath).then(function() {
				self.initResizableColumns();
			});
			var statusInfo = document.getElementById('status-info');
			var statusProgress = document.getElementById('status-progress');
			if (statusInfo) statusInfo.textContent = _('No file selected.');
			if (statusProgress) statusProgress.innerHTML = '';
		}).catch(function(err) {
			pop(null, E('p', _('Failed to create file "%s": %s').format(trimmedFileName, err.message)), 'error');
		});
	},

	// Handler for checkbox state change on a file
	handleCheckboxChange: function(ev) {
		// Update the set of selected items
		var checkbox = ev.target;
		var filePath = checkbox.getAttribute('data-file-path');
		if (checkbox.checked) {
			selectedItems.add(filePath);
		} else {
			selectedItems.delete(filePath);
		}
		this.updateDeleteSelectedButton();
		this.updateSelectAllCheckbox();
	},

	// Update the "Delete Selected" button
	updateDeleteSelectedButton: function() {
		// Show or hide the button based on the number of selected items
		var deleteSelectedButton = document.getElementById('delete-selected-button');
		if (deleteSelectedButton) {
			if (selectedItems.size > 0) {
				deleteSelectedButton.style.display = '';
			} else {
				deleteSelectedButton.style.display = 'none';
			}
		}
	},

	// Update the "Select All" checkbox state
	updateSelectAllCheckbox: function() {
		var selectAllCheckbox = document.getElementById('select-all-checkbox');
		var allCheckboxes = document.querySelectorAll('.select-checkbox');
		var totalCheckboxes = allCheckboxes.length;
		var checkedCheckboxes = 0;
		allCheckboxes.forEach(function(checkbox) {
			if (checkbox.checked) {
				checkedCheckboxes++;
			}
		});
		if (selectAllCheckbox) {
			if (checkedCheckboxes === 0) {
				selectAllCheckbox.checked = false;
				selectAllCheckbox.indeterminate = false;
			} else if (checkedCheckboxes === totalCheckboxes) {
				selectAllCheckbox.checked = true;
				selectAllCheckbox.indeterminate = false;
			} else {
				selectAllCheckbox.checked = false;
				selectAllCheckbox.indeterminate = true;
			}
		}
	},

	// Handler for the "Select All" checkbox change
	handleSelectAllChange: function(ev) {
		// Logic to select or deselect all files
		var self = this;
		var selectAllCheckbox = ev.target;
		var allCheckboxes = document.querySelectorAll('.select-checkbox');
		selectedItems.clear();
		allCheckboxes.forEach(function(checkbox) {
			checkbox.checked = selectAllCheckbox.checked;
			var filePath = checkbox.getAttribute('data-file-path');
			if (selectAllCheckbox.checked) {
				selectedItems.add(filePath);
			}
		});
		this.updateDeleteSelectedButton();
	},

	// Handler for deleting selected items
	handleDeleteSelected: function() {
		// Delete selected files and directories
		var self = this;
		if (selectedItems.size === 0) {
			return;
		}
		if (!confirm(_('Are you sure you want to delete the selected files and directories?'))) {
			return;
		}
		var promises = [];
		selectedItems.forEach(function(filePath) {
			promises.push(fs.remove(filePath).catch(function(err) {
				pop(null, E('p', _('Failed to delete %s: %s').format(filePath, err.message)), 'error');
			}));
		});
		Promise.all(promises).then(function() {
			popTimeout(null, E('p', _('Selected files and directories deleted successfully.')), 5000, 'info');
			selectedItems.clear();
			self.updateDeleteSelectedButton();
			self.loadFileList(currentPath).then(function() {
				self.initResizableColumns();
			});
		}).catch(function(err) {
			pop(null, E('p', _('Failed to delete selected files and directories: %s').format(err.message)), 'error');
		});
	},

	// Function to load the file list
	loadFileList: function(path) {
		// Get the list of files and display them in the table
		var self = this;
		selectedItems.clear();
		return getFileList(path).then(function(files) {
			var fileList = document.getElementById('file-list');
			if (!fileList) {
				pop(null, E('p', _('Failed to display the file list.')), 'error');
				return;
			}
			fileList.innerHTML = '';
			files.sort(self.compareFiles.bind(self));
			if (path !== '/') {
				var parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
				var listItemUp = E('tr', {
					'data-file-path': parentPath,
					'data-file-type': 'directory'
				}, [E('td', {
					'colspan': 5
				}, [E('a', {
					'href': '#',
					'click': function() {
						self.handleDirectoryClick(parentPath);
					}
				}, '.. (Parent Directory)')])]);
				fileList.appendChild(listItemUp);
			}
			files.forEach(function(file) {
				var listItem;
				var displaySize = (file.type === 'directory' || (file.type === 'symlink' && file.size === -1)) ? -1 : file.size;
				var checkbox = E('input', {
					'type': 'checkbox',
					'class': 'select-checkbox',
					'data-file-path': joinPath(path, file.name),
					'change': function(ev) {
						self.handleCheckboxChange(ev);
					}
				});
				var actionButtons = [checkbox, E('span', {
					'class': 'edit-button',
					'click': function() {
						self.handleEditFile(joinPath(path, file.name), file);
					}
				}, '✏️'), E('span', {
					'class': 'duplicate-button',
					'click': function() {
						self.handleDuplicateFile(joinPath(path, file.name), file);
					}
				}, '📑'), E('span', {
					'class': 'delete-button',
					'click': function() {
						self.handleDeleteFile(joinPath(path, file.name), file);
					}
				}, '🗑️')];
				if (file.type === 'file') {
					actionButtons.push(E('span', {
						'class': 'download-button',
						'click': function() {
							self.handleDownloadFile(joinPath(path, file.name));
						}
					}, '⬇️'));
				}
				var actionTd = E('td', {}, actionButtons);
				if (file.type === 'directory') {
					listItem = E('tr', {
						'data-file-path': joinPath(path, file.name),
						'data-file-type': 'directory',
						'data-permissions': file.permissions,
						'data-numeric-permissions': file.numericPermissions,
						'data-owner': file.owner,
						'data-group': file.group,
						'data-size': -1
					}, [E('td', {}, [E('a', {
						'href': '#',
						'class': 'directory-link',
						'click': function() {
							self.handleDirectoryClick(joinPath(path, file.name));
						}
					}, file.name)]), E('td', {}, _('Directory')), E('td', {
						'class': 'size-cell'
					}, [E('span', {
						'class': 'size-number'
					}, '-'), E('span', {
						'class': 'size-unit'
					}, '')]), E('td', {}, new Date(file.mtime * 1000).toLocaleString()), actionTd]);
				} else if (file.type === 'file') {
					listItem = E('tr', {
						'data-file-path': joinPath(path, file.name),
						'data-file-type': 'file',
						'data-permissions': file.permissions,
						'data-numeric-permissions': file.numericPermissions,
						'data-owner': file.owner,
						'data-group': file.group,
						'data-size': file.size
					}, [E('td', {}, [E('a', {
						'href': '#',
						'class': 'file-link',
						'click': function() {
							event.preventDefault(); // Prevent the default link behavior
							if (event.altKey) {
								self.handleFileClick(joinPath(path, file.name), 'hex'); // Open in hex editor
							} else {
								self.handleFileClick(joinPath(path, file.name), 'text'); // Open in text editor
							}
						}
					}, file.name)]), E('td', {}, _('File')), E('td', {
						'class': 'size-cell'
					}, [E('span', {
						'class': 'size-number'
					}, self.getFormattedSize(file.size).number), E('span', {
						'class': 'size-unit'
					}, self.getFormattedSize(file.size).unit)]), E('td', {}, new Date(file.mtime * 1000).toLocaleString()), actionTd]);
				} else if (file.type === 'symlink') {
					var symlinkName = file.target ? (file.name + ' -> ' + file.target) : file.name;
					var symlinkSize = (file.size === -1) ? -1 : file.size;
					var sizeContent;
					if (symlinkSize >= 0) {
						var formattedSize = self.getFormattedSize(symlinkSize);
						sizeContent = [E('span', {
							'class': 'size-number'
						}, formattedSize.number), E('span', {
							'class': 'size-unit'
						}, formattedSize.unit)];
					} else {
						sizeContent = [E('span', {
							'class': 'size-number'
						}, '-'), E('span', {
							'class': 'size-unit'
						}, '')];
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
					}, [E('td', {}, [E('a', {
						'href': '#',
						'class': 'symlink-name',
						'click': function() {
							event.preventDefault(); // Prevent the default link behavior
							if (event.altKey) {
								self.handleSymlinkClick(joinPath(path, file.name), file.target, 'hex'); // Open target in hex editor
							} else {
								self.handleSymlinkClick(joinPath(path, file.name), file.target, 'text');
							}
						}
					}, symlinkName)]), E('td', {}, _('Symlink')), E('td', {
						'class': 'size-cell'
					}, sizeContent), E('td', {}, new Date(file.mtime * 1000).toLocaleString()), actionTd]);
				} else {
					listItem = E('tr', {
						'data-file-path': joinPath(path, file.name),
						'data-file-type': file.type
					}, [E('td', {}, file.name), E('td', {}, file.type.charAt(0).toUpperCase() + file.type.slice(1)), E('td', {
						'class': 'size-cell'
					}, [E('span', {
						'class': 'size-number'
					}, '-'), E('span', {
						'class': 'size-unit'
					}, '')]), E('td', {}, new Date(file.mtime * 1000).toLocaleString()), actionTd]);
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
			self.updateSelectAllCheckbox();
			self.updateDeleteSelectedButton();
			return Promise.resolve();
		}).catch(function(err) {
			pop(null, E('p', _('Failed to load file list: %s').format(err.message)), 'error');
			return Promise.reject(err);
		});
	},

	// Function to format file size
	getFormattedSize: function(size) {
		// Convert the size to a human-readable format (KB, MB, GB)
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

	// Function to sort files
	sortBy: function(field) {
		// Change the sort field and direction, and reload the file list
		if (sortField === field) {
			sortDirection = (sortDirection === 'asc') ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
		this.loadFileList(currentPath);
	},

	// Function to compare files for sorting
	compareFiles: function(a, b) {
		// Compare files based on the selected field and direction
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

	// Set initial column widths in the table
	setInitialColumnWidths: function() {
		// Apply column width settings to the file table
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

	// Handler for clicking on a directory
	handleDirectoryClick: function(newPath) {
		// Navigate to the selected directory and update the file list
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

	/**
	 * Determines whether a given Uint8Array represents UTF-8 text data.
	 *
	 * @param {Uint8Array} uint8Array - The binary data to check.
	 * @returns {boolean} - Returns true if the data is UTF-8 text, false otherwise.
	 */
	isText: function(uint8Array) {

		const len = uint8Array.length;
		let i = 0;

		while (i < len) {
			const byte = uint8Array[i];

			if (byte === 0) return false; // Null byte indicates binary

			if (byte <= 0x7F) {
				// ASCII character, no action needed
				i++;
				continue;
			} else if ((byte & 0xE0) === 0xC0) {
				// 2-byte sequence
				if (i + 1 >= len || (uint8Array[i + 1] & 0xC0) !== 0x80) return false;
				i += 2;
			} else if ((byte & 0xF0) === 0xE0) {
				// 3-byte sequence
				if (
					i + 2 >= len ||
					(uint8Array[i + 1] & 0xC0) !== 0x80 ||
					(uint8Array[i + 2] & 0xC0) !== 0x80
				) {
					return false;
				}
				i += 3;
			} else if ((byte & 0xF8) === 0xF0) {
				// 4-byte sequence
				if (
					i + 3 >= len ||
					(uint8Array[i + 1] & 0xC0) !== 0x80 ||
					(uint8Array[i + 2] & 0xC0) !== 0x80 ||
					(uint8Array[i + 3] & 0xC0) !== 0x80
				) {
					return false;
				}
				i += 4;
			} else {
				// Invalid UTF-8 byte
				return false;
			}
		}

		return true;
	},

	// Function to handle clicking on a file to open it in the editor
	handleFileClick: function(filePath, mode) {
		const self = this;
		const fileRow = document.querySelector(`tr[data-file-path='${filePath}']`);
		const editorMessage = document.getElementById('editor-message');

		// Set original file permissions
		self.originalFilePermissions = fileRow ? fileRow.getAttribute('data-numeric-permissions') : '644';
		self.editorMode = mode;

		// Display loading message
		if (editorMessage) editorMessage.textContent = _('Loading file...');

		// Read the file as binary data
		fs.read_direct(filePath, 'blob')
			.then(blob => blob.arrayBuffer())
			.then(arrayBuffer => {
				const uint8Array = new Uint8Array(arrayBuffer);
				self.fileData = uint8Array;
				self.fileContent = ''; // Can be used for display or left empty
				self.editorMode = 'hex';
				self.textType = self.isText(uint8Array) ? 'text' : 'hex';
				if (mode === 'text') {
					// Determine if the file is text
					if (self.textType === 'text') {
						// If text, decode the content
						self.fileContent = new TextDecoder().decode(uint8Array);
						self.editorMode = 'text';
					} else {
						// If not text, show a warning and set mode to hex
						if (editorMessage) {
							editorMessage.textContent = _('The file does not contain valid text data. Opening in hex mode...');
						}
						pop(null, E('p', _('Opening file in hex mode since it is not a text file.')), 'warning');
					}
				}
			})
			.then(() => {
				// Render the editor and switch to the editor tab
				self.renderEditor(filePath);
				self.switchToTab('editor');
			})
			.catch(err => {
				// Handle errors during file reading
				pop(null, E('p', _('Failed to open file: %s').format(err.message)), 'error');
			});
	},
	// Adjust padding for line numbers in the editor
	adjustLineNumbersPadding: function() {
		// Update padding based on scrollbar size
		var lineNumbersDiv = document.getElementById('line-numbers');
		var editorTextarea = document.getElementById('editor-textarea');
		if (!lineNumbersDiv || !editorTextarea) {
			return;
		}
		var scrollbarHeight = editorTextarea.offsetHeight - editorTextarea.clientHeight;
		lineNumbersDiv.style.paddingBottom = scrollbarHeight + 'px';
	},

	// Handler for downloading a file
	handleDownloadFile: function(filePath) {
		// Download the file to the user's local machine
		var self = this;
		var fileName = filePath.split('/').pop();
		// Use the read_direct method to download the file
		fs.read_direct(filePath, 'blob')
			.then(function(blob) {
				if (!(blob instanceof Blob)) {
					throw new Error(_('Response is not a Blob'));
				}
				var url = window.URL.createObjectURL(blob);
				var a = document.createElement('a');
				a.href = url;
				a.download = fileName;
				document.body.appendChild(a);
				a.click();
				a.remove();
				window.URL.revokeObjectURL(url);
			}).catch(function(err) {
				pop(null, E('p', _('Failed to download file "%s": %s').format(fileName, err.message)), 'error');
			});
	},

	// Handler for deleting a file
	handleDeleteFile: function(filePath, fileInfo) {
		// Delete the selected file or directory
		var self = this;
		var itemTypeLabel = '';
		var itemName = filePath.split('/').pop();

		if (fileInfo && fileInfo.type) {
			if (fileInfo.type === 'directory') {
				itemTypeLabel = _('directory');
			} else if (fileInfo.type === 'file') {
				itemTypeLabel = _('file');
			} else if (fileInfo.type === 'symlink') {
				itemTypeLabel = _('symbolic link');
			} else {
				itemTypeLabel = _('item');
			}
		} else {
			itemTypeLabel = _('item');
		}

		if (confirm(_('Are you sure you want to delete this %s: "%s"?').format(itemTypeLabel, itemName))) {
			fs.remove(filePath).then(function() {
				popTimeout(null, E('p', _('Successfully deleted %s: "%s".').format(itemTypeLabel, itemName)), 5000, 'info');
				self.loadFileList(currentPath).then(function() {
					self.initResizableColumns();
				});
				var statusInfo = document.getElementById('status-info');
				if (statusInfo) {
					statusInfo.textContent = _('Deleted %s: "%s".').format(itemTypeLabel, itemName);
				}
			}).catch(function(err) {
				pop(null, E('p', _('Failed to delete %s "%s": %s').format(itemTypeLabel, itemName, err.message)), 'error');
			});
		}
	},

	// Update line numbers in the text editor
	updateLineNumbers: function() {
		// Update the line numbers display when the text changes
		var lineNumbersDiv = document.getElementById('line-numbers');
		var editorTextarea = document.getElementById('editor-textarea');
		if (!lineNumbersDiv || !editorTextarea) {
			return;
		}
		var content = editorTextarea.value;
		var lines = content.split('\n').length;
		var lineNumbersContent = '';
		for (var i = 1; i <= lines; i++) {
			lineNumbersContent += '<div>' + i + '</div>';
		}
		lineNumbersDiv.innerHTML = lineNumbersContent;
	},

	// Synchronize scrolling between line numbers and text
	syncScroll: function() {
		// Sync scrolling of line numbers with the text area
		var lineNumbersDiv = document.getElementById('line-numbers');
		var editorTextarea = document.getElementById('editor-textarea');
		if (!lineNumbersDiv || !editorTextarea) {
			return;
		}
		lineNumbersDiv.scrollTop = editorTextarea.scrollTop;
	},

	// Toggle line numbers display in the editor
	toggleLineNumbers: function() {
		// Ensure the editor is in Text Mode before toggling line numbers
		if (this.editorMode !== 'text') {
			console.warn('Toggle Line Numbers is only available in Text Mode.');
			return;
		}

		// Get the line numbers div and the textarea
		var lineNumbersDiv = document.getElementById('line-numbers');
		var editorTextarea = document.getElementById('editor-textarea');
		if (!lineNumbersDiv || !editorTextarea) {
			console.error('Line numbers div or editor textarea not found.');
			return;
		}

		// Toggle the display of line numbers
		if (lineNumbersDiv.style.display === 'none' || !lineNumbersDiv.style.display) {
			lineNumbersDiv.style.display = 'block';
			this.updateLineNumbers();
			this.adjustLineNumbersPadding();
			this.syncScroll();
		} else {
			lineNumbersDiv.style.display = 'none';
			lineNumbersDiv.innerHTML = '';
		}
	},

	// Generate a name for a copy of a file
	getCopyName: function(originalName, existingNames) {
		// Create a new unique file name based on the original
		var dotIndex = originalName.lastIndexOf('.');
		var namePart, extension;
		if (dotIndex > 0 && dotIndex !== originalName.length - 1) {
			namePart = originalName.substring(0, dotIndex);
			extension = originalName.substring(dotIndex);
		} else {
			namePart = originalName;
			extension = '';
		}
		var copyName = namePart + ' (copy)' + extension;
		var copyIndex = 1;
		while (existingNames.includes(copyName)) {
			copyIndex++;
			copyName = namePart + ' (copy ' + copyIndex + ')' + extension;
		}
		return copyName;
	},

	// Handler for duplicating a file
	handleDuplicateFile: function(filePath, fileInfo) {
		// Copy the file or directory with a new name
		var self = this;
		getFileList(currentPath).then(function(files) {
			var existingNames = files.map(function(f) {
				return f.name;
			});
			var newName = self.getCopyName(fileInfo.name, existingNames);
			var newPath = joinPath(currentPath, newName);
			var command;
			var args;
			if (fileInfo.type === 'directory') {
				command = 'cp';
				args = ['-rp', filePath, newPath];
			} else if (fileInfo.type === 'symlink') {
				command = 'cp';
				args = ['-Pp', filePath, newPath];
			} else {
				command = 'cp';
				args = ['-p', filePath, newPath];
			}
			fs.exec(command, args).then(function(res) {
				if (res.code !== 0) {
					return Promise.reject(new Error(res.stderr.trim()));
				}
				popTimeout(null, E('p', _('Successfully duplicated %s "%s" as "%s".').format(_('item'), fileInfo.name, newName)), 5000, 'info');
				self.loadFileList(currentPath).then(function() {
					self.initResizableColumns();
				});
			}).catch(function(err) {
				pop(null, E('p', _('Failed to duplicate %s "%s": %s').format(_('item'), fileInfo.name, err.message)), 'error');
			});
		}).catch(function(err) {
			pop(null, E('p', _('Failed to get file list: %s').format(err.message)), 'error');
		});
	},

	// Handler for saving a file after editing
	handleSaveFile: function(filePath) {
		var self = this;
		var contentBlob;

		if (self.editorMode === 'text') {
			var textarea = document.querySelector('#editor-container textarea');
			if (!textarea) {
				pop(null, E('p', _('Editor textarea not found.')), 'error');
				return;
			}
			var content = textarea.value;
			self.fileContent = content;

			// Convert content to Uint8Array in chunks not exceeding 8KB
			var CHUNK_SIZE = 8 * 1024; // 8KB
			var totalLength = content.length;
			var chunks = [];
			for (var i = 0; i < totalLength; i += CHUNK_SIZE) {
				var chunkStr = content.slice(i, i + CHUNK_SIZE);
				var chunkBytes = new TextEncoder().encode(chunkStr);
				chunks.push(chunkBytes);
			}
			// Concatenate chunks into a single Uint8Array
			var totalBytes = chunks.reduce(function(prev, curr) {
				return prev + curr.length;
			}, 0);
			var dataArray = new Uint8Array(totalBytes);
			var offset = 0;
			chunks.forEach(function(chunk) {
				dataArray.set(chunk, offset);
				offset += chunk.length;
			});
			self.fileData = dataArray; // Update binary data

			contentBlob = new Blob([self.fileData], {
				type: 'application/octet-stream'
			});
		} else if (self.editorMode === 'hex') {
			// Get data from hex editor
			self.fileData = self.hexEditorInstance.getData(); // Assuming getData method is implemented in HexEditor
			contentBlob = new Blob([self.fileData], {
				type: 'application/octet-stream'
			});
		}

		var statusInfo = document.getElementById('status-info');
		var statusProgress = document.getElementById('status-progress');
		var fileName = filePath.split('/').pop();
		if (statusInfo) {
			statusInfo.textContent = _('Saving file: "%s"...').format(fileName);
		}
		if (statusProgress) {
			statusProgress.innerHTML = '';
			var progressBarContainer = E('div', {
				'class': 'cbi-progressbar',
				'title': '0%'
			}, [E('div', {
				'style': 'width:0%'
			})]);
			statusProgress.appendChild(progressBarContainer);
		}

		uploadFile(filePath, contentBlob, function(percent) {
			if (statusProgress) {
				var progressBar = statusProgress.querySelector('.cbi-progressbar div');
				if (progressBar) {
					progressBar.style.width = percent.toFixed(2) + '%';
					statusProgress.querySelector('.cbi-progressbar').setAttribute('title', percent.toFixed(2) + '%');
				}
			}
		}).then(function() {
			var permissions = self.originalFilePermissions;
			if (permissions !== undefined) {
				return fs.exec('chmod', [permissions, filePath]).then(function(res) {
					if (res.code !== 0) {
						throw new Error(res.stderr.trim());
					}
				}).then(function() {
					if (statusInfo) {
						statusInfo.textContent = _('File "%s" uploaded successfully.').format(fileName);
					}
					popTimeout(null, E('p', _('File "%s" uploaded successfully.').format(fileName)), 5000, 'info');
					return self.loadFileList(currentPath).then(function() {
						self.initResizableColumns();
					});
				}).catch(function(err) {
					pop(null, E('p', _('Failed to apply permissions to file "%s": %s').format(fileName, err.message)), 'error');
				});
			} else {
				if (statusInfo) {
					statusInfo.textContent = _('File "%s" uploaded successfully.').format(fileName);
				}
				popTimeout(null, E('p', _('File "%s" uploaded successfully.').format(fileName)), 5000, 'info');
				return self.loadFileList(currentPath).then(function() {
					self.initResizableColumns();
				});
			}
		}).catch(function(err) {
			if (statusProgress) {
				statusProgress.innerHTML = '';
			}
			if (statusInfo) {
				statusInfo.textContent = _('Failed to save file "%s": %s').format(fileName, err.message);
			}
			pop(null, E('p', _('Failed to save file "%s": %s').format(fileName, err.message)), 'error');
		});
	},


	// Handler for clicking on a symbolic link
	handleSymlinkClick: function(linkPath, targetPath, mode) {
		// Navigate to the target of the symbolic link
		var self = this;
		if (!targetPath) {
			pop(null, E('p', _('The symlink does not have a valid target.')), 'error');
			return;
		}
		if (!targetPath.startsWith('/')) {
			targetPath = joinPath(currentPath, targetPath);
		}
		fs.stat(targetPath).then(function(stat) {
			if (stat.type === 'directory') {
				self.handleDirectoryClick(targetPath);
			} else if (stat.type === 'file') {
				self.handleFileClick(targetPath, mode);
			} else {
				pop(null, E('p', _('The symlink points to an unsupported type.')), 'error');
			}
		}).catch(function(err) {
			pop(null, E('p', _('Failed to access symlink target: %s').format(err.message)), 'error');
		});
		var statusInfo = document.getElementById('status-info');
		if (statusInfo) {
			statusInfo.textContent = _('Symlink: ') + linkPath + ' -> ' + targetPath;
		}
	},

	// Initialize resizable columns in the table
	initResizableColumns: function() {
		// Add handlers to adjust column widths
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
						saveConfig();
					}
					document.addEventListener('mousemove', doDrag, false);
					document.addEventListener('mouseup', stopDrag, false);
				};
				resizer.addEventListener('mousedown', header.resizeHandler, false);
			}
		});
	},

	// Handler for editing a file's properties (name, permissions, etc.)
	handleEditFile: function(filePath, fileInfo) {
		// Display a form to edit the file's properties
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
			statusInfo.appendChild(E('span', {}, _('Editing %s: "%s"').format(_('item'), fileInfo.name)));
			statusInfo.appendChild(nameInput);
			statusInfo.appendChild(permsInput);
			statusInfo.appendChild(ownerInput);
			statusInfo.appendChild(groupInput);
			statusProgress.appendChild(saveButton);
		}
	},

	// Save changes to a file's properties
	saveFileChanges: function(filePath, fileInfo, newName, newPerms, newOwner, newGroup) {
		// Apply changes and update the interface
		var self = this;
		var commands = [];
		var originalPath = filePath;
		var originalName = fileInfo.name;
		var newItemName = newName || originalName;

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
			popTimeout(null, E('p', _('Changes to %s "%s" uploaded successfully.').format(_('item'), newItemName)), 5000, 'info');
			self.loadFileList(currentPath).then(function() {
				self.initResizableColumns();
			});
			var statusInfo = document.getElementById('status-info');
			var statusProgress = document.getElementById('status-progress');
			if (statusInfo) statusInfo.textContent = _('No item selected.');
			if (statusProgress) statusProgress.innerHTML = '';
		}).catch(function(err) {
			pop(null, E('p', _('Failed to save changes to %s "%s": %s').format(_('item'), newItemName, err.message)), 'error');
		});
	},

	// Handler for saving interface settings
	handleSaveSettings: function(ev) {
		ev.preventDefault();
		var self = this;
		var inputs = {
			columnWidths: document.getElementById('column-widths-input'),
			columnMinWidths: document.getElementById('column-min-widths-input'),
			columnMaxWidths: document.getElementById('column-max-widths-input'),
			padding: document.getElementById('padding-input'),
			paddingMin: document.getElementById('padding-min-input'),
			paddingMax: document.getElementById('padding-max-input'),
			currentDirectory: document.getElementById('current-directory-input'),
			windowWidth: document.getElementById('window-width-input'),
			windowHeight: document.getElementById('window-height-input'),
			editorTextWidth: document.getElementById('editor-text-width-input'),
			editorTextHeight: document.getElementById('editor-text-height-input'),
			editorHexWidth: document.getElementById('editor-hex-width-input'),
			editorHexHeight: document.getElementById('editor-hex-height-input')
		};

		function parseWidthSettings(inputValue, configKey) {
			if (!inputValue) return;
			inputValue.split(',').forEach(function(widthStr) {
				var widthParts = widthStr.split(':');
				if (widthParts.length === 2) {
					var field = widthParts[0];
					var width = parseInt(widthParts[1], 10);
					if (!isNaN(width)) {
						config[configKey][field] = width;
					}
				}
			});
		}
		if (inputs.columnWidths && inputs.padding) {
			parseWidthSettings(inputs.columnWidths.value.trim(), 'columnWidths');
			parseWidthSettings(inputs.columnMinWidths.value.trim(), 'columnMinWidths');
			parseWidthSettings(inputs.columnMaxWidths.value.trim(), 'columnMaxWidths');
			var paddingValue = parseInt(inputs.padding.value.trim(), 10);
			var paddingMinValue = parseInt(inputs.paddingMin.value.trim(), 10);
			var paddingMaxValue = parseInt(inputs.paddingMax.value.trim(), 10);
			if (!isNaN(paddingValue)) {
				config.padding = paddingValue;
			}
			if (!isNaN(paddingMinValue)) {
				config.paddingMin = paddingMinValue;
			}
			if (!isNaN(paddingMaxValue)) {
				config.paddingMax = paddingMaxValue;
			}
			if (inputs.currentDirectory) {
				var currentDirectoryValue = inputs.currentDirectory.value.trim();
				if (currentDirectoryValue) {
					config.currentDirectory = currentDirectoryValue;
				}
			}
			if (inputs.windowWidth && inputs.windowHeight) {
				var windowWidthValue = parseInt(inputs.windowWidth.value.trim(), 10);
				var windowHeightValue = parseInt(inputs.windowHeight.value.trim(), 10);
				if (!isNaN(windowWidthValue)) {
					config.windowSizes.width = windowWidthValue;
				}
				if (!isNaN(windowHeightValue)) {
					config.windowSizes.height = windowHeightValue;
				}
			}
			if (inputs.editorTextWidth && inputs.editorTextHeight) {
				var textWidth = parseInt(inputs.editorTextWidth.value.trim(), 10);
				var textHeight = parseInt(inputs.editorTextHeight.value.trim(), 10);
				if (!isNaN(textWidth) && !isNaN(textHeight)) {
					config.editorContainerSizes.text.width = textWidth;
					config.editorContainerSizes.text.height = textHeight;
				}
			}
			if (inputs.editorHexWidth && inputs.editorHexHeight) {
				var hexWidth = parseInt(inputs.editorHexWidth.value.trim(), 10);
				var hexHeight = parseInt(inputs.editorHexHeight.value.trim(), 10);
				if (!isNaN(hexWidth) && !isNaN(hexHeight)) {
					config.editorContainerSizes.hex.width = hexWidth;
					config.editorContainerSizes.hex.height = hexHeight;
				}
			}

			saveConfig().then(function() {
				popTimeout(null, E('p', _('Settings uploaded successfully.')), 5000, 'info');
				self.setInitialColumnWidths();
				var styleElement = document.querySelector('style');
				if (styleElement) {
					styleElement.textContent = styleElement.textContent.replace(/padding: \d+px/g, 'padding: ' + config.padding + 'px');
				}
				var fileListContainer = document.getElementById('file-list-container');
				if (fileListContainer) {
					fileListContainer.style.width = config.windowSizes.width + 'px';
					fileListContainer.style.height = config.windowSizes.height + 'px';
				}
				currentPath = config.currentDirectory || '/';
				var pathInput = document.getElementById('path-input');
				if (pathInput) {
					pathInput.value = currentPath;
				}
				self.loadFileList(currentPath).then(function() {
					self.initResizableColumns();
				});
				var editorContainer = document.getElementById('editor-container');
				if (editorContainer) {
					var editorMode = self.editorMode;
					var editorSizes = config.editorContainerSizes[editorMode] || {
						width: 850,
						height: 550
					};
					editorContainer.style.width = editorSizes.width + 'px';
					editorContainer.style.height = editorSizes.height + 'px';
				}
			}).catch(function(err) {
				pop(null, E('p', _('Failed to save settings: %s').format(err.message)), 'error');
			});
		}
	},

	// Load settings into the settings form
	// Load settings into the settings form
	loadSettings: function() {
		var inputs = {
			columnWidths: document.getElementById('column-widths-input'),
			columnMinWidths: document.getElementById('column-min-widths-input'),
			columnMaxWidths: document.getElementById('column-max-widths-input'),
			padding: document.getElementById('padding-input'),
			paddingMin: document.getElementById('padding-min-input'),
			paddingMax: document.getElementById('padding-max-input'),
			currentDirectory: document.getElementById('current-directory-input'),
			windowWidth: document.getElementById('window-width-input'),
			windowHeight: document.getElementById('window-height-input'),
			editorTextWidth: document.getElementById('editor-text-width-input'),
			editorTextHeight: document.getElementById('editor-text-height-input'),
			editorHexWidth: document.getElementById('editor-hex-width-input'),
			editorHexHeight: document.getElementById('editor-hex-height-input')
		};

		// Populate the input fields with the current config values
		if (inputs.columnWidths) {
			inputs.columnWidths.value = Object.keys(config.columnWidths).map(function(field) {
				return field + ':' + config.columnWidths[field];
			}).join(',');
		}
		if (inputs.columnMinWidths) {
			inputs.columnMinWidths.value = Object.keys(config.columnMinWidths).map(function(field) {
				return field + ':' + config.columnMinWidths[field];
			}).join(',');
		}
		if (inputs.columnMaxWidths) {
			inputs.columnMaxWidths.value = Object.keys(config.columnMaxWidths).map(function(field) {
				return field + ':' + config.columnMaxWidths[field];
			}).join(',');
		}
		if (inputs.padding) {
			inputs.padding.value = config.padding;
		}
		if (inputs.paddingMin) {
			inputs.paddingMin.value = config.paddingMin;
		}
		if (inputs.paddingMax) {
			inputs.paddingMax.value = config.paddingMax;
		}
		if (inputs.currentDirectory) {
			inputs.currentDirectory.value = config.currentDirectory || '/';
		}
		if (inputs.windowWidth) {
			inputs.windowWidth.value = config.windowSizes.width;
		}
		if (inputs.windowHeight) {
			inputs.windowHeight.value = config.windowSizes.height;
		}
		if (inputs.editorTextWidth) {
			inputs.editorTextWidth.value = config.editorContainerSizes.text.width;
		}
		if (inputs.editorTextHeight) {
			inputs.editorTextHeight.value = config.editorContainerSizes.text.height;
		}
		if (inputs.editorHexWidth) {
			inputs.editorHexWidth.value = config.editorContainerSizes.hex.width;
		}
		if (inputs.editorHexHeight) {
			inputs.editorHexHeight.value = config.editorContainerSizes.hex.height;
		}
	},

	renderEditor: function(filePath) {
		var self = this;

		var editorContainer = document.getElementById('editor-container');

		// Clear the editor container
		editorContainer.innerHTML = '';

		// Get the sizes from the config
		var mode = self.editorMode; // 'text' or 'hex'
		var editorSizes = config.editorContainerSizes[mode] || {
			width: 850,
			height: 550
		};

		// Create the editor content container
		var editorContentContainer = E('div', {
			'class': 'editor-content',
			'style': 'flex: 1; display: flex; overflow: hidden;'
		}, []);

		// Action buttons array
		var actionButtons = [];

		if (mode === 'text') {
			// Create line numbers div (initially hidden)
			var lineNumbersDiv = E('div', {
				'id': 'line-numbers',
				'class': 'line-numbers',
				'style': 'display: none;' // Initially hidden
			}, []);

			// Create textarea for text editing
			var editorTextarea = E('textarea', {
				'wrap': 'off',
				'id': 'editor-textarea',
				'style': 'flex: 1; resize: none; border: none; padding: 0; margin: 0; overflow: auto;'
			}, [self.fileContent || '']);

			// Append line numbers and textarea to the editor content container
			editorContentContainer.appendChild(lineNumbersDiv);
			editorContentContainer.appendChild(editorTextarea);

			// Add event listeners for updating line numbers and synchronizing scroll
			editorTextarea.addEventListener('input', self.updateLineNumbers.bind(self));
			editorTextarea.addEventListener('scroll', self.syncScroll.bind(self));
			lineNumbersDiv.addEventListener('scroll', function() {
				editorTextarea.scrollTop = lineNumbersDiv.scrollTop;
			});

			// Define action buttons specific to Text Mode
			actionButtons = [
				E('button', {
					'class': 'btn cbi-button-save custom-save-button',
					'click': function() {
						self.handleSaveFile(filePath);
					}
				}, _('Save')),
				E('button', {
					'class': 'btn',
					'id': 'toggle-hex-mode',
					'style': 'margin-left: 10px;',
					'click': function() {
						self.toggleHexMode(filePath);
					}
				}, _('Toggle to Hex Mode')),
				E('button', {
					'class': 'btn',
					'id': 'toggle-line-numbers',
					'style': 'margin-left: 10px;',
					'click': function() {
						self.toggleLineNumbers();
					}
				}, _('Toggle Line Numbers'))
			];
		} else if (mode === 'hex') {
			// Create hex editor container
			var hexeditContainer = E('div', {
				'id': 'hexedit-container',
				'style': 'flex: 1; overflow: hidden; display: flex; flex-direction: column;'
			});

			// Append hex editor to the editor content container
			editorContentContainer.appendChild(hexeditContainer);

			// Initialize the HexEditor instance

			self.hexEditorInstance = HE.initialize(hexeditContainer);

			// Load data into the HexEditor
			self.hexEditorInstance.setData(self.fileData); // self.fileData is a Uint8Array

			// Define action buttons specific to Hex Mode
			actionButtons = [
				E('button', {
					'class': 'btn cbi-button-save custom-save-button',
					'click': function() {
						self.handleSaveFile(filePath);
					}
				}, _('Save')),
				...(self.textType !== 'hex' ? [
					E('button', {
						'class': 'btn',
						'id': 'toggle-text-mode',
						'style': 'margin-left: 10px;',
						'click': function() {
							self.toggleHexMode(filePath);
						}
					}, _('Toggle to ASCII Mode'))
				] : [])
			];
		}

		// Create the editor container with resizing and scrolling
		var editor = E('div', {
			'class': 'editor-container',
			'style': 'display: flex; flex-direction: column; width: ' + editorSizes.width + 'px; height: ' + editorSizes.height + 'px; resize: both; overflow: hidden;'
		}, [
			editorContentContainer,
			E('div', {
				'class': 'cbi-page-actions'
			}, actionButtons)
		]);

		// Append the editor to the editorContainer
		editorContainer.appendChild(editor);

		// Update status bar and message
		var statusInfo = document.getElementById('status-info');
		if (statusInfo) {
			statusInfo.textContent = _('Editing: ') + filePath;
		}
		var editorMessage = document.getElementById('editor-message');
		if (editorMessage) {
			editorMessage.textContent = _('Editing: ') + filePath;
		}

		// Clear any progress messages
		var statusProgress = document.getElementById('status-progress');
		if (statusProgress) {
			statusProgress.innerHTML = '';
		}

		// **Add ResizeObserver to editor-container to update config.editorContainerSizes**
		if (typeof ResizeObserver !== 'undefined') {
			// Disconnect existing observer if it exists to prevent multiple observers
			if (self.editorResizeObserver) {
				self.editorResizeObserver.disconnect();
				self.editorResizeObserver = null;
			}

			// Initialize a new ResizeObserver instance
			self.editorResizeObserver = new ResizeObserver((entries) => {
				for (let entry of entries) {
					let newWidth = Math.round(entry.contentRect.width);
					let newHeight = Math.round(entry.contentRect.height);

					// Update config only if newWidth and newHeight are greater than 0
					if (newWidth > 0 && newHeight > 0) {
						config.editorContainerSizes[mode].width = newWidth;
						config.editorContainerSizes[mode].height = newHeight;
					}
				}
			});

			// Observe the editor container
			self.editorResizeObserver.observe(editor);
		}
	},

	/**
	 * Toggles the editor mode between text and hex.
	 *
	 * @param {string} filePath - The path of the file to be edited.
	 */
	toggleHexMode: function(filePath) {
		const self = this;

		if (self.editorMode === 'text') {
			// Before switching to hex mode, update self.fileData from the textarea
			const textarea = document.querySelector('#editor-container textarea');
			if (textarea) {
				const content = textarea.value;
				self.fileContent = content;

				// Convert content to Uint8Array
				const encoder = new TextEncoder();
				self.fileData = encoder.encode(content);
			}
			self.editorMode = 'hex';
		} else {
			// Before switching to text mode, check if the file is textual
			if (self.textType !== 'text') {
				pop(null, E('p', _('This file is not a text file and cannot be edited in text mode.')), 'error');
				return; // Abort the toggle
			}

			// Before switching to text mode, update self.fileData from HexEditor
			if (self.hexEditorInstance) {
				const hexData = self.hexEditorInstance.getData();
				if (hexData instanceof Uint8Array) {
					self.fileData = hexData;
				} else {
					pop(null, E('p', _('Failed to retrieve data from Hex Editor.')), 'error');
					return; // Abort the toggle if data retrieval fails
				}
			}

			// Convert self.fileData to string
			const decoder = new TextDecoder();
			try {
				self.fileContent = decoder.decode(self.fileData);
			} catch (error) {
				pop(null, E('p', _('Failed to decode file data to text: %s').format(error.message)), 'error');
				return; // Abort the toggle if decoding fails
			}
			self.editorMode = 'text';
		}

		// Re-render the editor with the updated mode and content
		self.renderEditor(filePath);
	}

});
