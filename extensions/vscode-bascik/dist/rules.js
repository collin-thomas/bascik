"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchCompatibilityRules = matchCompatibilityRules;
const compatibility_rules_json_1 = __importDefault(require("./compatibility-rules.json"));
const compatibilityRules = compatibility_rules_json_1.default.map((rule) => ({
    ...rule,
    regex: new RegExp(rule.pattern, rule.flags ?? ''),
}));
function matchCompatibilityRules(text, kind) {
    return compatibilityRules.filter((rule) => {
        if (rule.kind !== kind) {
            return false;
        }
        const regex = new RegExp(rule.regex.source, rule.regex.flags);
        return regex.test(text);
    });
}
