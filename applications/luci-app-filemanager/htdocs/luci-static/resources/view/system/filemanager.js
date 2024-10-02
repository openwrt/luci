// Enable strict mode for better error checking
'use strict';

// Require necessary modules from the LuCI framework
'require view'; // For working with views
'require fs'; // For filesystem operations
'require ui'; // For user interface components
'require dom'; // For DOM manipulation
'require rpc'; // For remote procedure cajls

/**
 * Parses a limited subset of Markdown and converts it to HTML.
 *
 * Supported Markdown elements:
 * - Headings (#, ##, ###)
 * - Bold text (**text** or __text__)
 * - Unordered lists (- or *)
 * - Ordered lists (1., 2., etc.)
 * - Paragraphs
 *
 * @param {string} markdown - The Markdown-formatted string.
 * @returns {string} - The resulting HTML string.
 */
function parseMarkdown(markdown) {
	// Split the input into lines
	const lines = markdown.split('\n');
	const html = [];
	let inList = false;
	let listType = ''; // 'ul' or 'ol'

	lines.forEach((line) => {
		let trimmedLine = line.trim();

		if (trimmedLine === '') {
			// Empty line signifies a new paragraph
			if (inList) {
				html.push(`</${listType}>`);
				inList = false;
				listType = '';
			}
			return; // Skip adding empty lines to HTML
		}

		// Check for headings
		if (/^###\s+(.*)/.test(trimmedLine)) {
			const content = trimmedLine.replace(/^###\s+/, '');
			html.push(`<h3>${escapeHtml(content)}</h3>`);
			return;
		} else if (/^##\s+(.*)/.test(trimmedLine)) {
			const content = trimmedLine.replace(/^##\s+/, '');
			html.push(`<h2>${escapeHtml(content)}</h2>`);
			return;
		} else if (/^#\s+(.*)/.test(trimmedLine)) {
			const content = trimmedLine.replace(/^#\s+/, '');
			html.push(`<h1>${escapeHtml(content)}</h1>`);
			return;
		}

		// Check for ordered lists
		let orderedMatch = trimmedLine.match(/^(\d+)\.\s+(.*)/);
		if (orderedMatch) {
			const [, number, content] = orderedMatch;
			if (!inList || listType !== 'ol') {
				if (inList) {
					html.push(`</${listType}>`);
				}
				html.push('<ol>');
				inList = true;
				listType = 'ol';
			}
			html.push(`<li>${parseInlineMarkdown(escapeHtml(content))}</li>`);
			return;
		}

		// Check for unordered lists
		let unorderedMatch = trimmedLine.match(/^[-*]\s+(.*)/);
		if (unorderedMatch) {
			const content = unorderedMatch[1];
			if (!inList || listType !== 'ul') {
				if (inList) {
					html.push(`</${listType}>`);
				}
				html.push('<ul>');
				inList = true;
				listType = 'ul';
			}
			html.push(`<li>${parseInlineMarkdown(escapeHtml(content))}</li>`);
			return;
		}

		// If currently inside a list but the line doesn't match a list item, close the list
		if (inList) {
			html.push(`</${listType}>`);
			inList = false;
			listType = '';
		}

		// Regular paragraph
		html.push(`<p>${parseInlineMarkdown(escapeHtml(trimmedLine))}</p>`);
	});

	// Close any open list tags at the end
	if (inList) {
		html.push(`</${listType}>`);
	}

	return html.join('\n');
}

/**
 * Parses inline Markdown elements like bold text.
 *
 * Supported inline elements:
 * - Bold text (**text** or __text__)
 *
 * @param {string} text - The text to parse.
 * @returns {string} - The text with inline Markdown converted to HTML.
 */
function parseInlineMarkdown(text) {
	// Convert **text** and __text__ to <strong>text</strong>
	return text
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/__(.+?)__/g, '<strong>$1</strong>');
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * @param {string} text - The text to escape.
 * @returns {string} - The escaped text.
 */
function escapeHtml(text) {
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	};
	return text.replace(/[&<>"']/g, function(m) {
		return map[m];
	});
}

function pop(a, message, severity) {
	ui.addNotification(a, message, severity)
}

// hexedit.js based on https://github.com/dnlmlr/hexedit-js

const _NON_PRINTABLE_CHAR = "\u00B7";

/**
 * Converts a byte to its corresponding character.
 * If the byte is not printable, returns a non-printable character.
 *
 * @param {number} b - The byte to convert.
 * @returns {string} - The corresponding character.
 */
function _byteToChar(b) {
	// If the byte is not printable, use a dot instead
	return (b >= 32 && b <= 126) ? String.fromCharCode(b) : _NON_PRINTABLE_CHAR;
}

/**
 * HexEditor class to handle hex editing functionalities.
 */
class HexEditor {
	/**
	 * Constructs a HexEditor instance.
	 *
	 * @param {HTMLElement} hexeditDomObject - The DOM element for the hex editor.
	 */
	constructor(hexeditDomObject) {
		this.hexedit = _fillHexeditDom(hexeditDomObject);
		this.offsets = this.hexedit.querySelector('.offsets');
		this.hexview = this.hexedit.querySelector('.hexview');
		this.textview = this.hexedit.querySelector('.textview');
		this.hexeditContent = this.hexedit.querySelector('.hexedit-content');
		this.hexeditHeaders = this.hexedit.querySelector('.hexedit-headers'); // Reference to headers

		this.bytesPerRow = 16;
		this.startIndex = 0; // Starting index for virtual scrolling
		this.data = new Uint8Array(0); // Initialize with empty data

		this.selectedIndex = null; // Currently selected byte index
		this.editHex = true; // Flag to determine edit mode (hex or text)
		this.currentEdit = ""; // Current edit buffer
		this.readonly = false; // Read-only mode flag
		this.ctrlPressed = false; // Control key pressed flag

		this.matches = []; // Array to store all match positions and lengths
		this.currentMatchIndex = -1; // Index of the current match
		this.currentSearchType = null; // Current search type ('ascii', 'hex', 'regex')
		this.activeView = null; // Active view based on focus ('hex' or 'text')
		this.previousSelectedIndex = null; // To track previous selection for color restoration

		// Storage of the last search pattern for each search type
		this.lastSearchPatterns = {
			ascii: '',
			hex: '',
			regex: ''
		};

		this._registerEventHandlers();

		// Initialize ResizeObserver for dynamic row calculation
		this.resizeObserver = new ResizeObserver(() => {
			this.calculateVisibleRows();
		});
		this.resizeObserver.observe(this.hexeditContent);

		// Initialize Search Functionality
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
				pattern = document.getElementById('hexedit-search-ascii').value.trim();
				break;
			case 'hex':
				pattern = document.getElementById('hexedit-search-hex').value.trim();
				break;
			case 'regex':
				pattern = document.getElementById('hexedit-search-regex').value.trim();
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

		// Update activeView based on currentSearchType during navigation
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
		const regex = new RegExp(pattern, 'g');
		let match;
		while ((match = regex.exec(dataStr)) !== null) {
			this.matches.push({
				index: match.index,
				length: pattern.length
			});
			// Prevent infinite loops with zero-length matches
			if (match.index === regex.lastIndex) {
				regex.lastIndex++;
			}
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
		console.log(`calculateVisibleRows: visibleRows=${this.visibleRows}, visibleByteCount=${this.visibleByteCount}`);
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

		console.log(`handleScroll: scrollTop=${scrollTop}, firstVisibleLine=${firstVisibleLine}, newStartIndex=${newStartIndex}`);

		// Update startIndex and re-render the DOM if necessary
		if (newStartIndex !== this.startIndex) {
			this.startIndex = newStartIndex;
			this.renderDom(); // Re-render visible data
			console.log(`handleScroll: Updated startIndex and rendered DOM.`);
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
				let text = _byteToChar(byte);
				if (text === " ") text = "\u00A0";
				else if (text === "-") text = "\u2011";
				charSpan.textContent = text;
				charSpan.dataset.byteIndex = index;
				if (text === _NON_PRINTABLE_CHAR) {
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
				const offsetChange = _keyShouldApply(e) ?? 0;
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
				const offsetChange = _keyShouldApply(e);
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
				let text = _byteToChar(value);
				if (text === " ") text = "\u00A0";
				else if (text === "-") text = "\u2011";
				textSpan.textContent = text;
				if (text === _NON_PRINTABLE_CHAR) {
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
		console.log(`setSelectedIndex called with index: ${index}`);

		if (index !== null) {
			// Calculate the line number of the selected index
			const lineNumber = Math.floor(index / this.bytesPerRow);
			const lineHeight = 16; // Height of one row in pixels
			const scrollTop = lineNumber * lineHeight;

			// Determine visible range
			const visibleStartLine = Math.floor(this.hexeditContent.scrollTop / lineHeight);
			const visibleEndLine = visibleStartLine + this.visibleRows;

			console.log(`setSelectedIndex: lineNumber=${lineNumber}, visibleStartLine=${visibleStartLine}, visibleEndLine=${visibleEndLine}`);

			// If the selected line is out of the visible range, update scrollTop
			if (lineNumber < visibleStartLine || lineNumber >= visibleEndLine) {
				const newScrollTop = Math.max(0, (lineNumber * lineHeight) - ((this.visibleRows / 2) * lineHeight));
				this.hexeditContent.scrollTop = newScrollTop;
				console.log(`setSelectedIndex: Updated scrollTop to ${this.hexeditContent.scrollTop}`);
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
}

// Helper functions

/**
 * Fills the hex editor DOM structure.
 *
 * @param {HTMLElement} hexedit - The DOM element for the hex editor.
 * @returns {HTMLElement} - The filled hex editor DOM element.
 */
function _fillHexeditDom(hexedit) {
	hexedit.classList.add("hexedit");
	hexedit.tabIndex = -1;

	// Create headers
	const offsetsHeader = document.createElement("div");
	offsetsHeader.classList.add("offsets-header");
	offsetsHeader.innerText = _("Offset (h)");

	const hexviewHeader = document.createElement("div");
	hexviewHeader.classList.add("hexview-header");
	for (let i = 0; i < 16; i++) {
		const span = document.createElement("span");
		span.innerText = i.toString(16).toUpperCase().padStart(2, "0");
		hexviewHeader.appendChild(span);
	}

	const textviewHeader = document.createElement("div");
	textviewHeader.classList.add("textview-header");
	textviewHeader.innerText = _("Decoded Text");

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

/**
 * Determines if a key event should result in a byte index change.
 *
 * @param {KeyboardEvent} event - The keyboard event.
 * @returns {number|null} - The byte index change or null.
 */
function _keyShouldApply(event) {
	if (event.key === "Enter") return 1;
	if (event.key === "Tab") return 1;
	if (event.key === "Backspace") return -1;
	if (event.key === "ArrowLeft") return -1;
	if (event.key === "ArrowRight") return 1;
	if (event.key === "ArrowUp") return -16;
	if (event.key === "ArrowDown") return 16;
	return null;
}

var hexeditCssContent = `
/* Hex Editor CSS Styles */
.hexview:focus,
.textview:focus {
    outline: none;
    box-shadow: none;
    border-right: 2px solid var(--clr-border); 
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
  --clr-highlight: yellow; /* Unified highlight color for matches */
  --clr-cursor-active: blue; /* Active cursor base color */
  --clr-cursor-passive: lightblue; /* Passive cursor color */
  --animation-duration: 1s; /* Duration for blinking animation */
}

/* Apply box-sizing to all elements */
.hexedit *,
.hexedit *::before,
.hexedit *::after {
  box-sizing: border-box;
}

/* Main hex editor container */
.hexedit {
  display: flex;
  flex-direction: column;
  flex: 1; /* Allow hexedit to expand */
  font-family: monospace;
  font-size: 14px;
  line-height: 1.2em;
  background-color: var(--clr-background);
  border: 1px solid var(--clr-border);
  width: 100%;
}

.hexedit:focus {
  outline: none;
}

/* Headers container */
.hexedit-headers {
  display: flex;
  background-color: var(--clr-background);
  border-bottom: 2px solid var(--clr-border);
  font-family: monospace;
}

/* Header styles */
.offsets-header,
.hexview-header,
.textview-header {
  display: flex;
  align-items: center;
  padding: 5px;
  box-sizing: border-box;
  font-weight: bold;
  color: var(--clr-header);
  border-right: 2px solid var(--clr-border);
}

.offsets-header {
  width: 100px; /* Ensure alignment with .offsets */
  text-align: left;
}

.hexview-header {
  width: calc(16 * 2ch + 20 * var(--span-spacing)); /* Increased width to match content */
  display: flex;
}

.hexview-header span {
  width: 2ch;
  margin-right: var(--span-spacing);
  text-align: center;
}

.hexview-header span:last-child {
  margin-right: 0;
}

.textview-header {
  flex: 1;
  margin-left: 10px;
  text-align: left;
}

/* Content container */
.hexedit-content {
  display: flex;
  height: 100%;
  flex: 1 1 auto;
  overflow: auto;
  position: relative;
  border-top: 2px solid var(--clr-border);
}

/* Columns */
.offsets,
.hexview,
.textview {
  flex-shrink: 0;
  display: block;
  padding: 5px;
  position: relative;
  border-right: 2px solid var(--clr-border);
}

.offsets {
  width: 100px; /* Increased width to match content */
  display: flex;
  flex-direction: column;
  text-align: left;
}

.offsets span {
  display: block;
  height: 1.2em;
}

.hexview {
  width: calc(16 * 2ch + 20 * var(--span-spacing)); /* Increased width to match content */
  text-align: center;
}

.textview {
  flex: 1;
  margin-left: 10px;
  text-align: left;
  border-right: none;
}

/* Line containers */
.hex-line,
.text-line {
  display: flex;
  height: 1.2em;
}

/* Byte spans */
.hex-line span,
.text-line span {
  width: 2ch;
  margin-right: var(--span-spacing);
  text-align: center;
  display: inline-block;
  cursor: default;
}

.hex-line span:last-child,
.hexview-header span:last-child,
.text-line span:last-child {
  margin-right: 0;
}

/* Selections */
.selected {
  background-color: var(--clr-selected);
}

.selected-editing {
  background-color: var(--clr-selected-editing);
}

.non-printable {
  color: var(--clr-non-printable);
}

/* Remove individual scrollbars */
.offsets::-webkit-scrollbar,
.hexview::-webkit-scrollbar,
.textview::-webkit-scrollbar {
  display: none;
}

.offsets,
.hexview,
.textview {
  scrollbar-width: none; /* For Firefox */
}

/* Adjust overall layout */
.hexedit .offsets,
.hexedit .hexview,
.hexedit .textview {
  border-right: 2px solid var(--clr-border);
}

.hexedit .textview {
  border-right: none;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .hexedit {
    font-size: 12px;
  }

  .offsets {
    width: 120px; /* Adjust for smaller screens */
  }

  .hexview {
    width: calc(16 * 2ch + 20 * var(--span-spacing));
  }
}

/* Search container styles */
.hexedit-search-container {
    padding: 10px;
    background-color: #f9f9f9;
    border-bottom: 1px solid #ccc; /* Border to separate from headers */
    display: flex;
    flex-direction: column; /* Stack search groups vertically */
    gap: 10px;
    width: 100%;
    box-sizing: border-box;
}

/* Search group styles */
.hexedit-search-group {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
}

/* Search input fields */
.hexedit-search-input {
    flex: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

/* Search status fields */
.hexedit-search-status {
    width: 50px;
    text-align: center;
    font-size: 14px;
    color: #555;
}

/* Find Previous and Next buttons */
.hexedit-search-button {
    padding: 8px 12px;
    cursor: pointer;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    transition: background-color 0.3s ease;
}

.hexedit-search-button:hover {
    background-color: #0056b3;
}

/* Highlight search results */
.search-highlight {
    background-color: var(--clr-highlight);
}

/* Define keyframes for blinking blue */
@keyframes blink-blue {
    0% { background-color: var(--clr-cursor-active); }
    50% { background-color: white; }
    100% { background-color: var(--clr-cursor-active); }
}

/* Classes for active view cursor blinking */
.active-view-cursor {
    animation: blink-blue var(--animation-duration) infinite;
    background-color: var(--clr-cursor-active); /* Initial color */
}

/* Classes for passive view cursor highlighting */
.passive-view-cursor {
    background-color: var(--clr-cursor-passive);
}

/* Highlighted class to maintain yellow background for matches */
.highlighted {
    background-color: var(--clr-highlight);
}
`;

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
		if (res.code !== 0) {
			var errorMessage = res.stderr ? res.stderr.trim() : 'Unknown error';
			return Promise.reject(new Error('Failed to list directory: ' + errorMessage));
		}
		var stdout = res.stdout || '';
		var lines = stdout.trim().split('\n');
		var files = [];
		lines.forEach(function(line) {
			if (line.startsWith('total') || !line.trim()) return;
			// Parse the output line from 'ls' command
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
				type = 'directory'; // Directory
			} else if (typeChar === '-') {
				type = 'file'; // File
			} else if (typeChar === 'l') {
				type = 'symlink'; // Symbolic link
				var linkParts = name.split(' -> ');
				name = linkParts[0];
				target = linkParts[1] || '';
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
	// Define the Help content in Markdown format
	helpContentMarkdown: `
# LuCI OpenWrt File Manager Application Help

## Introduction
The **LuCI OpenWrt File Manager** is a tool to navigate directories, manage files, edit content, and customize the application's settings.

## Key Features

1. **Tabbed Interface**
   - **File Manager Tab**: Primary interface for browsing and managing files and directories.
   - **Editor Tab**: Advanced tool for editing file contents in both text and hexadecimal formats.
   - **Settings Tab**: Customize the application's appearance and behavior according to your preferences.
   - **Help Tab**: Access detailed instructions and information about the application's features and functionalities.

2. **File Management**
   - **View Files and Directories**: Display a list of files and folders within the current directory.
   - **Navigate Directories**: Move into subdirectories or return to parent directories.
   - **Resizable Columns**: Adjust the width of table columns to enhance readability and organization.
   - **Drag-and-Drop Uploads**: Upload files by simply dragging them into the designated area.
   - **Upload via File Selector**: Use the "Upload File" button to select and upload files from your local machine.
   - **Create New Files and Folders**:
     - **Create Folder**: Instantiate new directories within the current path.
     - **Create File**: Generate new empty files for content creation or editing.
   - **File Actions**:
     - **Edit**: Modify the contents of files directly within the application.
     - **Duplicate**: Create copies of existing files or directories.
     - **Delete**: Remove selected files or directories permanently.
     - **Download**: Save copies of files to your local machine for offline access.

3. **Selection and Bulk Actions**
   - **Select All**: Quickly select or deselect all files and directories within the current view using the "Select All" checkbox.
   - **Invert Selection**: Reverse the current selection of files and directories, selecting previously unselected items and vice versa.
   - **Individual Selection**: Select or deselect individual files and directories using the checkboxes next to each item.
   - **Bulk Delete**: Remove multiple selected items simultaneously for efficient management.

4. **Advanced Editing**
   - **Text Editor**:
     - **Line Numbers**: Toggle the display of line numbers to assist in content navigation.
     - **Save Changes**: Commit edits directly to the server.
   - **Hex Editor**:
     - **Binary Editing**: Modify file contents at the byte level for advanced users.
     - **ASCII, HEX and RegExp search**: Search for a pattern in the file and navigate to it.
     - **Switch Between Modes**: Seamlessly toggle between text and hex editing modes.
     - **Save Changes**: Apply and save binary modifications.

5. **User Notifications and Status Indicators**
   - **Progress Bars**: Visual indicators for ongoing operations like file uploads and deletions.
   - **Notifications**: Informational messages alert users about the success or failure of actions performed.

6. **Customizable Settings**
   - **Interface Customization**:
     - **Column Widths**: Define the width of each column in the file list for optimal viewing.
     - **Window Sizes**: Adjust the size of the file list container and editor windows.
     - **Padding**: Set padding values to control the spacing within the interface.
   - **Persistent Configuration**: Save your settings to ensure a consistent user experience across sessions.

## How to Use the Application

1. **Accessing the Application**
   - Navigate to your OpenWrt device's LuCI web interface.
   - Locate and select the **File Manager** application from **System** menu .

2. **Navigating the Interface**
   - **Tabs**: Use the top navigation tabs to switch between **File Manager**, **Editor**, **Settings**, and **Help**.
   - **File Manager Tab**:
     - Browse through directories by clicking on folder names.
     - Use the "Go" button or press "Enter" after typing a path in the path input field to navigate to specific directories.
   - **Editor Tab**:
     - Select a file from the File Manager to open it in the Editor.
     - Choose between text or hex editing modes using the toggle buttons.
   - **Settings Tab**:
     - Adjust interface settings such as column widths, window sizes, and padding.
     - Save your configurations to apply changes immediately.
   - **Help Tab**:
     - Access detailed instructions and information about the application's features and functionalities.

3. **Managing Files and Directories**
   - **Uploading Files**:
     - **Drag and Drop**: Drag files from your local machine and drop them into the **File List Container** to upload.
     - **File Selector**: Click the "Upload File" button to open a file dialog and select files for uploading.
   - **Creating Files/Folders**:
     - Click on "Create File" or "Create Folder" buttons and provide the necessary names to add new items.
   - **Editing Files**:
     - Select a file and click the edit icon (✏️) to modify its contents in the Editor tab.
   - **Duplicating Files/Folders**:
     - Use the duplicate icon (📑) to create copies of selected items.
   - **Deleting Items**:
     - Select one or multiple items using checkboxes and click the delete icon (🗑️) or use the "Delete Selected" button for bulk deletions.
   - **Downloading Files**:
     - Click the download icon (⬇️) next to a file to save it to your local machine.

4. **Using Selection Features**
   - **Select All**:
     - Use the "Select All" checkbox located in the table header to select or deselect all files and directories in the current view.
   - **Invert Selection**:
     - Hold the "Alt" key and click the "Select All" checkbox to invert the current selection, selecting all unselected items and deselecting previously selected ones.
   - **Individual Selection**:
     - Click on the checkbox next to each file or directory to select or deselect it individually.

5. **Using the Editor**
   - **Text Mode**:
     - Edit the content of text files with features like line numbers and real-time updates.
     - Save your changes by clicking the "Save" button.
   - **Hex Mode**:
     - Perform binary editing on files for advanced modifications.
     - Perform ASCII, HEX and RegExp pattern search in the file.
     - Toggle between text and hex modes as needed.
     - Save changes to apply your edits.
     - **Quick Access**: Hold the "Alt" key and click on file names or links to open files directly in the hex editor.


6. **Customizing Settings**
   - Navigate to the **Settings Tab** to personalize the application's layout and behavior.
   - Adjust parameters such as column widths, window sizes, and padding to suit your preferences.
   - Save settings to ensure they persist across sessions.

## Additional Functionalities

- **Resizable Columns and Windows**: Enhance the interface's flexibility by resizing table columns and editor windows to match your workflow. The Help window starts at **650x600** pixels and can be adjusted as needed.
- **Responsive Design**: The application adapts to different screen sizes, ensuring usability across various devices.
- **Error Handling and Notifications**: Receive immediate feedback on actions, helping you stay informed about the status of your file management tasks.
- **Line Number Toggle**: Easily show or hide line numbers in the text editor to assist with content navigation.
- **Bulk Operations**: Efficiently manage multiple files or directories through bulk actions like delete and duplicate.
- **Symlink Handling**: Navigate and manage symbolic links seamlessly within the file structure.

    `,
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
		insertCss(hexeditCssContent); // Insert hexedit CSS styles
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
		var helpContentHTML = parseMarkdown(self.helpContentMarkdown);

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
				pop(null, E('p', _('File "%s" uploaded successfully.').format(file.name)), 'info');
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
			pop(null, E('p', _('Directory "%s" created successfully.').format(trimmedDirName)), 'info');
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
			pop(null, E('p', _('File "%s" created successfully.').format(trimmedFileName)), 'info');
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
			pop(null, E('p', _('Selected files and directories deleted successfully.')), 'info');
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
					var symlinkName = file.name + ' -> ' + file.target;
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
						'data-file-type': 'unknown'
					}, [E('td', {}, file.name), E('td', {}, _('Unknown')), E('td', {
						'class': 'size-cell'
					}, [E('span', {
						'class': 'size-number'
					}, '-'), E('span', {
						'class': 'size-unit'
					}, '')]), E('td', {}, '-'), E('td', {}, '-')]);
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
	// Handler for clicking on a file to open it in the editor
	handleFileClick: function(filePath, mode = 'text') {
		var self = this;
		var fileRow = document.querySelector("tr[data-file-path='" + filePath + "']");
		var editorMessage = document.getElementById('editor-message');
		var editorContainer = document.getElementById('editor-container');

		// Set default permissions if file row is not found
		if (fileRow) {
			var permissions = fileRow.getAttribute('data-numeric-permissions');
			self.originalFilePermissions = permissions;
		} else {
			self.originalFilePermissions = '644';
		}

		// Update message to indicate loading
		if (editorMessage) {
			editorMessage.textContent = _('Loading file...');
		}

		// Execute 'cat' to read the file content
		fs.exec('cat', [filePath]).then(function(res) {
			var content = '';
			if (res.code !== 0) {
				if (res.stderr.trim() !== '') {
					return Promise.reject(new Error(res.stderr.trim()));
				}
			} else {
				content = res.stdout || '';
			}

			// Store the content as a string
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

			self.fileData = dataArray; // Store binary data as Uint8Array

			self.editorMode = mode; // Set the initial editor mode to 'text'

			// Render the editor
			self.renderEditor(filePath);

			// Switch to the editor tab
			self.switchToTab('editor');

		}).catch(function(err) {
			// Handle file read errors
			pop(null, E('p', _('Failed to open file: %s').format(err.message)), 'error');
			if (editorMessage) {
				editorMessage.textContent = _('Failed to open file: %s').format(err.message);
			}
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
		fs.read(filePath, {
			binary: true
		}).then(function(content) {
			var blob = new Blob([content], {
				type: 'application/octet-stream'
			});
			var downloadLink = document.createElement('a');
			downloadLink.href = URL.createObjectURL(blob);
			downloadLink.download = fileName;
			document.body.appendChild(downloadLink);
			downloadLink.click();
			document.body.removeChild(downloadLink);
			var statusInfo = document.getElementById('status-info');
			if (statusInfo) {
				statusInfo.textContent = _('Downloaded file: "%s".').format(fileName);
			}
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
				pop(null, E('p', _('Successfully deleted %s: "%s".').format(itemTypeLabel, itemName)), 'info');
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
				pop(null, E('p', _('Successfully duplicated %s "%s" as "%s".').format(_('item'), fileInfo.name, newName)), 'info');
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
					pop(null, E('p', _('File "%s" uploaded successfully.').format(fileName)), 'info');
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
				pop(null, E('p', _('File "%s" uploaded successfully.').format(fileName)), 'info');
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
			pop(null, E('p', _('Changes to %s "%s"uploaded successfully.').format(_('item'), newItemName)), 'info');
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
				pop(null, E('p', _('Settings uploaded successfully.')), 'info');
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
			self.hexEditorInstance = new HexEditor(hexeditContainer);

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
				E('button', {
					'class': 'btn',
					'id': 'toggle-text-mode',
					'style': 'margin-left: 10px;',
					'click': function() {
						self.toggleHexMode(filePath);
					}
				}, _('Toggle to ASCII Mode'))
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

	toggleHexMode: function(filePath) {
		var self = this;

		if (self.editorMode === 'text') {
			// Before switching to hex mode, update self.fileData from the textarea
			var textarea = document.querySelector('#editor-container textarea');
			if (textarea) {
				var content = textarea.value;
				self.fileContent = content;

				// Convert content to Uint8Array
				var encoder = new TextEncoder();
				self.fileData = encoder.encode(content);
			}
			self.editorMode = 'hex';

		} else {
			// Before switching to text mode, update self.fileData from the HexEditor
			if (self.hexEditorInstance) {
				self.fileData = self.hexEditorInstance.getData();
			}

			// Convert self.fileData to string
			var decoder = new TextDecoder();
			self.fileContent = decoder.decode(self.fileData);

			self.editorMode = 'text';
		}

		// Re-render the editor
		self.renderEditor(filePath);
	}


});
