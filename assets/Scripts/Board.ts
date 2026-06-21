import { _decorator, Component, Graphics, UITransform, Color, EventTouch, Node, Prefab, instantiate, Vec3 } from 'cc';
const { ccclass, property} = _decorator

@ccclass('Board')
export class Board extends Component {

    @property(Graphics)
    public gridGraphics: Graphics = null;

    @property(Prefab)
    public blackStonePrefab: Prefab = null;

    @property(Prefab)
    public whiteStonePrefab: Prefab = null;

    private boardDimension: number = 15;
    private margin: number = 30;
    private cellSize: number = 0;

    private startX: number = 0;
    private startY: number = 0;

    private boardState: number[][] = [];

    start() {
        this.initBoardState();
        this.drawGrid();

        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    initBoardState() {
        for (let i = 0; i < this.boardDimension; i++) {
            this.boardState[i] = [];
            for (let j = 0; j < this.boardDimension; j++) {
                this.boardState[i][j] = 0;
            }
        }
    }

    drawGrid() {
        const g = this.gridGraphics;
        if (!g) {
            console.error("Komponen Graphics belum ditambahkan ke Node BoardBG!");
            return;
        }

        const uiTransform = this.getComponent(UITransform);
        const boardWidth = uiTransform.width;

        const drawableArea = boardWidth - (this.margin * 2);
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
        const touchPos = event.getUILocation();
        const uiTransform = this.getComponent(UITransform);
        const localPos = uiTransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));

        const col = Math.round((localPos.x - this.startX) / this.cellSize);
        const row = Math.round((localPos.y - this.startY) / this.cellSize);

        if (col >= 0 && col < this.boardDimension && row >= 0 && row < this.boardDimension) {
            if (this.boardState[row][col] === 0) {
                this.placeStone(row, col, 1);
            }
        }
    }

    placeStone(row: number, col: number, playerType: number) {
        this.boardState[row][col] = playerType;

        const stonePrefab = playerType === 1 ? this.blackStonePrefab : this.whiteStonePrefab;
        const stoneNode = instantiate(stonePrefab);

        this.node.addChild(stoneNode);

        const posX = this.startX + (col * this.cellSize);
        const posY = this.startY + (row * this.cellSize);
        stoneNode.setPosition(new Vec3(posX, posY, 0));
    }
}