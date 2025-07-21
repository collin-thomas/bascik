export const getHttpPath = (pagePath) => {
  return pagePath
    // Remove pages dir
    .replace(/^pages/, '')
    // Remove file ext
    .replace(/\.html$/, '')
    // If an index, remove file name, keep the slash for dir roots
    .replace(/\/index$/, '/')
}