'use strict';
'require fs';
'require ui';
'require rpc';

/***
# Navigation Plugin: User Functionality Overview

## 1. Directory Navigation and Traversal

- **Path Input Field:**  
  Users can enter a specific directory path directly into the input field and navigate to it by pressing "Enter" or clicking the "Go" button.

- **Breadcrumb Navigation:**  
  Displays the current directory path in a breadcrumb format, allowing users to quickly navigate to any parent directory by clicking on the respective breadcrumb link.

- **Clickable Directory Names:**  
  Users can navigate into subdirectories by clicking on directory names listed in the table.

## 2. File and Directory Operations

- **Upload Files:**
  - **Upload Button:**  
    Click to open a file dialog and select multiple files for upload.
  - **Drag-and-Drop:**  
    Drag files from the local system and drop them into the navigation area to initiate uploads.

- **Download Files:**  
  Click the download icon (⬇️) next to a file to download it to the local system.

- **Create New Folder/File:**
  - **Create Folder Button:**  
    Prompts the user to enter a folder name and creates it in the current directory.
  - **Create File Button:**  
    Prompts the user to enter a file name and creates an empty file in the current directory.

- **Delete Items:**
  - **Select Items:**  
    Use checkboxes to select individual files or directories.
  - **Delete Selected Button:**  
    Deletes all selected items after user confirmation.

- **Copy and Move Items:**
  - **Drag-and-Drop Within UI:**  
    Drag selected files or directories to a target directory to copy or move them.
    - **Copy Operation:**  
      Hold the "Alt" key while dragging to copy items.
    - **Move Operation:**  
      Drag without holding any modifier keys to move items.

## 3. Bulk Selection and Management

- **Select/Deselect All Checkbox:**  
  Located in the table header, allows users to select or deselect all items in the current directory view. Pressing with "Alt" inverses current selection

- **Individual Selection:**  
  Checkboxes next to each item enable selective management of files and directories.

## 4. Editing Files attributes

- **Edit Button (✏️):**  
  Opens a window for file attributes editing.
  - **File Attributes:**  
    Users can rename the file, change its owner and group, and modify permissions directly from the edit interface.

## 5. User Interface Customization

- **Resizable Columns:**  
  Users can adjust the width of table columns by dragging the resizers between column headers. The plugin enforces minimum widths to maintain usability.

- **Themes:**
  - **Light Theme:**  
    Default styling with a white background and dark text.
  - **Dark Theme:**  
    Optional dark mode with dark backgrounds and light text for reduced eye strain.

## 6. Drag-and-Drop Enhancements

- **Internal Drag-and-Drop:**
  - **Visual Indicators:**  
    Highlight target directories during drag-over events to indicate valid drop zones.
  - **Action Icons:**  
    Displays a plus icon (➕) when holding the "Alt" key to signify a copy operation.

- **External Drag-and-Drop:**
  - **File Downloads:**  
    Dragging files out of the navigation UI initiates their download to the local system.
  - **File Uploads:**  
    Dropping files into the navigation UI area uploads them to the current directory.

## 7. Feedback and Status Indicators

- **Loading Indicators:**  
  Display a "Loading..." message while fetching directory contents.

- **Progress Bars:**  
  Show upload progress for individual files.

- **Tooltips:**  
  Provides additional information when hovering over overflowing text in file names.

- **Status Messages:**  
  Informs users of successful operations or errors through pop-up messages and inline notifications.

## 8. Advanced Features

- **Permissions and Ownership Management:**  
  Allows users to view and modify file permissions and ownership directly from the UI.

- **Symbolic Link Handling:**  
  Properly displays and manages symbolic links, including their targets.

- **Responsive Design:**  
  Adapts to different screen sizes and container dimensions, ensuring usability across various devices.

## 9. Integration with Other Plugins

- **Editor Plugin Integration:**  
  Seamlessly works with default editor plugins to provide in-browser file editing capabilities.

- **Dispatcher Integration:**  
  Utilizes dispatcher plugins for executing file system commands and handling asynchronous operations.

## 10. Error Handling and Validation

- **User Prompts:**  
  Confirms critical actions like deletions to prevent accidental data loss.

- **Error Notifications:**  
  Clearly communicates issues such as failed uploads, permission errors, or invalid paths to the user.
***/

// Define the plugin name as a constant
const PN = 'Navigation';

