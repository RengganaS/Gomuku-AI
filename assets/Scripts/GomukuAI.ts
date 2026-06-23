export class GomokuAI {

    // debug: track jumlah cabang yang dicek
    static nodesEvaluated: number = 0;

    /* 
    * pola heuristik.
    * 1 mewakili bidak pemain yang sedang dinilai.
    * 2 mewakili bidak musuh.
    * 0 mewakili petak kosong.
    */ 
    static readonly PATTERN_SCORES: Record<string, number> = {
        // menang
        "11111": 10000000, 

        // open four
        "011110": 1000000,

        // blocked four
        "011112": 100000,
        "211110": 100000,
        "11101": 100000,   
        "11011": 100000,   
        "10111": 100000,   

        // open three
        "011100": 10000,
        "001110": 10000,
        "010110": 10000,   // Bolong 1
        "011010": 10000,   // Bolong 1

        // blocked three / open two
        "001100": 100,
        "011000": 100,
        "000110": 100,
        "211100": 100,
        "001112": 100,
    };
    
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

        // OPTIMAL BUT TAKE A LONG TIME
        // candidates.sort((a, b) => {
        //     const scoreA = this.evaluateMoveScore(boardState, a[0], a[1], aiColor, humanColor, dimension);
        //     const scoreB = this.evaluateMoveScore(boardState, b[0], b[1], aiColor, humanColor, dimension);
        //     return scoreB - scoreA; 
        // });

        // GOOD ENOUGH
        this.orderMoves(candidates, boardState, aiColor, humanColor, dimension);

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
        this.nodesEvaluated++;

        if (depth === 0) {
            return this.evaluateBoard(boardState, dimension, aiColor, humanColor);
        }

        const candidates = this.getCandidateMoves(boardState, dimension);
        if (candidates.length === 0) return 0;

        // OPTIMAL BUT TAKE A LONG TIME
        // urutkan kandidat dari yang paling berpotensi ke yang jelek
        // candidates.sort((a, b) => {
        //     const scoreA = this.evaluateMoveScore(boardState, a[0], a[1], aiColor, humanColor, dimension);
        //     const scoreB = this.evaluateMoveScore(boardState, b[0], b[1], aiColor, humanColor, dimension);
        //     return scoreB - scoreA; // urutkan Descending
        // });

        // GOOD ENOUGH
        this.orderMoves(candidates, boardState, aiColor, humanColor, dimension);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const [r, c] of candidates) {
                boardState[r][c] = aiColor;
                const evalScore = this.minimax(boardState, depth - 1, alpha, beta, false, aiColor, humanColor, dimension);
                boardState[r][c] = 0;

                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break; 
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const [r, c] of candidates) {
                boardState[r][c] = humanColor;
                const evalScore = this.minimax(boardState, depth - 1, alpha, beta, true, aiColor, humanColor, dimension);
                boardState[r][c] = 0;

                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break; 
            }
            return minEval;
        }
    }

    // OPTIMAL BUT TAKE A LONG TIME
    static evaluateMoveScore(boardState: number[][], r: number, c: number, aiColor: number, humanColor: number, dimension: number): number {
        let score = 0;
        
        // seberapa bagus petak ini untuk menyerang?
        boardState[r][c] = aiColor;
        score += this.evaluatePosition(boardState, r, c, aiColor, humanColor, dimension);
        
        // seberapa bagus petak ini untuk defense
        boardState[r][c] = humanColor;
        score += this.evaluatePosition(boardState, r, c, humanColor, aiColor, dimension);
        
        boardState[r][c] = 0; 
        
        return score;
    }

    // NOT OPTIMAL BUT GOOD ENOUGH 
    static orderMoves(candidates: [number, number][], boardState: number[][], aiColor: number, humanColor: number, dimension: number) {
        // hanya melihat bidak di sekitar petak
        candidates.sort((a, b) => {
            const scoreA = this.fastProximityScore(boardState, a[0], a[1], dimension);
            const scoreB = this.fastProximityScore(boardState, b[0], b[1], dimension);
            return scoreB - scoreA; 
        });
    }
    
    static fastProximityScore(boardState: number[][], r: number, c: number, dimension: number): number {
        let score = 0;
        // hanya cek ring terdekat (radius 1) 
        for (let i = Math.max(0, r - 1); i <= Math.min(dimension - 1, r + 1); i++) {
            for (let j = Math.max(0, c - 1); j <= Math.min(dimension - 1, c + 1); j++) {
                if (boardState[i][j] !== 0) score++;
            }
        }
        return score;
    }

    static evaluateBoard(boardState: number[][], dimension: number, aiColor: number, humanColor: number): number {
        let aiScore = 0;
        let humanScore = 0;

        for (let r = 0; r < dimension; r++) {
            for (let c = 0; c < dimension; c++) {
                if (boardState[r][c] === aiColor) {
                    aiScore += this.evaluatePosition(boardState, r, c, aiColor, humanColor, dimension);
                } else if (boardState[r][c] === humanColor) {
                    humanScore += this.evaluatePosition(boardState, r, c, humanColor, aiColor, dimension);
                }
            }
        }
        
        // jika skor serangan musuh tinggi/mau menang, bobotnya lebih berat
        // agar AI memprioritaskan defense daripada menyerang.
        const defensiveMultiplier = 1.2; 
        
        return aiScore - (humanScore * defensiveMultiplier);
    }
    
    static evaluatePosition(boardState: number[][], r: number, c: number, myColor: number, enemyColor: number, dimension: number): number {
        let totalScore = 0;
        const directions = [
            [0, 1],   // Horizontal
            [1, 0],   // Vertikal
            [1, 1],   // Diagonal Kanan \
            [1, -1]   // Diagonal Kiri /
        ];

        for (const [dr, dc] of directions) {
            const pattern = this.getPatternString(boardState, r, c, dr, dc, myColor, enemyColor, dimension);
            
            for (const key in this.PATTERN_SCORES) {
                if (pattern.includes(key)) {
                    totalScore += this.PATTERN_SCORES[key];
                }
            }
        }

        return totalScore;
    }

    static getPatternString(boardState: number[][], r: number, c: number, dr: number, dc: number, myColor: number, enemyColor: number, dimension: number): string {
        let str = "";
        
        for (let i = -1; i <= 4; i++) {
            const nr = r + (dr * i);
            const nc = c + (dc * i);
            
            if (nr >= 0 && nr < dimension && nc >= 0 && nc < dimension) {
                const cell = boardState[nr][nc];
                if (cell === myColor) str += "1";
                else if (cell === enemyColor) str += "2";
                else str += "0";
            } else {
                str += "X";
            }
        }
        return str;
    }
}