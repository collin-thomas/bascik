/**
 * @module javascript
 *
 * Component Attribute & Script Scoping
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `prefixElementAttribute` is the core scoping transform.  It is called once
 * per attribute type (id / name / class) per component instance, using the
 * same `instanceId` for id and name so that HTML and JS stay in sync.
 *
 * Class attributes intentionally use the component NAME as their scope key
 * (not the instanceId).  This means every instance of the same component on
 * a page shares identical scoped class names, which lets `deduplicateCss`
 * emit a single `<style>` block regardless of how many times the component
 * is used.  IDs and names still use the instanceId to guarantee unique DOM
 * identifiers across multiple instances.
 *
 * For EACH value of the targeted attribute in the component template:
 *
 *   id / name  → bascik__<name>__<instanceId>__<original>
 *   class      → bascik__<name>__<original>          (no instanceId)
 *
 * HTML pass  — rewrites every matching attribute value in the template HTML.
 *
 * JS pass    — rewrites DOM selector references in every <script> block:
 *
 *   id attribute:
 *     getElementById("x")        →  getElementById("bascik__...__x")
 *     querySelector("#x")        →  querySelector("#bascik__...__x")
 *     querySelectorAll("#x")     →  querySelectorAll("#bascik__...__x")
 *     querySelector("#x .child") →  querySelector("#bascik__...__x .child")
 *     closest("#x")              →  closest("#bascik__...__x")
 *     matches("#x")              →  matches("#bascik__...__x")
 *     setAttribute("id","x")     →  setAttribute("id","bascik__...__x")
 *
 *   name attribute:
 *     getElementsByName("x")     →  getElementsByName("bascik__...__x")
 *
 *   class attribute:
 *     getElementsByClassName("x") → getElementsByClassName("bascik__...__x")
 *     querySelector(".x")        →  querySelector(".bascik__...__x")
 *     querySelectorAll(".x")     →  querySelectorAll(".bascik__...__x")
 *     querySelector(".x .y")     →  querySelector(".bascik__...__x .bascik__...__y")
 *     closest(".x")              →  closest(".bascik__...__x")
 *     matches(".x")              →  matches(".bascik__...__x")
 *     classList.add("x")         →  classList.add("bascik__...__x")
 *     classList.remove("x")      →  classList.remove("bascik__...__x")
 *     classList.toggle("x")      →  classList.toggle("bascik__...__x")
 *     classList.contains("x")    →  classList.contains("bascik__...__x")
 *     setAttribute("class","x")  →  setAttribute("class","bascik__...__x")
 *     el.className = "x"         →  el.className = "bascik__...__x"
 *     el.className = "x y"       →  el.className = "bascik__...__x bascik__...__y"
 *     el.className += " x"       →  el.className += " bascik__...__x"
 *
 * CSS pass  (class attribute only) — rewrites the component's .css file AND
 * any inline <style> tags in the HTML:
 *   .className       →  .bascik__...__className      (class prefixing)
 *   p { }            →  .bascik__...__el__p { }       (element → class)
 *   @keyframes name  →  @keyframes bascik__...__keyframe__name
 *   animation: name  →  animation: bascik__...__keyframe__name
 *   @layer name      →  @layer bascik__...__layer__name
 *   container-name:  →  container-name: bascik__...__container__name
 *   --var-name:      →  --bascik__...__var-name:      (custom properties)
 *   var(--var-name)  →  var(--bascik__...__var-name)
 *   [id] { }         →  (stripped — cannot be scoped without DOM wrapping)
 *
 * `namespaceScriptTags` wraps every `text/javascript` script in an IIFE so
 * that variables declared inside one component cannot leak into another.
 */
import type { BascikComponent } from "./types.js";
export declare const prefixElementAttribute: (component: BascikComponent, attribute: "id" | "name" | "class", componentInstanceId?: string | null, deduplicateCss?: boolean, skipElementContents?: string[]) => BascikComponent;
export declare const namespaceScriptTags: (component: BascikComponent) => BascikComponent;
