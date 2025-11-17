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
}

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
	restoreVaultActionsSettings: true
};
