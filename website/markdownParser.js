/**
 * @license Apache License 2.0
 * @file orch/website/markdownParser.js
 * @title Markdown Parser
 * @description Parses .md content for docs generation.
 * @version 1.0.0
 */

export function parseMarkdown(text = '') {
    if (!text) return '';

    // Optional: escape HTML (uncomment to sanitize)
    // text = text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    const lines = text.split('\n');
    const output = [];
    let inList = false;

    for (let line of lines) {
        if (/^### /.test(line)) {
            output.push(`<h3>${line.slice(4).trim()}</h3>`);
        } else if (/^## /.test(line)) {
            output.push(`<h2>${line.slice(3).trim()}</h2>`);
        } else if (/^# /.test(line)) {
            output.push(`<h1>${line.slice(2).trim()}</h1>`);
        } else if (/^> /.test(line)) {
            output.push(`<blockquote>${line.slice(2).trim()}</blockquote>`);
        } else if (/^- /.test(line)) {
            if (!inList) {
                inList = true;
                output.push('<ul>');
            }
            output.push(`<li>${line.slice(2).trim()}</li>`);
        } else if (line.trim() === '') {
            if (inList) {
                inList = false;
                output.push('</ul>');
            }
            output.push('');
        } else {
            output.push(`<p>${line.trim()}</p>`);
        }
    }

    if (inList) output.push('</ul>');

    return output
        .join('\n')
        .replace(/\*\*(.+?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/gim, '<em>$1</em>')
        .replace(/`(.+?)`/gim, '<code>$1</code>')
        .replace(
            /\[(.+?)\]\((.+?)\)/gim,
            '<a href="$2" target="_blank">$1</a>'
        );
}
