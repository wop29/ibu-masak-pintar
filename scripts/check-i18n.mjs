#!/usr/bin/env node
/**
 * Fails the build when interface text in src/routes or src/components/racik
 * bypasses t(). Recipe content (titles, ingredients, steps) is data and never
 * appears as a literal here; legal pages stay Indonesian by decision.
 *
 * Flags:
 *  - JSX text with 3+ consecutive letters;
 *  - string or template literals with 3+ letters inside a JSX child expression
 *    ({ok ? "Simpan" : "Hapus"});
 *  - string or template literals with 3+ letters given to a user-visible prop
 *    (aria-label, title, placeholder, alt, label, message, actionLabel), as a
 *    JSX attribute or an object property.
 *
 * A line ending in `// i18n-ok` (or containing `i18n-ok` in a JSX comment on
 * that line) is allowed: brand names and deliberate cases only.
 *
 * Usage: node scripts/check-i18n.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["src/routes", "src/components/racik"];
const SKIP = new Set(["privasi.tsx", "syarat.tsx", "LegalPage.tsx"]);
const PROPS = new Set(["aria-label", "title", "subtitle", "placeholder", "alt", "label", "message", "actionLabel", "confirmLabel", "cancelLabel", "headline", "body", "cta", "hint", "description"]);
const WORD = /[A-Za-zÀ-ÿ]{3,}/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx") && !SKIP.has(name)) out.push(p);
  }
  return out;
}

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" ");
  return null;
}

/** True when the node sits inside the arguments of a call to t()/translate(). */
function insideT(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText();
      if (callee === "t" || callee === "translate" || callee.endsWith(".t")) return true;
    }
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isSourceFile(n)) return false;
  }
  return false;
}

/** Inside a route's head() (SEO meta) — stays Indonesian, not interface text. */
function insideHead(node) {
  for (let n = node.parent; n; n = n.parent) {
    if ((ts.isPropertyAssignment(n) || ts.isMethodDeclaration(n)) && n.name && n.name.getText() === "head") return true;
  }
  return false;
}

/** A literal that is (part of) a JSX child expression, not an attribute value or a call argument. */
/** Climb through parentheses, conditional branches and `&&`/`||`/`??` right sides: the place the value lands. */
function landing(node) {
  let child = node;
  let n = node.parent;
  for (;;) {
    if (n && ts.isParenthesizedExpression(n)) { child = n; n = n.parent; continue; }
    if (n && ts.isConditionalExpression(n) && (n.whenTrue === child || n.whenFalse === child)) { child = n; n = n.parent; continue; }
    if (n && ts.isBinaryExpression(n) && n.right === child && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) { child = n; n = n.parent; continue; }
    break;
  }
  return { child, n };
}

const problems = [];
for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const report = (node, text) => {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
      if (/i18n-ok/.test(lines[line] ?? "")) return;
      problems.push(`${relative(ROOT, file)}:${line + 1}: ${JSON.stringify(text.trim().slice(0, 70))}`);
    };
    const visit = (node) => {
      if (ts.isJsxText(node)) {
        if (WORD.test(node.text)) report(node, node.text);
      } else {
        const text = literalText(node);
        if (text != null && WORD.test(text) && !insideT(node) && !insideHead(node)) {
          const { child, n: p } = landing(node);
          const propName = (x) => x.name.getText().replace(/["']/g, "");
          if (p && ts.isJsxExpression(p) && p.expression === child && p.parent && !ts.isJsxAttribute(p.parent)) report(node, text);
          else if (p && ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent) && PROPS.has(propName(p.parent))) report(node, text);
          else if (p && ts.isJsxAttribute(p) && PROPS.has(propName(p))) report(node, text);
          else if (p && ts.isPropertyAssignment(p) && p.initializer === child && PROPS.has(propName(p))) report(node, text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

if (problems.length) {
  console.error(`check-i18n: ${problems.length} interface string(s) not going through t():`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("check-i18n: OK");
