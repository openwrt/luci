'use strict';
'require ui';
'require fs';
'require dom';
'require form';

// Define the plugin name as a constant
const PN = 'Settings';

return L.Class.extend({
	info: function() {
		return {
			name: PN,
			type: 'Settings'
		};
	},

	/**
	 * flattenObject(obj, parentKey = '', separator = '.')
	 * Recursively converts a nested object into a flat object with keys separated by separator.
	 */
	flattenObject: function(obj, parentKey = '', separator = '.') {
		let flatObj = {};
		for (let key in obj) {
			if (!obj.hasOwnProperty(key)) continue;
			let newKey = parentKey ? `${parentKey}${separator}${key}` : key;
			if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
				Object.assign(flatObj, this.flattenObject(obj[key], newKey, separator));
			} else {
				flatObj[newKey] = obj[key];
			}
		}
		return flatObj;
	},

	/**
	 * unflattenObject(flatObj, separator = '.')
	 * Restores a nested object from a flat object with separated keys.
	 */
	unflattenObject: function(flatObj, separator = '.') {
		let nestedObj = {};
		for (let flatKey in flatObj) {
			if (!flatObj.hasOwnProperty(flatKey)) continue;
			let keys = flatKey.split(separator);
			keys.reduce((acc, key, index) => {
				if (index === keys.length - 1) {
					acc[key] = flatObj[flatKey];
				} else {
					if (!acc[key] || typeof acc[key] !== 'object') {
						acc[key] = {};
					}
				}
				return acc[key];
			}, nestedObj);
		}
		console.log(`[${PN}]: ` + `unflattenObject result:`, nestedObj); // Debug
		return nestedObj;
	},

	/**
	 * serializeUCI(configObject)
	 * Serializes a settings object into UCI format.
	 */
	serializeUCI: function(configObject) {
		let configStr = '';

		for (let sectionName in configObject) {
			if (!configObject.hasOwnProperty(sectionName)) continue;
			let section = configObject[sectionName];

			// Determine the section type
			let sectionType = section.type || 'option';
			// Create a copy of the section without the type
			let sectionCopy = Object.assign({}, section);
			delete sectionCopy.type; // Remove type from options

			// Start of configuration section
			configStr += `config '${sectionType}' '${sectionName}'\n`;

			// Convert nested objects into flat format
			let flatOptions = this.flattenObject(sectionCopy);

			// Add options
			for (let key in flatOptions) {
				if (!flatOptions.hasOwnProperty(key)) continue;
				let value = flatOptions[key];

				// Convert value to string
				if (typeof value !== 'string') {
					value = String(value);
				}

				// Escape single quotes
				value = value.replace(/'/g, `'\\''`);
				configStr += `\toption '${key}' '${value}'\n`;
			}
		}

		return configStr;
	},

	/**
	 * parseUCI(configContent)
	 * Parses the content of a UCI configuration file and returns a settings object.
	 */
	parseUCI: function(configContent) {
		var self = this; // Save reference to this
		var config = {};
		var currentSection = null;
		var sectionType = null;
		var sectionName = null;

		// Split content into lines
		var lines = configContent.split('\n');

		lines.forEach(function(line) {
			// Trim spaces
			line = line.trim();

			// Ignore empty lines and comments
			if (line.length === 0 || line.startsWith('#') || line.startsWith('//')) {
				return;
			}

			// Check if the line starts with a new configuration section
			var configRegex = /^config\s+'([^']+)'\s+'([^']+)'$/;
			var match = configRegex.exec(line);
			if (match) {
				sectionType = match[1];
				sectionName = match[2];
				config[sectionName] = {
					type: sectionType
				};
				currentSection = config[sectionName];
				return;
			}

			// Check if the line is an option within a section
			var optionRegex = /^option\s+'([^']+)'\s+'([^']+)'$/;
			match = optionRegex.exec(line);
			if (match && currentSection) {
				var optionKey = match[1];
				var optionValue = match[2].replace(/\\'/g, `'`); // Unescape single quotes

				// Add the option to the current section
				currentSection[optionKey] = optionValue;
			}
		});

		// Restore nested objects
		for (let sectionName in config) {
			if (!config.hasOwnProperty(sectionName)) continue;
			let section = config[sectionName];
			let flatOptions = {};

			for (let key in section) {
				if (!section.hasOwnProperty(key)) continue;
				if (key === 'type') continue; // Skip section type
				flatOptions[key] = section[key];
			}

			// Restore nested objects using self
			let nestedOptions = self.unflattenObject(flatOptions);
			config[sectionName] = Object.assign({
				type: section.type
			}, nestedOptions);

			// Debug
			console.log(`[${PN}]: ` + `Section "${sectionName}" after unflatten:`, config[sectionName]);
		}

		console.log(`[${PN}]: ` + `Parsed configuration:`, config); // Debug
		return config;
	},

	/**
	 * get_settings()
	 * Returns the current settings of the plugin.
	 */
	get_settings: function() {
		var settingsPanel = document.getElementById(`settings-panel-${this.info().name}-${this.uniqueId}`);
		if (settingsPanel) {
			// Remove 'px' from width and height and combine with 'x'
			var width = parseInt(settingsPanel.style.width, 10) || 800;
			var height = parseInt(settingsPanel.style.height, 10) || 600;
			var window_size = `${width}x${height}`;
			return {
				window_size: window_size
			};
		}
		// Default values if the settings panel is not found
		return {
			window_size: this.window_size || '800x600'
		};
	},

	/**
	 * set_settings(settings)
	 * Applies the given settings to the plugin.
	 */
	set_settings: function(settings) {
		if (settings.window_size) {
			this.window_size = settings.window_size;
			console.log(`[${PN}]: ` + `Window size set to "${this.window_size}".`);
			this.apply_window_size();
		}
	},

	/**
	 * apply_window_size()
	 * Applies the window size settings to the settings panel.
	 */
	apply_window_size: function() {
		var dimensions = this.window_size.split('x');
		var width = dimensions[0] + 'px';
		var height = dimensions[1] + 'px';

		var settingsPanel = document.getElementById(`settings-panel-${this.info().name}-${this.uniqueId}`);
		if (settingsPanel) {
			settingsPanel.style.width = width;
			settingsPanel.style.height = height;
		}
	},

	/**
	 * read_settings()
	 * Reads settings from the configuration file using the Navigation plugin and applies them.
	 */
	read_settings: function() {
		var self = this;
		return new Promise(function(resolve, reject) {
			console.log(`[${PN}]: ` + `Reading settings for plugin "${self.info().name}"...`);
			var navPluginName = self.defaultPlugins['Navigation'];
			var navigationPlugin = self.loadedPlugins[navPluginName] || null;

			self.read_file('/etc/config/file-plug-manager', 'text').then(function(fileData) {
				self.permissions = fileData.permissions;
				self.GroupOwner = fileData.GroupOwner;

				console.log('[Settings] Configuration file content:', fileData.content);
				var parsedConfig = self.parseUCI(fileData.content);
				console.log('[Settings] Parsed configuration:', parsedConfig);

				// Iterate over all sections of the configuration file
				for (let sectionName in parsedConfig) {
					if (!parsedConfig.hasOwnProperty(sectionName)) continue;

					// Skip the 'file-plug-manager' section if it does not contain plugin settings
					if (sectionName === 'file-plug-manager') continue;

					// Get settings for the current section
					let section = parsedConfig[sectionName];
					let pluginName = sectionName; // Assume the section name matches the plugin name

					// Get the plugin by name
					let plugin = self.loadedPlugins[pluginName];
					if (plugin && typeof plugin.set_settings === 'function') {
						try {
							// Remove the section type before passing settings
							let {
								type,
								...pluginSettings
							} = section;
							plugin.set_settings(pluginSettings);
							console.log(`[${PN}]: ` + `Settings applied to plugin "${pluginName}":`, pluginSettings);
						} catch (e) {
							console.error(`[${PN}]: ` + `Error applying settings to plugin "${pluginName}":`, e);
							self.popm(null, `[${PN}]: ` + _('Settings: Error applying settings to plugin "' + pluginName + '".'));
						}
					} else {
						console.warn(`[${PN}]: ` + `Plugin "${pluginName}" not found or does not implement set_settings().`);
					}
				}

				// Apply settings for the 'Settings' plugin itself, if they exist
				if (parsedConfig['Settings']) {
					self.set_settings(parsedConfig['Settings']);
				}

				resolve();
			}).catch(function(err) {
				if (err.code === 'ENOENT') {
					console.warn('[Settings] Configuration file not found. Using default settings.');
					self.popm(null, `[${PN}]: ` + _('Settings: Configuration file not found. Using default settings.'));
					self.set_settings({
						window_size: '800x600'
					});
					resolve();
				} else {
					console.error('[Settings] Error reading settings:', err);
					self.popm(null, `[${PN}]: ` + _('Settings: Error reading settings.'));
					reject(err);
				}
			});
		});
	},

	/**
	 * setNestedValue(obj, path, value)
	 * Sets a nested value in an object based on the given path.
	 * @param {Object} obj - Object to modify.
	 * @param {Array<string>} path - Path to the value, e.g., ['columnWidths', 'name'].
	 * @param {string} value - Value to set.
	 */
	setNestedValue: function(obj, path, value) {
		var current = obj;
		for (var i = 0; i < path.length - 1; i++) {
			var key = path[i];
			if (typeof current[key] !== 'object' || current[key] === null) {
				current[key] = {}; // Create a nested object if it doesn't exist
			}
			current = current[key];
		}

		var finalKey = path[path.length - 1];

		// Here you can add logic for type conversion if necessary
		current[finalKey] = value;
	},


	// Define CSS styles
	// CSS is dynamically generated to include the uniqueId in class names
	get_css: function() {
		return `
            .settings-panel-${this.uniqueId} {
                resize: both;
                overflow: auto;
                padding: 20px;
                border: 1px solid #ccc;
                border-radius: 5px;
                width: 800px; /* Initial width, can be dynamically set from this.window_size */
                height: 600px; /* Initial height */
                box-sizing: border-box;
                background-color: #f9f9f9;
            }
            .settings-panel-${this.uniqueId} h3 {
                margin-top: 20px;
                margin-bottom: 10px;
                font-size: 1.2em;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
            }
            .settings-panel-${this.uniqueId} fieldset {
                margin-left: 20px;
                border: 1px solid #ddd;
                padding: 10px;
                border-radius: 5px;
                background-color: #fff;
            }
            .settings-panel-${this.uniqueId} label {
                display: inline-block;
                width: 200px;
                margin-right: 10px;
                text-align: right;
                vertical-align: top;
            }
            .settings-panel-${this.uniqueId} .form-field-${this.uniqueId} {
                margin-bottom: 15px;
                display: flex;
                align-items: center;
            }
            .settings-panel-${this.uniqueId} input[type="text"] {
                flex: 1;
                padding: 5px;
                border: 1px solid #ccc;
                border-radius: 3px;
            }
            .save-button-${this.uniqueId} {
                margin-top: 20px;
                padding: 10px 20px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1em;
            }
            .save-button-${this.uniqueId}:hover {
                background-color: #45a049;
            }
        `;
	},

	/**
	 * start(container, loadedPlugins, defaultPlugins, uniqueId)
	 * Initializes the Settings plugin.
	 * @param {HTMLElement} container - The DOM element to attach the plugin's UI.
	 * @param {Object} loadedPlugins - Registry of loaded plugins.
	 * @param {Object} defaultPlugins - Registry of default plugins.
	 * @param {string} uniqueId - Unique identifier for this plugin instance.
	 */
	start: function(container, loadedPlugins, defaultPlugins, uniqueId) {
		var self = this;

		// Store the uniqueId for later use
		self.uniqueId = uniqueId;

		console.log(`[${PN}]: ` + `Plugin "${self.info().name}" started with unique ID "${self.uniqueId}".`);

		// Inject the dynamically generated CSS into the document
		var styleElement = document.createElement('style');
		styleElement.type = 'text/css';
		styleElement.innerHTML = this.get_css();
		document.head.appendChild(styleElement);
		console.log(`[${PN}]: ` + `CSS injected for unique ID "${self.uniqueId}".`);

		// Create the settings panel with unique ID suffix
		var settingsPanel = E('div', {
			'class': `settings-panel-${self.uniqueId}`,
			'id': `settings-panel-${self.info().name}-${self.uniqueId}`
		});

		// Create the save button with unique ID suffix
		var saveButton = E('button', {
			'class': `save-button-${self.uniqueId}`,
			'id': `save-button-${self.info().name}-${self.uniqueId}`
		}, _('Save Settings'));
		saveButton.onclick = self.saveSettings.bind(self);

		// Add the panel and button to the container
		container.appendChild(settingsPanel);
		container.appendChild(saveButton);

		self.loadedPlugins = loadedPlugins || {};
		self.defaultPlugins = defaultPlugins || {};

		var pluginName = self.info().name;
		var eventName = `tab-${pluginName}`;

		// Add an event listener to display settings
		document.addEventListener(eventName, self.displaySettings.bind(self));
		console.log(`[${PN}]: ` + `Event listener for "${eventName}" added.`);

		// Retrieve the default Dispatcher plugin
		var defaultDispatcherName = self.defaultPlugins['Dispatcher'];
		if (defaultDispatcherName && self.loadedPlugins[defaultDispatcherName]) {
			var defaultDispatcher = self.loadedPlugins[defaultDispatcherName];
			self.popm = defaultDispatcher.pop.bind(defaultDispatcher);
		}

		// Retrieve the default Navigation plugin
		var navigationPluginName = self.defaultPlugins['Navigation'];
		if (!navigationPluginName) {
			self.popm(null, `[${PN}]: ` + _('No default Navigation plugin set.'));
			console.error('No default Navigation plugin set.');
			return;
		}

		var navigationPlugin = self.loadedPlugins[navigationPluginName];
		if (!navigationPlugin || typeof navigationPlugin.write_file !== 'function') {
			self.popm(null, `[${PN}]: ` + _('Navigation plugin does not support writing files.'));
			console.error('Navigation plugin is unavailable or missing write_file function.');
			return;
		}

		// Bind the write_file() and read_file() functions from the Navigation plugin
		self.write_file = navigationPlugin.write_file.bind(navigationPlugin);
		self.read_file = navigationPlugin.read_file.bind(navigationPlugin);
	},

	/**
	 * displaySettings()
	 * Displays the settings form for all loaded plugins.
	 */
	displaySettings: function() {
		var self = this;
		console.log(`[${PN}]: ` + `Displaying settings for plugin "${self.info().name}" with unique ID "${self.uniqueId}"...`);
		var settingsPanel = document.getElementById(`settings-panel-${self.info().name}-${self.uniqueId}`);

		if (!settingsPanel) {
			console.error(`[${PN}]: ` + `settings-panel-${self.info().name}-${self.uniqueId} element not found.`);
			self.popm(null, `[${PN}]: ` + _('Settings panel not found.'));
			return;
		}

		// Clear previous content
		settingsPanel.innerHTML = '';

		var settingsForm = E('form', {
			'id': `settings-form-${self.info().name}-${self.uniqueId}`
		});
		var allSettings = {};

		for (var pluginName in self.loadedPlugins) {
			if (self.loadedPlugins.hasOwnProperty(pluginName)) {
				try {
					var plugin = self.loadedPlugins[pluginName];
					if (plugin && typeof plugin.get_settings === 'function') {
						var pluginSettings = plugin.get_settings();
						allSettings[pluginName] = pluginSettings;
						console.log(`[${PN}]: ` + `Retrieved settings from plugin "${pluginName}":`, pluginSettings);

						// Add settings to the form
						self.addSettingsToForm(settingsForm, pluginName, pluginSettings, plugin.info().type);
					} else {
						console.warn(`[${PN}]: ` + `Plugin "${pluginName}" does not implement get_settings().`);
					}
				} catch (err) {
					console.error(`[${PN}]: ` + `Error retrieving settings for plugin "${pluginName}":`, err);
					self.popm(null, `[${PN}]: ` + _('Error retrieving settings for "' + pluginName + '".'));
				}
			}
		}

		if (Object.keys(allSettings).length === 0) {
			settingsForm.innerHTML = '<p>' + _('No settings available.') + '</p>';
		}

		settingsPanel.appendChild(settingsForm);
		console.log(`[${PN}]: ` + `Settings displayed for plugin "${self.info().name}" with unique ID "${self.uniqueId}".`);
	},

	/**
	 * addSettingsToForm(settingsForm, pluginName, pluginSettings, pluginType)
	 * Adds setting fields for a specific plugin to the form.
	 */
	addSettingsToForm: function(settingsForm, pluginName, pluginSettings, pluginType) {
		var header = E('h3', {}, `${pluginName} (${pluginType || 'Unknown'})`);
		settingsForm.appendChild(header);

		var fieldsContainer = E('div', {
			'class': `fields-container-${this.uniqueId}`
		});

		// Use a helper function to recursively add fields
		this.renderSettingsFields(pluginName, fieldsContainer, pluginSettings, []);

		settingsForm.appendChild(fieldsContainer);
	},

	/**
	 * renderSettingsFields(pluginName, container, settings, path)
	 * Recursively renders setting fields in nested objects.
	 * @param {string} pluginName - Plugin name.
	 * @param {HTMLElement} container - DOM element to add fields to.
	 * @param {Object} settings - Settings object (can be nested).
	 * @param {Array<string>} path - Current path to settings (used for unique field names).
	 */
	renderSettingsFields: function(pluginName, container, settings, path) {
		for (var settingKey in settings) {
			if (!settings.hasOwnProperty(settingKey)) continue;
			var settingValue = settings[settingKey];

			// Construct the full path for this parameter
			var fullPath = path.concat(settingKey);

			if (typeof settingValue === 'object' && settingValue !== null && !Array.isArray(settingValue)) {
				// If the value is an object, create a nested fieldset
				var subgroup = E('fieldset', {}, [
					E('legend', {}, settingKey)
				]);

				// Recursively render nested fields
				this.renderSettingsFields(pluginName, subgroup, settingValue, fullPath);

				container.appendChild(subgroup);
			} else {
				// Primitive value (string, number, etc.)
				var label = E('label', {
					'for': `${pluginName}-${fullPath.join('-')}-${this.uniqueId}`
				}, settingKey);

				// Create an input field
				var input = E('input', {
					'type': 'text',
					'id': `${pluginName}-${fullPath.join('-')}-${this.uniqueId}`,
					'name': `${pluginName}-${fullPath.join('-')}-${this.uniqueId}`
				});
				input.value = (settingValue !== undefined && settingValue !== null) ? settingValue.toString() : '';

				var fieldWrapper = E('div', {
					'class': `form-field-${this.uniqueId}`
				}, [label, input]);
				container.appendChild(fieldWrapper);
			}
		}
	},

	/**
	 * saveSettings()
	 * Saves the current settings of all plugins to the configuration file.
	 */
	saveSettings: function() {
		var self = this;
		console.log(`[${PN}]: ` + `Saving settings for plugin "${self.info().name}" with unique ID "${self.uniqueId}"...`);
		var settingsForm = document.getElementById(`settings-form-${self.info().name}-${self.uniqueId}`);

		if (!settingsForm) {
			self.popm(null, `[${PN}]: ` + _('Settings form not found.'));
			return;
		}

		var formData = new FormData(settingsForm);
		var updatedSettings = {};

		// Parse form data
		formData.forEach(function(value, key) {
			// Key format: "pluginName-subkey-subsubkey-...-uniqueId"
			var parts = key.split('-');
			var uniqueIdFromKey = parts.pop(); // Remove the uniqueId part
			var pluginName = parts.shift();
			var settingPath = parts; // Remaining parts represent the path to settings

			if (!updatedSettings[pluginName]) {
				updatedSettings[pluginName] = {};
			}

			// Recreate the nested structure from settingPath
			self.setNestedValue(updatedSettings[pluginName], settingPath, value);
		});

		console.log(`[${PN}]: ` + `Updated settings:`, updatedSettings);

		var applySettingsPromises = [];

		for (var pluginName in updatedSettings) {
			if (updatedSettings.hasOwnProperty(pluginName)) {
				var plugin = self.loadedPlugins[pluginName];
				if (plugin && typeof plugin.set_settings === 'function') {
					try {
						var result = plugin.set_settings(updatedSettings[pluginName]);
						if (result && typeof result.then === 'function') {
							applySettingsPromises.push(result);
						}
						console.log(`[${PN}]: ` + `Applied settings to plugin "${pluginName}":`, updatedSettings[pluginName]);
					} catch (err) {
						console.error(`[${PN}]: ` + `Error applying settings to plugin "${pluginName}":`, err);
						self.popm(null, `[${PN}]: ` + _('Error applying settings to plugin "' + pluginName + '".'));
					}
				}
			}
		}

		Promise.all(applySettingsPromises).then(function() {
			// After successfully applying settings to all plugins, save to the configuration file
			self.saveToConfigFile(updatedSettings).then(function() {
				self.popm(null, `[${PN}]: ` + _('Settings saved successfully.'));
				console.log(`[${PN}]: ` + `Settings saved.`);
			}).catch(function(err) {
				console.error(`[${PN}]: ` + `Error saving settings to file:`, err);
				self.popm(null, `[${PN}]: ` + _('Error saving settings to file.'));
			});
		}).catch(function(err) {
			console.error(`[${PN}]: ` + `Error applying settings:`, err);
			self.popm(null, `[${PN}]: ` + _('Error applying settings.'));
		});
	},

	/**
	 * saveToConfigFile(updatedSettings)
	 * Saves the updated settings to the configuration file.
	 * @param {Object} updatedSettings - Settings object to save.
	 * @returns {Promise} - Resolves on successful save.
	 */
	saveToConfigFile: function(updatedSettings) {
		var self = this;
		return new Promise(function(resolve, reject) {
			console.log('[Settings] Saving updated settings to configuration file.');

			// Prepare the UCI configuration with separate sections for each plugin
			var uciConfig = {};

			// Add the main 'file-plug-manager' section
			uciConfig['file-plug-manager'] = {
				type: 'file-plug-manager'
				// Add options for 'file-plug-manager' here, if any
			};

			// Add sections for each plugin
			for (var pluginName in updatedSettings) {
				if (!updatedSettings.hasOwnProperty(pluginName)) continue;
				var pluginSettings = updatedSettings[pluginName];

				// Get the plugin type via info()
				var plugin = self.loadedPlugins[pluginName];
				var pluginType = plugin && plugin.info && plugin.info().type ? plugin.info().type : 'option';

				// Ensure type is set
				uciConfig[pluginName] = Object.assign({
					type: pluginType
				}, pluginSettings);
			}

			var serializedConfig = self.serializeUCI(uciConfig);

			// Write the serialized configuration to the file
			self.write_file('/etc/config/file-plug-manager', self.permissions, self.ownerGroup, serializedConfig, 'text').then(function() {
				console.log('[Settings] Configuration file written successfully.');
				resolve();
			}).catch(function(err) {
				console.error('[Settings] Error writing configuration file:', err);
				reject(err);
			});
		});
	}
});