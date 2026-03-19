'use strict';
'require view';
'require fs';
'require ui';
'require dom';
'require rpc';
'require view.system.filemanager.md as md';
'require view.system.filemanager.md_help as md_help';
'require view.system.filemanager.HexEditor as HE';

const callFileList = rpc.declare({
	object: 'file',
	method: 'list',
	params: [ 'path' ]
});

const fileTypes = {
	'block' : _('Block device'),
	'char' : _('Character device'),
	'directory' : _('Directory'),
	'fifo' : _('FIFO/Pipe'),
	'file' : _('File'),
	'socket' : _('Socket'),
	'symlink' : _('Symlink'),
}

function pop(a, message, severity) {
	ui.addNotification(a, message, severity)
}

function popTimeout(a, message, timeout, severity) {
	ui.addTimeLimitedNotification(a, message, timeout, severity)
}

// Initialize global variables
let currentPath = '/'; // Current path in the filesystem
const selectedItems = new Set(); // Set of selected files/directories
let sortField = 'name'; // Field to sort files by
let sortAscending = true; // Sort direction (ascending/descending)
let configFilePath = '/etc/config/filemanager'; // Path to the configuration file

// Initialize drag counter
let dragCounter = 0;

// Configuration object to store interface settings
let config = {
	// Column widths in the file table
	columnWidths: {
		'name': 150,
		'type': 100,
		'size': 100,
		'mtime': 150,
		'permissions': 70,
		'actions': 100,
	},

	// Minimum column widths
	columnMinWidths: {
		'name': 100,
		'type': 80,
		'size': 80,
		'mtime': 120,
		'permissions': 70,
		'actions': 80,
	},

	// Maximum column widths
	columnMaxWidths: {
		'name': 300,
		'type': 200,
		'size': 200,
		'mtime': 300,
		'permissions': 70,
		'actions': 200,
	},

	// Padding and window sizes
	padding: 10,
	paddingMin: 5,
	paddingMax: 20,
	currentDirectory: '/', // Current directory

	windowHeight: 800,
	windowWidth: 400,

	texteditorHeight: 550,
	texteditorWidth: 850,
	hexeditorHeight: 550,
	hexeditorWidth: 850,

	// otherSettings: {} // Additional settings
};

// Function to upload a file to the server
function uploadFile(filename, filedata, onProgress) {
	return new Promise(function(resolve, reject) {
		let formData = new FormData();
		formData.append('sessionid', rpc.getSessionID()); // Add session ID
		formData.append('filename', filename); // File name including path
		formData.append('filedata', filedata); // File data

		let xhr = new XMLHttpRequest();
		xhr.open('POST', L.env.cgi_base + '/cgi-upload', true); // Configure the request

		// Monitor upload progress
		xhr.upload.onprogress = function(event) {
			if (event.lengthComputable && onProgress) {
				let percent = (event.loaded / event.total) * 100;
				onProgress(percent); // Call the progress callback with percentage
			}
		};

		// Handle request completion
		xhr.onload = () => {
			if (xhr.status === 200) {
				resolve(xhr.responseText); // Upload successful
			} else {
				reject(new Error(xhr.statusText)); // Upload error
			}
		};

		// Handle network errors
		xhr.onerror = () => {
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
					default:
						config[key] = isNaN(value) ? value : parseInt(value, 10);
				}
			});
		});
	} catch (err) {
		console.error('Failed to load config: ' + err.message);
	}
}

// Function to save settings to the configuration file
function saveConfig() {

	let configLines = ['config filemanager',
		'\toption columnWidths \'' + Object.keys(config.columnWidths).map((field) => {
			return field + ':' + config.columnWidths[field];
		}).join(',') + '\'',
		'\toption columnMinWidths \'' + Object.keys(config.columnMinWidths).map((field) => {
			return field + ':' + config.columnMinWidths[field];
		}).join(',') + '\'',
		'\toption columnMaxWidths \'' + Object.keys(config.columnMaxWidths).map((field) => {
			return field + ':' + config.columnMaxWidths[field];
		}).join(',') + '\'',
		'\toption padding \'' + config.padding + '\'',
		'\toption paddingMin \'' + config.paddingMin + '\'',
		'\toption paddingMax \'' + config.paddingMax + '\'',
		'\toption currentDirectory \'' + config.currentDirectory + '\'',
		'\toption windowHeight \'' + config.windowHeight + '\'',
		'\toption windowWidth \'' + config.windowWidth + '\'',
		'\toption texteditorWidth \'' + config.texteditorWidth + '\'',
		'\toption texteditorHeight \'' + config.texteditorHeight + '\'',
		'\toption hexeditorWidth \'' + config.hexeditorWidth + '\'',
		'\toption hexeditorHeight \'' + config.hexeditorHeight + '\'',
	];

	const configContent = configLines.join('\n') + '\n';

	// Write settings to file
	return fs.write(configFilePath, configContent).then(() => {
		return Promise.resolve();
	}).catch((err) => {
		return Promise.reject(new Error('Failed to save configuration: ' + err.message));
	});
}

// Function to correctly join paths
function joinPath(path, name) {
	return path.endsWith('/') ? path + name : path + '/' + name;
}

function modeToRwx(mode) {
	const perms = mode & 0o777; // extract permission bits

	const toRwx = n => 
		((n & 4) ? 'r' : '-') +
		((n & 2) ? 'w' : '-') +
		((n & 1) ? 'x' : '-');

	const owner = toRwx((perms >> 6) & 0b111);
	const group = toRwx((perms >> 3) & 0b111);
	const world = toRwx(perms & 0b111);

	return `${owner}${group}${world}`;
}


function modeToOctal(mode) {
	const perms = mode & 0o777;
	return perms.toString(8);
}

// Function to get a list of files in a directory
function getFileList(path) {
	return callFileList(path).then((res) => {
		const files = [];
		res?.entries?.forEach((file) => {
			files.push({
				...file,
				permissions: modeToRwx(file.mode),
				numericPermissions: modeToOctal(file.mode),
			});
		});

		return files;
	});
}

// Function to insert CSS styles into the document
function insertCss(cssContent) {
	const styleElement = document.createElement('style');
	styleElement.type = 'text/css';
	styleElement.appendChild(document.createTextNode(cssContent));
	document.head.appendChild(styleElement);
}

