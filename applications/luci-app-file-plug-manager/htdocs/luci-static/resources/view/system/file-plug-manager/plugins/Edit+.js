'use strict';
'require ui';
'require dom';

/**
 * Text Editor Plugin with Search & Replace functionality
 * Provides a simple text editor with a resizable window, scrollbars, and save functionality.
 * Supports loading external text content for editing and displays the filename.
 * Includes configuration for window size.
 * 
 * Enhancements:
 * - Prevents line wrapping with a horizontal scrollbar.
 * - Displays line numbers alongside the textarea.
 * - Search and Replace interface
 * - A search pattern input field and "Find Next" and "Find Previous" buttons.
 * - A replace pattern input field and "Replace This" and "Replace All" buttons.
 * - A toggle switch to select between Normal and RegExp search modes.
 * - Global search highlights all occurrences of the pattern in the text.
 * - The matched text is highlighted in orange.
 * - Info field shows total matches found and the index of the currently selected match.
 * - "Find Next" scrolls to the next pattern occurrence.
 * - "Find Previous" scrolls to the previous pattern occurrence.
 * - "Replace This" replaces the current match and moves to the next one.
 * - "Replace All" replaces all occurrences and scrolls to the end.
 */

// Define the plugin name as a constant
const PN = 'Text Editor+';

