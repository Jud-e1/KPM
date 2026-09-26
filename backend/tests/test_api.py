import os
import sys
import uuid
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import init_db
from app.main import app

init_db()


def _client():
    return TestClient(app)


def _signup(client, name="User"):
    email = f"{name.lower()}-{uuid.uuid4().hex[:8]}@kpm.test"
    res = client.post(
        "/api/v1/auth/signup",
        json={
            "email": email,
            "password": "password123",
            "full_name": name,
            "organization": f"{name} Co",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_root():
    with _client() as client:
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "version" in data
        assert data["docs"] == "/docs"


def test_health():
    with _client() as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert "database" in data
        assert data["database"]["connected"] is True


def test_auth_signup_signin_me():
    email = f"phase0-{uuid.uuid4().hex[:8]}@kpm.test"
    with _client() as client:
        signup = client.post(
            "/api/v1/auth/signup",
            json={
                "email": email,
                "password": "password123",
                "full_name": "Phase Zero",
                "organization": "Phase0 Co",
            },
        )
        assert signup.status_code == 201, signup.text
        token = signup.json()["access_token"]
        assert token
        assert signup.json()["user"]["email"] == email

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == email

        signin = client.post(
            "/api/v1/auth/signin",
            json={"email": email, "password": "password123"},
        )
        assert signin.status_code == 200
        assert signin.json()["access_token"]

        bad = client.post(
            "/api/v1/auth/signin",
            json={"email": email, "password": "wrong-password"},
        )
        assert bad.status_code == 401


def test_google_auth_mocked():
    with _client() as client:
        original = settings.GOOGLE_CLIENT_ID
        settings.GOOGLE_CLIENT_ID = "test-google-client.apps.googleusercontent.com"
        email = f"google-{uuid.uuid4().hex[:8]}@kpm.test"
        try:
            with patch("google.oauth2.id_token.verify_oauth2_token") as verify:
                verify.return_value = {
                    "iss": "https://accounts.google.com",
                    "email": email,
                    "email_verified": True,
                    "name": "Google User",
                }
                first = client.post("/api/v1/auth/google", json={"id_token": "fake.jwt.token.value.here"})
                assert first.status_code == 200, first.text
                assert first.json()["user"]["email"] == email
                token = first.json()["access_token"]
                me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
                assert me.status_code == 200

                second = client.post("/api/v1/auth/google", json={"id_token": "fake.jwt.token.value.here"})
                assert second.status_code == 200
                assert second.json()["user"]["id"] == first.json()["user"]["id"]
        finally:
            settings.GOOGLE_CLIENT_ID = original


def test_google_auth_unconfigured():
    with _client() as client:
        original = settings.GOOGLE_CLIENT_ID
        settings.GOOGLE_CLIENT_ID = None
        try:
            res = client.post("/api/v1/auth/google", json={"id_token": "fake.jwt.token.value.here"})
            assert res.status_code == 503
        finally:
            settings.GOOGLE_CLIENT_ID = original


def test_owner_isolation_customers_and_inventory():
    with _client() as client:
        a = _signup(client, "Alice")
        b = _signup(client, "Bob")
        ha = {"Authorization": f"Bearer {a['access_token']}"}
        hb = {"Authorization": f"Bearer {b['access_token']}"}

        ca = client.post(
            "/api/v1/partners/customers",
            headers=ha,
            json={"id": "cust-shared", "name": "A Cust", "email": "a@x.com", "company": "A"},
        )
        cb = client.post(
            "/api/v1/partners/customers",
            headers=hb,
            json={"id": "cust-shared", "name": "B Cust", "email": "b@x.com", "company": "B"},
        )
        assert ca.status_code == 201 and cb.status_code == 201
        assert ca.json()["name"] == "A Cust"
        assert cb.json()["name"] == "B Cust"

        la = client.get("/api/v1/partners/customers", headers=ha).json()
        lb = client.get("/api/v1/partners/customers", headers=hb).json()
        assert all(row["name"] != "B Cust" for row in la)
        assert all(row["name"] != "A Cust" for row in lb)

        sku = f"SKU-{uuid.uuid4().hex[:6]}"
        pa = client.post(
            "/api/v1/inventory/",
            headers=ha,
            json={"name": "Alice Widget", "sku": sku, "stock": 10, "price": 5},
        )
        pb = client.post(
            "/api/v1/inventory/",
            headers=hb,
            json={"name": "Bob Widget", "sku": sku, "stock": 3, "price": 9},
        )
        assert pa.status_code == 201, pa.text
        assert pb.status_code == 201, pb.text

        ia = client.get("/api/v1/inventory/", headers=ha).json()
        ib = client.get("/api/v1/inventory/", headers=hb).json()
        assert any(p["name"] == "Alice Widget" for p in ia)
        assert not any(p["name"] == "Bob Widget" for p in ia)
        assert any(p["name"] == "Bob Widget" for p in ib)
        assert not any(p["name"] == "Alice Widget" for p in ib)

        unauth = client.get("/api/v1/inventory/")
        assert unauth.status_code == 401


def test_sales_accounting_partners_happy_paths():
    with _client() as client:
        user = _signup(client, "Ops")
        headers = {"Authorization": f"Bearer {user['access_token']}"}

        order = client.post(
            "/api/v1/sales/",
            headers=headers,
            json={
                "order_number": f"SO-{uuid.uuid4().hex[:6]}",
                "customer_name": "Acme Buyer",
                "items_count": 2,
                "total_amount": 120.5,
                "status": "Completed",
            },
        )
        assert order.status_code == 201, order.text
        listed = client.get("/api/v1/sales/", headers=headers)
        assert listed.status_code == 200
        assert any(row["id"] == order.json()["id"] for row in listed.json())

        tx = client.post(
            "/api/v1/accounting/",
            headers=headers,
            json={
                "description": "Invoice payment",
                "category": "Sales",
                "account": "Operating",
                "transaction_type": "Income",
                "amount": 120.5,
                "status": "Cleared",
            },
        )
        assert tx.status_code == 201, tx.text

        supplier = client.post(
            "/api/v1/partners/suppliers",
            headers=headers,
            json={
                "id": f"sup-{uuid.uuid4().hex[:6]}",
                "name": "North Supplies",
                "email": "north@sup.test",
                "categories": ["Electronics"],
            },
        )
        assert supplier.status_code == 201, supplier.text


def test_insights_ask_rules_and_mocked_openai():
    with _client() as client:
        user = _signup(client, "Insight")
        headers = {"Authorization": f"Bearer {user['access_token']}"}

        rules = client.post(
            "/api/v1/insights/ask",
            headers=headers,
            json={"question": "How is inventory stock looking?"},
        )
        assert rules.status_code == 200, rules.text
        assert rules.json()["provider"] in ("rules", "openai")
        assert rules.json()["answer"]

        original_key = settings.OPENAI_API_KEY
        settings.OPENAI_API_KEY = "sk-test"
        try:
            with patch(
                "app.api.endpoints.insights.ask_openai",
                new=AsyncMock(return_value="LLM says stock is healthy."),
            ):
                llm = client.post(
                    "/api/v1/insights/ask",
                    headers=headers,
                    json={"question": "Summarize inventory health"},
                )
                assert llm.status_code == 200
                body = llm.json()
                assert body["answer"] == "LLM says stock is healthy."
                assert body["provider"] == "openai"
        finally:
            settings.OPENAI_API_KEY = original_key

        provider = client.get("/api/v1/insights/provider", headers=headers)
        assert provider.status_code == 200
        assert "provider" in provider.json()


def test_items_require_auth():
    with _client() as client:
        assert client.get("/api/v1/items/").status_code == 401
        user = _signup(client, "Items")
        headers = {"Authorization": f"Bearer {user['access_token']}"}
        listed = client.get("/api/v1/items/", headers=headers)
        assert listed.status_code == 200


if __name__ == "__main__":
    test_root()
    test_health()
    test_auth_signup_signin_me()
    test_google_auth_mocked()
    test_google_auth_unconfigured()
    test_owner_isolation_customers_and_inventory()
    test_sales_accounting_partners_happy_paths()
    test_insights_ask_rules_and_mocked_openai()
    test_items_require_auth()
    print("All backend tests completed successfully!")