// CSS styles for the file manager interface
const cssContent = `
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
	font-family: monospace;
	box-sizing: border-box;
	white-space: nowrap;
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
#file-list-container.resizeable {
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
	load() {
		const self = this;
		return loadConfig().then(() => {
			currentPath = config.currentDirectory || '/';
			return getFileList(currentPath); // Load the file list for the current directory
		});
	},

	// Method to render the interface
	render(data) {
		const self = this;
		insertCss(cssContent); // Insert CSS styles
		const viewContainer = E('div', {
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
					'keydown'(event) {
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
					(() => {
						// Create the container for the file list and drag-and-drop functionality
						const fileListContainer = E('div', {
							'id': 'file-list-container',
							'class': 'resizeable',
							'style': 'width: ' + config.windowWidth + 'px; height: ' + config.windowHeight + 'px;'
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
											'data-field': 'permissions'
										}, [
											_('Permissions'),
											E('button', {
												'class': 'sort-button',
												'data-field': 'permissions',
												'title': _('Sort by Permissions')
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
										E('th', {'data-field': 'actions'}, [
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
										'id': 'windowWidth-input',
										'value': config.windowWidth,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Window Height:')),
									E('input', {
										'type': 'number',
										'id': 'windowHeight-input',
										'value': config.windowHeight,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Text Editor Width:')),
									E('input', {
										'type': 'number',
										'id': 'texteditorWidth-input',
										'value': config.texteditorWidth,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Text Editor Height:')),
									E('input', {
										'type': 'number',
										'id': 'texteditorHeight-input',
										'value': config.texteditorHeight,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Hex Editor Width:')),
									E('input', {
										'type': 'number',
										'id': 'hexeditorWidth-input',
										'value': config.hexeditorWidth,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Hex Editor Height:')),
									E('input', {
										'type': 'number',
										'id': 'hexeditorHeight-input',
										'value': config.hexeditorHeight,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Column Widths (format: name:width,type:width,...):')),
									E('input', {
										'type': 'text',
										'id': 'columnWidths-input',
										'value': Object.values(config.columnWidths).join(''),
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Column Min Widths (format: name:minWidth,type:minWidth,...):')),
									E('input', {
										'type': 'text',
										'id': 'columnMinWidths-input',
										'value': Object.values(config.columnMinWidths).join(''),
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Column Max Widths (format: name:maxWidth,type:maxWidth,...):')),
									E('input', {
										'type': 'text',
										'id': 'columnMaxWidths-input',
										'value': Object.values(config.columnMaxWidths).join(''),
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
										'id': 'paddingMin-input',
										'value': config.paddingMin,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Padding Max:')),
									E('input', {
										'type': 'number',
										'id': 'paddingMax-input',
										'value': config.paddingMax,
										'style': 'width:100%; margin-bottom:10px;'
									})
								]),
								E('div', {}, [
									E('label', {}, _('Current Directory:')),
									E('input', {
										'type': 'text',
										'id': 'currentDirectory-input',
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
		const sortButtons = viewContainer.querySelectorAll('.sort-button[data-field]');
		sortButtons.forEach((button) => {
			button.addEventListener('click', (event) => {
				event.preventDefault();
				const field = button.getAttribute('data-field');
				if (field) {
					self.sortBy(field); // Sort the file list by the selected field
				}
			});
		});
		// Load the file list and initialize resizeable columns
		this.loadFileList(currentPath).then(() => {
			self.initResizeableColumns();
			const fileListContainer = document.getElementById('file-list-container');
			if (fileListContainer && typeof ResizeObserver !== 'undefined') {
				// Initialize ResizeObserver only once
				if (!self.fileListResizeObserver) {
					self.fileListResizeObserver = new ResizeObserver((entries) => {
						for (let entry of entries) {
							const newWidth = entry.contentRect.width;
							const newHeight = entry.contentRect.height;

							// Update config only if newWidth and newHeight are greater than 0
							if (newWidth > 0 && newHeight > 0) {
								config.windowWidth = newWidth;
								config.windowHeight = newHeight;
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
	handleSelectAllClick(ev) {
		if (ev.altKey) {
			ev.preventDefault(); // Prevent the default checkbox behavior
			this.handleInvertSelection();
		} else {
			// Proceed with normal click handling; the 'change' event will be triggered
		}
	},

	// Function to invert selection
	handleInvertSelection() {
		const allCheckboxes = document.querySelectorAll('.select-checkbox');
		allCheckboxes.forEach((checkbox) => {
			checkbox.checked = !checkbox.checked;
			const filePath = checkbox.getAttribute('data-file-path');
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
	switchToTab(tab) {
		// Retrieve the content containers for each tab
		const fileManagerContent = document.getElementById('content-filemanager');
		const editorContent = document.getElementById('content-editor');
		const settingsContent = document.getElementById('content-settings');
		const helpContent = document.getElementById('content-help');

		// Retrieve the tab elements
		const tabFileManager = document.getElementById('tab-filemanager');
		const tabEditor = document.getElementById('tab-editor');
		const tabSettings = document.getElementById('tab-settings');
		const tabHelp = document.getElementById('tab-help');

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
						// Initialize resizeable columns after successfully loading the file list
						this.initResizeableColumns();
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
	renderHelp() {
		const self = this;

		// Convert Markdown to HTML

		const helpContentHTML = md.parseMarkdown(md_help.helpContentMarkdown);


		// Get the Help content container
		const helpContent = document.getElementById('content-help');

		if (helpContent) {
			// Insert the converted HTML into the Help container
			helpContent.innerHTML = helpContentHTML;

			// Initialize resizeable functionality for the Help window
			self.initResizeableHelp();
		} else {
			console.error('Help content container not found.');
			pop(null, E('p', _('Failed to render Help content: Container not found.')), 'error');
		}
	},

	/**
	 * Initializes the resizeable functionality for the Help window.
	 */
	initResizeableHelp() {
		const helpContent = document.getElementById('content-help');

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
	handleGoButtonClick() {
		// Logic to navigate to the specified directory and update the file list
		const self = this;
		const pathInput = document.getElementById('path-input');
		if (pathInput) {
			const newPath = pathInput.value.trim() || '/';
			fs.stat(newPath).then((stat) => {
				if (stat.type === 'directory') {
					currentPath = newPath;
					pathInput.value = currentPath;
					self.loadFileList(currentPath).then(() => {
						self.initResizeableColumns();
					});
				} else {
					pop(null, E('p', _('The specified path does not appear to be a directory.')), 'error');
				}
			}).catch((err) => {
				pop(null, E('p', _('Failed to access the specified path: %s').format(err.message)), 'error');
			});
		}
	},

	// Handler for dragging files over the drop zone
	handleDragEnter(event) {
		event.preventDefault();
		event.stopPropagation();
		dragCounter++;
		const fileListContainer = document.getElementById('file-list-container');
		const dragOverlay = document.getElementById('drag-overlay');
		if (fileListContainer && dragOverlay) {
			fileListContainer.classList.add('drag-over');
			dragOverlay.style.display = 'flex';
		}
	},

	// Handler for when files are over the drop zone
	handleDragOver(event) {
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = 'copy'; // Indicate copy action
	},

	// Handler for leaving the drop zone
	handleDragLeave(event) {
		event.preventDefault();
		event.stopPropagation();
		dragCounter--;
		if (dragCounter === 0) {
			const fileListContainer = document.getElementById('file-list-container');
			const dragOverlay = document.getElementById('drag-overlay');
			if (fileListContainer && dragOverlay) {
				fileListContainer.classList.remove('drag-over');
				dragOverlay.style.display = 'none';
			}
		}
	},

	// Handler for dropping files into the drop zone
	handleDrop(event) {
		event.preventDefault();
		event.stopPropagation();
		dragCounter = 0; // Reset counter
		const self = this;
		const files = event.dataTransfer.files;
		const fileListContainer = document.getElementById('file-list-container');
		const dragOverlay = document.getElementById('drag-overlay');
		if (fileListContainer && dragOverlay) {
			fileListContainer.classList.remove('drag-over');
			dragOverlay.style.display = 'none';
		}
		if (files.length > 0) {
			self.uploadFiles(files);
		}
	},

	// Handler for uploading a file
	handleUploadClick(ev) {
		const self = this;
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.multiple = true; // Allow selecting multiple files
		fileInput.style.display = 'none';
		document.body.appendChild(fileInput);
		fileInput.onchange = (event) => {
			const files = event.target.files;
			if (!files || files.length === 0) {
				pop(null, E('p', _('No file selected.')), 'error');
				return;
			}
			self.uploadFiles(files); // Use the shared upload function
		};
		fileInput.click();
	},

	uploadFiles(files) {
		const self = this;
		const directoryPath = currentPath;
		const statusInfo = document.getElementById('status-info');
		const statusProgress = document.getElementById('status-progress');
		const totalFiles = files.length;
		let uploadedFiles = 0;

		function uploadNextFile(index) {
			if (index >= totalFiles) {
				self.loadFileList(currentPath).then(() => {
					self.initResizeableColumns();
				});
				return;
			}

			const file = files[index];
			const fullFilePath = joinPath(directoryPath, file.name);
			if (statusInfo) {
				statusInfo.textContent = _('Uploading: "%s"...').format(file.name);
			}
			if (statusProgress) {
				statusProgress.innerHTML = '';
				const progressBarContainer = E('div', {
					'class': 'cbi-progressbar',
					'title': '0%'
				}, [E('div', {
					'style': 'width:0%'
				})]);
				statusProgress.appendChild(progressBarContainer);
			}

			uploadFile(fullFilePath, file, (percent) => {
				if (statusProgress) {
					const progressBar = statusProgress.querySelector('.cbi-progressbar div');
					if (progressBar) {
						progressBar.style.width = percent.toFixed(2) + '%';
						statusProgress.querySelector('.cbi-progressbar').setAttribute('title', percent.toFixed(2) + '%');
					}
				}
			}).then(() => {
				if (statusProgress) {
					statusProgress.innerHTML = '';
				}
				if (statusInfo) {
					statusInfo.textContent = _('File "%s" uploaded successfully.').format(file.name);
				}
				popTimeout(null, E('p', _('File "%s" uploaded successfully.').format(file.name)), 5000, 'info');
				uploadedFiles++;
				uploadNextFile(index + 1);
			}).catch((err) => {
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
	handleMakeDirectoryClick(ev) {
		// Logic to create a new directory
		const self = this;
		const statusInfo = document.getElementById('status-info');
		const statusProgress = document.getElementById('status-progress');
		if (statusInfo && statusProgress) {
			statusInfo.innerHTML = '';
			statusProgress.innerHTML = '';
			const dirNameInput = E('input', {
				'type': 'text',
				'placeholder': _('Directory Name'),
				'style': 'margin-right: 10px;'
			});
			const saveButton = E('button', {
				'class': 'btn',
				'disabled': true,
				'click'() {
					self.createDirectory(dirNameInput.value);
				}
			}, _('Save'));
			dirNameInput.addEventListener('input', () => {
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
	createDirectory(dirName) {
		// Execute the 'mkdir' command and update the interface
		const self = this;
		const trimmedDirName = dirName.trim();
		const dirPath = joinPath(currentPath, trimmedDirName);
		fs.exec('mkdir', [dirPath]).then((res) => {
			if (res.code !== 0) {
				return Promise.reject(new Error(res.stderr.trim()));
			}
			popTimeout(null, E('p', _('Directory "%s" created successfully.').format(trimmedDirName)), 5000, 'info');
			self.loadFileList(currentPath).then(() => {
				self.initResizeableColumns();
			});
			const statusInfo = document.getElementById('status-info');
			const statusProgress = document.getElementById('status-progress');
			if (statusInfo) statusInfo.textContent = _('No directory selected.');
			if (statusProgress) statusProgress.innerHTML = '';
		}).catch((err) => {
			pop(null, E('p', _('Failed to create directory "%s": %s').format(trimmedDirName, err.message)), 'error');
		});
	},

	// Handler for creating a file
	handleCreateFileClick(ev) {
		// Logic to create a new file
		const self = this;
		const statusInfo = document.getElementById('status-info');
		const statusProgress = document.getElementById('status-progress');
		if (statusInfo && statusProgress) {
			statusInfo.innerHTML = '';
			statusProgress.innerHTML = '';
			const fileNameInput = E('input', {
				'type': 'text',
				'placeholder': _('File Name'),
				'style': 'margin-right: 10px;'
			});
			const createButton = E('button', {
				'class': 'btn',
				'disabled': true,
				'click'() {
					self.createFile(fileNameInput.value);
				}
			}, _('Create'));
			fileNameInput.addEventListener('input', () => {
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
	createFile(fileName) {
		// Execute the 'touch' command and update the interface
		const self = this;
		const trimmedFileName = fileName.trim();
		const filePath = joinPath(currentPath, trimmedFileName);
		fs.exec('touch', [filePath]).then((res) => {
			if (res.code !== 0) {
				return Promise.reject(new Error(res.stderr.trim()));
			}
			popTimeout(null, E('p', _('File "%s" created successfully.').format(trimmedFileName)), 5000, 'info');
			self.loadFileList(currentPath).then(() => {
				self.initResizeableColumns();
			});
			const statusInfo = document.getElementById('status-info');
			const statusProgress = document.getElementById('status-progress');
			if (statusInfo) statusInfo.textContent = _('No file selected.');
			if (statusProgress) statusProgress.innerHTML = '';
		}).catch((err) => {
			pop(null, E('p', _('Failed to create file "%s": %s').format(trimmedFileName, err.message)), 'error');
		});
	},

	// Handler for checkbox state change on a file
	handleCheckboxChange(ev) {
		const cb = ev.target;
		const filePath = cb.dataset.filePath;

		cb.checked
			? selectedItems.add(filePath)
			: selectedItems.delete(filePath);

		this.updateDeleteSelectedButton();
		this.updateSelectAllCheckbox();
	},

	// Update the "Delete Selected" button
	updateDeleteSelectedButton() {
		const btn = document.getElementById('delete-selected-button');
		if (!btn) return;

		btn.style.display = selectedItems.size > 0 ? '' : 'none';
	},

	// Update the "Select All" checkbox state
	updateSelectAllCheckbox() {
		const selectAll = document.getElementById('select-all-checkbox');
		if (!selectAll) return;

		const checkboxes = [...document.querySelectorAll('.select-checkbox')];
		if (checkboxes.length === 0) {
			selectAll.checked = false;
			selectAll.indeterminate = false;
			return;
		}

		const total = checkboxes.length;
		const checked = checkboxes.filter(cb => cb.checked).length;

		selectAll.checked = checked === total;
		selectAll.indeterminate = checked > 0 && checked < total;
	},

	// Handler for the "Select All" checkbox change
	handleSelectAllChange(ev) {
		const checked = ev.target.checked;
		const checkboxes = [...document.querySelectorAll('.select-checkbox')];

		selectedItems.clear();

		checkboxes.forEach(cb => {
			cb.checked = checked;
			if (checked) selectedItems.add(cb.dataset.filePath);
		});

		this.updateDeleteSelectedButton();
		this.updateSelectAllCheckbox();
	},

	// Handler for deleting selected items
	handleDeleteSelected() {
		// Delete selected files and directories
		const self = this;
		if (selectedItems.size === 0) {
			return;
		}
		if (!confirm(_('Are you sure you want to delete the selected files and directories?'))) {
			return;
		}
		const promises = [];
		selectedItems.forEach((filePath) => {
			promises.push(fs.remove(filePath).catch((err) => {
				pop(null, E('p', _('Failed to delete %s: %s').format(filePath, err.message)), 'error');
			}));
		});
		Promise.all(promises).then(() => {
			popTimeout(null, E('p', _('Selected files and directories deleted successfully.')), 5000, 'info');
			selectedItems.clear();
			self.updateDeleteSelectedButton();
			self.loadFileList(currentPath).then(() => {
				self.initResizeableColumns();
			});
		}).catch((err) => {
			pop(null, E('p', _('Failed to delete selected files and directories: %s').format(err.message)), 'error');
		});
	},

	// Function to load the file list
	loadFileList(path) {
		const self = this;
		selectedItems.clear();

		return getFileList(path).then(files => {
			// 1. Get column order dynamically from table header
			const columns = Array.from(
				document.querySelectorAll('#file-table thead th[data-field]')
			).map(th => th.getAttribute('data-field'));


			const fileList = document.getElementById('file-list');
			if (!fileList) {
				pop(null, E('p', _('Failed to display the file list.')), 'error');
				return;
			}

			fileList.innerHTML = '';
			files.sort(self.compareFiles.bind(self));

			//
			// Add ".." parent row
			//
			if (path !== '/') {
				const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';

				const tr = E('tr', {
					'data-file-path': parentPath,
					'data-file-type': 'directory'
				});

				// Create cells for *every* column
				for (const col of columns) {
					if (col === 'name') {
						tr.appendChild(
							E('td', { colspan: columns.length }, [
								E('a', {
									href: '#',
									click: () => self.handleDirectoryClick(parentPath)
								}, '.. (Parent Directory)')
							])
						);
						break;
					} else {
						tr.appendChild(E('td')); // empty cell
					}
				}

				fileList.appendChild(tr);
			}

			//
			// 2. For each file, create row dynamically
			//
			for (const file of files) {
				const fullPath = joinPath(path, file.name);
				const tr = E('tr', {
					'data-file-path': fullPath,
					'data-file-type': file.type,
					'data-permissions': file.permissions,
					'data-numeric-permissions': file.numericPermissions,
					'data-owner': file?.user || file.uid,
					'data-group': file?.group || file.gid,
					'data-size': file.size
				});

				//
				// Prebuild common reusable items
				//
				const nameLink = E('a', {
					href: '#',
					title: file.permissions,
					class: `${file.type}-link`,
					click(event) {
						if (file.type === 'directory' || file?.target?.type === 'directory') {
							self.handleDirectoryClick(fullPath);
						} else {
							event.preventDefault();
							self.handleFileClick(fullPath, event.altKey ? 'hex' : 'text');
						}
					}
				}, file?.target ? `${file.name} → ${file.target?.name}` : file.name);

				const actions = [];
				const checkbox = E('input', {
					type: 'checkbox',
					class: 'select-checkbox',
					'data-file-path': fullPath,
					change: ev => self.handleCheckboxChange(ev)
				});
				actions.push(checkbox);

				actions.push(E('span', {
					class: 'edit-button',
					title: _('Edit properties'),
					click: () => self.handleEditFile(fullPath, file)
				}, '✏️'));

				actions.push(E('span', {
					class: 'duplicate-button',
					title: _('Duplicate'),
					click: () => self.handleDuplicateFile(fullPath, file)
				}, '📑'));

				actions.push(E('span', {
					class: 'delete-button',
					title: _('Delete'),
					click: () => self.handleDeleteFile(fullPath, file)
				}, '🗑️'));

				if (file.type === 'file') {
					actions.push(E('span', {
						class: 'download-button',
						title: _('Download'),
						click: () => self.handleDownloadFile(fullPath)
					}, '⬇️'));
				}

				//
				// 3. Build `<td>` dynamically based on column definitions
				//
				for (const col of columns) {
					let td;

					switch (col) {
						case 'name':
							td = E('td', {}, [nameLink]);
							break;

						case 'type':
							td = E('td', {}, fileTypes[file.type] || file.type);
							break;

						case 'size':
							if (file.type === 'directory' || (file.type === 'symlink' && file.size === -1)) {
								td = E('td', { class: 'size-cell' }, [
									E('span', { class: 'size-number' }, '-'),
									E('span', { class: 'size-unit' }, ''),
								]);
							} else {
								const formatted = self.getFormattedSize(file.size);
								td = E('td', { class: 'size-cell' }, [
									E('span', { class: 'size-number' }, formatted.number),
									E('span', { class: 'size-unit' }, formatted.unit)
								]);
							}
							break;

						case 'mtime':
							td = E('td', {}, new Date(file.mtime * 1000).toLocaleString());
							break;

						case 'actions':
							td = E('td', {}, actions);
							break;

						case 'permissions':
							td = E('td', {}, file.permissions);
							break;

						default:
							// Support future dynamically-added columns
							td = E('td', {}, file[col] ?? '');
							break;
					}

					tr.appendChild(td);
				}

				fileList.appendChild(tr);
			}

			//
			// housekeeping
			//
			const statusInfo = document.getElementById('status-info');
			const statusProgress = document.getElementById('status-progress');

			if (statusInfo) statusInfo.textContent = _('No file selected.');
			if (statusProgress) statusProgress.innerHTML = '';

			self.setInitialColumnWidths();
			self.updateSelectAllCheckbox();
			self.updateDeleteSelectedButton();
			return Promise.resolve();
		}).catch((err) => {
			pop(null, E('p', _('Failed to load file list: %s').format(err.message)), 'error');
			return Promise.reject(err);
		});
	},

	// Function to format file size
	getFormattedSize(size) {
		/* 64 bit systems i.e. rpcd have max size of 128 TB */
		const units = [' ', 'K', 'M', 'G', 'T'];
		let index = 0;
		let value = size;

		if (size > 0) {
			// Keep dividing until below 1024 or no more units
			while (value >= 1024 && index < units.length - 1) {
				value /= 1024;
				index++;
			}
		}

		// Format to 2 decimals, always 6 chars wide
		const num = value.toFixed(2).padStart(6, ' ');

		return {
			number: num,
			unit: ' ' + units[index] + 'B'
		};
	},

	// Function to sort files
	sortBy(field) {
		// Change the sort field and direction, and reload the file list
		if (sortField === field) {
			sortAscending = !sortAscending;
		} else {
			sortField = field;
			sortAscending = true;
		}
		this.loadFileList(currentPath);
	},

	// Function to compare files for sorting
	compareFiles(a, b) {
		// Compare files based on the selected field and direction
		const order = sortAscending ? 1 : -1;
		let aValue = a[sortField];
		let bValue = b[sortField];
		if (sortField === 'size') {
			aValue = (a.type === 'directory' || (a.type === 'symlink' && a.size === -1)) ? -1 : a.size;
			bValue = (b.type === 'directory' || (b.type === 'symlink' && b.size === -1)) ? -1 : b.size;
		}
		if (aValue < bValue) return -1 * order;
		if (aValue > bValue) return 1 * order;
		return 0;
	},

	// Set initial column widths in the table
	setInitialColumnWidths() {
		// Apply column width settings to the file table
		const table = document.getElementById('file-table');
		if (!table) {
			return;
		}
		const headers = table.querySelectorAll('th');
		headers.forEach((header, index) => {
			const field = header.getAttribute('data-field');
			if (field && config.columnWidths[field]) {
				const width = config.columnWidths[field];
				const minWidth = config.columnMinWidths[field] || 50;
				const maxWidth = config.columnMaxWidths[field] || 500;
				header.style.width = width + 'px';
				header.style.minWidth = minWidth + 'px';
				header.style.maxWidth = maxWidth + 'px';
				const rows = table.querySelectorAll('tr');
				rows.forEach((row, rowIndex) => {
					const cell = row.children[index];
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
	handleDirectoryClick(newPath) {
		// Navigate to the selected directory and update the file list
		const self = this;
		currentPath = newPath || '/';
		const pathInput = document.getElementById('path-input');
		if (pathInput) {
			pathInput.value = currentPath;
		}
		this.loadFileList(currentPath).then(() => {
			self.initResizeableColumns();
		});
	},

	/**
	 * Determines whether a given Uint8Array represents UTF-8 text data.
	 *
	 * @param {Uint8Array} uint8Array - The binary data to check.
	 * @returns {boolean} - Returns true if the data is UTF-8 text, false otherwise.
	 */
	isText(uint8Array) {

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
	handleFileClick(filePath, mode) {
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
	adjustLineNumbersPadding() {
		// Update padding based on scrollbar size
		const lineNumbersDiv = document.getElementById('line-numbers');
		const editorTextarea = document.getElementById('editor-textarea');
		if (!lineNumbersDiv || !editorTextarea) {
			return;
		}
		const scrollbarHeight = editorTextarea.offsetHeight - editorTextarea.clientHeight;
		lineNumbersDiv.style.paddingBottom = scrollbarHeight + 'px';
	},

	// Handler for downloading a file
	handleDownloadFile(filePath) {
		// Download the file to the user's local machine
		const self = this;
		const fileName = filePath.split('/').pop();
		// Use the read_direct method to download the file
		fs.read_direct(filePath, 'blob')
			.then((blob) => {
				if (!(blob instanceof Blob)) {
					throw new Error(_('Response is not a Blob'));
				}
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = fileName;
				document.body.appendChild(a);
				a.click();
				a.remove();
				window.URL.revokeObjectURL(url);
			}).catch((err) => {
				pop(null, E('p', _('Failed to download file "%s": %s').format(fileName, err.message)), 'error');
			});
	},

	// Handler for deleting a file
	handleDeleteFile(filePath, fileInfo) {
		// Delete the selected file or directory
		const self = this;
		const itemName = filePath.split('/').pop();
		const itemTypeLabel = fileTypes[fileInfo?.type];

		if (confirm(_('Are you sure you want to delete this %s: "%s"?').format(itemTypeLabel, itemName))) {
			fs.remove(filePath).then(() => {
				popTimeout(null, E('p', _('Successfully deleted %s: "%s".').format(itemTypeLabel, itemName)), 5000, 'info');
				self.loadFileList(currentPath).then(() => {
					self.initResizeableColumns();
				});
				const statusInfo = document.getElementById('status-info');
				if (statusInfo) {
					statusInfo.textContent = _('Deleted %s: "%s".').format(itemTypeLabel, itemName);
				}
			}).catch((err) => {
				pop(null, E('p', _('Failed to delete %s "%s": %s').format(itemTypeLabel, itemName, err.message)), 'error');
			});
		}
	},

	// Update line numbers in the text editor
	updateLineNumbers() {
		// Update the line numbers display when the text changes
		const lineNumbersDiv = document.getElementById('line-numbers');
		const editorTextarea = document.getElementById('editor-textarea');
		if (!lineNumbersDiv || !editorTextarea) return;

		// Count lines
		const lineCount = editorTextarea.value.split('\n').length;

		// Build HTML using join — much faster than concatenation
		lineNumbersDiv.innerHTML = Array.from({ length: lineCount }, (_, i) => `<div>${i + 1}</div>`).join('');
	},

	// Synchronize scrolling between line numbers and text
	syncScroll() {
		// Sync scrolling of line numbers with the text area
		const lineNumbersDiv = document.getElementById('line-numbers');
		const editorTextarea = document.getElementById('editor-textarea');
		if (!lineNumbersDiv || !editorTextarea) {
			return;
		}
		lineNumbersDiv.scrollTop = editorTextarea.scrollTop;
	},

	// Toggle line numbers display in the editor
	toggleLineNumbers() {
		// Ensure the editor is in Text Mode before toggling line numbers
		if (this.editorMode !== 'text') {
			console.warn('Toggle Line Numbers is only available in Text Mode.');
			return;
		}

		// Get the line numbers div and the textarea
		const lineNumbersDiv = document.getElementById('line-numbers');
		const editorTextarea = document.getElementById('editor-textarea');
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
	getCopyName(originalName, existingNames) {
		// Split filename into base name + extension
		const dotIndex = originalName.lastIndexOf('.');
		const hasExt = dotIndex > 0 && dotIndex < originalName.length - 1;

		const base = hasExt ? originalName.slice(0, dotIndex) : originalName;
		const ext  = hasExt ? originalName.slice(dotIndex) : '';

		// First attempt: "name (copy).ext"
		let candidate = `${base} (copy)${ext}`;

		// If taken, try: "name (copy 2).ext", "name (copy 3).ext", ...
		let counter = 2;
		while (existingNames.includes(candidate)) {
			candidate = `${base} (copy ${counter++})${ext}`;
		}

		return candidate;
	},

	// Handler for duplicating a file
	handleDuplicateFile(filePath, fileInfo) {
		// Copy the file or directory with a new name
		const self = this;
		getFileList(currentPath).then((files) => {
			const existingNames = files.map((f) => {
				return f.name;
			});
			const newName = self.getCopyName(fileInfo.name, existingNames);
			const newPath = joinPath(currentPath, newName);
			let command;
			let args;
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
			fs.exec(command, args).then((res) => {
				if (res.code !== 0) {
					return Promise.reject(new Error(res.stderr.trim()));
				}
				popTimeout(null, E('p', _('Successfully duplicated %s "%s" as "%s".').format(_('item'), fileInfo.name, newName)), 5000, 'info');
				self.loadFileList(currentPath).then(() => {
					self.initResizeableColumns();
				});
			}).catch((err) => {
				pop(null, E('p', _('Failed to duplicate %s "%s": %s').format(_('item'), fileInfo.name, err.message)), 'error');
			});
		}).catch((err) => {
			pop(null, E('p', _('Failed to get file list: %s').format(err.message)), 'error');
		});
	},

	// Handler for saving a file after editing
	handleSaveFile(filePath) {
		const self = this;
		let contentBlob;

		if (self.editorMode === 'text') {
			const textarea = document.querySelector('#editor-container textarea');
			if (!textarea) {
				pop(null, E('p', _('Editor textarea not found.')), 'error');
				return;
			}
			const content = textarea.value;
			self.fileContent = content;

			// Convert content to Uint8Array in chunks not exceeding 8KB
			const CHUNK_SIZE = 8 * 1024; // 8KB
			const totalLength = content.length;
			let chunks = [];
			for (let i = 0; i < totalLength; i += CHUNK_SIZE) {
				const chunkStr = content.slice(i, i + CHUNK_SIZE);
				const chunkBytes = new TextEncoder().encode(chunkStr);
				chunks.push(chunkBytes);
			}
			// Concatenate chunks into a single Uint8Array
			const totalBytes = chunks.reduce((prev, curr) => {
				return prev + curr.length;
			}, 0);
			let dataArray = new Uint8Array(totalBytes);
			let offset = 0;
			chunks.forEach((chunk) => {
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

		const statusInfo = document.getElementById('status-info');
		const statusProgress = document.getElementById('status-progress');
		const fileName = filePath.split('/').pop();
		if (statusInfo) {
			statusInfo.textContent = _('Saving file: "%s"...').format(fileName);
		}
		if (statusProgress) {
			statusProgress.innerHTML = '';
			const progressBarContainer = E('div', {
				'class': 'cbi-progressbar',
				'title': '0%'
			}, [E('div', {
				'style': 'width:0%'
			})]);
			statusProgress.appendChild(progressBarContainer);
		}

		uploadFile(filePath, contentBlob, (percent) => {
			if (statusProgress) {
				const progressBar = statusProgress.querySelector('.cbi-progressbar div');
				if (progressBar) {
					progressBar.style.width = percent.toFixed(2) + '%';
					statusProgress.querySelector('.cbi-progressbar').setAttribute('title', percent.toFixed(2) + '%');
				}
			}
		}).then(() => {
			const permissions = self.originalFilePermissions;
			if (permissions !== undefined) {
				return fs.exec('chmod', [permissions, filePath]).then((res) => {
					if (res.code !== 0) {
						throw new Error(res.stderr.trim());
					}
				}).then(() => {
					if (statusInfo) {
						statusInfo.textContent = _('File "%s" uploaded successfully.').format(fileName);
					}
					popTimeout(null, E('p', _('File "%s" uploaded successfully.').format(fileName)), 5000, 'info');
					return self.loadFileList(currentPath).then(() => {
						self.initResizeableColumns();
					});
				}).catch((err) => {
					pop(null, E('p', _('Failed to apply permissions to file "%s": %s').format(fileName, err.message)), 'error');
				});
			} else {
				if (statusInfo) {
					statusInfo.textContent = _('File "%s" uploaded successfully.').format(fileName);
				}
				popTimeout(null, E('p', _('File "%s" uploaded successfully.').format(fileName)), 5000, 'info');
				return self.loadFileList(currentPath).then(() => {
					self.initResizeableColumns();
				});
			}
		}).catch((err) => {
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
	handleSymlinkClick(linkPath, targetPath, mode) {
		// Navigate to the target of the symbolic link
		const self = this;
		if (!targetPath.startsWith('/')) {
			targetPath = joinPath(currentPath, targetPath);
		}
		fs.stat(targetPath).then((stat) => {
			if (stat.type === 'directory') {
				self.handleDirectoryClick(targetPath);
			} else if (stat.type === 'file') {
				self.handleFileClick(targetPath, mode);
			} else {
				pop(null, E('p', _('The symlink points to an unsupported type.')), 'error');
			}
		}).catch((err) => {
			pop(null, E('p', _('Failed to access symlink target: %s').format(err.message)), 'error');
		});
		const statusInfo = document.getElementById('status-info');
		if (statusInfo) {
			statusInfo.textContent = _('Symlink: ') + linkPath + ' -> ' + targetPath;
		}
	},

	// Initialize resizeable columns in the table
	initResizeableColumns() {
		// Add handlers to adjust column widths
		const self = this;
		const table = document.getElementById('file-table');
		if (!table) {
			return;
		}
		const headers = table.querySelectorAll('th');
		headers.forEach((header, index) => {
			const resizer = header.querySelector('.resizer');
			if (resizer) {
				resizer.removeEventListener('mousedown', header.resizeHandler);
				header.resizeHandler = (e) => {
					e.preventDefault();
					const startX = e.pageX;
					const startWidth = header.offsetWidth;
					const field = header.getAttribute('data-field');
					const minWidth = config.columnMinWidths[field] || 50;
					const maxWidth = config.columnMaxWidths[field] || 500;

					function doDrag(e) {
						const currentX = e.pageX;
						const newWidth = startWidth + (currentX - startX);
						if (newWidth >= minWidth && newWidth <= maxWidth) {
							header.style.width = newWidth + 'px';
							if (field) {
								config.columnWidths[field] = newWidth;
							}
							const rows = table.querySelectorAll('tr');
							rows.forEach((row, rowIndex) => {
								const cell = row.children[index];
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
	handleEditFile(filePath, fileInfo) {
		// Display a form to edit the file's properties
		const self = this;
		const statusInfo = document.getElementById('status-info');
		const statusProgress = document.getElementById('status-progress');
		if (statusInfo && statusProgress) {
			statusInfo.innerHTML = '';
			statusProgress.innerHTML = '';
			const nameInput = E('input', {
				'type': 'text',
				'value': fileInfo.name,
				'placeholder': fileInfo.name,
				'style': 'margin-right: 10px;'
			});
			const permsInput = E('input', {
				'type': 'text',
				'placeholder': fileInfo.numericPermissions,
				'style': 'margin-right: 10px; width: 80px;'
			});
			const ownerInput = E('input', {
				'type': 'text',
				'placeholder': fileInfo?.user || fileInfo.uid,
				'style': 'margin-right: 10px; width: 100px;'
			});
			const groupInput = E('input', {
				'type': 'text',
				'placeholder': fileInfo?.group || fileInfo.gid,
				'style': 'margin-right: 10px; width: 100px;'
			});
			const saveButton = E('button', {
				'class': 'btn',
				'disabled': true,
				'click'() {
					self.saveFileChanges(filePath, fileInfo, nameInput.value, permsInput.value, ownerInput.value, groupInput.value);
				}
			}, _('Save'));
			[nameInput, permsInput, ownerInput, groupInput].forEach((input) => {
				input.addEventListener('input', () => {
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
	saveFileChanges(filePath, fileInfo, newName, newPerms, newOwner, newGroup) {
		// Apply changes and update the interface
		const self = this;
		const commands = [];
		const originalPath = filePath;
		const originalName = fileInfo.name;
		const newItemName = newName || originalName;

		if (newName && newName !== fileInfo.name) {
			const newPath = joinPath(currentPath, newName);
			commands.push(['mv', [filePath, newPath]]);
			filePath = newPath;
		}
		if (newPerms) {
			commands.push(['chmod', [newPerms, filePath]]);
		}

		if (newOwner || newGroup) {
			const owner = newOwner ?? (fileInfo?.user || fileInfo.uid);
			const group = newGroup ?? (fileInfo?.group || fileInfo.gid);

			commands.push(['chown', [`${owner}:${group}`, filePath]]);
		}

		let promise = Promise.resolve();
		commands.forEach((cmd) => {
			promise = promise.then(() => {
				return fs.exec(cmd[0], cmd[1]).then((res) => {
					if (res.code !== 0) {
						return Promise.reject(new Error(res.stderr.trim()));
					}
				});
			});
		});
		promise.then(() => {
			popTimeout(null, E('p', _('Changes to %s "%s" uploaded successfully.').format(_('item'), newItemName)), 5000, 'info');
			self.loadFileList(currentPath).then(() => {
				self.initResizeableColumns();
			});
			const statusInfo = document.getElementById('status-info');
			const statusProgress = document.getElementById('status-progress');
			if (statusInfo) statusInfo.textContent = _('No item selected.');
			if (statusProgress) statusProgress.innerHTML = '';
		}).catch((err) => {
			pop(null, E('p', _('Failed to save changes to %s "%s": %s').format(_('item'), newItemName, err.message)), 'error');
		});
	},

	handleSaveSettings(ev) {
		ev.preventDefault();
		var self = this;

		const parseAndSetConfig = (configPath, value) => {
			const input = document.getElementById(`${configPath}-input`);
			if (!input) return;
			let v = input.value.trim();

			if (typeof value == 'object') {
				parseKeyValuePairs(v, ':', (k, v) => {
					config[configPath][k] = parseInt(v, 10);
				});

			} else 
				config[configPath] = v;
		};

		Object.entries(config).forEach(([configPath, value]) => {
			parseAndSetConfig(configPath, value);
		});

			saveConfig().then(() => {
				popTimeout(null, E('p', _('Settings uploaded successfully.')), 5000, 'info');
				self.setInitialColumnWidths();
				const styleElement = document.querySelector('style');
				if (styleElement) {
					styleElement.textContent = styleElement.textContent.replace(/padding: \d+px/g, 'padding: ' + config.padding + 'px');
				}
				const fileListContainer = document.getElementById('file-list-container');
				if (fileListContainer) {
					fileListContainer.style.width = config.windowWidth + 'px';
					fileListContainer.style.height = config.windowHeight + 'px';
				}
				currentPath = config.currentDirectory || '/';
				const pathInput = document.getElementById('path-input');
				if (pathInput) {
					pathInput.value = currentPath;
				}
				self.loadFileList(currentPath).then(() => {
					self.initResizeableColumns();
				});
				const editorContainer = document.getElementById('editor-container');
				if (editorContainer) {
					const editorMode = self.editorMode;
					const editorSizes = {
						width: config[`${editorMode}editorWidth`] || 850,
						height: config[`${editorMode}editorHeight`] || 550
					};
					editorContainer.style.width = editorSizes.width + 'px';
					editorContainer.style.height = editorSizes.height + 'px';
				}
			}).catch((err) => {
				pop(null, E('p', _('Failed to save settings: %s').format(err.message)), 'error');
			});
	},

	// Load settings into the settings form
	loadSettings() {
		const setInputValue = (inputId, value) => {
			const input = document.getElementById(`${inputId}-input`);
			if (!input) return;
			let v;
			if (typeof value == 'object')
				input.value = Object.entries(value).map(([id, value]) => {
					return `${id}:${value}`
				}).join(',');
			else
				input.value = value;
		};

		Object.entries(config).forEach(([inputId, value]) => {
			setInputValue(inputId, value);
		});
	},

	updateUI() {
		const styleElement = document.querySelector('style');
		if (styleElement) {
			styleElement.textContent = styleElement.textContent.replace(/padding: \d+px/g, `padding: ${config.padding}px`);
		}

		const fileListContainer = document.getElementById('file-list-container');
		if (fileListContainer) {
			fileListContainer.style.width = `${config.windowWidth}px`;
			fileListContainer.style.height = `${config.windowHeight}px`;
		}

		const editorContainer = document.getElementById('editor-container');
		if (editorContainer) {
			const editorMode = this.editorMode;
			const editorHeight = config[`${editorMode}editorHeight`] || 550;
			const editorWidth = config[`${editorMode}editorWidth`] || 850;
			editorContainer.style.width = `${editorWidth}px`;
			editorContainer.style.height = `${editorHeight}px`;
		}
	},

	renderEditor(filePath) {
		const self = this;

		const editorContainer = document.getElementById('editor-container');

		// Clear the editor container
		editorContainer.innerHTML = '';

		// Get the sizes from the config
		const mode = self.editorMode; // 'text' or 'hex'
		const editorHeight = config[`${mode}editorHeight`] || 550;
		const editorWidth = config[`${mode}editorWidth`] || 850;

		// Create the editor content container
		const editorContentContainer = E('div', {
			'class': 'editor-content',
			'style': 'flex: 1; display: flex; overflow: hidden;'
		}, []);

		// Action buttons array
		let actionButtons = [];

		if (mode === 'text') {
			// Create line numbers div (initially hidden)
			const lineNumbersDiv = E('div', {
				'id': 'line-numbers',
				'class': 'line-numbers',
				'style': 'display: none;' // Initially hidden
			}, []);

			// Create textarea for text editing
			const editorTextarea = E('textarea', {
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
			lineNumbersDiv.addEventListener('scroll', () => {
				editorTextarea.scrollTop = lineNumbersDiv.scrollTop;
			});

			// Define action buttons specific to Text Mode
			actionButtons = [
				E('button', {
					'class': 'btn cbi-button-save custom-save-button',
					'click'() {
						self.handleSaveFile(filePath);
					}
				}, _('Save')),
				E('button', {
					'class': 'btn',
					'id': 'toggle-hex-mode',
					'style': 'margin-left: 10px;',
					'click'() {
						self.toggleHexMode(filePath);
					}
				}, _('Toggle to Hex Mode')),
				E('button', {
					'class': 'btn',
					'id': 'toggle-line-numbers',
					'style': 'margin-left: 10px;',
					'click'() {
						self.toggleLineNumbers();
					}
				}, _('Toggle Line Numbers'))
			];
		} else if (mode === 'hex') {
			// Create hex editor container
			const hexeditContainer = E('div', {
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
					'click'() {
						self.handleSaveFile(filePath);
					}
				}, _('Save')),
				...(self.textType !== 'hex' ? [
					E('button', {
						'class': 'btn',
						'id': 'toggle-text-mode',
						'style': 'margin-left: 10px;',
						'click'() {
							self.toggleHexMode(filePath);
						}
					}, _('Toggle to ASCII Mode'))
				] : [])
			];
		}

		// Create the editor container with resizing and scrolling
		const editor = E('div', {
			'class': 'editor-container',
			'style': 'display: flex; flex-direction: column; width: ' + editorWidth + 'px; height: ' + editorHeight + 'px; resize: both; overflow: hidden;'
		}, [
			editorContentContainer,
			E('div', {
				'class': 'cbi-page-actions'
			}, actionButtons)
		]);

		// Append the editor to the editorContainer
		editorContainer.appendChild(editor);

		// Update status bar and message
		const statusInfo = document.getElementById('status-info');
		if (statusInfo) {
			statusInfo.textContent = _('Editing: ') + filePath;
		}
		const editorMessage = document.getElementById('editor-message');
		if (editorMessage) {
			editorMessage.textContent = _('Editing: ') + filePath;
		}

		// Clear any progress messages
		const statusProgress = document.getElementById('status-progress');
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
						config.editorWidth = newWidth;
						config.editorHeight = newHeight;
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
	toggleHexMode(filePath) {
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
