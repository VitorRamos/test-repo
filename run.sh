#!/bin/bash

pushd frontend
npm run build --watch &
popd

docker run \
  -p 8000:8000 \
  -v $(pwd)/backend:/app/backend \
  -v $(pwd)/frontend/dist:/app/frontend/dist \
  instructor \
  uvicorn backend.app.main:app --reload --host 0.0.0.0
