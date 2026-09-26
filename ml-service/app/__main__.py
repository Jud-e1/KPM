# Allows: python -m app.worker from ml-service/
from app.worker import run_forever

if __name__ == "__main__":
    run_forever()
