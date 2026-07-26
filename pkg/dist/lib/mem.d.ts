import type { StoredPage } from "./types.js";
interface StorePageArgs {
    relativePagePath: string;
    absolutePagePath: string;
    pageContent: string;
    usedComponentsNames?: string[];
}
declare class MemoryStore {
    #private;
    constructor();
    storePage({ relativePagePath, absolutePagePath, pageContent, usedComponentsNames, }: StorePageArgs): void;
    getPage(httpPath: string): StoredPage | undefined;
    removePage(absolutePagePath: string): void;
    pagesThisComponentIsUsedOn(componentName: string): string[];
}
export declare const mem: MemoryStore;
export {};
