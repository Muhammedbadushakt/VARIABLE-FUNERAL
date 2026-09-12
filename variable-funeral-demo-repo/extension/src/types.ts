export type DeclKind =
  | 'variable'
  | 'const'
  | 'let'
  | 'var'
  | 'parameter'
  | 'import'
  | 'function'
  | 'class';

export interface CandidateDeclaration {
  name: string;
  kind: DeclKind;
  /** Character offset into the source text where the identifier itself starts. */
  offset: number;
  /** 0-based line/character, filled in by the extension host using the live document. */
  line: number;
  character: number;
}

export type Verdict = 'ALIVE' | 'DEAD' | 'BURIED';

export interface Tombstone {
  id: string;
  name: string;
  kind: DeclKind;
  verdict: Verdict;
  filePath: string;
  fileName: string;
  line: number;
  character: number;
  causeOfDeath: string;
  epitaph: string;
  detectedAt: number;
}

/** A declaration that was actually removed from source, kept around so it
 * can be resurrected (best-effort) or shown in the memorial history. */
export interface BuriedRecord {
  id: string;
  name: string;
  kind: DeclKind;
  filePath: string;
  fileName: string;
  line: number;
  removedText: string;
  buriedAt: number;
}

export interface GraveyardStats {
  alive: number;
  dead: number;
  buried: number;
}

