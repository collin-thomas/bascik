import { getUniqueId, obfuscateAttributeName } from "./names.js";

export const prefixElementAttribute = (html, componentName, attribute) => {
  const nameAttributeInstanceId = getUniqueId(8)
  const attributesToReplace = []
  // The space is before ${attribute} is important, 
  // this prevents matching on `data-id` and `id` instead of just `id`
  const regexp = new RegExp(`(?<= ${attribute}=").+?(?=")`, 'gm')
  const htmlWithObfuscatedAttributes = html.replace(regexp, (match) => {
    return match
      .replace(/  +/g, " ")
      .split(" ")
      .map((attributeName) => {
        // Each `id` attr gets a unique ID within the instance of a component, 
        // whereas each `name` attr gets the same id per instance. 
        // This is because the `id` attr must be not be repeated, but a `name` can be,
        // However you want to scope each instance of a component, 
        // so the `name` attr gets a unique id, but it's shared within the component instance
        const name = `bascik__${componentName}__${attributeName}__${attribute === 'id' ? getUniqueId(8) : nameAttributeInstanceId}`
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
