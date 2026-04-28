'use strict';
'require ui';
'require dom';

/**
 * Hex Editor Plugin
 * Provides a hex editor with search functionality, virtual scrolling, and editing capabilities.
 * Supports loading external binary content for editing and displays the filename.
 * Includes configuration for window size and a save button at the bottom, using Text Editor's approach to saving.
 */

const PN = 'Hex Editor';
return Class.extend({

	/**
	 * Returns metadata about the plugin.
	 * @returns {Object} Plugin information.
	 */
	info: function() {
		return {
			name: 'Hex Editor', // Unique plugin name
			type: 'Editor', // Plugin type
			style: 'Bin', // Kind of contents expected for editing
			description: 'A hex editor plugin with search functionality, virtual scrolling, editing, and save button at bottom.'
		};
	},

	/**
	 * CSS styles for the Hex Editor plugin.
	 * All class selectors are prefixed with .{rootClass} to ensure uniqueness.
	 */
	maincss: `
        .{rootClass} {
          position: relative;
          display: flex;
          flex-direction: column;
          resize: both; /* Allows the window to be resizable */
          overflow: hidden; /* Hide scrollbars at the plugin level */
          box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
          font-family: 'Courier New', Courier, monospace; /* Changed to monospace font */
        }

        .{rootClass} .filename-display {
            font-weight: bold;
            color: #333;
            font-size: 14px;
            padding: 5px 10px;
            background-color: #f5f5f5;
            border-bottom: 1px solid #000;
        }

        .{rootClass} .save-button-container {
            padding: 10px;
            background-color: #f5f5f5;
            border-top: 1px solid #000;
            display: flex;
            justify-content: flex-end;
        }

        .{rootClass} .save-button {
            padding: 5px 10px;
            background-color: #0078d7;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }

        .{rootClass} .save-button:hover {
            background-color: #005fa3;
        }

        :root {
          --span-spacing: 0.25ch;
          --clr-background: #f5f5f5;
          --clr-selected: #c9daf8;
          --clr-selected-editing: #6d9eeb;
          --clr-non-printable: #999999;
          --clr-border: #000000;
          --clr-offset: #666666;
          --clr-header: #333333;
          --clr-highlight: yellow; 
          --clr-cursor-active: blue; 
          --clr-cursor-passive: lightblue; 
          --animation-duration: 1s; 
        }

        .{rootClass} .hexedit *,
        .{rootClass} .hexedit *::before,
        .{rootClass} .hexedit *::after {
          box-sizing: border-box;
        }

        .{rootClass} .hexedit {
          display: flex;
          flex-direction: column;
          flex: 1; 
  font-family: 'Courier New', Courier, monospace;
          font-size: 14px;
          line-height: 1.2em;
          background-color: var(--clr-background);
          border: 1px solid var(--clr-border);
          width: 100%;
          flex-grow: 1;
        }

        .{rootClass} .hexedit-headers {
          display: flex;
          background-color: var(--clr-background);
          border-bottom: 2px solid var(--clr-border);
  font-family: 'Courier New', Courier, monospace;
        }

        .{rootClass} .offsets-header,
        .{rootClass} .hexview-header,
        .{rootClass} .textview-header {
          display: flex;
          align-items: center;
          padding: 5px;
          box-sizing: border-box;
          font-weight: bold;
          color: var(--clr-header);
          border-right: 2px solid var(--clr-border);
        }

        .{rootClass} .offsets-header {
          width: 100px; 
          text-align: left;
        }

        .{rootClass} .hexview-header {
          width: calc(16 * 2ch + 20 * var(--span-spacing));
          display: flex;
        }

        .{rootClass} .hexview-header span {
          width: 2ch;
          margin-right: var(--span-spacing);
          text-align: center;
        }

        .{rootClass} .hexview-header span:last-child {
          margin-right: 0;
        }

        .{rootClass} .textview-header {
          flex: 1;
          margin-left: 10px;
          text-align: left;
        }

        .{rootClass} .hexedit-content {
          display: flex;
          height: 100%;
          flex: 1 1 auto;
          overflow: auto;
          position: relative;
          border-top: 2px solid var(--clr-border);
  font-family: 'Courier New', Courier, monospace; 

        }

        .{rootClass} .offsets,
        .{rootClass} .hexview,
        .{rootClass} .textview {
          flex-shrink: 0;
          display: block;
          padding: 5px;
          position: relative;
          border-right: 2px solid var(--clr-border);
        }

        .{rootClass} .offsets {
          width: 100px;
          display: flex;
          flex-direction: column;
          text-align: left;
        }

        .{rootClass} .offsets span {
          display: block;
          height: 1.2em;
        }

        .{rootClass} .hexview {
          width: calc(16 * 2ch + 20 * var(--span-spacing));
          text-align: center;
        }

        .{rootClass} .textview {
          flex: 1;
          margin-left: 10px;
          text-align: left;
          border-right: none;
        }

        .{rootClass} .hex-line,
        .{rootClass} .text-line {
          display: flex;
          height: 1.2em;
        }

        .{rootClass} .hex-line span,
        .{rootClass} .text-line span {
          width: 2ch;
          margin-right: var(--span-spacing);
          text-align: center;
          display: inline-block;
          cursor: default;
        }

        .{rootClass} .hex-line span:last-child,
        .{rootClass} .hexview-header span:last-child,
        .{rootClass} .text-line span:last-child {
          margin-right: 0;
        }

        .{rootClass} .selected {
          background-color: var(--clr-selected);
        }

        .{rootClass} .selected-editing {
          background-color: var(--clr-selected-editing);
        }

        .{rootClass} .non-printable {
          color: var(--clr-non-printable);
        }

        .{rootClass} .offsets::-webkit-scrollbar,
        .{rootClass} .hexview::-webkit-scrollbar,
        .{rootClass} .textview::-webkit-scrollbar {
          display: none;
        }

        .{rootClass} .offsets,
        .{rootClass} .hexview,
        .{rootClass} .textview {
          scrollbar-width: none; 
        }

        .{rootClass} .hexedit .offsets,
        .{rootClass} .hexedit .hexview,
        .{rootClass} .hexedit .textview {
          border-right: 2px solid var(--clr-border);
        }

        .{rootClass} .hexedit .textview {
          border-right: none;
        }

        @media (max-width: 768px) {
          .{rootClass} .hexedit {
            font-size: 12px;
          }

          .{rootClass} .offsets {
            width: 120px; 
          }

          .{rootClass} .hexview {
            width: calc(16 * 2ch + 20 * var(--span-spacing));
          }
        }

        .{rootClass} .hexedit-search-container {
            padding: 10px;
            background-color: #f9f9f9;
            border-bottom: 1px solid #ccc; 
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: 100%;
            box-sizing: border-box;
        }

        .{rootClass} .hexedit-search-group {
            display: flex;
            align-items: center;
            gap: 5px;
            width: 100%;
        }

        .{rootClass} .hexedit-search-input {
            flex: 1;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }

        .{rootClass} .hexedit-search-status {
            width: 50px;
            text-align: center;
            font-size: 14px;
            color: #555;
        }

        .{rootClass} .hexedit-search-button {
            padding: 8px 12px;
            cursor: pointer;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            transition: background-color 0.3s ease;
        }

        .{rootClass} .hexedit-search-button:hover {
            background-color: #0056b3;
        }

        .{rootClass} .search-highlight {
            background-color: var(--clr-highlight);
        }

        @keyframes blink-blue {
            0% { background-color: var(--clr-cursor-active); }
            50% { background-color: white; }
            100% { background-color: var(--clr-cursor-active); }
        }

        .{rootClass} .active-view-cursor {
            animation: blink-blue var(--animation-duration) infinite;
            background-color: var(--clr-cursor-active);
        }

        .{rootClass} .passive-view-cursor {
            background-color: var(--clr-cursor-passive);
        }

        .{rootClass} .highlighted {
            background-color: var(--clr-highlight);
        }
    `,

	/**
	 * Initializes and starts the Hex Editor plugin.
	 * @param {HTMLElement} container - The container element for the plugin.
	 * @param {Object} pluginsRegistry - Registry of available plugins.
	 * @param {Object} default_plugins - Default plugins to be used.
	 * @param {string} uniqueId - Unique identifier for this plugin instance.
	 */
	start: function(container, pluginsRegistry, default_plugins, uniqueId) {
		var self = this;

		// Ensure the plugin is only initialized once per uniqueId
		if (self.initializedIds && self.initializedIds.includes(uniqueId)) {
			return;
		}
		if (!self.initializedIds) {
			self.initializedIds = [];
		}
		self.initializedIds.push(uniqueId);

		// Store references for later use
		self.pluginsRegistry = pluginsRegistry;
		self.default_plugins = default_plugins;

		// Process and inject CSS with uniqueId
		const rootClass = `hex-editor-plugin-${uniqueId}`;
		const processedCss = this.maincss.replace(/{rootClass}/g, rootClass);
		// Inject the processed CSS into the document
		const styleTag = document.createElement('style');
		styleTag.textContent = processedCss;
		document.head.appendChild(styleTag);

		// Dynamically fetch the default Dispatcher plugin
		var defaultDispatcherName = self.default_plugins['Dispatcher'];
		if (defaultDispatcherName && self.pluginsRegistry[defaultDispatcherName]) {
			var defaultDispatcher = self.pluginsRegistry[defaultDispatcherName];
			self.popm = defaultDispatcher.pop.bind(defaultDispatcher);
		}

		// Dynamically fetch the default Navigation plugin
		var navigationPluginName = self.default_plugins['Navigation'];
		if (!navigationPluginName) {
			self.popm(null, `[${PN}]: ` + _('No default Navigation plugin set.'));
			console.error('No default Navigation plugin set.');
			return;
		}

		var navigationPlugin = self.pluginsRegistry[navigationPluginName];
		if (!navigationPlugin || typeof navigationPlugin.write_file !== 'function') {
			self.popm(null, `[${PN}]: ` + _('Navigation plugin does not support writing files.'));
			console.error('Navigation plugin is unavailable or missing write_file function.');
			return;
		}

		self.write_file = navigationPlugin.write_file.bind(navigationPlugin);

		// Create the main div for the hex editor with unique root class
		self.editorDiv = document.createElement('div');
		self.editorDiv.className = rootClass;

		// Set initial size
		self.width = self.settings && self.settings.width ? self.settings.width : '600px';
		self.height = self.settings && self.settings.height ? self.settings.height : '400px';
		self.editorDiv.style.width = self.width;
		self.editorDiv.style.height = self.height;

		// Filename display at the top
		self.filenameDisplay = document.createElement('div');
		self.filenameDisplay.className = 'filename-display';
		self.filenameDisplay.textContent = 'No file loaded.';
		self.editorDiv.appendChild(self.filenameDisplay);

		// Initialize hex editor inside editorDiv
		self.hexEditorInstance = self.initializeHexEditor(self.editorDiv, rootClass);

		// Create the save button container at the bottom
		self.saveButtonContainer = document.createElement('div');
		self.saveButtonContainer.className = 'save-button-container';

		self.saveButton = document.createElement('button');
		self.saveButton.className = 'save-button';
		self.saveButton.textContent = 'Save';
		self.saveButton.onclick = function() {
			if (!self.currentFilePath) {
				self.popm(null, `[${PN}]: ` + _('No file loaded to save.'));
				return;
			}

			var data = self.hexEditorInstance.getData();
			var content = data.buffer;

			// Attempt to save the file (similar to Text Editor approach)
			self.write_file(self.currentFilePath, self.permissions, self.ownerGroup, content, 'bin')

				.then(function() {
					self.popm(null, `[${PN}]: ` + _('File saved successfully.'));
				})
				.catch(function(err) {
					self.popm(null, `[${PN}]: ` + _('Error saving file.'));
					console.error('Error saving file:', err);
				});
		};

		self.saveButtonContainer.appendChild(self.saveButton);
		self.editorDiv.appendChild(self.saveButtonContainer);

		// Append the editor div to the provided container
		container.appendChild(self.editorDiv);
	},

	byteToChar: function(b) {
		return (b >= 32 && b <= 126) ? String.fromCharCode(b) : this._NON_PRINTABLE_CHAR;
	},


	/**
	 * Initializes the HexEditor instance.
	 * @param {HTMLElement} container - The container element for the hex editor.
	 * @param {string} rootClass - Unique root class for scoping CSS.
	 * @returns {HexEditor} - The initialized HexEditor instance.
	 */
	initializeHexEditor: function(container, rootClass) {
		var self = this;

		/**
		 * HexEditor class to handle hex editing functionalities.
		 */
		class HexEditor {
			/**
			 * Constructs a HexEditor instance.
			 *
			 * @param {HTMLElement} hexeditDomObject - The DOM element for the hex editor.
			 * @param {string} rootClass - Unique root class for scoping CSS.
			 */
			constructor(hexeditDomObject, rootClass) {
				this.rootClass = rootClass;
				this.hexedit = this.fillHexeditDom(hexeditDomObject);
				this.offsets = this.hexedit.querySelector(`.${rootClass} .offsets`);
				this.hexview = this.hexedit.querySelector(`.${rootClass} .hexview`);
				this.textview = this.hexedit.querySelector(`.${rootClass} .textview`);
				this.hexeditContent = this.hexedit.querySelector(`.${rootClass} .hexedit-content`);
				this.hexeditHeaders = this.hexedit.querySelector(`.${rootClass} .hexedit-headers`);

				this.bytesPerRow = 16;
				this.startIndex = 0;
				this.data = new Uint8Array(0);

				this.selectedIndex = null;
				this.editHex = true;
				this.currentEdit = "";
				this.readonly = false;
				this.ctrlPressed = false;

				this.matches = [];
				this.currentMatchIndex = -1;
				this.currentSearchType = null;
				this.activeView = null;
				this.previousSelectedIndex = null;

				this.lastSearchPatterns = {
					ascii: '',
					hex: '',
					regex: ''
				};

				this._NON_PRINTABLE_CHAR = "\u00B7";

				this._registerEventHandlers();

				this.resizeObserver = new ResizeObserver(() => {
					this.calculateVisibleRows();
				});
				this.resizeObserver.observe(this.hexeditContent);

				this.addSearchUI();
			}

			/**
			 * Adds the search interface with input fields, status fields, and navigation buttons.
			 */
			addSearchUI() {
				// Create search container
				const searchContainer = document.createElement('div');
				searchContainer.classList.add('hexedit-search-container');

				// Helper function to create search groups
				const createSearchGroup = (type, placeholder) => {
					const container = document.createElement('div');
					container.classList.add('hexedit-search-group');

					const input = document.createElement('input');
					input.type = 'text';
					input.placeholder = placeholder;
					input.classList.add('hexedit-search-input');
					input.id = `hexedit-search-${type}`;

					const status = document.createElement('span');
					status.classList.add('hexedit-search-status');
					status.id = `hexedit-search-status-${type}`;
					status.textContent = '0/0'; // Initial status

					const prevButton = document.createElement('button');
					prevButton.innerHTML = '&#8593;'; // Up arrow
					prevButton.classList.add('hexedit-search-button');
					prevButton.title = `Previous ${type.toUpperCase()} Match`;

					const nextButton = document.createElement('button');
					nextButton.innerHTML = '&#8595;'; // Down arrow
					nextButton.classList.add('hexedit-search-button');
					nextButton.title = `Next ${type.toUpperCase()} Match`;

					container.appendChild(input);
					container.appendChild(status);
					container.appendChild(prevButton);
					container.appendChild(nextButton);

					// Add event listeners for buttons
					prevButton.addEventListener('click', () => this.handleFindPrevious(type));
					nextButton.addEventListener('click', () => this.handleFindNext(type));

					// Add event listener for Enter key
					input.addEventListener('keydown', (e) => {
						if (e.key === 'Enter') this.handleFindNext(type);
					});

					return container;
				};

				// Create ASCII search group
				const asciiGroup = createSearchGroup('ascii', _('Search ASCII'));

				// Create HEX search group
				const hexGroup = createSearchGroup('hex', _('Search HEX (e.g., 4F6B)'));

				// Create RegExp search group
				const regexGroup = createSearchGroup('regex', _('Search RegExp (e.g., \\d{3})'));

				// Append all search groups to the search container
				searchContainer.appendChild(asciiGroup);
				searchContainer.appendChild(hexGroup);
				searchContainer.appendChild(regexGroup);

				// Insert the search container above the hexedit headers
				if (this.hexeditHeaders) {
					this.hexedit.insertBefore(searchContainer, this.hexeditHeaders);
				} else {
					// Fallback: append to hexedit if headers are not found
					this.hexeditContent.insertBefore(searchContainer, this.hexeditContent.firstChild);
				}
			}

			/**
			 * Handles the "Find Next" button click for a specific search type.
			 *
			 * @param {string} searchType - The type of search ('ascii', 'hex', 'regex').
			 */
			handleFindNext(searchType) {
				const inputElement = document.getElementById(`hexedit-search-${searchType}`);
				const currentPattern = inputElement.value.trim();

				// Check if the search pattern has changed
				if (this.lastSearchPatterns[searchType] !== currentPattern) {
					// Update the last search pattern
					this.lastSearchPatterns[searchType] = currentPattern;

					// Set the current search type and active view
					this.currentSearchType = searchType;
					this.activeView = (searchType === 'hex') ? 'hex' : 'text';

					// Perform search
					this.performSearch(searchType);
				} else {
					// If the search pattern has not changed, just go to the next match
					if (this.currentSearchType === searchType && this.matches.length > 0) {
						// Set activeView based on currentSearchType
						this.activeView = (this.currentSearchType === 'hex') ? 'hex' : 'text';

						// Navigate to the next match relative to the current cursor position
						const cursorPosition = this.selectedIndex !== null ? this.selectedIndex : 0;
						const nextMatchIndex = this.findNextMatch(cursorPosition);
						if (nextMatchIndex !== -1) {
							this.navigateToMatch(nextMatchIndex);
						} else {
							// If there is no next match, go to the first one
							this.navigateToMatch(0);
						}
					}
				}
			}

			/**
			 * Handles the "Find Previous" button click for a specific search type.
			 *
			 * @param {string} searchType - The type of search ('ascii', 'hex', 'regex').
			 */
			handleFindPrevious(searchType) {
				const inputElement = document.getElementById(`hexedit-search-${searchType}`);
				const currentPattern = inputElement.value.trim();

				// Check if the search pattern has changed
				if (this.lastSearchPatterns[searchType] !== currentPattern) {
					// Update the last search pattern
					this.lastSearchPatterns[searchType] = currentPattern;

					// Set the current search type and active view
					this.currentSearchType = searchType;
					this.activeView = (searchType === 'hex') ? 'hex' : 'text';

					// Perform search
					this.performSearch(searchType);
				} else {
					// If the search pattern has not changed, just go to the previous match
					if (this.currentSearchType === searchType && this.matches.length > 0) {
						// Set activeView based on currentSearchType
						this.activeView = (this.currentSearchType === 'hex') ? 'hex' : 'text';

						// Navigate to the previous match relative to the current cursor position
						const cursorPosition = this.selectedIndex !== null ? this.selectedIndex : this.data.length;
						const prevMatchIndex = this.findPreviousMatch(cursorPosition);
						if (prevMatchIndex !== -1) {
							this.navigateToMatch(prevMatchIndex);
						} else {
							// If there is no previous match, go to the last one
							this.navigateToMatch(this.matches.length - 1);
						}
					}
				}
			}

			/**
			 * Finds the index of the next match after the given cursor position.
			 *
			 * @param {number} cursorPosition - The current cursor position.
			 * @returns {number} - The index in the matches array or -1 if not found.
			 */
			findNextMatch(cursorPosition) {
				for (let i = 0; i < this.matches.length; i++) {
					if (this.matches[i].index > cursorPosition) {
						return i;
					}
				}
				// If there are no matches after the cursor position, return -1
				return -1;
			}

			/**
			 * Finds the index of the previous match before the given cursor position.
			 *
			 * @param {number} cursorPosition - The current cursor position.
			 * @returns {number} - The index in the matches array or -1 if not found.
			 */
			findPreviousMatch(cursorPosition) {
				for (let i = this.matches.length - 1; i >= 0; i--) {
					if (this.matches[i].index < cursorPosition) {
						return i;
					}
				}
				// If there are no matches before the cursor position, return -1
				return -1;
			}

			/**
			 * Performs the search based on the specified search type.
			 *
			 * @param {string} searchType - The type of search ('ascii', 'hex', 'regex').
			 */
			performSearch(searchType) {
				let pattern = '';
				switch (searchType) {
					case 'ascii':
						pattern = document.getElementById(`hexedit-search-${searchType}`).value.trim();
						break;
					case 'hex':
						pattern = document.getElementById(`hexedit-search-${searchType}`).value.trim();
						break;
					case 'regex':
						pattern = document.getElementById(`hexedit-search-${searchType}`).value.trim();
						break;
					default:
						console.warn(`Unknown search type: ${searchType}`);
						pattern = '';
						break;
				}

				// Reset previous search results
				this.clearSearchHighlights();
				this.matches = [];
				this.currentMatchIndex = -1;

				if (!pattern) {
					// Update status field to 0/0
					this.updateSearchStatus(searchType, 0, 0);
					console.log('No search pattern entered.');
					return;
				}

				try {
					// Determine search type and perform search
					if (searchType === 'ascii') {
						this.searchASCII(pattern);
					} else if (searchType === 'hex') {
						this.searchHEX(pattern);
					} else if (searchType === 'regex') {
						this.searchRegex(pattern);
					}
				} catch (error) {
					console.log(`Error during search: ${error.message}`);
					// Update status field to 0/0 on error
					this.updateSearchStatus(searchType, 0, 0);
					return;
				}

				// After searching, highlight all matches and navigate to the first one
				if (this.matches.length > 0) {
					this.highlightAllMatches(searchType);
					this.currentMatchIndex = 0;
					this.navigateToMatch(this.currentMatchIndex);
					// Update status field with actual match count
					this.updateSearchStatus(searchType, this.currentMatchIndex + 1, this.matches.length);
					console.log(`Found ${this.matches.length} matches.`);
				} else {
					// Update status field to 0/0 if no matches found
					this.updateSearchStatus(searchType, 0, 0);
					console.log('No matches found.');
				}
			}

			/**
			 * Highlights all matched patterns in the hex and text views based on search type.
			 *
			 * @param {string} searchType - The type of search ('ascii', 'hex', 'regex').
			 */
			highlightAllMatches(searchType) {
				// Rendering will handle highlights based on this.matches
				this.searchTypeForHighlight = searchType; // Store current search type for rendering

				// Set active view based on search type
				if (searchType === 'ascii' || searchType === 'regex') {
					this.activeView = 'text'; // Text view is active
				} else if (searchType === 'hex') {
					this.activeView = 'hex'; // Hex view is active
				}

				// Focus the corresponding view
				this.focusActiveView();

				this.renderDom(); // Re-render to apply the highlights
			}

			/**
			 * Navigates to a specific match by its index.
			 *
			 * @param {number} matchIndex - The index in the matches array to navigate to.
			 */
			navigateToMatch(matchIndex) {
				if (this.matches.length === 0) {
					// Update status field to 0/0 if no matches
					this.updateSearchStatus(this.currentSearchType, 0, 0);
					console.log('No matches to navigate.');
					return;
				}

				// Ensure matchIndex is within bounds
				if (matchIndex < 0 || matchIndex >= this.matches.length) {
					console.log('navigateToMatch: matchIndex out of bounds.');
					return;
				}

				this.currentMatchIndex = matchIndex;
				const match = this.matches[matchIndex];

				// Set activeView based on currentSearchType during navigation
				this.activeView = (this.currentSearchType === 'hex') ? 'hex' : 'text';

				// Set selected index to the match start
				this.setSelectedIndex(match.index);
				console.log(`Navigated to match ${matchIndex + 1} at offset ${match.index.toString(16)}`);

				// Update status field
				this.updateSearchStatus(this.currentSearchType, this.currentMatchIndex + 1, this.matches.length);
			}

			/**
			 * Searches for an ASCII pattern and stores all match positions.
			 *
			 * @param {string} pattern - The ASCII pattern to search for.
			 */
			searchASCII(pattern) {
				const dataStr = new TextDecoder('iso-8859-1').decode(this.data);
				let startIndex = 0;
				let index;
				while ((index = dataStr.indexOf(pattern, startIndex)) !== -1) {
					this.matches.push({
						index: index,
						length: pattern.length
					});
					startIndex = index + pattern.length;
				}
				console.log(`searchASCII: Found ${this.matches.length} matches.`);
			}

			/**
			 * Searches for a HEX pattern and stores all match positions.
			 *
			 * @param {string} pattern - The HEX pattern to search for (e.g., "4F6B").
			 */
			searchHEX(pattern) {
				// Remove spaces and validate hex string
				const cleanedPattern = pattern.replace(/\s+/g, '');
				if (!/^[0-9a-fA-F]+$/.test(cleanedPattern)) {
					throw new Error('Invalid HEX pattern.');
				}
				if (cleanedPattern.length % 2 !== 0) {
					throw new Error('HEX pattern length must be even.');
				}

				// Convert hex string to byte array
				const bytePattern = new Uint8Array(cleanedPattern.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

				for (let i = 0; i <= this.data.length - bytePattern.length; i++) {
					let found = true;
					for (let j = 0; j < bytePattern.length; j++) {
						if (this.data[i + j] !== bytePattern[j]) {
							found = false;
							break;
						}
					}
					if (found) {
						this.matches.push({
							index: i,
							length: bytePattern.length
						});
					}
				}
				console.log(`searchHEX: Found ${this.matches.length} matches.`);
			}

			/**
			 * Searches using a regular expression and stores all match positions.
			 *
			 * @param {RegExp} regexPattern - The regular expression pattern to search for.
			 */
			searchRegex(regexPattern) {
				const regex = new RegExp(regexPattern, 'g');
				const dataStr = new TextDecoder('iso-8859-1').decode(this.data);
				let match;
				while ((match = regex.exec(dataStr)) !== null) {
					const byteIndex = match.index; // With 'iso-8859-1', char index == byte index
					const length = match[0].length;
					this.matches.push({
						index: byteIndex,
						length: length
					});
					// Prevent infinite loops with zero-length matches
					if (match.index === regex.lastIndex) {
						regex.lastIndex++;
					}
				}
				console.log(`searchRegex: Found ${this.matches.length} matches.`);
			}

			/**
			 * Scrolls the editor to make the match at the specified index visible.
			 *
			 * @param {number} index - The byte index of the match.
			 */
			scrollToMatch(index) {
				const lineNumber = Math.floor(index / this.bytesPerRow);
				const lineHeight = 16; // Height of one row in pixels

				// Calculate new scroll position to ensure the matched line is visible
				const newScrollTop = Math.max(0, (lineNumber * lineHeight) - ((this.visibleRows / 2) * lineHeight));

				console.log(`scrollToMatch called with index: ${index}`);
				console.log(`lineNumber: ${lineNumber}`);
				console.log(`newScrollTop: ${newScrollTop}`);

				// Update the scrollTop property to trigger handleScroll
				this.hexeditContent.scrollTop = newScrollTop;
			}

			/**
			 * Clears previous search highlights.
			 */
			clearSearchHighlights() {
				// Remove previous highlights
				this.hexview.querySelectorAll('.search-highlight').forEach(span => {
					span.classList.remove('search-highlight');
				});
				this.textview.querySelectorAll('.search-highlight').forEach(span => {
					span.classList.remove('search-highlight');
				});

				// Reset active view
				this.activeView = null;

				// Reset all search status fields to 0/0
				['ascii', 'hex', 'regex'].forEach(type => {
					this.updateSearchStatus(type, 0, 0);
				});
			}

			/**
			 * Calculates the number of visible rows based on the container's height.
			 */
			calculateVisibleRows() {
				const lineHeight = 16; // Height of one row in pixels
				const containerHeight = this.hexeditContent.clientHeight;
				this.visibleRows = Math.floor(containerHeight / lineHeight);
				this.visibleByteCount = this.bytesPerRow * this.visibleRows;
				// console.log(`calculateVisibleRows: visibleRows=${this.visibleRows}, visibleByteCount=${this.visibleByteCount}`);
				this.renderDom(); // Re-render to apply the new rows
			}

			/**
			 * Sets the data to be displayed in the hex editor.
			 *
			 * @param {Uint8Array} data - The data to set.
			 */
			setData(data) {
				this.data = data;
				this.totalRows = Math.ceil(this.data.length / this.bytesPerRow);
				console.log(`setData: data length=${this.data.length}, totalRows=${this.totalRows}`);
				this.calculateVisibleRows(); // Ensure visibleRows are calculated before rendering
			}

			/**
			 * Retrieves the current data from the hex editor.
			 *
			 * @returns {Uint8Array} - The current data.
			 */
			getData() {
				return this.data;
			}

			/**
			 * Handles the scroll event for virtual scrolling.
			 *
			 * @param {Event} event - The scroll event.
			 */
			handleScroll(event) {
				const scrollTop = this.hexeditContent.scrollTop;
				const lineHeight = 16; // Approximate height of a byte row in pixels
				const firstVisibleLine = Math.floor(scrollTop / lineHeight);
				const newStartIndex = firstVisibleLine * this.bytesPerRow;

				// console.log(`handleScroll: scrollTop=${scrollTop}, firstVisibleLine=${firstVisibleLine}, newStartIndex=${newStartIndex}`);

				// Update startIndex and re-render the DOM if necessary
				if (newStartIndex !== this.startIndex) {
					this.startIndex = newStartIndex;
					this.renderDom(); // Re-render visible data
					// console.log(`handleScroll: Updated startIndex and rendered DOM.`);
				}
			}

			/**
			 * Renders the visible portion of the hex editor based on the current scroll position.
			 */
			renderDom() {
				// Clear existing content
				[this.offsets, this.hexview, this.textview].forEach(view => view.innerHTML = '');
				const lineHeight = 16; // Approximate line height in pixels
				const totalLines = Math.ceil(this.data.length / this.bytesPerRow);

				// Set the height of the content area to simulate the total height
				const contentHeight = totalLines * lineHeight;
				[this.offsets, this.hexview, this.textview].forEach(view => view.style.height = `${contentHeight}px`);
				// Create fragments to hold the visible content
				const offsetsFragment = document.createDocumentFragment();
				const hexviewFragment = document.createDocumentFragment();
				const textviewFragment = document.createDocumentFragment();

				// Calculate the start and end lines to render
				const startLine = Math.floor(this.startIndex / this.bytesPerRow);
				const endIndex = Math.min(this.startIndex + this.visibleByteCount, this.data.length);
				const endLine = Math.ceil(endIndex / this.bytesPerRow);

				const paddingTop = startLine * lineHeight;

				// Apply padding to offset the content to the correct vertical position
				this.offsets.style.paddingTop = paddingTop + 'px';
				this.hexview.style.paddingTop = paddingTop + 'px';
				this.textview.style.paddingTop = paddingTop + 'px';

				// Render only the visible lines
				for (let line = startLine; line < endLine; line++) {
					const i = line * this.bytesPerRow;

					// Offsets
					const offsetSpan = document.createElement("span");
					offsetSpan.innerText = i.toString(16).padStart(8, '0');
					offsetsFragment.appendChild(offsetSpan);

					// Hexview line
					const hexLine = document.createElement('div');
					hexLine.classList.add('hex-line');

					// Textview line
					const textLine = document.createElement('div');
					textLine.classList.add('text-line');

					for (let j = 0; j < this.bytesPerRow && i + j < this.data.length; j++) {
						const index = i + j;
						const byte = this.data[index];

						// Create hex span
						const hexSpan = document.createElement('span');
						hexSpan.textContent = byte.toString(16).padStart(2, '0');
						hexSpan.dataset.byteIndex = index;

						// Apply search highlights based on search type
						this.matches.forEach(match => {
							if (index >= match.index && index < match.index + match.length) {
								hexSpan.classList.add('search-highlight');
							}
						});

						hexLine.appendChild(hexSpan);

						// Create text span
						const charSpan = document.createElement('span');
						let text = self.byteToChar(byte);
						if (text === " ") text = "\u00A0";
						else if (text === "-") text = "\u2011";
						charSpan.textContent = text;
						charSpan.dataset.byteIndex = index;
						if (text === this._NON_PRINTABLE_CHAR) {
							charSpan.classList.add("non-printable");
						}

						// Apply search highlights based on search type
						this.matches.forEach(match => {
							if (index >= match.index && index < match.index + match.length) {
								charSpan.classList.add('search-highlight');
							}
						});

						textLine.appendChild(charSpan);
					}

					hexviewFragment.appendChild(hexLine);
					textviewFragment.appendChild(textLine);
				}

				this.offsets.appendChild(offsetsFragment);
				this.hexview.appendChild(hexviewFragment);
				this.textview.appendChild(textviewFragment);

				this.updateSelection();
			}

			/**
			 * Updates the visual selection in the hex and text views.
			 */
			updateSelection() {
				// Restore the background color of the previous selection if any
				if (this.previousSelectedIndex !== null) {
					const prevHexSpan = this.hexview.querySelector(`span[data-byte-index="${this.previousSelectedIndex}"]`);
					const prevTextSpan = this.textview.querySelector(`span[data-byte-index="${this.previousSelectedIndex}"]`);
					if (prevHexSpan && prevTextSpan) {
						// Remove active cursor classes
						prevHexSpan.classList.remove('active-view-cursor');
						prevTextSpan.classList.remove('active-view-cursor');

						// Restore background based on whether it was part of a match
						const wasInMatch = this.matches.some(match => this.previousSelectedIndex >= match.index && this.previousSelectedIndex < match.index + match.length);
						if (wasInMatch) {
							prevHexSpan.classList.add('highlighted');
							prevTextSpan.classList.add('highlighted');
						} else {
							prevHexSpan.classList.remove('highlighted');
							prevTextSpan.classList.remove('highlighted');
						}
					}
				}

				// Clear previous selection classes from active and passive views
				Array.from(this.hexedit.querySelectorAll(".active-view-cursor, .passive-view-cursor, .highlighted"))
					.forEach(e => e.classList.remove("active-view-cursor", "passive-view-cursor", "highlighted"));

				if (this.selectedIndex === null) return;

				// Check if selectedIndex is within the rendered range
				if (this.selectedIndex >= this.startIndex && this.selectedIndex < this.startIndex + this.visibleByteCount) {
					const hexSpan = this.hexview.querySelector(`span[data-byte-index="${this.selectedIndex}"]`);
					const textSpan = this.textview.querySelector(`span[data-byte-index="${this.selectedIndex}"]`);
					if (hexSpan && textSpan) {
						// Determine if the selected byte is part of a match
						const isInMatch = this.matches.some(match => this.selectedIndex >= match.index && this.selectedIndex < match.index + match.length);

						// Store current selected index as previous for next update
						this.previousSelectedIndex = this.selectedIndex;

						if (this.activeView === 'hex') {
							// Active view is Hex
							hexSpan.classList.add("active-view-cursor"); // Blinking blue
							// Passive view (Text)
							textSpan.classList.add("passive-view-cursor"); // Always light blue
						} else if (this.activeView === 'text') {
							// Active view is Text
							textSpan.classList.add("active-view-cursor"); // Blinking blue
							// Passive view (Hex)
							hexSpan.classList.add("passive-view-cursor"); // Always light blue
						}

						// Highlight the selected byte if it was part of a match
						if (isInMatch) {
							if (this.activeView === 'hex') {
								hexSpan.classList.add('highlighted');
							} else if (this.activeView === 'text') {
								textSpan.classList.add('highlighted');
							}
						}

						// Enable immediate editing in active view
						if (this.activeView === 'hex') {
							this.editHex = true;
						} else if (this.activeView === 'text') {
							this.editHex = false;
						}

						// Focus the active view to enable immediate editing
						this.focusActiveView();
					}
				}
			}

			/**
			 * Focuses the active view (hex or text).
			 */
			focusActiveView() {
				if (this.activeView === 'hex') {
					this.hexview.focus();
				} else if (this.activeView === 'text') {
					this.textview.focus();
				}
			}

			/**
			 * Registers event handlers for the hex editor.
			 */
			_registerEventHandlers() {
				// Make hexview and textview focusable by setting tabindex
				this.hexview.tabIndex = 0;
				this.textview.tabIndex = 0;

				// Handle focus on hexview
				this.hexview.addEventListener("focus", () => {
					this.activeView = 'hex';
					this.updateSelection();
				});

				// Handle focus on textview
				this.textview.addEventListener("focus", () => {
					this.activeView = 'text';
					this.updateSelection();
				});

				// Handle click on hexview
				this.hexview.addEventListener("click", e => {
					if (e.target.dataset.byteIndex === undefined) return;
					const index = parseInt(e.target.dataset.byteIndex);
					this.currentEdit = "";
					this.editHex = true;
					this.setSelectedIndex(index);
					this.hexview.focus(); // Ensure hexview gains focus
				});

				// Handle click on textview
				this.textview.addEventListener("click", e => {
					if (e.target.dataset.byteIndex === undefined) return;
					const index = parseInt(e.target.dataset.byteIndex);
					this.currentEdit = "";
					this.editHex = false;
					this.setSelectedIndex(index);
					this.textview.focus(); // Ensure textview gains focus
				});

				// Handle keydown events
				this.hexedit.addEventListener("keydown", e => {
					// If the target is an input (search UI), do not handle hex editor key events
					if (e.target.tagName.toLowerCase() === 'input') return;

					if (e.key === "Control") this.ctrlPressed = true;
					if (this.selectedIndex === null || this.ctrlPressed) return;
					if (e.key === "Escape") {
						this.currentEdit = "";
						this.setSelectedIndex(null);
						return;
					}
					if (this.readonly) {
						const offsetChange = this._keyShouldApply(e) ?? 0;
						this.setSelectedIndex(this.selectedIndex + offsetChange);
						return;
					}
					// Handle key inputs
					const key = e.key;
					if (this.editHex && key.length === 1 && key.match(/[0-9a-fA-F]/)) {
						this.currentEdit += key;
						e.preventDefault();
						if (this.currentEdit.length === 2) {
							const value = parseInt(this.currentEdit, 16);
							this.setValueAt(this.selectedIndex, value);
							this.currentEdit = "";
							this.setSelectedIndex(this.selectedIndex + 1);
						}
					} else if (!this.editHex && key.length === 1) {
						const value = key.charCodeAt(0);
						this.setValueAt(this.selectedIndex, value);
						this.setSelectedIndex(this.selectedIndex + 1);
						e.preventDefault();
					} else {
						const offsetChange = this._keyShouldApply(e);
						if (offsetChange) {
							this.setSelectedIndex(this.selectedIndex + offsetChange);
							e.preventDefault();
						}
					}
				});

				// Handle keyup events
				this.hexedit.addEventListener("keyup", e => {
					if (e.key === "Control") this.ctrlPressed = false;
				});

				// Handle scrolling for virtual scrolling
				this.hexeditContent.addEventListener('scroll', this.handleScroll.bind(this));
			}

			/**
			 * Sets the value at a specific index in the data and updates the view if necessary.
			 *
			 * @param {number} index - The byte index to set.
			 * @param {number} value - The value to set.
			 */
			setValueAt(index, value) {
				this.data[index] = value;
				// If the index is within the rendered range, update the display
				if (index >= this.startIndex && index < this.startIndex + this.visibleByteCount) {
					const hexSpan = this.hexview.querySelector(`span[data-byte-index="${index}"]`);
					const textSpan = this.textview.querySelector(`span[data-byte-index="${index}"]`);
					if (hexSpan) hexSpan.textContent = value.toString(16).padStart(2, '0');
					if (textSpan) {
						let text = self.byteToChar(value);
						if (text === " ") text = "\u00A0";
						else if (text === "-") text = "\u2011";
						textSpan.textContent = text;
						if (text === this._NON_PRINTABLE_CHAR) {
							textSpan.classList.add("non-printable");
						} else {
							textSpan.classList.remove("non-printable");
						}
					}
				}
			}

			/**
			 * Sets the currently selected byte index and updates the view.
			 *
			 * @param {number|null} index - The byte index to select, or null to clear selection.
			 */
			setSelectedIndex(index) {
				this.selectedIndex = index;
				// console.log(`setSelectedIndex called with index: ${index}`);

				if (index !== null) {
					// Calculate the line number of the selected index
					const lineNumber = Math.floor(index / this.bytesPerRow);
					const lineHeight = 16; // Height of one row in pixels
					const scrollTop = lineNumber * lineHeight;

					// Determine visible range
					const visibleStartLine = Math.floor(this.hexeditContent.scrollTop / lineHeight);
					const visibleEndLine = visibleStartLine + this.visibleRows;

					// console.log(`setSelectedIndex: lineNumber=${lineNumber}, visibleStartLine=${visibleStartLine}, visibleEndLine=${visibleEndLine}`);

					// If the selected line is out of the visible range, update scrollTop
					if (lineNumber < visibleStartLine || lineNumber >= visibleEndLine) {
						const newScrollTop = Math.max(0, (lineNumber * lineHeight) - ((this.visibleRows / 2) * lineHeight));
						this.hexeditContent.scrollTop = newScrollTop;
						// console.log(`setSelectedIndex: Updated scrollTop to ${this.hexeditContent.scrollTop}`);
					}
				}

				this.updateSelection();
			}

			/**
			 * Updates the search status field for a given search type.
			 *
			 * @param {string} searchType - The type of search ('ascii', 'hex', 'regex').
			 * @param {number} current - The current match index.
			 * @param {number} total - The total number of matches.
			 */
			updateSearchStatus(searchType, current, total) {
				// Update only the relevant search type status field
				['ascii', 'hex', 'regex'].forEach(type => {
					const statusElement = document.getElementById(`hexedit-search-status-${type}`);
					if (type === searchType) {
						statusElement.textContent = `${current}/${total}`;
					} else {
						statusElement.textContent = `0/0`;
					}
				});
			}

			/**
			 * Determines if a key event should result in a byte index change.
			 *
			 * @param {KeyboardEvent} event - The keyboard event.
			 * @returns {number|null} - The byte index change or null.
			 */
			_keyShouldApply(event) {
				if (event.key === "Enter") return 1;
				if (event.key === "Tab") return 1;
				if (event.key === "Backspace") return -1;
				if (event.key === "ArrowLeft") return -1;
				if (event.key === "ArrowRight") return 1;
				if (event.key === "ArrowUp") return -16;
				if (event.key === "ArrowDown") return 16;
				return null;
			}

			/**
			 * Fills the hex editor DOM structure.
			 *
			 * @param {HTMLElement} hexedit - The DOM element for the hex editor.
			 * @returns {HTMLElement} - The filled hex editor DOM element.
			 */
			fillHexeditDom(hexedit) {
				hexedit.classList.add('hexedit');

				// Create headers
				const offsetsHeader = document.createElement("div");
				offsetsHeader.classList.add("offsets-header");
				offsetsHeader.innerText = _('Offset (h)');

				const hexviewHeader = document.createElement("div");
				hexviewHeader.classList.add("hexview-header");
				for (let i = 0; i < 16; i++) {
					const span = document.createElement("span");
					span.innerText = i.toString(16).toUpperCase().padStart(2, "0");
					hexviewHeader.appendChild(span);
				}

				const textviewHeader = document.createElement("div");
				textviewHeader.classList.add("textview-header");
				textviewHeader.innerText = _('Decoded Text');

				// Header container
				const headersContainer = document.createElement("div");
				headersContainer.classList.add("hexedit-headers");
				headersContainer.appendChild(offsetsHeader);
				headersContainer.appendChild(hexviewHeader);
				headersContainer.appendChild(textviewHeader);

				// Create content areas
				const offsets = document.createElement("div");
				offsets.classList.add("offsets");

				const hexview = document.createElement("div");
				hexview.classList.add("hexview");

				const textview = document.createElement("div");
				textview.classList.add("textview");

				// Content container
				const contentContainer = document.createElement("div");
				contentContainer.classList.add("hexedit-content");
				contentContainer.appendChild(offsets);
				contentContainer.appendChild(hexview);
				contentContainer.appendChild(textview);

				// Assemble hex editor
				hexedit.appendChild(headersContainer);
				hexedit.appendChild(contentContainer);

				// Assign references
				hexedit.offsets = offsets;
				hexedit.hexview = hexview;
				hexedit.textview = textview;
				hexedit.headersContainer = headersContainer;
				hexedit.contentContainer = contentContainer;

				return hexedit;
			}
		}

		// Instantiate HexEditor with rootClass
		var hexEditorInstance = new HexEditor(container, rootClass);

		return hexEditorInstance;
	},

	/**
	 * Opens a file in the hex editor.
	 * @param {string} filePath - The path to the file to edit.
	 * @param {string | ArrayBuffer} content - The content of the file.
	 * @param {string} style - The style of the content ('Text' or 'Bin').
	 */
	edit: function(filePath, content, style, permissions, ownerGroup) {
		var self = this;

		if (style.toLowerCase() !== 'bin') {
			self.popm(null, `[${PN}]: ` + _('Unsupported style "' + style + '". Only "Bin" is supported.'));
			console.warn('Unsupported style:', style);
			return;
		}

		self.currentFilePath = filePath;
		self.permissions = permissions;
		self.ownerGroup = ownerGroup;

		var data;
		if (content instanceof ArrayBuffer) {
			data = new Uint8Array(content);
		} else if (typeof content === 'string') {
			data = new Uint8Array(content.length);
			for (var i = 0; i < content.length; i++) {
				data[i] = content.charCodeAt(i);
			}
		} else {
			self.popm(null, `[${PN}]: ` + _('Unsupported content type.'));
			console.error('Unsupported content type:', typeof content);
			return;
		}

		self.hexEditorInstance.setData(data);

		var parts = filePath.split('/');
		var filename = parts[parts.length - 1];
		self.filenameDisplay.textContent = 'Editing: ' + filename;

		self.popm(null, `[${PN}]: ` + _('Opened file "' + filename + '".'));
	},

	/**
	 * Saves the current data in the hex editor using the Navigation plugin.
	 */
	saveFile: function() {
		var self = this;

		if (!self.currentFilePath) {
			self.popm(
				['$Hex Editor'], 'Hex Editor: No file loaded to save.', 'error'
			);
			return;
		}

		var data = self.hexEditorInstance.getData();
		var content = data.buffer; // Get ArrayBuffer

		// Attempt to save the file using the Navigation plugin's write_file function
		// Assuming write_file returns a Promise
		self.write_file(self.currentFilePath, self.permissions, self.ownerGroup, content, 'Bin')
			.then(function() {
				self.popm(
					['$Hex Editor'], 'Hex Editor: File saved successfully.', 'success'
				);
			})
			.catch(function(err) {
				self.popm(
					['$Hex Editor'], 'Hex Editor: Error saving file.', 'error'
				);
				console.error('Error saving file:', err);
			});
	},

	/**
	 * Retrieves the current settings of the plugin.
	 * @returns {Object} - Current settings including window size.
	 */
	get_settings: function() {
		return {
			width: this.editorDiv.style.width,
			height: this.editorDiv.style.height
		};
	},

	/**
	 * Applies settings to the plugin.
	 * @param {Object} settings - Settings object containing window size.
	 */
	set_settings: function(settings) {
		if (settings.width) {
			this.editorDiv.style.width = settings.width;
		}
		if (settings.height) {
			this.editorDiv.style.height = settings.height;
		}
	}
});
