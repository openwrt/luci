/***************************************
 * Main Dispatcher Plugin (main.js)
 * This is the main (Dispatcher) plugin that:
 * - Loads and manages other plugins
 * - Sets default plugins and mark the default plugin tabs with а green button 
 * - Initializes plugins in the correct order
 * - Integrates with the default Settings plugin
 * - sends personalised events to plugins
 * - provides pop() for messaging
 * - All comments and messages are in English
 ***************************************/
'use strict';
'require view';
'require ui';
'require fs';
'require dom';
'require form';

const PN = 'Main';


return view.extend({
	// Unique identifier counter for plugins
	pluginUniqueIdCounter: 1,

	// Default plugins storage
	default_plugins: {
		'Editor': null,
		'Navigation': null,
		'Settings': null,
		'Help': null,
		'Utility': null
	},

	// Registry of loaded plugins
	pluginsRegistry: {},

	// Supported plugin types
	supportedPluginTypes: ['Editor', 'Navigation', 'Settings', 'Help', 'Utility'],
	defaultTabsOrder: ['Navigation', 'Editor', 'Settings', 'Utility', 'Help'],
	defaultStartPlugin: 'Navigation',

	// References to UI containers
	buttonsContainer: null,
	contentsContainer: null,
	logsContainer: null, // Added for logs container
	infoContainer: null, // Added for informational messages

	screen_log: false, // Initialization of screen_log variable
	box_log: false, // Initialization of box_log variable

	/**
	 * pop(title, children, type)
	 * Display notifications to the user.
	 */
	pop: function(title, children, type) {
		// Get current time
		var timestamp = new Date().toLocaleString();

		// Create message with timestamp
		var message = E('div', {
			'class': 'log-entry'
		}, [
			E('span', {
				'class': 'log-timestamp'
			}, `[${timestamp}] `),
			typeof children === 'string' ? children : children.outerHTML
		]);

		// Add message to Logs
		if (this.logsContainer) {
			this.logsContainer.appendChild(message);
			// Scroll to the bottom to show the latest message
			this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
		} else {
			console.error(`[${PN}]: Logs container not found. Unable to display log message.`);
		}

		// If screen_log is enabled, duplicate the message via ui.addNotification
		if (String(this.screen_log) === 'true') {
			ui.addNotification(title, children, type);
		}
		// If box_log is true, display the message in the informational box
		if (String(this.box_log) === 'true') {
			this.displayInfoMessage(title, children, type);
		}

	},

	/**
	 * info()
	 * Return metadata about this plugin.
	 */
	info: function() {
		return {
			name: PN, // Unique name
			type: 'Dispatcher', // Plugin type
			description: 'Main dispatcher module'
		};
	},

	/**
	 * start(container, pluginsRegistry, default_plugins)
	 * Initialize the dispatcher if needed.
	 */
	start: function(container, pluginsRegistry, default_plugins) {
		// Initialize screen_log and box_log from settings or default to false
		const settings = this.get_settings();
		this.screen_log = settings.screen_log || false;
		this.box_log = settings.box_log || false;
	},

	/**
	 * get_settings()
	 * Return current settings for the dispatcher.
	 */
	get_settings: function() {
		return {
			screen_log: this.screen_log || false, // Default value: false
			box_log: this.box_log || false // Default value: false
		};
	},

	/**
	 * set_settings(settings)
	 * Apply settings to the dispatcher.
	 */
	set_settings: function(settings) {
		if (typeof settings.screen_log !== 'undefined') {
			this.screen_log = settings.screen_log;
		}
		if (typeof settings.box_log !== 'undefined') {
			this.box_log = settings.box_log;
		}
	},

	/**
	 * render()
	 * Render the main view, load plugins, and set up the UI.
	 * Changed this function to async to await s.render().
	 */
	render: async function() {
		var m, s, o;
		// Create the JSONMap for form
		m = new form.JSONMap({}, _('File Plug Manager'));

		// Create informational container
		this.infoContainer = E('div', {
			'class': 'info-container'
		});

		// Create tabs container
		var tabs = E('div', {
			'class': 'cbi-tabs'
		});

		// Create containers for tab buttons and contents
		this.buttonsContainer = E('div', {
			'class': 'cbi-tabs-buttons'
		});
		this.contentsContainer = E('div', {
			'class': 'cbi-tabs-contents'
		});

		tabs.appendChild(this.buttonsContainer);
		tabs.appendChild(this.contentsContainer);

		// Create Logs tab first to ensure logsContainer is available
		this.createLogsTab();

		// Load plugins
		this.loadPlugins(this.buttonsContainer, this.contentsContainer);

		// Determine current theme
		var isDarkTheme = document.body.classList.contains('dark-theme');
		if (isDarkTheme) {
			tabs.classList.add('dark-theme');
		} else {
			tabs.classList.add('light-theme');
		}

		// Custom CSS for styling
		var customCSS = `
            /* Tabs container */
            .cbi-tabs {
                margin-top: 20px;
            }

            /* Tab buttons container */
            .cbi-tabs-buttons {
                display: flex;
                border: 2px solid #0078d7;
                border-radius: 5px;
                background-color: #f9f9f9;
                padding: 5px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .dark-theme .cbi-tabs-buttons {
                border: 2px solid #555;
                background-color: #333;
                box-shadow: 0 2px 4px rgba(255, 255, 255, 0.1);
            }

            .cbi-tab-button {
                padding: 10px 20px;
                cursor: pointer;
                border: none;
                background: none;
                outline: none;
                transition: background-color 0.3s, border-bottom 0.3s;
                font-size: 16px;
                margin-right: 5px;
                position: relative;
                user-select: none;
                color: #000;
            }

            .dark-theme .cbi-tab-button {
                color: #fff;
            }

            .cbi-tab-button:hover {
                background-color: #e0e0e0;
            }

            .dark-theme .cbi-tab-button:hover {
                background-color: #444;
            }

            .cbi-tab-button.active {
                border-bottom: 3px solid #0078d7;
                font-weight: bold;
                background-color: #fff;
                color: #000;
            }

            .dark-theme .cbi-tab-button.active {
                border-bottom: 3px solid #1e90ff;
                background-color: #555;
                color: #fff;
            }

            .cbi-tabs-contents {
                padding: 10px;
                background-color: #fff;
                color: #000;
            }

            .dark-theme .cbi-tabs-contents {
                background-color: #2a2a2a;
                color: #ddd;
            }

            .cbi-tab-content {
                display: none;
            }

            .cbi-tab-content.active {
                display: block;
            }

            .default-marker {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-left: 10px;
                cursor: pointer;
                background-color: gray;
            }

            .default-marker.active {
                background-color: green;
            }

            .default-marker.inactive {
                background-color: gray;
            }

            .dark-theme .navigation-plugin-table-container {
                background-color: #222;
                color: #fff;
            }

            .dark-theme .navigation-plugin-table th {
                background-color: #333;
                color: #fff;
            }

            .dark-theme .navigation-plugin-table td {
                background-color: #222;
                color: #fff;
            }

            .dark-theme .navigation-plugin-table tr:hover {
                background-color: #444;
            }

            .dark-theme .navigation-plugin-table td.name a {
                color: #1e90ff;
                text-decoration: none;
            }

            /* Logs Tab */
            .cbi-tab-button.logs-tab {
                font-weight: bold;
            }

            .logs-container {
                max-height: 400px;
                overflow-y: auto;
                background-color: #f1f1f1;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
            }

            .dark-theme .logs-container {
                background-color: #1e1e1e;
                color: #dcdcdc;
                border-color: #555;
            }

            .log-entry {
                margin-bottom: 5px;
            }

            .log-timestamp {
                color: #888;
                margin-right: 10px;
            }

        /* Informational Container */
        .info-container {
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid #0078d7;
            border-radius: 5px;
            background-color: #e7f3fe;
            color: #31708f;
            display: none; /* Hidden by default */
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
        }

        .dark-theme .info-container {
            background-color: #333;
            border-color: #1e90ff;
            color: #fff;
        }

        /* Blinking Animation */
        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0; }
            100% { opacity: 1; }
        }

        .blink {
            animation: blink 1s step-start 5;
        }

        `;

		var style = document.createElement('style');
		style.type = 'text/css';
		style.innerHTML = customCSS;
		document.head.appendChild(style);
		// Return the combined DOM
		return E([], [
			m.title ? E('h3', {}, m.title) : null,
			this.infoContainer, // Add infoContainer above tabs
			tabs
		]);
	},

	/**
	 * createLogsTab()
	 * Create the Logs tab in the UI.
	 */
	createLogsTab: function() {
		var self = this;

		// Create Logs tab button with a green marker
		var logButton = E('button', {
			'class': 'cbi-tab-button logs-tab'
		}, 'Logs');
		var marker = E('span', {
			'class': 'default-marker active',
			'title': _('Logs are always active')
		});
		logButton.appendChild(marker);

		// Create Logs container
		this.logsContainer = E('div', {
			'class': 'logs-container cbi-tab-content',
			'id': 'tab-Logs'
		});

		// Append button and container to respective parents
		this.buttonsContainer.appendChild(logButton);
		this.contentsContainer.appendChild(this.logsContainer);

		// Click handler for Logs tab
		logButton.onclick = function() {
			var allButtons = self.buttonsContainer.querySelectorAll('.cbi-tab-button');
			allButtons.forEach(function(btn) {
				btn.classList.remove('active');
			});

			var allContents = self.contentsContainer.querySelectorAll('.cbi-tab-content');
			allContents.forEach(function(content) {
				content.classList.remove('active');
			});

			logButton.classList.add('active');
			self.logsContainer.classList.add('active');
		};
	},

	/**
	 * displayInfoMessage(title, message, type)
	 * Display a message in the informational box with a blinking effect.
	 * @param {string} title - The title of the message.
	 * @param {string|HTMLElement} message - The message content.
	 * @param {string} type - The type of message (e.g., 'success', 'error').
	 */
	displayInfoMessage: function(title, message, type) {
		// Clear any existing messages
		this.infoContainer.innerHTML = '';

		// Create message element
		var msg = E('div', {
			'class': 'info-message'
		}, [
			title ? E('strong', {}, title + ': ') : ' ',
			typeof message === 'string' ? message : message.outerHTML
		]);

		// Append message to infoContainer
		this.infoContainer.appendChild(msg);

		// Show the infoContainer
		this.infoContainer.style.display = 'block';
		// Trigger reflow to restart CSS animation
		void this.infoContainer.offsetWidth;
		// Add the blink class
		msg.classList.add('blink');

		// Show with opacity
		this.infoContainer.style.opacity = '1';

		// After 5 seconds, remove the blink class and hide the message
		setTimeout(() => {
			msg.classList.remove('blink');
			// Fade out the infoContainer

			/***
			        this.infoContainer.style.opacity = '0';
			        // After transition, hide the container
			        setTimeout(() => {
			            this.infoContainer.style.display = 'none';
			            this.infoContainer.innerHTML = '';
			        }, 500); // Match the CSS transition duration
			***/
		}, 3000); // 3 seconds
	},


	/**
	 * Activate a plugin tab by plugin name.
	 */
	activatePlugin: function(pluginName) {
		var self = this;
		var pluginButton = Array.from(self.buttonsContainer.querySelectorAll('.cbi-tab-button'))
			.find(btn => btn.firstChild.textContent === pluginName);

		if (pluginButton) {
			pluginButton.click();
			self.pop(null, `[${PN}]: ` + _('Plugin "%s" has been activated.').format(pluginName), 'success');
		} else {
			self.pop(null, `[${PN}]: ` + _('Plugin "%s" not found.').format(pluginName), 'error');
			console.warn('Plugin not found for activation:', pluginName);
		}
	},


	/**
	 * Load plugins from directory, initialize them, and set defaults.
	 */
	loadPlugins: function(buttonsContainer, contentsContainer) {
		var self = this;

		var dispatcherInfo = self.info();
		self.pluginsRegistry[dispatcherInfo.name] = self;
		self.default_plugins['Dispatcher'] = dispatcherInfo.name;

		var pluginsPath = '/www/luci-static/resources/view/system/file-plug-manager/plugins/';

		fs.exec('/bin/ls', [pluginsPath]).then(function(result) {
			var pluginFiles = result.stdout.trim().split('\n');
			var pluginTypes = {
				'Editor': [],
				'Navigation': [],
				'Settings': [],
				'Help': [],
				'Utility': []
			};

			var loadPromises = pluginFiles.map(function(file) {
				if (file.endsWith('.js')) {
					var pluginName = file.slice(0, -3);

					// Check for duplicate names
					if (self.pluginsRegistry[pluginName]) {
						self.pop(null, `[${PN}]: ` + _('Duplicate plugin name "%s" found. Skipping.').format(pluginName));
						console.warn('Duplicate plugin name:', pluginName);
						return Promise.resolve();
					}

					return L.require('view.system.file-plug-manager.plugins.' + pluginName).then(function(plugin) {
						// Validate required functions
						if (typeof plugin.info !== 'function' ||
							typeof plugin.get_settings !== 'function' ||
							typeof plugin.set_settings !== 'function') {
							self.pop(null, `[${PN}]: ` + _('Plugin "%s" is missing required functions. Skipping.').format(pluginName));
							console.warn('Plugin missing required functions:', pluginName);
							return;
						}

						var info = plugin.info();
						if (!info.name || !info.type) {
							self.pop(null, `[${PN}]: ` + _('Plugin "%s" has invalid info. Skipping.').format(pluginName));
							console.warn('Plugin has invalid info:', pluginName);
							return;
						}

						if (!self.supportedPluginTypes.includes(info.type)) {
							self.pop(null, `[${PN}]: ` + _('Plugin "%s" has unsupported type "%s". Skipping.').format(info.name, info.type));
							console.warn('Unsupported plugin type for plugin:', info.name);
							return;
						}

						if (info.type === 'Navigation') {
							if (typeof plugin.read_file !== 'function' ||
								typeof plugin.write_file !== 'function') {
								self.pop(null, `[${PN}]: ` + _('Navigation plugin "%s" is missing required functions. Skipping.').format(info.name));
								console.warn('Navigation plugin missing required functions:', info.name);
								return;
							}
						}

						if (info.type === 'Settings') {
							if (typeof plugin.read_settings !== 'function') {
								self.pop(null, `[${PN}]: ` + _('Settings plugin "%s" is missing read_settings. Skipping.').format(info.name));
								console.warn('Settings plugin missing read_settings:', info.name);
								return;
							}
						}

						// Register plugin
						self.pluginsRegistry[info.name] = plugin;
						pluginTypes[info.type].push(info.name);

						// Load plugin CSS if provided
						// if (plugin.css) {
						// self.loadCSS(plugin.css);
						// }
					}).catch(function(err) {
						self.pop(null, `[${PN}]: ` + _('Error loading plugin "%s".').format(pluginName));
						console.error('Error loading plugin:', pluginName, err);
					});
				} else {
					// Non-JS file
					self.pop(null, `[${PN}]: ` + _('Ignored non-JS file "%s" in plugins directory.').format(file));
					return Promise.resolve();
				}
			});

			Promise.all(loadPromises).then(function() {
				self.setDefaultPlugins(pluginTypes);

				// Organize plugins according to defaultTabsOrder
				self.defaultTabsOrder.forEach(function(type) {
					var pluginsOfType = pluginTypes[type];
					if (!pluginsOfType || pluginsOfType.length === 0) {
						return;
					}

					// Ensure default plugin is first
					var defaultPlugin = self.default_plugins[type];
					if (defaultPlugin && pluginsOfType.includes(defaultPlugin)) {
						pluginsOfType.sort(function(a, b) {
							if (a === defaultPlugin) return -1;
							if (b === defaultPlugin) return 1;
							return 0;
						});
					}

					// Create tabs for each plugin in the sorted order
					pluginsOfType.forEach(function(pluginName) {
						var plugin = self.pluginsRegistry[pluginName];
						if (plugin) {
							var info = plugin.info();
							self.createTab(buttonsContainer, contentsContainer, info, plugin);
						}
					});
				});

				// Start all plugins except Settings and Dispatcher
				for (var pName in self.pluginsRegistry) {
					if (self.pluginsRegistry.hasOwnProperty(pName)) {
						var p = self.pluginsRegistry[pName];
						if (p && typeof p.info === 'function') {
							var pInfo = p.info();
							if (pInfo.type !== 'Settings' && pInfo.type !== 'Dispatcher' && typeof p.start === 'function') {
								var tabEl = document.getElementById('tab-' + pInfo.name);
								if (tabEl) {
									p.start(tabEl, self.pluginsRegistry, self.default_plugins, `${self.pluginUniqueIdCounter++}`);
								} else {
									console.warn(`[${PN}]: Tab element for plugin "${pInfo.name}" not found.`);
								}
							}
						}
					}
				}

				// Start the default Settings plugin last
				if (self.default_plugins['Settings']) {
					var settingsPlugin = self.pluginsRegistry[self.default_plugins['Settings']];
					if (settingsPlugin && typeof settingsPlugin.start === 'function') {
						var tabEl = document.getElementById('tab-' + self.default_plugins['Settings']);
						if (tabEl) {
							settingsPlugin.start(tabEl, self.pluginsRegistry, self.default_plugins, `${self.pluginUniqueIdCounter++}`);

							// Read settings after starting the settings plugin
							if (typeof settingsPlugin.read_settings === 'function') {
								settingsPlugin.read_settings().then(function() {
									self.pop(null, `[${PN}]: ` + _('Settings loaded successfully.'));
								}).catch(function(err) {
									self.pop(null, `[${PN}]: ` + _('Error reading settings.'), 'error');
									console.error('Error reading settings:', err);
								});
							} else {
								self.pop(null, `[${PN}]: ` + _('Settings plugin does not implement read_settings.'), 'error');
							}
						} else {
							self.pop(null, `[${PN}]: ` + _('Tab for default Settings plugin not found.'), 'error');
						}
					} else {
						self.pop(null, `[${PN}]: ` + _('Default Settings plugin not found or cannot be started.'), 'error');
					}
				} else {
					self.pop(null, `[${PN}]: ` + _('No default Settings plugin available.'), 'error');
				}

				// Activate the default start plugin
				if (self.defaultStartPlugin) {
					self.activatePlugin(self.defaultStartPlugin);
				}

				self.updateMarkers();
			});
		}).catch(function(err) {
			self.pop(null, `[${PN}]: ` + _('Error executing ls to load plugins.'));
			console.error('Error executing ls:', err);
		});
	},

	/**
	 * setDefaultPlugins(pluginTypes)
	 * Set default plugins for each type based on priority order.
	 */
	setDefaultPlugins: function(pluginTypes) {
		var self = this;

		// Ensure the Dispatcher is registered as a plugin
		pluginTypes['Dispatcher'] = ['Main Dispatcher'];

		var preferredDefaults = {
			'Editor': 'Text Editor',
			'Navigation': 'Navigation',
			'Settings': 'Settings Manager',
			'Help': 'Help Center',
			'Utility': 'Utility Tool',
			'Dispatcher': 'Main Dispatcher'
		};

		self.supportedPluginTypes.forEach(function(type) {
			if (pluginTypes[type].includes(preferredDefaults[type])) {
				self.default_plugins[type] = preferredDefaults[type];
			} else if (pluginTypes[type].length > 0) {
				self.default_plugins[type] = pluginTypes[type][0];
			} else {
				self.default_plugins[type] = null;
				self.pop(null, `[${PN}]: ` + _('No plugins available for type "%s".').format(type));
			}
		});
	},

	/**
	 * loadCSS(cssContent)
	 * Load CSS from a plugin into the document head.
	 */
	loadCSS: function(cssContent) {
		var style = document.createElement('style');
		style.type = 'text/css';
		style.innerHTML = cssContent;
		document.head.appendChild(style);
	},

	/**
	 * createTab(buttonsContainer, contentsContainer, info, plugin)
	 * Create a tab for a plugin without starting it here.
	 */
	createTab: function(buttonsContainer, contentsContainer, info, plugin) {
		var self = this;

		var tabButton = E('button', {
			'class': 'cbi-tab-button'
		}, info.name);
		var marker = E('span', {
			'class': 'default-marker inactive',
			'title': _('Set as default')
		});
		tabButton.appendChild(marker);

		var tabContent = E('div', {
			'class': 'cbi-tab-content',
			'id': 'tab-' + info.name
		});

		buttonsContainer.appendChild(tabButton);
		contentsContainer.appendChild(tabContent);

		// Tab button click
		tabButton.onclick = function() {
			var allButtons = buttonsContainer.querySelectorAll('.cbi-tab-button');
			allButtons.forEach(function(btn) {
				btn.classList.remove('active');
			});

			var allContents = contentsContainer.querySelectorAll('.cbi-tab-content');
			allContents.forEach(function(content) {
				content.classList.remove('active');
			});

			tabButton.classList.add('active');
			tabContent.classList.add('active');

			var eventName = `tab-${info.name}`;
			var event = new Event(eventName);
			document.dispatchEvent(event);
			console.log(`[Main Dispatcher] "${eventName}" Event sent.`);
		};

		// Marker click to set default
		marker.onclick = function(e) {
			e.stopPropagation();
			if (self.supportedPluginTypes.includes(info.type)) {
				self.default_plugins[info.type] = info.name;
				self.updateMarkers();
				self.pop(null, `[${PN}]: ` + _('Set "%s" as the default %s plugin.').format(info.name, info.type));
			}
		};

		// Drag and drop for Editor or Utility
		if (info.type === 'Editor' || info.type === 'Utility') {
			tabButton.setAttribute('draggable', 'true');

			tabButton.addEventListener('dragover', function(e) {
				e.preventDefault();
				e.dataTransfer.dropEffect = 'copy';
			});

			// Modify the drop event handler to listen for 'application/myapp-files'
			tabButton.addEventListener('drop', function(e) {
				e.preventDefault();

				// Attempt to retrieve the custom MIME type data
				var data = e.dataTransfer.getData('application/myapp-files');

				if (data) {
					try {
						// Parse the JSON string to get the array of file paths
						var filePaths = JSON.parse(data);

						if (Array.isArray(filePaths)) {
							// Handle multiple files
							filePaths.forEach(function(filePath) {
								self.openFileInPlugin(filePath, info.type, info.name);
							});
						} else {
							// Handle single file
							self.openFileInPlugin(data, info.type, info.name);
						}
					} catch (err) {
						// If parsing fails, log the error
						self.pop(null, `[${PN}]: ` + _('Error parsing dropped data.'));
						console.error('Error parsing dropped data:', err);
					}
				} else {
					// If custom MIME type data is not present, you can handle other drop types or ignore
					self.pop(null, `[${PN}]: ` + _('Unsupported drop data.'));
					console.warn('Unsupported drop data received.');
				}
			});
		}

		// Auto-activate first tab
		if (buttonsContainer.querySelectorAll('.cbi-tab-button').length === 1) {
			tabButton.click();
		}
	},

	/**
	 * updateMarkers()
	 * Update the default markers to show which plugins are default.
	 */
	updateMarkers: function() {
		var self = this;
		var buttons = self.buttonsContainer.querySelectorAll('.cbi-tab-button');

		buttons.forEach(function(btn) {
			var pluginName = btn.firstChild.textContent;
			var marker = btn.querySelector('.default-marker');

			// If marker does not exist, skip this button
			if (!marker) {
				return;
			}

			// Special handling for Logs tab to keep its marker active
			if (btn.classList.contains('logs-tab')) {
				marker.classList.add('active');
				marker.classList.remove('inactive');
				return;
			}

			var pluginType = null;
			for (var type in self.default_plugins) {
				if (self.default_plugins[type] === pluginName) {
					pluginType = type;
					break;
				}
			}

			if (pluginType && self.default_plugins[pluginType] === pluginName) {
				marker.classList.add('active');
				marker.classList.remove('inactive');
			} else {
				marker.classList.add('inactive');
				marker.classList.remove('active');
			}
		});
	},

	/**
	 * openFileInPlugin(filePath, pluginType, pluginName)
	 * Opens a file in the specified plugin.
	 */
	openFileInPlugin: function(filePath, pluginType, pluginName) {
		var self = this;

		if (pluginType === 'Editor') {
			var editorPlugin = self.pluginsRegistry[pluginName];
			if (!editorPlugin || typeof editorPlugin.edit !== 'function') {
				self.pop(null, `[${PN}]: ` + _('Target editor plugin does not support editing files.'));
				return;
			}

			if (!self.default_plugins['Navigation']) {
				self.pop(null, `[${PN}]: ` + _('No default Navigation plugin set.'));
				return;
			}

			var navigationPlugin = self.pluginsRegistry[self.default_plugins['Navigation']];
			if (!navigationPlugin || typeof navigationPlugin.read_file !== 'function') {
				self.pop(null, `[${PN}]: ` + _('Default Navigation plugin does not support reading files.'));
				return;
			}

			var editorInfo = editorPlugin.info();
			var style = editorInfo.style || 'text';

			navigationPlugin.read_file(filePath, style).then(function(fileData) {
				editorPlugin.edit(filePath, fileData.content, style, fileData.permissions, fileData.GroupOwner);
				self.activatePlugin(pluginName);
				self.pop(null, `[${PN}]: ` + _('File "%s" opened in editor.').format(filePath), 'success');
			}).catch(function(err) {
				self.pop(null, `[${PN}]: ` + _('Error reading file "%s".').format(filePath), 'error');
				console.error('Error reading file:', filePath, err);
			});
		} else if (pluginType === 'Navigation') {
			self.pop(null, `[${PN}]: ` + _('Navigation plugin does not handle direct file opening.'));
		}
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
