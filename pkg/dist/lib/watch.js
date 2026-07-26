import chokidar from "chokidar";
import { pageProcessing, processAllPages, removePage, selectivelyProcessPages, } from "./processing.js";
import { generateSitemapFiles } from "./sitemap.js";
import { copyReplicatePath, deleteDistDir, deleteDistFile, } from "./file-system.js";
import { BascikConfig } from "./config.js";
import { MIME_MAP } from "./mime.js";
import { eventEmitter } from "./events.js";
export const watchFiles = () => {
    // Copy non-page files
    chokidar
        .watch([BascikConfig.directory.pages], {
        ignored: (path, stats) => {
            const hasFileExt = Array.from(MIME_MAP.keys()).some((ext) => new RegExp(`${ext}$`).test(path));
            return !!(stats?.isFile() && !hasFileExt);
        },
        persistent: !BascikConfig.isBuild,
    })
        .on("add", (path) => copyReplicatePath(path, "dist"))
        .on("change", async (path) => {
        await copyReplicatePath(path, "dist");
        // Reload any currently-open page when a static asset changes
        if (!BascikConfig.isBuild) {
            eventEmitter.emit("asset-changed");
        }
    })
        .on("unlink", (path) => deleteDistFile(path))
        .on("unlinkDir", (path) => deleteDistDir(path));
    // Transpile pages as they change
    const buildPagePromises = [];
    chokidar
        .watch([BascikConfig.directory.pages], {
        // only watch html files
        ignored: (path, stats) => !!(stats?.isFile() && !path.endsWith(".html")),
        persistent: !BascikConfig.isBuild,
    })
        .on("add", (path) => {
        const p = pageProcessing(path);
        if (BascikConfig.isBuild)
            buildPagePromises.push(p);
    })
        .on("change", (path) => pageProcessing(path))
        .on("unlink", (path, _stats) => removePage(path))
        .on("unlinkDir", (path, _stats) => deleteDistDir(path))
        .on("ready", async () => {
        if (BascikConfig.isBuild) {
            await Promise.all(buildPagePromises);
            await generateSitemapFiles();
        }
    });
    // Transpile pages if components change
    chokidar
        .watch([BascikConfig.directory.components], {
        ignored: (path, stats) => {
            return !!(stats?.isFile() && !(path.endsWith(".html") || path.endsWith(".css")));
        },
        ignoreInitial: true,
        persistent: !BascikConfig.isBuild,
    })
        // If you add a component, how will we know what pages to update unless we go and look
        .on("add", async () => processAllPages())
        // For changes and deletion of components we can be selective
        .on("change", async (path) => selectivelyProcessPages(path))
        .on("unlink", async (path) => selectivelyProcessPages(path));
    // Re-transpile all pages when user-specified extra paths change (dev only)
    if (!BascikConfig.isBuild && BascikConfig.triggerTranspile?.length) {
        chokidar
            .watch(BascikConfig.triggerTranspile, {
            ignoreInitial: true,
            persistent: true,
        })
            .on("add", async () => processAllPages())
            .on("change", async () => processAllPages())
            .on("unlink", async () => processAllPages());
    }
};
//# sourceMappingURL=watch.js.map