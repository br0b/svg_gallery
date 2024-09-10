<script setup lang="ts">
import { Ref, ref, watch } from 'vue';

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

    constructor(pa: Point, pb: Point, fill: string) {
        this.upperLeft = new Point(Math.min(pa.x, pb.x), Math.min(pa.y, pb.y));
        this.lowerRight = new Point(Math.max(pa.x, pb.x), Math.max(pa.y, pb.y));
        this.fill = fill;
    }
}

class SVGImage {
    rectangles: Rectangle[];
    width: number;
    height: number;

    constructor(rectangles: Rectangle[], width: number, height: number) {
        this.rectangles = rectangles;
        this.width = width;
        this.height = height;
    }

    // Create a new SVG element
    createSVGElement(): SVGElement {
        const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg");
        svg.setAttribute("width", this.width.toString());
        svg.setAttribute("height", this.height.toString());

        // Add rectangles to the SVG element
        for (let rectangle of this.rectangles) {
            const rect = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "rect");
            rect.setAttribute("x", rectangle.upperLeft.x.toString());
            rect.setAttribute("y", rectangle.upperLeft.y.toString());
            rect.setAttribute("width", (rectangle.lowerRight.x - rectangle.upperLeft.x).toString());
            rect.setAttribute("height", (rectangle.lowerRight.y - rectangle.upperLeft.y).toString());
            rect.setAttribute("fill", rectangle.fill);
            svg.appendChild(rect);
        }

        return svg;
    }
}

class Image {
  id: number;
  tags: string[];
  content: SVGImage | Error | null = null;
  isDialogVisible: Boolean = false;

  constructor(id: number, tags: string[]) {
    this.id = id;
    this.tags = tags;
  }

  async showDialog() {
    this.isDialogVisible = true;
    if (this.content instanceof SVGImage) {
      return;
    }

    this.content = null;
    const url = new URL(`${IMAGE_ENDPOINT}/${this.id}`);
    this.content = await this.fetchSvgImage(url);
  }

  hideDialog() {
    this.isDialogVisible = false;
  }

  async fetchSvgImage(url: URL): Promise<SVGImage | Error> {
    // await fetch(ENDPOINT, settings).then(res => res.json())
    const response = await fetch(url, { method: "Get" })

    if (!response.ok) {
      return new Error(response.statusText);
    }

    const json = await response.json();
    let rectangles = [];
    for (let rectangle of json.rectangles) {
        rectangles.push(new Rectangle(
            new Point(rectangle.x, rectangle.y),
            new Point(rectangle.x + rectangle.width, rectangle.y + rectangle.height),
            rectangle.fill
        ));
    }

    return new SVGImage(rectangles, json.width, json.height);
}
}

class ImageInfo {
  id: number;
  tags: string[];
  time_of_creation: number;

  constructor(id: number, tags: string[], time_of_creation: number) {
    this.id = id;
    this.tags = tags;
    this.time_of_creation = time_of_creation;
  }
}

const IMAGES_INFO_ENDPOINT = new URL('http://localhost:8000/images_info');
const IMAGE_ENDPOINT = 'http://localhost:8000/image';
const WEBSOCKET_ENDPOINT = 'ws://localhost:8000/ws';
const images: Ref<Image[]> = ref([]);
const filteredImages: Ref<Image[]> = ref([]);
const nImagesToFetch = ref(0);
const displayedImages: Ref<Image[]> = ref([]);
const searchQuery = ref('');
const page = ref(1);
const nPages = ref(0);
const NImagesPerPage = 5;

async function fetchImagesInfo(url: URL): Promise<Image[]> {
  const images: Image[] = []
  const response = await fetch(url);
  const json = await response.json();
  json.forEach((imageInfo: ImageInfo) => {
    images.push(new Image(imageInfo.id, imageInfo.tags));
  });
  return images;
}

function switchPage(newPage: number) {
  const start = (newPage - 1) * NImagesPerPage;
  const end = start + NImagesPerPage;
  displayedImages.value = filteredImages.value.slice(start, end);
  console.log(displayedImages.value);
}

