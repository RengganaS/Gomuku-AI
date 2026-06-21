export class GomokuAI {
    
    /**
     * AI Level 0: Random Placement
     * AI ini akan mengumpulkan semua titik kosong di papan, 
     * lalu memilih salah satunya secara acak.
     */
    static getRandomMove(boardState: number[][], dimension: number): [number, number] | null {
        let emptySpots: [number, number][] = [];

        // 1. Kumpulkan semua koordinat yang masih kosong (bernilai 0)
        for (let r = 0; r < dimension; r++) {
            for (let c = 0; c < dimension; c++) {
                if (boardState[r][c] === 0) {
                    emptySpots.push([r, c]); // Simpan ke array
                }
            }
        }

        // 2. Keamanan: Jika papan sudah penuh, kembalikan null
        if (emptySpots.length === 0) {
            return null;
        }

        // 3. Pilih indeks acak dari array titik kosong tersebut
        const randomIndex = Math.floor(Math.random() * emptySpots.length);
        
        // 4. Kembalikan koordinat [baris, kolom] yang terpilih
        return emptySpots[randomIndex];
    }

}