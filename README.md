https://github.com/user-attachments/assets/db1db761-909e-400a-ad48-bb72334a52d8

A website written using Vue.js, TypeScript and FastAPI.

There are three parts:
1. `image_creator` - and editor for creating images and posting them to the image_server
2. `image_server` - an API that serves images. It's designed not to be perfect. It can
      * return an image
      * return an error
      * return an image after a timeout
4. `client` - a webapp for viewing the images. When a new image is posted onto the server, a notification appears.
  This is possible thanks to websockets.

To use the `image_creator`, simply open `image_creator/index.html`.
To use the `image_server`, call `uvicorn server:app` in the subdirectory. Python packages `uvicorn`, `fastapi` and `websockets` need to be installed.
To use the `client`, call `yarn install` and then `yarn dev` in the subdirectory. You need to have `yarn` installed.