function filterImages() {
  if (searchQuery.value === '') {
    filteredImages.value = images.value;
  } else {
    const query = searchQuery.value.toLowerCase();
    filteredImages.value = images.value.filter((image) => {
      return query.split(' ').every((tag) => {
        return image.tags.includes(tag);
      });
    });
  }
  nPages.value = Math.ceil(filteredImages.value.length / NImagesPerPage);
  console.log(filteredImages.value);
  page.value = 1;
  switchPage(1);
}

function connect() {
    const ws = new WebSocket(WEBSOCKET_ENDPOINT);
    ws.onopen = () => {
        console.log("Connected to websocket server");
    };
    ws.onmessage = () => {
      nImagesToFetch.value += 1;
    };
    ws.onclose = () => {
        console.log("Disconnected from websocket server");
        console.log("Trying to reconnect in 5s");
        setTimeout(connect, 5000);
    };
    ws.onerror = (error) => {
        console.error(error);
        console.log("Trying to reconnect in 5s");
        setTimeout(connect, 5000);
    }
}

function updateImagesInfo(imagesInfoEndpoint: URL) {
  nImagesToFetch.value = 0;
  fetchImagesInfo(imagesInfoEndpoint).then((images_) => {
    images.value = images_;
    filteredImages.value = images_;
    nPages.value = Math.ceil(images_.length / NImagesPerPage);
    switchPage(page.value);
  });
}

updateImagesInfo(IMAGES_INFO_ENDPOINT);
watch(page, switchPage);
watch(searchQuery, filterImages);
connect();
</script>

<template>
  <v-card class="mx-auto" max-width="300">
    <template v-if="nImagesToFetch > 0">
      <v-chip color="red">{{ nImagesToFetch }} new images!</v-chip>
      <v-btn
      text="Refresh"
      color="light-blue"
      @click="updateImagesInfo(IMAGES_INFO_ENDPOINT)"></v-btn>
    </template>
    <v-text-field
      v-model="searchQuery"
      label="Search by tags"
      single-line
      hide-details
    ></v-text-field>
    <v-list class="mx-auto" max-width="300" bg-color="purple">
      <v-list-item
        v-for="image in displayedImages"
        base-color="black"
        :key="image.id"
        :title="image.id"
      >
        <template v-slot:default>
          <v-chip
            v-for="tag in image.tags"
            :key="tag"
            color="black"
            text-color="white">{{ tag }}
          </v-chip>
        </template>
        <template v-slot:append>
          <v-btn
            text="View"
            color="black"
            variant="text"
            @click="image.showDialog()"
          ></v-btn>

          <v-dialog v-model="image.isDialogVisible">
            <v-card class="mx-auto">
              <v-card-title>Image</v-card-title>
              <v-card-text class="d-flex justify-center">
                <svg v-if="image.content instanceof SVGImage"
                  xmlns="http://www.w3.org/2000/svg"
                  :width="image.content?.width"
                  :height="image.content?.height"
                >
                <template v-for="rectangle in image.content?.rectangles">
                  <rect
                    :x="rectangle.upperLeft.x"
                    :y="rectangle.upperLeft.y"
                    :width="rectangle.lowerRight.x - rectangle.upperLeft.x"
                    :height="rectangle.lowerRight.y - rectangle.upperLeft.y"
                    :fill="rectangle.fill"
                  />
                </template>
                </svg>
                <p v-else-if="image.content instanceof Error">{{ image.content.message }}</p>
                <!-- Spinner -->
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="7em" height="7em" viewBox="0 0 24 24"><path fill="currentColor" d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"><animateTransform attributeName="transform" dur="0.75s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/></path></svg>
              </v-card-text>
              <v-card-actions>
                <v-btn
                  class="ms-auto"
                  text="Ok"
                  @click="image.hideDialog()"
                ></v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </template>
      </v-list-item>
    </v-list>
  </v-card>
  <v-pagination v-model="page" :length="nPages"></v-pagination>
</template>
