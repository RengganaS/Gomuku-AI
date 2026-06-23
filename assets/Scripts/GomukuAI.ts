export class GomokuAI {

    // debug: track jumlah cabang yang dicek
    static nodesEvaluated: number = 0;

    static startTime: number = 0;
    static MAX_TIME_MS: number = 2000;
    static isTimeOut: boolean = false;

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
    static getCandidateMoves(boardState: number[][], dimension: number, level: string): [number, number][] {
        const moves: [number, number][] = [];

        const searchRadius = 1;

        const hasNeighbor = (row: number, col: number): boolean => {
            for (let r = Math.max(0, row - searchRadius); r <= Math.min(dimension - 1, row + searchRadius); r++) {
                for (let c = Math.max(0, col - searchRadius); c <= Math.min(dimension - 1, col + searchRadius); c++) {
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
        const candidates = this.getCandidateMoves(boardState, dimension, level);
        if (candidates.length === 0) return null;

        let blunderChance = 0;
        let maxSearchDepth = 2;

        if (level === "Easy") {
            blunderChance = 0.4;
            maxSearchDepth = 2;
        } else if (level === "Medium") {
            blunderChance = 0.1;
            maxSearchDepth = 3;
        } else if (level === "Hard") {
            blunderChance = 0.0;
            maxSearchDepth = 4;
        }

        if (Math.random() < blunderChance) {
            console.log(`[AI Level: ${level}], AI melakukan blunder! (Random move)`);
            const randomIndex = Math.floor(Math.random() * candidates.length);
            return candidates[randomIndex];
        }

        console.log(`[AI Level: ${level}] AI berpikir maksimal ${this.MAX_TIME_MS/1000} detik...`);

        const humanColor = aiColor === 1 ? 2 : 1;

        const winningMove = this.findImmediateWinningMove(boardState, dimension, aiColor);
        if (winningMove) {
            console.log("AI menemukan langkah menang.");
            return winningMove;
        }

        const blockingMove = this.findImmediateWinningMove(boardState, dimension, humanColor);
        if (blockingMove) {
            console.log("AI memblokir kemenangan lawan.");
            return blockingMove;
        }

        // debug: liat performance
        this.nodesEvaluated = 0;

        // --- SETUP TIMER ---
        this.startTime = performance.now(); 
        this.nodesEvaluated = 0; 
        this.isTimeOut = false;

       candidates.sort((a, b) => {
            const scoreA = this.evaluateMoveScore(boardState, a[0], a[1], aiColor, humanColor, dimension);
            const scoreB = this.evaluateMoveScore(boardState, b[0], b[1], aiColor, humanColor, dimension);
            return scoreB - scoreA; 
        });

        let finalBestMove = candidates[0];

        for (let currentDepth = 1; currentDepth <= maxSearchDepth; currentDepth++) {
            candidates.sort((a, b) => {
                if (a[0] === finalBestMove[0] && a[1] === finalBestMove[1]) return -1;
                if (b[0] === finalBestMove[0] && b[1] === finalBestMove[1]) return 1;
                return 0;
            });

            let depthBestScore = -Infinity;
            let depthBestMove = candidates[0];

            for (const [r, c] of candidates) {
                boardState[r][c] = aiColor; 
                const score = this.minimax(boardState, currentDepth - 1, -Infinity, Infinity, false, aiColor, humanColor, dimension);
                boardState[r][c] = 0; 

                // jika di tengah jalan waktu habis, jangan update skor/langkah
                if (this.isTimeOut) break;

                if (score > depthBestScore) {
                    depthBestScore = score;
                    depthBestMove = [r, c];
                }
            }

            // kika waktu habis saat cek depth ini, buang hasilnya
            // pakai hasil dari finalBestMove
            if (this.isTimeOut) {
                console.warn(`Waktu habis saat cek Depth ${currentDepth}. Menggunakan hasil dari Depth ${currentDepth - 1}.`);
                break;
            }

            // jika berhasil menyelesaikan depth ini tanpa timeout, simpan sebagai langkah terbaik
            finalBestMove = depthBestMove;
            console.log(`Selesai evaluasi Depth ${currentDepth} - Cabang: ${this.nodesEvaluated.toLocaleString()}`);

            // jika AI menemukan jalur yang skor jutaan, hentikan pencarian
            if (depthBestScore >= 100000) {
                console.log(`AI menemukan langkah Kemenangan / Ancaman Fatal di Depth ${currentDepth}! Eksekusi instan.`);
                break;
            }
        }

        // debug: liat performance
        const endTime = performance.now();
        console.log(`Total Waktu: ${(endTime - this.startTime).toFixed(2)} ms | Total Cabang: ${this.nodesEvaluated.toLocaleString()} node`);
        
        return finalBestMove;
    }

    static minimax(boardState: number[][], depth: number, alpha: number, beta: number, isMaximizing: boolean, aiColor: number, humanColor: number, dimension: number): number {
        if (!this.isTimeOut && (performance.now() - this.startTime > this.MAX_TIME_MS)) {
            this.isTimeOut = true;
            return isMaximizing ? -Infinity : Infinity;
        }
        
        this.nodesEvaluated++;

        if (depth === 0 || this.isTimeOut) {
            return this.evaluateBoard(boardState, dimension, aiColor, humanColor);
        }

        const candidates = this.getCandidateMoves(boardState, dimension, "Hard"); 
        if (candidates.length === 0) return 0;

        this.orderMovesFast(candidates, boardState, dimension);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const [r, c] of candidates) {
                boardState[r][c] = aiColor;
                const evalScore = this.minimax(boardState, depth - 1, alpha, beta, false, aiColor, humanColor, dimension);
                boardState[r][c] = 0;
                
                if (this.isTimeOut) break; // Keluar dari loop jika waktu habis

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
                
                if (this.isTimeOut) break;

                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break; 
            }
            return minEval;
        }
    }

    static findImmediateWinningMove(boardState: number[][], dimension: number, color: number): [number, number] | null {
        const candidates = this.getCandidateMoves(boardState, dimension, "Hard");

        for (const [r, c] of candidates) {
            boardState[r][c] = color;
            const isWin = this.isWinningPosition(boardState, r, c, color, dimension);
            boardState[r][c] = 0;

            if (isWin) return [r, c];
        }

        return null;
    }

    static isWinningPosition(boardState: number[][], row: number, col: number, color: number, dimension: number): boolean {
        const directions = [
            [0, 1],
            [1, 0],
            [1, 1],
            [1, -1],
        ];

        for (const [dr, dc] of directions) {
            let count = 1;

            count += this.countDirection(boardState, row, col, dr, dc, color, dimension);
            count += this.countDirection(boardState, row, col, -dr, -dc, color, dimension);

            if (count >= 5) return true;
        }

        return false;
    }

    static countDirection(boardState: number[][], row: number, col: number, dr: number, dc: number, color: number, dimension: number): number {
        let count = 0;
        let r = row + dr;
        let c = col + dc;

        while (
            r >= 0 &&
            r < dimension &&
            c >= 0 &&
            c < dimension &&
            boardState[r][c] === color
        ) {
            count++;
            r += dr;
            c += dc;
        }

        return count;
    }

    static evaluateMoveScore(boardState: number[][], r: number, c: number, aiColor: number, humanColor: number, dimension: number): number {
        let score = 0;
        
        // cek potensi Serangan
        boardState[r][c] = aiColor;
        score += this.evaluatePosition(boardState, r, c, aiColor, humanColor, dimension);
        
        // cek potensi defense
        boardState[r][c] = humanColor;
        score += this.evaluatePosition(boardState, r, c, humanColor, aiColor, dimension) * 1.5; // Prioritaskan blokir
        
        boardState[r][c] = 0;
        return score;
    }

    static orderMovesFast(candidates: [number, number][], boardState: number[][], dimension: number) {
        candidates.sort((a, b) => {
            const scoreA = this.fastProximityScore(boardState, a[0], a[1], dimension);
            const scoreB = this.fastProximityScore(boardState, b[0], b[1], dimension);
            return scoreB - scoreA; 
        });
    }

    static fastProximityScore(boardState: number[][], r: number, c: number, dimension: number): number {
        let score = 0;
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

        for (let i = -4; i <= 4; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;

            if (nr >= 0 && nr < dimension && nc >= 0 && nc < dimension) {
                const cell = boardState[nr][nc];

                if (cell === myColor) str += "1";
                else if (cell === enemyColor) str += "2";
                else str += "0";
            } else {
                str += "2";
            }
        }

        return str;
    }
}