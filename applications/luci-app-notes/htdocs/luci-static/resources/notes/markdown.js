'use strict';

'require baseclass';

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function inlineMarkdown(value) {
	let s = escapeHtml(value).replace(/\x00/g, '&#xfffd;');
	const stash = [];

	// Process escapes and code spans in source order so that
	// backslashes inside code spans remain literal.
	s = s.replace(/\\([\\`*_{}\[\]()#+.!>~-])|`([^`]+)`/g, (match, ch, text) => {
		stash.push(ch !== undefined
			? escapeHtml(ch)
			: '<code>' + text + '</code>');

		return '\x00' + (stash.length - 1) + '\x00';
	});

	// Avoid emphasis inside words or around whitespace.
	s = s.replace(/\*\*(?=[^\s*])([^*]*[^\s*])\*\*/g, '<strong>$1</strong>');
	s = s.replace(/(^|\W)__(?=\S)([^_]*\S)__(?!\w)/g, '$1<strong>$2</strong>');
	s = s.replace(/\*(?=\S)([^*]*\S)\*/g, '<em>$1</em>');
	s = s.replace(/(^|\W)_(?=\S)([^_]*\S)_(?!\w)/g, '$1<em>$2</em>');

	return s.replace(/\x00(\d+)\x00/g, (match, i) => stash[i]);
}

function renderMarkdownImpl(markdown) {
	const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
	const output = [];

	let inCode = false;
	let codeLines = [];
	let listType = null;

	function closeList() {
		if (listType) {
			output.push(`</${listType}>`);
			listType = null;
		}
	}

	function closeCode() {
		if (inCode) {
			output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
			codeLines = [];
			inCode = false;
		}
	}

	for (const line of lines) {
		// Fenced code block
		if (/^```/.test(line)) {
			if (inCode)
				closeCode();
			else {
				closeList();
				inCode = true;
			}

			continue;
		}

		if (inCode) {
			codeLines.push(line);
			continue;
		}

		// Blank line
		if (!line.trim()) {
			closeList();
			continue;
		}

		// Horizontal rule
		if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
			closeList();
			output.push('<hr>');
			continue;
		}

		// Headings
		const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);

		if (heading) {
			closeList();

			const level = heading[1].length;
			output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
			continue;
		}

		// Blockquote
		const quote = line.match(/^\s*>\s?(.*)$/);

		if (quote) {
			closeList();
			output.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
			continue;
		}

		// Unordered list
		const unordered = line.match(/^\s*[-*+]\s+(.+)$/);

		if (unordered) {
			if (listType !== 'ul') {
				closeList();
				output.push('<ul>');
				listType = 'ul';
			}

			output.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
			continue;
		}

		// Ordered list
		const ordered = line.match(/^\s*\d+\.\s+(.+)$/);

		if (ordered) {
			if (listType !== 'ol') {
				closeList();
				output.push('<ol>');
				listType = 'ol';
			}

			output.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
			continue;
		}

		// Normal paragraph. Leading whitespace is snapped to indent
		// "levels" (2 spaces = 1 level) and rendered as margin-left in
		// em, matching the 2em padding-left used for lists in notes.css,
		// so continuation text lines up exactly under a list item.
		closeList();

		const indentMatch = line.match(/^([ \t]*)(.*)$/);
		const indentChars = indentMatch[1].replace(/\t/g, '  ').length;
		const level = Math.round(indentChars / 2);
		const text = indentMatch[2];

		if (level > 0)
			output.push(`<p style="margin-left: ${level * 2}em">${inlineMarkdown(text)}</p>`);
		else
			output.push(`<p>${inlineMarkdown(text)}</p>`);
	}

	closeCode();
	closeList();

	return output.join('\n');
}

return baseclass.extend({
	renderMarkdown: function(markdown) {
		return renderMarkdownImpl(markdown);
	}
});