return Class.extend({
	/**
	 * Returns metadata about the plugin.
	 * @returns {Object} Plugin information.
	 */
	info: function() {
		return {
			name: PN,
			type: 'Editor',
			style: 'Text',
			description: 'A text editor plugin with search & replace, resizable window, scrollbars, save functionality, and search mode toggle (Normal/RegExp).'
		};
	},

	/**
	 * Generates CSS styles for the Text Editor plugin with a unique suffix.
	 * @param {string} uniqueId - The unique identifier for this plugin instance.
	 * @returns {string} - The CSS styles as a string.
	 */
	generateCss: function(uniqueId) {
		return `
            /* CSS for the Text Editor Plugin - Instance ${uniqueId} */
            .text-editor-plugin-${uniqueId} {
                padding: 10px;
                background-color: #ffffff;
                border: 1px solid #ccc;
                resize: both;
                overflow: hidden;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
                font-family: Arial, sans-serif;
                font-size: 14px;
                position: relative;
                display: flex;
                flex-direction: column;
                height: 100%;
            }

            .text-editor-plugin-${uniqueId} .filename-display {
                margin-bottom: 10px;
                font-weight: bold;
                color: #333;
                font-size: 16px;
            }

            .text-editor-plugin-${uniqueId} .editor-container {
                display: flex;
                flex: 1;
                overflow: auto; /* Allow only one scrollbar */
                align-items: flex-start;
                position: relative;
            }

            .text-editor-plugin-${uniqueId} .line-numbers {
                width: 50px;
                background-color: #f0f0f0;
                color: #888;
                text-align: right;
                user-select: none;
                border-right: 1px solid #ccc;
                box-sizing: border-box;
                font-family: monospace;
                font-size: 14px;
                line-height: 1.5;
                white-space: pre;
                padding: 5px 0;
                position: sticky;
                top: 0;
                left: 0;
            }

            .text-editor-plugin-${uniqueId} .editable-content {
                flex: 1;
                font-family: monospace;
                font-size: 14px;
                line-height: 1.5;
                padding: 5px 10px;
                margin: 0;
                border: none;
                outline: none;
                white-space: pre;
                background-color: #ffffff;
                color: #000000;
            }

            .text-editor-plugin-${uniqueId} .highlight {
                background: none;
                color: orange;
                font-weight: bold;
            }

            .text-editor-plugin-${uniqueId} .highlight.current-highlight {
                background: orange;
                color: #ffffff; /* For better contrast */
            }

            .text-editor-plugin-${uniqueId} .controls-container {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 10px;
                flex-wrap: wrap;
                gap: 10px;
            }

            .text-editor-plugin-${uniqueId} .search-container {
                display: flex;
                flex-direction: row;
                gap: 5px;
                flex-wrap: wrap;
                align-items: center;
            }

            .text-editor-plugin-${uniqueId} .search-info {
                margin-top: 5px;
                font-size: 14px;
                color: #333;
            }

            .text-editor-plugin-${uniqueId} .button {
                padding: 8px 16px;
                background-color: #0078d7;
                color: #fff;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }

            .text-editor-plugin-${uniqueId} .button:hover {
                background-color: #005fa3;
            }

            .text-editor-plugin-${uniqueId} .toggle-container {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .text-editor-plugin-${uniqueId} .switch {
                position: relative;
                display: inline-block;
                width: 50px;
                height: 24px;
            }

            .text-editor-plugin-${uniqueId} .switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .text-editor-plugin-${uniqueId} .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: 0.4s;
                border-radius: 24px;
            }

            .text-editor-plugin-${uniqueId} .slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: 0.4s;
                border-radius: 50%;
            }

            .text-editor-plugin-${uniqueId} .switch input:checked + .slider {
                background-color: #2196F3;
            }

            .text-editor-plugin-${uniqueId} .switch input:checked + .slider:before {
                transform: translateX(26px);
            }

            .dark-theme .text-editor-plugin-${uniqueId} {
                background-color: #2a2a2a;
                border-color: #555;
                color: #ddd;
            }

            .dark-theme .text-editor-plugin-${uniqueId} .filename-display {
                color: #fff;
            }

            .dark-theme .text-editor-plugin-${uniqueId} .line-numbers {
                background-color: #3a3a3a;
                color: #ccc;
                border-right: 1px solid #555;
            }

            .dark-theme .text-editor-plugin-${uniqueId} .editable-content {
                background-color: #1e1e1e;
                color: #f1f1f1;
                border: 1px solid #555;
            }

            .dark-theme .text-editor-plugin-${uniqueId} .button {
                background-color: #1e90ff;
            }

            .dark-theme .text-editor-plugin-${uniqueId} .button:hover {
                background-color: #1c7ed6;
            }

            .dark-theme .text-editor-plugin-${uniqueId} .slider {
                background-color: #555;
            }

            .dark-theme .text-editor-plugin-${uniqueId} .switch input:checked + .slider {
                background-color: #1e90ff;
            }
        `;
	},

	/**
	 * Escapes special characters in a string to be used in a regular expression.
	 * @param {string} string - The string to escape.
	 * @returns {string} - The escaped string.
	 */
	escapeRegExp: function(string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	},

	/**
	 * Initializes the plugin within the given container.
	 * @param {HTMLElement} container - The container element where the plugin will be rendered.
	 * @param {Object} pluginsRegistry - The registry of all loaded plugins.
	 * @param {Object} default_plugins - The default plugins for each type.
	 * @param {string} uniqueId - A unique identifier for this plugin instance.
	 */
	start: function(container, pluginsRegistry, default_plugins, uniqueId) {
		var self = this;

		// Ensure initialization runs only once
		if (self.initialized) {
			return;
		}
		self.initialized = true;

		self.pluginsRegistry = pluginsRegistry;
		self.default_plugins = default_plugins;
		self.uniqueId = uniqueId;

		// Insert unique CSS
		var styleTag = document.createElement('style');
		styleTag.type = 'text/css';
		styleTag.id = `text-editor-plugin-style-${uniqueId}`;
		styleTag.innerHTML = self.generateCss(uniqueId);
		document.head.appendChild(styleTag);
		self.styleTag = styleTag;

		// Main container
		self.editorDiv = document.createElement('div');
		self.editorDiv.className = `text-editor-plugin-${uniqueId}`;

		// Initial size
		self.width = self.settings && self.settings.width ? self.settings.width : '600px';
		self.height = self.settings && self.settings.height ? self.settings.height : '400px';
		self.editorDiv.style.width = self.width;
		self.editorDiv.style.height = self.height;

		// Filename display
		self.filenameDisplay = document.createElement('div');
		self.filenameDisplay.className = 'filename-display';
		self.filenameDisplay.textContent = 'No file loaded.';

		// Editor container
		self.editorContainer = document.createElement('div');
		self.editorContainer.className = 'editor-container';

		// Line numbers
		self.lineNumbers = document.createElement('div');
		self.lineNumbers.className = 'line-numbers';
		self.lineNumbers.textContent = '1';

		// Editable content area
		self.editableContent = document.createElement('div');
		self.editableContent.className = 'editable-content';
		self.editableContent.contentEditable = 'true';

		// Append to editor container
		self.editorContainer.appendChild(self.lineNumbers);
		self.editorContainer.appendChild(self.editableContent);

		// Controls container (Save button and Search controls)
		self.controlsContainer = document.createElement('div');
		self.controlsContainer.className = 'controls-container';

		// Save button
		self.saveButton = document.createElement('button');
		self.saveButton.className = 'button';
		self.saveButton.textContent = 'Save';
		self.saveButton.onclick = self.saveFile.bind(this);

		// Search & Replace UI
		self.searchContainer = document.createElement('div');
		self.searchContainer.className = 'search-container';

		// Search input
		self.searchInput = document.createElement('input');
		self.searchInput.type = 'text';
		self.searchInput.placeholder = 'Search pattern...';

		// Find Next button
		self.findNextButton = document.createElement('button');
		self.findNextButton.className = 'button';
		self.findNextButton.textContent = 'Find Next';
		self.findNextButton.onclick = self.findNext.bind(self);

		// Find Previous button
		self.findPrevButton = document.createElement('button');
		self.findPrevButton.className = 'button';
		self.findPrevButton.textContent = 'Find Previous';
		self.findPrevButton.onclick = self.findPrevious.bind(self);

		// Replace input
		self.replaceInput = document.createElement('input');
		self.replaceInput.type = 'text';
		self.replaceInput.placeholder = 'Replace with...';

		// Replace This button
		self.replaceThisButton = document.createElement('button');
		self.replaceThisButton.className = 'button';
		self.replaceThisButton.textContent = 'Replace This';
		self.replaceThisButton.onclick = self.replaceThis.bind(self);

		// Replace All button
		self.replaceAllButton = document.createElement('button');
		self.replaceAllButton.className = 'button';
		self.replaceAllButton.textContent = 'Replace All';
		self.replaceAllButton.onclick = self.replaceAll.bind(self);

		// Toggle Search Type (Normal / RegExp)
		self.toggleContainer = document.createElement('div');
		self.toggleContainer.className = 'toggle-container';

		// Toggle Switch
		self.switchLabel = document.createElement('label');
		self.switchLabel.className = 'switch';

		self.switchInput = document.createElement('input');
		self.switchInput.type = 'checkbox';
		self.switchInput.id = `search-toggle-${uniqueId}`;
		self.switchInput.onclick = self.toggleSearchType.bind(self);

		self.switchSlider = document.createElement('span');
		self.switchSlider.className = 'slider';

		self.switchLabel.appendChild(self.switchInput);
		self.switchLabel.appendChild(self.switchSlider);

		// Toggle Label Text
		self.toggleLabelText = document.createElement('span');
		self.toggleLabelText.textContent = 'RegExp';

		self.toggleContainer.appendChild(self.switchLabel);
		self.toggleContainer.appendChild(self.toggleLabelText);

		// Append search and replace elements
		self.searchContainer.appendChild(self.searchInput);
		self.searchContainer.appendChild(self.findNextButton);
		self.searchContainer.appendChild(self.findPrevButton);
		self.searchContainer.appendChild(self.replaceInput);
		self.searchContainer.appendChild(self.replaceThisButton);
		self.searchContainer.appendChild(self.replaceAllButton);
		self.searchContainer.appendChild(self.toggleContainer);

		// Append Save button and Search controls to controls container
		self.controlsContainer.appendChild(self.searchContainer);
		self.controlsContainer.appendChild(self.saveButton);

		// Info field for matches
		self.infoField = document.createElement('div');
		self.infoField.className = 'search-info';

		// Append elements to main editor div
		self.editorDiv.appendChild(self.filenameDisplay);
		self.editorDiv.appendChild(self.editorContainer);
		self.editorDiv.appendChild(self.controlsContainer);
		self.editorDiv.appendChild(self.infoField);

		container.appendChild(self.editorDiv);

		// Default dispatcher
		var defaultDispatcherName = self.default_plugins['Dispatcher'];
		if (defaultDispatcherName && self.pluginsRegistry[defaultDispatcherName]) {
			var defaultDispatcher = self.pluginsRegistry[defaultDispatcherName];
			self.popm = defaultDispatcher.pop.bind(defaultDispatcher);
		}

		// Navigation plugin for file operations
		var navigationPluginName = self.default_plugins['Navigation'];
		if (!navigationPluginName) {
			self.popm(null, `[${PN}]: No default Navigation plugin set.`);
			console.error('No default Navigation plugin set.');
			return;
		}

		var navigationPlugin = self.pluginsRegistry[navigationPluginName];
		if (!navigationPlugin || typeof navigationPlugin.write_file !== 'function') {
			self.popm(null, `[${PN}]: Navigation plugin does not support writing files.`);
			console.error('Navigation plugin is unavailable or missing write_file function.');
			return;
		}

		// Bind write_file
		self.write_file = navigationPlugin.write_file.bind(navigationPlugin);

		// Set initial variables
		self.textData = '';
		self.matches = [];
		self.currentMatchIndex = -1;
		self.lastSearchPattern = '';
		self.lastIsRegExp = false;
		self.isRegExp = false;

		// Sync scroll for line numbers
		self.editableContent.addEventListener('scroll', function() {
			const scrollTop = self.editableContent.scrollTop;
			self.lineNumbers.style.transform = `translateY(-${scrollTop}px)`;
		});

		self.updating = false;

		// Recalculate line numbers on input
		self.editableContent.addEventListener('input', function() {
			self.textData = self.getRawText();
			self.updateLineNumbers();
		});
	},

	/**
	 * Opens a file in the editor.
	 * @param {string} filePath - The path to the file to edit.
	 * @param {string} content - The content of the file.
	 * @param {string} style - The style of the content ('text' or 'bin').
	 */
	edit: function(filePath, content, style, permissions, ownerGroup) {
		var self = this;

		if (style.toLowerCase() !== 'text') {
			self.popm(null, `[${PN}]: Unsupported style "${style}". Only "Text" is supported.`);
			console.warn('Unsupported style:', style);
			self.filenameDisplay.textContent = 'Unsupported file style.';
			self.textData = '';
			self.render();
			return;
		}

		self.currentFilePath = filePath;
		self.permissions = permissions;
		self.ownerGroup = ownerGroup;

		self.textData = content;
		var parts = filePath.split('/');
		var filename = parts[parts.length - 1];
		self.filenameDisplay.textContent = `Editing: ${filename}`;

		self.updateLineNumbers();

		// Reset search-related variables
		self.lastSearchPattern = '';
		self.matches = [];
		self.currentMatchIndex = -1;
		self.lastIsRegExp = false;
		self.isRegExp = false;

		// Reset the toggle switch to Normal search
		self.switchInput.checked = false;
		self.toggleLabelText.textContent = 'RegExp';

		self.render();
		self.popm(null, `[${PN}]: Opened file "${filename}".`);
	},

	/**
	 * Save the file using the Navigation plugin.
	 */
	saveFile: function(ev) {
		var self = this;

		if (!self.currentFilePath) {
			self.popm(null, `[${PN}]: No file loaded to save.`);
			return;
		}

		var content = self.getRawText();

		self.write_file(self.currentFilePath, self.permissions, self.ownerGroup, content, 'text')
			.then(function() {
				self.popm(null, `[${PN}]: File saved successfully.`);
			})
			.catch(function(err) {
				self.popm(null, `[${PN}]: Error saving file.`);
				console.error('Error saving file:', err);
			});
	},

	/**
	 * Get current settings.
	 */
	get_settings: function() {
		return {
			width: this.editorDiv.style.width,
			height: this.editorDiv.style.height
		};
	},

	/**
	 * Set plugin settings.
	 */
	set_settings: function(settings) {
		if (settings.width) {
			this.editorDiv.style.width = settings.width;
		}
		if (settings.height) {
			this.editorDiv.style.height = settings.height;
		}
	},

	/**
	 * Destroy the plugin instance.
	 */
	destroy: function() {
		var self = this;
		if (self.styleTag) {
			self.styleTag.remove();
		}
		if (self.editorDiv && self.editorDiv.parentNode) {
			self.editorDiv.parentNode.removeChild(self.editorDiv);
		}
		self.initialized = false;
	},

	/**
	 * Update line numbers according to the current text.
	 */
	updateLineNumbers: function() {
		var self = this;
		var linesCount = self.textData.split('\n').length;
		var lineNumbersContent = '';
		for (let i = 1; i <= linesCount; i++) {
			lineNumbersContent += i + '\n';
		}
		self.lineNumbers.textContent = lineNumbersContent;
	},

	/**
	 * Get the raw text without any highlighting from editable content.
	 */
	getRawText: function() {
		return this.editableContent.textContent;
	},

	/**
	 * Render the content with highlights.
	 */
	render: function() {
		var self = this;
		self.updating = true; // Begin of inner update

		if (!self.matches || self.matches.length === 0) {
			self.editableContent.innerHTML = self.escapeHtml(self.textData);
		} else {
			var htmlParts = [];
			var lastIndex = 0;
			for (var i = 0; i < self.matches.length; i++) {
				var m = self.matches[i];
				htmlParts.push(self.escapeHtml(self.textData.substring(lastIndex, m.start)));
				if (i === self.currentMatchIndex) {
					htmlParts.push('<span class="highlight current-highlight">');
				} else {
					htmlParts.push('<span class="highlight">');
				}
				htmlParts.push(self.escapeHtml(self.textData.substring(m.start, m.end)));
				htmlParts.push('</span>');
				lastIndex = m.end;
			}
			htmlParts.push(self.escapeHtml(self.textData.substring(lastIndex)));
			self.editableContent.innerHTML = htmlParts.join('');
		}
		self.updating = false; // End of inner update
		self.updateLineNumbers();
		self.updateInfoField();
		self.scrollToCurrentMatch();
	},

	/**
	 * Escape HTML to prevent issues.
	 */
	escapeHtml: function(str) {
		return str.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	},

	/**
	 * Toggle between Normal and RegExp search modes.
	 */
	toggleSearchType: function() {
		var self = this;
		self.isRegExp = self.switchInput.checked;
		self.toggleLabelText.textContent = self.isRegExp ? 'RegExp' : 'Normal';

		self.lastIsRegExp = self.isRegExp;
		// Re-run search to reflect the new mode
		self.performSearch();
		self.render();
	},

	/**
	 * Perform a global search on the textData and store matches.
	 */
	performSearch: function() {
		var self = this;
		var pattern = self.searchInput.value;

		if (!pattern) {
			self.matches = [];
			self.currentMatchIndex = -1;
			self.render();
			return;
		}

		var re;
		if (self.isRegExp) {
			try {
				re = new RegExp(pattern, 'g');
			} catch (e) {
				self.updateInfoField("Invalid RegExp pattern.");
				return;
			}
		} else {
			var escapedPattern = self.escapeRegExp(pattern);
			re = new RegExp(escapedPattern, 'g');
		}

		self.matches = [];
		var match;
		while ((match = re.exec(self.textData)) !== null) {
			self.matches.push({
				start: match.index,
				end: match.index + match[0].length
			});
			if (match.index === re.lastIndex) {
				re.lastIndex++;
			}
		}

		// Корректировка currentMatchIndex
		if (self.matches.length > 0) {
			if (self.currentMatchIndex >= self.matches.length) {
				self.currentMatchIndex = self.matches.length - 1;
			} else if (self.currentMatchIndex === -1) {
				self.currentMatchIndex = 0;
			}
		} else {
			self.currentMatchIndex = -1;
		}

		self.render();
	},

	/**
	 * Move to the next match and re-render.
	 */
	findNext: function() {
		var self = this;

		// Выполняем поиск, чтобы обновить matches
		self.performSearch();

		if (self.matches.length === 0) {
			self.updateInfoField("No matches found.");
			return;
		}

		if (self.currentMatchIndex === -1) {
			self.currentMatchIndex = 0;
		} else if (self.currentMatchIndex < self.matches.length - 1) {
			self.currentMatchIndex++;
		} else {
			self.currentMatchIndex = 0;
		}

		self.render();
	},

	/**
	 * Move to the previous match and re-render.
	 */
	findPrevious: function() {
		var self = this;

		// Выполняем поиск, чтобы обновить matches
		self.performSearch();

		if (self.matches.length === 0) {
			self.updateInfoField("No matches found.");
			return;
		}

		if (self.currentMatchIndex === -1) {
			self.currentMatchIndex = self.matches.length - 1;
		} else if (self.currentMatchIndex > 0) {
			self.currentMatchIndex--;
		} else {
			self.currentMatchIndex = self.matches.length - 1;
		}

		self.render();
	},

	/**
	 * Replace the current match with the specified replacement text.
	 * Then move to the next match.
	 */
	replaceThis: function() {
		var self = this;

		if (self.matches.length === 0 || self.currentMatchIndex === -1) {
			self.updateInfoField("No matches available to replace.");
			return;
		}

		var replacement = self.replaceInput.value || '';
		var currentMatch = self.matches[self.currentMatchIndex];

		// Выполняем замену в textData
		self.textData = self.textData.substring(0, currentMatch.start) + replacement + self.textData.substring(currentMatch.end);

		// Выполняем поиск, чтобы обновить matches
		self.performSearch();

		// Если после замены текущий индекс выходит за пределы, устанавливаем его на последний индекс
		if (self.currentMatchIndex >= self.matches.length) {
			self.currentMatchIndex = self.matches.length - 1;
		}

		self.render();
	},

	/**
	 * Replace all occurrences of the search pattern with the replacement text.
	 */
	replaceAll: function() {
		var self = this;
		var pattern = self.searchInput.value;
		if (!pattern) return;
		var replacement = self.replaceInput.value || '';

		var re;
		if (self.isRegExp) {
			try {
				re = new RegExp(pattern, 'g');
			} catch (e) {
				self.updateInfoField("Invalid RegExp pattern.");
				return;
			}
		} else {
			var escapedPattern = self.escapeRegExp(pattern);
			re = new RegExp(escapedPattern, 'g');
		}

		try {
			self.textData = self.textData.replace(re, replacement);
		} catch (e) {
			self.updateInfoField("Error during replacement.");
			console.error('Error during replacement:', e);
			return;
		}

		// After replace all, re-search and scroll to the end
		self.performSearch();
		self.editableContent.scrollTop = self.editableContent.scrollHeight;
	},

	/**
	 * Update the info field showing the total matches and current match index.
	 */
	updateInfoField: function(optionalMessage) {
		var self = this;
		if (optionalMessage) {
			self.infoField.textContent = optionalMessage;
			return;
		}

		if (!self.matches || self.matches.length === 0) {
			self.infoField.textContent = 'No matches found.';
		} else {
			self.infoField.textContent = `Matches: ${self.matches.length}, Current: ${self.currentMatchIndex + 1}`;
		}
	},

	/**
	 * Scroll to the current match in the editableContent.
	 */
	scrollToCurrentMatch: function() {
		var self = this;
		if (self.currentMatchIndex === -1 || self.matches.length === 0) return;

		var highlights = self.editableContent.querySelectorAll('.highlight');
		if (highlights.length === 0) return;
		var target = highlights[self.currentMatchIndex];
		if (!target) return;

		target.scrollIntoView({
			block: 'center',
			behavior: 'smooth'
		});
		self.selectText(target);
	},

	/**
	 * Select the text within the target element.
	 * @param {HTMLElement} element - The element containing the text to select.
	 */
	selectText: function(element) {
		var range = document.createRange();
		var sel = window.getSelection();
		range.selectNodeContents(element);
		sel.removeAllRanges();
		sel.addRange(range);
	},
});