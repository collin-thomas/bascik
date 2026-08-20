export const getHttpPath = (pagePath: string): string => {
  let normalized = pagePath.replace(/\\/g, "/");

  // Strip leading path segments up to pages/ or src/pages/ if present
  if (normalized.includes("/pages/")) {
    normalized = normalized.slice(normalized.lastIndexOf("/pages/") + 1);
  } else if (normalized.includes("/src/pages/")) {
    normalized = "pages/" + normalized.slice(normalized.lastIndexOf("/src/pages/") + 11);
  } else if (normalized.startsWith("src/pages/")) {
    normalized = "pages/" + normalized.slice(10);
  } else if (!normalized.startsWith("pages/")) {
    normalized = "pages/" + normalized.replace(/^\/+/, "");
  }

  const route = normalized
    .replace(/^pages/, "")
    .replace(/\.html$/, "")
    .replace(/\/index$/, "/");

  return route.startsWith("/") ? route : `/${route}`;
};
