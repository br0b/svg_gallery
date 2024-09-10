import asyncio
import random
import time

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum

N_SAMPLE_IMAGES = 50
N_TAGS_PER_IMAGE = 3
IMAGE_AREA_WIDTH = 120
IMAGE_AREA_HEIGHT = 120
RESPONSE_DELAY = 3

class RectangleModel(BaseModel):
    x: int
    y: int
    width: int
    height: int
    fill: str

class ImageModel(BaseModel):
    width: int
    height: int
    rectangles: list[RectangleModel]

class ImageInfoModel(BaseModel):
    id: int
    tags: list[str]
    time_of_creation: int

class ImageRecord:
    def __init__(self, image: ImageModel, tags: list[str], time_of_creation: int):
        self.image = image
        self.tags = tags
        self.time_of_creation = time_of_creation

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


class ResponseType(Enum):
    STANDARD = 1
    DELAYED = 2
    BIG = 3
    ERROR = 4

def get_random_rectangle(image_area_width: int, image_area_height: int) -> RectangleModel:
    width = random.randint(1, image_area_width)
    height = random.randint(1, image_area_height)
    x = random.randint(0, image_area_width - width)
    y = random.randint(0, image_area_height - height)
    fill = f"#{random.randint(0, 0xFFFFFF):06x}"
    return RectangleModel(x=x, y=y, width=width, height=height, fill=fill)

def get_response_type() -> ResponseType:
    choice = random.randint(1, 3)
    if choice == 1:
        return ResponseType.STANDARD
    elif choice == 2:
        return ResponseType.DELAYED
    else:
        return ResponseType.ERROR

async def get_image_response(image: ImageModel) -> ImageModel:
    response_type = get_response_type()

    if response_type == ResponseType.DELAYED:
        await asyncio.sleep(RESPONSE_DELAY)
    elif response_type == ResponseType.ERROR:
        # Return status 500
        raise HTTPException(status_code=500)

    return image

def get_current_time() -> int:
    return int(time.time())

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()

# Instead of a database, we will use a map of images.
images: dict[int, ImageRecord] = {}
tags = ["tag" + str(i) for i in range(1, 11)]
next_id = 1

# add sample images to the map
for _ in range(N_SAMPLE_IMAGES):
    image = ImageModel(width=IMAGE_AREA_WIDTH, height=IMAGE_AREA_HEIGHT, rectangles=[])
    for _ in range(5):
        image.rectangles.append(get_random_rectangle(IMAGE_AREA_WIDTH, IMAGE_AREA_HEIGHT))
    images[next_id] = ImageRecord(image=image,
                                  tags=random.sample(tags, N_TAGS_PER_IMAGE),
                                  time_of_creation=get_current_time())
    next_id += 1

@app.get("/images_info", response_model=list[ImageInfoModel])
async def get_image_ids():
    return [ImageInfoModel(id=_id,
                           tags=images[_id].tags,
                           time_of_creation=images[_id].time_of_creation)
            for _id in images]

@app.get("/image/{image_id}", response_model=ImageModel)
async def get_image(image_id: int):
    if image_id not in images:
        raise HTTPException(status_code=404, detail="Image not found")
    return await get_image_response(images[image_id].image)

@app.post("/add_image", response_model=ImageInfoModel)
async def add_images(image: ImageModel):
    global next_id
    tags_ = random.sample(tags, N_TAGS_PER_IMAGE)
    images[next_id] = ImageRecord(image=image,
                                  tags=tags_,
                                  time_of_creation=get_current_time())

    # Broadcast the new image to all connected clients
    await manager.broadcast(str(next_id))

    next_id += 1
    return ImageInfoModel(id=next_id - 1, tags=tags_, time_of_creation=get_current_time())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)