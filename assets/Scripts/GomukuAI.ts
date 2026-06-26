export class GomokuAI {

    // debug: track jumlah cabang yang dicek
    static nodesEvaluated: number = 0;

    static startTime: number = 0;
    static MAX_TIME_MS: number = 0;
    static isTimeOut: boolean = false;

    // cache skor aktif
    // sehingga evaluateBoard() tidak perlu scan seluruh papan lagi.
    static scoreCache = { ai: 0, human: 0 };

    // Radius maksimal pengaruh sebuah bidak.
    // Pola terpanjang adalah 5 bidak, jadi bidak baru bisa mempengaruhi
    // cell lain yang berjarak hingga 4 langkah darinya.
    static readonly INFLUENCE_RADIUS = 4;
    // ────────────────────────────────────────────────────────────────────────────

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
        "010110": 10000,
        "011010": 10000,

        // blocked three / open two
        "001100": 100,
        "011000": 100,
        "000110": 100,
        "211100": 100,
        "001112": 100,
    };


    // incremental scoring
    // dipanggil sekali sebelum game dimulai, atau saat papan reset
    // fungsi ini menghitung skor awal dari posisi papan yang diberikan
    // dan menyimpannya ke scoreCache.
    //
    // setelah ini, scoreCache.ai dan scoreCache.human selalu akurat
    // tanpa perlu scan ulang seluruh papan.
    //
    static initScoreCache(boardState: number[][], dimension: number, aiColor: number, humanColor: number): void {
        this.scoreCache = { ai: 0, human: 0 };

        for (let r = 0; r < dimension; r++) {
            for (let c = 0; c < dimension; c++) {
                const color = boardState[r][c];
                if (color === aiColor) {
                    this.scoreCache.ai += this.evaluatePosition(boardState, r, c, aiColor, humanColor, dimension);
                } else if (color === humanColor) {
                    this.scoreCache.human += this.evaluatePosition(boardState, r, c, humanColor, aiColor, dimension);
                }
            }
        }
    }

    // incremental scoring , pakai cache
    static updateScoreCache(
        boardState: number[][],
        r: number, c: number,
        colorPlaced: number,       // warna bidak yang ditaruh (0 = undo/cabut)
        aiColor: number,
        humanColor: number,
        dimension: number
    ): void {
        const radius = this.INFLUENCE_RADIUS;

        // kumpul semua cell dalam radius yang berisi bidak (sebelum perubahan)
        // cell-cell yang kontribusinya harus kita recalculate
        const affected: [number, number, number][] = []; // [row, col, color]

        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= dimension || nc < 0 || nc >= dimension) continue;
                const cellColor = boardState[nr][nc];
                if (cellColor !== 0) {
                    affected.push([nr, nc, cellColor]);
                }
            }
        }

        // Langkah 1: KURANGI kontribusi lama dari semua cell yang terpengaruh.
        for (const [nr, nc, cellColor] of affected) {
            const enemy = cellColor === aiColor ? humanColor : aiColor;
            const contrib = this.evaluatePosition(boardState, nr, nc, cellColor, enemy, dimension);
            if (cellColor === aiColor) this.scoreCache.ai -= contrib;
            else this.scoreCache.human -= contrib;
        }

        // Langkah 2: Terapkan perubahan ke boardState.
        boardState[r][c] = colorPlaced;

        // Langkah 3: TAMBAHKAN kontribusi baru.
        // Jika ini langkah place (colorPlaced !== 0), bidak baru (r,c) juga ikut dihitung.
        // Jika ini undo (colorPlaced === 0), cell (r,c) kini kosong, tidak dihitung.
        const newAffected: [number, number, number][] = [];

        for (const [nr, nc] of affected.map(a => [a[0], a[1]])) {
            const cellColor = boardState[nr][nc];
            if (cellColor !== 0) newAffected.push([nr, nc, cellColor]);
        }
        // tambahkan bidak baru itu sendiri jika ini langkah place
        if (colorPlaced !== 0) {
            newAffected.push([r, c, colorPlaced]);
        }

        for (const [nr, nc, cellColor] of newAffected) {
            const enemy = cellColor === aiColor ? humanColor : aiColor;
            const contrib = this.evaluatePosition(boardState, nr, nc, cellColor, enemy, dimension);
            if (cellColor === aiColor) this.scoreCache.ai += contrib;
            else this.scoreCache.human += contrib;
        }
    }
    // ────────────────────────────────────────────────────────────────────────────

    // AI lihat sekitar bidak yang udah di taro
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
        let timeLimit = 0;

        if (level === "Easy") {
            blunderChance = 0.45;
            maxSearchDepth = 2;
            timeLimit = 1000;
        } else if (level === "Medium") {
            blunderChance = 0.2;
            maxSearchDepth = 3;
            timeLimit = 1800;
        } else if (level === "Hard") {
            blunderChance = 0.0;
            maxSearchDepth = 6;
            timeLimit = 5000;
        }

        this.MAX_TIME_MS = timeLimit;

        const humanColor = aiColor === 1 ? 2 : 1;

        // mastiin scoreCache mencerminkan kondisi papan saat ini
        // sebelum minimax mulai memodifikasi papan bolak-balik.
        this.initScoreCache(boardState, dimension, aiColor, humanColor);
        // ─────────────────────────────────────────────────────────────────────────

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

        if (Math.random() < blunderChance) {
            console.log(`[AI Level: ${level}], AI melakukan blunder! (Random move)`);
            const randomIndex = Math.floor(Math.random() * candidates.length);
            return candidates[randomIndex];
        }

        console.log(`[AI Level: ${level}] AI berpikir maksimal ${this.MAX_TIME_MS / 1000} detik...`);

        this.nodesEvaluated = 0;
        this.startTime = performance.now();
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
                // ganti: boardState[r][c] = aiColor
                // dengan updateScoreCache yang sekaligus mengubah boardState
                this.updateScoreCache(boardState, r, c, aiColor, aiColor, humanColor, dimension);
                // ─────────────────────────────────────────────────────────────────

                const score = this.minimax(boardState, currentDepth - 1, -Infinity, Infinity, false, aiColor, humanColor, dimension);

                // undo
                // ganti:  boardState[r][c] = 0
                // colorPlaced = 0 berarti cabut bidak 
                this.updateScoreCache(boardState, r, c, 0, aiColor, humanColor, dimension);
                if (this.isTimeOut) break;

                if (score > depthBestScore) {
                    depthBestScore = score;
                    depthBestMove = [r, c];
                }
            }

            if (this.isTimeOut) {
                console.warn(`Waktu habis saat cek Depth ${currentDepth}. Menggunakan hasil dari Depth ${currentDepth - 1}.`);
                break;
            }

            finalBestMove = depthBestMove;
            console.log(`Selesai evaluasi Depth ${currentDepth} - Cabang: ${this.nodesEvaluated.toLocaleString()}`);

            if (depthBestScore >= 100000) {
                console.log(`AI menemukan langkah Kemenangan / Ancaman Fatal di Depth ${currentDepth}! Eksekusi instan.`);
                break;
            }
        }

        const endTime = performance.now();
        console.log(`Total Waktu: ${(endTime - this.startTime).toFixed(2)} ms | Total Cabang: ${this.nodesEvaluated.toLocaleString()} node`);

        return finalBestMove;
    }

    static minimax(
        boardState: number[][], depth: number,
        alpha: number, beta: number, isMaximizing: boolean,
        aiColor: number, humanColor: number, dimension: number
    ): number {
        if (!this.isTimeOut && (performance.now() - this.startTime > this.MAX_TIME_MS)) {
            this.isTimeOut = true;
            return isMaximizing ? -Infinity : Infinity;
        }

        this.nodesEvaluated++;

        if (depth === 0 || this.isTimeOut) {
            const defensiveMultiplier = 1.2;
            return this.scoreCache.ai - (this.scoreCache.human * defensiveMultiplier);
        }

        const candidates = this.getCandidateMoves(boardState, dimension, "Hard");
        if (candidates.length === 0) return 0;

        this.orderMovesFast(candidates, boardState, dimension);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const [r, c] of candidates) {
                // place + undo di setiap node 
                this.updateScoreCache(boardState, r, c, aiColor, aiColor, humanColor, dimension);
                const evalScore = this.minimax(boardState, depth - 1, alpha, beta, false, aiColor, humanColor, dimension);
                this.updateScoreCache(boardState, r, c, 0, aiColor, humanColor, dimension);

                if (this.isTimeOut) break;

                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const [r, c] of candidates) {
                // place + undo di setiap node 
                this.updateScoreCache(boardState, r, c, humanColor, aiColor, humanColor, dimension);
                const evalScore = this.minimax(boardState, depth - 1, alpha, beta, true, aiColor, humanColor, dimension);
                this.updateScoreCache(boardState, r, c, 0, aiColor, humanColor, dimension);

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
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

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

        while (r >= 0 && r < dimension && c >= 0 && c < dimension && boardState[r][c] === color) {
            count++;
            r += dr;
            c += dc;
        }

        return count;
    }

    static evaluateMoveScore(boardState: number[][], r: number, c: number, aiColor: number, humanColor: number, dimension: number): number {
        let score = 0;

        boardState[r][c] = aiColor;
        score += this.evaluatePosition(boardState, r, c, aiColor, humanColor, dimension);

        boardState[r][c] = humanColor;
        score += this.evaluatePosition(boardState, r, c, humanColor, aiColor, dimension) * 1.5;

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

    // evaluateBoard() sekarang hanya dipakai untuk inisialisasi cache
    // minimax tidak memanggilnya lagi.
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

        const defensiveMultiplier = 1.2;
        return aiScore - (humanScore * defensiveMultiplier);
    }

    static evaluatePosition(boardState: number[][], r: number, c: number, myColor: number, enemyColor: number, dimension: number): number {
        let totalScore = 0;
        const directions = [
            [0, 1],
            [1, 0],
            [1, 1],
            [1, -1]
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