export class GomokuAI {
    
    // AI lihat 5x5 dari bidak yang udah di taro
    static getCandidateMoves(boardState: number[][], dimension: number): [number, number][] {
        const moves: [number, number][] = [];
        const hasNeighbor = (row: number, col: number): boolean => {
            for (let r = Math.max(0, row - 2); r <= Math.min(dimension - 1, row + 2); r++) {
                for (let c = Math.max(0, col - 2); c <= Math.min(dimension - 1, col + 2); c++) {
                    if (boardState[r][c] !== 0) return true; 
                }                
            }
            return false;
        };

        let isEmptyBoard = true;

        for (let r = 0; r < dimension; r++) {
            for (let c = 0; c < dimension; c++) {
                if (boardState[r][c] !== 0) {
                    isEmptyBoard = false;
                } else if (hasNeighbor(r, c)) {
                    moves.push([r, c]);
                }
            }
        }

        if (isEmptyBoard) {
            const mid = Math.floor(dimension / 2);
            return [[mid, mid]];
        }

        return moves;
    }

    // fungsi utama
    static getBestMove(boardState: number[][], dimension: number, aiColor: number, level: string): [number, number] | null {
        const candidates = this.getCandidateMoves(boardState, dimension);
        if (candidates.length === 0) return null;

        let blunderChance = 0;
        let searchDepth = 2;

        if (level === "Easy") {
            blunderChance = 0.4;
            searchDepth = 2;
        } else if (level === "Medium") {
            blunderChance = 0.1;
            searchDepth = 3;
        } else if (level === "Hard") {
            blunderChance = 0.0;
            searchDepth = 4;
        }

        if (Math.random() < blunderChance) {
            console.log(`[AI Level: ${level}] Ops, AI melakukan blunder! (Random move)`);
            const randomIndex = Math.floor(Math.random() * candidates.length);
            return candidates[randomIndex];
        }

        console.log(`[AI Level: ${level}] AI berpikir serius dengan Depth ${searchDepth}...`);

        return candidates[0];
    }
}