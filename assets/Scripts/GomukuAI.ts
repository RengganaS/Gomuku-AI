export class GomokuAI {

    // debug: track jumlah cabang yang dicek
    static nodesEvaluated: number = 0;
    
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

        let bestScore = -Infinity;
        let bestMove = candidates[0]; // fallback aman
        const humanColor = aiColor === 1 ? 2 : 1;

        // debug: liat performance
        const startTime = performance.now();
        this.nodesEvaluated = 0;

        for (const [r, c] of candidates) {
            boardState[r][c] = aiColor; 
            const score = this.minimax(boardState, searchDepth - 1, -Infinity, Infinity, false, aiColor, humanColor, dimension);
            
            boardState[r][c] = 0;

            if (score > bestScore) {
                bestScore = score;
                bestMove = [r, c];
            }
        }

        // debug: liat performance
        const endTime = performance.now();
        const timeTaken = (endTime - startTime).toFixed(2);
        console.log(`Waktu: ${timeTaken} ms | Cabang dievaluasi: ${this.nodesEvaluated.toLocaleString()} node`);
        
        return bestMove;
    }

    static minimax(boardState: number[][], depth: number, alpha: number, beta: number, isMaximizing: boolean, aiColor: number, humanColor: number, dimension: number): number {
        // debug: track jumlah cabang yang dicek
        this.nodesEvaluated++;
        
        if (depth === 0) {
            return this.evaluateBoard(boardState, dimension, aiColor, humanColor);
        }

        const candidates = this.getCandidateMoves(boardState, dimension);
        if (candidates.length === 0) return 0;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const [r, c] of candidates) {
                boardState[r][c] = aiColor; // 1. AI mencoba melihat ke masa depan
                const evalScore = this.minimax(boardState, depth - 1, alpha, beta, false, aiColor, humanColor, dimension);
                boardState[r][c] = 0;       // 2. Undo langkah (Kembali ke masa kini)

                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break; // ALPHA-BETA PRUNING
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const [r, c] of candidates) {
                boardState[r][c] = humanColor; // 1. AI mensimulasikan musuh melangkah
                const evalScore = this.minimax(boardState, depth - 1, alpha, beta, true, aiColor, humanColor, dimension);
                boardState[r][c] = 0;          // 2. Undo langkah

                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break; // ALPHA-BETA PRUNING
            }
            return minEval;
        }
    }

    static evaluateBoard(boardState: number[][], dimension: number, aiColor: number, humanColor: number): number {
        let score  = 0;

        // belum bener
        for (let r = 0; r < dimension; r++) {
            for (let c = 0; c < dimension; c++) {
                if (boardState[r][c] === aiColor) {
                    score += this.evaluatePosition(boardState, r, c, aiColor, dimension);
                } else if (boardState[r][c] === humanColor) {
                    score -= this.evaluatePosition(boardState, r, c, humanColor, dimension);
                }
            }
        }
        return score;
    }
    
    static evaluatePosition(boardState: number[][], r: number, c: number, player: number, dimension: number): number {
        let positionScore = 0;
        const directions = [ [0, 1], [1, 0], [1, 1], [1, -1] ]; 

        for (const [dr, dc] of directions) {
            let consecutive = 1;
            let openEnds = 0;

            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nr < dimension && nc >= 0 && nc < dimension && boardState[nr][nc] === player) {
                consecutive++;
                nr += dr; nc += dc;
            }
            if (nr >= 0 && nr < dimension && nc >= 0 && nc < dimension && boardState[nr][nc] === 0) openEnds++;

            nr = r - dr; 
            nc = c - dc;
            while (nr >= 0 && nr < dimension && nc >= 0 && nc < dimension && boardState[nr][nc] === player) {
                consecutive++;
                nr -= dr; nc -= dc;
            }
            if (nr >= 0 && nr < dimension && nc >= 0 && nc < dimension && boardState[nr][nc] === 0) openEnds++;

            if (consecutive >= 5) positionScore += 100000;
            else if (consecutive === 4 && openEnds > 0) positionScore += 10000;
            else if (consecutive === 3 && openEnds === 2) positionScore += 1000;
            else if (consecutive === 3 && openEnds === 1) positionScore += 100;
            else if (consecutive === 2 && openEnds === 2) positionScore += 50;
        }

        return positionScore;
    }
}