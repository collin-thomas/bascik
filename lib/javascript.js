import { getUniqueId, obfuscateAttributeName } from "./names.js";

export const prefixElementAttribute = (html, componentName, attribute) => {
  const attributesToReplace = []
  // The space is before ${attribute} is important, 
  // this prevents matching on `data-id` and `id` instead of just `id`
  const regexp = new RegExp(`(?<= ${attribute}=").+?(?=")`, 'gm')
  const htmlWithObfuscatedAttributes = html.replace(regexp, (match) => {
    return match
      .replace(/  +/g, " ")
      .split(" ")
      .map((attributeName) => {
        const name = `bascik__${componentName}__${attributeName}${attribute === 'id' ? `__${getUniqueId(8)}` : ''}`
        const obfuscatedAttributeName = obfuscateAttributeName(name)
        attributesToReplace.push({attributeName, obfuscatedAttributeName})
        return obfuscatedAttributeName
      })
      .join(" ");
  });
  
  const jsMethod = (()=>{
    switch (attribute) {
      case 'id':
        return 'getElementById'
      case 'name':
        return 'getElementsByName'
    }
  })()
  
  const htmlWithObfuscatedAttributesAndScripts = htmlWithObfuscatedAttributes.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match) => {
    let updatedMatch = match
    attributesToReplace.forEach(({attributeName, obfuscatedAttributeName}) => {
      // https://www.codemzy.com/blog/regex-groups-with-replace
      const attributeRegexp = new RegExp(`(?<start>${jsMethod}\\(["'])(?<middle>${attributeName})(?<end>["']\\))`, 'gm')
      updatedMatch = updatedMatch.replace(attributeRegexp, (match, start, middle, end) => {
        return `${start}${obfuscatedAttributeName}${end}`
      })
    })
    return updatedMatch
  })
  
  return htmlWithObfuscatedAttributesAndScripts
};
