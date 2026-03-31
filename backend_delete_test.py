#!/usr/bin/env python3
"""
DCAPP V1 - Delete Operations Testing Script

Tests specific delete operations according to the review request:
1. DELETE Lead (Gerente de Ventas Digitales) - should return 200
2. DELETE Lead (Director) - should return 403  
3. DELETE User Permanent (Gerente de Ventas Digitales) - should return 200
4. DELETE User (Director) - should return 403

Test Credentials:
- Gerente Ventas Digitales: gerente.ventas.digital@dcapp.com / dcapp123
- Director: director@dcapp.com / dcapp123
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend env
BACKEND_URL = "https://dcapp-sales-hub.preview.emergentagent.com/api"

# Test Credentials from review request
CREDENTIALS = {
    "gerente_ventas_digital": {
        "email": "gerente.ventas.digital@dcapp.com", 
        "password": "dcapp123"
    },
    "director": {
        "email": "director@dcapp.com", 
        "password": "dcapp123"
    }
}

class TestResults:
    def __init__(self):
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        self.test_log = []
        
    def log(self, message):
        """Log detailed test information"""
        self.test_log.append(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        print(message)
        
    def assert_test(self, condition, test_name, details=""):
        if condition:
            self.log(f"✅ {test_name}")
            self.tests_passed += 1
        else:
            self.log(f"❌ {test_name} - {details}")
            self.tests_failed += 1
            self.failures.append(f"{test_name}: {details}")
    
    def assert_status_code(self, response, expected_code, test_name):
        actual_code = response.status_code
        if actual_code == expected_code:
            self.log(f"✅ {test_name} (HTTP {actual_code})")
            self.tests_passed += 1
            return True
        else:
            try:
                error_detail = response.json().get('detail', response.text[:200])
                self.log(f"❌ {test_name} - Expected HTTP {expected_code}, got {actual_code}")
                self.log(f"    Response: {error_detail}")
            except:
                self.log(f"❌ {test_name} - Expected HTTP {expected_code}, got {actual_code}")
                self.log(f"    Response: {response.text[:200]}")
            
            self.tests_failed += 1
            self.failures.append(f"{test_name}: Expected {expected_code}, got {actual_code}")
            return False
    
    def assert_response_message(self, response, expected_message, test_name):
        """Check if response contains expected message"""
        if response.status_code == 200:
            try:
                response_data = response.json()
                actual_message = response_data.get('message', '')
                if expected_message in actual_message:
                    self.log(f"✅ {test_name} - Message: '{actual_message}'")
                    self.tests_passed += 1
                    return True
                else:
                    self.log(f"❌ {test_name} - Expected message containing '{expected_message}', got '{actual_message}'")
                    self.tests_failed += 1
                    self.failures.append(f"{test_name}: Wrong message - Expected '{expected_message}', got '{actual_message}'")
                    return False
            except Exception as e:
                self.log(f"❌ {test_name} - Error parsing response: {e}")
                self.tests_failed += 1
                self.failures.append(f"{test_name}: Error parsing response")
                return False
        return False
            
    def summary(self):
        total = self.tests_passed + self.tests_failed
        success_rate = (self.tests_passed / total * 100) if total > 0 else 0
        
        print(f"\n{'='*80}")
        print(f"DELETE OPERATIONS TEST SUMMARY: {self.tests_passed}/{total} tests passed ({success_rate:.1f}%)")
        print(f"{'='*80}")
        
        if self.failures:
            print("\n🚨 FAILED TESTS:")
            for i, failure in enumerate(self.failures, 1):
                print(f"{i}. {failure}")
        
        return len(self.failures) == 0

def login_user(credentials):
    """Login and return access token"""
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=credentials, timeout=10)
        if response.status_code == 200:
            token_data = response.json()
            print(f"✅ Login successful for {credentials['email']}")
            return token_data["access_token"]
        else:
            print(f"❌ Login failed for {credentials['email']}: {response.status_code}")
            try:
                error = response.json().get('detail', response.text)
                print(f"    Error: {error}")
            except:
                print(f"    Response: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Login error for {credentials['email']}: {e}")
        return None

def get_auth_headers(token):
    """Get authorization headers with token"""
    return {"Authorization": f"Bearer {token}"}

def create_test_lead(token, results):
    """Create a test lead for deletion testing"""
    headers = get_auth_headers(token)
    
    # Get current user info to use as DCA
    try:
        me_response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers, timeout=10)
        if me_response.status_code != 200:
            results.log("❌ Failed to get current user info for test lead creation")
            return None
            
        user_info = me_response.json()
        
        # Create test lead data
        lead_data = {
            "name": f"Test Lead for Delete {datetime.now().strftime('%H%M%S')}",
            "phone": "1234567890",
            "agency": "Meridien",
            "origin": "Facebook",
            "campaign": "Delete Test Campaign",
            "dca_id": user_info["id"]
        }
        
        response = requests.post(f"{BACKEND_URL}/leads", json=lead_data, headers=headers, timeout=10)
        if response.status_code == 200:
            lead = response.json()
            results.log(f"✅ Test lead created with ID: {lead['id']}")
            return lead["id"]
        else:
            results.log(f"❌ Failed to create test lead: {response.status_code}")
            try:
                error = response.json().get('detail', response.text)
                results.log(f"    Error: {error}")
            except:
                pass
            return None
            
    except Exception as e:
        results.log(f"❌ Error creating test lead: {e}")
        return None

def create_test_user(token, results):
    """Create a test user for deletion testing"""
    headers = get_auth_headers(token)
    
    try:
        # Create test user data
        user_data = {
            "email": f"test.delete.user.{datetime.now().strftime('%H%M%S')}@dcapp.com",
            "password": "testpass123",
            "name": f"Test Delete User {datetime.now().strftime('%H%M%S')}",
            "role": "DCA",
            "agency": "Meridien"
        }
        
        response = requests.post(f"{BACKEND_URL}/users", json=user_data, headers=headers, timeout=10)
        if response.status_code == 200:
            user = response.json()
            results.log(f"✅ Test user created with ID: {user['id']}")
            return user["id"]
        else:
            results.log(f"❌ Failed to create test user: {response.status_code}")
            try:
                error = response.json().get('detail', response.text)
                results.log(f"    Error: {error}")
            except:
                pass
            return None
            
    except Exception as e:
        results.log(f"❌ Error creating test user: {e}")
        return None

def test_gerente_delete_lead():
    """Test 1: DELETE Lead (Gerente de Ventas Digitales) - should return 200"""
    print("\n" + "="*80)
    print("TEST 1: DELETE Lead (Gerente de Ventas Digitales)")
    print("="*80)
    
    results = TestResults()
    
    # Login as Gerente de Ventas Digitales
    token = login_user(CREDENTIALS["gerente_ventas_digital"])
    if not token:
        results.assert_test(False, "Login as Gerente de Ventas Digitales", "Failed to login")
        return results
    
    headers = get_auth_headers(token)
    
    # Create a test lead
    lead_id = create_test_lead(token, results)
    if not lead_id:
        results.assert_test(False, "Create test lead", "Could not create test lead for deletion")
        return results
    
    # Delete the lead
    try:
        response = requests.delete(f"{BACKEND_URL}/leads/{lead_id}", headers=headers, timeout=10)
        success = results.assert_status_code(response, 200, "DELETE /api/leads/{id} by Gerente de Ventas Digitales")
        
        if success:
            results.assert_response_message(response, "Lead eliminado correctamente", "Verify deletion success message")
    except Exception as e:
        results.assert_test(False, "DELETE /api/leads/{id}", f"Request error: {e}")
    
    return results

def test_director_delete_lead_blocked():
    """Test 2: DELETE Lead (Director) - should return 403"""  
    print("\n" + "="*80)
    print("TEST 2: DELETE Lead (Director) - Should be BLOCKED")
    print("="*80)
    
    results = TestResults()
    
    # First, create a test lead using Gerente de Ventas Digitales
    gerente_token = login_user(CREDENTIALS["gerente_ventas_digital"])
    if not gerente_token:
        results.assert_test(False, "Login as Gerente de Ventas Digitales for setup", "Failed to login")
        return results
    
    lead_id = create_test_lead(gerente_token, results)
    if not lead_id:
        results.assert_test(False, "Create test lead for Director deletion test", "Could not create test lead")
        return results
    
    # Now login as Director and try to delete
    director_token = login_user(CREDENTIALS["director"])
    if not director_token:
        results.assert_test(False, "Login as Director", "Failed to login")
        return results
    
    headers = get_auth_headers(director_token)
    
    # Try to delete the lead (should be blocked with 403)
    try:
        response = requests.delete(f"{BACKEND_URL}/leads/{lead_id}", headers=headers, timeout=10)
        results.assert_status_code(response, 403, "DELETE /api/leads/{id} blocked for Director")
    except Exception as e:
        results.assert_test(False, "DELETE /api/leads/{id} (should be blocked)", f"Request error: {e}")
    
    return results

def test_gerente_delete_user_permanent():
    """Test 3: DELETE User Permanent (Gerente de Ventas Digitales) - should return 200"""
    print("\n" + "="*80) 
    print("TEST 3: DELETE User Permanent (Gerente de Ventas Digitales)")
    print("="*80)
    
    results = TestResults()
    
    # Login as Gerente de Ventas Digitales
    token = login_user(CREDENTIALS["gerente_ventas_digital"])
    if not token:
        results.assert_test(False, "Login as Gerente de Ventas Digitales", "Failed to login")
        return results
    
    headers = get_auth_headers(token)
    
    # Create a test user
    user_id = create_test_user(token, results)
    if not user_id:
        results.assert_test(False, "Create test user", "Could not create test user for deletion")
        return results
    
    # Delete the user permanently
    try:
        response = requests.delete(f"{BACKEND_URL}/users/{user_id}/permanent", headers=headers, timeout=10)
        success = results.assert_status_code(response, 200, "DELETE /api/users/{id}/permanent by Gerente de Ventas Digitales")
        
        if success:
            results.assert_response_message(response, "Usuario eliminado permanentemente", "Verify permanent deletion success message")
    except Exception as e:
        results.assert_test(False, "DELETE /api/users/{id}/permanent", f"Request error: {e}")
    
    return results

def test_director_delete_user_blocked():
    """Test 4: DELETE User (Director) - should return 403"""
    print("\n" + "="*80)
    print("TEST 4: DELETE User (Director) - Should be BLOCKED")
    print("="*80)
    
    results = TestResults()
    
    # First, create a test user using Gerente de Ventas Digitales
    gerente_token = login_user(CREDENTIALS["gerente_ventas_digital"])
    if not gerente_token:
        results.assert_test(False, "Login as Gerente de Ventas Digitales for setup", "Failed to login")
        return results
    
    user_id = create_test_user(gerente_token, results)
    if not user_id:
        results.assert_test(False, "Create test user for Director deletion test", "Could not create test user")
        return results
    
    # Now login as Director and try to delete
    director_token = login_user(CREDENTIALS["director"])
    if not director_token:
        results.assert_test(False, "Login as Director", "Failed to login")
        return results
    
    headers = get_auth_headers(director_token)
    
    # Try to delete the user permanently (should be blocked with 403)
    try:
        response = requests.delete(f"{BACKEND_URL}/users/{user_id}/permanent", headers=headers, timeout=10)
        results.assert_status_code(response, 403, "DELETE /api/users/{id}/permanent blocked for Director")
    except Exception as e:
        results.assert_test(False, "DELETE /api/users/{id}/permanent (should be blocked)", f"Request error: {e}")
    
    return results

def main():
    """Run all delete operation tests"""
    print("🗑️  DCAPP V1 - Delete Operations Testing")
    print("="*80)
    print("Testing delete functionality with role-based permissions")
    print("="*80)
    
    # Test backend connectivity
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        if response.status_code != 200:
            print(f"❌ Backend not accessible: HTTP {response.status_code}")
            sys.exit(1)
        print(f"✅ Backend accessible at {BACKEND_URL}")
    except Exception as e:
        print(f"❌ Backend connection error: {e}")
        sys.exit(1)
    
    # Initialize overall results
    overall_results = TestResults()
    
    # Run all delete operation tests
    test_suites = [
        test_gerente_delete_lead,
        test_director_delete_lead_blocked,
        test_gerente_delete_user_permanent, 
        test_director_delete_user_blocked
    ]
    
    for test_suite in test_suites:
        suite_results = test_suite()
        overall_results.tests_passed += suite_results.tests_passed
        overall_results.tests_failed += suite_results.tests_failed
        overall_results.failures.extend(suite_results.failures)
    
    # Final summary
    success = overall_results.summary()
    
    if success:
        print("\n🎉 ALL DELETE OPERATION TESTS PASSED!")
        print("✅ Delete permissions working correctly according to role restrictions")
        sys.exit(0)
    else:
        print(f"\n🚨 {overall_results.tests_failed} DELETE TESTS FAILED")
        print("❌ Delete operations have permission issues that need attention")
        sys.exit(1)

if __name__ == "__main__":
    main()