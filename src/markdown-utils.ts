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
