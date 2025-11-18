export interface ForceViewModeFolderSetting {
	folder: string;
	viewMode: string;
}

export interface ForceViewModeFileSetting {
	filePattern: string;
	viewMode: string;
}

export interface ForceViewModeFrontmatterSetting {
	property: string;
	value: string;
	viewMode: string;
}

export interface ForceViewModeLinkSuffixSetting {
	suffix: string;
	viewMode: string;
}

export interface ForceViewModeSettings {
	enabled: boolean;
	debounceTimeout: number;
	ignoreOpenFiles: boolean;
	ignoreForceViewAll: boolean;
	folders: ForceViewModeFolderSetting[];
	files: ForceViewModeFileSetting[];
	frontmatterProperties: ForceViewModeFrontmatterSetting[];
	linkSuffixes: ForceViewModeLinkSuffixSetting[];
}

export interface AutoHideSettings {
	expandSidebar_onClickRibbon: boolean;
	expandSidebar_onClickNoteTitle: boolean;
	lockSidebar: boolean;
	leftPinActive: boolean;
	rightPinActive: boolean;
	homepagePath: string;
	homepageLink: string;
	collapseSidebar_onClickDataType: boolean;
	customDataTypes: string[];
	restoreVaultSwitcher: boolean;
	restoreVaultActionsHelp: boolean;
	restoreVaultActionsSettings: boolean;
	forceViewMode: ForceViewModeSettings;
}

export const DEFAULT_FORCE_VIEW_MODE_SETTINGS: ForceViewModeSettings = {
	enabled: false,
	debounceTimeout: 300,
	ignoreOpenFiles: false,
	ignoreForceViewAll: false,
	folders: [{ folder: "", viewMode: "" }],
	files: [{ filePattern: "", viewMode: "" }],
	frontmatterProperties: [{ property: "", value: "", viewMode: "" }],
	linkSuffixes: [{ suffix: "", viewMode: "" }]
};

export const DEFAULT_SETTINGS: AutoHideSettings = {
	expandSidebar_onClickRibbon: true,
	expandSidebar_onClickNoteTitle: false,
	lockSidebar: false,
	leftPinActive: false,
	rightPinActive: false,
	homepagePath: "",
	homepageLink: "",
	collapseSidebar_onClickDataType: true,
	customDataTypes: ["webviewer", "surfing-view", "canvas", "excalidraw", "mindmapview", "excel-view", "vscode-editor", "code-editor"],
	restoreVaultSwitcher: true,
	restoreVaultActionsHelp: true,
	restoreVaultActionsSettings: true,
	forceViewMode: DEFAULT_FORCE_VIEW_MODE_SETTINGS
};
