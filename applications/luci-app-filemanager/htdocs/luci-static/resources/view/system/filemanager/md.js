
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
	const lines = markdown.split('\n');
	const html = [];

	// Stack of open lists: [{ type: "ul"|"ol", indent: number }]
	const listStack = [];

	function closeListsToIndent(indent) {
		while (listStack.length > 0 && listStack[listStack.length - 1].indent >= indent) {
			const last = listStack.pop();
			html.push(`</${last.type}>`);
		}
	}

	function openList(type, indent, startNumber = null) {
		listStack.push({ type, indent });
		if (type === "ol" && startNumber != null && startNumber !== 1)
			html.push(`<ol start="${startNumber}">`);
		else
			html.push(`<${type}>`);
	}

	lines.forEach(line => {
		// Detect indentation level (2 spaces = one indent)
		const indentSpaces = line.match(/^ */)[0].length;
		const indent = Math.floor(indentSpaces / 2);

		const trimmed = line.trim();
		if (trimmed === "") {
			// Close all lists for blank lines, do NOT output <p>
			closeListsToIndent(0);
			return;
		}

		// --------
		// Headings
		// --------
		if (/^###\s+/.test(trimmed)) {
			closeListsToIndent(0);
			html.push(`<h3>${escapeHtml(trimmed.replace(/^###\s+/, ''))}</h3>`);
			return;
		}
		if (/^##\s+/.test(trimmed)) {
			closeListsToIndent(0);
			html.push(`<h2>${escapeHtml(trimmed.replace(/^##\s+/, ''))}</h2>`);
			return;
		}
		if (/^#\s+/.test(trimmed)) {
			closeListsToIndent(0);
			html.push(`<h1>${escapeHtml(trimmed.replace(/^#\s+/, ''))}</h1>`);
			return;
		}

		// ------------------------
		// Ordered lists: "N. text"
		// ------------------------
		let mOrdered = trimmed.match(/^(\d+)\.\s+(.*)/);
		if (mOrdered) {
			const num = parseInt(mOrdered[1], 10);
			const content = mOrdered[2];

			const last = listStack[listStack.length - 1];

			if (!last || last.indent < indent || last.type !== "ol") {
				// NEW ordered list
				closeListsToIndent(indent);
				openList("ol", indent, num);
			}
			// ELSE: same indent, same list → continue existing OL without closing/opening

			html.push(`<li>${parseInlineMarkdown(escapeHtml(content))}</li>`);
			return;
		}

		// -------------------------------------
		// Unordered lists: "- text" or "* text"
		// -------------------------------------
		let mUnordered = trimmed.match(/^[-*]\s+(.*)/);
		if (mUnordered) {
			const content = mUnordered[1];
			const last = listStack[listStack.length - 1];

			if (!last || last.indent < indent || last.type !== "ul") {
				closeListsToIndent(indent);
				openList("ul", indent);
			}

			html.push(`<li>${parseInlineMarkdown(escapeHtml(content))}</li>`);
			return;
		}

		// ---------
		// Paragraph
		// ---------
		closeListsToIndent(0);
		html.push(`<p>${parseInlineMarkdown(escapeHtml(trimmed))}</p>`);
	});

	// Close all remaining lists
	closeListsToIndent(0);

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