return Class.extend({
	/**
	 * Provides metadata about the plugin.
	 * @returns {Object} - Contains at least name, type, and description properties.
	 */
	info: function() {
		return {
			name: PN,
			type: 'Navigation',
			description: 'Enhanced file system navigator with additional functionalities'
		};
	},

	/**
	 * Retrieves the current configuration settings of the plugin.
	 * @returns {Object} - Key-value pairs of settings.
	 */
	get_settings: function() {
		return this.settings || {};
	},

	/**
	 * Default settings for the plugin.
	 */
	defaultSettings: {
		currentDir: '/',
		width: 900, // Number
		height: 800, // Number
		defaultFilePermissions: '644',
		defaultDirPermissions: '755',
		defaultOwner: 'root',
		defaultGroup: 'root',
		columnWidths: {
			'select': 30,
			'name': 200,
			'type': 100,
			'size': 100,
			'mtime': 150,
			'actions': 150
		},
		mincolumnWidths: { // Adding minimum column widths
			'select': 20,
			'name': 110,
			'type': 50,
			'size': 50,
			'mtime': 80,
			'actions': 100
		}
	},

	/**
	 * Applies settings to internal properties and UI elements.
	 */
	applySettingsToUI: function() {
		var self = this;

		// Merging current settings with default settings
		self.settings = Object.assign({}, self.defaultSettings, self.settings || {});

		// Updating internal plugin properties
		self.currentDir = self.settings.currentDir;
		self.defaultFilePermissions = self.settings.defaultFilePermissions;
		self.defaultDirPermissions = self.settings.defaultDirPermissions;
		self.columnWidths = self.settings.columnWidths;
		self.mincolumnWidths = self.settings.mincolumnWidths;

		// Setting fixed sizes for the navigation container
		if (self.settings.width) {
			self.navDiv.style.width = self.settings.width + 'px';
		}
		if (self.settings.height) {
			self.navDiv.style.height = self.settings.height + 'px';
		}

		// Setting sizes for tableContainer
		self.tableContainer.style.width = '100%';
		self.tableContainer.style.height = '100%';

		// Applying column widths and calculating total table width
		var totalWidth = 0;
		if (self.settings.columnWidths) {
			Object.keys(self.settings.columnWidths).forEach(function(field) {
				var newWidth = self.settings.columnWidths[field];
				var col = self.table.querySelector(`col[data-field="${field}"]`);
				if (col) {
					// Ensure that the width is not less than the minimum
					var minWidth = self.mincolumnWidths[field] || 30; // If mincolumnWidths is not set, use 30px
					if (newWidth < minWidth) {
						newWidth = minWidth;
						self.settings.columnWidths[field] = minWidth; // Update settings if width was reduced
					}
					col.style.width = newWidth + 'px';
					totalWidth += newWidth;
				}
			});
		}

		// Setting the total table width
		self.table.style.width = totalWidth + 'px';

		// Update the table to apply new widths
		// You can also call a redraw or recalculate elements if necessary

		// console.log(`[Navigation Plugin] Applied settings to UI:`, self.settings);
	},

	/**
	 * Sets the plugin's settings.
	 * @param {Object} settings - Key-value pairs of settings to be applied.
	 */
	set_settings: function(settings) {
		var self = this;

		// Update settings
		for (let key in settings) {
			if (settings.hasOwnProperty(key)) {
				const value = settings[key];
				switch (key) {
					case 'currentDir':
					case 'defaultFilePermissions':
					case 'defaultDirPermissions':
					case 'defaultOwner': // Added
					case 'defaultGroup': // Added
						if (typeof value === 'string') {
							self.settings[key] = value;
						}
						break;
					case 'width':
					case 'height':
						// Convert strings to numbers
						const numValue = parseInt(value, 10);
						if (!isNaN(numValue)) {
							self.settings[key] = numValue;
						} else {
							console.warn(`Invalid number for ${key}: ${value}`);
						}
						break;
					case 'columnWidths':
						if (typeof value === 'object' && value !== null) {
							// Convert each value within columnWidths
							let parsedColumnWidths = {};
							for (let cwKey in value) {
								if (value.hasOwnProperty(cwKey)) {
									const cwValue = parseInt(value[cwKey], 10);
									if (!isNaN(cwValue)) {
										parsedColumnWidths[cwKey] = cwValue;
									} else {
										console.warn(`Invalid number for columnWidths.${cwKey}: ${value[cwKey]}`);
									}
								}
							}
							self.settings.columnWidths = Object.assign({}, self.settings.columnWidths, parsedColumnWidths);
						}
						break;
					case 'mincolumnWidths':
						if (typeof value === 'object' && value !== null) {
							// Convert each value within mincolumnWidths
							let parsedMinColumnWidths = {};
							for (let mcwKey in value) {
								if (value.hasOwnProperty(mcwKey)) {
									const mcwValue = parseInt(value[mcwKey], 10);
									if (!isNaN(mcwValue)) {
										parsedMinColumnWidths[mcwKey] = mcwValue;
									} else {
										console.warn(`Invalid number for mincolumnWidths.${mcwKey}: ${value[cwKey]}`);
									}
								}
							}
							self.settings.mincolumnWidths = Object.assign({}, self.settings.mincolumnWidths, parsedMinColumnWidths);
						}
						break;
					default:
						// Handle unknown keys if necessary
						console.warn(`Unknown setting key: ${key}`);
				}
			}
		}

		console.log(`[Navigation Plugin] Updated settings:`, self.settings);

		// Apply settings to UI and internal properties
		self.applySettingsToUI();

		// If currentDir has changed, load the new directory
		if (settings.hasOwnProperty('currentDir')) {
			self.loadDirectory(self.currentDir);
		}
	},

	// Helper method to get the file name from the path
	basename: function(filePath) {
		return filePath.split('/').pop();
	},

	/**
	 * New method for requesting file content
	 * type: 'text' or 'bin'
	 * @param {string} filePath - The path to the file.
	 * @param {string} type - The type of data to retrieve ('text' or 'bin').
	 * @returns {Promise<string|ArrayBuffer>} - A promise that resolves with the file content.
	 */
	requestFileData: function(filePath, type) {
		var self = this;

		// Define the response type for read_direct
		var responseType = (type === 'bin') ? 'blob' : 'text';

		// Call read_direct to get the data
		return fs.read_direct(filePath, responseType)
			.then(function(response) {
				if (type === 'bin') {
					// If binary data is required, convert Blob to ArrayBuffer
					return response.arrayBuffer();
				} else {
					// If text data, return it directly
					return response;
				}
			})
			.catch(function(error) {
				// Handle errors
				console.error('Failed to request file data:', error);
				throw error;
			});
	},

	/**
	 * Reads the content of a file along with its permissions and ownership.
	 * @param {String} filePath - The path to the file to read.
	 * @param {String} type - The type of operation ('text' or 'bin').
	 * @returns {Promise<Object>} - Resolves with an object containing content, permissions, owner, and group.
	 */
	read_file: function(filePath, type) {
		var self = this;

		// Execute both file data retrieval and ls command concurrently
		return Promise.all([
			self.requestFileData(filePath, type), // Retrieves the file content
			fs.exec('/bin/ls', ['-lA', '--full-time', filePath]) // Executes ls to get file details
		]).then(function([content, lsOutput]) {
			// Split the ls output into lines and filter out any empty lines
			var lines = lsOutput.stdout.split('\n').filter(line => line.trim() !== '');

			if (lines.length === 0) {
				throw new Error('No output from ls command');
			}

			// Parse the first line of ls output to get file details
			var fileInfo = self.parseLsLine(lines[0]);

			if (!fileInfo) {
				throw new Error('Failed to parse ls output');
			}

			// Return the aggregated file information
			return {
				content: content,
				permissions: fileInfo.permissions, // Numeric representation of permissions
				GroupOwner: (fileInfo.owner + ':' + fileInfo.group) // Combined owner and group
			};
		}).catch(function(error) {
			console.error('Failed to read file data and ls:', error);
			throw error; // Propagate the error to the caller
		});
	},

	/**
	 * Writes data to a specified file on the server.
	 * @param {String} filePath - The path to the file to write.
	 * @param {String|ArrayBuffer} data - The data to write to the file.
	 * @param {String} type - The type of operation ('text' or 'bin').
	 * @returns {Promise} - Resolves when the write operation is complete.
	 */
	write_file: function(filePath, permissions, ownerGroup, data, type) {

		var self = this;
		// Define permissions and ownership
		// var permissions = self.settings.defaultFilePermissions;
		// var ownerGroup = self.settings.defaultOwner + ':' + self.settings.defaultGroup;

		var blob;
		if (type === 'text') {
			blob = new Blob([data], {
				type: 'text/plain'
			});
		} else {
			// Assume that data is either ArrayBuffer, Uint8Array, etc.
			blob = new Blob([data]);
		}
		return this.uploadFile(filePath, blob, permissions, ownerGroup, null);
	},


	/**
	 * Helper function to concatenate directory and file names with proper slashes.
	 * @param {string} dir - The directory path.
	 * @param {string} name - The file or subdirectory name.
	 * @returns {string} - The concatenated path.
	 */
	concatPath: function(dir, name) {
		if (!dir.endsWith('/')) {
			dir += '/';
		}
		return dir + name;
	},

	/**
	 * Update the width of a specific column and persist the change in settings.
	 * @param {string} field - The field name of the column.
	 * @param {number} newWidth - The new width in pixels.
	 */
	updateColumnWidth: function(field, newWidth) {
		var self = this;
		// Update column element width
		var col = self.table.querySelector(`col[data-field="${field}"]`);
		if (col) {
			col.style.width = newWidth + 'px';
		} else {
			console.warn(`No col found for field: ${field}`);
		}

		// Update settings and internal properties
		self.columnWidths[field] = newWidth;
		self.settings.columnWidths[field] = newWidth;
		// IMPORTANT: Do not call applySettingsToUI() here.
		// We'll call it once after column resizing finishes (on mouseup).
	},

	/**
	 * CSS styles for the plugin.
	 * Modified to include a unique suffix to prevent class name conflicts.
	 */
	css: function() {
		var self = this;
		var uniqueSuffix = self.uniqueSuffix; // e.g., '-123'

		return `
        /* Styles for the modal window */
        .navigation-plugin-modal${uniqueSuffix} {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent black background */
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000; /* High z-index to appear on top */
        }

        /* Styles for the modal content */
        .navigation-plugin-modal-content${uniqueSuffix} {
            background-color: #fff; /* White background for content */
            padding: 20px;
            border-radius: 5px;
            width: 400px;
            position: relative;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        /* Close button for the modal */
        .navigation-plugin-close-button${uniqueSuffix} {
            position: absolute;
            top: 10px;
            right: 15px;
            font-size: 24px;
            font-weight: bold;
            color: #aaa;
            cursor: pointer;
            transition: color 0.2s;
        }

        .navigation-plugin-close-button${uniqueSuffix}:hover {
            color: #000;
        }

        /* Styles for elements inside the modal */
        .navigation-plugin-modal-content${uniqueSuffix} label {
            display: block;
            margin-top: 10px;
            font-weight: bold;
        }

        .navigation-plugin-modal-content${uniqueSuffix} input[type="text"] {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            box-sizing: border-box;
        }

        .navigation-plugin-modal-content${uniqueSuffix} button {
            margin-top: 15px;
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
            border: none;
            border-radius: 4px;
        }

        .navigation-plugin-modal-content${uniqueSuffix} button#edit-submit-button${uniqueSuffix} {
            background-color: #4CAF50; /* Green background for "Submit" button */
            color: white;
        }

        .navigation-plugin-modal-content${uniqueSuffix} button#edit-submit-button${uniqueSuffix}:hover {
            background-color: #45a049;
        }

        .navigation-plugin-modal-content${uniqueSuffix} button#edit-cancel-button${uniqueSuffix} {
            background-color: #f44336; /* Red background for "Cancel" button */
            color: white;
            margin-left: 10px;
        }

        .navigation-plugin-modal-content${uniqueSuffix} button#edit-cancel-button${uniqueSuffix}:hover {
            background-color: #da190b;
        }

        /* Header styles */
        .navigation-plugin-header${uniqueSuffix} {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .navigation-plugin-header${uniqueSuffix} input[type="text"] {
            flex-grow: 1;
            padding: 5px;
            font-size: 16px;
            text-align: left; /* Align text to the left */
            background-color: #fff;
            border: 1px solid #ccc;
            border-radius: 4px;
        }

        .navigation-plugin-header${uniqueSuffix} button {
            padding: 12px 24px;
            font-size: 18px;
            cursor: pointer;
            background-color: #007BFF;
            color: white;
            border: none;
            border-radius: 4px;
            transition: background-color 0.2s;
        }

        .navigation-plugin-header${uniqueSuffix} button:hover {
            background-color: #0056b3;
        }

        /* Breadcrumb styles */
        .navigation-plugin-breadcrumb${uniqueSuffix} {
            margin-bottom: 10px;
        }

        /* Table container with fixed headers */
        .navigation-plugin-table-container${uniqueSuffix} {
            border: 1px solid #ccc;
            resize: both;
            overflow: auto;
            position: relative;
            box-sizing: border-box;
        }

        /* Table styles */
        .navigation-plugin-table${uniqueSuffix} {
            width: 100%; /* Set table width to 100% of container */
            border-collapse: collapse;
            table-layout: fixed;
            min-width: 730px; /* Example: sum of column widths */
        }

        .navigation-plugin-table${uniqueSuffix} th, .navigation-plugin-table${uniqueSuffix} td {
            box-sizing: border-box; /* Account for padding and border when calculating width */
            padding: 8px; /* Add padding to improve appearance */
            overflow: hidden; /* Hide overflow to prevent content from exceeding cell boundaries */
            white-space: nowrap; /* Prevent text wrapping */
            text-overflow: ellipsis; /* Add ellipsis if text is trimmed */
            border: 1px solid #ddd; /* Add borders for visual column separation */
            height: 40px; /* Fixed row height */
            min-height: 40px; /* Or minimum height */
        }

        .navigation-plugin-table${uniqueSuffix} col {
            min-width: 50px; /* Example minimum width */
        }

        .navigation-plugin-table${uniqueSuffix} thead th {
            position: sticky;
            top: 0;
            background-color: #f2f2f2;
            padding: 8px;
            text-align: left;
            vertical-align: middle;
            border-bottom: 2px solid #aaa; /* Thicker and brighter border */
            border-right: 1px solid #aaa;  /* Added vertical border */
            z-index: 2; /* Ensure headers stay above body rows */
        }

        .navigation-plugin-table${uniqueSuffix} thead th:last-child {
            border-right: none;
        }

        /* Styles for table cells */
        .navigation-plugin-table${uniqueSuffix} tbody td {
            overflow: hidden; /* Trim content that exceeds cell boundaries */
            white-space: nowrap; /* Prevent text from wrapping to a new line */
            text-overflow: ellipsis; /* Add ellipsis if text is trimmed */
        }

        /* Styles for links inside table cells */
        .navigation-plugin-table${uniqueSuffix} td .file-name${uniqueSuffix},
        .navigation-plugin-table${uniqueSuffix} td .directory-name${uniqueSuffix},
        .navigation-plugin-table${uniqueSuffix} td .symlink-name${uniqueSuffix} {
            display: block; /* Ensure the element occupies the full width of the cell */
            width: 100%; /* Set the element's width to 100% of the cell */
            overflow: hidden; /* Trim content that exceeds element boundaries */
            white-space: nowrap; /* Prevent text from wrapping to a new line */
            text-overflow: ellipsis; /* Add ellipsis if text is trimmed */
        }

        .navigation-plugin-table${uniqueSuffix} tbody td:last-child {
            border-right: none;
        }

        /* Resizer styles */
        .resizer${uniqueSuffix},
        .navigation-plugin-table${uniqueSuffix} th .resizer {
            position: absolute;
            right: 0;
            top: 0;
            width: 5px;
            height: 100%;
            cursor: col-resize;
            user-select: none;
            background-color: transparent;
            z-index: 10;
            transition: background-color 0.2s;
        }

        .resizer${uniqueSuffix}:hover,
        .navigation-plugin-table${uniqueSuffix} th .resizer:hover {
            background-color: rgba(0, 0, 0, 0.1);
        }

        /* Overlay for drag and drop */
        .navigation-plugin-drag-overlay${uniqueSuffix} {
            display: none;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            color: white;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            z-index: 500;
            flex-direction: column;
            pointer-events: none; /* Ensure the overlay doesn't block interactions */
        }

        /* Actions bar below the scrollable area */
        .navigation-plugin-actions-bar${uniqueSuffix} {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
        }

        .navigation-plugin-actions-bar${uniqueSuffix} button {
            padding: 12px 24px;
            font-size: 18px;
            cursor: pointer;
            background-color: #007BFF;
            color: white;
            border: none;
            border-radius: 4px;
            transition: background-color 0.2s;
        }

        .navigation-plugin-actions-bar${uniqueSuffix} button:hover {
            background-color: #0056b3;
        }

        /* Actions column styles */
        .navigation-plugin-actions${uniqueSuffix} {
            display: flex; /* Use flexbox for even distribution of icons */
            align-items: center;
            justify-content: flex-start; /* Align icons to the left */
            gap: 8px; /* Even spacing between icons */
            padding: 4px 8px; /* Add padding for better appearance */
            box-sizing: border-box; /* Include padding in width calculation */
        }

        .navigation-plugin-actions${uniqueSuffix} .action-button${uniqueSuffix} {
            cursor: pointer;
            width: 24px;
            height: 24px;
            display: flex; 
            align-items: center;
            justify-content: center;
            background: none;
            font-size: 18px;
            transition: background-color 0.2s, border-radius 0.2s;
        }

        .navigation-plugin-actions${uniqueSuffix} .action-button${uniqueSuffix}:hover {
            background-color: #f0f0f0;
            border-radius: 4px;
        }

        /* Dark theme */
        .dark-theme .navigation-plugin${uniqueSuffix} {
            background-color: #2a2a2a; 
            border: 1px solid #555555;
            color: #ffffff; 
        }

        .dark-theme .navigation-plugin-header${uniqueSuffix} input[type="text"] {
            background-color: #444444;
            color: #ffffff;
            border: 1px solid #666666;
        }

        .dark-theme .navigation-plugin-header${uniqueSuffix} button {
            background-color: #555555;
            color: #ffffff;
            border: 1px solid #666666;
        }

        .dark-theme .navigation-plugin-header${uniqueSuffix} button:hover {
            background-color: #666666;
        }

        .dark-theme .navigation-plugin-table${uniqueSuffix} thead th {
            background-color: #333333;
            color: #ffffff;
            border-bottom: 2px solid #888; /* Brighter color */
            border-right: 1px solid #888;  /* Added vertical border */
        }

        .dark-theme .navigation-plugin-table-container${uniqueSuffix} {
            border: 1px solid #555;
        }

        .dark-theme .navigation-plugin-table${uniqueSuffix} tbody td {
            background-color: #2a2a2a;
            color: #ffffff;
            border-bottom: 1px solid #888; /* Brighter color */
            border-right: 1px solid #888;  /* Added vertical border */
        }

        /* Row highlighting */
        .navigation-plugin-table${uniqueSuffix} tbody tr:hover {
            background-color: #f0f0f0; /* Lighter gray background */
            color: #000000; /* Black text color */
            cursor: pointer; /* Change cursor to pointer */
            transition: background-color 0.3s, color 0.3s; /* Smooth transition */
        }

        .dark-theme .navigation-plugin-table${uniqueSuffix} tbody tr:hover {
            background-color: #555555; /* Lighter gray background for dark theme */
            color: #ffffff; /* White text color */
            cursor: pointer;
            transition: background-color 0.3s, color 0.3s;
        }

        .dark-theme .navigation-plugin-table${uniqueSuffix} .directory-name${uniqueSuffix} {
            color: #1e90ff; 
        }

        .dark-theme .navigation-plugin-table${uniqueSuffix} .symlink-name${uniqueSuffix} {
            color: #32cd32;
        }

        .navigation-plugin-table${uniqueSuffix} .directory-name${uniqueSuffix} {
            color: #1e90ff; /* Blue for directories */
        }

        .navigation-plugin-table${uniqueSuffix} .symlink-name${uniqueSuffix} {
            color: #32cd32; /* Green for symbolic links */
        }

        .navigation-plugin-table${uniqueSuffix} .file-name${uniqueSuffix} {
            color: #000000; /* Black for regular files */
        }

        /* Cursor styles for draggable and clickable elements */
        .navigation-plugin-table${uniqueSuffix} .file-name${uniqueSuffix}[draggable="true"],
        .navigation-plugin-table${uniqueSuffix} .draggable${uniqueSuffix} {
            cursor: grab;
        }

        .navigation-plugin-table${uniqueSuffix} .file-name${uniqueSuffix}[draggable="true"]:active,
        .navigation-plugin-table${uniqueSuffix} .draggable${uniqueSuffix}:active {
            cursor: grabbing;
        }

        .navigation-plugin-table${uniqueSuffix} .directory-name${uniqueSuffix},
        .navigation-plugin-table${uniqueSuffix} .symlink-name${uniqueSuffix},
        .navigation-plugin-table${uniqueSuffix} .file-name${uniqueSuffix} {
            cursor: pointer;
        }

        /* Styles for custom tooltip */
        .navigation-plugin-tooltip${uniqueSuffix} {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.8); /* Dark background with transparency */
            color: #fff; /* White text */
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 14px;
            pointer-events: none; /* Tooltip does not interfere with interactions */
            white-space: nowrap; /* Prevent text wrapping */
            z-index: 1001; /* Above all other elements */
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
        }

        .navigation-plugin-tooltip${uniqueSuffix}.visible {
            opacity: 1;
        }

        /* Highlight directory row on dragover */
        .navigation-plugin-table${uniqueSuffix} tbody tr.drag-over${uniqueSuffix} {
            background-color: #d3d3d3; /* Light gray */
        }

        /* Highlight for copy action */
        .navigation-plugin-table${uniqueSuffix} tbody tr.drag-over-copy${uniqueSuffix} {
            background-color: #add8e6; /* Light blue */
            cursor: copy;
        }

        /* Highlight for move action */
        .navigation-plugin-table${uniqueSuffix} tbody tr.drag-over-move${uniqueSuffix} {
            background-color: #90ee90; /* Light green */
            cursor: move;
        }

        /* Cursor styles for copy and move */
        .navigation-plugin-table${uniqueSuffix} tbody tr.drag-over-copy${uniqueSuffix} td,
        .navigation-plugin-table${uniqueSuffix} tbody tr.drag-over-move${uniqueSuffix} td {
            cursor: inherit; /* Inherit cursor from parent tr */
        }

        /* Single table with fixed headers */
        .navigation-plugin-table${uniqueSuffix} {
            /* Removed redundant width and table-layout properties */
        }

        /* Minimal width for navigation plugin */
        .navigation-plugin${uniqueSuffix} {
            min-width: 780px; /* Sum of columnWidths */
            box-sizing: border-box;
        }

        /* Fixed row height to prevent height changes on column resize */
        .navigation-plugin-table${uniqueSuffix} tbody tr {
            height: 40px; /* Fixed height */
            min-height: 40px; /* Ensure minimum height */
        }

        /* Ensuring the table container maintains its height */
        .navigation-plugin-table-container${uniqueSuffix} {
            height: 100%; /* Maintain full height */
        }
        .cbi-progressbar${uniqueSuffix} {
            width: 100%;
            background-color: #f3f3f3;
            border: 1px solid #ccc;
            border-radius: 5px;
            height: 20px;
            overflow: hidden;
            margin-top: 10px; 
        }

        .cbi-progressbar${uniqueSuffix} div {
            height: 100%;
            background-color: #4caf50;
            width: 0%;
            transition: width 0.2s;
        }

        #status-info${uniqueSuffix} {
            margin-bottom: 5px;
            font-weight: bold;
        }

        #status-progress${uniqueSuffix} {
            margin-bottom: 10px;
        }

        `;
	},


	/**
	 * Refreshes the navigation by reloading the current directory.
	 */
	refresh: function() {
		this.loadDirectory(this.currentDir);
	},

	/**
	 * Initializes the plugin within the provided container.
	 * @param {HTMLElement} container - The DOM element to contain the plugin UI.
	 * @param {Object} pluginsRegistry - The registry of available plugins.
	 * @param {Object} default_plugins - The default plugins for each type.
	 * @param {string} uniqueSuffix - The unique suffix to append to class names and IDs.
	 */
	start: function(container, pluginsRegistry, default_plugins, uniqueSuffix) {
		var self = this;
		self.default_plugins = default_plugins;
		self.pluginsRegistry = pluginsRegistry;
		self.uniqueSuffix = `-${uniqueSuffix}`; // Store the unique suffix with a preceding dash

		var defaultDispatcherName = self.default_plugins['Dispatcher'];

		if (defaultDispatcherName && self.pluginsRegistry[defaultDispatcherName]) {
			var defaultDispatcher = self.pluginsRegistry[defaultDispatcherName];

			if (typeof defaultDispatcher.pop === 'function') {
				self.popm = defaultDispatcher.pop.bind(defaultDispatcher);
				console.log(`Pop function successfully retrieved from Dispatcher: ${defaultDispatcherName}`);
			} else {
				console.error(`Default Dispatcher "${defaultDispatcherName}" does not implement pop().`);
				self.popm = function() {
					console.warn(`Fallback: pop function is not available because Default Dispatcher "${defaultDispatcherName}" does not implement pop().`);
				};
			}
		} else {
			console.error('Default Dispatcher not found in pluginsRegistry.');
			self.popm = function() {
				console.warn('Fallback: pop function is not available because Default Dispatcher not found in pluginsRegistry.');
			};
		}

		// Initialize settings by merging defaultSettings and existing settings
		self.settings = Object.assign({}, self.defaultSettings, self.settings || {});

		// Inject the modified CSS into the document
		self.injectCSS();

		// Create navDiv and other DOM elements with unique suffix
		self.navDiv = document.createElement('div');
		self.navDiv.className = 'navigation-plugin' + self.uniqueSuffix;

		// Header with path input field and "Go" button
		var headerDiv = document.createElement('div');
		headerDiv.className = 'navigation-plugin-header' + self.uniqueSuffix;

		var pathInput = document.createElement('input');
		pathInput.type = 'text';
		pathInput.value = self.currentDir;
		pathInput.placeholder = 'Enter path...';

		pathInput.addEventListener('keydown', function(event) {
			if (event.key === 'Enter') {
				self.navigateToPath(pathInput.value.trim());
			}
		});

		var goButton = document.createElement('button');
		goButton.textContent = 'Go';
		goButton.onclick = function() {
			self.navigateToPath(pathInput.value.trim());
		};

		headerDiv.appendChild(pathInput);
		headerDiv.appendChild(goButton);
		self.navDiv.appendChild(headerDiv);

		// Breadcrumb below the header
		self.breadcrumb = document.createElement('div');
		self.breadcrumb.className = 'navigation-plugin-breadcrumb' + self.uniqueSuffix;
		self.navDiv.appendChild(self.breadcrumb);

		// Create tableContainer and table
		self.tableContainer = document.createElement('div');
		self.tableContainer.className = 'navigation-plugin-table-container' + self.uniqueSuffix;

		self.table = document.createElement('table');
		self.table.className = 'navigation-plugin-table' + self.uniqueSuffix;

		// Add colgroup to manage column widths
		self.colGroup = document.createElement('colgroup');
		['select', 'name', 'type', 'size', 'mtime', 'actions'].forEach(function(field) {
			var col = document.createElement('col');
			// Set width from columnWidths or default value
			col.style.width = (self.settings.columnWidths[field] || 100) + 'px';
			col.dataset.field = field;
			self.colGroup.appendChild(col);
		});
		self.table.appendChild(self.colGroup);

		// Create table header
		self.thead = document.createElement('thead');
		var headerRow = document.createElement('tr');

		// "Select All" column header
		var selectAllHeader = document.createElement('th');
		selectAllHeader.dataset.field = 'select';
		selectAllHeader.style.width = (self.settings.columnWidths['select'] || 30) + 'px';

		var selectAllCheckbox = document.createElement('input');
		selectAllCheckbox.type = 'checkbox';
		selectAllCheckbox.onclick = function(event) {
			self.handleSelectAll(this.checked, event);
		};
		selectAllHeader.appendChild(selectAllCheckbox);

		// Add resizer for the select column
		var selectResizer = document.createElement('div');
		selectResizer.className = 'resizer' + self.uniqueSuffix;
		selectAllHeader.appendChild(selectResizer);
		selectResizer.addEventListener('mousedown', function(e) {
			self.initColumnResize(e, 'select');
		});

		headerRow.appendChild(selectAllHeader);

		self.selectedItems = new Set();
		self.sortField = 'name';
		self.sortDirection = 'asc';

		// Create other column headers
		['Name', 'Type', 'Size', 'Modification Date'].forEach(function(title, index) {
			var field = ['name', 'type', 'size', 'mtime'][index];
			var sortableHeader = self.createSortableHeader(title, field);
			headerRow.appendChild(sortableHeader);
		});

		// "Actions" column header
		var actionsHeader = document.createElement('th');
		actionsHeader.textContent = 'Actions'; // No sorting
		actionsHeader.dataset.field = 'actions';
		actionsHeader.style.width = (self.settings.columnWidths['actions'] || 200) + 'px';

		// Add resizer for the Actions column
		var actionsResizer = document.createElement('div');
		actionsResizer.className = 'resizer' + self.uniqueSuffix;
		actionsHeader.appendChild(actionsResizer);
		actionsResizer.addEventListener('mousedown', function(e) {
			self.initColumnResize(e, 'actions');
		});

		headerRow.appendChild(actionsHeader);

		self.thead.appendChild(headerRow);
		self.table.appendChild(self.thead);

		// Create table body
		self.tbody = document.createElement('tbody');
		self.table.appendChild(self.tbody);

		// Add footer for drag-and-drop
		self.dragOverlay = document.createElement('div');
		self.dragOverlay.className = 'navigation-plugin-drag-overlay' + self.uniqueSuffix;
		self.dragOverlay.textContent = _('Drop files here to upload');
		self.tableContainer.appendChild(self.dragOverlay);

		self.tableContainer.appendChild(self.table);
		self.navDiv.appendChild(self.tableContainer);

		// Actions bar below the table
		self.actionsBar = document.createElement('div');
		self.actionsBar.className = 'navigation-plugin-actions-bar' + self.uniqueSuffix;

		self.uploadButton = document.createElement('button');
		self.uploadButton.textContent = _('Upload');
		self.uploadButton.onclick = function() {
			self.handleUploadClick();
		};

		self.createFolderButton = document.createElement('button');
		self.createFolderButton.textContent = _('Create Folder');
		self.createFolderButton.onclick = function() {
			self.handleCreateFolderClick();
		};

		self.createFileButton = document.createElement('button');
		self.createFileButton.textContent = _('Create File');
		self.createFileButton.onclick = function() {
			self.handleCreateFileClick();
		};

		self.deleteSelectedButton = document.createElement('button');
		self.deleteSelectedButton.textContent = _('Delete Selected');
		self.deleteSelectedButton.disabled = true;
		self.deleteSelectedButton.onclick = function() {
			self.handleDeleteSelectedClick();
		};

		self.actionsBar.appendChild(self.uploadButton);
		self.actionsBar.appendChild(self.createFolderButton);
		self.actionsBar.appendChild(self.createFileButton);
		self.actionsBar.appendChild(self.deleteSelectedButton);

		self.navDiv.appendChild(self.actionsBar);
		container.appendChild(self.navDiv);

		// Add drag-and-drop event handlers
		self.addDragAndDropEvents();

		document.addEventListener(('tab-' + `${PN}`), function(e) {
			self.refresh();
		});

		// Now call applySettingsToUI after creating all DOM elements
		self.applySettingsToUI();

		// Load the current directory
		self.loadDirectory(self.currentDir);

		// Adding ResizeObserver for navDiv observing
		if (typeof ResizeObserver !== 'undefined') {
			self.resizeObserver = new ResizeObserver(entries => {
				for (let entry of entries) {
					const {
						width,
						height
					} = entry.contentRect;
					const newWidth = Math.round(width);
					const newHeight = Math.round(height);

					// Check if dimensions has changed noticably (> 10px)
					const widthChanged = Math.abs(self.settings.width - newWidth) > 10;
					const heightChanged = Math.abs(self.settings.height - newHeight) > 10;

					if (widthChanged || heightChanged) {
						// Update settings
						self.settings.width = newWidth;
						self.settings.height = newHeight;
					}
				}
			});

			// Start observing of navDiv
			self.resizeObserver.observe(self.tableContainer);
		} else {
			console.warn(`[${PN}]: ResizeObserver is not supported in this browser`);
		}

		// Add the unique CSS to the document
		self.injectCSS();
	},

	/**
	 * Injects the CSS styles into the document.
	 */
	injectCSS: function() {
		var self = this;
		// Create a style element
		var style = document.createElement('style');
		style.type = 'text/css';
		style.textContent = self.css();
		// Append the style to the head
		document.head.appendChild(style);
	},

	/**
	 * Shows a tooltip with the specified text near the mouse cursor.
	 * @param {MouseEvent} event - The mouse event.
	 * @param {string} text - The tooltip text.
	 */
	showTooltip: function(event, text) {
		var self = this;

		// Create the tooltip element if it doesn't exist
		if (!self.tooltipElement) {
			self.tooltipElement = document.createElement('div');
			self.tooltipElement.className = 'navigation-plugin-tooltip' + self.uniqueSuffix;
			document.body.appendChild(self.tooltipElement);
		}

		self.tooltipElement.textContent = text;
		self.tooltipElement.classList.add('visible');
		self.positionTooltip(event);
		self.currentTooltip = true;
	},

	/**
	 * Hides the currently visible tooltip.
	 */
	hideTooltip: function() {
		var self = this;
		if (self.tooltipElement) {
			self.tooltipElement.classList.remove('visible');
			self.currentTooltip = false;
		}
	},

	/**
	 * Positions the tooltip relative to the mouse cursor.
	 * @param {MouseEvent} event - The mouse event.
	 */
	positionTooltip: function(event) {
		var self = this;
		if (self.tooltipElement) {
			var tooltip = self.tooltipElement;
			var tooltipWidth = tooltip.offsetWidth;
			var tooltipHeight = tooltip.offsetHeight;
			var pageWidth = document.documentElement.clientWidth;
			var pageHeight = document.documentElement.clientHeight;

			var x = event.pageX + 10; // Offset to the right of the cursor
			var y = event.pageY + 10; // Offset below the cursor

			// Ensure the tooltip doesn't go beyond the right edge
			if (x + tooltipWidth > pageWidth) {
				x = event.pageX - tooltipWidth - 10;
			}

			// Ensure the tooltip doesn't go beyond the bottom edge
			if (y + tooltipHeight > pageHeight) {
				y = event.pageY - tooltipHeight - 10;
			}

			tooltip.style.left = x + 'px';
			tooltip.style.top = y + 'px';
		}
	},

	/**
	 * Creates a sortable table header.
	 * @param {string} title - The display title of the column.
	 * @param {string} field - The field name associated with the column.
	 * @returns {HTMLElement} - The created header element.
	 */
	createSortableHeader: function(title, field) {
		var self = this;
		var header = document.createElement('th');
		header.dataset.field = field;
		// header.style.position = 'relative';
		header.style.textAlign = 'left'; // Align text to the left

		var headerContent = document.createElement('div');
		headerContent.style.display = 'inline-flex';
		headerContent.style.alignItems = 'center';
		headerContent.style.cursor = 'pointer';
		headerContent.style.userSelect = 'none'; // Prevent text selection

		var titleSpan = document.createElement('span');
		titleSpan.textContent = title;

		var sortIcon = document.createElement('span');
		sortIcon.style.marginLeft = '5px';

		if (self.sortField === field) {
			sortIcon.textContent = self.sortDirection === 'asc' ? '▲' : '▼';
		} else {
			sortIcon.textContent = '⇅';
		}

		headerContent.appendChild(titleSpan);
		headerContent.appendChild(sortIcon);
		header.appendChild(headerContent);

		var resizer = document.createElement('div');
		resizer.className = 'resizer' + self.uniqueSuffix;
		header.appendChild(resizer);

		// Add event listener for column resizing
		resizer.addEventListener('mousedown', function(e) {
			self.initColumnResize(e, field);
		});

		// Add event listener for sorting
		header.addEventListener('click', function(e) {
			if (e.target.classList.contains('resizer' + self.uniqueSuffix)) return; // Ignore clicks on resizer
			var clickedField = header.dataset.field;
			if (self.sortField === clickedField) {
				self.sortDirection = self.sortDirection === 'asc' ? 'desc' : 'asc';
			} else {
				self.sortField = clickedField;
				self.sortDirection = 'asc';
			}
			self.loadDirectory(self.currentDir);
		});

		return header;
	},

	/**
	 * Navigates to a specified path.
	 * @param {string} path - The path to navigate to.
	 */
	navigateToPath: function(path) {
		var self = this;
		fs.stat(path).then(function(stat) {
			if (stat.type === 'directory') {
				self.currentDir = path.endsWith('/') ? path : path + '/';
				self.settings.currentDir = self.currentDir;
				// self.set_settings(self.settings);
				self.loadDirectory(self.currentDir);
			} else {
				self.popm(null, `[${PN}]: ` + _('The specified path is not a directory.'), 'error');
			}
		}).catch(function(err) {
			self.popm(null, `[${PN}]: ` + _('Failed to access the specified path: %s').format(err.message), 'error');
		});
	},

	/**
	 * Initializes column resizing.
	 * @param {MouseEvent} e - The mouse event.
	 * @param {string} field - The field name of the column being resized.
	 */
	initColumnResize: function(e, field) {
		var self = this;
		e.preventDefault();

		self.resizingField = field;
		self.startX = e.pageX;
		// Get initial width from settings or from the col element
		self.startWidth = self.columnWidths[field] || self.table.querySelector(`col[data-field="${field}"]`).offsetWidth;

		self.boundOnColumnResize = self.onColumnResize.bind(self);
		self.boundStopColumnResize = self.stopColumnResize.bind(self);

		// Add listeners for mouse movement and mouse release
		document.addEventListener('mousemove', self.boundOnColumnResize);
		document.addEventListener('mouseup', self.boundStopColumnResize);

		// Disable text selection during column resizing for better UX
		document.body.style.userSelect = 'none';
	},

	/**
	 * Handles the column resize movement.
	 * @param {MouseEvent} e - The mouse event.
	 */
	onColumnResize: function(e) {
		var self = this;
		if (!self.resizingField) return;

		var diffX = e.pageX - self.startX;
		var newWidth = self.startWidth + diffX;

		var minWidth = self.mincolumnWidths[self.resizingField] || 30;
		if (newWidth < minWidth) {
			newWidth = minWidth;
		}

		// Just update the column width directly, do not re-apply entire UI settings yet.
		self.updateColumnWidth(self.resizingField, newWidth);
	},

	/**
	 * Stops the column resizing process.
	 * @param {MouseEvent} e - The mouse event.
	 */
	stopColumnResize: function(e) {
		var self = this;
		document.removeEventListener('mousemove', self.boundOnColumnResize);
		document.removeEventListener('mouseup', self.boundStopColumnResize);
		self.resizingField = null;

		// Re-enable text selection
		document.body.style.userSelect = '';

		// After the user finishes resizing, apply settings to ensure all adjustments are correctly displayed.
		self.applySettingsToUI();
	},

	/**
	 * Adds drag and drop event listeners to the table container.
	 */
	addDragAndDropEvents: function() {
		var self = this;
		var counter = 0;

		self.tableContainer.addEventListener('dragenter', function(e) {
			e.preventDefault();
			e.stopPropagation();
			counter++;
			self.dragOverlay.style.display = 'flex';
		});

		self.tableContainer.addEventListener('dragleave', function(e) {
			e.preventDefault();
			e.stopPropagation();
			counter--;
			if (counter === 0) {
				self.dragOverlay.style.display = 'none';
			}
		});

		self.tableContainer.addEventListener('dragover', function(e) {
			e.preventDefault();
			e.stopPropagation();
		});

		self.tableContainer.addEventListener('drop', function(e) {
			e.preventDefault();
			e.stopPropagation();
			self.dragOverlay.style.display = 'none';
			counter = 0;
			var files = e.dataTransfer.files;
			if (files.length > 0) {
				self.uploadFiles(files);
			}
		});
	},

	/**
	 * Handles the upload button click event.
	 */
	handleUploadClick: function() {
		var self = this;
		var fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.multiple = true;
		fileInput.style.display = 'none';
		document.body.appendChild(fileInput);
		fileInput.onchange = function(e) {
			var files = e.target.files;
			if (files.length > 0) {
				self.uploadFiles(files);
			}
			document.body.removeChild(fileInput);
		};
		fileInput.click();
	},

	/**
	 * Uploads a single file.
	 * @param {string} filename - The name of the file.
	 * @param {File} filedata - The file data.
	 * @param {string} permissions - File permissions (e.g., '644').
	 * @param {string} ownerGroup - Ownership in the format 'owner:group' (e.g., 'root:root').
	 * @param {function} onProgress - Callback for upload progress.
	 * @returns {Promise} - Resolves on successful upload and setting permissions/ownership, rejects on failure.
	 */
	uploadFile: function(filename, filedata, permissions, ownerGroup, onProgress) {
		var self = this;

		self.perm = String(permissions || self.defaultFilePermissions);
		self.oG = ownerGroup || (self.settings.defaultOwner + ':' + self.settings.defaultGroup);
		return new Promise(function(resolve, reject) {
			console.log("UploadFile filename:", filename);
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
				console.log("UploadFile Server response:", xhr.responseText);

				if (xhr.status === 200) {
					// After successful upload, set permissions and ownership
					var chmodPromise = self.perm ? fs.exec('/bin/chmod', [self.perm, filename]) : Promise.resolve();
					var chownPromise = self.oG ? fs.exec('/bin/chown', [self.oG, filename]) : Promise.resolve();
					Promise.all([chmodPromise, chownPromise])
						.then(function() {
							resolve(xhr.responseText);
						})
						.catch(function(err) {
							console.error(`[${PN}]: ` + _('Failed to set permissions or ownership:'), err);
							reject(err);
						});
				} else {
					reject(new Error(xhr.statusText));
				}
			};

			xhr.onerror = function() {
				reject(new Error(`[${PN}]: ` + _('Network error')));
			};

			xhr.send(formData);
		});
	},

	/**
	 * Uploads multiple files sequentially.
	 * @param {FileList} files - The list of files to upload.
	 */
	uploadFiles: function(files) {
		var self = this;
		var directoryPath = self.currentDir;
		var totalFiles = files.length;

		var statusInfo = self.statusInfo;
		var statusProgress = self.statusProgress;

		if (!statusInfo) {
			statusInfo = document.createElement('div');
			statusInfo.id = 'status-info' + self.uniqueSuffix;
			// Insert above tableContainer for visibility
			self.tableContainer.parentNode.insertBefore(statusInfo, self.tableContainer);
			self.statusInfo = statusInfo;
		}

		if (!statusProgress) {
			statusProgress = document.createElement('div');
			statusProgress.id = 'status-progress' + self.uniqueSuffix;
			self.tableContainer.parentNode.insertBefore(statusProgress, self.tableContainer);
			self.statusProgress = statusProgress;
		}

		/**
		 * Uploads the next file in the queue.
		 * @param {number} index - The current file index.
		 */
		function uploadNextFile(index) {
			if (index >= totalFiles) {
				self.loadDirectory(self.currentDir);
				return;
			}

			var file = files[index];
			var fullFilePath = self.concatPath(directoryPath, file.name);

			if (statusInfo) {
				statusInfo.textContent = `[${PN}]: ` + _('Uploading "%s"...').format(file.name);
			}
			if (statusProgress) {
				statusProgress.innerHTML = '';
				var progressBarContainer = E('div', {
					'class': 'cbi-progressbar' + self.uniqueSuffix,
					'title': '0%'
				}, [E('div', {
					'style': 'width:0%'
				})]);
				statusProgress.appendChild(progressBarContainer);
			}

			// Define permissions and ownership
			var permissions = self.settings.defaultFilePermissions;
			var ownerGroup = (self.settings.defaultOwner + ':' + self.settings.defaultGroup);

			self.uploadFile(fullFilePath, file, permissions, ownerGroup, function(percent) {
				if (statusProgress) {
					var progressBar = statusProgress.querySelector('.cbi-progressbar' + self.uniqueSuffix + ' div');
					if (progressBar) {
						progressBar.style.width = percent.toFixed(2) + '%';
						statusProgress.querySelector('.cbi-progressbar' + self.uniqueSuffix).setAttribute('title', percent.toFixed(2) + '%');
					}
				}
			}).then(function() {
				if (statusProgress) {
					statusProgress.innerHTML = '';
				}
				if (statusInfo) {
					statusInfo.textContent = `[${PN}]: ` + _('File "%s" uploaded successfully.').format(file.name);
				}
				self.popm(null, `[${PN}]: ` + _('File "%s" uploaded successfully.').format(file.name), 'info');
				uploadNextFile(index + 1);
			}).catch(function(err) {
				if (statusProgress) {
					statusProgress.innerHTML = '';
				}
				if (statusInfo) {
					statusInfo.textContent = `[${PN}]: ` + _('Upload failed for file "%s".').format(file.name);
				}
				self.popm(null, `[${PN}]: ` + _('Error uploading file "%s".').format(file.name), 'error');
				uploadNextFile(index + 1);
			});
		}

		// Start uploading files sequentially
		uploadNextFile(0);
	},

	/**
	 * Handles the "Create Folder" button click event.
	 */
	handleCreateFolderClick: function() {
		var self = this;
		var folderName = prompt(`[${PN}]: ` + _('Enter folder name:'));
		if (folderName) {
			var folderPath = self.concatPath(self.currentDir, folderName);
			fs.exec('/bin/mkdir', [folderPath]).then(function() {
				return fs.exec('/bin/chmod', [self.settings.defaultDirPermissions, folderPath]);
			}).then(function() {
				self.popm(null, `[${PN}]: ` + _('Folder "%s" created successfully.').format(folderName), 'info');
				self.settings.currentDir = self.currentDir;
				// self.set_settings(self.settings);
				self.loadDirectory(self.currentDir);
			}).catch(function(err) {
				self.popm(null, `[${PN}]: ` + _('Failed to create folder "%s": %s').format(folderName, err.message), 'error');
			});
		}
	},

	/**
	 * Handles the "Create File" button click event.
	 */
	handleCreateFileClick: function() {
		var self = this;
		var fileName = prompt(`[${PN}]: ` + _('Enter file name:'));
		if (fileName) {
			var filePath = self.concatPath(self.currentDir, fileName);
			fs.exec('/bin/touch', [filePath]).then(function() {
				return fs.exec('/bin/chmod', [self.settings.defaultFilePermissions, filePath]);
			}).then(function() {
				self.popm(null, `[${PN}]: ` + _('File "%s" created successfully.').format(fileName), 'info');
				self.settings.currentDir = self.currentDir;
				// self.set_settings(self.settings);
				self.loadDirectory(self.currentDir);
			}).catch(function(err) {
				self.popm(null, `[${PN}]: ` + _('Failed to create file "%s": %s').format(fileName, err.message), 'error');
			});
		}
	},

	/**
	 * Handles the "Delete Selected" button click event.
	 */
	handleDeleteSelectedClick: function() {
		var self = this;
		if (self.selectedItems.size === 0) return;

		if (confirm(`[${PN}]: ` + _('Are you sure you want to delete the selected items?'))) {
			var deletePromises = [];
			self.selectedItems.forEach(function(filePath) {
				deletePromises.push(fs.remove(filePath));
			});

			Promise.allSettled(deletePromises).then(function(results) {
				var successCount = 0;
				var failureCount = 0;
				var failedItems = [];

				results.forEach(function(result, index) {
					if (result.status === 'fulfilled') {
						successCount++;
					} else {
						failureCount++;
						failedItems.push(Array.from(self.selectedItems)[index]);
					}
				});

				if (successCount > 0) {
					self.popm(null, `[${PN}]: ` + _('Successfully deleted %d items.').format(successCount), 'info');
				}
				if (failureCount > 0) {
					failedItems.forEach(function(item) {
						self.popm(null, `[${PN}]: ` + _('Failed to delete "%s".').format(item), 'error');
					});
				}

				self.loadDirectory(self.currentDir);
				self.updateDeleteSelectedButtonState();
			});
		}
	},

	/**
	 * Handles the "Select All" checkbox click event.
	 * @param {boolean} checked - Whether the checkbox is checked.
	 */
	handleSelectAll: function(checked, event) {
		var self = this;

		// If Alt was pressed, invert selection
		if (event && event.altKey) {
			var checkboxes = self.tbody.querySelectorAll('.select-item' + self.uniqueSuffix);
			checkboxes.forEach(function(checkbox) {
				checkbox.checked = !checkbox.checked; // Invert current state
				var filePath = checkbox.dataset.path;
				if (checkbox.checked) {
					self.selectedItems.add(filePath);
				} else {
					self.selectedItems.delete(filePath);
				}
			});
		} else {
			// Regular "Select All"
			var checkboxes = self.tbody.querySelectorAll('.select-item' + self.uniqueSuffix);
			checkboxes.forEach(function(checkbox) {
				checkbox.checked = checked;
				var filePath = checkbox.dataset.path;
				if (checked) {
					self.selectedItems.add(filePath);
				} else {
					self.selectedItems.delete(filePath);
				}
			});
		}

		self.updateDeleteSelectedButtonState();
	},

	/**
	 * Updates the state of the "Delete Selected" button based on selected items.
	 */
	updateDeleteSelectedButtonState: function() {
		var self = this;
		if (self.deleteSelectedButton) {
			self.deleteSelectedButton.disabled = self.selectedItems.size === 0;
		}
	},

	convertPermissionsToNumeric: function(permissions) {
		const mapping = {
			'r': 4,
			'w': 2,
			'x': 1,
			'-': 0
		};
		let specialBits = 0;

		// Handling "special" bits (setuid, setgid, sticky bit)
		if (permissions[2] === 's') specialBits += 4000; // setuid with execute permissions
		if (permissions[2] === 'S') specialBits += 4000; // setuid without execute permissions
		if (permissions[5] === 's') specialBits += 2000; // setgid with execute permissions
		if (permissions[5] === 'S') specialBits += 2000; // setgid without execute permissions
		if (permissions[8] === 't') specialBits += 1000; // sticky bit with execute permissions
		if (permissions[8] === 'T') specialBits += 1000; // sticky bit without execute permissions

		// Remove "s", "S", "t", "T" symbols before calculation
		permissions = permissions
			.replace(/s/g, 'x') // Replace `s` with `x`
			.replace(/S/g, '-') // Replace `S` with `-`
			.replace(/t/g, 'x') // Replace `t` with `x`
			.replace(/T/g, '-'); // Replace `T` with `-`

		// Convert to numeric format
		const numericPermissions = permissions
			.slice(0, 9) // Take only access rights, excluding file type
			.match(/.{1,3}/g) // Split into groups of three characters (e.g., `rwx`, `r-x`)
			.map(group => group.split('').reduce((sum, char) => sum + mapping[char], 0)) // Convert to numbers
			.join('');

		return specialBits + parseInt(numericPermissions, 10); // Add "special" bits
	},

	/**
	 * Parses a single line of `ls -lA --full-time` output.
	 * @param {string} line - A single line from the `ls` command output.
	 * @returns {Object|null} - Returns an object with file information or null if parsing fails.
	 */

	parseLsLine: function(line) {
		const regex = /^([\-dl])[rwx\-]{2}[rwx\-Ss]{1}[rwx\-]{2}[rwx\-Ss]{1}[rwx\-]{2}[rwx\-Tt]{1}\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+([\d\-]+\s+[\d\:\.]{8,12}\s+\+\d{4})\s+(.+)$/;
		const parts = line.match(regex);
		if (!parts || parts.length < 7) {
			console.warn('Failed to parse line:', line);
			return null;
		}

		const typeChar = parts[1]; // File type
		const owner = parts[2]; // Owner
		const group = parts[3]; // Group
		const size = parseInt(parts[4], 10); // Size in bytes
		const mtime = new Date(parts[5]).toLocaleString(); // Modification date
		let nameField = parts[6].trim(); // File or symbolic link name

		const isDirectory = typeChar === 'd';
		const isSymlink = typeChar === 'l';
		let name = nameField;
		let linkTarget = null;

		// Handling symbolic links
		if (isSymlink) {
			const arrowIndex = nameField.indexOf(' -> ');
			if (arrowIndex !== -1) {
				name = nameField.substring(0, arrowIndex).trim();
				linkTarget = nameField.substring(arrowIndex + 4).trim();
			}
		}

		const type = isDirectory ? 'Directory' : isSymlink ? 'Symlink' : 'File';

		return {
			name: name,
			size: size,
			date: mtime,
			type: type,
			permissions: this.convertPermissionsToNumeric(line.slice(1, 10)), // Convert permissions
			owner: owner,
			group: group,
			isDirectory: isDirectory,
			isSymlink: isSymlink,
			linkTarget: linkTarget,
			mtime: new Date(parts[5]).getTime()
		};
	},

	/**
	 * Loads and displays the contents of a directory.
	 * @param {string} dir - The directory path to load.
	 */
	loadDirectory: function(dir) {
		var self = this;
		self.lastLoadId = (self.lastLoadId || 0) + 1;
		var loadId = self.lastLoadId;


		// Do not clear selectedItems set, as it should persist across sorting
		// self.selectedItems.clear();
		self.updateDeleteSelectedButtonState();

		if (!self.loadingIndicator) {
			self.loadingIndicator = document.createElement('div');
			self.loadingIndicator.className = 'navigation-plugin-loading' + self.uniqueSuffix;
			self.loadingIndicator.textContent = `[${PN}]: ` + _('Loading...');
			// Insert before breadcrumb for visibility
			self.navDiv.insertBefore(self.loadingIndicator, self.breadcrumb);
		}
		self.loadingIndicator.style.display = 'block';

		self.tbody.innerHTML = '';

		var pathInput = self.navDiv.querySelector('.navigation-plugin-header' + self.uniqueSuffix + ' input[type="text"]');
		if (pathInput) {
			pathInput.value = self.currentDir;
		}

		fs.exec('/bin/ls', ['-lA', '--full-time', dir]).then(function(res) {
			// Check load relevance
			if (loadId !== self.lastLoadId) {
				// Old result, ignore
				return;
			}

			self.loadingIndicator.style.display = 'none';

			if (res.code !== 0) {
				self.popm(null, `[${PN}]: ` + _('Failed to list directory: %s').format(res.stderr.trim()), 'error');
				self.tbody.innerHTML = '<tr><td colspan="6">' + `[${PN}]: ` + _('Error loading directory.') + '</td></tr>';
				return;
			}

			var lines = res.stdout.split('\n').filter(line => line.trim() !== '');
			var files = [];
			lines.forEach(function(line) {
				var file = self.parseLsLine(line);
				if (file) {
					files.push(file);
				}
			});

			// Sort files based on current sort settings
			files.sort(self.compareFiles.bind(self));

			// Add parent directory entry if not in root
			if (dir !== '/') {
				self.addParentDirectoryEntry();
			}

			// Render each file row
			files.forEach(function(file) {
				self.renderFileRow(file);
			});

			// Update breadcrumb navigation
			self.updateBreadcrumb();

			// Update sort icons in headers
			var headers = self.thead.querySelectorAll('th');
			headers.forEach(function(header) {
				var field = header.dataset.field;
				if (field) { // Only sortable columns
					var sortIcon = header.querySelector('span:nth-child(2)');
					if (sortIcon) { // Check if sortIcon exists
						if (self.sortField === field) {
							sortIcon.textContent = self.sortDirection === 'asc' ? '▲' : '▼';
						} else {
							sortIcon.textContent = '⇅';
						}
					}
				}
			});
			// Restore selection state after loading directory
			self.updateSelectionState();
		}).catch(function(err) {
			if (loadId !== self.lastLoadId) return; // Old result, ignore

			self.loadingIndicator.style.display = 'none';
			console.error('Error listing directory:', err);
			self.tbody.innerHTML = '<tr><td colspan="6">' + `[${PN}]: ` + _('Error loading directory.') + '</td></tr>';
		});
	},

	/**
	 * Renders a single file row in the table.
	 * @param {object} file - The file object containing its properties.
	 */
	renderFileRow: function(file) {
		var self = this;

		// Create the table row element
		var row = document.createElement('tr');
		row.className = (file.isDirectory ? 'directory' : file.isSymlink ? 'symlink' : 'file') + self.uniqueSuffix;
		row.dataset.filePath = self.concatPath(self.currentDir, file.name);

		// Determine if this row represents the parent directory
		var isParent = file.isParent || false;

		// Checkbox cell for selecting items
		var checkboxCell = document.createElement('td');
		var checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.className = 'select-item' + self.uniqueSuffix;
		checkbox.dataset.path = self.concatPath(self.currentDir, file.name);
		checkbox.onclick = function() {
			if (this.checked) {
				self.selectedItems.add(this.dataset.path);
			} else {
				self.selectedItems.delete(this.dataset.path);
			}
			self.updateDeleteSelectedButtonState();
		};
		checkboxCell.appendChild(checkbox);
		row.appendChild(checkboxCell);

		// Name cell with a clickable link
		var nameCell = document.createElement('td');
		nameCell.className = 'name' + self.uniqueSuffix;
		var nameLink = document.createElement('a');

		if (file.isDirectory) {
			nameLink.className = 'directory-name' + self.uniqueSuffix;
		} else if (file.isSymlink) {
			nameLink.className = 'symlink-name' + self.uniqueSuffix;
		} else {
			nameLink.className = 'file-name' + self.uniqueSuffix;
		}

		nameLink.textContent = file.isSymlink ? `${file.name} -> ${file.linkTarget}` : file.name;
		nameLink.onclick = function() {
			if (file.isDirectory) {
				self.enterDirectory(file.name); // Navigate into directory
			} else {
				self.openFileforEditing(
					self.concatPath(self.currentDir, file.name),
					file.permissions,
					`${file.owner}:${file.group}`
				); // Open file for editing
			}
		};

		// Make the link draggable if it's a regular file
		if (!file.isDirectory && !file.isSymlink) {
			nameLink.setAttribute('draggable', 'true');
			nameLink.classList.add('draggable' + self.uniqueSuffix);

			// Handle 'dragstart' event for files
			nameLink.addEventListener('dragstart', function(ev) {

				// Get selected items or fallback to the current file
				var selectedArray = Array.from(self.selectedItems);
				if (selectedArray.length === 0) {
					selectedArray = [self.concatPath(self.currentDir, file.name)];
				}

				// Set data in 'application/myapp-files' MIME types
				var jsonData = JSON.stringify(selectedArray);
				ev.dataTransfer.setData('application/myapp-files', jsonData);

				ev.dataTransfer.effectAllowed = 'copyMove';

				self.draggedFiles = selectedArray;

				self.popm(
					null,
					`[${PN}]: ` + _('Dragging started. Drop onto a directory within this UI to copy/move files (Alt=copy), or drop outside the browser to download.'),
					'info'
				);

			});

			// Handle 'dragend' event to manage fallback download
			nameLink.addEventListener('dragend', function(ev) {

				// If dropEffect is 'none', initiate file download
				if (self.draggedFiles && ev.dataTransfer.dropEffect === 'none') {
					self.downloadFilesSequentially(self.draggedFiles);
				}
				self.draggedFiles = null;
			});
		}

		// Tooltip handling for overflowing text (optional)
		if (nameLink.scrollWidth > nameLink.clientWidth) {
			nameLink.dataset.hasOverflow = 'true';

			// Show tooltip on hover with a delay
			let hoverTimer;

			nameLink.addEventListener('mouseenter', function(e) {
				hoverTimer = setTimeout(function() {
					self.showTooltip(e, file.isSymlink ? `${file.name} -> ${file.linkTarget}` : file.name);
				}, 500); // 500ms delay
			});

			// Update tooltip position on mouse move
			nameLink.addEventListener('mousemove', function(e) {
				if (self.currentTooltip) {
					self.positionTooltip(e);
				}
			});

			// Hide tooltip on mouse leave
			nameLink.addEventListener('mouseleave', function(e) {
				clearTimeout(hoverTimer);
				self.hideTooltip();
			});
		}

		nameCell.appendChild(nameLink);
		row.appendChild(nameCell);

		// Type cell
		var typeCell = document.createElement('td');
		typeCell.textContent = file.type;
		row.appendChild(typeCell);

		// Size cell
		var sizeCell = document.createElement('td');
		sizeCell.textContent = file.isDirectory ? '-' : self.formatSize(file.size);
		row.appendChild(sizeCell);

		// Modification date cell
		var dateCell = document.createElement('td');
		dateCell.textContent = file.date;
		row.appendChild(dateCell);

		// Actions cell with buttons (excluded for parent directory)
		var actionsCell = document.createElement('td');
		actionsCell.className = 'navigation-plugin-actions' + self.uniqueSuffix;

		if (!isParent && (file.isDirectory || file.isSymlink || !file.isDirectory)) {
			// Edit Button
			var editButton = document.createElement('span');
			editButton.className = 'action-button' + self.uniqueSuffix;
			editButton.textContent = '✏️';
			editButton.title = `[${PN}]: ` + _('Edit');
			editButton.onclick = function() {
				self.handleEditClick(file);
			};
			actionsCell.appendChild(editButton);

			// Copy Button
			var copyButton = document.createElement('span');
			copyButton.className = 'action-button' + self.uniqueSuffix;
			copyButton.textContent = '📋';
			copyButton.title = `[${PN}]: ` + _('Copy');
			copyButton.onclick = function() {
				self.handleCopyClick(file);
			};
			actionsCell.appendChild(copyButton);

			// Delete Button
			var deleteButton = document.createElement('span');
			deleteButton.className = 'action-button' + self.uniqueSuffix;
			deleteButton.textContent = '🗑️';
			deleteButton.title = `[${PN}]: ` + _('Delete');
			deleteButton.onclick = function() {
				self.handleDeleteClick(file.name);
			};
			actionsCell.appendChild(deleteButton);

			// Download Button (only for regular files)
			if (!file.isDirectory && !file.isSymlink) {
				var downloadButton = document.createElement('span');
				downloadButton.className = 'action-button' + self.uniqueSuffix;
				downloadButton.textContent = '⬇️';
				downloadButton.title = `[${PN}]: ` + _('Download');
				downloadButton.onclick = function() {
					self.handleDownloadClick(file.name);
				};
				actionsCell.appendChild(downloadButton);
			}
		}

		row.appendChild(actionsCell);

		// If the file is a directory, attach drag-and-drop handlers
		if (file.isDirectory) {
			var destinationDir = self.concatPath(self.currentDir, file.name);
			self.attachDragDropHandlers(row, destinationDir);
		}

		self.tbody.appendChild(row);
	},

	/**
	 * Compares two files based on the current sort field and direction.
	 * @param {object} a - The first file object.
	 * @param {object} b - The second file object.
	 * @returns {number} - Comparison result.
	 */
	compareFiles: function(a, b) {
		var self = this;
		var field = self.sortField;
		var direction = self.sortDirection === 'asc' ? 1 : -1;

		var valueA = a[field];
		var valueB = b[field];

		if (field === 'size') {
			valueA = a.isDirectory ? 0 : a.size;
			valueB = b.isDirectory ? 0 : b.size;
		} else if (field === 'mtime') {
			valueA = a.mtime;
			valueB = b.mtime;
		} else {
			valueA = String(valueA).toLowerCase();
			valueB = String(valueB).toLowerCase();
		}

		if (valueA < valueB) return -1 * direction;
		if (valueA > valueB) return 1 * direction;
		return 0;
	},

	/**
	 * Updates selected items' states after sorting.
	 * This function restores checkboxes' states based on the preserved selection set.
	 */
	updateSelectionState: function() {
		var self = this;
		var checkboxes = self.tbody.querySelectorAll('.select-item' + self.uniqueSuffix);

		checkboxes.forEach(function(checkbox) {
			var filePath = checkbox.dataset.path;
			checkbox.checked = self.selectedItems.has(filePath);
		});
	},

	/**
	 * Enters a specified directory.
	 * @param {string} dirName - The name of the directory to enter.
	 */
	enterDirectory: function(dirName) {
		var self = this;
		var newDir = self.concatPath(self.currentDir, dirName);
		self.currentDir = newDir.endsWith('/') ? newDir : newDir + '/';
		self.settings.currentDir = self.currentDir;
		// self.set_settings(self.settings);
		self.loadDirectory(self.currentDir);
	},

	/**
	 * Adds a parent directory entry ("..") to the table.
	 */
	addParentDirectoryEntry: function() {
		var self = this;

		// Create the table row element for the parent directory
		var row = document.createElement('tr');
		row.className = 'directory' + self.uniqueSuffix;
		row.dataset.filePath = self.concatPath(self.currentDir, '..');
		row.dataset.isParent = 'true'; // Flag to identify as parent directory

		// Checkbox cell (empty for parent directory)
		var checkboxCell = document.createElement('td');

		// Name cell with a clickable link to navigate up
		var nameCell = document.createElement('td');
		nameCell.className = 'name' + self.uniqueSuffix;
		var nameLink = document.createElement('a');
		nameLink.className = 'directory-name' + self.uniqueSuffix;
		nameLink.textContent = '.. (Parent Directory)';
		nameLink.onclick = function() {
			self.navigateUp(); // Navigate to parent directory
		};
		nameCell.appendChild(nameLink);

		// Type cell (always 'Directory' for parent directory)
		var typeCell = document.createElement('td');
		typeCell.textContent = 'Directory';

		// Size cell (empty for parent directory)
		var sizeCell = document.createElement('td');
		sizeCell.textContent = '-';

		// Modification date cell (empty for parent directory)
		var dateCell = document.createElement('td');
		dateCell.textContent = '-';

		// Actions cell (empty, no buttons)
		var actionsCell = document.createElement('td');

		// Append all cells to the row
		row.appendChild(checkboxCell);
		row.appendChild(nameCell);
		row.appendChild(typeCell);
		row.appendChild(sizeCell);
		row.appendChild(dateCell);
		row.appendChild(actionsCell);

		// Attach drag-and-drop handlers for the parent directory
		var parentDir = self.getParentDirectory(self.currentDir);
		self.attachDragDropHandlers(row, parentDir);

		// Append the row to the table body
		self.tbody.appendChild(row);
	},

	/**
	 * Helper function to get the parent directory of a given path.
	 * @param {string} dir - The current directory path.
	 * @returns {string} - The parent directory path.
	 */
	getParentDirectory: function(dir) {
		if (dir === '/') return '/'; // Root directory has no parent

		// Remove trailing slash and split the path
		var pathParts = dir.slice(0, -1).split('/');
		pathParts.pop(); // Remove the last part to get the parent

		var parentDir = pathParts.join('/') || '/'; // Join back to form the parent path
		parentDir = parentDir.endsWith('/') ? parentDir : parentDir + '/'; // Ensure trailing slash

		return parentDir;
	},

	/**
	 * Navigates up to the parent directory.
	 */
	navigateUp: function() {
		var self = this;
		if (self.currentDir === '/') return;

		var pathParts = self.currentDir.slice(0, -1).split('/');
		pathParts.pop();
		var parentDir = pathParts.join('/') || '/';
		self.currentDir = parentDir.endsWith('/') ? parentDir : parentDir + '/';
		self.settings.currentDir = self.currentDir;
		// self.set_settings(self.settings);
		self.loadDirectory(self.currentDir);
	},

	/**
	 * Handles the download button click event by sending a JSON request and downloading the file.
	 * @param {string} fileName - The name of the file to download.
	 */
	handleDownloadClick: function(fileName) {
		var self = this;
		var filePath = self.concatPath(self.currentDir, fileName);

		// Use the read_direct method to download the file
		fs.read_direct(filePath, 'blob')
			.then(function(blob) {
				if (!(blob instanceof Blob)) {
					throw new Error(`[${PN}]: ` + _('Response is not a Blob'));
				}
				var url = window.URL.createObjectURL(blob);
				var a = document.createElement('a');
				a.href = url;
				a.download = fileName;
				document.body.appendChild(a);
				a.click();
				a.remove();
				window.URL.revokeObjectURL(url);
			})
			.catch(function(error) {
				console.error(`[${PN}]: ` + _('Download failed:'), error);
				alert(`[${PN}]: ` + _('Download failed: ') + error.message);
			});
	},

	/**
	 * Handles the delete button click event for a single file.
	 * @param {string} fileName - The name of the file to delete.
	 */
	handleDeleteClick: function(fileName) {
		var self = this;
		var filePath = self.concatPath(self.currentDir, fileName);
		if (confirm(`[${PN}]: ` + _('Are you sure you want to delete "%s"?').format(fileName))) {
			fs.remove(filePath).then(function() {
				self.popm(null, `[${PN}]: ` + _('File "%s" deleted successfully.').format(fileName), 'info');
				self.loadDirectory(self.currentDir);
			}).catch(function(err) {
				self.popm(null, `[${PN}]: ` + _('Failed to delete file "%s": %s').format(fileName, err.message), 'error');
			});
		}
	},

	/**
	 * Handles the copy button click event for a file.
	 * @param {object} file - The file object to copy.
	 */
	handleCopyClick: function(file) {
		var self = this;

		// Construct the original file path
		var originalPath = self.concatPath(self.currentDir, file.name);
		var baseName = file.name;
		var extension = '';
		var nameWithoutExt = baseName;

		// Split the filename into name and extension
		var lastDot = baseName.lastIndexOf('.');
		if (lastDot !== -1 && lastDot !== 0) {
			nameWithoutExt = baseName.substring(0, lastDot);
			extension = baseName.substring(lastDot);
		}

		/**
		 * Recursively finds the next available copy number to avoid name conflicts.
		 * @param {number} n - The current copy number to try.
		 * @returns {Promise<number>} - Resolves with the next available copy number.
		 */
		function findNextCopyNumber(n) {
			var newName = `${nameWithoutExt} (copy ${n})${extension}`;
			var newPath = self.concatPath(self.currentDir, newName);

			// Attempt to stat the new path to check if it exists
			return fs.stat(newPath).then(function(stat) {
				// If the path exists, try the next number
				return findNextCopyNumber(n + 1);
			}).catch(function(err) {
				// Handle 'Resource not found' as the file does not exist
				if (err.message === 'Resource not found') { // Adjust based on actual error message
					return n;
				} else {
					// An unexpected error occurred
					// Notify the user about the unexpected error
					self.popm(null, `[${PN}]: ` + _('Error checking "%s": %s').format(newPath, err.message), 'error');
					throw err;
				}
			});
		}

		// Start finding the next available copy number
		findNextCopyNumber(1).then(function(n) {
			var newName = `${nameWithoutExt} (copy ${n})${extension}`;
			var newPath = self.concatPath(self.currentDir, newName);

			if (file.isDirectory) {
				// Use 'cp -r' to copy directories recursively
				fs.exec('/bin/cp', ['-r', originalPath, newPath]).then(function(res) {
					if (res.code === 0) {
						self.popm(null, `[${PN}]: ` + _('Directory "%s" copied successfully as "%s".').format(file.name, newName), 'info');
						self.loadDirectory(self.currentDir);
					} else {
						self.popm(null, `[${PN}]: ` + _('Failed to copy directory "%s": %s').format(file.name, res.stderr.trim()), 'error');
					}
				}).catch(function(err) {
					self.popm(null, `[${PN}]: ` + _('Failed to copy directory "%s": %s').format(file.name, err.message), 'error');
				});
			} else if (file.isSymlink) {
				// Use 'ln -s' to copy symbolic links
				fs.exec('/bin/ln', ['-s', file.linkTarget, newPath]).then(function(res) {
					if (res.code === 0) {
						self.popm(null, `[${PN}]: ` + _('Symlink "%s" copied successfully as "%s".').format(file.name, newName), 'info');
						self.loadDirectory(self.currentDir);
					} else {
						self.popm(null, `[${PN}]: ` + _('Failed to copy symlink "%s": %s').format(file.name, res.stderr.trim()), 'error');
					}
				}).catch(function(err) {
					self.popm(null, `[${PN}]: ` + _('Failed to copy symlink "%s": %s').format(file.name, err.message), 'error');
				});
			} else {
				// Use 'cp' to copy regular files
				fs.exec('/bin/cp', [originalPath, newPath]).then(function(res) {
					if (res.code === 0) {
						self.popm(null, `[${PN}]: ` + _('File "%s" copied successfully as "%s".').format(file.name, newName), 'info');
						self.loadDirectory(self.currentDir);
					} else {
						self.popm(null, `[${PN}]: ` + _('Failed to copy file "%s": %s').format(file.name, res.stderr.trim()), 'error');
					}
				}).catch(function(err) {
					self.popm(null, `[${PN}]: ` + _('Failed to copy file "%s": %s').format(file.name, err.message), 'error');
				});
			}
		}).catch(function(err) {
			self.popm(null, `[${PN}]: ` + _('Failed to find copy number for "%s": %s').format(file.name, err.message), 'error');
		});
	},

	/**
	 * Handles the edit button click event for a file.
	 * @param {object} file - The file object to edit.
	 */
	handleEditClick: function(file) {
		var self = this;
		var filePath = self.concatPath(self.currentDir, file.name);
		var fileName = file.name;

		var modal = E('div', {
			'class': 'navigation-plugin-modal' + self.uniqueSuffix
		}, [
			E('div', {
				'class': 'navigation-plugin-modal-content' + self.uniqueSuffix
			}, [
				E('span', {
					'class': 'navigation-plugin-close-button' + self.uniqueSuffix,
					'innerHTML': '&times;'
				}),
				E('h2', `[${PN}]: ` + _('Edit "%s"').format(fileName)),
				E('label', `[${PN}]: ` + _('New Name:')),
				E('input', {
					type: 'text',
					id: 'edit-new-name' + self.uniqueSuffix,
					value: fileName
				}),
				E('label', `[${PN}]: ` + _('Owner:Group:')),
				E('input', {
					type: 'text',
					id: 'edit-owner' + self.uniqueSuffix,
					value: (file.owner + ':' + file.group)
				}),
				E('label', `[${PN}]: ` + _('Permissions:')),
				E('input', {
					type: 'text',
					id: 'edit-permissions' + self.uniqueSuffix,
					value: file.permissions
				}),
				E('button', {
					id: 'edit-submit-button' + self.uniqueSuffix
				}, _('Submit')),
				E('button', {
					id: 'edit-cancel-button' + self.uniqueSuffix
				}, _('Cancel'))
			])
		]);

		document.body.appendChild(modal);

		var closeButton = modal.querySelector('.navigation-plugin-close-button' + self.uniqueSuffix);
		var submitButton = modal.querySelector('#edit-submit-button' + self.uniqueSuffix);
		var cancelButton = modal.querySelector('#edit-cancel-button' + self.uniqueSuffix);

		/**
		 * Closes the modal window.
		 */
		function closeModal() {
			document.body.removeChild(modal);
		}

		closeButton.onclick = closeModal;
		cancelButton.onclick = closeModal;

		submitButton.onclick = function() {
			var newName = modal.querySelector('#edit-new-name' + self.uniqueSuffix).value.trim();
			var newOwner = modal.querySelector('#edit-owner' + self.uniqueSuffix).value.trim();
			var newPermissions = modal.querySelector('#edit-permissions' + self.uniqueSuffix).value.trim();

			if (newName === '') {
				self.popm(null, `[${PN}]: ` + _('File name cannot be empty.'), 'error');
				return;
			}

			var renamePromise = Promise.resolve();
			if (newName !== fileName) {
				var newPath = self.concatPath(self.currentDir, newName);
				renamePromise = fs.exec('/bin/mv', [filePath, newPath]).then(function() {
					filePath = newPath;
				});
			}

			var ownerPromise = fs.exec('/bin/chown', [newOwner, filePath]);
			var permissionsPromise = fs.exec('/bin/chmod', [newPermissions, filePath]);

			renamePromise.then(function() {
				return ownerPromise;
			}).then(function() {
				return permissionsPromise;
			}).then(function() {
				self.popm(null, `[${PN}]: ` + _('"%s" edited successfully.').format(newName), 'info');
				closeModal();
				self.loadDirectory(self.currentDir);
			}).catch(function(err) {
				self.popm(null, `[${PN}]: ` + _('Failed to edit "%s": %s').format(newName, err.message), 'error');
			});
		};
	},

	/**
	 * Formats file size into a human-readable form.
	 * @param {number} size - The file size in bytes.
	 * @returns {string} - The formatted size string.
	 */
	formatSize: function(size) {
		var bytes = parseInt(size, 10);
		if (isNaN(bytes)) return size;

		var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		if (bytes === 0) return '0 B';
		var i = Math.floor(Math.log(bytes) / Math.log(1024));
		return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
	},

	/**
	 * Updates the breadcrumb navigation based on the current directory.
	 */
	updateBreadcrumb: function() {
		var self = this;
		self.breadcrumb.innerHTML = '';

		var pathParts = self.currentDir.split('/').filter(part => part.length > 0);
		var accumulatedPath = '/';

		var rootLink = document.createElement('a');
		rootLink.href = '#';
		rootLink.textContent = `[${PN}]: ` + _('Root');
		rootLink.onclick = function(e) {
			e.preventDefault();
			self.currentDir = '/';
			self.settings.currentDir = self.currentDir;
			// self.set_settings(self.settings);
			self.loadDirectory(self.currentDir);
		};
		self.breadcrumb.appendChild(rootLink);

		if (pathParts.length > 0) {
			self.breadcrumb.appendChild(document.createTextNode(' / '));
		}

		pathParts.forEach(function(part, index) {
			accumulatedPath = self.concatPath(accumulatedPath, part);
			let currentPath = accumulatedPath;

			var link = document.createElement('a');
			link.href = '#';
			link.textContent = part;
			link.onclick = function(e) {
				e.preventDefault();
				self.currentDir = currentPath;
				self.settings.currentDir = self.currentDir;
				// self.set_settings(self.settings);
				self.loadDirectory(self.currentDir);
			};
			self.breadcrumb.appendChild(link);

			if (index < pathParts.length - 1) {
				self.breadcrumb.appendChild(document.createTextNode(' / '));
			}
		});
	},

	// Store dragged files in an array when drag starts
	handleDragStart: function(ev, fileName) {
		var self = this;
		ev.dataTransfer.effectAllowed = 'copy';

		// Count selected files
		var selectedArray = Array.from(self.selectedItems);
		if (selectedArray.length === 0) {
			// If no items are selected, consider the dragged file as the single target
			selectedArray = [self.concatPath(self.currentDir, fileName)];
		}

		// Notify user that direct drag-and-drop isn't supported, but we'll handle it after drag ends
		self.popm(null, `[${PN}]: Direct drag-and-drop to local storage is not supported. The file(s) will be downloaded when you release the mouse.`, 'info');

		// Store these files for download after drag ends
		self.draggedFiles = selectedArray;
	},

	// Download the stored files once the user ends the drag operation
	handleDragEnd: function(ev) {
		var self = this;

		if (self.draggedFiles && self.draggedFiles.length > 0) {
			// Now that the drag operation has ended, start downloading the files
			self.downloadFilesSequentially(self.draggedFiles);
			// Clear draggedFiles after processing
			self.draggedFiles = null;
		}
	},

	// Download multiple files sequentially
	downloadFilesSequentially: function(filePaths) {
		var self = this;

		function downloadNext(index) {
			if (index >= filePaths.length) {
				return;
			}

			var filePath = filePaths[index];
			var fileName = filePath.split('/').pop();

			fs.read_direct(filePath, 'blob')
				.then(function(blob) {
					if (!(blob instanceof Blob)) {
						throw new Error(`[${PN}]: ` + _('Response is not a Blob'));
					}
					var url = window.URL.createObjectURL(blob);
					var a = document.createElement('a');
					a.href = url;
					a.download = fileName;
					document.body.appendChild(a);
					a.click();
					a.remove();
					window.URL.revokeObjectURL(url);

					// Proceed to the next file
					downloadNext(index + 1);
				})
				.catch(function(error) {
					console.error(`[${PN}]: Download failed:`, error);
					self.popm(null, `[${PN}]: Download failed: ${error.message}`, 'error');
					// Continue with next file even if one fails
					downloadNext(index + 1);
				});
		}

		downloadNext(0);
	},
	// Внутри класса Navigation Plugin

	/**
	 * Показывает иконку плюс рядом с целевой директорией при удерживании клавиши Alt.
	 * @param {MouseEvent} event - Событие мыши.
	 * @param {HTMLElement} targetRow - Строка таблицы, представляющая директорию.
	 */
	showAltIcon: function(event, targetRow) {
		var self = this;

		// Удаляем существующую иконку, если она есть
		self.hideAltIcon();

		// Создаем элемент иконки плюс
		var plusIcon = document.createElement('div');
		plusIcon.className = 'navigation-plugin-alt-icon' + self.uniqueSuffix;
		plusIcon.innerHTML = '➕'; // Юникод иконка плюса
		plusIcon.style.position = 'absolute';
		// Располагаем иконку по центру строки
		plusIcon.style.top = '50%';
		plusIcon.style.left = '50%';
		plusIcon.style.transform = 'translate(-50%, -50%)';
		plusIcon.style.pointerEvents = 'none'; // Иконка не перехватывает события
		plusIcon.style.fontSize = '24px';
		plusIcon.style.color = '#000'; // Цвет иконки
		plusIcon.style.zIndex = '1001'; // Поверх других элементов

		// Добавляем иконку в строку таблицы
		targetRow.appendChild(plusIcon);
		self.altIcon = plusIcon;
	},

	/**
	 * Скрывает иконку плюс.
	 */
	hideAltIcon: function() {
		var self = this;
		if (self.altIcon) {
			self.altIcon.remove();
			self.altIcon = null;
		}
	},

	/**
	 * Attaches drag-and-drop event handlers to a directory row.
	 * @param {HTMLElement} row - The table row element representing a directory.
	 * @param {string} destinationDir - The directory path where files will be copied/moved.
	 */
	attachDragDropHandlers: function(row, destinationDir) {
		var self = this;

		// Handle 'dragover' event to allow dropping
		row.addEventListener('dragover', function(e) {
			e.preventDefault();
			e.stopPropagation();
			var isCopy = e.altKey; // Determine if the operation is copy based on Alt key
			e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';

			// Add visual indicators for drag-over state
			row.classList.add('drag-over' + self.uniqueSuffix);
			if (isCopy) {
				row.classList.add('drag-over-copy' + self.uniqueSuffix);
				row.classList.remove('drag-over-move' + self.uniqueSuffix);
				self.showAltIcon(e, row); // Show copy icon
			} else {
				row.classList.add('drag-over-move' + self.uniqueSuffix);
				row.classList.remove('drag-over-copy' + self.uniqueSuffix);
				self.hideAltIcon(); // Hide copy icon
			}
		});

		// Handle 'dragenter' event similarly to 'dragover'
		row.addEventListener('dragenter', function(e) {
			e.preventDefault();
			e.stopPropagation();
			var isCopy = e.altKey;
			e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';

			row.classList.add('drag-over' + self.uniqueSuffix);
			if (isCopy) {
				row.classList.add('drag-over-copy' + self.uniqueSuffix);
				row.classList.remove('drag-over-move' + self.uniqueSuffix);
				self.showAltIcon(e, row);
			} else {
				row.classList.add('drag-over-move' + self.uniqueSuffix);
				row.classList.remove('drag-over-copy' + self.uniqueSuffix);
				self.hideAltIcon();
			}
		});

		// Handle 'dragleave' event to remove visual indicators
		row.addEventListener('dragleave', function(e) {
			e.preventDefault();
			e.stopPropagation();
			row.classList.remove('drag-over' + self.uniqueSuffix);
			row.classList.remove('drag-over-copy' + self.uniqueSuffix);
			row.classList.remove('drag-over-move' + self.uniqueSuffix);
			self.hideAltIcon();
		});

		// Handle 'drop' event to perform copy/move operations
		row.addEventListener('drop', function(e) {
			e.preventDefault();
			e.stopPropagation();

			// Remove visual indicators
			row.classList.remove('drag-over' + self.uniqueSuffix);
			row.classList.remove('drag-over-copy' + self.uniqueSuffix);
			row.classList.remove('drag-over-move' + self.uniqueSuffix);
			self.hideAltIcon();

			// Retrieve dragged files data
			var draggedFilesJson = e.dataTransfer.getData('application/myapp-files');
			if (!draggedFilesJson) {
				// Fallback to 'text/plain' if custom MIME type is not available
				draggedFilesJson = e.dataTransfer.getData('text/plain');
			}

			if (!draggedFilesJson) {
				self.popm(null, `[${PN}]: ` + _('No files were dragged.'), 'error');
				return;
			}

			var draggedFiles;
			try {
				draggedFiles = JSON.parse(draggedFilesJson);
			} catch (err) {
				self.popm(null, `[${PN}]: ` + _('Failed to parse dragged files data.'), 'error');
				return;
			}

			var isCopy = e.altKey; // Determine operation type
			var cmd = isCopy ? 'cp' : 'mv'; // Command to execute
			var args = isCopy ? ['-r'] : []; // Recursive flag for copy

			// Append source files and destination directory to arguments
			args = args.concat(draggedFiles).concat([destinationDir]);


			// Execute the command using fs.exec
			fs.exec('/bin/' + cmd, args)
				.then(function(res) {
					if (res.code === 0) {
						var action = isCopy ? 'copied' : 'moved';
						self.popm(null, `[${PN}]: Successfully ${action} files to "${destinationDir}".`, 'info');
						self.loadDirectory(self.currentDir); // Refresh directory view
					} else {
						self.popm(null, `[${PN}]: Failed to ${isCopy ? 'copy' : 'move'} files to "${destinationDir}": ${res.stderr.trim()}`, 'error');
					}
				})
				.catch(function(err) {
					self.popm(null, `[${PN}]: Failed to ${isCopy ? 'copy' : 'move'} files to "${destinationDir}": ${err.message}`, 'error');
				});
		});
	},


	/**
	 * Opens a file in the default editor based on the editor's style.
	 * @param {string} filePath - The path to the file to open.
	 */
	openFileforEditing: function(filePath, permissions, ownerGroup) {
		var self = this;

		// Retrieve the default editor plugin
		var defaultEditorName = self.default_plugins['Editor'];
		var defaultEditor = self.pluginsRegistry[defaultEditorName];

		if (!defaultEditor) {
			self.popm(null, `[${PN}]: ` + _('No default editor plugin found.'), 'error');
			return;
		}

		// Get the editor's style ('text' or 'bin') from its info
		var editorInfo = defaultEditor.info();
		var style = (editorInfo.style || 'text').toLowerCase(); // Default to 'text' if not specified

		// Read the file content using the Navigation Plugin's read_file function
		self.read_file(filePath, style).then(function(fileData) {
			// Check if the default editor has an 'edit' function
			if (typeof defaultEditor.edit === 'function') {
				// Call the editor's edit function with the file path, content, style, permissions, and ownerGroup
				defaultEditor.edit(filePath, fileData.content, style, permissions, ownerGroup);
				if (self.pluginsRegistry['Main'] && typeof self.pluginsRegistry['Main'].activatePlugin === 'function') {
					self.pluginsRegistry['Main'].activatePlugin(defaultEditorName);
					self.popm(null, `[${PN}]: ` + _('File "%s" opened in editor.').format(filePath), 'success');
				} else {
					self.popm(null, `[${PN}]: ` + _('Unable to activate editor plugin.'), 'error');
					console.error(`[${PN}]: ` + _('Main Dispatcher or activatePlugin method not found.'));
				}

			} else {
				// Notify the user if the default editor does not implement the 'edit' function
				self.popm(null, `[${PN}]: ` + _('Default editor does not implement edit function.'), 'error');
			}
		}).catch(function(err) {
			// Notify the user if reading the file fails
			self.popm(null, `[${PN}]: ` + _('Failed to read file "%s": %s').format(filePath, err.message), 'error');
		});
	}
});
