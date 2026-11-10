import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { patchExplorerFolderNotes } from "./quartz/explorer-folder-notes"

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()

// Patch the configured Explorer instance without modifying the installed npm package.
patchExplorerFolderNotes(layout)
