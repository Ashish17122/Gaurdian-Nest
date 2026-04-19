"""
Test Atlas persistence: verify seed doesn't delete existing user data
"""
import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

frontend_env = Path(__file__).parent.parent.parent / "frontend" / ".env"
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestAtlasPersistence:
    """Verify MongoDB Atlas data persistence"""

    def test_seed_preserves_existing_users(self):
        """POST /api/dev/seed should NOT delete existing users"""
        # Create a test user
        login_resp = requests.post(f"{BASE_URL}/api/auth/mock-login", json={
            "email": "TEST_persistence_user@example.com",
            "name": "Persistence Test User",
            "role": "parent"
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["session_token"]
        user_id = login_resp.json()["user"]["user_id"]
        print(f"✓ Created test user: {user_id}")
        
        # Get initial user count
        headers = {"Authorization": f"Bearer {token}"}
        
        # Seed demo data
        seed_resp = requests.post(f"{BASE_URL}/api/dev/seed")
        assert seed_resp.status_code == 200
        print(f"✓ Seed completed: {seed_resp.json()}")
        
        # Verify our test user still exists
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_resp.status_code == 200
        assert me_resp.json()["user_id"] == user_id
        print(f"✓ Test user still exists after seed: {user_id}")
        
    def test_seed_preserves_children(self):
        """POST /api/dev/seed should NOT delete existing children"""
        # Create parent and child
        login_resp = requests.post(f"{BASE_URL}/api/auth/mock-login", json={
            "email": "TEST_parent_persist@example.com",
            "name": "Parent Persist",
            "role": "parent"
        })
        token = login_resp.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Pair a child
        child_resp = requests.post(f"{BASE_URL}/api/children/pair", 
                                   json={"device_name": "TEST_Persist_Child"}, 
                                   headers=headers)
        child_id = child_resp.json()["child_id"]
        print(f"✓ Created test child: {child_id}")
        
        # Seed
        requests.post(f"{BASE_URL}/api/dev/seed")
        
        # Verify child still exists
        children_resp = requests.get(f"{BASE_URL}/api/children", headers=headers)
        assert children_resp.status_code == 200
        children = children_resp.json()
        assert any(c["child_id"] == child_id for c in children)
        print(f"✓ Test child still exists after seed: {child_id}")
