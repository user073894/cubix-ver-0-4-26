declare module "cubejs" {
  export default class Cube {
    constructor(other?: Cube);
    static initSolver(): void;
    static random(): Cube;
    static fromString(s: string): Cube;
    static inverse(alg: string): string;
    move(alg: string): Cube;
    asString(): string;
    isSolved(): boolean;
    solve(maxDepth?: number): string;
  }
}
