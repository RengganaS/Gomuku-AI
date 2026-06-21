import { _decorator, Component, Graphics, UITransform, Color } from "cc";
const { ccclass, property} = _decorator

@ccclass('Board')
export class Board extends Component {

    @property(Graphics)
    public gridGraphics: Graphics = null;

    private boardDimension: number = 15;
    private margin: number = 30;
    private cellSize: number = 0;

    start() {
        this.drawGrid();
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

        const startX = -(drawableArea / 2);
        const startY = -(drawableArea / 2);

        for (let i = 0; i < this.boardDimension; i++){
            const x = startX + (i * this.cellSize);
            g.moveTo(x, startY);
            g.lineTo(x, startY + drawableArea);

            const y = startY + (i * this.cellSize);
            g.moveTo(startX, y);
            g.lineTo(startX + drawableArea, y);
        }

        g.stroke();
    }
}