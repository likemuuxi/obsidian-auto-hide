import { App, MarkdownView, Plugin, TFile, TFolder, WorkspaceLeaf, debounce } from 'obsidian';
import { ForceViewModeSettings } from './settings';

type ViewModeState = {
	mode?: string;
	source?: boolean;
	[key: string]: unknown;
};

export default class ForceViewModeController {
	private openedFiles: string[] = [];
	private readonly OBSIDIAN_UI_MODE_KEY = 'obsidianUIMode';
	private readonly OBSIDIAN_EDITING_MODE_KEY = 'obsidianEditingMode';

	constructor(
		private readonly plugin: Plugin,
		private readonly getSettings: () => ForceViewModeSettings
	) {
		this.openedFiles = this.resetOpenedNotes();
	}

	registerHandlers(): void {
		const handler = async (leaf: WorkspaceLeaf | null) => {
			if (!leaf) {
				return;
			}

			await this.applyForceViewModeFromSettings(leaf);
		};

		const { debounceTimeout } = this.getSettings();
		const eventHandler = debounceTimeout === 0 ? handler : debounce(handler, debounceTimeout);

		this.plugin.registerEvent(this.plugin.app.workspace.on('active-leaf-change', eventHandler));
	}

	private get app(): App {
		return this.plugin.app;
	}

	private get settings(): ForceViewModeSettings {
		return this.getSettings();
	}

