import { getUniqueId, obfuscateAttributeName } from "./names.js";

export const prefixElementAttribute = (component, attribute) => {
  // All class/name/id attrs will get this ID. 
  const componentInstanceId = getUniqueId(8)
  const attributesToReplace = []
  // The space is before ${attribute} is important, 
  // this prevents matching on `data-id` and `id` instead of just `id`
  const regexp = new RegExp(`(?<= ${attribute}=").+?(?=")`, 'gm')
  const htmlWithObfuscatedAttributes = component.fileContent.replace(regexp, (match) => {
    return match
      .replace(/  +/g, " ")
      .split(" ")
      .map((attributeName) => {
        // Each instance of a component's attribute that gets target, class/name/id will get an id
        const name = `bascik__${component.name}__${componentInstanceId}__${attributeName}`
        const obfuscatedAttributeName = obfuscateAttributeName(name)
        attributesToReplace.push({attributeName, obfuscatedAttributeName})
        return obfuscatedAttributeName
      })
      .join(" ");
  });
  


  // JavaScript
  const htmlWithObfuscatedAttributesAndScripts = htmlWithObfuscatedAttributes.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match) => {
    let updatedMatch = match
    attributesToReplace.forEach(({attributeName, obfuscatedAttributeName}) => {
      const replacerFunction = (regexp, dot = '') => {
        // https://www.codemzy.com/blog/regex-groups-with-replace
        return updatedMatch.replace(regexp, (match, start, middle, end) => {
          return `${start}${dot}${obfuscatedAttributeName}${end}`
        })
      }

      if (attribute === 'id') {
        updatedMatch = replacerFunction(new RegExp(`(?<start>getElementById\\(["'])(?<middle>${attributeName})(?<end>["']\\))`, 'gm'))
      } 
      else if (attribute === 'name') {
        updatedMatch = replacerFunction(new RegExp(`(?<start>getElementsByName\\(["'])(?<middle>${attributeName})(?<end>["']\\))`, 'gm'))
      }
      else if (attribute === 'class') {
        // querySelector and querySelectorAll require `.` in front of the class name (attributeName)
        // So we need to figure out a solution for the way we wrote the regexp code down below with jsMethod
        // It's a little challenging because we want to handle these separately.
        // 'querySelector|querySelectorAll|getElementsByClassName'        
        updatedMatch = replacerFunction(new RegExp(`(?<start>getElementsByClassName\\(["'])(?<middle>${attributeName})(?<end>["']\\))`, 'gm'))
        // It's going to be really hard to cover all these cases
        // https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
        // https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll
        updatedMatch = replacerFunction(new RegExp(`(?<start>querySelector\\(["'])(?<middle>\\.${attributeName})(?<end>["']\\))`, 'gm'), '.')
        updatedMatch = replacerFunction(new RegExp(`(?<start>querySelectorAll\\(["'])(?<middle>\\.${attributeName})(?<end>["']\\))`, 'gm'), '.')
      }
    })
    return updatedMatch
  })
  component.fileContent = htmlWithObfuscatedAttributesAndScripts


  // CSS
  if (attribute === 'class' && component.cssFileContent) {
    // Handle basic replacement of classnames in css file
    component.cssFileContent = component.cssFileContent.replace(/(?<=\.)[a-z0-9-_]+/gim, (className) => {
     return `bascik__${component.name}__${componentInstanceId}__${className}`
    })
  }
  // Need to support css attribute selectors
  // name=["my-name"]
  // id=["my-id"]
  // class=["my-class"]
 
  
 
  return component
};

export const namespaceScriptTags = (component) => {
   // Finally wrap the script tag in an iife to make all the variables
  // a developer might define private and not in the global scope
  component.fileContent = component.fileContent.replace(
    /(?<open><script\b[^>]*>)(?<code>[\s\S]*?)(?<close><\/script>)/gi, 
    (match, open, code, close) => {
      return `${open}
        (function() {
          ${code}
        })();
        ${close}`
    })
  
  return component
}
