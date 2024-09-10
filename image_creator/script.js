var Point = /** @class */ (function () {
    function Point(x, y) {
        this.x = x;
        this.y = y;
    }
    return Point;
}());
var Rectangle = /** @class */ (function () {
    function Rectangle(id, upperLeft, lowerRight, fill) {
        this.fill = fill;
        this.initSvgElement();
        this.set(upperLeft, lowerRight);
        this.svgElement.setAttribute('id', String(id));
    }
    Rectangle.prototype.initSvgElement = function () {
        this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.svgElement.setAttribute('fill', this.fill);
    };
    Rectangle.prototype.set = function (pa, pb) {
        this.upperLeft = new Point(Math.min(pa.x, pb.x), Math.min(pa.y, pb.y));
        this.lowerRight = new Point(Math.max(pa.x, pb.x), Math.max(pa.y, pb.y));
        this.svgElement.setAttribute('x', String(this.upperLeft.x));
        this.svgElement.setAttribute('y', String(this.upperLeft.y));
        this.svgElement.setAttribute('width', String(this.lowerRight.x - this.upperLeft.x));
        this.svgElement.setAttribute('height', String(this.lowerRight.y - this.upperLeft.y));
    };
    return Rectangle;
}());
var RectangleManager = /** @class */ (function () {
    function RectangleManager() {
        this.newRectangle = null;
        this.newRectangleStart = null;
        this.selectedRectangle = null;
        this.isDragging = false;
        this.rectangles = new Map();
        this.nextId = 0;
        this.updateFill();
        this.initEventListeners();
        console.log('Event listeners initialized');
    }
    RectangleManager.prototype.initEventListeners = function () {
        var svg = document.getElementById('imageArea');
        var rectangleForm = document.getElementById('rectangleForm');
        var fillInput = document.getElementById('fill');
        var postBtn = document.getElementById('postBtn');
        var deleteBtn = document.getElementById('deleteBtn');
        svg.addEventListener('mousedown', this.onMouseDown.bind(this));
        svg.addEventListener('mousemove', this.onMouseMove.bind(this));
        svg.addEventListener('mouseup', this.onMouseUp.bind(this));
        rectangleForm.addEventListener('submit', this.addRectangleFromForm.bind(this));
        fillInput.addEventListener('change', this.updateFill.bind(this));
        postBtn.addEventListener('click', this.saveToServer.bind(this));
        deleteBtn.addEventListener('click', this.deleteRectangle.bind(this));
    };
    RectangleManager.prototype.onMouseDown = function (event) {
        if (event.target instanceof SVGRectElement) {
            var rectangle = event.target;
            var id = Number(rectangle.id);
            this.selectRectangle(id);
        }
        else {
            this.deselectRectangle();
            this.addRectangleByClick(event);
        }
    };
    RectangleManager.prototype.addRectangleFromForm = function (event) {
        event.preventDefault();
        var rectangleForm = document.getElementById('rectangleForm');
        var upperLeft = new Point(Number(rectangleForm.x1.value), Number(rectangleForm.y1.value));
        var lowerRight = new Point(Number(rectangleForm.x2.value), Number(rectangleForm.y2.value));
        console.log(upperLeft, lowerRight);
        this.addRectangle(upperLeft, lowerRight, this.fill);
        this.newRectangle = null;
    };
    RectangleManager.prototype.addRectangleByClick = function (event) {
        console.log('New rectangle added:', this.nextId);
        this.isDragging = true;
        this.newRectangleStart = new Point(event.offsetX, event.offsetY);
        this.addRectangle(this.newRectangleStart, this.newRectangleStart, this.fill);
    };
    RectangleManager.prototype.addRectangle = function (pa, pb, fill) {
        var svg = document.getElementById('imageArea');
        var newRec = new Rectangle(this.nextId, pa, pb, fill);
        svg.appendChild(newRec.svgElement);
        this.rectangles.set(this.nextId, newRec);
        this.newRectangle = this.nextId;
    };
    RectangleManager.prototype.onMouseMove = function (event) {
        if (this.isDragging == null || this.newRectangle == null) {
            return;
        }
        var current = new Point(event.offsetX, event.offsetY);
        this.rectangles.get(this.newRectangle).set(this.newRectangleStart, current);
    };
    RectangleManager.prototype.onMouseUp = function () {
        if (this.isDragging) {
            var rectangle = this.rectangles.get(this.newRectangle);
            var imageArea = document.getElementById('imageArea');
            if (rectangle.lowerRight.x - rectangle.upperLeft.x < 5
                || rectangle.lowerRight.y - rectangle.upperLeft.y < 5) {
                this.rectangles.delete(this.newRectangle);
                imageArea.removeChild(document.getElementById(String(this.newRectangle)));
            }
            else {
                this.nextId++;
            }
            this.isDragging = false;
            this.newRectangle = null;
            this.newRectangleStart = null;
        }
    };
    RectangleManager.prototype.updateFill = function () {
        var fillInput = document.getElementById('fill');
        this.fill = fillInput.value;
    };
    RectangleManager.prototype.selectRectangle = function (id) {
        console.log('Selected rectangle:', id);
        this.selectedRectangle = id;
        document.getElementById('selectedId').innerText = String(id);
        document.getElementById('rectangleDeletion').style.display = 'block';
    };
    RectangleManager.prototype.deselectRectangle = function () {
        if (this.selectedRectangle !== null) {
            this.selectedRectangle = null;
            document.getElementById('rectangleDeletion').style.display = 'none';
        }
    };
    RectangleManager.prototype.deleteRectangle = function () {
        var id = this.selectedRectangle;
        if (id !== null) {
            this.rectangles.delete(id);
            document.getElementById('imageArea').removeChild(document.getElementById(String(id)));
            this.deselectRectangle();
        }
    };
    RectangleManager.prototype.getJsonImage = function () {
        var rectangles = Array.from(this.rectangles.values()).map(function (rec) {
            return {
                x: rec.upperLeft.x,
                y: rec.upperLeft.y,
                width: rec.lowerRight.x - rec.upperLeft.x,
                height: rec.lowerRight.y - rec.upperLeft.y,
                fill: rec.fill
            };
        });
        return {
            width: 120,
            height: 120,
            rectangles: rectangles
        };
    };
    RectangleManager.prototype.saveToServer = function () {
        var json_data = JSON.stringify(this.getJsonImage());
        console.log("Sending data to server: ", json_data);
        fetch('http://localhost:8000/add_image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: json_data
        }).then(function (response) {
            console.log(response);
        });
    };
    return RectangleManager;
}());
new RectangleManager();
