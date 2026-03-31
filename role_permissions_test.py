#!/usr/bin/env python3
"""
DCAPP V1 Role-Based Permissions Test Suite
Tests the newly restructured permission system for each role
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Optional

# Backend URL from frontend environment
BACKEND_URL = "https://dcapp-sales-hub.preview.emergentagent.com/api"

# Test credentials from the request
TEST_CREDENTIALS = {
    "director": {
        "email": "director@dcapp.com",
        "password": "dcapp123",
        "role": "Director"
    },
    "dca": {
        "email": "dca.meridien@dcapp.com", 
        "password": "dcapp123",
        "role": "DCA"
    }
}

class RolePermissionsTester:
    def __init__(self):
        self.tokens = {}
        self.test_results = []
        self.created_users = []
        self.created_leads = []
        self.user_details = {}
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Dict = None):
        """Log test results with enhanced formatting"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response"] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   → {details}")
        if not success and response_data:
            if isinstance(response_data, dict) and 'detail' in response_data:
                print(f"   → Error: {response_data['detail']}")
        print()
    
    def make_request(self, method: str, endpoint: str, headers: Dict = None, data: Dict = None, expected_status: int = None):
        """Make HTTP request with error handling"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PATCH":
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return None, {"error": f"Unsupported method: {method}"}
            
            # If expected_status is provided, check for exact match
            if expected_status is not None:
                return response.status_code == expected_status, response.json() if response.content else {}
            
            return response.status_code in [200, 201], response.json() if response.content else {}
            
        except requests.exceptions.Timeout:
            return False, {"error": "Request timeout"}
        except requests.exceptions.ConnectionError:
            return False, {"error": "Connection error"}
        except Exception as e:
            return False, {"error": str(e)}
    
    def test_authentication(self):
        """Test basic authentication with provided credentials"""
        print("=== TESTING AUTHENTICATION ===")
        
        for role, credentials in TEST_CREDENTIALS.items():
            success, data = self.make_request("POST", "/auth/login", data=credentials)
            
            if success and "access_token" in data:
                self.tokens[role] = data["access_token"]
                
                # Get user details
                headers = {"Authorization": f"Bearer {data['access_token']}"}
                user_success, user_data = self.make_request("GET", "/auth/me", headers=headers)
                
                if user_success:
                    self.user_details[role] = user_data
                    self.log_test(
                        f"Login & Get User Info - {role.upper()}",
                        True,
                        f"User: {user_data.get('name')} | Role: {user_data.get('role')} | Agency: {user_data.get('agency')}"
                    )
                else:
                    self.log_test(f"Get User Info - {role.upper()}", False, "Failed to get user details", user_data)
            else:
                self.log_test(f"Login - {role.upper()}", False, f"Failed to authenticate", data)
    
    def test_director_permissions(self):
        """Test DIRECTOR role - Should have ONLY supervision access"""
        print("=== TESTING DIRECTOR PERMISSIONS (Read-Only) ===")
        
        if "director" not in self.tokens:
            self.log_test("Director permissions", False, "No director token available")
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['director']}"}
        
        # ✅ SHOULD WORK: View all agencies in dashboard
        success, data = self.make_request("GET", "/metrics/dashboard", headers=headers)
        if success and "agencies" in data:
            self.log_test(
                "Director: View dashboard metrics",
                True,
                f"Can view {len(data['agencies'])} agencies"
            )
        else:
            self.log_test("Director: View dashboard metrics", False, "Cannot access dashboard", data)
        
        # ✅ SHOULD WORK: View reports
        success, data = self.make_request("GET", "/reports/overview", headers=headers)
        if success:
            self.log_test("Director: View reports", True, "Can access reports overview")
        else:
            self.log_test("Director: View reports", False, "Cannot access reports", data)
        
        # ✅ SHOULD WORK: View all leads
        success, data = self.make_request("GET", "/leads", headers=headers)
        if success:
            leads_count = data.get("total", len(data.get("leads", [])))
            self.log_test("Director: View all leads", True, f"Can view leads (total: {leads_count})")
        else:
            self.log_test("Director: View all leads", False, "Cannot access leads", data)
        
        # ❌ SHOULD FAIL: Create users (403 expected)
        new_user_data = {
            "email": "test.asesor@dcapp.com",
            "password": "dcapp123",
            "name": "Test Asesor Digital",
            "role": "Asesor Digital",
            "agency": "Meridien"
        }
        success, data = self.make_request("POST", "/users", headers=headers, data=new_user_data, expected_status=403)
        self.log_test(
            "Director: Create user (should fail)",
            success,
            "Correctly blocked from creating users" if success else "Incorrectly allowed to create users"
        )
        
        # Get a lead to test modification restrictions
        lead_success, lead_data = self.make_request("GET", "/leads", headers=headers)
        if lead_success and lead_data.get("leads"):
            lead_id = lead_data["leads"][0]["id"]
            
            # ❌ SHOULD FAIL: Modify leads (403 expected)
            update_data = {"stage": "Contactado"}
            success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data=update_data, expected_status=403)
            self.log_test(
                "Director: Modify lead (should fail)",
                success,
                "Correctly blocked from modifying leads" if success else "Incorrectly allowed to modify leads"
            )
    
    def test_create_users(self):
        """Create users for testing (using Director or Gerente de Ventas Digitales)"""
        print("=== CREATING TEST USERS ===")
        
        # First check if there's a Gerente de Ventas Digitales we can use
        headers = None
        creator_role = None
        
        # Try to find existing Gerente de Ventas Digitales
        if "director" in self.tokens:
            headers = {"Authorization": f"Bearer {self.tokens['director']}"}
            # Get all users to find Gerente de Ventas Digitales
            success, data = self.make_request("GET", "/users/all", headers=headers)
            if success:
                for user in data:
                    if user.get("role") == "Gerente de Ventas Digitales":
                        print(f"Found existing Gerente de Ventas Digitales: {user['name']} ({user['email']})")
                        # We'll use director for now since we don't have their credentials
                        creator_role = "director"
                        break
        
        if not headers:
            self.log_test("Create test users", False, "No suitable token for user creation")
            return
        
        # Create Gerente de Ventas Digitales first if none exists
        gerente_data = {
            "email": "gerente.ventas.digital@dcapp.com",
            "password": "dcapp123",
            "name": "Gerente de Ventas Digitales Test",
            "role": "Gerente de Ventas Digitales",
            "agency": "Meridien"
        }
        
        # Note: Director cannot create users, so this should fail
        # But let's try for completeness
        success, data = self.make_request("POST", "/users", headers=headers, data=gerente_data)
        if success:
            self.created_users.append(data["id"])
            # Get token for the new gerente
            login_success, login_data = self.make_request("POST", "/auth/login", data={
                "email": gerente_data["email"],
                "password": gerente_data["password"]
            })
            if login_success:
                self.tokens["gerente_digital"] = login_data["access_token"]
                headers = {"Authorization": f"Bearer {login_data['access_token']}"}
                self.log_test("Create Gerente de Ventas Digitales", True, f"Created: {data['name']}")
            else:
                self.log_test("Login Gerente de Ventas Digitales", False, "Cannot login as created user")
        else:
            self.log_test("Create Gerente de Ventas Digitales", False, "Cannot create user with current permissions", data)
            return
        
        # Create Asesor Digital
        asesor_data = {
            "email": "asesor.digital.test@dcapp.com",
            "password": "dcapp123",
            "name": "Asesor Digital Test",
            "role": "Asesor Digital",
            "agency": "Meridien"
        }
        
        success, data = self.make_request("POST", "/users", headers=headers, data=asesor_data)
        if success:
            self.created_users.append(data["id"])
            # Get token
            login_success, login_data = self.make_request("POST", "/auth/login", data={
                "email": asesor_data["email"],
                "password": asesor_data["password"]
            })
            if login_success:
                self.tokens["asesor_digital"] = login_data["access_token"]
                self.user_details["asesor_digital"] = data
                self.log_test("Create Asesor Digital", True, f"Created: {data['name']}")
        else:
            self.log_test("Create Asesor Digital", False, "Failed to create user", data)
    
    def test_dca_permissions(self):
        """Test DCA role permissions"""
        print("=== TESTING DCA PERMISSIONS ===")
        
        if "dca" not in self.tokens:
            self.log_test("DCA permissions", False, "No DCA token available")
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['dca']}"}
        dca_user = self.user_details.get("dca")
        
        # ✅ SHOULD WORK: View leads from their agency
        success, data = self.make_request("GET", "/leads?agency=Meridien", headers=headers)
        if success:
            leads_count = data.get("total", len(data.get("leads", [])))
            self.log_test("DCA: View agency leads", True, f"Can view {leads_count} leads from Meridien")
        else:
            self.log_test("DCA: View agency leads", False, "Cannot view agency leads", data)
        
        # ✅ SHOULD WORK: Create leads
        new_lead_data = {
            "name": "Lead Creado por DCA Test",
            "phone": "5555551234",
            "agency": "Meridien",
            "origin": "Facebook",
            "campaign": "Test DCA Campaign",
            "dca_id": dca_user["id"] if dca_user else ""
        }
        
        success, data = self.make_request("POST", "/leads", headers=headers, data=new_lead_data)
        if success:
            lead_id = data["id"]
            self.created_leads.append(lead_id)
            self.log_test("DCA: Create lead", True, f"Created lead: {data['name']} (ID: {lead_id})")
            
            # ✅ SHOULD WORK: Move lead through DCA stages (Lead → Contactado → Citado → Cumplida)
            for stage in ["Contactado", "Citado", "Cumplida"]:
                update_success, update_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": stage})
                if update_success:
                    self.log_test(f"DCA: Move lead to {stage}", True, f"Successfully moved to {stage}")
                else:
                    self.log_test(f"DCA: Move lead to {stage}", False, f"Failed to move to {stage}", update_data)
            
            # ❌ SHOULD FAIL: Move beyond Cumplida (Demo should fail)
            demo_success, demo_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": "Demo"}, expected_status=403)
            self.log_test(
                "DCA: Move to Demo (should fail)",
                demo_success,
                "Correctly blocked from moving beyond Cumplida" if demo_success else "Incorrectly allowed to move to Demo"
            )
            
            # ✅ SHOULD WORK: Assign asesor (if we have one)
            if "asesor_digital" in self.user_details:
                asesor_id = self.user_details["asesor_digital"]["id"]
                assign_success, assign_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"asesor_id": asesor_id})
                if assign_success:
                    self.log_test("DCA: Assign asesor", True, f"Successfully assigned asesor")
                else:
                    self.log_test("DCA: Assign asesor", False, "Failed to assign asesor", assign_data)
            
            # ❌ SHOULD FAIL: Reassign DCA
            other_dca_success, other_dca_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"dca_id": "673db091d07e5e0b09cac897"}, expected_status=403)
            self.log_test(
                "DCA: Reassign DCA (should fail)",
                other_dca_success,
                "Correctly blocked from reassigning DCA" if other_dca_success else "Incorrectly allowed to reassign DCA"
            )
            
            # ❌ SHOULD FAIL: Register sale
            sale_data = {
                "lead_id": lead_id,
                "marca": "Cadillac",
                "modelo": "CT5",
                "version": "Premium",
                "precio": 800000,
                "cantidad": 1,
                "tipo_venta": "Contado",
                "asesor_id": dca_user["id"] if dca_user else "",
                "dca_id": dca_user["id"] if dca_user else "",
                "origen": "Facebook",
                "campaign": "Test Campaign",
                "facturado_a": "Cliente Test",
                "fecha_factura": datetime.utcnow().isoformat()
            }
            sale_success, sale_response = self.make_request("POST", "/sales", headers=headers, data=sale_data, expected_status=403)
            self.log_test(
                "DCA: Register sale (should fail)",
                sale_success,
                "Correctly blocked from registering sales" if sale_success else "Incorrectly allowed to register sales"
            )
        else:
            self.log_test("DCA: Create lead", False, "Cannot create leads", data)
    
    def test_asesor_digital_permissions(self):
        """Test Asesor Digital permissions"""
        print("=== TESTING ASESOR DIGITAL PERMISSIONS ===")
        
        if "asesor_digital" not in self.tokens:
            self.log_test("Asesor Digital permissions", False, "No Asesor Digital token available")
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['asesor_digital']}"}
        asesor_user = self.user_details.get("asesor_digital")
        
        # ❌ SHOULD FAIL: View dashboard (403 expected)
        dashboard_success, dashboard_data = self.make_request("GET", "/metrics/dashboard", headers=headers, expected_status=403)
        self.log_test(
            "Asesor Digital: View dashboard (should fail)",
            dashboard_success,
            "Correctly blocked from viewing dashboard" if dashboard_success else "Incorrectly allowed to view dashboard"
        )
        
        # ❌ SHOULD FAIL: View reports (403 expected)
        reports_success, reports_data = self.make_request("GET", "/reports/overview", headers=headers, expected_status=403)
        self.log_test(
            "Asesor Digital: View reports (should fail)",
            reports_success,
            "Correctly blocked from viewing reports" if reports_success else "Incorrectly allowed to view reports"
        )
        
        # ❌ SHOULD FAIL: View agency metrics (403 expected)
        agency_success, agency_data = self.make_request("GET", "/metrics/agency/Meridien", headers=headers, expected_status=403)
        self.log_test(
            "Asesor Digital: View agency metrics (should fail)",
            agency_success,
            "Correctly blocked from viewing agency metrics" if agency_success else "Incorrectly allowed to view agency metrics"
        )
        
        # ✅ SHOULD WORK: Only see assigned leads
        leads_success, leads_data = self.make_request("GET", "/leads", headers=headers)
        if leads_success:
            assigned_leads = leads_data.get("leads", [])
            if asesor_user:
                # Check that all leads are assigned to this asesor
                all_assigned = all(lead.get("asesor_id") == asesor_user["id"] for lead in assigned_leads)
                self.log_test(
                    "Asesor Digital: View only assigned leads", 
                    all_assigned,
                    f"Viewing {len(assigned_leads)} leads, all properly assigned" if all_assigned else f"Some leads not assigned to this asesor"
                )
        else:
            self.log_test("Asesor Digital: View assigned leads", False, "Cannot view leads", leads_data)
        
        # Test stage movements (if we have a lead assigned to this asesor)
        if self.created_leads and asesor_user:
            lead_id = self.created_leads[0]
            
            # Make sure the lead is assigned to this asesor and at Cumplida stage
            if "dca" in self.tokens:
                dca_headers = {"Authorization": f"Bearer {self.tokens['dca']}"}
                self.make_request("PATCH", f"/leads/{lead_id}", headers=dca_headers, data={
                    "asesor_id": asesor_user["id"],
                    "stage": "Cumplida"
                })
            
            # ✅ SHOULD WORK: Move through asesor stages (Cumplida → Demo → Cierre → Facturada)
            for stage in ["Demo", "Cierre"]:
                stage_success, stage_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": stage})
                if stage_success:
                    self.log_test(f"Asesor Digital: Move to {stage}", True, f"Successfully moved to {stage}")
                else:
                    self.log_test(f"Asesor Digital: Move to {stage}", False, f"Failed to move to {stage}", stage_data)
            
            # ✅ SHOULD WORK: Register sale (move to Facturada)
            sale_data = {
                "lead_id": lead_id,
                "marca": "Cadillac",
                "modelo": "CT5",
                "version": "Premium",
                "precio": 800000,
                "cantidad": 1,
                "tipo_venta": "Contado",
                "asesor_id": asesor_user["id"],
                "dca_id": self.user_details.get("dca", {}).get("id", ""),
                "origen": "Facebook",
                "campaign": "Test Campaign",
                "facturado_a": "Cliente Asesor Test",
                "fecha_factura": datetime.utcnow().isoformat()
            }
            sale_success, sale_data_resp = self.make_request("POST", "/sales", headers=headers, data=sale_data)
            if sale_success:
                self.log_test("Asesor Digital: Register sale", True, f"Successfully registered sale for lead {lead_id}")
            else:
                self.log_test("Asesor Digital: Register sale", False, "Failed to register sale", sale_data_resp)
            
            # ❌ SHOULD FAIL: Change DCA
            dca_change_success, dca_change_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"dca_id": "673db091d07e5e0b09cac897"}, expected_status=403)
            self.log_test(
                "Asesor Digital: Change DCA (should fail)",
                dca_change_success,
                "Correctly blocked from changing DCA" if dca_change_success else "Incorrectly allowed to change DCA"
            )
            
            # ❌ SHOULD FAIL: Reassign to another asesor
            reassign_success, reassign_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"asesor_id": "673db091d07e5e0b09cac898"}, expected_status=403)
            self.log_test(
                "Asesor Digital: Reassign asesor (should fail)",
                reassign_success,
                "Correctly blocked from reassigning asesor" if reassign_success else "Incorrectly allowed to reassign asesor"
            )
    
    def test_gerente_ventas_digitales_permissions(self):
        """Test Gerente de Ventas Digitales permissions (if created)"""
        print("=== TESTING GERENTE DE VENTAS DIGITALES PERMISSIONS ===")
        
        if "gerente_digital" not in self.tokens:
            self.log_test("Gerente Ventas Digitales permissions", False, "No Gerente de Ventas Digitales token available")
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['gerente_digital']}"}
        
        # ✅ SHOULD WORK: Full control - create users
        test_user_data = {
            "email": "test.marketing@dcapp.com",
            "password": "dcapp123",
            "name": "Test Marketing User",
            "role": "Marketing",
            "agency": "Jetour"
        }
        
        user_success, user_data = self.make_request("POST", "/users", headers=headers, data=test_user_data)
        if user_success:
            self.created_users.append(user_data["id"])
            self.log_test("Gerente Ventas Digitales: Create user", True, f"Created user: {user_data['name']}")
        else:
            self.log_test("Gerente Ventas Digitales: Create user", False, "Failed to create user", user_data)
        
        # ✅ SHOULD WORK: Move leads to any stage
        if self.created_leads:
            lead_id = self.created_leads[0]
            for stage in ["Lead", "Demo", "Facturada"]:
                stage_success, stage_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": stage})
                if stage_success:
                    self.log_test(f"Gerente Ventas Digitales: Move to {stage}", True, f"Can move to any stage")
                    break  # Just test one successful move
                else:
                    self.log_test(f"Gerente Ventas Digitales: Move to {stage}", False, f"Failed to move to {stage}", stage_data)
        
        # ✅ SHOULD WORK: Reassign DCA and Asesor
        if self.created_leads and "dca" in self.user_details:
            lead_id = self.created_leads[0]
            dca_id = self.user_details["dca"]["id"]
            
            reassign_success, reassign_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"dca_id": dca_id})
            if reassign_success:
                self.log_test("Gerente Ventas Digitales: Reassign DCA", True, "Can reassign DCA and asesor")
            else:
                self.log_test("Gerente Ventas Digitales: Reassign DCA", False, "Failed to reassign", reassign_data)
    
    def run_comprehensive_test(self):
        """Run the comprehensive role-based permissions test"""
        print("🔒 DCAPP V1 ROLE-BASED PERMISSIONS TEST SUITE 🔒")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Testing new permission system with roles: {list(TEST_CREDENTIALS.keys())}")
        print("=" * 80)
        
        start_time = time.time()
        
        # Run test suites in order
        self.test_authentication()
        self.test_director_permissions()
        self.test_create_users()
        self.test_dca_permissions()
        self.test_asesor_digital_permissions()
        self.test_gerente_ventas_digitales_permissions()
        
        # Generate summary
        end_time = time.time()
        duration = end_time - start_time
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t["success"]])
        failed_tests = total_tests - passed_tests
        
        print("=" * 80)
        print("🎯 ROLE-BASED PERMISSIONS TEST RESULTS")
        print("=" * 80)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        print()
        
        # Detailed results by role
        roles_tested = set()
        for test in self.test_results:
            if ":" in test["test"]:
                role = test["test"].split(":")[0]
                roles_tested.add(role)
        
        for role in sorted(roles_tested):
            role_tests = [t for t in self.test_results if t["test"].startswith(role + ":")]
            if role_tests:
                role_passed = len([t for t in role_tests if t["success"]])
                role_total = len(role_tests)
                print(f"📊 {role}: {role_passed}/{role_total} tests passed ({(role_passed/role_total)*100:.1f}%)")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            print("-" * 60)
            for test in self.test_results:
                if not test["success"]:
                    print(f"• {test['test']}")
                    print(f"  └─ {test['details']}")
        
        print("\n✅ PASSED TESTS:")
        print("-" * 60)
        for test in self.test_results:
            if test["success"]:
                print(f"• {test['test']}")
                print(f"  └─ {test['details']}")
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "duration": duration,
            "roles_tested": list(roles_tested),
            "detailed_results": self.test_results
        }

if __name__ == "__main__":
    tester = RolePermissionsTester()
    results = tester.run_comprehensive_test()