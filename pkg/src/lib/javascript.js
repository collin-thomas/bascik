import { getUniqueId, obfuscateAttributeName } from "./names.js";
import { addElementClassesInHtml, convertCssElementSelectorsToClasses, prefixKeyframes, removeIdSelectors } from "./styles.js";

export const prefixElementAttribute = (component, attribute) => {
  // All class/name/id attrs will get this ID. 
  const componentInstanceId = getUniqueId(8)
  const componentInstanceName = `${component.name}__${componentInstanceId}`
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
        const name = `bascik__${componentInstanceName}__${attributeName}`
        const obfuscatedAttributeName = obfuscateAttributeName(name)
        attributesToReplace.push({ attributeName, obfuscatedAttributeName })
        return obfuscatedAttributeName
      })
      .join(" ");
  });

  // JavaScript
  const htmlWithObfuscatedAttributesAndScripts = htmlWithObfuscatedAttributes.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match) => {
    let updatedMatch = match
    attributesToReplace.forEach(({ attributeName, obfuscatedAttributeName }) => {
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
      return obfuscateAttributeName(`bascik__${componentInstanceName}__${className}`)
    })

    const { css: elSelectorToClassCss, elementsConvertedClasses } = convertCssElementSelectorsToClasses(component.cssFileContent, componentInstanceName)
    component.cssFileContent = elSelectorToClassCss
    component.fileContent = addElementClassesInHtml(component.fileContent, componentInstanceName, elementsConvertedClasses)

    component.cssFileContent = prefixKeyframes(component.cssFileContent, componentInstanceName)

    component.cssFileContent = removeIdSelectors(component.cssFileContent)
  }
  // Need to support css attribute selectors
  // name=["my-name"]
  // id=["my-id"]
  // class=["my-class"]



  return component
};

export const namespaceScriptTags = (component) => {
  // Only wrap <script> tags with no type or type="text/javascript"
  component.fileContent = component.fileContent.replace(
    /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (match, open, code, close) => {
      // Check for type attribute
      const typeMatch = open.match(/type\s*=\s*["']?([^"'>\s]+)["']?/i);
      if (typeMatch && typeMatch[1].toLowerCase() !== "text/javascript") {
        // If type is present and not text/javascript, leave unchanged
        return match;
      }
      // Otherwise, wrap in IIFE
      return `${open}
        (function() {
          ${code}
        })();
        ${close}`;
    }
  );
  return component
}
