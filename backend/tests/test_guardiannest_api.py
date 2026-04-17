"""
GuardianNest Backend API Tests
Tests all endpoints: health, auth, parent, child, activity, monitoring, admin, payments
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / "frontend" / ".env"
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not set in frontend/.env")

class TestHealth:
    """Health check and config endpoints"""

    def test_root_endpoint(self):
        """GET /api/ returns service info with premium_enabled"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "premium_enabled" in data
        assert data["premium_enabled"] == False  # Initially false
        print(f"✓ Root endpoint OK: premium_enabled={data['premium_enabled']}")

    def test_public_config(self):
        """GET /api/config/public returns app config"""
        response = requests.get(f"{BASE_URL}/api/config/public")
        assert response.status_code == 200
        data = response.json()
        assert data["app_name"] == "GuardianNest"
        assert "premium_enabled" in data
        print("✓ Public config OK")


class TestSeed:
    """Seed demo data"""

    def test_seed_demo_data(self):
        """POST /api/dev/seed creates demo data"""
        response = requests.post(f"{BASE_URL}/api/dev/seed")
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] == True
        assert "activity_seeded" in data
        assert "leads_seeded" in data
        print(f"✓ Seed OK: {data['activity_seeded']} activities, {data['leads_seeded']} leads")


class TestAuth:
    """Authentication flows"""

    def test_mock_login_parent(self):
        """POST /api/auth/mock-login as parent returns session"""
        response = requests.post(f"{BASE_URL}/api/auth/mock-login", json={
            "email": "demo.parent@guardiannest.app",
            "name": "Demo Parent",
            "role": "parent"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["email"] == "demo.parent@guardiannest.app"
        assert data["user"]["role"] == "parent"
        assert data["user"]["is_admin"] == False
        print(f"✓ Parent login OK: {data['user']['email']}")

    def test_mock_login_admin_with_code(self):
        """POST /api/auth/mock-login with admin_code=999000 returns is_admin=true"""
        response = requests.post(f"{BASE_URL}/api/auth/mock-login", json={
            "email": "admin@guardiannest.app",
            "name": "Admin User",
            "role": "admin",
            "admin_code": "999000"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["is_admin"] == True
        assert data["user"]["role"] == "admin"
        assert "session_token" in data
        print(f"✓ Admin login OK: is_admin={data['user']['is_admin']}")

    def test_mock_login_without_admin_code(self):
        """POST /api/auth/mock-login without admin_code returns role=parent"""
        response = requests.post(f"{BASE_URL}/api/auth/mock-login", json={
            "email": "test.user@example.com",
            "name": "Test User",
            "role": "parent"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "parent"
        assert data["user"]["is_admin"] == False
        print("✓ Non-admin login OK")

    def test_auth_me_without_token(self):
        """GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Auth guard working (401 without token)")


@pytest.fixture
def parent_session():
    """Create parent session for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/mock-login", json={
        "email": "test.parent.pytest@example.com",
        "name": "Test Parent",
        "role": "parent"
    })
    assert response.status_code == 200
    return response.json()["session_token"]


@pytest.fixture
def admin_session():
    """Create admin session for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/mock-login", json={
        "email": "test.admin.pytest@example.com",
        "name": "Test Admin",
        "role": "admin",
        "admin_code": "999000"
    })
    assert response.status_code == 200
    return response.json()["session_token"]


class TestParentPIN:
    """Parent PIN lock endpoints"""

    def test_set_pin_success(self, parent_session):
        """POST /api/parent/set-pin with valid PIN"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        response = requests.post(f"{BASE_URL}/api/parent/set-pin", 
                                json={"pin": "1234"}, headers=headers)
        assert response.status_code == 200
        assert response.json()["ok"] == True
        print("✓ Set PIN OK")

    def test_set_pin_too_short(self, parent_session):
        """POST /api/parent/set-pin with short PIN returns 400"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        response = requests.post(f"{BASE_URL}/api/parent/set-pin", 
                                json={"pin": "12"}, headers=headers)
        assert response.status_code == 400
        print("✓ Short PIN rejected (400)")

    def test_verify_pin_success(self, parent_session):
        """POST /api/parent/verify-pin with correct PIN"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        # Set PIN first
        requests.post(f"{BASE_URL}/api/parent/set-pin", 
                     json={"pin": "5678"}, headers=headers)
        # Verify
        response = requests.post(f"{BASE_URL}/api/parent/verify-pin", 
                                json={"pin": "5678"}, headers=headers)
        assert response.status_code == 200
        assert response.json()["ok"] == True
        print("✓ Verify PIN OK")

    def test_verify_pin_incorrect(self, parent_session):
        """POST /api/parent/verify-pin with wrong PIN returns 401"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        # Set PIN first
        requests.post(f"{BASE_URL}/api/parent/set-pin", 
                     json={"pin": "9999"}, headers=headers)
        # Try wrong PIN
        response = requests.post(f"{BASE_URL}/api/parent/verify-pin", 
                                json={"pin": "0000"}, headers=headers)
        assert response.status_code == 401
        print("✓ Wrong PIN rejected (401)")


class TestChildren:
    """Child device pairing"""

    def test_pair_child_device(self, parent_session):
        """POST /api/children/pair creates child device"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        response = requests.post(f"{BASE_URL}/api/children/pair", 
                                json={"device_name": "TEST_Child_Phone"}, 
                                headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "child_id" in data
        assert data["device_name"] == "TEST_Child_Phone"
        assert "pairing_code" in data
        assert data["monitoring_active"] == True
        print(f"✓ Pair child OK: {data['child_id']}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/children", headers=headers)
        assert get_response.status_code == 200
        children = get_response.json()
        assert any(c["child_id"] == data["child_id"] for c in children)
        print("✓ Child persisted in database")

    def test_list_children(self, parent_session):
        """GET /api/children returns list"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        response = requests.get(f"{BASE_URL}/api/children", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List children OK: {len(data)} children")


class TestActivity:
    """Activity logging and summary"""

    def test_log_activity(self, parent_session):
        """POST /api/activity/log creates activity log"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        # Create child first
        child_resp = requests.post(f"{BASE_URL}/api/children/pair", 
                                   json={"device_name": "TEST_Activity_Phone"}, 
                                   headers=headers)
        child_id = child_resp.json()["child_id"]
        
        # Log activity
        response = requests.post(f"{BASE_URL}/api/activity/log", json={
            "child_id": child_id,
            "app_name": "YouTube",
            "duration_seconds": 3600
        }, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["child_id"] == child_id
        assert data["app_name"] == "YouTube"
        assert data["duration_seconds"] == 3600
        print(f"✓ Log activity OK: {data['log_id']}")

    def test_activity_summary(self, parent_session):
        """GET /api/activity/summary/{child_id} returns summary"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        # Create child and log activity
        child_resp = requests.post(f"{BASE_URL}/api/children/pair", 
                                   json={"device_name": "TEST_Summary_Phone"}, 
                                   headers=headers)
        child_id = child_resp.json()["child_id"]
        
        requests.post(f"{BASE_URL}/api/activity/log", json={
            "child_id": child_id,
            "app_name": "Instagram",
            "duration_seconds": 1800
        }, headers=headers)
        
        # Get summary
        response = requests.get(f"{BASE_URL}/api/activity/summary/{child_id}", 
                               headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["child_id"] == child_id
        assert "total_minutes" in data
        assert "per_app_minutes" in data
        assert "daily" in data
        print(f"✓ Activity summary OK: {data['total_minutes']} total minutes")


class TestMonitoring:
    """Monitoring heartbeat and alerts"""

    def test_heartbeat_monitoring_disabled_creates_alert(self, parent_session):
        """POST /api/monitoring/heartbeat with monitoring_active=false creates alert"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        # Create child
        child_resp = requests.post(f"{BASE_URL}/api/children/pair", 
                                   json={"device_name": "TEST_Alert_Phone"}, 
                                   headers=headers)
        child_id = child_resp.json()["child_id"]
        
        # Send heartbeat with monitoring disabled
        response = requests.post(f"{BASE_URL}/api/monitoring/heartbeat", json={
            "child_id": child_id,
            "monitoring_active": False
        })
        assert response.status_code == 200
        assert response.json()["ok"] == True
        print("✓ Heartbeat OK (monitoring disabled)")
        
        # Check alerts
        alerts_resp = requests.get(f"{BASE_URL}/api/alerts", headers=headers)
        assert alerts_resp.status_code == 200
        alerts = alerts_resp.json()
        assert any(a["type"] == "MONITORING_DISABLED" and a["child_id"] == child_id 
                  for a in alerts)
        print("✓ Alert created for disabled monitoring")

    def test_list_alerts(self, parent_session):
        """GET /api/alerts returns alerts list"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        response = requests.get(f"{BASE_URL}/api/alerts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List alerts OK: {len(data)} alerts")


class TestAdmin:
    """Admin analytics and leads"""

    def test_admin_stats_requires_admin(self, parent_session):
        """GET /api/admin/stats returns 403 for non-admin"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 403
        print("✓ Admin guard working (403 for non-admin)")

    def test_admin_stats_success(self, admin_session):
        """GET /api/admin/stats returns KPIs for admin"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "new_users_in_window" in data
        assert "active_users_7d" in data
        assert "total_leads" in data
        assert "conversion_rate" in data
        assert "signup_trend" in data
        assert "premium_enabled" in data
        print(f"✓ Admin stats OK: {data['total_users']} users, {data['total_leads']} leads")

    def test_admin_leads_no_filters(self, admin_session):
        """GET /api/admin/leads returns leads list"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/admin/leads", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "rows" in data
        assert isinstance(data["rows"], list)
        print(f"✓ Admin leads OK: {data['total']} total leads")

    def test_admin_leads_with_filters(self, admin_session):
        """GET /api/admin/leads with query filters"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        # Test with search query
        response = requests.get(f"{BASE_URL}/api/admin/leads?q=demo", headers=headers)
        assert response.status_code == 200
        
        # Test with source filter
        response = requests.get(f"{BASE_URL}/api/admin/leads?source=google_signup", 
                               headers=headers)
        assert response.status_code == 200
        
        # Test with date filters
        from_date = (datetime.now() - timedelta(days=30)).isoformat()
        to_date = datetime.now().isoformat()
        response = requests.get(
            f"{BASE_URL}/api/admin/leads?from_date={from_date}&to_date={to_date}", 
            headers=headers
        )
        assert response.status_code == 200
        print("✓ Admin leads filters OK")


class TestPremiumToggle:
    """Premium feature flag toggle"""

    def test_premium_toggle_on_then_off(self, admin_session):
        """POST /api/admin/premium/toggle flips flag"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        # Toggle ON
        response = requests.post(f"{BASE_URL}/api/admin/premium/toggle", 
                                json={"enabled": True}, headers=headers)
        assert response.status_code == 200
        assert response.json()["premium_enabled"] == True
        print("✓ Premium toggled ON")
        
        # Verify via root endpoint
        root_resp = requests.get(f"{BASE_URL}/api/")
        assert root_resp.json()["premium_enabled"] == True
        
        # Toggle OFF (reset)
        response = requests.post(f"{BASE_URL}/api/admin/premium/toggle", 
                                json={"enabled": False}, headers=headers)
        assert response.status_code == 200
        assert response.json()["premium_enabled"] == False
        print("✓ Premium toggled OFF (reset)")

    def test_premium_config(self, admin_session):
        """GET /api/admin/premium/config returns config"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/admin/premium/config", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "premium_enabled" in data
        assert "razorpay_linked" in data
        assert "razorpay_key_id_preview" in data
        print(f"✓ Premium config OK: razorpay_linked={data['razorpay_linked']}")


class TestPayments:
    """Razorpay payment endpoints (expect 503 when disabled or keys missing)"""

    def test_create_order_when_premium_disabled(self, parent_session):
        """POST /api/payments/create-order returns 503 when PREMIUM_ENABLED=false"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        response = requests.post(f"{BASE_URL}/api/payments/create-order", 
                                json={"plan": "monthly"}, headers=headers)
        # Should be 503 because premium is disabled OR keys are missing
        assert response.status_code == 503
        print("✓ Create order blocked (503) when premium disabled or keys missing")

    def test_verify_payment_when_premium_disabled(self, parent_session):
        """POST /api/payments/verify returns 503 when disabled"""
        headers = {"Authorization": f"Bearer {parent_session}"}
        response = requests.post(f"{BASE_URL}/api/payments/verify", json={
            "razorpay_order_id": "order_test",
            "razorpay_payment_id": "pay_test",
            "razorpay_signature": "bad_signature"
        }, headers=headers)
        assert response.status_code == 503
        print("✓ Verify payment blocked (503) when premium disabled or keys missing")

    def test_verify_payment_bad_signature_when_enabled(self, admin_session, parent_session):
        """POST /api/payments/verify rejects bad signature (if premium enabled + keys present)"""
        # First enable premium
        admin_headers = {"Authorization": f"Bearer {admin_session}"}
        requests.post(f"{BASE_URL}/api/admin/premium/toggle", 
                     json={"enabled": True}, headers=admin_headers)
        
        # Try to verify with bad signature
        parent_headers = {"Authorization": f"Bearer {parent_session}"}
        response = requests.post(f"{BASE_URL}/api/payments/verify", json={
            "razorpay_order_id": "order_fake",
            "razorpay_payment_id": "pay_fake",
            "razorpay_signature": "invalid_sig"
        }, headers=parent_headers)
        
        # If keys are missing, expect 503; if keys present, expect 400 (bad signature)
        assert response.status_code in [400, 503]
        print(f"✓ Verify payment validation OK (status={response.status_code})")
        
        # Reset premium to false
        requests.post(f"{BASE_URL}/api/admin/premium/toggle", 
                     json={"enabled": False}, headers=admin_headers)
        print("✓ Premium reset to false")
