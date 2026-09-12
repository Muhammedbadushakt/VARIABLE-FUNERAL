import * as ts from 'typescript';
import { CandidateDeclaration, DeclKind } from './types';

/**
 * Walks the AST of a single file and returns every declaration that is a
 * *candidate* for being dead code: variables, parameters, imports, functions,
 * and classes. This does NOT decide whether something is actually unused —
 * that requires the live language service (reference provider), which only
 * the extension host has access to. This module is pure and testable.
 */
export function findCandidateDeclarations(
  sourceText: string,
  fileName: string
): CandidateDeclaration[] {
  const scriptKind = pickScriptKind(fileName);
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind
  );

  const candidates: CandidateDeclaration[] = [];

  const push = (name: ts.Identifier | undefined, kind: DeclKind) => {
    if (!name) {return;}
    candidates.push({
      name: name.text,
      kind,
      offset: name.getStart(sourceFile),
      line: 0,
      character: 0
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const flags = ts.getCombinedNodeFlags(node);
      let kind: DeclKind = 'variable';
      if (flags & ts.NodeFlags.Const) {kind = 'const';}
      else if (flags & ts.NodeFlags.Let) {kind = 'let';}
      else {kind = 'var';}
      push(node.name, kind);
    } else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      push(node.name, 'parameter');
    } else if (ts.isImportSpecifier(node)) {
      push(node.name, 'import');
    } else if (ts.isImportClause(node) && node.name) {
      push(node.name, 'import');
    } else if (ts.isNamespaceImport(node)) {
      push(node.name, 'import');
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      push(node.name, 'function');
    } else if (ts.isClassDeclaration(node) && node.name) {
      push(node.name, 'class');
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return candidates;
}

function pickScriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx')) {return ts.ScriptKind.TSX;}
  if (fileName.endsWith('.jsx')) {return ts.ScriptKind.JSX;}
  if (fileName.endsWith('.ts')) {return ts.ScriptKind.TS;}
  return ts.ScriptKind.JS;
}
