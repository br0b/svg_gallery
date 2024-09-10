class Point {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

class Rectangle {
    upperLeft: Point;
    lowerRight: Point;
    fill: string;
    svgElement: SVGRectElement;

    constructor(id: number, upperLeft: Point, lowerRight: Point, fill: string) {
        this.fill = fill;

        this.initSvgElement();
        this.set(upperLeft, lowerRight);
        this.svgElement.setAttribute('id', String(id));
    }

    initSvgElement() {
        this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.svgElement.setAttribute('fill', this.fill);
    }

    set(pa: Point, pb: Point) {
        this.upperLeft = new Point(Math.min(pa.x, pb.x), Math.min(pa.y, pb.y));
        this.lowerRight = new Point(Math.max(pa.x, pb.x), Math.max(pa.y, pb.y));

        this.svgElement.setAttribute('x', String(this.upperLeft.x));
        this.svgElement.setAttribute('y', String(this.upperLeft.y));
        this.svgElement.setAttribute('width', String(this.lowerRight.x - this.upperLeft.x));
        this.svgElement.setAttribute('height', String(this.lowerRight.y - this.upperLeft.y));
    }
}

class RectangleManager {
    newRectangle: number | null = null;
    newRectangleStart: Point | null = null;
    selectedRectangle: number | null = null;
    isDragging: boolean = false;
    fill: string;
    rectangles: Map<number, Rectangle> = new Map();
    nextId: number = 0;

    constructor() {
        this.updateFill()
        this.initEventListeners();
        console.log('Event listeners initialized')
    }

    initEventListeners() {
        const svg = document.getElementById('imageArea');
        const rectangleForm = document.getElementById('rectangleForm');
        const fillInput = document.getElementById('fill');
        const postBtn = document.getElementById('postBtn');
        const deleteBtn = document.getElementById('deleteBtn');

        svg.addEventListener('mousedown', this.onMouseDown.bind(this));
        svg.addEventListener('mousemove', this.onMouseMove.bind(this));
        svg.addEventListener('mouseup', this.onMouseUp.bind(this));
        rectangleForm.addEventListener('submit', this.addRectangleFromForm.bind(this));
        fillInput.addEventListener('change', this.updateFill.bind(this));
        postBtn.addEventListener('click', this.saveToServer.bind(this));
        deleteBtn.addEventListener('click', this.deleteRectangle.bind(this));
    }

    onMouseDown(event: MouseEvent) {
        if (event.target instanceof SVGRectElement) {
            const rectangle = event.target as SVGRectElement;
            const id = Number(rectangle.id);
            this.selectRectangle(id);
        } else {
            this.deselectRectangle();
            this.addRectangleByClick(event);
        }
    }

    addRectangleFromForm(event: Event) {
        event.preventDefault();
        const rectangleForm = document.getElementById('rectangleForm') as HTMLFormElement;
        let upperLeft = new Point(Number(rectangleForm.x1.value), Number(rectangleForm.y1.value));
        let lowerRight = new Point(Number(rectangleForm.x2.value), Number(rectangleForm.y2.value));

        console.log(upperLeft, lowerRight)
        this.addRectangle(upperLeft, lowerRight, this.fill);
        this.newRectangle = null;
    }

    addRectangleByClick(event: MouseEvent) {
        console.log('New rectangle added:', this.nextId);
        this.isDragging = true;
        this.newRectangleStart = new Point(event.offsetX, event.offsetY);
        this.addRectangle(this.newRectangleStart, this.newRectangleStart, this.fill);
    }

    addRectangle(pa: Point, pb: Point, fill: string) {
        const svg = document.getElementById('imageArea');

        const newRec = new Rectangle(this.nextId, pa, pb, fill);
        svg.appendChild(newRec.svgElement);
        this.rectangles.set(this.nextId, newRec);
        this.newRectangle = this.nextId;
    }

    onMouseMove(event: MouseEvent) {
        if (this.isDragging == null || this.newRectangle == null) {
            return;
        }

        const current = new Point(event.offsetX, event.offsetY);
        this.rectangles.get(this.newRectangle).set(this.newRectangleStart, current);
    }

    onMouseUp() {
        if (this.isDragging) {
            const rectangle = this.rectangles.get(this.newRectangle);
            const imageArea = document.getElementById('imageArea');
            if (rectangle.lowerRight.x - rectangle.upperLeft.x < 5
                || rectangle.lowerRight.y - rectangle.upperLeft.y < 5) {
                this.rectangles.delete(this.newRectangle);
                imageArea.removeChild(document.getElementById(String(this.newRectangle)));
            } else {
                this.nextId++;
            }
            this.isDragging = false;
            this.newRectangle = null;
            this.newRectangleStart = null;
        }
    }

    updateFill() {
        const fillInput = document.getElementById('fill') as HTMLInputElement;
        this.fill = fillInput.value;
    }

    selectRectangle(id: number) {
        console.log('Selected rectangle:', id)
        this.selectedRectangle = id;
        document.getElementById('selectedId').innerText = String(id);
        document.getElementById('rectangleDeletion').style.display = 'block';
    }

    deselectRectangle() {
        if (this.selectedRectangle !== null) {
            this.selectedRectangle = null;
            document.getElementById('rectangleDeletion').style.display = 'none';
        }
    }

    deleteRectangle() {
        const id = this.selectedRectangle;
        if (id !== null) {
            this.rectangles.delete(id);
            document.getElementById('imageArea').removeChild(document.getElementById(String(id)));
            this.deselectRectangle()
        }
    }

    getJsonImage() {
        const rectangles = Array.from(this.rectangles.values()).map((rec) => {
            return {
                x: rec.upperLeft.x,
                y: rec.upperLeft.y,
                width: rec.lowerRight.x - rec.upperLeft.x,
                height: rec.lowerRight.y - rec.upperLeft.y,
                fill: rec.fill
            }
        });
        return {
            width: 120,
            height: 120,
            rectangles: rectangles
        }
    }

    saveToServer() {
        const json_data = JSON.stringify(this.getJsonImage());
        console.log("Sending data to server: ", json_data);
        fetch('http://localhost:8000/add_image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: json_data
        }).then((response) => {
            console.log(response);
        });
    }
}

new RectangleManager();