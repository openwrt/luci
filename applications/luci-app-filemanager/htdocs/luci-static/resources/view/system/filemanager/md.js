
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

return L.Class.extend({
	parseMarkdown: parseMarkdown,
});