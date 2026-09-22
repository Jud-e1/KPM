import os
import sys

# Ensure backend root is on Python module search path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert data["docs"] == "/docs"
    print("[OK] Root endpoint passed:", data)


def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "database" in data
    print("[OK] Health endpoint passed:", data)


if __name__ == "__main__":
    test_root()
    test_health()
    print("All backend tests completed successfully!")