	private async applyForceViewModeFromSettings(leaf: WorkspaceLeaf) {
		const viewModeSettings = this.settings;

		if (!viewModeSettings.enabled) {
			return;
		}

		const view = leaf.view instanceof MarkdownView ? leaf.view : null;

		if (!view || !view.file) {
			if (viewModeSettings.ignoreOpenFiles) {
				this.openedFiles = this.resetOpenedNotes();
			}
			return;
		}

		if (viewModeSettings.ignoreOpenFiles && this.alreadyOpen(view.file)) {
			this.openedFiles = this.resetOpenedNotes();
			return;
		}

		let state = leaf.getViewState() as any;

		const getStateData = (targetState: any): ViewModeState => {
			if (!targetState.state) {
				targetState.state = {};
			}

			return targetState.state as ViewModeState;
		};

		let stateData = getStateData(state);

		let folderOrFileModeState: ViewModeState | null = null;

		const setFolderOrFileModeState = (viewMode: string): void => {
			const [key, mode] = viewMode.split(':').map((s) => s.trim());

			if (key === 'default') {
				folderOrFileModeState = null;
				return;
			} else if (!['live', 'preview', 'source'].includes(mode)) {
				return;
			}

			folderOrFileModeState = { ...stateData };

			if (!folderOrFileModeState) {
				return;
			}

			folderOrFileModeState.mode = mode;

			switch (key) {
				case this.OBSIDIAN_EDITING_MODE_KEY: {
					if (mode === 'live') {
						folderOrFileModeState.source = false;
						folderOrFileModeState.mode = 'source';
					} else {
						folderOrFileModeState.source = true;
					}
					break;
				}
				case this.OBSIDIAN_UI_MODE_KEY:
					folderOrFileModeState.source = false;
					break;
			}
		};

		const fileCache = this.app.metadataCache.getFileCache(view.file);
		const frontmatter = fileCache?.frontmatter ?? null;

		for (const folderMode of viewModeSettings.folders) {
			if (folderMode.folder !== '' && folderMode.viewMode) {
				const folder = this.app.vault.getAbstractFileByPath(folderMode.folder);
				const parent = view.file.parent;
				if (folder instanceof TFolder && parent) {
					if (parent === folder || parent.path.startsWith(folder.path)) {
						setFolderOrFileModeState(folderMode.viewMode);
					}
				} else if (folderMode.folder) {
					console.warn(`ForceViewMode: Folder ${folderMode.folder} does not exist or is not a folder.`);
				}
			}
		}

		for (const { filePattern, viewMode } of viewModeSettings.files) {
			if (!filePattern || !viewMode) {
				continue;
			}

			if (!view.file.basename.match(filePattern)) {
				continue;
			}

			setFolderOrFileModeState(viewMode);
		}

		if (frontmatter) {
			for (const propertyRule of viewModeSettings.frontmatterProperties) {
				if (!propertyRule.property || !propertyRule.viewMode) {
					continue;
				}

				const frontmatterValue = frontmatter[propertyRule.property];

				if (frontmatterValue === undefined) {
					continue;
				}

				if (propertyRule.value && String(frontmatterValue) !== propertyRule.value) {
					continue;
				}

				setFolderOrFileModeState(propertyRule.viewMode);
			}
		}

		const suffixTargets: string[] = [];
		const pushTarget = (value: string | undefined) => {
			if (value) {
				suffixTargets.push(value);
			}
		};

		pushTarget(view.file.path);
		pushTarget(view.file.name);
		pushTarget(view.file.basename);

		const linkTargets = [
			...(fileCache?.links ?? []),
			...(fileCache?.embeds ?? [])
		].map((link) => link.link);

		linkTargets.forEach((link) => pushTarget(link));

		for (const suffixRule of viewModeSettings.linkSuffixes) {
			const suffix = suffixRule.suffix?.trim();
			if (!suffix || !suffixRule.viewMode) {
				continue;
			}

			const suffixLower = suffix.toLowerCase();
			const matchesSuffix = (value: string) => value.toLowerCase().endsWith(suffixLower);

			if (suffixTargets.some((target) => matchesSuffix(target))) {
				setFolderOrFileModeState(suffixRule.viewMode);
			}
		}

		if (folderOrFileModeState) {
			const forcedState = folderOrFileModeState as ViewModeState;
			if (stateData.mode !== forcedState.mode || stateData.source !== forcedState.source) {
				stateData.mode = forcedState.mode;
				stateData.source = forcedState.source;

				await leaf.setViewState(state);
			}

			return;
		}

		const fileDeclaredUIMode = frontmatter?.[this.OBSIDIAN_UI_MODE_KEY] ?? null;
		const fileDeclaredEditingMode = frontmatter?.[this.OBSIDIAN_EDITING_MODE_KEY] ?? null;

		if (fileDeclaredUIMode) {
			if (['source', 'preview', 'live'].includes(fileDeclaredUIMode) && view.getMode() !== fileDeclaredUIMode) {
				stateData.mode = fileDeclaredUIMode;
			}
		}

		if (fileDeclaredEditingMode) {
			const shouldBeSourceMode = fileDeclaredEditingMode == 'source';
			if (['source', 'live'].includes(fileDeclaredEditingMode)) {
				stateData.source = shouldBeSourceMode;
			}
		}

		if (fileDeclaredUIMode || fileDeclaredEditingMode) {
			await leaf.setViewState(state);

			if (viewModeSettings.ignoreOpenFiles) {
				this.openedFiles = this.resetOpenedNotes();
			}

			return;
		}

		const vaultConfig = (this.app.vault as any).config ?? {};
		const defaultViewMode = vaultConfig.defaultViewMode ? vaultConfig.defaultViewMode : 'source';
		const defaultEditingModeIsLivePreview = vaultConfig.livePreview === undefined ? true : vaultConfig.livePreview;

		if (!viewModeSettings.ignoreForceViewAll) {
			state = leaf.getViewState() as any;
			stateData = getStateData(state);

			if (view.getMode() !== defaultViewMode) {
				stateData.mode = defaultViewMode;
			}

			stateData.source = defaultEditingModeIsLivePreview ? false : true;

			await leaf.setViewState(state);

			this.openedFiles = this.resetOpenedNotes();
		}
	}

	private alreadyOpen(currFile: TFile | null): boolean {
		if (!currFile) {
			return false;
		}

		return this.openedFiles.some((openedFile) => openedFile === currFile.basename);
	}

	private resetOpenedNotes(): string[] {
		const openedFiles: string[] = [];

		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view instanceof MarkdownView ? leaf.view : null;

			if (!view || !view.file) {
				return;
			}

			openedFiles.push(view.file.basename);
		});

		return openedFiles;
	}
}
