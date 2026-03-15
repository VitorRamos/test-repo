from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

@app.get("/api/health")
def health():
    return {"status": "ok"}

app.mount("/", StaticFiles(directory="frontend/dist", html=True))
