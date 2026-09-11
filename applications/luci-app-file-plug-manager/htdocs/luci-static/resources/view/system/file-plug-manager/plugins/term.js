'use strict';
'require ui';
'require dom';
'require fs';

/**
 * Dumb Terminal Plugin
 * Emulates a simple terminal for interacting with OpenWRT.
 * Supports sending commands and displaying output.
 * Utilizes fs.exec() from LuCI's fs.js for command execution.
 * 
 * Enhancements:
 * - Adds resizable window with scrollbars.
 * - Introduces settings for configuring window size.
 */

const PN = 'Dumb Term.';

return Class.extend({
	/**
	 * Returns metadata about the plugin.
	 * @returns {Object} Plugin information.
	 */
	info: function() {
		return {
			name: PN,
			type: 'Utility',
			description: 'Emulates a simple terminal for OpenWRT, allowing sending commands and receiving output.'
		};
	},

	/**
	 * Generates CSS styles for the Dumb Terminal plugin with a unique suffix.
	 * @param {string} uniqueId - The unique identifier for this plugin instance.
	 * @returns {string} - The CSS styles as a string.
	 */
	generateCss: function(uniqueId) {
		return `
            /* CSS for Dumb Terminal Plugin - Instance ${uniqueId} */
            .dumb-terminal-plugin-${uniqueId} {
                padding: 10px;
                background-color: #1e1e1e;
                border: 1px solid #555;
                resize: both; /* Allows the window to be resizable */
                overflow: hidden; /* Hide scrollbars at the plugin level */
                box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
                font-family: 'Courier New', Courier, 'Lucida Console', 'Liberation Mono', monospace;
                color: #ffffff;
                position: relative;
                display: flex;
                flex-direction: column;
                width: ${this.width || '400px'};
                height: ${this.height || '300px'};
            }

            .dumb-terminal-plugin-${uniqueId} .terminal-output {
                flex-grow: 1;
                background-color: #000000;
                padding: 10px;
                overflow-y: auto; /* Enables vertical scrollbar */
                overflow-x: auto; /* Enables horizontal scrollbar */
                border: 1px solid #333;
                margin-bottom: 10px;
                white-space: pre-wrap;
                font-size: 14px;
                font-family: inherit; /* Inherits the monospace font from the parent */
            }

            .dumb-terminal-plugin-${uniqueId} .terminal-input {
                display: flex;
            }

            .dumb-terminal-plugin-${uniqueId} .terminal-input input {
                flex-grow: 1;
                padding: 8px;
                background-color: #2a2a2a;
                border: 1px solid #555;
                color: #ffffff;
                outline: none;
                font-size: 14px;
                font-family: inherit; /* Inherits the monospace font from the parent */
            }

            .dumb-terminal-plugin-${uniqueId} .terminal-input button {
                padding: 8px 16px;
                background-color: #0078d7;
                color: #fff;
                border: none;
                cursor: pointer;
                margin-left: 5px;
                border-radius: 4px;
                font-size: 14px;
                font-family: inherit; /* Inherits the monospace font from the parent */
            }

            .dumb-terminal-plugin-${uniqueId} .terminal-input button:hover {
                background-color: #005fa3;
            }

            /* Dark theme adjustments */
            .dark-theme .dumb-terminal-plugin-${uniqueId} {
                background-color: #2a2a2a;
                border-color: #777;
            }

            .dark-theme .dumb-terminal-plugin-${uniqueId} .terminal-output {
                background-color: #1e1e1e;
                border-color: #555;
            }

            .dark-theme .dumb-terminal-plugin-${uniqueId} .terminal-input input {
                background-color: #3a3a3a;
                border-color: #555;
                color: #fff;
            }

            .dark-theme .dumb-terminal-plugin-${uniqueId} .terminal-input button {
                background-color: #1e90ff;
            }

            .dark-theme .dumb-terminal-plugin-${uniqueId} .terminal-input button:hover {
                background-color: #1c7ed6;
            }
        `;
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

		// Initialize command history
		self.commandHistory = [];
		self.historyIndex = -1;

		// Ensure the plugin is only initialized once
		if (self.initialized) {
			return;
		}
		self.initialized = true;

		// Store references for later use
		self.pluginsRegistry = pluginsRegistry;
		self.default_plugins = default_plugins;
		self.uniqueId = uniqueId;

		// Set default window size
		self.width = '400px';
		self.height = '300px';

		// Create and inject the unique CSS for this plugin instance
		var styleTag = document.createElement('style');
		styleTag.type = 'text/css';
		styleTag.id = `dumb-terminal-plugin-style-${uniqueId}`;
		styleTag.innerHTML = self.generateCss(uniqueId);
		document.head.appendChild(styleTag);
		self.styleTag = styleTag; // Store reference for potential future removal

		// Create the main div for the terminal with a unique class
		self.terminalDiv = document.createElement('div');
		self.terminalDiv.className = `dumb-terminal-plugin-${uniqueId}`;
		self.terminalDiv.style.width = self.width;
		self.terminalDiv.style.height = self.height;

		// Create the terminal output area
		self.outputDiv = document.createElement('div');
		self.outputDiv.className = 'terminal-output';
		self.outputDiv.textContent = 'Terminal initialized.\n';

		// Create the input container
		self.inputContainer = document.createElement('div');
		self.inputContainer.className = 'terminal-input';

		// Create the input field for commands
		self.inputField = document.createElement('input');
		self.inputField.type = 'text';
		self.inputField.placeholder = 'Enter command...';
		self.inputField.addEventListener('keypress', function(event) {
			if (event.key === 'Enter') {
				self.executeCommand();
			}
		});
		self.inputField.addEventListener('keydown', function(event) {
			if (event.key === 'ArrowUp') {
				if (self.historyIndex > 0) {
					self.historyIndex--;
					self.inputField.value = self.commandHistory[self.historyIndex];
				}
				event.preventDefault();
			} else if (event.key === 'ArrowDown') {
				if (self.historyIndex < self.commandHistory.length - 1) {
					self.historyIndex++;
					self.inputField.value = self.commandHistory[self.historyIndex];
				} else {
					self.historyIndex = self.commandHistory.length;
					self.inputField.value = '';
				}
				event.preventDefault();
			}
		});

		// Create the execute button
		self.executeButton = document.createElement('button');
		self.executeButton.textContent = 'Run';
		self.executeButton.onclick = self.executeCommand.bind(this);

		// Create the clear button
		self.clearButton = document.createElement('button');
		self.clearButton.textContent = 'Clear';
		self.clearButton.onclick = function() {
			self.outputDiv.textContent = '';
		};

		// Append input fields and buttons to the input container
		self.inputContainer.appendChild(self.inputField);
		self.inputContainer.appendChild(self.executeButton);
		self.inputContainer.appendChild(self.clearButton);

		// Append output and input containers to the main terminal div
		self.terminalDiv.appendChild(self.outputDiv);
		self.terminalDiv.appendChild(self.inputContainer);

		// Append the terminal div to the provided container
		container.appendChild(self.terminalDiv);

		// Retrieve the Dispatcher plugin for notifications (if available)
		var dispatcherName = self.default_plugins['Dispatcher'];
		if (dispatcherName && self.pluginsRegistry[dispatcherName]) {
			var dispatcher = self.pluginsRegistry[dispatcherName];
			self.popm = dispatcher.pop.bind(dispatcher);
		}

		// No need to retrieve Navigation plugin since fs.exec() is used directly
	},

	/**
	 * Executes the command entered by the user using fs.exec().
	 */
	executeCommand: function() {
		var self = this;
		var commandInput = self.inputField.value.trim();
		if (commandInput === '') return;

		// Display the entered command in the output area
		self.outputDiv.textContent += `> ${commandInput}\n`;
		self.inputField.value = '';
		self.inputField.focus();

		// Add to command history
		self.commandHistory.push(commandInput);
		self.historyIndex = self.commandHistory.length;

		// Split the command into command and arguments
		var parts = self.parseCommand(commandInput);
		var cmd = parts.cmd;
		var args = parts.args;

		// Execute the command using fs.exec()
		// fs.exec(command, args, env) returns a Promise
		// 'env' can be null if no environment variables are needed
		fs.exec(cmd, args, null)
			.then(function(result) {
				// Assuming result has 'stdout' and 'stderr'
				if (result.stdout && result.stdout.trim() !== '') {
					self.outputDiv.textContent += `${result.stdout}\n`;
				}
				if (result.stderr && result.stderr.trim() !== '') {
					self.outputDiv.textContent += `Error: ${result.stderr}\n`;
				}
				if (self.popm) {
					self.popm(null, `[${PN}]: Command executed successfully.`);
				}
				self.outputDiv.scrollTop = self.outputDiv.scrollHeight;
			})
			.catch(function(error) {
				// Handle errors from the RPC call
				self.outputDiv.textContent += `Error: ${error.message}\n`;
				if (self.popm) {
					self.popm(null, `[${PN}]: Error executing command.`);
				}
				self.outputDiv.scrollTop = self.outputDiv.scrollHeight;
				console.error('Error executing command:', error);
			});

		// Optional: Log the command execution attempt
		console.log(`[${PN}]: Executed command - ${commandInput}`);
	},

	/**
	 * Parses the command string into command and arguments.
	 * @param {string} commandInput - The raw command string entered by the user.
	 * @returns {Object} An object containing the command and an array of arguments.
	 */
	parseCommand: function(commandInput) {
		// Simple parsing: split by spaces, handle quotes if necessary
		// For more robust parsing, consider using a proper command-line parser

		var regex = /[^\s"]+|"([^"]*)"/gi;
		var args = [];
		var match;
		while ((match = regex.exec(commandInput)) !== null) {
			args.push(match[1] ? match[1] : match[0]);
		}

		var cmd = args.shift(); // The first element is the command
		return {
			cmd: cmd,
			args: args
		};
	},

	/**
	 * Retrieves the current settings of the plugin.
	 * @returns {Object} - Current settings including window size.
	 */
	get_settings: function() {
		return {
			width: this.terminalDiv.style.width || '400px',
			height: this.terminalDiv.style.height || '300px'
		};
	},

	/**
	 * Applies settings to the plugin.
	 * @param {Object} settings - Settings object containing window size.
	 */
	set_settings: function(settings) {
		if (settings.width) {
			this.terminalDiv.style.width = settings.width;
		}
		if (settings.height) {
			this.terminalDiv.style.height = settings.height;
		}
	},

	/**
	 * Cleans up the plugin instance by removing injected styles and elements.
	 */
	destroy: function() {
		var self = this;
		if (self.styleTag) {
			self.styleTag.remove();
		}
		if (self.terminalDiv && self.terminalDiv.parentNode) {
			self.terminalDiv.parentNode.removeChild(self.terminalDiv);
		}
		self.initialized = false;
	}
});
