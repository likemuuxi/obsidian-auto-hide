import { Editor, Notice } from 'obsidian';

export function cleanMarkdownFormatting(editor: Editor): void {
	const selection = editor.getSelection();
	
	if (!selection || selection.trim() === '') {
		new Notice('请先选择要清理的文本');
		return;
	}
	
	let cleanedText = selection
		.replace(/\*\*(.*?)\*\*/g, '$1')
		.replace(/\*(.*?)\*/g, '$1')
		.replace(/_(.*?)_/g, '$1')
		.replace(/~~(.*?)~~/g, '$1')
		.replace(/==(.*?)==/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
		.replace(/^#+\s+(.*)$/gm, '$1')
		.replace(/^>\s+(.*)$/gm, '$1')
		.replace(/- \[[x ]\]\s+(.*)$/gim, '- $1')
		.replace(/^[*+-]\s+(.*)$/gm, '$1')
		.replace(/^\d+\.\s+(.*)$/gm, '$1');
	
	editor.replaceSelection(cleanedText);
	new Notice('已清理选中文本的Markdown标记');
}

export function demoteHeadings(editor: Editor): void {
	const selection = editor.getSelection();

	if (!selection || selection.trim() === '') {
		new Notice('请先选择要降级标题的文本');
		return;
	}

	const processedText = selection.replace(/^( *)(#{1,6})(\s)/gm, (match, indent, hashes, space) => {
		if (hashes.length >= 6) return match; // h6 不再降级
		return indent + '#' + hashes + space;
	});

	editor.replaceSelection(processedText);
	new Notice('已将选中文本的所有标题降级');
}

export function promoteHeadings(editor: Editor): void {
	const selection = editor.getSelection();

	if (!selection || selection.trim() === '') {
		new Notice('请先选择要升级标题的文本');
		return;
	}

	const processedText = selection.replace(/^( *)(#{2,6})(\s)/gm, (match, indent, hashes, space) => {
		return indent + hashes.slice(1) + space;
	});

	editor.replaceSelection(processedText);
	new Notice('已将选中文本的所有标题升级');
}
