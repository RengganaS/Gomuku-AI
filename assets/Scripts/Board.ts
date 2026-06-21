import { _decorator, Component, Graphics, UITransform, Color, EventTouch, Node, Prefab, instantiate, Vec3, Label } from 'cc';
import { GomokuAI } from './GomukuAI';
const { ccclass, property } = _decorator;

@ccclass('Board')
export class Board extends Component {

    @property(Graphics) public gridGraphics: Graphics = null;
    @property(Label) public statusLabel: Label = null;
    @property(Node) public stoneContainer: Node = null;
    @property(Prefab) public blackStonePrefab: Prefab = null;
    @property(Prefab) public whiteStonePrefab: Prefab = null;

    // --- UI OVERLAYS ---
    @property(Node) public homeOverlay: Node = null;
    @property(Node) public roleSelectionPanel: Node = null;
    @property(Node) public levelSelectionPanel: Node = null;
    @property(Node) public playButtonNode: Node = null;
    @property(Node) public resultOverlay: Node = null;
    @property(Label) public resultLabel: Label = null;

    private boardDimension: number = 15;
    private margin: number = 30;
    private cellSize: number = 0;
    private startX: number = 0;
    private startY: number = 0;
    private boardState: number[][] = [];

    // --- STATE MANAGEMENT ---
    private isGameActive: boolean = false;
    private currentPlayer: number = 1; 
    private humanColor: number = 1; 
    private aiColor: number = 2;
    private aiLevel: string = "Easy"; 

    start() {
        this.initBoardState();
        this.drawGrid();
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.showHome();
    }

    initBoardState() {
        this.boardState = [];
        for (let i = 0; i < this.boardDimension; i++) {
            this.boardState[i] = [];
            for (let j = 0; j < this.boardDimension; j++) {
                this.boardState[i][j] = 0;
            }
        }
    }

    // === VISUAL & UI ===

    public showHome() {
        this.isGameActive = false;
        this.homeOverlay.active = true;
        this.playButtonNode.active = true;
        this.roleSelectionPanel.active = false;
        this.levelSelectionPanel.active = false; 
        this.resultOverlay.active = false;
    }

    public onPlayClicked() {
        this.playButtonNode.active = false;
        this.roleSelectionPanel.active = true;
    }

    public onSelectRole(event: EventTouch, customEventData: string) {
        this.humanColor = parseInt(customEventData);
        this.aiColor = this.humanColor === 1 ? 2 : 1;

        this.roleSelectionPanel.active = false;
        this.levelSelectionPanel.active = true;
    }

    public onSelectLevel(event: EventTouch, customEventData: string) {
        this.aiLevel = customEventData;
        
        this.homeOverlay.active = false;
        this.startGame();
    }

    public startGame() {
        this.stoneContainer.removeAllChildren();
        this.initBoardState();
        this.currentPlayer = 1; 
        this.isGameActive = true;
        this.updateStatus();

        console.log(`GAME DIMULAI!`);
        console.log(`Pemain: ${this.humanColor === 1 ? 'Hitam' : 'Putih'} | Level AI: ${this.aiLevel}`);

        if (this.aiColor === 1) {
            this.triggerAITurn();
        }
    }

    public triggerGameOver(winner: number) {
        this.isGameActive = false;
        this.resultOverlay.active = true;

        if (winner === this.humanColor) {
            this.resultLabel.string = "=== KAMU MENANG! ===";
        } else {
            this.resultLabel.string = "=== AI MENANG! ===";
        }
    }
    
    public triggerAITurn() {
        console.log(`AI (${this.aiLevel}) sedang berpikir...`);

        this.scheduleOnce(() => {
            
            const move = GomokuAI.getBestMove(this.boardState, this.boardDimension, this.aiColor, this.aiLevel);
            
            if (move) {
                const [row, col] = move;
                this.placeStone(row, col, this.aiColor);
            }
        }, 0.5);
    }

    // === GAMEPLAY ===

    updateStatus() {
        if (!this.isGameActive) return;
        this.statusLabel.string = this.currentPlayer === 1 ? "Giliran: HITAM" : "Giliran: PUTIH";
    }

    drawGrid() {
        const g = this.gridGraphics;
        if (!g) return;
        const uiTransform = this.getComponent(UITransform);
        const drawableArea = uiTransform.width - (this.margin * 2);
        this.cellSize = drawableArea / (this.boardDimension - 1);
        g.lineWidth = 2;
        g.strokeColor = new Color(0, 0, 0, 255);
        this.startX = -(drawableArea / 2);
        this.startY = -(drawableArea / 2);

        for (let i = 0; i < this.boardDimension; i++){
            const x = this.startX + (i * this.cellSize);
            g.moveTo(x, this.startY);
            g.lineTo(x, this.startY + drawableArea);
            const y = this.startY + (i * this.cellSize);
            g.moveTo(this.startX, y);
            g.lineTo(this.startX + drawableArea, y);
        }
        g.stroke();
    }

    onTouchEnd(event: EventTouch) {
        if (!this.isGameActive) return;

        if (this.currentPlayer === this.aiColor) {
            console.log("Tunggu giliran AI!");
            return; 
        }

        const touchPos = event.getUILocation();
        const localPos = this.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        const col = Math.round((localPos.x - this.startX) / this.cellSize);
        const row = Math.round((localPos.y - this.startY) / this.cellSize);

        if (col >= 0 && col < this.boardDimension && row >= 0 && row < this.boardDimension) {
            if (this.boardState[row][col] === 0) {
                this.placeStone(row, col, this.currentPlayer);
            }
        }
    }

    placeStone(row: number, col: number, playerType: number) {
        this.boardState[row][col] = playerType;
        const stonePrefab = playerType === 1 ? this.blackStonePrefab : this.whiteStonePrefab;
        const stoneNode = instantiate(stonePrefab);
        this.stoneContainer.addChild(stoneNode);
        
        const posX = this.startX + (col * this.cellSize);
        const posY = this.startY + (row * this.cellSize);
        stoneNode.setPosition(new Vec3(posX, posY, 0));

        if (this.checkWin(row, col, playerType)) {
            this.triggerGameOver(playerType);
            return;
        }

        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.updateStatus();

        if (this.isGameActive && this.currentPlayer === this.aiColor) {
            this.triggerAITurn();
        }
    }

    checkWin(row: number, col: number, player: number): boolean {
        const directions = [
            [[0, 1], [0, -1]],   // Horizontal
            [[1, 0], [-1, 0]],   // Vertikal
            [[1, 1], [-1, -1]],  // Diagonal /
            [[-1, 1], [1, -1]]   // Diagonal \
        ];
        for (const axis of directions) {
            let consecutiveStones = 1;
            for (const [dRow, dCol] of axis) {
                let r = row + dRow;
                let c = col + dCol;
                while (r >= 0 && r < this.boardDimension && c >= 0 && c < this.boardDimension && this.boardState[r][c] === player) {
                    consecutiveStones++;
                    r += dRow;
                    c += dCol;
                }
            }
            if (consecutiveStones >= 5) return true; 
        }
        return false;
    }
}